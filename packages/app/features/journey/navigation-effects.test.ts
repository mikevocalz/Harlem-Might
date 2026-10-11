import assert from 'node:assert/strict';
import { it } from 'node:test';
import { applyJourneyNavigationCommand } from './navigation-effects.ts';
import type { NavigationSession } from '../navigation/model/session.ts';
const session = { phase: 'paused', destination: { placeId: 'apollo' }, origin: { kind: 'device-location' }, activeRoute: {} } as NavigationSession;
function setup(type = 'resume') {
  const calls: string[] = [];
  return { calls, input: { type, targetSlug: 'apollo', session, foreground: true, location: 'granted' as const,
    pause: () => { calls.push('pause'); return true; }, resume: () => { calls.push('resume'); return true; },
    end: () => { calls.push('end'); }, startLocation: () => { calls.push('startLocation'); }, stopLocation: () => { calls.push('stopLocation'); } } };
}
it('resume restarts only a granted foreground device-origin leg', () => {
  const { input, calls } = setup(); applyJourneyNavigationCommand(input); assert.deepEqual(calls, ['resume', 'startLocation']);
  calls.length = 0; applyJourneyNavigationCommand({ ...input, location: 'denied' }); assert.deepEqual(calls, ['resume']);
  calls.length = 0; applyJourneyNavigationCommand({ ...input, foreground: false }); assert.deepEqual(calls, ['resume']);
});
it('pause cancels an unpausable pending reroute and stops its feed', () => {
  const { input, calls } = setup('pause'); applyJourneyNavigationCommand({ ...input, pause: () => false }); assert.deepEqual(calls, ['end', 'stopLocation']);
});
it('tour pause, confirm and stop never operate on another destination', () => {
  const { input, calls } = setup();
  for (const type of ['pause', 'resume', 'stop', 'confirm-stop']) applyJourneyNavigationCommand({ ...input, type, targetSlug: 'other-stop' });
  assert.deepEqual(calls, []);
});
