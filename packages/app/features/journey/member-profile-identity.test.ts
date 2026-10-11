import assert from 'node:assert/strict';
import { it } from 'node:test';
import { useMemberSession } from '../auth/member-session.ts';
import { observeJourneyMemberIdentity } from './member-identity.ts';

it('a transient post-save refresh does not revoke the journey, but a new auth boundary does', async () => {
  const originalFetch = globalThis.fetch;
  const changes: (string | null | undefined)[] = [];
  let reads = 0;
  let unsubscribe = () => {};
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.endsWith('/auth/get-session')) {
      return ++reads === 1
        ? new Response(JSON.stringify({ user: { id: 7, email: 'member@example.invalid', name: 'Member' } }))
        : new Response('{}', { status: 503 });
    }
    return new Response(JSON.stringify(url.includes('/saved-places') ? { docs: [] } : {}));
  };
  try {
    await useMemberSession.getState().signedIn('');
    unsubscribe = observeJourneyMemberIdentity({ identityChanged(owner) { changes.push(owner); } }, useMemberSession);
    const result = await useMemberSession.getState().updateProfile({ name: 'Updated' });
    assert.deepEqual(result, { ok: true });
    assert.equal(useMemberSession.getState().status, 'signed-in');
    assert.equal(useMemberSession.getState().member?.id, 7);
    assert.deepEqual(changes, [], 'a transient refresh must not revoke a confirmed member journey');
    const attempt = useMemberSession.getState().beginAuthentication('');
    assert.ok(attempt);
    assert.deepEqual(changes, [null], 'an explicit account boundary must still revoke immediately');
    attempt.finish(false);
  } finally {
    unsubscribe();
    await useMemberSession.getState().signOut();
    globalThis.fetch = originalFetch;
  }
});
