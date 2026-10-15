import type { ExplorePlace } from '../explore/explore.store.ts';
import type { NavigationState } from '../navigation/session/navigationStore.ts';

/**
 * Native Specs receives a tiny, serializable projection of the same
 * catalogue and navigation state that power phone, web and Quest.
 * Lens Studio does NOT execute this TypeScript or React Native.
 */
export type SpecsSceneNode = {
  id: string;
  kind: 'group' | 'panel' | 'text' | 'image' | 'model';
  parentId?: string;
  position?: [number, number, number];
  rotation?: [number, number, number, number];
  scale?: [number, number, number];
  text?: string;
  source?: string;
  visible?: boolean;
};

export type SpecsPresentation = {
  scene: { version: 1; nodes: SpecsSceneNode[] };
  targets: { targetId: string; action: string }[];
};

export type SpecsGeoPoint = {
  latitude: number;
  longitude: number;
};

export type SpecsRouteProjection = {
  /** Changed when the canonical navigation controller reroutes. */
  generation: number;
  plan: {
    route: {
      id: string;
      points: readonly SpecsGeoPoint[];
      destination: { id: string; name: string; coordinate: SpecsGeoPoint };
    };
    line: { widthMeters: number };
    packages: readonly ['SpecsNavigationKit', 'VolumetricLine'];
  };
};

/** Scene, semantic actions, and separately permission-gated world route. */
export type HarlemSpecsFrame = SpecsPresentation & {
  view: 'discover' | 'place' | 'route-ready' | 'walking' | 'arrival' | 'error';
  navigation?: SpecsRouteProjection;
};

export type HarlemSpecsInput = {
  places: readonly ExplorePlace[];
  selectedPlaceId?: string | null;
  navigation: NavigationState;
  /** Clock from the caller. If absent, the route overlay is never trusted. */
  nowMs?: number;
};

function summary(value: string | undefined, max = 54): string {
  if (!value) return '';
  const printable = value.replace(/\s+/g, ' ').trim();
  return Array.from(printable).length <= max
    ? printable
    : Array.from(printable).slice(0, max - 1).join('') + '…';
}

function validPoint(latitude: number, longitude: number): boolean {
  return Number.isFinite(latitude) && Number.isFinite(longitude) &&
    Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180;
}

function hasRoutableCoordinate(place: ExplorePlace): boolean {
  const point = place.lngLat;
  return Boolean(point && validPoint(point[1], point[0]));
}

type Action = { label: string; command: string };

type Vec3 = [number, number, number];

/**
 * Calibrations shared with the Lens entry script (HarlemMightSpecsEntry.ts).
 * A UI Kit BackPlate is 24 x 12 cm at scale 1. Buttons are 32 x 7 cm, the
 * walking card is 40 x 16 cm and the main frame is 50 cm wide.
 */
export const SPECS_BACKPLATE_M = { width: 0.24, height: 0.12 } as const;
export const SPECS_FRAME_SCALE: Vec3 = [2.08, 4, 1];
export const SPECS_WALK_FRAME_SCALE: Vec3 = [1.67, 1.33, 1];
export const SPECS_BUTTON_SCALE: Vec3 = [1.33, 0.58, 1];

const BUTTON_HALF_HEIGHT = (SPECS_BACKPLATE_M.height * SPECS_BUTTON_SCALE[1]) / 2;
// Room above the title and below the last button, so text and button plates
// never reach the frame edge.
const FRAME_MARGIN = 0.045;
// Centre-to-centre gap between buttons, as in the entry script. The 1.5 cm
// gap keeps neighbouring colliders from touching.
const BUTTON_SPACING = 0.085;

/**
 * Only one primary reading surface is exposed at a time.
 * Unlike Quest's three-panel workspace, walking swaps the large frame for the
 * small walking card above eye level, leaving the lower view to the route.
 */
function compose(
  view: HarlemSpecsFrame['view'],
  title: string,
  subtitle: string,
  actions: readonly Action[],
): HarlemSpecsFrame {
  const walking = view === 'walking';
  const shown = actions.slice(0, walking ? 1 : 4);
  const titleY = walking ? 0.045 : 0.15;
  const subtitleY = walking ? 0.005 : 0.075;
  const actionY = (i: number) => walking ? -0.052 : -0.005 - i * BUTTON_SPACING;

  const nodes: SpecsSceneNode[] = [{
    id: 'hm-root', kind: 'group', position: [0, walking ? 0.15 : -0.06, -1.1],
  }];
  if (walking) {
    // Same card and offset as the entry script's walking card: 40 x 16 cm,
    // spanning y 0.07 to -0.09 under hm-root.
    nodes.push({
      id: 'hm-backplate', kind: 'panel', parentId: 'hm-root',
      position: [0, -0.01, 0], scale: SPECS_WALK_FRAME_SCALE,
    });
  } else {
    // The frame keeps the calibrated 50 cm width and grows to the content:
    // from the title down to the bottom edge of the last button.
    const top = titleY + FRAME_MARGIN;
    const bottom = shown.length
      ? actionY(shown.length - 1) - BUTTON_HALF_HEIGHT - FRAME_MARGIN
      : (subtitle ? subtitleY : titleY) - FRAME_MARGIN;
    nodes.push({
      id: 'hm-backplate', kind: 'panel', parentId: 'hm-root',
      position: [0, (top + bottom) / 2, 0],
      scale: [SPECS_FRAME_SCALE[0], (top - bottom) / SPECS_BACKPLATE_M.height, 1],
    });
  }
  nodes.push({
    id: 'hm-title', kind: 'text', parentId: 'hm-root',
    text: summary(title, 40), position: [0, titleY, 0.025],
  });
  if (subtitle) {
    nodes.push({
      id: 'hm-subtitle', kind: 'text', parentId: 'hm-root',
      text: summary(subtitle, walking ? 43 : 55),
      position: [0, subtitleY, 0.026],
    });
  }
  const targets: SpecsPresentation['targets'] = [];
  for (const [i, item] of shown.entries()) {
    const id = `hm-action-${i}`;
    nodes.push({
      id, kind: 'group', parentId: 'hm-root',
      position: [0, actionY(i), 0.035],
    });
    // SIK fits the target's collider to its first visual child, so the plate
    // comes first and the whole 32 x 7 cm plate is pinchable. The label is the
    // plate's sibling so it does not inherit the plate's non-uniform scale.
    nodes.push({
      id: `${id}-plate`, kind: 'panel', parentId: id, scale: SPECS_BUTTON_SCALE,
    });
    nodes.push({
      id: `${id}-label`, kind: 'text', parentId: id,
      text: summary(item.label, 34), position: [0, 0, 0.008],
    });
    targets.push({ targetId: id, action: item.command });
  }
  return { view, scene: { version: 1, nodes }, targets };
}

