/** Wraps any finite angle in degrees into 0 ≤ value < 360. */
export function normalizeDegrees(degrees: number): number {
  if (!Number.isFinite(degrees)) throw new RangeError('degrees must be finite');
  const wrapped = degrees % 360;
  const positive = wrapped < 0 ? wrapped + 360 : wrapped;
  // -0 and 360 - epsilon rounding both land on 360 for tiny negatives.
  return positive >= 360 ? 0 : positive + 0;
}

/**
 * Signed shortest rotation from `fromDeg` to `toDeg`, in -180 < value ≤ 180.
 * Positive is clockwise (a right turn for a compass bearing).
 */
export function signedDeltaDegrees(fromDeg: number, toDeg: number): number {
  const delta = normalizeDegrees(toDeg - fromDeg);
  return delta > 180 ? delta - 360 : delta;
}

/** Unsigned smallest angle between two bearings, 0..180. */
export function angleBetweenDegrees(a: number, b: number): number {
  return Math.abs(signedDeltaDegrees(a, b));
}

/** Compass bearing of an east/north vector, degrees clockwise from north. */
export function bearingOfVector(eastM: number, northM: number): number {
  return normalizeDegrees((Math.atan2(eastM, northM) * 180) / Math.PI);
}

export const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;
export const toDegrees = (radians: number): number => (radians * 180) / Math.PI;
