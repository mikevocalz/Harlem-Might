import type { HeadingEstimate } from '@acme/app/features/navigation/model/location.ts';
import type { PositioningState } from '@acme/app/features/navigation/model/progress.ts';
import type { ArTrackingState } from '@acme/app/features/navigation/model/session.ts';
import { arrowRotationDeg, isFreshSample, MAX_HEADING_AGE_MS, MAX_MATCH_AGE_MS, relativeDirection } from './navAr';

/** A fallback arrow is relative to the phone, never its course over ground. */
export function navigationArrow(input: {
  readonly bearingDeg: number | undefined;
  readonly heading: HeadingEstimate | undefined;
  readonly positioning: PositioningState;
  readonly isMatched: boolean;
  readonly matchTimestampMs: number | undefined;
  readonly nowMs: number;
}): { readonly rotationDeg: number; readonly instruction: string } | undefined {
  const { heading, positioning, nowMs } = input;
  if (input.bearingDeg === undefined || !Number.isFinite(input.bearingDeg) || !heading ||
    !Number.isFinite(heading.headingDeg) || heading.confidence === 'low' || heading.source === 'course-over-ground' ||
    !isFreshSample(heading.timestampMs, nowMs, MAX_HEADING_AGE_MS) || !input.isMatched ||
    !isFreshSample(input.matchTimestampMs, nowMs, MAX_MATCH_AGE_MS) ||
    positioning.kind !== 'tracking' || positioning.confidence === 'low' || positioning.isMovingTooFast) return undefined;
  const rotationDeg = arrowRotationDeg(input.bearingDeg, heading)!;
  const instructions = {
    ahead: 'The route continues ahead.',
    left: 'The route continues to your left.',
    right: 'The route continues to your right.',
    behind: 'The route continues behind you. Stop somewhere safe before turning around.',
  };
  return { rotationDeg, instruction: instructions[relativeDirection(rotationDeg)] };
}

/** Recovery copy is independent of decorative arrows, so it works with a screen reader. */
export function navigationArRecovery(input: {
  readonly positioning: PositioningState;
  readonly arTracking: ArTrackingState;
  readonly hasDirection: boolean;
}): { readonly title: string; readonly body: string } | undefined {
  const { positioning, arTracking } = input;
  if (arTracking.kind === 'unavailable') {
    return arTracking.reason === 'permission-denied'
      ? { title: 'Camera access is off', body: 'Continue on the map. You can enable camera access in Settings before opening AR again.' }
      : { title: 'AR is unavailable', body: 'Continue on the map. Your walking route is still available.' };
  }
  if (positioning.kind === 'lost') return {
    title: 'Location lost', body: 'Stop somewhere safe while your location returns. Check the map before continuing.',
  };
  if (positioning.kind === 'acquiring') return {
    title: 'Finding your location', body: 'Wait somewhere safe for a location fix. You can return to the map at any time.',
  };
  if (positioning.confidence === 'low') return {
    title: 'Location is uncertain', body: 'Tall buildings can affect GPS. Check street signs and the map before continuing.',
  };
  if (arTracking.kind === 'limited') return {
    title: 'Realign the camera',
    body: arTracking.reason === 'excessive-motion'
      ? 'Stop somewhere safe and move the phone slowly. Recalibrate if the route stays out of place.'
      : 'Point the phone toward nearby buildings and move it slowly. Recalibrate if the route stays out of place.',
  };
  if (!input.hasDirection) return {
    title: 'Direction is uncertain', body: 'No directional arrow is available. Hold the phone up away from metal, or use the map.',
  };
  return undefined;
}
