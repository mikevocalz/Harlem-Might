# Handoff: chrome and the app page

Phase 8 of the premium experience pack, the conversion and chrome part. Files:

| Surface | File |
|---|---|
| `/download` | `apps/web/app/(site)/download/page.tsx` |
| Desktop navbar | `packages/ui/mights/MightsNavbar.tsx:MightsNavbar` |
| Mobile dock and More sheet | `packages/ui/mights/MightsDock.tsx:MightsDock` |
| Footer | `packages/ui/mights/MightsFooter.tsx:MightsFooter` |
| Wordmark | `packages/ui/mights/MightsWordmark.tsx:MightsWordmark` (no change) |
| Nav labels | `packages/ui/mights/routes.ts:secondaryNav` |

Checked by `pnpm turbo typecheck lint --filter=web --filter=@acme/ui` and the web and ui `node:test` suites. **Not checked in a browser.** This phase shared the working tree with the AR agent and was not allowed to build or start a server, so there are no screenshots or axe runs. The tables below come from source and the primitives' classes.

## What the app's status actually is

Read on 2026-10-07:

- `apps/mobile/eas.json`: `development` and `preview` profiles use `"distribution": "internal"`; `submit.production` is `{}`. No store credentials, no TestFlight or Play track.
- `apps/mobile/app.config.ts`: bundle id and package `com.harlemmight.app`, version `0.1.0`.
- `docs/XR-PLATFORM-MATRIX.md:11` lists iOS/Android phone as "integrated". The audit (§12, status language) maps that label to **integration path**: merged and builds, nothing run on the target.
- Nothing in the repo records the phone app running on a simulator or a phone, so "in testing" is not supported by evidence.

So the page says the app is not released and gives both phones the status word **integration path**, with a plain sentence beside it.

## What changed and why

1. **`/download` leads with what works.** H1 "The Harlem Might app", lead "The app isn't in the App Store or Google Play yet. The map on this site works today." Primary `MightsButton` "Open the map" → `routes.explore()`. One secondary, "About the AR concept" → `routes.ar()`, the same label the home page uses (`ProductHome.tsx`, ch.3).
2. **One status list, no bento.** A `MightsBand` "Where the app stands" holds a `<dl>`: iPhone and Android, each with the status word and one sentence naming the stores it is not in. A small line says the page will link to a build once one reaches a store.
3. **No store badges, QR code or waitlist form.** Each needs a destination or backend that doesn't exist. They come back when a listing exists (badge, QR of the listing) or when there is a form backend (waitlist).
4. **Navbar: one button, "The app".** "Get the app" was a filled gold CTA on every page leading to "not in the stores yet" (audit §9). It is now `variant="outline"` with the label "The app", and carries `aria-current="page"` on `/download`. "Preview AR" is gone from the bar: it promised a preview that does not run, and one button keeps the bar quiet. AR stays reachable from the footer and the More sheet as "AR concept".
5. **Labels, one per intent.** `secondaryNav` now reads "The app", "AR concept", then About, Press, Accessibility, Privacy, Terms. The footer Discover column uses the same two labels.
6. **Footer.** "Photographs credited on each page" is removed (no product route has a photograph, audit §13). "Built by the block, for the block." stays. The "Get the app / iPhone and Android" column is folded into Discover as "The app", so the grid is 6/3/3. Links get `min-h-6` (24px, WCAG 2.5.8 without the spacing exception). The year is `new Date().getFullYear()` with `suppressHydrationWarning`: static pages render at build, so it shows the build year.
7. **Dock.** The More button now carries the active state (gold, 2px `h-rail` marker, heavier stroke) when the route is one of the sheet's links, since no dock tab matches `/about`, `/download` or `/legal/*`. Sheet links get `aria-current="page"` plus a bold gold label. The dialog is named by its visible title (`aria-labelledby`). The active marker moved from `h-px` to the `h-rail` token the navbar uses. Close button gets `min-w-11` and the `text-small` step.
8. **Wordmark.** Already `alt="Harlem Might"` inside a link named "Harlem Might home"; the accessible name contains the visible text (2.5.3). No change.

