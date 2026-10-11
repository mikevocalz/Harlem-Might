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

const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

/** Real member store, controller and cookie-bound transport; only HTTP is local. */
async function setupJourney() {
  const { createJourneyController } = await import('./controller.ts');
  const { createMemberJourneyTransport } = await import('./member-transport.ts');
  const { applyWalkCommand } = await import('@acme/widgets');
  type Member = { id: number; email: string; name: string };
  type Session = NonNullable<ReturnType<ReturnType<typeof createJourneyController>['getSnapshot']>['session']>;
  const originalFetch = globalThis.fetch;
  let cookie: Member | null = { id: 7, email: 'member@example.invalid', name: 'Member' };
  let logoutReply: () => Response | Promise<Response> = () => response({});
  let commandReply: (session: Session) => Response | Promise<Response> = (session) => response({ schemaVersion: 1, session });
  const walk = { id: 7, slug: 'history', title: 'History', summary: 'A sourced walk.', distanceMeters: 500, durationMinutes: 10, startDescription: 'Apollo', endDescription: 'Sylvia', images: [], updatedAt: '2026-10-01T12:00:00.000Z', stops: [{ position: 1, place: { id: 1, slug: 'apollo', name: 'Apollo' } }, { position: 2, place: { id: 2, slug: 'sylvia', name: 'Sylvia' } }], sources: [{ label: 'Archive', url: 'https://example.invalid/archive', accessedAt: '2026-10-01T12:00:00.000Z' }] };
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.endsWith('/auth/get-session')) return response({ user: cookie });
    if (url.endsWith('/auth/sign-out')) return logoutReply();
    if (url.includes('/saved-places')) return response({ docs: [] });
    if (url.endsWith('/walk-sessions/command')) return commandReply(applyWalkCommand(
      null, JSON.parse(String(init?.body)), new Date().toISOString(),
      { id: '7', slug: walk.slug, title: walk.title, stopIds: ['1', '2'], published: true, sourceUrl: 'https://example.invalid/archive' },
    ));
    throw new Error(`Unexpected URL ${url}`);
  };
  await useMemberSession.getState().signedIn('');
  const controller = createJourneyController({
    readers: { getWalk: async () => ({ status: 'ok', data: walk }), getPlace: async () => ({ status: 'not-found' }), listStories: async () => ({ status: 'ok', data: [] }) },
    storage: { getString() { return undefined; }, set() {}, remove() {} },
    transport: createMemberJourneyTransport(),
  });
  const unsubscribe = observeJourneyMemberIdentity(controller, useMemberSession);
  const published: (Session | null)[] = [];
  const unpublish = controller.subscribe(() => { published.push(controller.getSnapshot().session); });
  return {
    controller, published,
    begin: () => controller.begin(walk.slug),
    setCookie(value: Member | null) { cookie = value; },
    setLogout(handler: typeof logoutReply) { logoutReply = handler; },
    setCommand(handler: typeof commandReply) { commandReply = handler; },
    async close() {
      unsubscribe(); unpublish(); logoutReply = () => response({});
      await useMemberSession.getState().signOut();
      globalThis.fetch = originalFetch;
    },
  };
}

it('a logout retry revokes a journey started through the still-valid cookie after the first logout failed', async () => {
  const h = await setupJourney();
  const pending = deferred<Response>();
  let retry: Promise<void> | undefined;
  try {
    h.setLogout(() => response({}, 503));
    await useMemberSession.getState().signOut();
    assert.equal(useMemberSession.getState().status, 'signed-out');
    assert.equal(useMemberSession.getState().member, null);
    assert.ok(useMemberSession.getState().signOutError);
    await h.begin();
    assert.equal(h.controller.getSnapshot().mode, 'member');
    assert.ok(h.controller.getSnapshot().session);
    h.setLogout(() => pending.promise);
    retry = useMemberSession.getState().signOut();
    assert.equal(h.controller.getSnapshot().session, null, 'retry revokes before its response arrives');
    assert.equal(h.published.at(-1), null, 'subscribers receive empty state for watch revocation');
    pending.resolve(response({}));
    await retry;
    assert.equal(h.controller.getSnapshot().session, null);
  } finally { pending.resolve(response({})); await retry; await h.close(); }
});

it('successful logout also revokes a member journey started while its request was pending', async () => {
  const h = await setupJourney();
  const pending = deferred<Response>();
  h.setLogout(() => pending.promise);
  const logout = useMemberSession.getState().signOut();
  try {
    await h.begin();
    assert.equal(h.controller.getSnapshot().mode, 'member');
    assert.ok(h.controller.getSnapshot().session);
    h.setCookie(null);
    pending.resolve(response({}));
    await logout;
    assert.equal(h.controller.getSnapshot().session, null);
    assert.equal(h.published.at(-1), null);
  } finally { pending.resolve(response({})); await logout; await h.close(); }
});

it('logout confirmation invalidates a pending member start and ignores its late response', async () => {
  const h = await setupJourney();
  const pendingLogout = deferred<Response>();
  const pendingCommand = deferred<Response>();
  const posted = deferred<Response>();
  h.setLogout(() => pendingLogout.promise);
  h.setCommand((session) => { posted.resolve(response({ schemaVersion: 1, session })); return pendingCommand.promise; });
  const logout = useMemberSession.getState().signOut();
  const begin = h.begin();
  const accepted = await posted.promise;
  try {
    h.setCookie(null);
    pendingLogout.resolve(response({}));
    await logout;
    assert.equal(h.controller.getSnapshot().busy, false);
    pendingCommand.resolve(accepted);
    await begin;
    assert.equal(h.controller.getSnapshot().session, null);
    assert.equal(h.published.at(-1), null);
  } finally { pendingLogout.resolve(response({})); pendingCommand.resolve(accepted); await Promise.all([logout, begin]); await h.close(); }
});

it('an obsolete successful logout cannot revoke a newer member journey', async () => {
  const h = await setupJourney();
  const pending = deferred<Response>();
  h.setLogout(() => pending.promise);
  const logout = useMemberSession.getState().signOut();
  try {
    h.setCookie({ id: 8, email: 'b@example.invalid', name: 'B' });
    await useMemberSession.getState().signedIn('');
    await h.begin();
    const current = h.controller.getSnapshot().session;
    assert.ok(current);
    pending.resolve(response({}));
    await logout;
    assert.equal(h.controller.getSnapshot().session, current);
    assert.equal(useMemberSession.getState().member?.id, 8);
  } finally { pending.resolve(response({})); await logout; await h.close(); }
});

it('initial hydration preserves a journey already independently verified for the same owner', async () => {
  const h = await setupJourney();
  try {
    useMemberSession.setState({ status: 'idle', member: null, savedPlaces: [] });
    await h.begin();
    const current = h.controller.getSnapshot().session;
    assert.ok(current);
    await useMemberSession.getState().hydrate('');
    assert.equal(h.controller.getSnapshot().session, current);
  } finally { await h.close(); }
});

it('explicit logout boundaries do not remove an established anonymous journey', async () => {
  const h = await setupJourney();
  try {
    h.setCookie(null);
    await h.begin();
    const current = h.controller.getSnapshot().session;
    assert.equal(h.controller.getSnapshot().mode, 'local');
    assert.ok(current);
    await useMemberSession.getState().signOut();
    assert.equal(h.controller.getSnapshot().session, current);
  } finally { await h.close(); }
});
