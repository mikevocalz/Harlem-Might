import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createMemberAuthActions } from './member-auth.ts';
import { createMemberSession, useMemberSession } from './member-session.ts';

const member = { id: 'A', email: 'a@example.invalid', image: 'https://media.example.invalid/a.png' };
const saved = { id: 'saved-A', place: { id: 4, name: 'Harlem place' }, createdAt: '2026-01-01' };
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
};
const tick = () => new Promise<void>((resolve) => setImmediate(resolve));

for (const apiBase of ['/tenant/member-api/', 'https://cms.example.invalid/tenant/member-api///']) {
  test(`one factory binding owns auth, reads, profile, saved writes and logout at ${apiBase}`, async (t) => {
    const session = createMemberSession({ apiBase });
    const initialSingleton = useMemberSession.getState();
    const requests: { url: string; init?: RequestInit }[] = [];
    let rows = [saved];
    t.mock.method(globalThis, 'fetch', async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      requests.push({ url, init });
      assert.ok(url.startsWith(apiBase.replace(/\/+$/, '') + '/'));
      assert.equal(init?.credentials, 'include');
      assert.ok(init?.signal instanceof AbortSignal);
      if (url.endsWith('/auth/get-session')) return Response.json({ user: member });
      if (url.includes('/saved-places?')) return Response.json({ docs: rows });
      if (init?.method === 'DELETE') rows = [];
      return Response.json({});
    });
    // A custom API mount is authoritative, even if the auth caller supplies a
    // different page origin. This cannot split cookie reads from cookie writes.
    const auth = createMemberAuthActions('https://page.example.invalid', session);
    assert.deepEqual(await auth.signUpEmail({ email: ` ${member.email} `, password: 'fixture-only', name: ' Member ' }), { ok: true });
    await tick();
    assert.equal(session.getState().member?.image, member.image);
    assert.deepEqual(session.getState().savedPlaces, [saved]);
    assert.equal(useMemberSession.getState(), initialSingleton);
    const signup = requests.find(({ url }) => url.endsWith('/sign-up/email'))!;
    assert.deepEqual(JSON.parse(String(signup.init?.body)), { email: member.email, password: 'fixture-only', name: 'Member' });
    assert.equal(signup.init?.signal, requests.find(({ url }) => url.endsWith('/sign-in/email'))?.init?.signal);
    await session.getState().updateProfile({ image: null, name: 'New name' });
    await session.getState().savePlace(99);
    const save = requests.find(({ url }) => url.endsWith('/saved-places'))!;
    assert.deepEqual(JSON.parse(String(save.init?.body)), { place: 99 });
    assert.equal(save.init?.method, 'POST');
    await session.getState().removeSavedPlace('saved/A?query');
    assert.ok(requests.some(({ url, init }) => url.endsWith('/saved-places/saved%2FA%3Fquery') && init?.method === 'DELETE'));
    assert.deepEqual(session.getState().savedPlaces, []);
    await session.getState().signOut();
    assert.ok(requests.some(({ url }) => url.endsWith('/auth/sign-out')));
    assert.equal(session.getState().signOutPending, false);
    assert.equal(session.getState().member, null);
    assert.equal('password' in session.getState(), false);
  });
}

