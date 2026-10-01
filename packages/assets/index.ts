// @acme/assets — typed exports for brand assets; no magic string paths in app code.
declare const require: (path: string) => number;

// Retro fonts (OFL): Archivo Black = display slab, Space Grotesk = workhorse sans.
// Native embedding happens via the expo-font config plugin (apps/mobile/app.config.ts);
// web loads them with next/font localFont (apps/web/app/fonts.ts).
export const fonts = {
  archivoBlack: require('./fonts/ArchivoBlack-Regular.ttf') as number,
  spaceGroteskVariable: require('./fonts/SpaceGrotesk-Variable.ttf') as number,
} as const;
