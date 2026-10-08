# Restaurant menus

Harlem Might treats a restaurant menu as structured place content, not a single opaque URL.

## Menu formats

Each Place can have multiple menu records:

- `image_gallery` — one or more uploaded or official remote menu images.
- `pdf` — an uploaded PDF or an official remote PDF URL.
- `web` — the restaurant's official menu webpage.

This supports separate Brunch, Dinner, Drinks, Happy Hour, Dessert, Seasonal, etc. menus.

## In-app viewer

Removed 2026-10-08 (DECISIONS S13). The mobile `/menu-viewer` route and `apps/mobile/src/menu-viewer/*` were deleted with the demo shell: no screen linked to them and no place record held a menu. If a menu viewer comes back, it lands with a link from Place Detail and keeps the rules below, which still apply to anything that renders a venue's menu:

- Resolve the menu from the canonical Place in Payload by its array-row ID; never accept an arbitrary URL from the client.
- Web menus: `react-native-secure-webview`, not `react-native-webview`. Fail closed, allow the initial exact origin plus exact origins curated in `allowedOrigins`, block unknown redirects and schemes, keep a separate close action. No wildcard origins.
- PDF menus: no WebView. Download a cached copy with Expo FileSystem and render it with a native PDF engine.
- Image menus: a swipeable native carousel of venue-supplied or rights-cleared images, keeping each source URL in Payload.

## Security / provenance

- Prefer HTTPS.
- Store `sourceUrl` and `lastVerifiedAt`.
- Remote menu assets are current operational data and should expire/reverify much faster than historical content.
- Never rewrite or generate a restaurant's real menu as a factual replacement.
- Generated food/menu imagery belongs only in clearly labeled marketing/concept art, never the canonical live menu.
