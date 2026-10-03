# Anti-reference sweep (Phase 0, web visual rebuild)

Branch `design/web-rebuild-phase0`, swept 2026-10-03. Read-only audit; no code changed.

**Scope.** `apps/web` (minus `app/(payload)`, `.next`, `node_modules`, `payload-types.ts`, importMap, `public/` vendored WASM), `packages/ui`, `packages/theme`, plus the `packages/app` and `packages/spatial` files that the public site imports. Emitted `packages/theme/theme.css` and `theme-native.css` are excluded and treated as derived from `tokens.ts`. 277 files were grepped.

**rendered** means:
- `yes`: the file is in the public-site import closure (below). Where a hit was confirmed in SSR HTML from `curl http://localhost:3000/<route>`, the entry says `yes (DOM)`.
- `yes (interaction)`: the file is in the closure, but the code only mounts after a click or at a breakpoint the SSR pass doesn't show (race view, place selection, `xl:`/`2xl:` panes).
- `no`: the file is in a scoped package but outside the closure. Mostly Storybook stories and unused kit components.

All 7 routes returned 200: `/` 54 KB, `/explore` 68 KB, `/schedule` 68 KB, `/spatial` 58 KB, `/notifications` 54 KB, `/profile` 50 KB, `/settings` 49 KB.

## Import closure

I computed the closure with a TypeScript-AST walker. It starts from every file in `apps/web/app/(site)/**` and `apps/web/components/site/**`, plus `app/Document.tsx`, `fonts.ts`, `rn-globals.ts` and `globals.css`. It resolves the workspace `exports` maps with the Turbopack `.web.*` extension order from `next.config.ts`, and it follows barrels only for the names actually imported, which matches `optimizePackageImports`. The two dynamic `import()` calls (`GridScene.web.tsx` → `GridScene.skia.tsx` and `GlyphCity.web.tsx` → `GlyphCity.skia.tsx`) are included. `globals.css` pulls in `@acme/theme/theme.css`, so `tokens.ts` counts as rendered.

