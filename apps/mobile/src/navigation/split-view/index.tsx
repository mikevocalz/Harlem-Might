// TS resolution anchor — bundlers load the .native/.web forks.
//
// MUST be .tsx, matching the forks' extension. Metro resolves in the order
// .android.ts | .native.ts | .ts | .android.tsx | .native.tsx | .tsx — so a
// `.ts` anchor beside `.tsx` forks wins on native and silently ships the WEB
// build to the device.
//
// There is no .web fork: apps/web does not depend on expo-router, so this
// module is native-only. See README.md.
export * from './index.ios';
