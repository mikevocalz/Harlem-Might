import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { useMemberSession } from './member-session.ts';

const member = { id: 7, email: 'member@example.test', name: 'Member' };
const saved = { id: 11, place: 5, createdAt: '2026-01-01T00:00:00Z' };
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
};
beforeEach(() => useMemberSession.setState({
  status: 'signed-in', mode: 'login', member, savedPlaces: [saved],
  email: '', password: '', name: '', error: null, signOutError: null, signOutPending: false,
}));

for (const action of ['savePlace', 'removeSavedPlace'] as const) {
  test(`${action} contains request failure and preserves the last confirmed saved list`, async (t) => {
    t.mock.method(globalThis, 'fetch', async () => { throw new Error('offline'); });
    await assert.doesNotReject(useMemberSession.getState()[action](saved.id));
    assert.deepEqual(useMemberSession.getState().savedPlaces, [saved]);
    assert.match(useMemberSession.getState().error ?? '', /try again|connection/i);
  });
}

test('failed sign-out clears local private state immediately and stays explicit until a successful retry', async (t) => {
  const response = deferred<Response>();
  t.mock.method(globalThis, 'fetch', async () => response.promise);
  const pending = useMemberSession.getState().signOut();
  assert.equal(useMemberSession.getState().member, null);
  assert.deepEqual(useMemberSession.getState().savedPlaces, []);
  assert.equal(useMemberSession.getState().signOutPending, true);
  response.resolve(new Response('Unavailable', { status: 503 }));
  await assert.doesNotReject(pending);
  assert.equal(useMemberSession.getState().signOutPending, false);
  assert.match(useMemberSession.getState().signOutError ?? '', /not be confirmed/i);
  t.mock.method(globalThis, 'fetch', async () => new Response(null, { status: 204 }));
  await useMemberSession.getState().signOut();
  assert.equal(useMemberSession.getState().signOutError, null);
});

test('repeated sign-out shares the in-flight request', async (t) => {
  const response = deferred<Response>();
  const fetch = t.mock.method(globalThis, 'fetch', async () => response.promise);
  const first = useMemberSession.getState().signOut();
  const second = useMemberSession.getState().signOut();
  assert.equal(fetch.mock.callCount(), 1);
  response.resolve(new Response(null, { status: 204 }));
  await Promise.all([first, second]);
});

test('malformed saved-place replies preserve the last confirmed list', async (t) => {
  const bodies = [null, {}, { docs: null }, { docs: {} }];
  t.mock.method(globalThis, 'fetch', async () => Response.json(bodies.shift()));
  for (let i = 0; i < 4; i++) {
    await useMemberSession.getState().refreshSavedPlaces();
    assert.deepEqual(useMemberSession.getState().savedPlaces, [saved]);
    assert.ok(useMemberSession.getState().error);
  }
});

test('a saved-place read completing after logout cannot restore private rows', async (t) => {
  const response = deferred<Response>();
  t.mock.method(globalThis, 'fetch', async (input: string | URL | Request) => String(input).includes('/saved-places') ? response.promise : new Response(null, { status: 204 }));
  const loading = useMemberSession.getState().refreshSavedPlaces();
  await useMemberSession.getState().signOut();
  response.resolve(Response.json({ docs: [saved] }));
  await loading;
  assert.deepEqual(useMemberSession.getState().savedPlaces, []);
  assert.equal(useMemberSession.getState().member, null);
});

test('a stale mutation failure cannot show an error in another member session', async (t) => {
  const response = deferred<Response>();
  t.mock.method(globalThis, 'fetch', async () => response.promise);
  const removing = useMemberSession.getState().removeSavedPlace(saved.id);
  useMemberSession.setState({ member: { id: 8, email: 'other@example.test' }, savedPlaces: [], error: null });
  response.resolve(new Response('Unavailable', { status: 503 }));
  await assert.doesNotReject(removing);
  assert.equal(useMemberSession.getState().error, null);
  assert.deepEqual(useMemberSession.getState().savedPlaces, []);
});

test('a session read completing after logout cannot restore the old member', async (t) => {
  const response = deferred<Response>();
  useMemberSession.setState({ status: 'idle', member: null, savedPlaces: [] });
  t.mock.method(globalThis, 'fetch', async (input: string | URL | Request) => String(input).includes('/get-session') ? response.promise : new Response(null, { status: 204 }));
  const loading = useMemberSession.getState().hydrate();
  await useMemberSession.getState().signOut();
  response.resolve(Response.json({ user: member }));
  await loading;
  assert.equal(useMemberSession.getState().member, null);
  assert.equal(useMemberSession.getState().status, 'signed-out');
});

test('sign-out aborts an in-flight registration and prevents a later sign-in request', async (t) => {
  const registration = deferred<Response>();
  let registrationSignal: AbortSignal | undefined;
  const paths: string[] = [];
  useMemberSession.setState({ status: 'signed-out', member: null, savedPlaces: [], mode: 'register', name: 'Member', email: member.email, password: 'offline-example-only' });
  t.mock.method(globalThis, 'fetch', async (input: string | URL | Request, init?: RequestInit) => {
    const path = new URL(String(input)).pathname;
    paths.push(path);
    if (path.endsWith('/sign-up/email')) {
      registrationSignal = init?.signal ?? undefined;
      return registration.promise;
    }
    assert.ok(path.endsWith('/sign-out'));
    return new Response(null, { status: 204 });
  });
  const submitting = useMemberSession.getState().submit();
  await useMemberSession.getState().signOut();
  assert.equal(registrationSignal?.aborted, true);
  registration.resolve(Response.json({ user: member }));
  await submitting;
  assert.equal(paths.some((path) => path.endsWith('/sign-in/email')), false);
  assert.equal(useMemberSession.getState().member, null);
  assert.equal(useMemberSession.getState().status, 'signed-out');
});

test('an in-flight sign-out blocks a competing cookie-changing sign-in', async (t) => {
  const response = deferred<Response>();
  const fetch = t.mock.method(globalThis, 'fetch', async () => response.promise);
  const signingOut = useMemberSession.getState().signOut();
  await useMemberSession.getState().submit();
  assert.equal(fetch.mock.callCount(), 1);
  response.resolve(new Response(null, { status: 204 }));
  await signingOut;
});

test('a successful saved-place retry clears the error and accepts a genuinely empty list', async (t) => {
  useMemberSession.setState({ error: 'An earlier request failed.' });
  t.mock.method(globalThis, 'fetch', async (input: string | URL | Request) => String(input).includes('/saved-places/') ? new Response(null, { status: 204 }) : Response.json({ docs: [] }));
  await useMemberSession.getState().removeSavedPlace(saved.id);
  assert.deepEqual(useMemberSession.getState().savedPlaces, []);
  assert.equal(useMemberSession.getState().error, null);
});

test('successful authentication refreshes the member saved list and clears private form state', async (t) => {
  useMemberSession.setState({ status: 'signed-out', member: null, savedPlaces: [], email: member.email, password: 'offline-example-only' });
  t.mock.method(globalThis, 'fetch', async (input: string | URL | Request) => String(input).endsWith('/auth/sign-in/email') ? Response.json({ user: member }) : Response.json({ docs: [saved] }));
  await useMemberSession.getState().submit();
  assert.equal(useMemberSession.getState().status, 'signed-in');
  assert.deepEqual(useMemberSession.getState().savedPlaces, [saved]);
  assert.equal(useMemberSession.getState().password, '');
  assert.equal(useMemberSession.getState().error, null);
});
