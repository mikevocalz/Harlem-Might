import type { GeographicCoordinate } from '../model/geo.ts';
import { routeSteps, type ExternalMapsHandoff, type Route, type RouteDestination, type TravelMode } from '../model/route.ts';
import { hasActiveTrip, type NavigationOrigin, type NavigationSession, type RouteFailureKind } from '../model/session.ts';
import type { NavigationState } from '../session/navigationStore.ts';
import { externalMapsLinks } from './externalLinks.ts';
import { formatArrivalClock, formatRouteDistance, formatRouteDuration, spokenRouteDuration } from './format.ts';
import type { LocationAvailability } from './locationSource.ts';
import { maneuverGlyph, stepInstruction, streetLabel, type ManeuverGlyph } from './maneuver.ts';
import type { OriginChoice } from './navigationUi.store.ts';

/** Words for each travel mode, as the mode picker and summaries print them. */
export const MODE_LABEL: Readonly<Record<TravelMode, string>> = {
  walking: 'Walk',
  cycling: 'Cycle',
  driving: 'Drive',
  transit: 'Transit',
};

/** The modes the picker offers, walking first: Harlem Might is a walking app. */
export const MODE_ORDER: readonly TravelMode[] = ['walking', 'transit', 'cycling', 'driving'];

/** One row of the turn-by-turn list. */
export interface StepRow {
  readonly index: number;
  readonly glyph: ManeuverGlyph;
  readonly instruction: string;
  /** Distance walked on this step, empty on the final `arrive` step. */
  readonly distanceText: string;
  readonly street: string;
  /** `passed` and `active` exist only during guidance. */
  readonly status: 'upcoming' | 'active' | 'passed';
}

/** One route in the overview, best first. */
export interface RouteOption {
  readonly index: number;
  readonly label: string;
  readonly durationText: string;
  readonly distanceText: string;
  /** "+3 min" against the first route; empty on the first. */
  readonly deltaText: string;
  readonly selected: boolean;
  readonly accessibilityLabel: string;
}

/** The destination as the destination row prints it. */
export interface DestinationLine {
  readonly name: string;
  /** "Main doors on West 125th Street", or where the route ends when no entrance is known. */
  readonly entranceText: string;
  readonly entranceVerified: boolean;
}

/**
 * The directions panel's state. Every screen in the spec has six states:
 * `default`, `loading`, `error`, `empty`, `success` and `offline`. `handoff`
 * is the transit answer (an honest "use another app", not an error), and
 * `guiding` is the panel while a trip is under way.
 */
export type DirectionsView =
  | { readonly kind: 'empty'; readonly title: string; readonly body: string }
  | {
      readonly kind: 'default';
      readonly origin: OriginView;
      readonly destination: DestinationLine;
      readonly mode: TravelMode;
      /** True when a route can be asked for now. */
      readonly canRequest: boolean;
      /** Set while guidance to another place is running; only one trip at a time. */
      readonly busyText?: string;
      readonly external: ExternalMapsHandoff;
    }
  | {
      readonly kind: 'loading';
      readonly mode: TravelMode;
      readonly originText: string;
      readonly destination: DestinationLine;
      readonly statusText: string;
    }
  | {
      readonly kind: 'error';
      readonly mode: TravelMode;
      readonly title: string;
      readonly body: string;
      readonly canRetry: boolean;
      readonly external: ExternalMapsHandoff;
    }
  | {
      readonly kind: 'offline';
      readonly mode: TravelMode;
      readonly title: string;
      readonly body: string;
      /** True after a request failed; before any request the panel recovers by itself when the network returns. */
      readonly canRetry: boolean;
      readonly external: ExternalMapsHandoff;
    }
  | {
      readonly kind: 'handoff';
      readonly mode: TravelMode;
      readonly title: string;
      readonly body: string;
      readonly external: ExternalMapsHandoff;
    }
  | {
      readonly kind: 'success';
      readonly mode: TravelMode;
      readonly originText: string;
      readonly destination: DestinationLine;
      readonly options: readonly RouteOption[];
      readonly summary: RouteSummary;
      readonly steps: readonly StepRow[];
      readonly external: ExternalMapsHandoff;
      /** Shown under Start when guidance cannot follow the person (no device location). */
      readonly guidanceNote?: string;
    }
  | {
      readonly kind: 'guiding';
      readonly mode: TravelMode;
      readonly destination: DestinationLine;
      readonly summary: RouteSummary;
      readonly steps: readonly StepRow[];
      readonly external: ExternalMapsHandoff;
    };

