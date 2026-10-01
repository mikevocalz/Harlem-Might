// TS resolution anchor — bundlers load the .native/.web forks.
//
// MUST be .tsx, matching icons.native.tsx. Metro resolves
// .android.ts | .native.ts | .ts | .android.tsx | .native.tsx | .tsx — a `.ts`
// anchor therefore beats a `.tsx` native fork and ships lucide-react (web SVG)
// to the device, where <path> is not a host component.
// Web: lucide-react (className-styled SVGs). Native: lucide-react-native
// wrapped with the css shim so the same text-* classes drive currentColor.
export * from './icons.web';
