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
 * No hex values belong outside this file. Known exception still to migrate:
 * packages/spatial/sightline (audit §15, contradiction 4).
 */

// ---- primitive palettes -----------------------------------------------------

export const palette = {
  // Harlem Might brand colors — the only colors public-site surfaces may use.
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
  // demo; delete them with those screens. Three names do not match their
  // colors: `burgundy` is yellow, `ember` is pink, `gold` is blue. They keep
  // their names because packages/app and packages/ui still use them (consumer
  // list: docs/design/MIGHTS_REUSE_MATRIX.md). Public-site code must not.
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
  // choir calendar event-type accents. `gold` here is a BLUE scale; brand
  // gold is `mights.gold` / semantic `primary`.
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
  // The only visible edge of text inputs, so it must reach 3:1 against the
  // input fill (WCAG 1.4.11). Dark: 3.50:1 on surface-raised #15120D, 3.73:1
  // on surface. Light: 3.63:1 on surface-raised #FFFFFF, 3.17:1 on surface.
  'border-strong': { light: '#7D8983', dark: '#756A52' },
  focus: { light: '#1F4FE0', dark: '#F8C626' },
  danger: { light: '#B4232F', dark: '#FF7A85' },
  'on-danger': { light: '#FFFFFF', dark: '#3D0508' },
  // ---- Explore / spatial (design-system.md §6) ----
  // Selected row or chip fill. Pairs with a 2px `rule-rail` leading edge, so
  // selection never relies on fill alone, and differs from `focus`, which is
  // also gold in dark mode.
  selected: { light: 'rgba(31, 79, 224, 0.10)', dark: 'rgba(248, 198, 38, 0.12)' },
  // Map marker at rest: a limestone dot with a gold-dim ring (rule-rail).
  'map-marker': { light: '#171C1A', dark: '#F4EEE0' },
  // Selected marker fill; its glyph and label sit on it in `on-primary`.
  'map-marker-selected': { light: '#1F4FE0', dark: '#F8C626' },
  // Walking route line. Dark 11.07:1 on surface.
  route: { light: '#0E8FA3', dark: '#5FD1E1' },
  // Map canvas behind the markers (= surface-sunken), the warm-dark basemap land.
  'map-canvas': { light: '#E5E9E5', dark: '#070604' },
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
  // Steps below `lead` sit off the 1.25 ratio on purpose: reading and UI
  // sizes follow legibility, not the display scale. Each one replaced a
  // `text-[Npx]` literal in packages/ui/mights (audit §15).
  /** Card and module headings (MightsHeading size="card"). 20px. */
  card: { size: '1.25rem', lineHeight: '1.75rem', tracking: '0' },
  /** Newsreader long-form body (MightsProse). 19px at a loose 1.75 leading. */
  prose: { size: '1.1875rem', lineHeight: '1.75', tracking: '0' },
  /** Lead paragraph below 768px, where 20px wraps too early. 18px. */
  'lead-sm': { size: '1.125rem', lineHeight: '1.75rem', tracking: '0' },
  /** Default UI and body copy. 16px. */
  body: { size: '1rem', lineHeight: '1.75rem', tracking: '0' },
  /** Button labels and footer/contents link lists. 15px. */
  ui: { size: '0.9375rem', lineHeight: '1.5rem', tracking: '0' },
  /** Secondary copy: street lines, nav links, metadata. 14px. */
  small: { size: '0.875rem', lineHeight: '1.5rem', tracking: '0' },
  /** Captions, breadcrumbs, group headings, status lines. 13px. */
  label: { size: '0.8125rem', lineHeight: '1.25rem', tracking: '0' },
  /** Map attribution and dock labels; the floor for any visible text. 11px. */
  caption: { size: '0.6875rem', lineHeight: '1rem', tracking: '0' },

  // Spatial steps (design-system.md §2). ABSOLUTE px, not rem: the native rem
  // polyfill is 14 (apps/mobile/metro.config.js), which would shrink a rem
  // size to 14/16 of itself. Px literals pass through unscaled, so these
  // render at exactly these dp in a Horizon window. Used by Explore on quest
  // builds; the flat scale above stays for phones and the web.
  /** Map attribution, source lines, timestamps. */
  'xr-caption': { size: '14px', lineHeight: '20px', tracking: '0' },
  /** Chips, marker labels, metadata, status. */
  'xr-label': { size: '16px', lineHeight: '22px', tracking: '0' },
  /** Street lines, list detail, assistant text. */
  'xr-body': { size: '18px', lineHeight: '28px', tracking: '0' },
  /** Row names, section headings. */
  'xr-title': { size: '22px', lineHeight: '28px', tracking: '0' },
  /** Window titles and the place name in a 440dp Detail window. */
  'xr-heading': { size: '30px', lineHeight: '36px', tracking: '0' },
  /** Newsreader story body at viewing distance. */
  'xr-prose': { size: '20px', lineHeight: '34px', tracking: '0' },
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

  // Explore panes (handoff.md §4). Absolute px so the rem-14 polyfill cannot
  // shrink them; the map takes whatever is left and must stay the widest pane.
  'pane-discover': '320px',
  'pane-discover-narrow': '280px',
  'pane-detail': '360px',
  'pane-detail-xr': '440px',
  // Assistant (handoff §6): the collapsed bar caps at 560, the panel is 400.
  'assistant-bar': '560px',
  'assistant-panel': '400px',
} as const;

