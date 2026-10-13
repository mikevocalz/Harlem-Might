# Explore: real React / Chrome contract gate

This is a bounded **browser component integration gate**, not a production Next.js
server test, visual/device QA, or a replacement for workspace tests.

## Run

From the repository root, with Node from `.nvmrc` and an installed official Chrome
or Chromium (or `CHROME_BIN=/absolute/path/to/chrome`):

```sh
npm ci --prefix tooling/tests/explore-browser --ignore-scripts --legacy-peer-deps --no-audit --no-fund
node --test tooling/tests/explore-browser/runner.test.mjs
node tooling/tests/explore-browser/run.mjs
```

The standalone npm lockfile installs a small public closure without private native
siblings, monorepo postinstall, an application server, tokens, database, or browser
download. All application runtime versions are exact pins, checked against
`pnpm-workspace.yaml` at build time. `--legacy-peer-deps` excludes native-only peer
runtimes; actual browser-side dependencies are listed directly. esbuild's installed
platform package supplies its binary without installation scripts.

The CI workflow uses the [Ubuntu 24.04 hosted image's preinstalled Chrome](https://github.com/actions/runner-images/blob/main/images/ubuntu/Ubuntu2404-Readme.md).
The [official headless CLI](https://developer.chrome.com/docs/automation-and-testing/headless-cli)
runs two viewport widths, an isolated temporary profile, a 15-second virtual time
budget, and a 45-second wall-clock limit. Browser sandbox/security remain enabled.
If a local environment forbids Chrome's sockets/processes, this fails closed; do
not add `--no-sandbox` or security overrides to make it pass.

`dist/` contains each HTML fixture, esbuild source inventory, final DOM, stderr,
and decoded assertion report, including actual browser version, width, React
version and subscription counts. CI retains these artifacts for seven days.

To compile without claiming browser acceptance:

```sh
node tooling/tests/explore-browser/build.mjs
```

For read-only evaluation against a separate immutable checkout, set
`HARLEM_SOURCE_ROOT=/absolute/path/to/checkout`. No production file is rewritten.
`HARLEM_BROWSER_OUTPUT` changes only the artifact directory.

## Actual production paths exercised

- `SheetRegion`, `DirectionsPanel`, `MapRegion`, `NavigationHud`, URL actions and URL helpers
- Navigation UI hooks, runtime, stores, view models and recorded route parser
- `@acme/ui/tw`, semantic HTML adapters and production DOM button implementation
- `MightsButton`, headings/text, location stamp, map fallback, icons and routes
- Pinned real React/ReactDOM, Zustand, React Native Web, Expo HTML Elements,
  react-native-css, Legend Motion, tailwind-variants, tailwind-merge and lucide-react

The production UI barrel is narrowed to the real motion/reduced-motion modules;
the production Mights barrel is narrowed to reexports of the five production modules
used by this surface. No production components, navigation hooks, stores, DOM tree,
React state/effect implementation, ref lifecycle, media queries or history are
reimplemented. The bundle inventory must contain the listed critical production
modules, otherwise the build fails.

## Explicit controlled boundaries

- Solito's Next router provider is replaced by a small real-History adapter.
  It notifies actual `useSyncExternalStore` on push/replace/popstate. Next App Router,
  server rendering/hydration, Activity restoration and Solito integration remain
  outside this gate.
- The Mapbox GPU/network canvas is a controlled DOM leaf. The actual MapRegion
  and NavigationHud render and execute the Steps action, which opens the real
  full sheet. Map dismissal and repeated Steps exercise production callbacks.
- Solito link/image leaves use actual browser `<a>`/`<img>` elements; link/image
  routing or loading is not tested. No Mapbox token is provided. Map image fallback
  is production code. Geolocation and route service network calls are not used.
- Test catalogue inputs are two production previews; the guidance session is
  injected through the real store using a recorded route and production parser.
  This does not validate a physical GPS/navigation trip.
- The React observer forwards directly to the pinned original
  `React.useSyncExternalStore`. It only wraps each real subscribe/unsubscribe and
  notification to count ownership. ReactDOM uses the original React object. No
  subscription schedules a manual render and no test manually assigns the sheet
  ref. React's real `act` flushes commits/effects. StrictMode checks effect replay.
- The 30-second clock's interval calls are observed and forwarded to actual
  browser timers, not replaced by a fake clock.
- Controls are activated via real DOM focus/click and keyboard event dispatch;
  this tests browser focus/inert semantics, not trusted hardware input or a full
  user-level Tab-navigation/assistive-technology run. Production Tailwind output
  is not generated here, so this is not layout/visual acceptance.

## Assertions and negative controls

The actual store publications must update the mounted real React tree without a
manual rerender. Cases cover repeated Directions Back focus, stale selection and
guidance races, modal inert cleanup/reacquisition, native History Back/Forward,
Escape guards, DOM ref mount/unmount ownership, selected-store rerender suppression,
StrictMode subscriptions, post-unmount unsubscribe and a shared clock with multiple
consumers.

The runner also builds three **in-memory** production-source mutations: moving Back
focus before commit, making the guiding hook always false, and pinning the prior
modal policy that ignores sheet visibility. Each must fail its
specific regression, not merely any assertion or a browser crash. The production
files stay untouched. `--no-mutations` is an explicit local diagnostic option;
CI always runs all three negative controls.

Node runner tests verify parsing and failure handling only. Their synthetic result
records are never called browser evidence. A zero exit code requires both real
Chrome baseline viewports to complete every named case and all three mutants to be
rejected. A blank page, missing browser, skipped contract, runtime error, wrong
viewport/runtime, incomplete report or failure remains a failure.
