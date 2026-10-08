import type { WalkRecord, WalkStop } from '@acme/app/content';
import type { BentoFactModule, MapPin } from '@acme/ui/mights';

// Pure formatting for walks. Every fact comes from the record; a fact the
// record does not carry is left out rather than shown as zero or "unknown".

const METERS_PER_MILE = 1609.344;

/** "0.6 miles", "1 mile", "2.4 miles". US audience, one decimal. */
export function formatDistance(meters: number): string | null {
  if (!Number.isFinite(meters) || meters <= 0) return null;
  const miles = Math.round((meters / METERS_PER_MILE) * 10) / 10;
  const shown = miles < 0.1 ? 0.1 : miles;
  return `${shown} ${shown === 1 ? 'mile' : 'miles'}`;
}

/** "45 min", "1 hr", "1 hr 20 min". */
export function formatDuration(minutes: number): string | null {
  if (!Number.isFinite(minutes) || minutes <= 0) return null;
  const total = Math.round(minutes);
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`;
}

export function formatStopCount(count: number): string | null {
  if (count <= 0) return null;
  return `${count} ${count === 1 ? 'stop' : 'stops'}`;
}

/** The B7 strip: only the facts this walk actually has, in reading order. Max 4 (compact variant). */
export function walkFactModules(walk: Pick<WalkRecord, 'distanceMeters' | 'durationMinutes' | 'stops' | 'startDescription' | 'endDescription'>): BentoFactModule[] {
  const modules: BentoFactModule[] = [];
  const distance = formatDistance(walk.distanceMeters);
  if (distance) modules.push({ kind: 'fact', id: 'distance', label: 'Distance', value: distance });
  const duration = formatDuration(walk.durationMinutes);
  if (duration) modules.push({ kind: 'fact', id: 'time', label: 'Walking time', value: duration });
  const stops = formatStopCount(walk.stops.length);
  if (stops) modules.push({ kind: 'fact', id: 'stops', label: 'Stops', value: stops });
  const start = walk.startDescription.trim();
  const end = walk.endDescription.trim();
  if (start) {
    modules.push({ kind: 'fact', id: 'start', label: 'Starts at', value: start, note: end ? `Ends at ${end}` : undefined });
  } else if (end) {
    modules.push({ kind: 'fact', id: 'end', label: 'Ends at', value: end });
  }
  return modules;
}

/** One sentence for a walk card: "1.2 miles, 45 min, 6 stops". Empty when no fact is known. */
export function walkSummaryLine(walk: Pick<WalkRecord, 'distanceMeters' | 'durationMinutes' | 'stops'>): string {
  return [formatDistance(walk.distanceMeters), formatDuration(walk.durationMinutes), formatStopCount(walk.stops.length)]
    .filter((part): part is string => part !== null)
    .join(', ');
}

/** In-page anchor for a stop. Stops have no route of their own (audit §11). */
export const stopAnchor = (position: number) => `stop-${position}`;

type Locate = (slug: string) => readonly [number, number] | undefined;

export interface WalkMapView {
  center: readonly [number, number];
  zoom: number;
  pins: MapPin[];
  /** How many of the walk's stops have a verified point on the map. */
  located: number;
}

/**
 * A static overview map from the stops' catalogue points. The walk record has
 * no route geometry yet, so this shows where the stops are, not the path
 * between them. Null when no stop has a point.
 */
export function walkMapView(stops: readonly WalkStop[], locate: Locate): WalkMapView | null {
  const points = stops
    .map((stop) => (stop.place ? locate(stop.place.slug) : undefined))
    .filter((p): p is readonly [number, number] => p !== undefined);
  if (points.length === 0) return null;
  const lngs = points.map((p) => p[0]);
  const lats = points.map((p) => p[1]);
  const [minLng, maxLng, minLat, maxLat] = [Math.min(...lngs), Math.max(...lngs), Math.min(...lats), Math.max(...lats)];
  const span = Math.max(maxLng - minLng, maxLat - minLat);
  // Harlem walks span a few blocks to a couple of miles; four bands cover it.
  const zoom = span < 0.004 ? 16 : span < 0.01 ? 15 : span < 0.025 ? 14 : 13;
  return {
    center: [(minLng + maxLng) / 2, (minLat + maxLat) / 2],
    zoom,
    pins: points.map((lngLat, i) => ({ lngLat, tone: i === 0 ? 'live' : 'cobalt' })),
    located: points.length,
  };
}
