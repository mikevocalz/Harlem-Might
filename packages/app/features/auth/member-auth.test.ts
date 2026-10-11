import assert from 'node:assert/strict';
import { afterEach, beforeEach, it } from 'node:test';
import { createMemberAuthActions } from './member-auth.ts';
import { useMemberSession as members, type MemberProfile } from './member-session.ts';

const A: MemberProfile = { id: 'A', email: 'a@example.invalid' };
const B: MemberProfile = { id: 'B', email: 'b@example.invalid' };
const credentials = { email: B.email, password: 'fake-test-password' };
const realFetch = globalThis.fetch;
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const tick = () => new Promise<void>((resolve) => setImmediate(resolve));
const photo = {
  file: new File(['fake photo'], 'a.png', { type: 'image/png' }),
  uri: 'file://a.png', fileName: 'a.png', mimeType: 'image/png',
};
type Request = { url: string; init: RequestInit | undefined };
let cookieOwner: MemberProfile | null;
let requests: Request[];
let writes: { owner: number | string | undefined; body: unknown }[];
let intercept: (request: Request) => Response | Promise<Response> | undefined;
const matching = (path: string) => requests.filter(({ url }) => url.endsWith(path));

beforeEach(async () => {
  cookieOwner = A;
  requests = [];
  writes = [];
  intercept = () => undefined;
  globalThis.fetch = async (input, init) => {
    const request = { url: String(input), init };
    requests.push(request);
    const intercepted = intercept(request);
    if (intercepted) return intercepted;
    if (request.url.endsWith('/auth/get-session')) return response({ user: cookieOwner });
    if (request.url.includes('/saved-places')) return response({ docs: [] });
    if (request.url.endsWith('/auth/sign-out')) return response({});
    if (request.url.endsWith('/auth/sign-up/email') || request.url.endsWith('/auth/sign-in/email')) {
      cookieOwner = B;
      return response({ user: B });
    }
    if (request.url.endsWith('/media')) return response({ doc: { url: 'https://example.invalid/a-photo.png' } });
    if (request.url.endsWith('/auth/update-user')) {
      writes.push({ owner: cookieOwner?.id, body: JSON.parse(String(init?.body)) });
      return response({});
    }
    throw new Error(`Unexpected request ${request.url}`);
  };
  await members.getState().signOut();
  await members.getState().signedIn('');
  requests = [];
});
afterEach(() => {
  globalThis.fetch = realFetch;
  members.setState({ status: 'idle', member: null, savedPlaces: [], siteUrl: '' });
});

it('revokes initial A hydration before B login, including the Set-Cookie/body gap', async () => {
  const hydration = deferred<Response>();
  const headers = deferred<void>();
  const body = deferred<unknown>();
  intercept = ({ url }) => {
    if (url.endsWith('/auth/get-session')) return hydration.promise;
    if (url.endsWith('/auth/sign-in/email')) return (async () => {
      await headers.promise;
      cookieOwner = B;
      const accepted = response({});
      accepted.json = () => body.promise;
      return accepted;
    })();
    return undefined;
  };
  members.setState({ status: 'idle', member: null });
  const hydrating = members.getState().hydrate('');
  const signingIn = createMemberAuthActions('').signInEmail(credentials);
  hydration.resolve(response({ user: A }));
  await hydrating;
  assert.equal(members.getState().status, 'loading');
  assert.equal(members.getState().member, null);
  assert.equal(matching('/auth/get-session')[0]?.init?.signal?.aborted, true);
  assert.equal((await members.getState().uploadAvatar(photo)).ok, false);
  headers.resolve();
  await tick();
  assert.equal(cookieOwner?.id, 'B');
  await members.getState().hydrate('');
  await members.getState().refresh();
  await members.getState().signedIn('');
  assert.equal((await members.getState().updateProfile({ name: 'A edit' })).ok, false);
  assert.equal(matching('/auth/get-session').length, 1);
  assert.deepEqual(writes, []);
  intercept = () => undefined;
  body.resolve({ user: B });
  assert.deepEqual(await signingIn, { ok: true });
  await tick();
  assert.equal(members.getState().member?.id, 'B');
  assert.equal(members.getState().status, 'signed-in');
});

it('clears old identity synchronously before the auth POST is dispatched', async () => {
  let seen = false;
  intercept = ({ url, init }) => {
    if (!url.endsWith('/auth/sign-in/email')) return undefined;
    seen = true;
    assert.equal(members.getState().member, null);
    assert.equal(members.getState().status, 'loading');
    assert.deepEqual(members.getState().savedPlaces, []);
    assert.equal(init?.credentials, 'include');
    assert.ok(init?.signal instanceof AbortSignal);
    return response({ error: 'Rejected' }, 401);
  };
  const result = await createMemberAuthActions('').signInEmail(credentials);
  assert.equal(seen, true);
  assert.deepEqual(result, { ok: false, message: 'Rejected' });
  assert.equal(members.getState().status, 'signed-out');
});

