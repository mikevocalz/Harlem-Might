export type MenuFormat = 'image_gallery' | 'pdf' | 'web';

export interface MenuMedia {
  id: string | number;
  url?: string | null;
  alt?: string | null;
  mimeType?: string | null;
}

export interface RemoteMenuImage {
  id?: string | null;
  url: string;
  alt?: string | null;
  sourceUrl?: string | null;
}

export interface MenuRecord {
  id: string;
  label: string;
  format: MenuFormat;
  mealPeriod?: string | null;
  language?: string | null;
  images?: Array<string | number | MenuMedia> | null;
  remoteImages?: RemoteMenuImage[] | null;
  pdf?: string | number | MenuMedia | null;
  url?: string | null;
  allowedOrigins?: Array<{ id?: string | null; origin: string }> | null;
  sourceUrl?: string | null;
  lastVerifiedAt?: string | null;
  effectiveFrom?: string | null;
  effectiveUntil?: string | null;
  active?: boolean | null;
}

export interface PlaceWithMenus {
  id: string | number;
  name: string;
  slug: string;
  primaryCategory?: string | null;
  menus?: MenuRecord[] | null;
}

export const payloadApiBase =
  process.env.EXPO_PUBLIC_PAYLOAD_API_BASE ??
  `${process.env.EXPO_PUBLIC_APP_URL ?? 'http://localhost:3000'}/payload-api`;

export function resolveAssetUrl(value?: string | null) {
  if (!value) return null;
  try {
    return new URL(value).toString();
  } catch {
    try {
      return new URL(value, new URL(payloadApiBase).origin).toString();
    } catch {
      return null;
    }
  }
}

export function sourceOrigin(value?: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function webMenuOrigins(menu: MenuRecord) {
  const origins = new Set<string>();
  const initial = sourceOrigin(menu.url);
  if (initial) origins.add(initial);
  for (const item of menu.allowedOrigins ?? []) {
    const origin = sourceOrigin(item.origin);
    if (origin) origins.add(origin);
  }
  return [...origins];
}

export function menuImageUrls(menu: MenuRecord) {
  const hosted = (menu.images ?? [])
    .map((item) => (typeof item === 'object' && item ? resolveAssetUrl(item.url) : null))
    .filter((value): value is string => Boolean(value));

  const remote = (menu.remoteImages ?? [])
    .map((item) => resolveAssetUrl(item.url))
    .filter((value): value is string => Boolean(value));

  return [...hosted, ...remote];
}

export function menuPdfUrl(menu: MenuRecord) {
  if (typeof menu.pdf === 'object' && menu.pdf) {
    const hosted = resolveAssetUrl(menu.pdf.url);
    if (hosted) return hosted;
  }
  return resolveAssetUrl(menu.url);
}
