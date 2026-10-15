import assert from 'node:assert/strict';
import { it } from 'node:test';
import { applyJourneyNavigationCommand } from './navigation-effects.ts';
import type { NavigationSession } from '../navigation/model/session.ts';
import type { LocationAvailability } from '../navigation/view/locationSource.ts';
const session = { phase: 'paused', destination: { placeId: 'apollo' }, origin: { kind: 'device-location' }, activeRoute: {} } as NavigationSession;
function setup(type = 'resume') {
  const calls: string[] = [];
  return { calls, input: { type, targetSlug: 'apollo', session, foreground: true, location: 'granted' as const,
    pause: () => { calls.push('pause'); return true; }, resume: () => { calls.push('resume'); return true; },
    end: () => { calls.push('end'); }, startLocation: () => { calls.push('startLocation'); }, stopLocation: () => { calls.push('stopLocation'); } } };
}
it('resume restarts a granted foreground device-origin leg', () => {
  const { input, calls } = setup(); applyJourneyNavigationCommand(input); assert.deepEqual(calls, ['resume', 'startLocation']);
  calls.length = 0; applyJourneyNavigationCommand({ ...input, location: 'denied' }); assert.deepEqual(calls, ['resume']);
  calls.length = 0; applyJourneyNavigationCommand({ ...input, foreground: false }); assert.deepEqual(calls, ['resume']);
});
it('resume restarts an approximate feed so a later precise fix can recover guidance', () => {
  const { input, calls } = setup();
  applyJourneyNavigationCommand({ ...input, location: 'approximate' });
  assert.deepEqual(calls, ['resume', 'startLocation']);
});
it('resume does not start a feed without an existing usable location permission', () => {
  for (const location of ['unknown', 'denied', 'disabled', 'unsupported'] satisfies LocationAvailability[]) {
    const { input, calls } = setup();
    applyJourneyNavigationCommand({ ...input, location });
    assert.deepEqual(calls, ['resume'], location);
  }
});
it('approximate-location resume preserves foreground, origin and successful-resume guards', () => {
  const { input, calls } = setup();
  applyJourneyNavigationCommand({ ...input, location: 'approximate', foreground: false });
  assert.deepEqual(calls, ['resume']);
  for (const origin of [
    { kind: 'manual', coordinate: { latitude: 40.81, longitude: -73.94 }, label: 'Harlem' },
    { kind: 'companion-phone', deviceLabel: 'Paired phone' },
  ] as const) {
    calls.length = 0;
    applyJourneyNavigationCommand({ ...input, location: 'approximate', session: { ...session, origin } as NavigationSession });
    assert.deepEqual(calls, ['resume'], origin.kind);
  }
  calls.length = 0;
  applyJourneyNavigationCommand({ ...input, location: 'approximate', resume: () => false });
  assert.deepEqual(calls, []);
});
it('pause cancels an unpausable pending reroute and stops its feed', () => {
  const { input, calls } = setup('pause'); applyJourneyNavigationCommand({ ...input, pause: () => false }); assert.deepEqual(calls, ['end', 'stopLocation']);
});
it('tour pause, confirm and stop never operate on another destination', () => {
  const { input, calls } = setup();
  for (const type of ['pause', 'resume', 'stop', 'confirm-stop']) applyJourneyNavigationCommand({ ...input, type, targetSlug: 'other-stop' });
  assert.deepEqual(calls, []);
});
