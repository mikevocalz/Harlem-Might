import type { StreetMapStatus } from './streetMap.store.ts';
import type { StreetNavigationView } from './streetNavigationPort.ts';
import type { EnuGround } from './streetScene.ts';

/** How close to a place's stance the wearer must be for the origin to carry its name. */
const PLACE_ORIGIN_RADIUS_M = 15;

/**
 * The label for a manual origin. Headsets have no GPS, so the label says the
 * start was chosen by hand: the nearby place's name, or "the spot you chose".
 */
export function manualOriginLabel(
  user: EnuGround,
  places: readonly (EnuGround & { readonly name: string })[],
): string {
  let nearest: { name: string; distanceM: number } | null = null;
  for (const place of places) {
    const distanceM = Math.hypot(place.eastM - user.eastM, place.northM - user.northM);
    if (distanceM <= PLACE_ORIGIN_RADIUS_M && (!nearest || distanceM < nearest.distanceM)) {
      nearest = { name: place.name, distanceM };
    }
  }
  return nearest ? `${nearest.name}, chosen by hand` : 'The spot you chose by hand';
}

/** The street scene panel's text for the current state. */
export function panelLines(input: {
  view: StreetNavigationView;
  /** Current step's title and detail, from `stepLines`. */
  step: { title: string; detail: string };
  /** "6 steps · 640 m" for a ready route. */
  routeSummary: string;
  placeName: string | undefined;
  placeDetail: string | undefined;
  hasOrigin: boolean;
  mapStatus: StreetMapStatus;
  estimatedHeights: number;
}): { title: string; detail: string; status: string; attribution: string } {
  const attribution =
    input.mapStatus === 'no-token' || input.mapStatus === 'not-public' || input.mapStatus === 'off'
      ? 'Route © Mapbox © OpenStreetMap'
      : 'Buildings, imagery and route © Mapbox © OpenStreetMap · Imagery © Maxar';
  const status = mapLine(input.mapStatus, input.estimatedHeights);
  const place = input.placeName ?? (input.hasOrigin ? 'Harlem' : 'This place has no map point');
  const view = input.view;
  switch (view.status) {
    case 'navigating':
    case 'paused':
      return { title: input.step.title, detail: input.step.detail, status: `From ${view.origin.label} · ${status}`, attribution };
    case 'routeReady':
      return {
        title: `Walking route to ${place}`,
        detail: `${input.routeSummary} · Press Start to stand at the first step`,
        status: `From ${view.origin.label}`,
        attribution,
      };
    case 'calculatingRoute':
      return { title: place, detail: 'Finding a walking route from here', status, attribution };
    case 'rerouting':
      return { title: place, detail: 'Finding a new route', status, attribution };
    case 'arrived':
      return { title: place, detail: 'You have arrived', status, attribution };
    case 'error':
      return { title: place, detail: view.message, status, attribution };
    case 'unavailable':
      return { title: place, detail: input.placeDetail ?? 'Select a pillar to see a place', status: `${view.reason} · ${status}`, attribution };
    default:
      return { title: place, detail: input.placeDetail ?? 'Select a pillar to see a place', status, attribution };
  }
}

export function mapLine(status: StreetMapStatus, estimatedHeights: number): string {
  switch (status) {
    case 'no-token':
      return 'No Mapbox token in this build: real buildings and satellite ground are off';
    case 'not-public':
      return 'The Mapbox token is not a public pk. token: real buildings and satellite ground are off';
    case 'loading':
      return 'Loading buildings around you · Click the ground to move';
    case 'partial':
      return 'Some building tiles failed to load · Click the ground to move';
    case 'ready':
      return estimatedHeights > 0
        ? `${estimatedHeights} building heights estimated · Click the ground to move`
        : 'Click the ground to move';
    default:
      return 'Click the ground to move';
  }
}
