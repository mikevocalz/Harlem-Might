// TS resolution anchor — bundlers load the .native/.web forks.
//
// MUST be .tsx, matching the forks' extension. Metro resolves in the order
// .android.ts | .native.ts | .ts | .android.tsx | .native.tsx | .tsx — so a
// `.ts` anchor beside `.tsx` forks wins on native and silently ships the WEB
// build to the device.
export * from './dom.web';