/** Time, distance and arrival for a route or for what is left of it. */
export interface RouteSummary {
  readonly durationText: string;
  readonly distanceText: string;
  readonly etaText: string;
  readonly accessibilityLabel: string;
}

/** The origin row before a route exists. */
export interface OriginView {
  readonly text: string;
  /** What to tell the person about device location, or nothing when it is fine. */
  readonly notice?: { readonly tone: 'info' | 'warning'; readonly text: string };
  /** Show "Use my location" (asks the platform). */
  readonly canAskLocation: boolean;
}

/** What the panel knows besides the stores. */
export interface DirectionsInput {
  /** The place the panel is for. `coordinate` is undefined when the catalogue has no verified point. */
  readonly place: { readonly id: string; readonly name: string; readonly coordinate?: GeographicCoordinate; readonly street?: string };
  readonly mode: TravelMode;
  readonly originChoice: OriginChoice;
  readonly location: LocationAvailability;
  readonly online: boolean | undefined;
  /** The latest device position, used only to start routes and external links. */
  readonly devicePosition?: GeographicCoordinate;
  /** Name of a place chosen as origin. */
  readonly originPlaceName?: string;
  readonly now: number;
  readonly locale?: string;
  readonly timeZone?: string;
}

/** The session's destination when it is this place, else undefined. */
function sessionForPlace(session: NavigationSession, placeId: string): NavigationSession | undefined {
  if (session.phase === 'error') return session.trip?.destination.placeId === placeId ? session : undefined;
  return 'destination' in session && session.destination.placeId === placeId ? session : undefined;
}

/** The {@linkcode RouteDestination} a catalogued place routes to. No entrance until the CMS holds one. */
export function destinationForPlace(place: DirectionsInput['place']): RouteDestination | undefined {
  if (!place.coordinate) return undefined;
  return { name: place.name, placeId: place.id, coordinate: place.coordinate };
}

export function destinationLine(destination: RouteDestination, street?: string): DestinationLine {
  const entrance = destination.entrance;
  if (entrance) {
    return {
      name: destination.name,
      entranceText: entrance.description ?? 'Route ends at the entrance on record',
      entranceVerified: entrance.source === 'cms-verified',
    };
  }
  return {
    name: destination.name,
    entranceText: street ? `No entrance on record. Route ends on ${street}.` : 'No entrance on record. Route ends at the building.',
    entranceVerified: false,
  };
}

export function originText(origin: NavigationOrigin): string {
  switch (origin.kind) {
    case 'device-location':
      return 'Your location';
    case 'companion-phone':
      return `Your location, from ${origin.deviceLabel}`;
    case 'manual':
      return `${origin.label} (chosen, not your location)`;
  }
}

export function routeSummary(durationS: number, distanceM: number, etaMs: number, input: Pick<DirectionsInput, 'locale' | 'timeZone'>): RouteSummary {
  const durationText = formatRouteDuration(durationS);
  const distanceText = formatRouteDistance(distanceM, input.locale);
  const etaText = formatArrivalClock(etaMs, input.locale, input.timeZone);
  return {
    durationText,
    distanceText,
    etaText,
    accessibilityLabel: `${spokenRouteDuration(durationS)}, ${distanceText}, arriving around ${etaText}`,
  };
}

/** The turn-by-turn rows for a route, with progress marks when guiding. */
export function stepRows(route: Route, activeStepIndex?: number, locale?: string): StepRow[] {
  return routeSteps(route).map((step) => ({
    index: step.index,
    glyph: maneuverGlyph(step.maneuver),
    instruction: stepInstruction(step),
    distanceText: step.maneuver.type === 'arrive' ? '' : formatRouteDistance(step.distanceM, locale),
    street: streetLabel(step.name),
    status:
      activeStepIndex === undefined
        ? 'upcoming'
        : step.index < activeStepIndex
          ? 'passed'
          : step.index === activeStepIndex
            ? 'active'
            : 'upcoming',
  }));
}

