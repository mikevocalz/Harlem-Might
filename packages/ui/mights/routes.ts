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
  /** A position inside a walk is `walk(slug) + '#stop-' + n`; a stop's own page is its place. */
  walk: (slug: string) => `/walks/${slug}`,
  stories: () => '/stories',
  story: (slug: string) => `/stories/${slug}`,
  // /today/[date] is deferred until listings exist (audit §11), so the builder
  // takes no date. Events have no page of their own: a row links to the
  // venue's site and to the venue's place page.
  today: () => '/today',
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
  { label: 'Today', href: routes.today(), matches: [/^\/today(\/|$)/] },
] as const;

export type PrimaryNavLabel = (typeof primaryNav)[number]['label'];

export function activeSection(pathname: string): PrimaryNavLabel | null {
  return primaryNav.find((item) => item.matches.some((re) => re.test(pathname)))?.label ?? null;
}

// Labels match what exists: the app is not released (download page) and AR is
// a concept (home ch.3 "About the AR concept"), so neither label promises a
// download or a working preview.
export const secondaryNav = [
  { label: 'The app', href: routes.download() },
  { label: 'AR concept', href: routes.ar() },
  { label: 'About', href: routes.about() },
  { label: 'Press', href: routes.press() },
  { label: 'Accessibility', href: routes.legal('accessibility') },
  { label: 'Privacy', href: routes.legal('privacy') },
  { label: 'Terms', href: routes.legal('terms') },
] as const;