## Components

| Component | Variant / props | Notes |
|---|---|---|
| `MightsPage` | `title`, `lead` | one h1 |
| `MightsButton` | primary "Open the map"; secondary "About the AR concept" | navbar uses `variant="outline" size="sm"` |
| `MightsBand` | `title="Where the app stands"` | hairline rail on top |
| `MightsText` | `tone="default"` for platform and status, muted for the sentence, `size="small"` for the footnote | |

## Tokens used

| Token | Where |
|---|---|
| `rule-hairline` | row dividers in the status list, footer, sheet rows |
| `rail` (`h-rail`, 2px) | dock active marker |
| `dock` (`h-dock`, `--spacing-dock`) | dock height, footer bottom padding |
| `primary`, `text`, `text-muted` | active state, body, secondary copy |
| type steps `ui`, `label`, `caption`, `small`, `body` | footer links, footer headings, dock labels, Close, status copy |
| `content-screen` (`max-w-content-screen`) | status list measure |

## States and interactions

| Element | State | Behavior |
|---|---|---|
| Navbar "The app" | default / hover | outline rail, `border-strong` → `primary/70` on hover |
| Navbar "The app" | on `/download` | `aria-current="page"` |
| Dock tab | active | `text-primary`, 2px top marker, stroke 2.25, `aria-current="page"` |
| Dock More | route in sheet | same active treatment as a tab (no `aria-current`; it is a button) |
| More sheet | open | `showModal()`: rest of page inert, focus moves into the dialog |
| More sheet | close | Close button, Escape, backdrop click, or following a link; focus returns to More |
| Footer link | hover | `text-primary` |

The download page has no loading, error, empty or offline state of its own: it is static copy with two links.

## Responsive behavior

| Width | Changes |
|---|---|
| < 768 | dock visible, navbar links and "The app" button hidden; status rows stack name over status |
| ≥ 768 | navbar with four links and "The app"; status rows split 3/9; footer 6/3/3 |

## Accessibility

- Focus order on `/download` (≥ 768): skip link → wordmark → four nav links → The app → Open the map → About the AR concept → footer.
- Every target in these files is ≥ 44px except footer links, which are 24px minimum (2.5.8 AA).
- Active state never relies on colour alone: marker bar, stroke weight and `aria-current` (or bold weight in the sheet).
- `<dl>` holds `<dt>`/`<dd>` inside `<div>` wrappers (`View`); the platform name is text, not a heading, because `<dt>` may not contain headings.

## References (Mobbin, structure only)

- [Sketch, apps section](https://mobbin.com/sites/sections/21f8f4ce-31df-462e-8fa1-b2e3db9b45ea): one row per platform, plain text links, "Open the web app" sits beside the downloads. Adopted: per-platform rows and the web as a first-class action. Rejected: its light ground.
- [Aboard, iOS app](https://mobbin.com/sites/sections/2e494779-a9e7-4d67-8864-8aadd5aa868f): states the missing platform outright ("Android is coming soon") under the CTA. Adopted: say what isn't available, in a plain sentence. Rejected: the phone mockup, which would show screens we can't show.
- [Beside, every device](https://mobbin.com/sites/sections/0fdc0334-3a75-4295-829b-ca9ff2997bda): three equal platform cards. Rejected: equal cards are the template look, and two of three would be dead buttons here.

## Unresolved

1. **"In testing" vs "integration path".** `apps/web/content/press.ts:23` and `apps/web/content/legal.ts:51` (owned by the AR agent) still say the app "is in testing". If someone has run the app on a simulator or phone, `/download` should move to "in testing"; if not, those two lines should drop it. Mike to confirm.
2. **`/ar` labels.** `apps/web/app/(site)/ar/page.tsx` (AR agent) titles the page "Preview AR" and its primary button says "Get the app". The canonical labels are now "AR concept" and "The app".
3. **Footer year** uses `suppressHydrationWarning`. A build-time constant in `next.config.ts` would remove it; that file is outside this phase.
4. **Visual check pending**: navbar outline button over the home hero overlay (`tone="paper"`), More active state at 390, status list at 390 and 1280.
