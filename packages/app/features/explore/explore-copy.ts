// Explore copy shared by the web workspace (apps/web/components/explore) and
// the native panes, so both say the same thing about the same places. Pure
// functions: no React and no store, so node --test runs them directly.

/** The subset of a place record the copy reads. */
interface PlaceLine {
  category: string;
  street?: string;
  area: string;
  lngLat?: readonly [number, number];
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

/** A result row's second line: "Category, street", plus a note when the place has no map point. */
export function placeRowLine(place: PlaceLine): string {
  return `${place.category}, ${place.street ?? place.area}${place.lngLat ? '' : ', location pending'}`;
}

/** What the list says when nothing matches, before the "Clear search and filters" action. */
export function noResultsCopy(q: string, category: string, all: string): string {
  const query = q.trim() ? ` “${q.trim()}”` : '';
  const scope = category !== all ? ` in ${category}` : '';
  return `Nothing in the catalogue matches${query}${scope}. Search looks at names, areas, categories and tags.`;
}

/** Walking directions to a [lng, lat] point. Opens Google Maps (app or site). */
export function directionsUrl(lngLat: readonly [number, number]): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lngLat[1]},${lngLat[0]}`;
}
