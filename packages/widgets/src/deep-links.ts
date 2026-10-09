/**
 * Canonical same-app paths. The mobile shell handles these through Expo Router;
 * on the web, they resolve to existing /explore, /stories, /walks and /today
 * routes. Never pass arbitrary URLs or raw slugs to native intent handlers.
 */
function pathSegment(value: string): string {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(value)) {
    throw new Error('Invalid public content slug');
  }
  return encodeURIComponent(value);
}

export const widgetPaths = {
  place: (slug: string) => `/explore?place=${pathSegment(slug)}`,
  story: (slug: string) => `/stories/${pathSegment(slug)}`,
  event: () => '/today',
  walk: (slug: string) => `/walks/${pathSegment(slug)}`,
} as const;

/** Compose only validated app-owned paths; never emit an untrusted open redirect. */
export function toMobileDeepLink(path: string): string {
  if (!/^\/(?:explore\?place=[A-Za-z0-9_-]+|stories\/[A-Za-z0-9_-]+|today|walks\/[A-Za-z0-9_-]+)$/.test(path)) {
    throw new Error('Unsupported Harlem Might deep link');
  }
  return `harlemmight://${path.slice(1)}`;
}
