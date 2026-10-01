// TS resolution anchor — bundlers load the .native/.web forks.
//
// MUST be .tsx to match notify.native.tsx: Metro resolves .native.ts before
// .tsx, so a .ts anchor would win over the native fork and ship sonner (DOM)
// to the device.
export * from './notify.web';
