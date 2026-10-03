/**
 * @acme/theme — the single token source (PROMPT-2).
 * Harlem Might brand: logo gold (#F8C626, sampled from the landscape mark) on
 * the splash's warm black. The public site renders dark; light values remain
 * for the mobile app's light mode.
 *
 * `build-css.mjs` emits theme.css (web/storybook, Tailwind v4 `@theme` with
 * light-dark()) and theme-native.css (mobile, Uniwind `@variant` theme blocks)
 * from the tokens below. TS consumers (Skia, charts,
 * programmatic color math) import these exports directly.
 * No hex values exist outside this file.
 */

// ---- primitive palettes -----------------------------------------------------

export const palette = {
  // Harlem Mights v2 — the only colors public-site surfaces may use.
  mights: {
    // Brand gold, sampled from Harlem-Might-Logo-landscape.png.
    gold: '#F8C626',
    'gold-highlight': '#F8D848',
    'gold-shade': '#E0A810',
    'gold-dim': '#8A6E1F',
    // Warm black from the splash (#070502), lifted one step for the canvas.
    'warm-black': '#0B0906',
    limestone: '#EEF0EC',
    paper: '#FBFBF9',
    raised: '#FFFFFF',
    'stoop-iron': '#171C1A',
    'iron-muted': '#4D5652',
    brownstone: '#6E4636',
    'marquee-red': '#C8102E',
    'transit-cobalt': '#1F4FE0',
    verdigris: '#2B7564',
    'sodium-amber': '#F2A900',
    'spatial-cyan': '#0E8FA3',
    night: '#0E1412',
  },
  // ponytail: legacy scales below still back the mobile shell and schedule
  // demo; delete them with those screens.
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
  surface: { light: '#EEF0EC', dark: '#0B0906' },
  'surface-raised': { light: '#FFFFFF', dark: '#15120D' },
  'surface-sunken': { light: '#E5E9E5', dark: '#070604' },
  paper: { light: '#FBFBF9', dark: '#110E0A' },
  brownstone: { light: '#6E4636', dark: '#C9A08E' },
  verdigris: { light: '#2B7564', dark: '#5FB8A4' },
  amber: { light: '#F2A900', dark: '#F2A900' },
  spatial: { light: '#0E8FA3', dark: '#5FD1E1' },
  // 1px hairline = iron-muted @ 20%; rail = stoop-iron at full strength.
  'rule-hairline': { light: 'rgba(77, 86, 82, 0.2)', dark: 'rgba(248, 198, 38, 0.16)' },
  'rule-rail': { light: '#171C1A', dark: '#8A6E1F' },
  text: { light: '#171C1A', dark: '#F4EEE0' },
  'text-muted': { light: '#4D5652', dark: '#A89F8B' },
  'text-inverse': { light: '#F7F9F7', dark: '#0B0906' },
  primary: { light: '#1F4FE0', dark: '#F8C626' },
  'primary-pressed': { light: '#173DB3', dark: '#F8D848' },
  'on-primary': { light: '#FFFFFF', dark: '#0B0906' },
  accent: { light: '#C8102E', dark: '#FF6B7F' },
  'accent-pressed': { light: '#A70D27', dark: '#FF8A99' },
  'on-accent': { light: '#FFFFFF', dark: '#0B0906' },
  border: { light: '#CBD2CE', dark: '#2A241A' },
  'border-strong': { light: '#7D8983', dark: '#5A503E' },
  focus: { light: '#1F4FE0', dark: '#F8C626' },
  danger: { light: '#B4232F', dark: '#FF7A85' },
  'on-danger': { light: '#FFFFFF', dark: '#3D0508' },
} as const;

// ---- typography -------------------------------------------------------------

export const fontFamilies = {
  // Mona Sans (wght 200–900, wdth 75–125, opsz 0–100): UI, headlines, data.
  // Display = the same family pushed to the condensed end via font-stretch.
  display: "var(--font-mona), 'Mona Sans', system-ui, sans-serif",
  sans: "var(--font-mona), 'Mona Sans', system-ui, -apple-system, sans-serif",
  // Newsreader (wght 200–800, opsz 6–72): long-form story body only.
  serif: "var(--font-newsreader), 'Newsreader', Georgia, serif",
} as const;

/** Modular scale, ratio 1.25 from 16px snapped to 4px:
 *  16 · 20 · 25 · 32 · 40 · 50 · 64 · 80 · 100 · 128. */
export const typeScale = {
  marquee: { size: '8rem', lineHeight: '0.9', tracking: '-0.01em' },
  'display-2xl': { size: '6.25rem', lineHeight: '0.92', tracking: '-0.01em' },
  'display-xl': { size: '5rem', lineHeight: '0.95', tracking: '-0.01em' },
  'display-lg': { size: '4rem', lineHeight: '1', tracking: '-0.005em' },
  'display-md': { size: '3.125rem', lineHeight: '1.04', tracking: '0' },
  'display-sm': { size: '2.5rem', lineHeight: '1.1', tracking: '0' },
  'title-lg': { size: '2rem', lineHeight: '1.15', tracking: '0' },
  title: { size: '1.5625rem', lineHeight: '1.25', tracking: '0' },
  lead: { size: '1.25rem', lineHeight: '1.5', tracking: '0' },
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

// Harlem Mights elevation: quiet depth on light surfaces; geometry and rails carry emphasis.
export const shadows = {
  // shadow-stoop: raised sheets and modals only — never under grid cards.
  stoop: '0 12px 32px rgba(23, 28, 26, 0.12)',
  card: '0 1px 2px rgba(23, 28, 26, 0.08), 0 8px 24px rgba(23, 28, 26, 0.05)',
  raised: '0 10px 30px rgba(23, 28, 26, 0.10)',
  overlay: '0 18px 54px rgba(23, 28, 26, 0.16)',
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