it('aborts an A upload already pending when sign-in starts', async () => {
  const media = deferred<Response>();
  const login = deferred<Response>();
  intercept = ({ url }) => {
    if (url.endsWith('/media')) return media.promise;
    if (url.endsWith('/auth/sign-in/email')) return login.promise;
    return undefined;
  };
  const uploading = members.getState().uploadAvatar(photo);
  const signingIn = createMemberAuthActions('').signInEmail(credentials);
  assert.equal(matching('/media')[0]?.init?.signal?.aborted, true);
  cookieOwner = B;
  media.resolve(response({ doc: { url: 'https://example.invalid/old-a-photo.png' } }));
  assert.equal((await uploading).ok, false);
  assert.deepEqual(writes, []);
  login.resolve(response({ user: B }));
  assert.deepEqual(await signingIn, { ok: true });
  await tick();
  assert.equal(members.getState().member?.id, 'B');
});

it('keeps one boundary across sign-up and its follow-on sign-in', async () => {
  const registration = deferred<Response>();
  const login = deferred<Response>();
  intercept = ({ url }) => {
    if (url.endsWith('/auth/sign-up/email')) return registration.promise;
    if (url.endsWith('/auth/sign-in/email')) return login.promise;
    return undefined;
  };
  const signingUp = createMemberAuthActions('').signUpEmail({ ...credentials, name: ' New B ' });
  assert.equal(members.getState().member, null);
  cookieOwner = B;
  registration.resolve(response({ user: B }));
  await tick();
  const registrationSignal = matching('/auth/sign-up/email')[0]?.init?.signal;
  assert.equal(matching('/auth/sign-in/email')[0]?.init?.signal, registrationSignal);
  await members.getState().refresh();
  assert.equal(matching('/auth/get-session').length, 0);
  assert.equal((await members.getState().uploadAvatar(photo)).ok, false);
  login.resolve(response({ user: B }));
  assert.deepEqual(await signingUp, { ok: true });
  await tick();
  assert.equal(members.getState().member?.id, 'B');
  assert.deepEqual(JSON.parse(String(matching('/auth/sign-up/email')[0]?.init?.body)), { ...credentials, name: 'New B' });
});

it('logout cancels sign-up before it can issue its follow-on sign-in', async () => {
  const registration = deferred<Response>();
  intercept = ({ url }) => url.endsWith('/auth/sign-up/email') ? registration.promise : undefined;
  const signingUp = createMemberAuthActions('').signUpEmail({ ...credentials, name: 'B' });
  await members.getState().signOut();
  assert.equal(matching('/auth/sign-up/email')[0]?.init?.signal?.aborted, true);
  registration.resolve(response({ user: B }));
  assert.equal((await signingUp).ok, false);
  assert.equal(matching('/auth/sign-in/email').length, 0);
  assert.equal(matching('/auth/get-session').length, 0);
  assert.equal(members.getState().status, 'signed-out');
});

it('logout during an auth response body prevents late success from rereading the cookie', async () => {
  const body = deferred<unknown>();
  const started = deferred<void>();
  const accepted = response({});
  accepted.json = () => { started.resolve(); return body.promise; };
  intercept = ({ url }) => url.endsWith('/auth/sign-in/email') ? accepted : undefined;
  const signingIn = createMemberAuthActions('').signInEmail(credentials);
  await started.promise;
  await members.getState().signOut();
  body.resolve({ user: B });
  assert.equal((await signingIn).ok, false);
  assert.equal(matching('/auth/get-session').length, 0);
  assert.equal(members.getState().member, null);
});

it('rejects overlapping auth POSTs without ending the original boundary', async () => {
  const pending = deferred<Response>();
  intercept = ({ url }) => url.endsWith('/auth/sign-in/email') ? pending.promise : undefined;
  const first = createMemberAuthActions('').signInEmail(credentials);
  const second = await createMemberAuthActions('https://other.example.invalid').signUpEmail({ ...credentials, name: 'B' });
  assert.equal(second.ok, false);
  assert.equal(matching('/auth/sign-in/email').length, 1);
  assert.equal(matching('/auth/sign-up/email').length, 0);
  assert.equal(members.getState().status, 'loading');
  await members.getState().refresh();
  assert.equal(matching('/auth/get-session').length, 0);
  cookieOwner = B;
  pending.resolve(response({ user: B }));
  assert.deepEqual(await first, { ok: true });
  await tick();
  assert.equal(members.getState().member?.id, 'B');
});

