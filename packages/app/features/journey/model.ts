import type { PlaceRecord, SourceRef, StoryRecord, WalkRecord } from '../../content/records.ts';
import type { Route, RouteDestination } from '../navigation/model/route.ts';
import { routeSteps } from '../navigation/model/route.ts';
import type { NavigationState, NavigationFixState } from '../navigation/session/navigationStore.ts';
import type { LocationAvailability } from '../navigation/view/locationSource.ts';
import { DEFAULT_NAVIGATION_CONFIG } from '../navigation/config.ts';

export interface JourneyPlan {
  id: string;
  slug: string;
  title: string;
  updatedAt: string;
  stops: { id: string; slug: string; title: string; note?: string }[];
}
export interface RouteSynopsis {
  schemaVersion: 1;
  stopId: string;
  generatedAt: string;
  distanceM: number;
  durationS: number;
  instructions: string[];
}

const validDate = (value: string | undefined, now: number) => !!value && Number.isFinite(Date.parse(value)) && Date.parse(value) <= now;
export function sourced(sources: readonly SourceRef[], now = Date.now()): boolean {
  return sources.some(source => safeSource(source.url) && validDate(source.accessedAt, now));
}
export function safeSource(value: string | undefined): boolean {
  if (!value) return false;
  try { const url = new URL(value); return (url.protocol === 'https:' || url.protocol === 'http:') && !url.username && !url.password; } catch { return false; }
}

/** Only a fresh published reader result can create this plan. It is a synopsis, not navigation geometry. */
export function planFromWalk(walk: WalkRecord): JourneyPlan {
  const stops = walk.stops.map(stop => {
    if (!stop.place) throw new Error('A stop is no longer published. Choose another walk.');
    return { id: String(stop.place.id), slug: stop.place.slug, title: stop.place.name, ...(stop.note ? { note: stop.note } : {}) };
  });
  if (stops.length < 2 || new Set(stops.map(stop => stop.id)).size !== stops.length || !validDate(walk.updatedAt, Date.now()) || !sourced(walk.sources)) {
    throw new Error('This walk needs complete, sourced stops before it can start.');
  }
  return { id: String(walk.id), slug: walk.slug, title: walk.title, updatedAt: walk.updatedAt, stops };
}

export const MAX_LOCATION_REVIEW_AGE_MS = 365 * 24 * 60 * 60 * 1000;

/** A centroid is never described as an entrance or evidence of step-free access. */
export function verifiedDestination(place: PlaceRecord, now = Date.now()): RouteDestination | undefined {
  const coordinate = place.location;
  if (place.locationAccuracy !== 'verified' || !coordinate || !safeSource(place.locationSourceUrl) || !validDate(place.locationSourceReadAt, now) || now - Date.parse(place.locationSourceReadAt!) > MAX_LOCATION_REVIEW_AGE_MS) return undefined;
  const [longitude, latitude] = coordinate;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return undefined;
  return { name: place.name, placeId: place.slug, coordinate: { longitude, latitude } };
}

/** Deliberately excludes GPS, origin, geometry, live ETA, auth and account data. */
export function synopsisFromRoute(route: Route, stopId: string, now = Date.now()): RouteSynopsis {
  return { schemaVersion: 1, stopId, generatedAt: new Date(now).toISOString(), distanceM: route.distanceM, durationS: route.durationS,
    instructions: routeSteps(route).map(step => step.maneuver.instruction).filter(Boolean).slice(0, 200) };
}

/** Fail closed when a feed is stale, coarse, offline, paused or no longer matched. */
export function liveProgress(state: NavigationState, fixes: NavigationFixState, now: number, online: boolean | undefined, destinationSlug: string, location: LocationAvailability) {
  const { session, progress, positioning } = state;
  const last = fixes.lastFix;
  if (location !== 'granted' || online === false || !['navigating', 'navigatingAR', 'calibratingAR'].includes(session.phase) ||
      positioning.kind !== 'tracking' || positioning.confidence === 'low' || positioning.isMovingTooFast ||
      progress.kind !== 'tracking' || last?.kind !== 'accepted' || last.fix.source !== 'device-gps' ||
      !('activeRoute' in session) || session.destination.placeId !== destinationSlug || session.origin.kind !== 'device-location' || session.deviation.kind !== 'on-route' || session.reroute.kind !== 'idle' ||
      progress.progress.routeId !== session.activeRoute.route.id || fixes.match?.kind !== 'matched') return undefined;
  const maxAge = DEFAULT_NAVIGATION_CONFIG.location.maxFixAgeMs;
  const age = now - last.fix.timestampMs;
  const progressAge = now - progress.progress.timestampMs;
  if (!Number.isFinite(age) || !Number.isFinite(progressAge) || age < 0 || age > maxAge || progressAge < 0 || progressAge > maxAge) return undefined;
  return progress.progress;
}

/** The published reader is necessary; this additional gate requires an attributed source read and a real publication date. */
export function storiesForStop(stories: readonly StoryRecord[], placeId: string, now = Date.now()): StoryRecord[] {
  return stories.filter(story => story.places.some(place => String(place.id) === placeId) &&
    validDate(story.publishedAt, now) && validDate(story.updatedAt, now) && sourced(story.sources, now)).slice(0, 3)
    // Journey context is text only. Existing article pages own rights-gated images;
    // no synthesized audio, unlicensed archives or media URLs are cached here.
    .map(story => ({ ...story, images: [], archive: [] }));
}
