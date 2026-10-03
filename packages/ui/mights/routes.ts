// The one route map. Every public-site href comes from here; hardcoded path
// strings in components are a lint failure.

type ExploreQuery = { view?: 'map' | 'list'; q?: string; category?: string; place?: string };

function withQuery(path: string, query?: Record<string, string | undefined>) {
  if (!query) return path;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) if (value) params.set(key, value);
  const search = params.toString();
  return search ? `${path}?${search}` : path;
}

export const routes = {
  home: () => '/',
  explore: (q?: ExploreQuery) => withQuery('/explore', q),
  place: (slug: string) => `/places/${slug}`,
  walks: () => '/walks',
  walk: (slug: string) => `/walks/${slug}`,
  walkStop: (slug: string, n: number) => `/walks/${slug}/stops/${n}`,
  stories: () => '/stories',
  story: (slug: string) => `/stories/${slug}`,
  today: (date?: string) => (date ? `/today/${date}` : '/today'),
  event: (slug: string) => `/events/${slug}`,
  ar: () => '/ar',
  download: () => '/download',
  about: () => '/about',
  press: () => '/press',
  legal: (doc: 'privacy' | 'terms' | 'accessibility') => `/legal/${doc}`,
  /** Redirects to the first legal document; exists so the breadcrumb has a target. */
  legalIndex: () => '/legal',
} as const;

export const primaryNav = [
  { label: 'Explore', href: routes.explore(), matches: [/^\/explore(\/|$)/, /^\/places(\/|$)/] },
  { label: 'Walks', href: routes.walks(), matches: [/^\/walks(\/|$)/] },
  { label: 'Stories', href: routes.stories(), matches: [/^\/stories(\/|$)/] },
  { label: 'Today', href: routes.today(), matches: [/^\/today(\/|$)/, /^\/events(\/|$)/] },
] as const;

export type PrimaryNavLabel = (typeof primaryNav)[number]['label'];

export function activeSection(pathname: string): PrimaryNavLabel | null {
  return primaryNav.find((item) => item.matches.some((re) => re.test(pathname)))?.label ?? null;
}

export const secondaryNav = [
  { label: 'Preview AR', href: routes.ar() },
  { label: 'Get the app', href: routes.download() },
  { label: 'About', href: routes.about() },
  { label: 'Press', href: routes.press() },
  { label: 'Accessibility', href: routes.legal('accessibility') },
  { label: 'Privacy', href: routes.legal('privacy') },
  { label: 'Terms', href: routes.legal('terms') },
] as const;