const avatarTransports = [
  { label: 'native site origin', siteUrl: 'https://native.example.invalid', apiBase: undefined, browserOrigin: undefined, apiUrl: 'https://native.example.invalid/payload-api', origin: 'https://native.example.invalid' },
  { label: 'absolute custom web mount', siteUrl: '', apiBase: 'https://cms.example.invalid/custom/api/', browserOrigin: 'https://page.example.invalid', apiUrl: 'https://cms.example.invalid/custom/api', origin: 'https://cms.example.invalid' },
  { label: 'relative custom web mount', siteUrl: '', apiBase: '/custom/api/', browserOrigin: 'https://page.example.invalid', apiUrl: '/custom/api', origin: 'https://page.example.invalid' },
];
for (const transport of avatarTransports) {
  for (const returnedUrl of ['/media/avatar.png', '//cdn.example.invalid/avatar.png', 'avatar.png']) {
    test(`${transport.label} resolves uploaded avatar URL ${returnedUrl}`, async (t) => {
      const locationDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'location');
      if (transport.browserOrigin) Object.defineProperty(globalThis, 'location', { configurable: true, value: { origin: transport.browserOrigin } });
      else Reflect.deleteProperty(globalThis, 'location');
      t.after(() => {
        if (locationDescriptor) Object.defineProperty(globalThis, 'location', locationDescriptor);
        else Reflect.deleteProperty(globalThis, 'location');
      });
      const session = createMemberSession({ apiBase: transport.apiBase });
      session.setState({ status: 'signed-in', member, siteUrl: transport.siteUrl });
      let update: unknown;
      t.mock.method(globalThis, 'fetch', async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith('/media')) {
          assert.equal(url, `${transport.apiUrl}/media`);
          return Response.json({ doc: { url: returnedUrl } });
        }
        if (url.endsWith('/auth/update-user')) update = JSON.parse(String(init?.body));
        if (url.endsWith('/auth/get-session')) return Response.json({ user: member });
        return Response.json({ docs: [] });
      });
      assert.deepEqual(await session.getState().uploadAvatar({ file: new File(['fixture'], 'a.png'), uri: 'blob:fixture', fileName: 'a.png', mimeType: 'image/png' }), { ok: true });
      // A bare filename is relative to the API endpoint's directory. Leading
      // slash URLs retain origin-root semantics; // URLs retain the CDN host.
      const expectedImage = returnedUrl.startsWith('//') ? 'https://cdn.example.invalid/avatar.png'
        : returnedUrl.startsWith('/') ? `${transport.origin}/media/avatar.png`
        : `${transport.apiUrl.startsWith('/') ? transport.origin : ''}${transport.apiUrl}/avatar.png`;
      assert.deepEqual(update, { image: expectedImage });
    });
  }
}

for (const action of ['savePlace', 'removeSavedPlace'] as const) {
  for (const owner of [member, { ...member, id: 'B', email: 'b@example.invalid' }]) {
    for (const outcome of ['success', 'http-failure', 'network-failure'] as const) {
      test(`${action} ignores stale ${outcome} after logout and ${owner.id} reauthentication`, async (t) => {
        const session = createMemberSession();
        session.setState({ status: 'signed-in', member, savedPlaces: [saved] });
        const pending = deferred<Response>();
        let mutationSignal: AbortSignal | null | undefined;
        let reads = 0;
        t.mock.method(globalThis, 'fetch', async (input: string | URL | Request, init?: RequestInit) => {
          const url = String(input);
          if (url.includes('/saved-places') && init?.method) {
            mutationSignal = init.signal;
            return pending.promise;
          }
          if (url.includes('/saved-places?')) { reads++; return Response.json({ docs: [] }); }
          if (url.endsWith('/auth/get-session')) return Response.json({ user: owner });
          return Response.json({});
        });
        const writing = session.getState()[action](saved.id);
        await session.getState().signOut();
        await session.getState().signedIn('');
        assert.equal(mutationSignal?.aborted, true);
        if (outcome === 'network-failure') pending.reject(new Error('Old network failure'));
        else pending.resolve(new Response(null, { status: outcome === 'success' ? 204 : 503 }));
        await writing;
        assert.equal(reads, 1);
        assert.equal(session.getState().member?.id, owner.id);
        assert.equal(session.getState().error, null);
        assert.deepEqual(session.getState().savedPlaces, []);
      });
    }
  }
}

test('new saved-place data and feedback win over an older malformed response body', async (t) => {
  const session = createMemberSession();
  session.setState({ status: 'signed-in', member, savedPlaces: [saved] });
  const body = deferred<unknown>();
  const parsing = deferred<void>();
  const oldResponse = Response.json({});
  oldResponse.json = () => { parsing.resolve(); return body.promise; };
  let reads = 0;
  t.mock.method(globalThis, 'fetch', async () => ++reads === 1 ? oldResponse : Response.json({ docs: [] }));
  const oldRead = session.getState().refreshSavedPlaces();
  await parsing.promise;
  await session.getState().refreshSavedPlaces();
  body.resolve({ docs: null });
  await oldRead;
  assert.deepEqual(session.getState().savedPlaces, []);
  assert.equal(session.getState().error, null);
});

test('saved-place writes without a confirmed owner never reach the API', async (t) => {
  const session = createMemberSession();
  const fetch = t.mock.method(globalThis, 'fetch', async () => Response.json({}));
  await session.getState().savePlace(4);
  await session.getState().removeSavedPlace(4);
  assert.equal(fetch.mock.callCount(), 0);
});