it('an obsolete attempt cannot release or overwrite a newer pending attempt', async () => {
  const oldLogin = deferred<Response>();
  const newLogin = deferred<Response>();
  let reads = 0;
  intercept = ({ url }) => url.endsWith('/auth/sign-in/email') ? (++reads === 1 ? oldLogin.promise : newLogin.promise) : undefined;
  const oldAttempt = createMemberAuthActions('').signInEmail(credentials);
  await members.getState().signOut();
  const newAttempt = createMemberAuthActions('').signInEmail(credentials);
  oldLogin.resolve(response({ user: A }));
  assert.equal((await oldAttempt).ok, false);
  await members.getState().refresh();
  assert.equal(matching('/auth/get-session').length, 0);
  assert.equal(members.getState().status, 'loading');
  cookieOwner = B;
  newLogin.resolve(response({ user: B }));
  assert.deepEqual(await newAttempt, { ok: true });
  await tick();
  assert.equal(members.getState().member?.id, 'B');
});

for (const failure of ['http', 'network', 'registration', 'registration-login'] as const) {
  it(`releases a failed ${failure} attempt and allows a successful retry`, async () => {
    intercept = ({ url }) => {
      const target = failure === 'registration' ? '/auth/sign-up/email' : '/auth/sign-in/email';
      if (!url.endsWith(target)) return undefined;
      return failure === 'network' ? Promise.reject(new Error('Offline')) : response({ message: 'Try again' }, 400);
    };
    const actions = createMemberAuthActions('');
    const failed = failure.startsWith('registration')
      ? await actions.signUpEmail({ ...credentials, name: 'B' })
      : await actions.signInEmail(credentials);
    assert.equal(failed.ok, false);
    assert.equal(members.getState().status, 'signed-out');
    assert.equal(members.getState().member, null);
    if (failure === 'registration') assert.equal(matching('/auth/sign-in/email').length, 0);
    intercept = () => undefined;
    assert.deepEqual(await actions.signInEmail(credentials), { ok: true });
    await tick();
    assert.equal(members.getState().member?.id, 'B');
  });
}

it('does not wait on saved-place IO before returning auth success', async () => {
  const places = deferred<Response>();
  intercept = ({ url }) => url.includes('/saved-places') ? places.promise : undefined;
  assert.deepEqual(await createMemberAuthActions('').signInEmail(credentials), { ok: true });
  await tick();
  assert.equal(members.getState().member?.id, 'B');
  places.resolve(response({ docs: [] }));
  await tick();
});

it('a synchronous logout subscriber stops the auth POST before dispatch', async () => {
  const unsubscribe = members.subscribe((state) => {
    if (state.status === 'loading' && !state.member) void state.signOut();
  });
  try {
    assert.equal((await createMemberAuthActions('').signInEmail(credentials)).ok, false);
    assert.equal(matching('/auth/sign-in/email').length, 0);
    assert.equal(members.getState().status, 'signed-out');
  } finally { unsubscribe(); }
});

it('a failed auth attempt permits a fresh cookie verification without restoring a stale snapshot', async () => {
  intercept = ({ url }) => url.endsWith('/auth/sign-in/email') ? response({ message: 'Rejected' }, 401) : undefined;
  assert.equal((await createMemberAuthActions('').signInEmail(credentials)).ok, false);
  assert.equal(members.getState().member, null);
  cookieOwner = { ...A, name: 'Freshly verified A' };
  await members.getState().refresh();
  assert.equal(members.getState().member?.name, 'Freshly verified A');
  assert.equal(members.getState().status, 'signed-in');
});

it('waits for a pending logout to settle before permitting a new auth POST', async () => {
  const pending = deferred<Response>();
  intercept = ({ url }) => url.endsWith('/auth/sign-out') ? pending.promise : undefined;
  const signingOut = members.getState().signOut();
  const signal = matching('/auth/sign-out')[0]?.init?.signal;
  const actions = createMemberAuthActions('');
  assert.equal((await actions.signInEmail(credentials)).ok, false);
  assert.equal(matching('/auth/sign-in/email').length, 0);
  assert.equal(signal?.aborted, false);
  assert.equal(members.getState().status, 'signed-out');
  // Simulate the old cookie being expired with its response, before B starts.
  cookieOwner = null;
  pending.resolve(response({}));
  await signingOut;
  assert.deepEqual(await actions.signInEmail(credentials), { ok: true });
  await tick();
  assert.equal(members.getState().member?.id, 'B');
});