/** Derive one on-glasses page without another navigation or catalogue store. */
export function projectHarlemSpecs(input: HarlemSpecsInput): HarlemSpecsFrame {
  const session = input.navigation.session;
  const active = 'activeRoute' in session ? session : undefined;
  const destination = active?.destination;

  if (session.phase === 'arrived' && destination) {
    const message = session.arrival.kind === 'arrived' && session.arrival.confidence === 'confirmed'
      ? 'You have arrived'
      : 'You may be near your destination';
    return compose('arrival', destination.name, message, [
      ...(destination.placeId ? [{
        label: 'Explore this place',
        command: `place:${encodeURIComponent(destination.placeId)}`,
      }] : []),
      { label: 'End walk', command: 'end-navigation' },
    ]);
  }

  if (active) {
    if (session.phase === 'paused') {
      return compose('walking', 'Walk paused', destination?.name ?? '', [
        { label: 'Resume walk', command: 'resume-navigation' },
      ]);
    }

    const position = input.navigation.positioning;
    const progress = input.navigation.progress.kind === 'tracking'
      ? input.navigation.progress.progress : undefined;
    const ageMs = progress && input.nowMs !== undefined
      ? input.nowMs - progress.timestampMs : Number.POSITIVE_INFINITY;
    const accurate = position.kind === 'tracking' &&
      position.confidence !== 'low' && !position.isMovingTooFast;
    const fresh = Boolean(progress && ageMs >= 0 && ageMs <= 20_000);
    const label = position.kind === 'tracking' && position.isMovingTooFast
      ? 'Stop walking to use controls'
      : !accurate || !fresh || !progress
        ? 'Locating your next turn'
        : progress.nextManeuver?.instruction ??
          progress.activeStep.maneuver.instruction;

    const frame = compose('walking', destination?.name ?? 'Your walk', label, [
      { label: 'End walk', command: 'end-navigation' },
    ]);

    const route = active.activeRoute.route;
    const points = route.geometry.coordinates;
    const geometryValid = points.length >= 2 &&
      points.every(p => validPoint(p.latitude, p.longitude));
    const routeTarget = destination?.entrance?.coordinate ?? destination?.coordinate;
    const destinationValid = routeTarget !== undefined &&
      validPoint(routeTarget.latitude, routeTarget.longitude);
    const canAnchorRoute = session.phase === 'navigatingAR' &&
      input.navigation.arTracking.kind === 'normal' &&
      accurate && fresh && progress !== undefined &&
      progress.routeId === route.id &&
      route.mode === 'walking' && geometryValid && destinationValid;

    if (canAnchorRoute) {
      frame.navigation = {
        generation: active.activeRoute.generation,
        plan: {
          route: {
            id: `${route.id}#${active.activeRoute.generation}`,
            points: points.map(p => ({ latitude: p.latitude, longitude: p.longitude })),
            destination: {
              id: destination?.placeId ?? 'destination',
              name: destination?.name ?? 'Destination',
              coordinate: {
                latitude: routeTarget!.latitude,
                longitude: routeTarget!.longitude,
              },
            },
          },
          line: { widthMeters: 0.04 },
          packages: ['SpecsNavigationKit', 'VolumetricLine'],
        },
      };
    }
    return frame;
  }

  if (session.phase === 'routeReady') {
    return compose('route-ready', session.destination.name, 'Route ready', [
      { label: 'Start walk', command: 'start-navigation' },
      { label: 'Back', command: 'close-directions' },
    ]);
  }

  if (session.phase === 'error') {
    return compose('error', 'Directions unavailable', summary(session.error.message), [
      { label: 'Back', command: 'close-directions' },
    ]);
  }

  const selected = input.selectedPlaceId
    ? input.places.find(place => place.id === input.selectedPlaceId)
    : undefined;
  if (input.selectedPlaceId) {
    if (!selected) {
      return compose('error', 'Place not found', 'Try selecting another place.', [
        { label: 'Explore', command: 'close-place' },
      ]);
    }
    return compose('place', selected.name, selected.shortDescription ??
      [selected.category, selected.area].filter(Boolean).join(' · '), [
      ...(hasRoutableCoordinate(selected) ? [{
        label: 'Directions',
        command: `directions:${encodeURIComponent(selected.id)}`,
      }] : []),
      { label: 'Back to Explore', command: 'close-place' },
    ]);
  }

  const entries = input.places.slice(0, 4);
  return compose('discover', 'Harlem Might', entries.length
    ? 'Explore places in Harlem' : 'No places loaded yet', entries.map((place) => ({
    label: place.name,
    command: `place:${encodeURIComponent(place.id)}`,
  })));
}
