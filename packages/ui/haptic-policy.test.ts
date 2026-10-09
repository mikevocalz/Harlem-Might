import assert from 'node:assert/strict';
import test from 'node:test';
import { shouldPlayHaptic, HAPTIC_COOLDOWN_MS } from './haptic-policy.ts';

test('haptics are always optional and foreground only', () => {
  const basic = { moment: 'approachingTurn' as const, now: 10000, foreground: true, enabled: true };
  assert.equal(shouldPlayHaptic(basic), true);
  assert.equal(shouldPlayHaptic({ ...basic, enabled: false }), false);
  assert.equal(shouldPlayHaptic({ ...basic, foreground: false }), false);
});

test('landmark and turn cues have distinct cooldowns', () => {
  const basic = { moment: 'landmarkNearby' as const, now: 80000, lastPlayedAt: 50000, enabled: true, foreground: true };
  assert.equal(shouldPlayHaptic(basic), false);
  assert.equal(shouldPlayHaptic({...basic, now: 110000}), true);
  assert.equal(HAPTIC_COOLDOWN_MS.approachingTurn < HAPTIC_COOLDOWN_MS.landmarkNearby, true);
});

test('clock reversal never bypasses cue cooldown', () => {
  assert.equal(shouldPlayHaptic({
    moment: 'arrived', now: 100, lastPlayedAt: 200,
    enabled: true, foreground: true,
  }), false);
});
