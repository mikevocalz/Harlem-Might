/**
 * @acme/theme — the single token source (PROMPT-2).
 * Brand: burgundy, black, pumpkin orange. Warm dark mode + elegant light mode.
 *
 * `build-css.mjs` emits theme.css (web/storybook, Tailwind v4 `@theme` with
 * light-dark()) and theme-native.css (mobile, Uniwind `@variant` theme blocks)
 * from the tokens below. TS consumers (Skia, charts,
 * programmatic color math) import these exports directly.
 * No hex values exist outside this file.
 */

// ---- primitive palettes -----------------------------------------------------

export const palette = {
  // RETRO primary — electric yellow (scale name kept for class compatibility)
  burgundy: {
    50: '#FFFCEB',
    100: '#FFF7C7',
    200: '#FFEE8A',
    300: '#FFE14D',
    400: '#FFDB33',
    500: '#F2C700',
    600: '#D1A800',
    700: '#A98700',
    800: '#806400',
    900: '#574400',
    950: '#332800',
  },
  // RETRO accent — hot pink (scale name kept for class compatibility)
  ember: {
    50: '#FFF0F7',
    100: '#FFDBEC',
    200: '#FFB8D9',
    300: '#FF8FC2',
    400: '#FF69B4',
    500: '#F7418F',
    600: '#DB2777',
    700: '#B01B5E',
    800: '#831146',
    900: '#570A2E',
    950: '#33061B',
  },
  // RETRO neutrals — paper cream to true black
  ink: {
    50: '#FFFDF7',
    100: '#F6F3E8',
    200: '#E5E1D3',
    300: '#C4C0B0',
    400: '#94917F',
    500: '#6E6B5C',
    600: '#55524A',
    700: '#3B3833',
    800: '#262420',
    900: '#171614',
    950: '#0D0C0B',
  },
  white: '#FFFFFF',
  // choir calendar event-type accents — warm, dignified, readable on light/dark surfaces
  gold: {
    50: '#EEF4FF', 100: '#DCE8FF', 200: '#B8D0FF', 300: '#8AB0FF',
    400: '#5C8AFF', 500: '#3B6DF6', 600: '#2952D9', 700: '#1F3FAD',
    800: '#172E80', 900: '#101F57', 950: '#0A1433',
  },
  forest: {
    50: '#EEF6F0', 100: '#D3E9D8', 200: '#ADD6B6', 300: '#7DB98B',
    400: '#529B65', 500: '#357A49', 600: '#28613A', 700: '#214E30',
    800: '#183D26', 900: '#102B1C', 950: '#08190F',
  },
  sky: {
    50: '#EEF4FA', 100: '#D4E6F4', 200: '#B3D4ED', 300: '#88BBE2',
    400: '#5B9DD3', 500: '#3B7EB8', 600: '#2F6597', 700: '#28527D',
    800: '#214060', 900: '#172E45', 950: '#0D1B29',
  },
  rose: {
    50: '#FDF2F2', 100: '#FBE0E0', 200: '#F6C5C5', 300: '#EB9C9C',
    400: '#D96B6B', 500: '#C04444', 600: '#A03333', 700: '#7E2929',
    800: '#5D2121', 900: '#3D1717', 950: '#230C0C',
  },
  slate: {
    50: '#F4F4F5', 100: '#E4E4E7', 200: '#D4D4D8', 300: '#A1A1AA',
    400: '#71717A', 500: '#52525B', 600: '#3F3F46', 700: '#27272A',
    800: '#18181B', 900: '#121215', 950: '#09090B',
  },
} as const;

// ---- semantic colors (light / dark) ----------------------------------------
// Emitted as `light-dark(...)` so system-following is zero-code on every platform.