| Package | Files | What renders |
|---|---|---|
| apps/web | 19 | (site) routes, `components/site/*`, Document, fonts, globals.css |
| packages/app | 34 | features/explore (6), schedule (17), notifications (3), profile (3), settings (2), error (2), `home/home.data.ts` (pulled in by notifications/profile) |
| packages/spatial | 32 | SpatialScreen, GridRaceScene, Tabletop* web, lightcycle/three, mcp/three, sightline, rive |
| packages/ui | 33 | Avatar, BusinessIdentity, Button, Card, EmptyState, Heading, Text, TextField, SearchBar, Switch.web, SegmentedControl.web, LoadingSkeleton, motion, tw, html/*, icons.web, future/CircuitButton, future/GridCard, backgrounds/GridScene(+skia), GlyphCity(+skia), SkiaWebGate |
| packages/theme | 2 | tokens.ts (via theme.css), switch.web.ts |

Not rendered on the public site: every `*.stories.tsx` (41 files), `packages/app/features/editor` and `home/screen`, `packages/ui` Badge, Dialog, Lightbox, BottomSheet, DropZone, Checkbox, Textarea, Toast, TabBar, Menu, FieldGroup, GridFloor, and the `*.native.*` forks.

External libraries reached by the closure: gsap, kinetrell, @legendapp/motion, react-native-reanimated, @shopify/react-native-skia, three, typegpu, @typegpu/three, @reactvision/react-viro, @rive-app/react-webgl2, lucide-react, nextjs-toploader, solito, zustand, date-fns, tailwind-variants.

## Summary

| # | Category | Hits (total) | Rendered |
|---|---|---|---|
| 1 | v1 palette still live | 0 exact; 2 near-miss | 0 exact; 2 near-miss emitted as CSS vars |
| 2 | Color literals outside `packages/theme` | 84 | 66 |
| 3 | Off-v2 token values and fonts in `tokens.ts` | 99 primitive steps + 23 semantic values + 2 font stacks; 90 primitive/off-palette class uses | 75 class uses |
| 4 | Uppercase, wide tracking, eyebrows, hard-coded caps | 24 class hits + 33 caps literals + 11 eyebrows | 15 + 33 + 11 |
| 5 | Middle dots, `WORD — fragment`, arrows in labels | 41 | 19 |
| 6 | Monospace for data labels | 0 | 0 |
| 7 | Radius monoculture, shared shadow, gradient washes | shadow-card 57; rounded-md 43 / rounded-card 19; gradients 2 | shadow-card 28; rounded-xl 17; gradient 1 |
| 8 | Slide-up entrances, hover lift, direct gsap | 27 entrance sites; 0 hover lift; 4 gsap import sites | all |
| 9 | Numbered markers on non-sequences | 8 | 8 |
| 10 | Stock/placeholder media, template copy, unsourced Harlem claims | 6 media/demo sources; 4 template data sets; 25 unsourced claims | all |
| 11 | Product render floating on a wash | 1 | 1 |
| 12 | Dark page backgrounds, glow at rest | 66 | 57 |
| 13 | Retro pastiche | 4 token comments + 1 whole page (Tron "Grid Program") | yes |
| 14 | Mixed icon systems | 1 library (lucide; web + native forks) + 8 glyph/emoji icons | lucide + 4 glyphs |
| 15 | Hard-coded route strings | 13 literals in 6 files | 13 |

## Ten most damaging hits

1. **`packages/theme/tokens.ts:14-115`**: the primitive palette is still the retro starter. `burgundy` holds electric yellow, `ember` hot pink, `ink` cream-to-black, and `gold` blue. The font stack is Archivo Black + Space Grotesk. Every scale ships to every page as CSS variables. The v2 colours brownstone `#6E4636`, verdigris `#2B7564`, sodium-amber `#F2A900` and paper `#FBFBF9` don't exist anywhere in the token file.
2. **`apps/web/app/fonts.ts:5-15`**: loads `ArchivoBlack-Regular.ttf` and `SpaceGrotesk-Variable.ttf`. `MonaSans-Variable.woff2` and `Newsreader-Variable.woff2` already sit in `packages/assets/fonts/` but nothing loads them.
3. **`apps/web/app/globals.css:13,20`**: `scrollbar-color` and the thumb background use `var(--color-burgundy-600)`, which is `#D1A800` yellow. That puts a retro-yellow scrollbar on every route.
4. **`packages/ui/backgrounds/GridScene.web.tsx:14`**: the SSR/loading fallback is `flex-1 bg-black`. DOM confirms the home hero (`opacity-80` layer), the Explore map pane and `/spatial` all ship a black panel until CanvasKit loads.
5. **`packages/spatial/SpatialScreen.tsx:32-130`**: `/spatial` is a whole Tron page. It has a `#050505` background, `#00f3ff` neon grid with `BlurMask` glow, a "megacity" GlyphCity, "37-Cycle Race", `uppercase tracking-[0.32em]` eyebrows, and `01 / 02 / 03` cards. It also passes `text-white/60` copy into `GridCard`, which now renders `bg-surface-raised` (white), so the body text is close to invisible in the DOM.
6. **`apps/web/components/site/SiteHeader.tsx:139` + `packages/app/features/profile/profile.store.ts:6-8`**: the header avatar on every page is a DiceBear "avataaars" cartoon pulled from `api.dicebear.com`.
7. **`apps/web/components/site/ProductHome.tsx:227,253,275` + `SiteFooter.tsx:15,64`**: uppercase eyebrows with `tracking-[0.16–0.18em]` sit above each h2/h3, and the footer column titles and tagline are uppercase on every route (4 per page in DOM).
8. **`apps/web/components/site/ProductHome.tsx:12-31,177`**: the hero shows `01/02/03` on three feature labels that aren't a sequence (DOM renders them as split `0` / `1` text nodes). The chapter cards carry `01-03` too.
9. **`apps/web/app/Document.tsx:21`**: `NextTopLoader color="#00f3ff"` draws a neon-cyan progress bar on every navigation.
10. **`packages/app/features/notifications/notifications.store.ts:16-24`, `profile/profile-content.tsx`, `schedule/fixtures.ts`**: `/notifications`, `/profile`, `/settings` and `/schedule` render generic SaaS template data: "Sarah Chen started following you", "Order shipped #1042", "$149.00 · Invoice #1029", "Nina Alvarez @nina", "1.2k Followers", "Orbital mechanics", and roster names "Maya Rodriguez… Kenji Watanabe". None of it is Harlem.

---

## 1. v1 palette still live (0 exact)

No exact hits for `#F6F2E8 #FFFDF8 #B85F45 #F4A340 #40B7C9 #315EF5 #2F7A57 #956B3F #111418 #5E646B`, or their rgb() forms. I checked source in apps/, packages/, tooling/ and docs/, the emitted theme CSS, and the SSR HTML of all 7 routes.

Near-misses, where the v1 cream survives one digit off:

| path:line | snippet | rendered |
|---|---|---|
| packages/theme/tokens.ts:45 | `50: '#FFFDF7',` (ink-50; v1 `#FFFDF8`) | yes (as `--color-ink-50`) |
| packages/theme/tokens.ts:46 | `100: '#F6F3E8',` (ink-100; v1 `#F6F2E8`) | yes (as `--color-ink-100`) |

## 2. Color literals outside `packages/theme` (84 total, 66 rendered)

The header in `packages/theme/tokens.ts:9` says "No hex values exist outside this file". That claim is false. I dropped two false positives (`#1042` and `#1029` are order/invoice numbers).

**Rendered, product site (light pages)**

| path:line | snippet | rendered |
|---|---|---|
| apps/web/app/Document.tsx:21 | `<NextTopLoader color="#00f3ff" …/>` | yes (every route) |
| apps/web/components/site/ProductHome.tsx:124 | `lineColor="#A9B4AE"` | yes |
| apps/web/components/site/ProductHome.tsx:125 | `glowColor="#0E8FA3"` (spatial-cyan value, hard-coded) | yes |
| apps/web/components/site/ProductHome.tsx:126 | `backgroundColor="#EEF0EC"` (limestone value, hard-coded) | yes |
| packages/app/features/explore/ExploreMapPane.tsx:30 | `lineColor="#B6C0BA"` | yes |
| packages/app/features/explore/ExploreMapPane.tsx:31 | `glowColor="#0E8FA3"` | yes |
| packages/app/features/explore/ExploreMapPane.tsx:32 | `backgroundColor="#E5E9E5"` | yes |

**Rendered, hero 3D (`SightlineHeroRenderer`, home)**

| path:line | snippet | rendered |
|---|---|---|
| packages/spatial/sightline/sightlineMaterial.ts:11 | `color = '#1F4FE0',` | yes |
| packages/spatial/sightline/SightlineHeroRenderer.ts:41 | `createSightlineLensMaterial('#1F4FE0')` | yes |
| …:70 | `setClearColor(0x000000, 0)` | yes |
| …:72 | `HemisphereLight('#FFFFFF', '#B9C1BC', 2.4)` | yes |
| …:74 | `DirectionalLight('#FFF5E7', 5.5)` | yes |
| …:78 | `DirectionalLight('#8DDDE7', 3.2)` | yes |
| …:106 | `color: '#D6D2C8',` | yes |
| …:111 | `color: '#222925',` | yes |
| …:116 | `color: '#9A7251',` | yes |
| …:170 | `color: x === 0 ? '#0E8FA3' : '#121815',` | yes |
| …:173 | `emissive: … '#5FD1E1' : '#000000'` | yes |
| …:190 | `color: '#D8D4CA',` | yes |
| …:201 | `color: '#222925',` | yes |
| …:212 | `color: '#0E8FA3',` | yes |
| …:237 | `color: '#1F4FE0',` | yes |
| …:257 | `color: index === 1 ? '#C8102E' : '#0E8FA3',` | yes |
| …:263 | `color: index === 1 ? '#C8102E' : '#0E8FA3',` | yes |

**Rendered, `/spatial` neon set**

| path:line | snippet | rendered |
|---|---|---|
| packages/spatial/SpatialScreen.tsx:37 | `lineColor="#00f3ff"` | yes (DOM) |
| packages/spatial/SpatialScreen.tsx:38 | `glowColor="#00f3ff"` | yes |
| packages/spatial/SpatialScreen.tsx:39 | `backgroundColor="#050505"` | yes |
| packages/spatial/SpatialScreen.tsx:47 | `colorPrimary="#00f3ff"` | yes |
| packages/spatial/SpatialScreen.tsx:48 | `colorSecondary="#ff8a00"` | yes |
| packages/spatial/SpatialScreen.tsx:49 | `colorTertiary="#fff4b0"` | yes |
| packages/spatial/SpatialViroExperience.web.tsx:107 | `tintColor="rgba(0,243,255,0.72)"` | yes (interaction) |
| packages/spatial/SpatialViroExperience.web.tsx:119 | `tintColor="rgba(255,122,0,0.78)"` | yes (interaction) |
| packages/spatial/GridRaceScene.tsx:33-38 | `raceCyan '#00f3ff'`, `raceOrange '#ff7a00'`, `raceGold '#ffd24a'`, `raceWhite '#fff6cf'`, `raceRed '#ff355e'`, `raceDark '#020407'` (6) | yes (interaction) |
| packages/spatial/GridRaceScene.tsx:88,95,285,292,305,396,409,425 | `style={{ … color: '#fff6cf' / '#00f3ff' / '#ff7a00' }}` (8) | yes (interaction) |
| packages/spatial/GridRaceScene.tsx:487 | `<ViroAmbientLight color="#7cf8ff" …/>` | yes (interaction) |
| packages/spatial/GridRaceScene.tsx:488 | `<ViroDirectionalLight color="#ff9b33" …/>` | yes (interaction) |
| packages/spatial/lightcycle/three/energyMaterial.ts:19 | `color = '#00f3ff',` | yes (interaction) |
| packages/spatial/lightcycle/three/ThreeLightCycleRenderer.ts:55,56 | `p1: '#00f3ff', p2: '#ff7a00'` | yes (interaction) |
| …:108,260 | `color: '#020407',` | yes (interaction) |
| …:231 | `scene.background = new THREE.Color('#010205')` | yes (interaction) |
| …:232 | `HemisphereLight('#7cf8ff', '#020407', 1.25)` | yes (interaction) |
| …:234 | `DirectionalLight('#ff9b33', 2.4)` | yes (interaction) |
| …:268 | `GridHelper(1.2, 24, '#00f3ff', '#07313a')` | yes (interaction) |
| packages/spatial/mcp/three/McpThreePresence.ts:10-12 | `MCP_RED '#ff2b1c'`, `MCP_WHITE '#f5f2eb'`, `MCP_BLACK '#050609'` | yes (interaction) |
| packages/spatial/mcp/three/McpThreePresence.ts:54,61 | `emissive: new THREE.Color('#130201' / '#5a1b14')` | yes (interaction) |

**Rendered, Skia component defaults (loaded via dynamic import)**

| path:line | snippet | rendered |
|---|---|---|
| packages/ui/backgrounds/GridScene.skia.tsx:34 | `lineColor = '#00f3ff', glowColor = '#00f3ff', backgroundColor = '#050505'` | yes |
| packages/ui/backgrounds/GlyphCity.skia.tsx:74 | `palette[0] ?? '#00f3ff'` | yes |
| packages/ui/backgrounds/GlyphCity.skia.tsx:80 | `<Rect … color="#020408" opacity={0.78} />` | yes |
| packages/ui/backgrounds/GlyphCity.skia.tsx:162-164 | `colorPrimary = '#00f3ff'`, `colorSecondary = '#ff8a00'`, `colorTertiary = '#fff3a3'` | yes |

**Not rendered**

| path:line | snippet | rendered |
|---|---|---|
| packages/ui/backgrounds/GridFloor.skia.tsx:34 | `lineColor = '#00f3ff', backgroundColor = '#050505', …` | no |
| packages/ui/future.stories.tsx:14-48 | `lineColor="#A9B4AE" glowColor="#1F4FE0" backgroundColor="#EEF0EC"` ×3 (9) | no |
| packages/ui/GridWorld.stories.tsx:27,28,34,35,36,88 | `#00f3ff`, `#ff8a00`, `#fff6cf` | no |
| packages/ui/GridWorld.stories.tsx:102 | `bg-[#020407]` (the only Tailwind arbitrary hex in scope) | no |
| packages/ui/Avatar.stories.tsx:8 | inline SVG `fill="#1F4FE0"` | no |

No `hsl()` literals and no CSS-file colour literals outside theme.

## 3. `tokens.ts` values outside the v2 palette

Allowed: limestone `#EEF0EC`, paper `#FBFBF9`, raised `#FFFFFF`, stoop-iron `#171C1A`, iron-muted `#4D5652`, brownstone `#6E4636`, marquee-red `#C8102E`, transit-cobalt `#1F4FE0`, verdigris `#2B7564`, sodium-amber `#F2A900`, spatial-cyan `#0E8FA3`, night `#0E1412`.

**Missing from tokens entirely:** paper `#FBFBF9`, brownstone `#6E4636`, verdigris `#2B7564`, sodium-amber `#F2A900`. None of the v2 names exist as tokens. The values present under v2 meanings live under `surface`, `text`, `primary` and so on.

**Primitive scales, all off-palette (99 steps, all emitted to theme.css):**

| path:line | snippet | note |
|---|---|---|
| packages/theme/tokens.ts:15-28 | `// RETRO primary — electric yellow` `burgundy: { 50:'#FFFCEB' … 950:'#332800' }` | retro yellow under a misleading name; used by `globals.css` scrollbar and `error/screen.shared.tsx:19` |
| packages/theme/tokens.ts:29-42 | `// RETRO accent — hot pink` `ember: { … '#F7418F' … }` | retro pink; used by `schedule/accent-classes.ts:38-43` |
| packages/theme/tokens.ts:43-56 | `// RETRO neutrals — paper cream to true black` `ink: {…}` | cream scale; see Cat 1 near-misses |
| packages/theme/tokens.ts:59-63 | `gold: { … 500:'#3B6DF6' … }` | named gold, holds blue |
| packages/theme/tokens.ts:64-68 | `forest: {…}` | not verdigris; used by GridCard `verdigris` tone |
| packages/theme/tokens.ts:69-83 | `sky`, `rose`, `slate` | starter scales |

**Semantic values outside the allowed set (23):**

| path:line | token | off-palette value(s) |
|---|---|---|
| tokens.ts:91 | surface-raised (dark) | `#171E1B` |
| tokens.ts:92 | surface-sunken | `#E5E9E5` / `#101714` |
| tokens.ts:93 | text (dark) | `#F7F9F7` |
| tokens.ts:94 | text-muted (dark) | `#AEB8B3` |
| tokens.ts:95 | text-inverse (light) | `#F7F9F7` |
| tokens.ts:96 | primary (dark) | `#7295FF` |
| tokens.ts:97 | primary-pressed | `#173DB3` / `#91AAFF` |
| tokens.ts:99 | accent (dark) | `#FF6B7F` |
| tokens.ts:100 | accent-pressed | `#A70D27` / `#FF8A99` |
| tokens.ts:102 | border | `#CBD2CE` / `#33403A` |
| tokens.ts:103 | border-strong | `#7D8983` / `#6D7B75` |
| tokens.ts:104 | focus (dark) | `#5FD1E1` |
| tokens.ts:105 | danger | `#B4232F` / `#FF7A85` |
| tokens.ts:106 | on-danger (dark) | `#3D0508` |

The pressed, border and dark-mode values may be legitimate derived steps. The spec needs to say whether derived tints are allowed.

**Fonts:**

| path:line | snippet | rendered |
|---|---|---|
| packages/theme/tokens.ts:112-114 | `// RETRO: Archivo Black shouts the headlines; Space Grotesk does the work.` `display: "'Archivo Black', 'Arial Black', sans-serif"`, `sans: "'Space Grotesk', …"` | yes (theme.css:92-93) |
| apps/web/app/fonts.ts:6 | `path: '../../../packages/assets/fonts/ArchivoBlack-Regular.ttf'` | yes |
| apps/web/app/fonts.ts:12 | `path: '../../../packages/assets/fonts/SpaceGrotesk-Variable.ttf'` | yes |
| packages/assets/fonts/MonaSans-Variable.woff2, Newsreader-Variable.woff2 | present, never loaded | n/a |

`font-display` (Archivo Black) is used at 8 rendered sites: `SiteHeader.tsx:101`, `SiteFooter.tsx:57`, `ExploreMasterPane.tsx:33`, `error/screen.shared.tsx:19`, `ui/Heading.tsx:8` (every Heading), and `ui/Text.tsx:20,21`.

**Primitive and Tailwind-default colour classes in components (90 total, 75 rendered).** The heaviest offenders:

| path:line | snippet | rendered |
|---|---|---|
| packages/app/features/schedule/accent-classes.ts:38-75 | `bg-ember-500`, `bg-gold-500`, `bg-forest-500`, `bg-sky-500`, `bg-rose-500` + `text-*-700/200`, `text-white` (30) | yes (DOM, /schedule) |
| packages/app/features/error/screen.shared.tsx:19 | `font-display text-display-xl text-burgundy-200` (pale yellow on light) | yes (error route) |
| packages/app/features/explore/ExploreMasterPane.tsx:115 | `'border-primary bg-sky-50/60'` | yes (interaction) |
| packages/app/features/home/home.data.ts:30,35,40 | `bg-gold-400/15`, `text-gold-600`, `bg-gold-500` | yes |
| packages/ui/Avatar.tsx:29-32 | `bg-gold-50 text-gold-800`, `bg-forest-50 …`, `bg-sky-50 …`, `bg-rose-50 …` | yes |
| packages/ui/future/GridCard.tsx:26-28 | `bg-forest-600`, `text-forest-700 dark:text-forest-300` | yes |
| packages/ui/Switch.web.tsx:32 | `bg-ink-950` | yes |
| packages/spatial/SpatialScreen.tsx:21,24,55,65,68,71,101,104,107,114,119,126 | `text-white/60`, `text-cyan-200`, `bg-cyan-200/40`, `text-orange-200`, `bg-black/70` (Tailwind defaults, not tokens) | yes (DOM) |
| packages/spatial/TabletopSessionPanel.tsx:33,39,62,76,77,81,85,92 | `text-white/65`, `text-cyan-100/65`, `border-cyan-300/15`, `text-orange-200`, `text-red-300` | yes (DOM) |
| packages/spatial/SpatialViroExperience.web.tsx:77,78,81,100 | `bg-black`, `text-cyan-100`, `text-white/55` | yes (interaction) |
| packages/spatial/TabletopThreeExperience.web.tsx:75,98,100,103 | `bg-black`, `bg-black/55`, `text-cyan-100` | yes (interaction) |
| packages/spatial/rive/RiveStage.web.tsx:25 | `border-cyan-300/25 bg-black/40` | yes (DOM) |
| packages/spatial/TabletopRiveScoreboard.web.tsx:107 | `border-cyan-300/25 bg-black/55` | yes (interaction) |
| packages/ui/Badge.tsx:12-15, Lightbox.tsx:48-86, Dialog.tsx:11, DropZone.*:29-31 | `bg-burgundy-100`, `bg-ember-*`, `bg-ink-950/95`, `text-ink-50` | no |

## 4. Uppercase, wide tracking, eyebrows

**Class-level (24 total, 15 rendered)**

| path:line | snippet | rendered |
|---|---|---|
| apps/web/components/site/ProductHome.tsx:227 | `text-xs font-semibold uppercase tracking-[0.18em] text-primary` ("One continuous experience") | yes (DOM) |
| apps/web/components/site/ProductHome.tsx:253 | `… uppercase tracking-[0.16em] …` (chapter eyebrow) | yes (DOM) |
| apps/web/components/site/ProductHome.tsx:275 | `… uppercase tracking-[0.18em] …` ("Harlem Might") | yes (DOM) |
| apps/web/components/site/SiteFooter.tsx:15 | `const columnTitle = '… uppercase tracking-[0.16em] text-primary'` | yes (DOM, every route ×3) |
| apps/web/components/site/SiteFooter.tsx:64 | `… uppercase tracking-[0.16em] …` ("See the block. Know the story.") | yes (DOM, every route) |
| apps/web/components/site/SiteHeader.tsx:104 | `text-[11px] font-medium tracking-wide` ("Harlem, mapped with context") | yes (DOM, every route) |
| packages/ui/Text.tsx:25 | `label: 'text-xs font-medium uppercase tracking-wide md:text-sm'` | yes, used at notifications-content.tsx:42 and profile-content.tsx:42 |
| packages/ui/TextField.tsx:64 | `text-[10px] font-semibold tracking-wide` (`⌘V`) | yes (interaction) |
| packages/spatial/SpatialScreen.tsx:65 | `uppercase tracking-[0.32em] text-cyan-200` ("Harlem Might / Grid Program") | yes (DOM) |
| packages/spatial/SpatialScreen.tsx:126 | `uppercase tracking-[0.18em] text-orange-200` ("Universal Rive surface") | yes (DOM) |
| packages/spatial/SpatialViroExperience.web.tsx:78,100 | `uppercase tracking-[0.18em]` | yes (interaction) |
| packages/spatial/TabletopSessionPanel.tsx:77 | `uppercase tracking-[0.18em] text-cyan-200` | yes (interaction) |
| packages/spatial/TabletopSessionPanel.tsx:81 | `tracking-[0.24em] text-orange-200` (room code) | yes (interaction) |
| packages/spatial/TabletopThreeExperience.web.tsx:100 | `uppercase tracking-[0.18em]` | yes (interaction) |
| packages/ui/FieldGroup.web.tsx:20,34; Menu.web.tsx:19; Textarea.tsx:58 | `uppercase tracking-wide` | no |
| packages/ui/GridWorld.stories.tsx:43,46,90; primitives.stories.tsx:76 | `uppercase tracking-[0.32em]` etc. | no |
| packages/theme/build-css.mjs:47 | emits `--text-*--letter-spacing` (all ≤ 0) | n/a, compliant |

**Hard-coded all-caps strings (33, all rendered).** These bypass any `uppercase` lint.

| path:line | snippet | rendered |
|---|---|---|
| packages/app/features/explore/ExploreEmptyDetail.tsx:8 | `PLACE DETAIL` (eyebrow above h1) | yes (DOM) |
| packages/app/features/explore/ExplorePlaceDetail.tsx:56,62,73,86,98 | `WHY IT MATTERS`, `TODAY`, `MENU + TICKETS`, `STORY`, `SOURCES + CORRECTIONS` | yes (interaction, xl+) |
| packages/app/features/explore/MightsPanel.tsx:48,54,60 | `MENU`, `AR ANCHOR`, `SOURCE STATUS` | yes (interaction, 2xl+) |
| packages/spatial/GridRaceScene.tsx:84,91,273,275,392,405,421 | `GRID ACCESS`, `SELECT THE GATE TO ENTER`, `DEREZZED`, `TURN L`, `RESTART MATCH` … | yes (interaction) |
| packages/spatial/mcp/mcpBrain.ts:31-36,73,89,107,122,141,158,173,187 | `ARENA BOUNDARY`, `SYSTEM SUPREMACY`, `MCP // GRID CONTROL` … | yes (interaction) |
| packages/spatial/TabletopSessionPanel.tsx:78 | `'HOST' / 'GUEST' / 'SOLO'` | yes (interaction) |
| packages/spatial/useTabletopSoloDriver.ts:24 | `'PLAYER'`, `'GRID AI'` | yes (interaction) |
| packages/spatial/gridRaceEngine.ts:134,136 | `'ORANGE'`, `'WHITE'` rider names | yes (interaction) |

**Eyebrows directly above h1-h3 (11)**

| path:line | eyebrow, then heading | rendered |
|---|---|---|
| ProductHome.tsx:135→139 | pill "Harlem in your sightline" → h1 | yes (DOM) |
| ProductHome.tsx:227→230 | "ONE CONTINUOUS EXPERIENCE" → h2 | yes (DOM) |
| ProductHome.tsx:253→260 | "DISCOVER/WALK/LOOK UP" ×3 → h3 | yes (DOM) |
| ProductHome.tsx:275→278 | "HARLEM MIGHT" → h2 | yes (DOM) |
| SpatialScreen.tsx:65→68 | "HARLEM MIGHT / GRID PROGRAM" → h1 | yes (DOM) |
| packages/ui/future/GridCard.tsx:52-65 | `eyebrow` prop rendered above every card title (5 uses in SpatialScreen) | yes (DOM) |
| ExploreEmptyDetail.tsx:8→9 | "PLACE DETAIL" → h1 | yes (DOM) |
| ExplorePlaceDetail.tsx:34→37 | pill "Culture · 125th Street" → h1 | yes (interaction) |
| ExplorePlaceDetail.tsx:62→63, 73→74, 86→87 | "TODAY" / "MENU + TICKETS" / "STORY" → h2 | yes (interaction) |
| MightsPanel.tsx:37→38 | "Mights Panel" → h2 | yes (interaction) |

## 5. Middle dots, `WORD — fragment`, arrows (41 total, 19 rendered)

Comment-only matches are excluded.

| path:line | snippet | rendered |
|---|---|---|
| apps/web/app/(site)/layout.tsx:9 | `default: 'Harlem Might — see the block, know the story'` | yes (DOM `<title>`, every route) |
| apps/web/app/(site)/layout.tsx:10 | `template: '%s — Harlem Might'` | yes |
| apps/web/components/site/ProductHome.tsx:201 | `Mights Sightline · spatial preview` | yes (DOM) |
| apps/web/components/site/ProductHome.tsx:211 | `125th St → Apollo Theater` | yes (DOM) |
| apps/web/components/site/ProductHome.tsx:214 | `Place record → entrance anchor → walking route → spatial story` | yes (DOM) |
| packages/app/features/explore/ExploreMapPane.tsx:42 | `Preview geometry only · canonical coordinates come from Payload/PostGIS` | yes (DOM) |
| packages/app/features/explore/ExploreMasterPane.tsx:122 | `detail={place.category + ' · ' + place.area}` | yes (DOM ×8) |
| packages/app/features/explore/ExplorePlaceDetail.tsx:35 | `{place.category} · {place.area}` | yes (interaction) |
| packages/app/features/explore/MightsPanel.tsx:42 | `{place.category} · {place.area}` | yes (interaction) |
| packages/app/features/explore/MightsPanel.tsx:50,56 | `'—'` as empty value | yes (interaction) |
| packages/app/features/notifications/notifications.store.ts:20 | `'$149.00 · Invoice #1029'` | yes (DOM) |
| packages/spatial/GridRaceScene.tsx:288 | `` `YOU … / GRID …   •   RIVALS …   •   BOOST …%` `` | yes (interaction) |
| packages/spatial/GridRaceScene.tsx:301 | `"SWIPE / STICK L-R = 90° TURN   •   TRIGGER / A …"` | yes (interaction) |
| packages/spatial/SpatialViroExperience.web.tsx:101 | `'Stick / A-D / arrows turn • push up / W …'` | yes (interaction) |
| packages/spatial/TabletopSessionPanel.tsx:78 | `{…'SOLO'} · {playerName}` | yes (interaction) |
| packages/spatial/TabletopSessionPanel.tsx:86 | `{…'Waiting for shared-frame localization'} · {…'Not ready'}` | yes (interaction) |
| packages/spatial/TabletopThreeExperience.web.tsx:101 | `A / ← TURN LEFT · D / → TURN RIGHT · SPACE / SHIFT BOOST` | yes (interaction) |
| packages/spatial/TabletopThreeExperience.web.tsx:104 | `Three.js WebGPU + TypeGPU · deterministic 60 Hz Light Cycle core` | yes (interaction) |
| packages/spatial/SpatialScreen.tsx:66,100,103,106 | `Harlem Might / Grid Program`, `01 / Universal graphics` (slash-joined labels, same pattern) | yes (DOM) |
| packages/ui/Lightbox.tsx:77 | `›` glyph as next control | no |
| packages/ui/*.stories.tsx (22 strings) | e.g. `Text.stories.tsx:16 'Caption · muted'`, `List.stories.tsx:22 'Soprano · joined 2019'`, `Toast.stories.tsx:8 'Total Praise · Alto part…'`, `ErrorMessage.stories.tsx:12 'Something went wrong — try again.'` | no |

No `→`/`↗`/`›` appended to rendered link or button labels. The CTAs read "Explore Harlem", "Enter the spatial experience" and "Open Explore".

## 6. Monospace for data labels (0)

No `font-mono`, `monospace`, `ui-monospace` or `fontFamily` overrides in scope. Data labels use `tabular-nums` on the sans font (`ProductHome.tsx:176,256`).

## 7. Radius monoculture, shared shadow, gradient washes

**Radius frequency.** Rendered closure: `rounded-xl` 17, `rounded-full` 13, `rounded-md` 12, `rounded-lg` 6, `rounded-card` 6, `rounded` 4, `rounded-sm` 3, `rounded-2xl` 3, `rounded-sheet` 2, plus arbitrary values:

| path:line | snippet | rendered |
|---|---|---|
| apps/web/components/site/ProductHome.tsx:188 | `rounded-[30px] … bg-surface-raised/58 shadow-raised backdrop-blur-sm` | yes (DOM) |
| packages/app/features/explore/ExploreEmptyDetail.tsx:7 | `rounded-[24px] … shadow-card` | yes (DOM) |
| packages/app/features/explore/ExplorePlaceDetail.tsx:45 | `rounded-[24px] …` | yes (interaction) |
| packages/ui/Checkbox.web.tsx:12, audio/Waveform.tsx:46 | `rounded-[6px]`, `rounded-[1px]` | no |

Across the whole scope it's `rounded-md` 43, `rounded-card` 19, `rounded-xl` 18 and `rounded-full` 18. The site uses about nine radii and none of them is a governing rule. Buttons sit at `rounded-md` (`ui/Button.tsx:13`) while site CTAs sit at `rounded-xl` (`ProductHome.tsx:155,161,288`), so two radii serve the same role. DOM counts of `rounded-xl`: explore 20, notifications 9, home 8.

**Shared shadow.** `shadow-card` appears 57× in scope and 28× in rendered files. DOM counts: spatial 14, explore 13, home 10, profile 7, settings 5, notifications 4, schedule 2. Per file:

| file | shadow-card uses | rendered |
|---|---|---|
| apps/web/components/site/ProductHome.tsx | 7 (lines 135,155,161,172,198,207,288) | yes (DOM) |
| packages/ui/Button.tsx | 4 (every variant, lines 21-25) | yes |
| packages/app/features/explore/ExploreMapPane.tsx | 4 (39,49,72,88) | yes (DOM) |
| apps/web/components/site/SiteHeader.tsx | 2 (76,90) | yes (DOM) |
| packages/app/features/profile/profile-content.tsx, notifications-content.tsx | 2 each | yes |
| packages/ui/Card.tsx:9 | default `elevation: 'card'` → `border-2 border-border shadow-card` | yes |
| packages/ui/future/GridCard.tsx, CircuitButton.tsx, SearchBar.tsx, TextField.tsx, ExploreMasterPane.tsx, ExploreEmptyDetail.tsx | 1 each | yes |

Token: `packages/theme/tokens.ts:159` `card: '0 1px 2px rgba(23, 28, 26, 0.08), 0 8px 24px rgba(23, 28, 26, 0.05)'`.

**Gradient washes (2, 1 rendered).** No `bg-gradient`, `bg-linear`, `linear-gradient`, `radial-gradient` or `from-`/`to-` utilities anywhere in scope.

| path:line | snippet | rendered |
|---|---|---|
| packages/ui/backgrounds/GridScene.skia.tsx:55 | `<LinearGradient … colors={[`${lineColor}00`, lineColor, lineColor]} />` (fading grid lines under the home hero, Explore map and /spatial) | yes |
| packages/ui/backgrounds/GridFloor.skia.tsx:61 | same | no |

## 8. Entrances, hover lift, direct gsap

**Fade/slide-up entrances (27 rendered sites)**

| path:line | snippet | rendered |
|---|---|---|
| apps/web/components/site/SiteMotionShell.tsx:50-60 | `gsap.fromTo(route, { autoAlpha: 0.72, y: 14 }, { autoAlpha: 1, y: 0 … })` on every route change | yes (every route) |
| apps/web/components/site/SiteHeader.tsx:45-55 | `gsap.fromTo(inner, { y: -18, autoAlpha: 0 }, …)` header drops in on mount | yes |
| apps/web/components/site/SiteHeader.tsx:65-69 | mobile menu `{ y: -12, autoAlpha: 0 }` | yes (interaction) |
| apps/web/components/site/ProductHome.tsx:51-63 | hero scrub `copy {y:0→-74, autoAlpha 1→0.76}`, `object {y:70→-26, scale}` | yes |
| apps/web/components/site/ProductHome.tsx:86-97 | chapters `fromTo({ y: 54, autoAlpha: 0.35 }, { y: 0, autoAlpha: 1, stagger: 0.16 })` scroll-scrubbed (the classic fade-and-rise section reveal) | yes |
| apps/web/components/site/SiteFooter.tsx:27-32 | footer `fromTo({ y: 34, autoAlpha: 0.55 }, { y: 0, autoAlpha: 1 })` | yes (every route) |
| packages/ui/motion.tsx:72-83 | `FadeIn`: `initial={{ y: 12 }} animate={{ y: 0 }}` (slide-up only, despite the name) | yes |
| packages/ui/motion.tsx:86-97 | `ScaleIn`: `scale: 0.94 → 1` spring | yes |
| packages/app/features/notifications/notifications-content.tsx:12,63 | `<FadeIn delay={80 + index * 45}>` staggered list | yes |
| packages/app/features/profile/profile-content.tsx:35,38,67,79 | `<FadeIn>`, `<ScaleIn delay={60}>`, `<FadeIn delay={80}>`, `<FadeIn delay={140}>` | yes |
| packages/app/features/settings/settings-content.tsx:47,54,66,76 | `<FadeIn>` … `delay={200}` staggered sections | yes |
| packages/ui/EmptyState.tsx:27-28 | `<FadeIn>` + `<ScaleIn delay={80}>` | yes |
| apps/web/app/globals.css:47-55 | `.gallery-slide { animation: gallery-slide-enter … }` opacity keyframe | yes (css, no rendered user found) |
| apps/web/app/globals.css:57-92 | view-transition `site-page-exit/enter` translateX ±2rem + opacity | yes |
| packages/ui/Toast.tsx:38, TabBarAccessory.tsx:33,41, Dialog.tsx:35 | `<SlideUp>`, `<ScaleIn>` | no |

**Hover lift (0 rendered).** No `hover:-translate-y`, `hover:shadow` or `hover:scale` in rendered files. Related press and drag motion:

| path:line | snippet | rendered |
|---|---|---|
| packages/ui/Button.tsx:14 | `active:translate-x-[3px] active:translate-y-[3px] active:shadow-none` (neubrutalist press offset left over from the starter) | yes |
| packages/app/features/notifications/notifications-content.tsx:74 | same press offset, inline | yes |
| packages/ui/DropZone.web.tsx:29 / .native.tsx:31 | `-translate-y-0.5 scale-105 … shadow-raised` drag-over lift | no |

**Direct `gsap` imports (4 sites, all rendered).** Kinetrell already provides `attachScrollTrigger`, `connectGsapLenis` and `useBrowserReducedMotion`, but tweens are still written against raw gsap:

| path:line | snippet |
|---|---|
| apps/web/components/site/ProductHome.tsx:4 | `import gsap from 'gsap';` (2 timelines) |
| apps/web/components/site/SiteHeader.tsx:5 | `import gsap from 'gsap';` (2 `gsap.fromTo`) |
| apps/web/components/site/SiteFooter.tsx:4 | `import gsap from 'gsap';` (1 timeline) |
| apps/web/components/site/SiteMotionShell.tsx:4 | `import gsap from 'gsap';` (1 `gsap.fromTo`) |

`apps/web/eslint.config.mjs:10-15,21` lists exactly these four files in `productMotionFiles` and exempts them from the `gsap` import ban at line 42. The guard exists, but it's switched off for every file that uses gsap.

## 9. Numbered markers on non-sequences (8)

| path:line | snippet | rendered |
|---|---|---|
| apps/web/components/site/ProductHome.tsx:177 | `0{index + 1}` over "Places + context / Entrance-aware routes / Spatial stories" (feature list, not a sequence; DOM splits it into `0` + `1` nodes) | yes (DOM) |
| apps/web/components/site/ProductHome.tsx:14 | `number: '01',` Discover | yes (DOM) |
| apps/web/components/site/ProductHome.tsx:20 | `number: '02',` Walk | yes (DOM) |
| apps/web/components/site/ProductHome.tsx:26 | `number: '03',` Look up (Discover → Walk → Look up could count as a journey; the lead should decide) | yes (DOM) |
| packages/spatial/SpatialScreen.tsx:100 | `eyebrow="01 / Universal graphics"` | yes (DOM) |
| packages/spatial/SpatialScreen.tsx:103 | `eyebrow="02 / Interface"` | yes (DOM) |
| packages/spatial/SpatialScreen.tsx:106 | `eyebrow="03 / Immersion"` | yes (DOM) |
| packages/app/features/explore/ExploreMapPane.tsx:81 | `{index + 1}` map pins 1-8 (list index, not a route order; low severity) | yes (DOM) |

## 10. Stock/placeholder media, template copy, unsourced Harlem claims

**Media and demo sources**

| path:line | snippet | rendered |
|---|---|---|
| packages/app/features/profile/profile.store.ts:6-8 | `AVATAR_URI = 'https://api.dicebear.com/9.x/avataaars/png?…seed=nina…'` (header avatar on every route + profile) | yes (every route) |
| packages/app/features/schedule/fixtures.ts:47 | `const AVATAR = 'https://api.dicebear.com/9.x/avataaars/png?…'` (roster avatars) | yes (/schedule) |
| packages/spatial/SpatialScreen.tsx:12 | `RIVE_DEMO = 'https://cdn.rive.app/animations/vehicles.riv'` (Rive community demo file) | yes (/spatial) |
| packages/ui/Image.stories.tsx:8,17; Lightbox.stories.tsx:19-21 | `https://picsum.photos/seed/…` | no |
| packages/ui/primitives/primitives.stories.tsx:21-22 | `https://example.com` | no |

No unsplash, pexels or lorem ipsum anywhere in scope. `ExplorePlaceDetail.tsx:47-50` renders an explicit "No stock placeholders" empty media slot, which is compliant.

**Generic template data on public routes (not Harlem)**

| path:line | snippet | rendered |
|---|---|---|
| packages/app/features/notifications/notifications.store.ts:16-24 | "Sarah Chen started following you", "Your order #1042 is on its way", "$149.00 · Invoice #1029", "Mobile app v2 reached 80%", "New sign-in from Safari on MacBook", "Your stats are up 12% this week" | yes (DOM) |
| packages/app/features/profile/profile.store.ts + profile-content.tsx | "Nina Alvarez", "@nina", "Design / Mobile / Web", "24 Projects / 1.2k Followers / 184 Following" | yes (DOM) |
| packages/app/features/schedule/fixtures.ts:59-78 | roster "Maya Rodriguez, Daniel Okafor, Priya Raman, Kenji Watanabe, Elena Fischer"; events "Theory I", "Composition", "Orbital mechanics" | yes (DOM) |
| packages/app/features/home/home.data.ts:1-30 | `// Dashboard demo data — generic`: "Revenue $24.8k", "Mobile app v2", "Marketing site" | yes (bundled via notifications/profile) |

**Factual claims about Harlem places/history (unsourced; provenance for the lead to verify).** All of them sit in `packages/app/features/explore/explore.store.ts` unless noted. All are rendered on `/explore` (DOM confirms the short descriptions; `whyItMatters` shows after selection at xl+).

| path:line | claim | flag |
|---|---|---|
| explore.store.ts:32 | Apollo Theater: area "125th Street" | unsourced claim |
| explore.store.ts:33 | "A Harlem performing-arts landmark with a global cultural reach." | unsourced claim |
| explore.store.ts:35 | Apollo is a "gateway into Harlem music, performance, and neighborhood history" | unsourced claim |
| explore.store.ts:44-45 | Red Rooster Harlem: area "Central Harlem"; "Food, music, and neighborhood energy in the heart of Harlem." | unsourced claim |
| explore.store.ts:47 | Red Rooster is near "culture, nightlife, public art" | unsourced claim |
| explore.store.ts:50 | Red Rooster `menuAvailable: true` | unsourced claim |
| explore.store.ts:57-58 | Sylvia's: area "Central Harlem"; "A longstanding Harlem restaurant and neighborhood institution." | unsourced claim |
| explore.store.ts:61,63 | Sylvia's tags "soul food", "history"; `menuAvailable: true` | unsourced claim |
| explore.store.ts:68-71 | Schomburg Center: category "Books", area "Central Harlem"; "A research and cultural institution centered on Black history and culture." | unsourced claim |
| explore.store.ts:74 | Schomburg tags "library, archives, research" | unsourced claim |
| explore.store.ts:82-83 | Studio Museum in Harlem: area "125th Street"; "A museum focused on artists of African descent and the cultural life of Harlem." | unsourced claim |
| explore.store.ts:94-95 | National Black Theatre: area "Central Harlem"; "A Harlem arts institution centered on Black theater and cultural expression." | unsourced claim |
| explore.store.ts:106 | Marcus Garvey Park: area "Mount Morris Park" (the area label reuses a former name of the park itself) | unsourced claim |
| explore.store.ts:107 | "A major neighborhood park and gathering place in Central Harlem." | unsourced claim |
| explore.store.ts:109-110 | park has "monuments" | unsourced claim |
| explore.store.ts:118-119 | Strivers' Row: area "Central Harlem"; "A distinctive historic residential streetscape in Harlem." | unsourced claim |
| explore.store.ts:122 | Strivers' Row tags "architecture, history" | unsourced claim |
| explore.store.ts:37,49,62,75,87,99,111,123 | `previewPoint` x/y map positions (invented screen coordinates; the UI labels them "Preview geometry only") | unsourced claim (disclosed) |
| explore.store.ts:38-124 | `arCandidate: true` on all 8 places | unsourced claim |
| apps/web/components/site/ProductHome.tsx:211 | "125th St → Apollo Theater" (route pairing) | unsourced claim |
| apps/web/components/site/ProductHome.tsx:29 | "AR stories that belong to the exact corner where they happened" (no stories exist yet) | unsourced claim |
| apps/web/components/site/SiteFooter.tsx:92-93 | "First-party catalogue, entrance-aware routes, verified sources and spatial storytelling." (product claims; there are no verified sources and no routes yet, and MightsPanel shows "Seed preview") | unsourced claim |
| apps/web/components/site/ProductHome.tsx:234-235 | "The product site, map workspace and spatial view now share the same visual and motion language" (contradicted by the neon `/spatial` page) | unsourced claim |
| packages/app/features/explore/ExploreMasterPane.tsx:56 | placeholder "Food, jazz, books, history…" (the `jazz` category doesn't exist in `HARLEM_CATEGORIES`) | copy/data mismatch |
| apps/web/app/(site)/layout.tsx:13 | meta description "entrance-aware routes and spatial stories that stay attached to the block" | unsourced claim |

## 11. Product render floating on a wash (1)

| path:line | snippet | rendered |
|---|---|---|
| apps/web/components/site/ProductHome.tsx:186-194 | `SightlineHeroCanvas` (Three.js glasses + compute puck, `SightlineHeroRenderer.ts:37-38,82-83`) on `rounded-[30px] bg-surface-raised/58 shadow-raised backdrop-blur-sm`, with a transparent clear colour (`SightlineHeroRenderer.ts:70`), over the glowing animated `GridScene` (`ProductHome.tsx:118-129`) | yes (DOM `<canvas aria-label="Harlem Mights Sightline spatial glasses and compute puck">`) |

It isn't a CSS gradient. It is the same composition: a device floating on a frosted card over an animated glow grid with gradient-faded lines.

## 12. Dark backgrounds, glow at rest (66 total, 57 rendered)

**Dark surfaces outside night/AR**

| path:line | snippet | rendered |
|---|---|---|
| packages/ui/backgrounds/GridScene.web.tsx:14 | `fallback={<View className={`flex-1 bg-black …`}>}` | yes (DOM on `/`, `/explore`, `/spatial`) |
| packages/spatial/SpatialScreen.tsx:39 | `backgroundColor="#050505"` (whole `/spatial` page) | yes (DOM) |
| packages/spatial/SpatialScreen.tsx:114 | `bg-black/70` | yes (interaction) |
| packages/spatial/rive/RiveStage.web.tsx:25 | `bg-black/40` | yes (DOM) |
| packages/spatial/SpatialViroExperience.web.tsx:77 | `bg-black` | yes (interaction; XR preview, arguably allowed) |
| packages/spatial/TabletopThreeExperience.web.tsx:75,98 | `bg-black`, `bg-black/55` | yes (interaction; race view, arguably allowed) |
| packages/spatial/TabletopRiveScoreboard.web.tsx:107 | `bg-black/55` | yes (interaction) |
| packages/spatial/lightcycle/three/ThreeLightCycleRenderer.ts:231 | `scene.background = '#010205'` | yes (interaction) |
| packages/ui/Switch.web.tsx:32 | knob `bg-ink-950` | yes |
| packages/ui/Lightbox.tsx:48, Dialog.tsx:11 | `bg-ink-950/95`, `bg-ink-950/60` scrims | no |

**Legibility bug from the same mismatch.** `SpatialScreen.tsx:21,24,101,104,107,119` put `text-white/50`–`text-white/70` inside `GridCard`, which now renders `bg-surface-raised` (`future/GridCard.tsx:57`). DOM shows 4× `text-white/60` on white cards. `TabletopSessionPanel.tsx:33,85` has the same problem.

**Glow at rest**

| path:line | snippet | rendered |
|---|---|---|
| packages/ui/backgrounds/GridScene.skia.tsx:27 | `<BlurMask blur={lineWidth * 2.5} style="solid" />` on moving lines | yes |
| packages/ui/backgrounds/GridScene.skia.tsx:76,79 | `color={glowColor}` moving glow lines | yes |
| apps/web/components/site/ProductHome.tsx:125; ExploreMapPane.tsx:31 | `glowColor="#0E8FA3"` | yes |
| packages/spatial/SpatialScreen.tsx:38 | `glowColor="#00f3ff"` | yes (DOM) |
| packages/ui/backgrounds/GlyphCity.skia.tsx:82,117,149,152 | `<BlurMask blur={4–7} style="solid" />` neon building edges | yes (/spatial) |
| packages/spatial/lightcycle/three/energyMaterial.ts:40-45 | TSL `glow` multiplier | yes (interaction) |
| packages/spatial/lightcycle/three/ThreeLightCycleRenderer.ts:102-103,301 | `emissive … emissiveIntensity: 2.2` | yes (interaction) |
| packages/spatial/mcp/three/McpThreePresence.ts (9 lines) | emissive red/white MCP head | yes (interaction) |
| packages/spatial/sightline/SightlineHeroRenderer.ts:173-174 | sensor `emissive '#5FD1E1' … 0.9` | yes (home hero) |
| apps/web/components/site/SiteHeader.tsx:74,159; ProductHome.tsx:188 | `backdrop-blur-xl` / `backdrop-blur-sm` frosted glass | yes (DOM) |

No `shadow-[0_0_…]` and no `drop-shadow` glows.

## 13. Retro pastiche

No faux-aged paper textures, jazz silhouettes or grain overlays in scope. The pastiche that does ship is retro-futurist Tron:

| path:line | snippet | rendered |
|---|---|---|
| packages/theme/tokens.ts:15,29,43,112 | `// RETRO primary — electric yellow`, `// RETRO accent — hot pink`, `// RETRO neutrals — paper cream`, `// RETRO: Archivo Black shouts the headlines` | yes (tokens) |
| packages/spatial/SpatialScreen.tsx:46,66,94,107 | `variant="megacity"`, "Harlem Might / Grid Program", "Start 37-Cycle Race", "black-vector arena for 90° light-cycle combat … derez collisions" | yes (DOM) |
| packages/spatial/mcp/mcpVoice.ts:64 | `'Program derezzed. The Grid remembers every mistake.'` | yes (interaction, audio) |
| packages/spatial/mcp/mcpBrain.ts:141 | `'MCP // GRID CONTROL'` | yes (interaction) |

The `/spatial` route is in the public nav (`components/site/nav.ts:9`), and the home CTA "Enter the spatial experience" (`ProductHome.tsx:160`) leads to it.

## 14. Mixed icon systems

| Library / glyph | path:line | rendered |
|---|---|---|
| lucide-react (web fork) | packages/ui/icons.web.ts:87-88 | yes |
| lucide-react-native (native fork) | packages/ui/icons.native.tsx:7 | no (native) |
| lucide via `@acme/ui/icons` | app/features/notifications/notifications.store.ts:4; profile/profile-content.tsx:18; schedule/Schedule.tsx:4; home/home.data.ts:5; ui/SearchBar.tsx:7 (`X`) | yes |
| lucide via `./icons` | ui/Collapsible.web.tsx:4, DropZone.*:7-9, ToastCard.tsx:5, audio/*:4-9 | no |
| Unicode `☰` / `✕` as menu icon | apps/web/components/site/SiteHeader.tsx:150 `{open ? '✕' : '☰'}` | yes (DOM `☰` on every route, below md) |
| Emoji `🔍` as search icon | packages/ui/SearchBar.tsx:82 `<Text aria-hidden …>🔍</Text>` (the same component uses lucide `X`) | yes (DOM, /explore) |
| `⌘V` keycap text | packages/ui/TextField.tsx:64 | yes (interaction) |
| `✕` close | packages/ui/BottomSheet.tsx:39 | no |
| `✓` check | packages/ui/Checkbox.web.tsx:47 | no |
| `×` / `›` | packages/ui/Lightbox.tsx:54,77 | no |
| `←` | packages/ui/Toolbar.stories.tsx:19 | no |
| `← →` as key legends | packages/spatial/TabletopThreeExperience.web.tsx:101 | yes (interaction) |

No @expo/vector-icons, heroicons or phosphor. There's one icon library, but it competes with Unicode and emoji glyphs in the header and the search bar.

## 15. Hard-coded route strings (13 literals, 6 files)

| path:line | snippet | rendered |
|---|---|---|
| apps/web/components/site/nav.ts:6-10 | `{ label: 'Home', href: '/' }` … `'/notifications'` (5) | yes |
| apps/web/components/site/nav.ts:14 | `PROFILE = { label: 'Profile', href: '/profile' }` | yes |
| apps/web/components/site/ProductHome.tsx:154 | `href="/explore"` | yes (DOM) |
| apps/web/components/site/ProductHome.tsx:160 | `href="/spatial"` | yes (DOM) |
| apps/web/components/site/ProductHome.tsx:287 | `href="/explore"` | yes (DOM) |
| apps/web/components/site/SiteFooter.tsx:84 | `<Link href="/settings" …>` (bypasses nav.ts) | yes (DOM) |
| apps/web/components/site/SiteHeader.tsx:85 | `href="/"` | yes |
| apps/web/components/site/SiteHeader.tsx:16 | `href === '/' ? pathname === '/' : …` (route literal in logic) | yes |
| packages/app/features/error/screen.web.tsx:7 | `router.push('/')` | yes (error) |
| packages/app/features/profile/profile-content.tsx:82 | `router.push('/settings')` | yes (interaction) |
| apps/web/components/site/SiteHeader.tsx:92 | `src="/icon.png"` (asset path, listed for completeness) | yes |

`nav.ts` is a partial route map: untyped, web-only, and not used by `ProductHome`, `SiteFooter:84` or the `packages/app` screens.

---

## Existing static guards

| Guard | File | Covers |
|---|---|---|
| ESLint `no-restricted-imports` bans `gsap`, `gsap/*`, `@expo/ui`, `@expo/html-elements`, RN visual primitives | apps/web/eslint.config.mjs:19-49 | Cat 8 (gsap), but the 4 files that import gsap are exempted (`productMotionFiles`, lines 10-15, 21) |
| ESLint `no-restricted-syntax` bans raw `<div>`, `<h1>` etc. in `(site)` and `components/site` | apps/web/eslint.config.mjs:50-62 | semantic HTML only |
| `FORBID_WEB_RENDERING_FROM_NATIVE` (gsap, lenis, framer-motion, r3f out of native/shared) | packages/config/eslint/boundaries.mjs:9-24; used by packages/ui, app, spatial eslint configs | platform boundaries, not design |
| Inline `queryKey` ban | packages/config/eslint/base.mjs:13-22 | data layer |
| CI runs `pnpm turbo build typecheck lint` + spatial verifiers | .github/workflows/ci.yml:24-29 | runs the lint above |
| Token header "No hex values exist outside this file" | packages/theme/tokens.ts:9 | comment only, not enforced (84 violations) |

Nothing in apps/web, packages/config, tooling/ or .github/workflows guards hex/rgb literals outside `packages/theme`, primitive-scale classes (`burgundy-*`, `ember-*`, `cyan-*`, `white`), `uppercase` or wide `tracking-*`, `·`/`→` in JSX text, `rounded-[…]` or radius drift, `shadow-card` frequency, entrance presets, glyph or emoji icons, hard-coded `href`/`router.push` strings, or font families. `tooling/` holds only asset-copy scripts, Android/TypeGPU verifiers and generators (`tooling/generators/gen.mjs`); none of them look at UI.

## Method notes

- Hit lists come from ERE grep over the 277-file scope list. Comment-only matches were removed from categories 5 and 9 by hand.
- DOM confirmation used `curl -m 120` against the running dev server. I stripped `<script>`/`<style>` and tags from the HTML and grepped the text and class attributes. This only shows SSR output, so anything mounted client-side after hydration (Skia canvases, the race, the selected-place panes) is marked `yes (interaction)` or inferred from closure membership.
- Not verified: the client-rendered colours of Skia and Three canvases (no screenshot pass), dark-mode rendering, and whether the `.gallery-slide` class has any rendered consumer (none found in scope).
