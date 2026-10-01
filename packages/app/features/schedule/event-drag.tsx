// TS resolution anchor — bundlers load the .native/.web forks.
//
// MUST be .tsx, matching the forks' extension. Metro resolves
// .android.ts | .native.ts | .ts | .android.tsx | .native.tsx | .tsx — a `.ts`
// anchor beside `.tsx` forks wins on native and ships the WEB build to device.
export * from './event-drag.web';
