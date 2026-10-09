import { projectOntoSegment, type ProjectedPolyline } from '../geo/polyline.ts';
import type { RouteMatch } from '../model/location.ts';
import type { RouteProgress } from '../model/progress.ts';
import { routeSteps, type Route, type RouteStep } from '../model/route.ts';

/**
 * Per-route lookup from along-track distance to step. Built once per route.
 *
 * Each step starts where its maneuver location lies on the route geometry.
 * Starts never decrease, and where the route passes the same point twice the
 * provider's cumulative step distances pick the right pass.
 */
export interface StepIndex {
  readonly route: Route;
  readonly steps: readonly RouteStep[];
  /** Along-track metres where each step starts. Non-decreasing. */
  readonly startsM: readonly number[];
  /** Length of the projected geometry in metres. */
  readonly geometryLengthM: number;
}

/** Builds a {@linkcode StepIndex} for `route` on its projected polyline. */
export function createStepIndex(route: Route, polyline: ProjectedPolyline): StepIndex {
  const steps = routeSteps(route);
  if (steps.length === 0) throw new RangeError('route has no steps');
  // Provider metres → geometry metres, for the along-track hint below.
  const toGeometry = route.distanceM > 0 ? polyline.lengthM / route.distanceM : 1;
  const startsM: number[] = [];
  let floor = 0;
  let providerSum = 0;
  for (const step of steps) {
    const point = polyline.frame.toLocal(step.maneuver.location);
    const expected = providerSum * toGeometry;
    // Maneuver locations are geometry vertices, but a route that walks the
    // same pavement twice (out and back) touches each of them twice. Among
    // the segments within 2 m, take the one nearest the along-track position
    // the provider's own step distances predict.
    let best: { along: number; score: number } | undefined;
    let nearest: { along: number; distance: number } | undefined;
    for (let i = 0; i < polyline.segmentCount; i += 1) {
      const p = projectOntoSegment(polyline, i, point);
      if (p.alongTrackM < floor - 1e-6) continue;
      if (!nearest || p.distanceM < nearest.distance) nearest = { along: p.alongTrackM, distance: p.distanceM };
      if (p.distanceM <= 2) {
        const score = Math.abs(p.alongTrackM - expected);
        if (!best || score < best.score) best = { along: p.alongTrackM, score };
      }
    }
    const start = Math.max(floor, best?.along ?? nearest?.along ?? floor);
    startsM.push(start);
    floor = start;
    providerSum += step.distanceM;
  }
  startsM[0] = 0;
  return { route, steps, startsM, geometryLengthM: polyline.lengthM };
}

/** Index of the step containing `alongTrackM`. */
export function activeStepIndexAt(index: StepIndex, alongTrackM: number): number {
  let active = 0;
  for (let i = 0; i < index.startsM.length; i += 1) {
    // A zero-length arrive step shares its start with the route end; it only
    // becomes active once the person reaches that point.
    if (index.startsM[i]! <= alongTrackM + 1e-6) active = i;
    else break;
  }
  return active;
}

/**
 * Progress along the route for a matched position.
 *
 * Remaining duration uses the provider's per-step durations: the unwalked
 * share of the active step plus every later step. That keeps the provider's
 * walking speed (and slower stretches such as crossings) instead of a single
 * average.
 *
 * @throws {RangeError} When `match` is not `matched`.
 */
export function computeRouteProgress(index: StepIndex, match: RouteMatch): RouteProgress {
  if (match.kind !== 'matched') throw new RangeError('progress needs a matched position');
  const { route, steps, startsM } = index;
  const routeLength = Math.max(route.distanceM, 1e-6);
  // Geometry length and provider distance differ by rounding; scale along-track to provider metres.
  const geometryEnd = Math.max(index.geometryLengthM, 1e-6);
  const scale = route.distanceM / geometryEnd;
  const along = Math.min(Math.max(match.alongTrackM, 0), geometryEnd);
  const activeStepIndex = activeStepIndexAt(index, along);
  const activeStep = steps[activeStepIndex]!;
  const stepStart = startsM[activeStepIndex]!;
  const stepEnd = startsM[activeStepIndex + 1] ?? geometryEnd;
  const stepLength = Math.max(stepEnd - stepStart, 1e-6);
  const stepFractionLeft = Math.min(1, Math.max(0, (stepEnd - along) / stepLength));

  let durationRemainingS = activeStep.durationS * stepFractionLeft;
  for (let i = activeStepIndex + 1; i < steps.length; i += 1) durationRemainingS += steps[i]!.durationS;

  const travelled = Math.min(route.distanceM, along * scale);
  const remaining = Math.max(0, route.distanceM - travelled);
  const nextStep = steps[activeStepIndex + 1];
  return {
    routeId: route.id,
    distanceTravelledM: travelled,
    distanceRemainingM: remaining,
    fractionTravelled: travelled / routeLength,
    durationRemainingS,
    etaMs: match.timestampMs + durationRemainingS * 1000,
    activeStepIndex,
    activeStep,
    ...(nextStep ? { nextManeuver: nextStep.maneuver } : {}),
    distanceToNextManeuverM: Math.max(0, (stepEnd - along) * scale),
    timestampMs: match.timestampMs,
  };
}