export function routeOptions(routes: readonly Route[], selectedIndex: number): RouteOption[] {
  const base = routes[0];
  return routes.map((route, index) => {
    const durationText = formatRouteDuration(route.durationS);
    const distanceText = formatRouteDistance(route.distanceM);
    const deltaMin = base ? Math.round((route.durationS - base.durationS) / 60) : 0;
    const deltaText = index === 0 ? '' : deltaMin > 0 ? `+${deltaMin} min` : deltaMin < 0 ? `${deltaMin} min` : 'Same time';
    const label = index === 0 ? 'Suggested' : `Alternative ${index}`;
    return {
      index,
      label,
      durationText,
      distanceText,
      deltaText,
      selected: index === selectedIndex,
      accessibilityLabel: `${label}: ${spokenRouteDuration(route.durationS)}, ${distanceText}${deltaText ? `, ${deltaText}` : ''}`,
    };
  });
}

const FAILURE_COPY: Readonly<Record<Exclude<RouteFailureKind, 'network'>, { title: string; body: string; canRetry: boolean }>> = {
  'no-route': {
    title: 'No route found',
    body: 'The route service found no path between these points. Try another way of getting there, or open another maps app.',
    canRetry: true,
  },
  unauthorized: {
    title: 'Directions are off in this build',
    body: 'The map key was refused, so routes can’t be drawn here. Another maps app can still take you there.',
    canRetry: false,
  },
  'missing-token': {
    title: 'Directions are off in this build',
    body: 'This build has no map key, so routes can’t be drawn here. Another maps app can still take you there.',
    canRetry: false,
  },
  'rate-limited': {
    title: 'Too many route requests',
    body: 'The route service asked us to slow down. Try again in a minute.',
    canRetry: true,
  },
  unavailable: {
    title: 'The route service didn’t answer',
    body: 'Try again. If it keeps failing, another maps app can take you there.',
    canRetry: true,
  },
  'invalid-request': {
    title: 'This trip can’t be routed',
    body: 'The start or end point isn’t on a street the route service knows. Another maps app may handle it.',
    canRetry: false,
  },
};

function transitHandoff(external: ExternalMapsHandoff): DirectionsView {
  return {
    kind: 'handoff',
    mode: 'transit',
    title: 'Transit directions open in another app',
    body: 'Harlem Might doesn’t plan subway and bus trips, so it won’t draw one. Apple Maps and Google Maps have live schedules for this trip.',
    external,
  };
}

const OFFLINE_COPY = {
  title: 'You’re offline',
  body: 'Routes need a connection. Connect and try again, or open a maps app that has offline maps.',
} as const;

function originView(input: DirectionsInput): OriginView {
  if (input.originChoice.kind === 'place') {
    return {
      text: `${input.originPlaceName ?? 'A chosen place'} (chosen, not your location)`,
      canAskLocation: input.location !== 'unsupported' && input.location !== 'denied',
    };
  }
  switch (input.location) {
    case 'unknown':
      return {
        text: 'Your location',
        notice: { tone: 'info', text: 'To start from where you are, allow location. Harlem Might uses it only for directions, only while the app is open, and never saves it.' },
        canAskLocation: true,
      };
    case 'granted':
      return input.devicePosition
        ? { text: 'Your location', canAskLocation: false }
        : { text: 'Your location', notice: { tone: 'info', text: 'Finding your location…' }, canAskLocation: false };
    case 'approximate':
      return {
        text: 'Your approximate location',
        notice: { tone: 'warning', text: 'Your location is approximate, so the route may start a block or two off. Turn on precise location for turn-by-turn guidance.' },
        canAskLocation: false,
      };
    case 'denied':
      return {
        text: 'Location is off for Harlem Might',
        notice: { tone: 'warning', text: 'Location access was declined. Turn it on in Settings, or start from a place below.' },
        canAskLocation: false,
      };
    case 'disabled':
      return {
        text: 'Location services are off',
        notice: { tone: 'warning', text: 'Your device couldn’t find a position. Turn on location services, or start from a place below.' },
        canAskLocation: true,
      };
    case 'unsupported':
      return {
        text: 'Location isn’t available here',
        notice: { tone: 'info', text: 'This device can’t share its location with Harlem Might. Start from a place below.' },
        canAskLocation: false,
      };
  }
}

