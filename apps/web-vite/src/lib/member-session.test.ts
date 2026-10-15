import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { useMemberSession, useMemberAuthForm } from './member-session.ts';

const member = { id: 7, email: 'member@example.test', name: 'Member' };
const saved = { id: 11, place: 5, createdAt: '2026-01-01T00:00:00Z' };
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
};
beforeEach(() => {
  useMemberSession.setState({ status: 'signed-in', member, savedPlaces: [saved], error: null, signOutError: null, signOutPending: false });
  useMemberAuthForm.setState({ mode: 'login', email: '', password: '', name: '', error: null });
});

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
  useMemberSession.setState({ status: 'signed-out', member: null, savedPlaces: [] });
  useMemberAuthForm.setState({ mode: 'register', name: 'Member', email: member.email, password: 'offline-example-only' });
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
  const submitting = useMemberAuthForm.getState().submit();
  await useMemberSession.getState().signOut();
  assert.equal(registrationSignal?.aborted, true);
  registration.resolve(Response.json({ user: member }));
  await submitting;
  assert.equal(paths.some((path) => path.endsWith('/sign-in/email')), false);
  assert.equal(useMemberSession.getState().member, null);
  assert.equal(useMemberSession.getState().status, 'signed-out');
});

test('an in-flight sign-out blocks competing cookie-changing sign-in and registration', async (t) => {
  const response = deferred<Response>();
  const fetch = t.mock.method(globalThis, 'fetch', async () => response.promise);
  const signingOut = useMemberSession.getState().signOut();
  for (const mode of ['login', 'register'] as const) {
    useMemberAuthForm.setState({ mode, name: 'Member', email: member.email, password: 'fixture-only' });
    await useMemberAuthForm.getState().submit();
    assert.equal(fetch.mock.callCount(), 1);
  }
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
  useMemberSession.setState({ status: 'signed-out', member: null, savedPlaces: [] });
  useMemberAuthForm.setState({ email: member.email, password: 'offline-example-only' });
  t.mock.method(globalThis, 'fetch', async (input: string | URL | Request) => String(input).includes('/auth/') ? Response.json({ user: member }) : Response.json({ docs: [saved] }));
  await useMemberAuthForm.getState().submit();
  // Shared auth verifies the cookie and loads the list in the background.
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(useMemberSession.getState().status, 'signed-in');
  assert.deepEqual(useMemberSession.getState().savedPlaces, [saved]);
  assert.equal(useMemberAuthForm.getState().password, '');
  assert.equal(useMemberSession.getState().error, null);
});

test('registration can retry after invalid-name validation clears its transient password', async (t) => {
  useMemberSession.setState({ status: 'signed-out', member: null, savedPlaces: [] });
  useMemberAuthForm.setState({ mode: 'register', name: '  ', password: 'fixture-only' });
  const sentPasswords: string[] = [];
  const fetch = t.mock.method(globalThis, 'fetch', async (input: string | URL | Request, init?: RequestInit) => {
    if (init?.body) sentPasswords.push((JSON.parse(String(init.body)) as { password: string }).password);
    return String(input).includes('/auth/') ? Response.json({ user: member }) : Response.json({ docs: [] });
  });
  await useMemberAuthForm.getState().submit();
  assert.equal(fetch.mock.callCount(), 0);
  assert.match(useMemberAuthForm.getState().error ?? '', /Add your name/);
  assert.equal(useMemberAuthForm.getState().password, '');
  useMemberAuthForm.getState().setName(' Member ');
  useMemberAuthForm.getState().setEmail(member.email);
  useMemberAuthForm.getState().setPassword('new-fixture-only');
  await useMemberAuthForm.getState().submit();
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.deepEqual(sentPasswords, ['new-fixture-only', 'new-fixture-only']);
  assert.equal(useMemberAuthForm.getState().password, '');
  assert.equal(useMemberAuthForm.getState().error, null);
  assert.equal(useMemberSession.getState().member?.id, member.id);
});

test('shared auth errors stay visible in the Vite form and a successful retry clears them', async (t) => {
  useMemberSession.setState({ status: 'signed-out', member: null, savedPlaces: [] });
  useMemberAuthForm.setState({ email: member.email, password: 'fixture-only' });
  let rejected = true;
  t.mock.method(globalThis, 'fetch', async (input: string | URL | Request) => {
    if (String(input).endsWith('/sign-in/email') && rejected) return Response.json({ errors: [{ message: 'Check your email and password.' }] }, { status: 401 });
    return String(input).includes('/auth/') ? Response.json({ user: member }) : Response.json({ docs: [] });
  });
  await useMemberAuthForm.getState().submit();
  assert.equal(useMemberSession.getState().status, 'signed-out');
  assert.equal(useMemberAuthForm.getState().error, 'Check your email and password.');
  assert.equal(useMemberAuthForm.getState().password, '');
  rejected = false;
  useMemberAuthForm.getState().setPassword('fixture-only');
  await useMemberAuthForm.getState().submit();
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(useMemberAuthForm.getState().error, null);
  assert.equal(useMemberSession.getState().member?.id, member.id);
});

test('form logout clears private inputs before IO and ignores a stale auth error', async (t) => {
  useMemberSession.setState({ status: 'signed-out', member: null, savedPlaces: [] });
  useMemberAuthForm.setState({ email: member.email, name: 'Member', password: 'fixture-only' });
  const login = deferred<Response>();
  const logout = deferred<Response>();
  t.mock.method(globalThis, 'fetch', async (input: string | URL | Request) => String(input).endsWith('/sign-in/email') ? login.promise : logout.promise);
  const submitting = useMemberAuthForm.getState().submit();
  const signingOut = useMemberAuthForm.getState().signOut();
  assert.equal(useMemberAuthForm.getState().email, '');
  assert.equal(useMemberAuthForm.getState().name, '');
  assert.equal(useMemberAuthForm.getState().password, '');
  assert.equal(useMemberSession.getState().signOutPending, true);
  login.resolve(Response.json({ message: 'Old login error' }, { status: 401 }));
  await submitting;
  assert.equal(useMemberAuthForm.getState().error, null);
  logout.resolve(new Response(null, { status: 204 }));
  await signingOut;
  assert.equal(useMemberSession.getState().signOutPending, false);
});
