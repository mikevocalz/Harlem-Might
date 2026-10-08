// Pure helpers for the Explore workspace: URL parsing and building, the
// result summary line, and focus-return targets. No React and no store, so
// node --test can run them directly.

export type ExploreView = 'map' | 'list';

export interface ExploreParams<C extends string> {
  view: ExploreView;
  q: string;
  category: C;
  placeId: string | null;
}

interface ReadableParams {
  get(name: string): string | null;
}

/**
 * Reads the workspace from the query string. Unknown `category` or `view`
 * values fall back to their defaults without rewriting the URL.
 */
export function parseExploreParams<C extends string>(
  params: ReadableParams,
  categories: readonly C[],
  fallback: C,
): ExploreParams<C> {
  const raw = params.get('category');
  const category = categories.find((c) => c === raw) ?? fallback;
  return {
    view: params.get('view') === 'list' ? 'list' : 'map',
    q: params.get('q') ?? '',
    category,
    placeId: params.get('place'),
  };
}

/** `pathname?search` with `patch` applied; a null or empty value removes the key. */
export function exploreHref(pathname: string, current: string, patch: Record<string, string | null>) {
  const next = new URLSearchParams(current);
  for (const [k, v] of Object.entries(patch)) {
    if (v) next.set(k, v);
    else next.delete(k);
  }
  const search = next.toString();
  return search ? `${pathname}?${search}` : pathname;
}

const plural = (n: number) => (n === 1 ? '1 place' : `${n} places`);

/**
 * The polite live-region line under the filters. Names the filter and the
 * map gap, so a screen-reader user hears what the map can't show.
 */
export function resultsSummary(total: number, mapped: number, q: string, category: string, all: string) {
  const scope = [q.trim() ? `matching “${q.trim()}”` : '', category !== all ? `in ${category}` : '']
    .filter(Boolean)
    .join(' ');
  const head = scope ? `${plural(total)} ${scope}` : plural(total);
  if (total === 0) return `No places ${scope}`.trim() + '.';
  if (mapped === total) return `${head}.`;
  return `${head}, ${mapped} on the map.`;
}

/** Ids for `data-explore-focus`, the hook focus return queries by. */
export const focusId = {
  row: (placeId: string) => `row:${placeId}`,
  marker: (placeId: string) => `marker:${placeId}`,
};

/** True when `id` is the list row or marker of `placeId`. */
export const isFocusFor = (id: string, placeId: string) => id === focusId.row(placeId) || id === focusId.marker(placeId);

/**
 * Where focus goes when the sheet closes, in order: the control that opened
 * it, then the place's list row, then its marker. The first one that is
 * rendered and visible wins; the caller falls back to the search field.
 */
export function focusReturnOrder(returnFocusId: string | null, placeId: string | null): string[] {
  const order = [returnFocusId, placeId ? focusId.row(placeId) : null, placeId ? focusId.marker(placeId) : null];
  return order.filter((v, i): v is string => !!v && order.indexOf(v) === i);
}
