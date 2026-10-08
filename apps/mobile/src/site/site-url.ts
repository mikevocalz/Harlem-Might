/**
 * The public site's origin, from `EXPO_PUBLIC_APP_URL` (inlined at bundle
 * time). Undefined when the build has none, so callers can show why a site
 * link is unavailable instead of opening a dead address.
 */
export function siteOrigin(): string | undefined {
  const value = process.env.EXPO_PUBLIC_APP_URL?.trim();
  if (!value) return undefined;
  return value.replace(/\/+$/, '');
}

/** Absolute site URL for a path from `routes` in `@acme/ui/mights`, or undefined without an origin. */
export function siteUrl(path: string): string | undefined {
  const origin = siteOrigin();
  return origin ? `${origin}${path}` : undefined;
}
