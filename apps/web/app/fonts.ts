import localFont from 'next/font/local';

// Brand fonts from packages/assets (one font source, two loaders — expo-font
// plugin on native, next/font localFont here). Latin subsets, woff2.
// Mona Sans axes: wdth 75–125, wght 200–900, opsz 0–100 (read from fvar).
export const mona = localFont({
  src: [{ path: '../../../packages/assets/fonts/MonaSans-Variable.woff2', style: 'normal' }],
  variable: '--font-mona',
  weight: '200 900',
  display: 'swap',
  adjustFontFallback: 'Arial',
  declarations: [{ prop: 'font-stretch', value: '75% 125%' }],
});

// Newsreader axes: wght 200–800, opsz 6–72. Story body only, so not preloaded.
export const newsreader = localFont({
  src: [{ path: '../../../packages/assets/fonts/Newsreader-Variable.woff2', style: 'normal' }],
  variable: '--font-newsreader',
  weight: '200 800',
  display: 'swap',
  preload: false,
  adjustFontFallback: 'Times New Roman',
});
