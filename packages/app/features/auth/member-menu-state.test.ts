import assert from 'node:assert/strict';
import { it } from 'node:test';
import { memberMenuMode } from './member-menu-state.ts';

for (const status of ['idle', 'loading'] as const) {
  it(`does not flash Sign in before the first ${status} session check`, () => {
    assert.equal(memberMenuMode(status, false, null, ''), 'pending');
  });
}
for (const status of ['signed-in', 'loading'] as const) {
  it(`keeps a confirmed member's avatar while ${status}`, () => {
    assert.equal(memberMenuMode(status, true, '', ''), 'member');
  });
}
it('shows Sign in as soon as the first session check confirms signed-out', () => {
  assert.equal(memberMenuMode('signed-out', false, null, ''), 'signed-out');
});
it('retains Sign in during later signed-out focus refreshes', () => {
  assert.equal(memberMenuMode('loading', false, '', ''), 'signed-out');
});
it('does not reuse a checked-state marker for another origin', () => {
  assert.equal(memberMenuMode('loading', false, 'https://a.example.invalid', 'https://b.example.invalid'), 'pending');
});
it('never retains an avatar after an auth boundary has removed its member', () => {
  assert.notEqual(memberMenuMode('loading', false, '', ''), 'member');
  assert.equal(memberMenuMode('signed-out', false, '', ''), 'signed-out');
});