/** The start point the request would use now, or undefined when it is not known yet. */
export function plannedOriginCoordinate(input: DirectionsInput, originPlaceCoordinate?: GeographicCoordinate): GeographicCoordinate | undefined {
  if (input.originChoice.kind === 'place') return originPlaceCoordinate;
  return input.location === 'granted' || input.location === 'approximate' ? input.devicePosition : undefined;
}

/**
 * Derives the directions panel from the navigation stores and screen
 * state. Pure, so each of the panel's states is a test case.
 */
export function directionsView(state: NavigationState, input: DirectionsInput, originPlaceCoordinate?: GeographicCoordinate): DirectionsView {
  const destination = destinationForPlace(input.place);
  if (!destination) {
    return {
      kind: 'empty',
      title: 'No directions yet',
      body: 'This place has no verified location, so there’s nothing to route to. Its location is being checked.',
    };
  }
  const session = sessionForPlace(state.session, input.place.id);
  const plannedOrigin = plannedOriginCoordinate(input, originPlaceCoordinate);
  const external = externalMapsLinks(destination, input.mode, plannedOrigin);
  const line = destinationLine(destination, input.place.street);

  if (session && hasActiveTrip(session)) {
    const { route } = session.activeRoute;
    const progress = state.progress.kind === 'tracking' && state.progress.progress.routeId === route.id ? state.progress.progress : undefined;
    const remainingS = progress?.durationRemainingS ?? route.durationS;
    const remainingM = progress?.distanceRemainingM ?? route.distanceM;
    return {
      kind: 'guiding',
      mode: session.mode,
      destination: destinationLine(session.destination, input.place.street),
      summary: routeSummary(remainingS, remainingM, progress?.etaMs ?? input.now + remainingS * 1000, input),
      steps: stepRows(route, progress?.activeStepIndex ?? 0, input.locale),
      external,
    };
  }

  if (session?.phase === 'calculatingRoute') {
    return {
      kind: 'loading',
      mode: session.mode,
      originText: originText(session.origin),
      destination: line,
      statusText: `Finding a ${MODE_LABEL[session.mode].toLowerCase()} route…`,
    };
  }

  if (session?.phase === 'routeReady') {
    const route = session.routes[session.selectedRouteIndex] ?? session.routes[0];
    const withoutDevice = session.origin.kind === 'manual' || (input.location !== 'granted' && input.location !== 'approximate');
    return {
      kind: 'success',
      mode: session.mode,
      originText: originText(session.origin),
      destination: destinationLine(session.destination, input.place.street),
      options: routeOptions(session.routes, session.selectedRouteIndex),
      summary: routeSummary(route.durationS, route.distanceM, input.now + route.durationS * 1000, input),
      steps: stepRows(route, undefined, input.locale),
      external,
      ...(withoutDevice
        ? { guidanceNote: 'Without your location, guidance shows the steps but can’t follow you or tell you when to turn.' }
        : {}),
    };
  }

  if (session?.phase === 'error') {
    const error = session.error;
    const mode = session.trip?.mode ?? input.mode;
    if (error.kind === 'unsupported-mode') return transitHandoff(error.handoff);
    if (error.kind === 'route-failed') {
      if (error.reason === 'network' || input.online === false) return { kind: 'offline', mode, ...OFFLINE_COPY, canRetry: true, external };
      return { kind: 'error', mode, ...FAILURE_COPY[error.reason], external };
    }
    return {
      kind: 'error',
      mode,
      title: 'Location problem',
      body: error.message,
      canRetry: true,
      external,
    };
  }

  // No session for this place yet: the picker. Transit never reaches a
  // provider: every adapter answers `unsupported`, so the handoff is shown
  // straight away instead of a request that can only say no.
  if (input.mode === 'transit') return transitHandoff(external);
  if (input.online === false) return { kind: 'offline', mode: input.mode, ...OFFLINE_COPY, canRetry: false, external };
  const other = hasActiveTrip(state.session) ? state.session.destination.name : undefined;
  return {
    kind: 'default',
    origin: originView(input),
    destination: line,
    mode: input.mode,
    canRequest: plannedOrigin !== undefined && other === undefined,
    ...(other ? { busyText: `You’re on your way to ${other}. End that trip to get directions here.` } : {}),
    external,
  };
}
