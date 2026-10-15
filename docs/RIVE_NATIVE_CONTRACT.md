# Pinned Rive Android ownership regression

The native lane remains Rive **0.5.2**, Nitro **0.37.1**, React Native
**0.88.0-rc.4**, and Expo **58.0.7**. The linked Mapbox and Viro packages are
unchanged. Any upgrade must review the package patch and verification pins.

## Why the patch exists

Rive 0.5.2 ships a generated `HybridRiveViewComponentDescriptor::adopt()` that
calls `ConcreteShadowNode::getConcreteSharedProps()`. In the pinned RN header,
that getter returns a reference to a temporary `shared_ptr` produced by
`static_pointer_cast`. Reading it after the getter returns is undefined behavior.

[Nitro PR #1502](https://github.com/margelo/nitro/pull/1502) fixes this ownership
pattern in Nitro. Updating Nitro alone does not update Rive's separately shipped
generated descriptor. The version-specific pnpm patch changes only Rive's
Android `adopt()` to start with the stable `ShadowNode::getProps()` owner and keep
the static and const casts in named, by-value `shared_ptr` handles. The Props
object is not copied. Rive's existing state ownership and public API are retained.

This does not regenerate Nitrogen output or claim that a broader Nitro peer
range is supported. Any peer-metadata exception needs its own bounded review;
passing this check establishes only the C++ contract and ownership coverage
listed below.

## Run the focused check

After the frozen pnpm install has applied the registered patch:

```sh
CXX=clang++ JAVA_HOME=/path/to/jdk-21 node tooling/verify-rive-android-cpp.mjs
```

Requirements: Linux, Clang with C++20 and ASan/UBSan runtimes, a JDK with JNI
headers, curl, and unzip. The CI workflow runs this after installing the actual
workspace dependency graph. It does not install a substitute Rive or Nitro
version to get a green result.

The verifier:

1. Checks all four installed versions exactly.
2. Downloads the official RN 0.88.0-rc.4 release AAR and its fbjni 0.7.0 AAR,
   verifies hard-coded SHA-256 digests, and extracts only their headers. Archives
   are cached in `RIVE_CPP_CACHE` (default: a temporary-directory cache).
3. Checks that RN's npm and Maven headers agree byte-for-byte for `Props`,
   `ShadowNode`, and `ConcreteShadowNode`. Includes the real installed RN and
   Nitro headers, with prefab dependency and Android platform headers.
4. Compiles the **entire installed production Rive descriptor translation unit**
   to a host object with `ANDROID` and `RN_SERIALIZABLE_STATE` enabled. Returning
   a reference to a stack temporary is a compile error. Rive's deprecated
   `CachedProp` use remains upstream technical debt; it is not regenerated here.
5. Reverses only the pinned patch in a temporary source copy and requires that
   compile to fail specifically on RN's dangling-reference getter. No installed
   package is changed by the check.
6. Extracts the installed `adopt()` body and state class, plus both RN getter
   implementations, into a small ownership fixture. ASan/UBSan exercise 1,000
   adoption, clone, props replacement, owner release, and state-retention cycles.
   Identity, reference counts, and exactly-once destruction are asserted. Props
   copying is disabled in the fixture. The fixture uses small node/props stand-ins;
   it does not simulate Fabric or JNI. The separate production compile checks
   the real type contract.

LeakSanitizer is enabled by default in CI. Sandboxed executors running under
ptrace may reject LeakSanitizer before it can report results. Only in that case,
`RIVE_CPP_DETECT_LEAKS=0` runs the same address/undefined-behavior tests and explicit
ownership assertions without claiming leak-sanitizer coverage. The output
reports this setting. Do not disable sanitizers or downgrade a compiler failure
to make the check pass.

## Remaining release gates

This is a **Linux host compile and ownership regression check**, not an Android
NDK ABI/link check, APK build, renderer integration test, or device result. It
cannot establish Kotlin/JNI runtime behavior, Rive rendering or interaction,
linked Mapbox/Viro integration, or iOS Swift/Objective-C compatibility. Those
still require the normal pinned native builds and platform/device smoke tests.
