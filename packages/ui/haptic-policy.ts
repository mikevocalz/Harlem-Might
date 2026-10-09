/**
 * Haptic UX policy, independent of Pulsar/native modules and testable in Node.
 * Routing must always have visible/audio directions; haptics are optional.
 */
export type HapticMoment =
  | 'tap' | 'selection' | 'success' | 'warning'
  | 'walkStarted' | 'approachingTurn' | 'landmarkNearby'
  | 'arrived' | 'stopConfirmed' | 'tourCompleted' | 'routeChanged';

export const HAPTIC_COOLDOWN_MS: Readonly<Record<HapticMoment, number>> = {
  tap: 80, selection: 100, success: 400, warning: 1500,
  walkStarted: 3000, approachingTurn: 3000, landmarkNearby: 60000,
  arrived: 15000, stopConfirmed: 2000, tourCompleted: 15000, routeChanged: 5000,
};

export interface HapticDecision {
  moment: HapticMoment;
  now: number;
  lastPlayedAt?: number;
  enabled: boolean;
  foreground: boolean;
}

/** No background loops, repeated location pinging, or surprise haptics. */
export function shouldPlayHaptic({ moment, now, lastPlayedAt, enabled, foreground }: HapticDecision): boolean {
  if (!enabled || !foreground || !Number.isFinite(now)) return false;
  if (lastPlayedAt === undefined) return true;
  return now - lastPlayedAt >= HAPTIC_COOLDOWN_MS[moment];
}
