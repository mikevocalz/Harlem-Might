import localFont from 'next/font/local';

// Brand fonts from packages/assets (§13.2: one font source, two loaders —
// expo-font plugin on native, next/font localFont here).
export const display = localFont({
  src: [{ path: '../../../packages/assets/fonts/ArchivoBlack-Regular.ttf', style: 'normal' }],
  variable: '--font-display',
  display: 'swap',
});

export const sans = localFont({
  src: [{ path: '../../../packages/assets/fonts/SpaceGrotesk-Variable.ttf', style: 'normal' }],
  variable: '--font-sans',
  display: 'swap',
});