/**
 * Named spacing. The 4px Tailwind scale (`--spacing: 0.25rem`) stays the
 * rhythm for every gap and padding; these names exist only for lengths that
 * carry meaning across components. Emitted as `--spacing-<name>`, so Tailwind
 * v4 generates `p-rail`, `h-rail`, `h-dock`, `pb-dock`, etc.
 */
export const spacing = {
  /** The 2px rail: notch-card frame, figure frame, nav underline. */
  rail: '0.125rem',
  /** Mobile dock bar height (MightsDock), excluding the safe-area inset. */
  dock: '3.5rem',
  // Absolute px, like the xr-* type steps, so the rem-14 polyfill cannot
  // shrink a hit area below Meta's 48dp floor (design-system.md §4).
  /** Minimum hit area for anything pressable in Explore. */
  target: '48px',
  /** Minimum gap between adjacent targets; gaze jitter needs the margin. */
  'target-gap': '12px',
  /** Content padding inside a SpatialWindow or Horizon pane. */
  window: '24px',
  /** Focus ring width; a 2px ring is hard to see at headset distance. */
  'focus-ring': '3px',
  /** Map marker dot at rest, and selected (design-system.md §6). */
  marker: '20px',
  'marker-selected': '28px',
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

// Elevation. Every value is a stoop-iron shadow, which reads on the mobile
// app's light surfaces and all but disappears on the site's warm-black dark
// mode. On the dark site, rails and geometry carry emphasis, not shadows.
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

// build-css.mjs emits durations as `--transition-duration-<name>` inside
// @theme, so Tailwind v4 generates `duration-fast` etc. (it resolves the
// `duration-*` utility against that namespace), plus the `--duration-<name>`
// :root vars for plain CSS.
export const motion = {
  duration: {
    fast: '120ms',
    base: '200ms',
    slow: '300ms',
    slower: '500ms',
    /** Map camera fly on selection (web uses Mapbox `speed 1.4`). */
    camera: '600ms',
  },
  easing: {
    standard: 'cubic-bezier(0.2, 0, 0, 1)',
    emphasized: 'cubic-bezier(0.3, 0, 0, 1)',
    exit: 'cubic-bezier(0.4, 0, 1, 1)',
  },
  /**
   * Legend Motion springs, previously literals in the SplitView. Not emitted
   * to CSS. Under reduced motion every spring becomes an instant change
   * (`@acme/ui` `useReducedMotion`).
   */
  spring: {
    /** Pane swaps and width changes. */
    pane: { damping: 22, stiffness: 320 },
    /** Drawers and the assistant panel. */
    drawer: { damping: 32, stiffness: 140, mass: 1.1 },
  },
} as const;

export const breakpoints = {
  sm: '40rem',
  md: '48rem',
  lg: '64rem',
  xl: '80rem',
  '2xl': '96rem',
} as const;

/**
 * Native window-size classes in dp (Material 3 width bands). The SplitView and
 * the Explore layout read these; web layout uses `breakpoints` above.
 */
export const windowClass = {
  extraLarge: 1600,
  large: 1200,
  expanded: 840,
  medium: 600,
  compact: 0,
} as const;

/**
 * Meta Horizon OS window sizes in dp (handoff.md §1, decision H-1). Discover
 * and Detail share a 600dp height so their edges line up around the 800dp
 * main window.
 */
export const spatialWindow = {
  discover: { width: 360, height: 600 },
  detail: { width: 440, height: 600 },
} as const;

/** The Horizon main window's default size and narrowest reflow width, in dp. */
export const horizonMainWindow = {
  width: 1280,
  height: 800,
  minWidth: 360,
} as const;

export type Palette = typeof palette;
export type SemanticColor = keyof typeof semantic;
export type ContentWidth = keyof typeof contentWidths;
export type TypeStep = keyof typeof typeScale;