export const semantic = {
  surface: { light: palette.ink[50], dark: '#161411' },
  'surface-raised': { light: palette.white, dark: '#211F1B' },
  'surface-sunken': { light: palette.ink[100], dark: '#0F0E0C' },
  text: { light: palette.ink[950], dark: palette.ink[50] },
  'text-muted': { light: palette.ink[600], dark: palette.ink[400] },
  'text-inverse': { light: palette.ink[50], dark: palette.ink[950] },
  // RETRO: flat electric yellow, black ink on top
  primary: { light: palette.burgundy[400], dark: palette.burgundy[400] },
  'primary-pressed': { light: palette.burgundy[500], dark: palette.burgundy[500] },
  'on-primary': { light: palette.ink[950], dark: palette.ink[950] },
  accent: { light: palette.ember[500], dark: palette.ember[400] },
  'accent-pressed': { light: palette.ember[600], dark: palette.ember[500] },
  'on-accent': { light: palette.ink[950], dark: palette.ink[950] },
  // RETRO: borders are ink, not grey — the outline IS the design
  border: { light: palette.ink[950], dark: palette.ink[50] },
  'border-strong': { light: '#000000', dark: '#FFFDF7' },
  focus: { light: palette.gold[500], dark: palette.gold[400] },
  danger: { light: '#D31F2B', dark: '#FF7A85' },
  'on-danger': { light: palette.white, dark: '#3D0508' },
} as const;

// ---- typography -------------------------------------------------------------

export const fontFamilies = {
  // RETRO: Archivo Black shouts the headlines; Space Grotesk does the work.
  display: "'Archivo Black', 'Arial Black', sans-serif",
  sans: "'Space Grotesk', system-ui, -apple-system, sans-serif",
} as const;

/** Display scale for hero/masthead moments; body text uses the Tailwind defaults. */
export const typeScale = {
  'display-2xl': { size: '4.5rem', lineHeight: '1.05', tracking: '-0.02em' },
  'display-xl': { size: '3.75rem', lineHeight: '1.05', tracking: '-0.02em' },
  'display-lg': { size: '3rem', lineHeight: '1.1', tracking: '-0.01em' },
  'display-md': { size: '2.25rem', lineHeight: '1.15', tracking: '-0.01em' },
  'display-sm': { size: '1.875rem', lineHeight: '1.2', tracking: '0' },
} as const;

// ---- layout -----------------------------------------------------------------

/** §8.2 content-width scale — width scales by adding columns, not stretching. */
export const contentWidths = {
  'content-form': '28rem',
  'content-feed': '38rem',
  'content-prose': '65ch',
  'content-detail': '48rem',
  'content-screen': '56rem',  // Tailwind 4xl — the default screen cap
  'content-wide': '72rem',
  'screen-2xl': '96rem',  // outer cap for every screen (user rule)

  // Adaptive split-view panes. Leading panes are fixed-width and the detail
  // pane flexes, so these are the only widths the split layout ever names —
  // emitted as --container-*, which Tailwind maps to w-*/min-w-*/max-w-*.
  'pane-primary': '20rem',
  'pane-primary-narrow': '16rem',
  'pane-supplementary': '21rem',
  'pane-inspector': '20rem',
} as const;

export const radius = {
  xs: '0.125rem',
  sm: '0.25rem',
  md: '0.375rem',
  lg: '0.5rem',
  card: '0.625rem',
  sheet: '0.875rem',
  full: '9999px',
} as const;

// RETRO elevation: hard offset slabs in the border color — no blur, ever.
export const shadows = {
  card: '4px 4px 0 0 var(--color-border-strong)',
  raised: '6px 6px 0 0 var(--color-border-strong)',
  overlay: '9px 9px 0 0 var(--color-border-strong)',
} as const;

export const zIndex = {
  base: 0,
  raised: 10,
  sticky: 30,
  nav: 50,
  overlay: 70,
  modal: 80,
  toast: 90,
} as const;

// ---- motion -----------------------------------------------------------------

export const motion = {
  duration: {
    fast: '120ms',
    base: '200ms',
    slow: '300ms',
    slower: '500ms',
  },
  easing: {
    standard: 'cubic-bezier(0.2, 0, 0, 1)',
    emphasized: 'cubic-bezier(0.3, 0, 0, 1)',
    exit: 'cubic-bezier(0.4, 0, 1, 1)',
  },
} as const;

export const breakpoints = {
  sm: '40rem',
  md: '48rem',
  lg: '64rem',
  xl: '80rem',
  '2xl': '96rem',
} as const;

export type Palette = typeof palette;
export type SemanticColor = keyof typeof semantic;
export type ContentWidth = keyof typeof contentWidths;
