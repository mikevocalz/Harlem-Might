import { routeSteps } from '../model/route.ts';
import { hasActiveTrip, type ActiveSession } from '../model/session.ts';
import type { NavigationState } from '../session/navigationStore.ts';
import { formatRouteDistance } from './format.ts';
import { routeSummary, type RouteSummary } from './directionsView.ts';
import type { LocationAvailability } from './locationSource.ts';
import { GLYPH_LABEL, maneuverGlyph, stepInstruction, streetLabel, type ManeuverGlyph } from './maneuver.ts';

/** A line the HUD shows above the controls. Ordered most urgent first. */
export interface HudNotice {
  readonly id: 'too-fast' | 'reroute-failed' | 'gps-acquiring' | 'gps-lost' | 'gps-low' | 'no-location' | 'awareness';
  readonly tone: 'warning' | 'info';
  readonly text: string;
  /** The awareness notice has an "OK" that dismisses it for the trip. */
  readonly dismissible: boolean;
}

/** The next action, as the top of the HUD draws it. */
export interface HudManeuver {
  readonly glyph: ManeuverGlyph;
  readonly instruction: string;
  /** "In 80 m", or empty before the first matched position. */
  readonly distanceText: string;
  /** Street the person is on now. */
  readonly street: string;
  readonly accessibilityLabel: string;
}

/** What arrival says, depending on how sure the position is. */
export interface ArrivalView {
  readonly title: string;
  readonly body: string;
  readonly confidence: 'confirmed' | 'estimated';
  readonly placeId?: string;
  readonly placeName: string;
}

/** The compact guidance HUD over the map. */
export type HudView =
  | { readonly kind: 'hidden' }
  | {
      readonly kind: 'guiding' | 'rerouting' | 'paused';
      readonly maneuver: HudManeuver;
      readonly remaining: RouteSummary;
      readonly notices: readonly HudNotice[];
      /** Announced politely when it changes: reroute started or finished, paused. */
      readonly statusText: string;
      readonly generation: number;
    }
  | { readonly kind: 'arrived'; readonly arrival: ArrivalView };

export interface HudInput {
  readonly location: LocationAvailability;
  readonly awarenessAcknowledged: boolean;
  readonly now: number;
  readonly locale?: string;
  readonly timeZone?: string;
}

function notices(state: NavigationState, session: ActiveSession, input: HudInput): HudNotice[] {
  const list: HudNotice[] = [];
  const positioning = state.positioning;
  if (positioning.kind === 'tracking' && positioning.isMovingTooFast) {
    list.push({
      id: 'too-fast',
      tone: 'warning',
      text: 'You’re moving faster than walking pace. If you’re in a vehicle, stop using guidance until you’re on foot.',
      dismissible: false,
    });
  }
  if (session.reroute.kind === 'failed') {
    list.push({
      id: 'reroute-failed',
      tone: 'warning',
      text: 'Couldn’t find a new route. Keep to the line, or end and plan again.',
      dismissible: false,
    });
  }
  if (input.location === 'unsupported' || input.location === 'denied' || input.location === 'disabled' || session.origin.kind === 'manual') {
    list.push({
      id: 'no-location',
      tone: 'info',
      text: 'Guidance can’t see your location, so it won’t follow you. Use the steps to find your way.',
      dismissible: false,
    });
  } else if (positioning.kind === 'acquiring') {
    list.push({ id: 'gps-acquiring', tone: 'info', text: 'Finding your location…', dismissible: false });
  } else if (positioning.kind === 'lost') {
    list.push({ id: 'gps-lost', tone: 'warning', text: 'Location signal lost. Your position on the map may be out of date.', dismissible: false });
  } else if (positioning.kind === 'tracking' && positioning.confidence === 'low') {
    list.push({
      id: 'gps-low',
      tone: 'info',
      text: `Weak location signal, accurate to about ${formatRouteDistance(positioning.sigmaM, input.locale)}.`,
      dismissible: false,
    });
  }
  if (!input.awarenessAcknowledged) {
    list.push({
      id: 'awareness',
      tone: 'info',
      text: 'Watch the street, not the screen. Check traffic before crossing; directions can be wrong.',
      dismissible: true,
    });
  }
  return list;
}

function arrivalView(session: ActiveSession): ArrivalView | undefined {
  if (session.arrival.kind !== 'arrived') return undefined;
  const name = session.destination.name;
  const entrance = session.destination.entrance?.description;
  if (session.arrival.confidence === 'confirmed') {
    return {
      title: `You’ve arrived at ${name}`,
      body: entrance ? `The entrance: ${entrance}.` : 'The entrance should be in front of you.',
      confidence: 'confirmed',
      ...(session.destination.placeId ? { placeId: session.destination.placeId } : {}),
      placeName: name,
    };
  }
  return {
    title: `You should be near ${name}`,
    body: `Your location is approximate, so look around for it${entrance ? `. The entrance: ${entrance}.` : '.'}`,
    confidence: 'estimated',
    ...(session.destination.placeId ? { placeId: session.destination.placeId } : {}),
    placeName: name,
  };
}

/** Derives the HUD from the stores. Pure; each state is a test case. */
export function hudView(state: NavigationState, input: HudInput): HudView {
  const session = state.session;
  if (!hasActiveTrip(session)) return { kind: 'hidden' };
  if (session.phase === 'arrived') {
    const arrival = arrivalView(session);
    if (arrival) return { kind: 'arrived', arrival };
  }

  const { route, generation } = session.activeRoute;
  const steps = routeSteps(route);
  const progress =
    state.progress.kind === 'tracking' && state.progress.progress.routeId === route.id ? state.progress.progress : undefined;
  const active = progress?.activeStep ?? steps[0]!;
  const next = progress ? progress.nextManeuver : steps[1]?.maneuver ?? steps[0]!.maneuver;
  const nextStep = next ? steps.find((step) => step.maneuver === next) : undefined;
  const glyph = next ? maneuverGlyph(next) : 'arrive';
  const instruction = nextStep ? stepInstruction(nextStep) : `Arrive at ${session.destination.name}`;
  const distanceText = progress ? `In ${formatRouteDistance(progress.distanceToNextManeuverM, input.locale)}` : '';
  const street = streetLabel(active.name);

  const remainingS = progress?.durationRemainingS ?? route.durationS;
  const remainingM = progress?.distanceRemainingM ?? route.distanceM;
  const remaining = routeSummary(remainingS, remainingM, progress?.etaMs ?? input.now + remainingS * 1000, input);

  const rerouting = session.phase === 'rerouting' || (state.routeLoading.kind === 'loading' && state.routeLoading.purpose === 'reroute');
  const kind = session.phase === 'paused' ? 'paused' : rerouting ? 'rerouting' : 'guiding';
  const statusText =
    kind === 'paused'
      ? 'Guidance paused.'
      : kind === 'rerouting'
        ? 'Off route. Finding a new route…'
        : generation > 1
          ? 'New route found.'
          : '';

  return {
    kind,
    maneuver: {
      glyph,
      instruction,
      distanceText,
      street,
      accessibilityLabel: `${distanceText ? `${distanceText}, ` : ''}${instruction || GLYPH_LABEL[glyph]}. Now on ${street}.`,
    },
    remaining,
    notices: notices(state, session, input),
    statusText,
    generation,
  };
}
