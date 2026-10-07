# Restaurant menus

Harlem Might treats a restaurant menu as structured place content, not a single opaque URL.

## Menu formats

Each Place can have multiple menu records:

- `image_gallery` — one or more uploaded or official remote menu images.
- `pdf` — an uploaded PDF or an official remote PDF URL.
- `web` — the restaurant's official menu webpage.

This supports separate Brunch, Dinner, Drinks, Happy Hour, Dessert, Seasonal, etc. menus.

## In-app viewer

The mobile route is:

```text
/menu-viewer?placeId=<canonical-place-id>&menuId=<payload-array-row-id>
```

The route fetches the canonical Place from Payload first and resolves the menu by its Payload array-row ID. The client does not accept an arbitrary browser URL as the source of truth.

### Web menu pages

Native uses `react-native-secure-webview`, **not** `react-native-webview`.

The viewer:

- fails closed;
- allows the initial exact origin;
- optionally allows additional exact origins curated in `allowedOrigins`;
- blocks unknown redirects/schemes;
- exposes back, forward and reload;
- keeps a separate close action that returns to the Harlem Might route, similar to X's in-app browser.

Do not add wildcard origins just to make a site load. If a restaurant's menu redirects through a provider (Toast, BentoBox, etc.), verify the exact redirect origin and add only that origin to the menu record.

### PDF menus

PDFs do not use a WebView.

The app downloads a temporary cached copy with Expo FileSystem and renders it with `@kishannareshpal/expo-pdf`, which uses native PDF engines. This avoids the unreliable Android-WebView-PDF path while keeping the PDF inside Harlem Might.

### Image menus

Menu images render in a swipeable native carousel. Prefer venue-supplied or rights-cleared images. Remote images keep their source URL in Payload.

## Security / provenance

- Prefer HTTPS.
- Store `sourceUrl` and `lastVerifiedAt`.
- Remote menu assets are current operational data and should expire/reverify much faster than historical content.
- Never rewrite or generate a restaurant's real menu as a factual replacement.
- Generated food/menu imagery belongs only in clearly labeled marketing/concept art, never the canonical live menu.
