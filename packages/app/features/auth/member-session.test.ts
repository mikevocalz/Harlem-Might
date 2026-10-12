import assert from 'node:assert/strict';
import { afterEach, beforeEach, it } from 'node:test';
import { pickAndUploadMemberAvatar } from './member-avatar-action.ts';
import { useMemberSession as members, memberFirstName, type MemberProfile } from './member-session.ts';

const A: MemberProfile = { id: 'A', email: 'a@example.invalid', name: 'Member A' };
const B: MemberProfile = { id: 'B', email: 'b@example.invalid', name: 'Member B' };
const realFetch = globalThis.fetch;
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json' },
});
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const delayedBody = () => {
  const body = deferred<unknown>();
  const started = deferred<void>();
  const result = response(null);
  result.json = () => { started.resolve(); return body.promise; };
  return { result, body, started };
};
const photo = {
  file: new File(['test'], 'a.png', { type: 'image/png' }),
  uri: 'file://a.png', fileName: 'a.png', mimeType: 'image/png',
};
const places = (owner: string) => [{ id: `${owner}-save`, place: `${owner}-place` }];
type Request = { url: string; init: RequestInit | undefined };
let cookieOwner: MemberProfile | null;
let requests: Request[];
let intercept: (request: Request) => Response | Promise<Response> | undefined;
const matching = (path: string) => requests.filter(({ url }) => url.includes(path));
const signIn = async (owner: MemberProfile, siteUrl = '') => {
  cookieOwner = owner;
  await members.getState().signedIn(siteUrl);
};
const assertOwner = (owner: MemberProfile) => {
  assert.equal(members.getState().status, 'signed-in');
  assert.equal(members.getState().member?.id, owner.id);
  assert.deepEqual(members.getState().savedPlaces, places(String(owner.id)));
};

beforeEach(async () => {
  cookieOwner = A;
  requests = [];
  intercept = () => undefined;
  // Keep the real Zustand/React store. Only network timing is controlled; mocks
  // deliberately ignore AbortSignal so response guards are independently tested.
  globalThis.fetch = async (input, init) => {
    const request = { url: String(input), init };
    requests.push(request);
    const intercepted = intercept(request);
    if (intercepted) return intercepted;
    if (request.url.endsWith('/auth/get-session')) return response({ user: cookieOwner });
    if (request.url.includes('/saved-places?')) return response({ docs: cookieOwner ? places(String(cookieOwner.id)) : [] });
    if (request.url.endsWith('/auth/sign-out')) return response({});
    if (request.url.endsWith('/auth/update-user')) return response({});
    if (request.url.endsWith('/media')) return response({ doc: { url: 'https://example.invalid/media/avatar.png' } });
    throw new Error(`Unexpected request ${request.url}`);
  };
  await signIn(A);
  requests = [];
});
afterEach(() => {
  globalThis.fetch = realFetch;
  members.setState({ status: 'idle', member: null, savedPlaces: [], siteUrl: '' });
});

it('does not resurrect A from get-session after completed logout', async () => {
  const stale = deferred<Response>();
  intercept = ({ url }) => url.endsWith('/auth/get-session') ? stale.promise : undefined;
  const refresh = members.getState().refresh();
  const signal = matching('/auth/get-session')[0]?.init?.signal;
  await members.getState().signOut();
  assert.equal(signal?.aborted, true);
  stale.resolve(response({ user: A }));
  await refresh;
  assert.equal(members.getState().status, 'signed-out');
  assert.equal(members.getState().member, null);
  assert.deepEqual(members.getState().savedPlaces, []);
  assert.equal(matching('/saved-places').length, 0);
});

it('also rejects a session whose JSON body finishes after logout', async () => {
  const stale = delayedBody();
  intercept = ({ url }) => url.endsWith('/auth/get-session') ? stale.result : undefined;
  const refresh = members.getState().refresh();
  await stale.started.promise;
  await members.getState().signOut();
  stale.body.resolve({ user: A });
  await refresh;
  assert.equal(members.getState().member, null);
  assert.equal(members.getState().status, 'signed-out');
});

for (const outcome of ['success', 'rejection', 'unauthenticated'] as const) {
  it(`ignores an older session ${outcome} after B signs in`, async () => {
    const stale = deferred<Response>();
    intercept = ({ url }) => url.endsWith('/auth/get-session') ? stale.promise : undefined;
    const refresh = members.getState().refresh();
    intercept = () => undefined;
    await signIn(B);
    if (outcome === 'rejection') stale.reject(new Error('Old network failure'));
    else stale.resolve(response({ user: outcome === 'success' ? A : null }, outcome === 'success' ? 200 : 401));
    await refresh;
    assertOwner(B);
  });
}

it('makes the latest ordinary refresh win, including for the same member', async () => {
  const stale = deferred<Response>();
  intercept = ({ url }) => url.endsWith('/auth/get-session') ? stale.promise : undefined;
  const first = members.getState().refresh();
  intercept = () => undefined;
  cookieOwner = { ...A, name: 'Newest A' };
  await members.getState().refresh();
  stale.resolve(response({ user: { ...A, name: 'Older A' } }));
  await first;
  assert.equal(members.getState().member?.name, 'Newest A');
  assertOwner(A);
});

it('clears A private data before B session hydration completes and refuses mutations', async () => {
  const pending = deferred<Response>();
  intercept = ({ url }) => url.endsWith('/auth/get-session') ? pending.promise : undefined;
  cookieOwner = B;
  const signingIn = members.getState().signedIn('');
  assert.equal(members.getState().status, 'loading');
  assert.equal(members.getState().member, null);
  assert.deepEqual(members.getState().savedPlaces, []);
  assert.equal((await members.getState().updateProfile({ name: 'A edit' })).ok, false);
  assert.equal((await members.getState().uploadAvatar(photo)).ok, false);
  assert.equal(matching('/auth/update-user').length, 0);
  assert.equal(matching('/media').length, 0);
  pending.resolve(response({ user: B }));
  await signingIn;
  assertOwner(B);
});

it('logout clears immediately, coalesces repeats, and blocks cookie rereads while pending', async () => {
  const pending = deferred<Response>();
  intercept = ({ url }) => url.endsWith('/auth/sign-out') ? pending.promise : undefined;
  const first = members.getState().signOut();
  const second = members.getState().signOut();
  assert.equal(first, second);
  assert.equal(members.getState().member, null);
  assert.deepEqual(members.getState().savedPlaces, []);
  await members.getState().refresh();
  await members.getState().hydrate('');
  assert.equal(matching('/auth/get-session').length, 0);
  assert.equal(matching('/auth/sign-out').length, 1);
  pending.resolve(response({}));
  await first;
});

it('a late A logout does not clear B and aborts its obsolete request', async () => {
  const pending = deferred<Response>();
  intercept = ({ url }) => url.endsWith('/auth/sign-out') ? pending.promise : undefined;
  const signingOut = members.getState().signOut();
  const signal = matching('/auth/sign-out')[0]?.init?.signal;
  await signIn(B);
  assert.equal(signal?.aborted, true);
  pending.resolve(response({}));
  await signingOut;
  assertOwner(B);
});

it('ignores rejection of an obsolete logout after B signs in', async () => {
  const pending = deferred<Response>();
  intercept = ({ url }) => url.endsWith('/auth/sign-out') ? pending.promise : undefined;
  const signingOut = members.getState().signOut();
  await signIn(B);
  pending.reject(new Error('Old logout failed'));
  await signingOut;
  assertOwner(B);
});

it('allows logout retry after a current network failure without restoring private data', async () => {
  intercept = ({ url }) => url.endsWith('/auth/sign-out') ? Promise.reject(new Error('Offline')) : undefined;
  await members.getState().signOut();
  assert.match(members.getState().signOutError ?? '', /not be confirmed/);
  assert.equal(members.getState().member, null);
  intercept = () => undefined;
  await members.getState().signOut();
  assert.equal(matching('/auth/sign-out').length, 2);
  assert.equal(members.getState().signOutError, null);
});

it('rejects an old saved-place response after A switches to B', async () => {
  const stale = deferred<Response>();
  intercept = ({ url }) => url.includes('/saved-places') ? stale.promise : undefined;
  const reading = members.getState().refreshSavedPlaces();
  const signal = matching('/saved-places')[0]?.init?.signal;
  intercept = () => undefined;
  await signIn(B);
  assert.equal(signal?.aborted, true);
  stale.resolve(response({ docs: places('A') }));
  await reading;
  assertOwner(B);
});

it('rejects a saved-place JSON body finishing after B signs in', async () => {
  const stale = delayedBody();
  intercept = ({ url }) => url.includes('/saved-places') ? stale.result : undefined;
  const reading = members.getState().refreshSavedPlaces();
  await stale.started.promise;
  intercept = () => undefined;
  await signIn(B);
  stale.body.resolve({ docs: places('A') });
  await reading;
  assertOwner(B);
});

it('rejects A saved places after logout and a new A session', async () => {
  const stale = deferred<Response>();
  intercept = ({ url }) => url.includes('/saved-places') ? stale.promise : undefined;
  const reading = members.getState().refreshSavedPlaces();
  await members.getState().signOut();
  intercept = () => undefined;
  await signIn(A);
  stale.resolve(response({ docs: places('old-A') }));
  await reading;
  assertOwner(A);
});

it('latest saved-place read wins within one session and can be retried after failure', async () => {
  const stale = deferred<Response>();
  intercept = ({ url }) => url.includes('/saved-places') ? stale.promise : undefined;
  const first = members.getState().refreshSavedPlaces();
  const signal = matching('/saved-places')[0]?.init?.signal;
  intercept = () => undefined;
  await members.getState().refreshSavedPlaces();
  assert.equal(signal?.aborted, true);
  stale.resolve(response({ docs: places('old') }));
  await first;
  assertOwner(A);
  intercept = ({ url }) => url.includes('/saved-places') ? Promise.reject(new Error('Offline')) : undefined;
  await members.getState().refreshSavedPlaces();
  assertOwner(A);
  intercept = () => undefined;
  await members.getState().refreshSavedPlaces();
  assertOwner(A);
});

for (const [label, malformed] of [
  ['invalid JSON', () => new Response('{broken', { status: 200 })],
  ['missing docs', () => response({})],
  ['null body', () => response(null)],
  ['null docs', () => response({ docs: null })],
  ['object docs', () => response({ docs: { id: 'not-a-list' } })],
  ['string docs', () => response({ docs: 'not-a-list' })],
] as const) {
  it(`preserves last-good saved places after ${label} and accepts a later empty list`, async () => {
    const lastGood = members.getState().savedPlaces;
    intercept = ({ url }) => url.includes('/saved-places') ? malformed() : undefined;
    await members.getState().refreshSavedPlaces();
    assertOwner(A);
    assert.equal(members.getState().savedPlaces, lastGood);

    intercept = ({ url }) => url.includes('/saved-places') ? response({ docs: [] }) : undefined;
    await members.getState().refreshSavedPlaces();
    assert.deepEqual(members.getState().savedPlaces, []);
    assert.equal(members.getState().status, 'signed-in');
  });
}

it('an ordinary refresh detecting B clears A places before B places arrive', async () => {
  const pending = deferred<Response>();
  const started = deferred<void>();
  intercept = ({ url }) => {
    if (url.includes('/saved-places')) { started.resolve(); return pending.promise; }
    return undefined;
  };
  cookieOwner = B;
  const reading = members.getState().refresh();
  await started.promise;
  assert.equal(members.getState().member?.id, 'B');
  assert.deepEqual(members.getState().savedPlaces, []);
  pending.resolve(response({ docs: places('B') }));
  await reading;
  assertOwner(B);
});

for (const transition of ['switch', 'logout', 'same-member', 'site'] as const) {
  it(`does not chain A avatar into update-user after ${transition}`, async () => {
    const pending = deferred<Response>();
    intercept = ({ url }) => url.endsWith('/media') ? pending.promise : undefined;
    const uploading = members.getState().uploadAvatar(photo);
    const signal = matching('/media')[0]?.init?.signal;
    if (transition === 'logout') await members.getState().signOut();
    else if (transition === 'switch') await signIn(B);
    else if (transition === 'site') await signIn(A, 'https://other.example.invalid');
    else { await members.getState().signOut(); await signIn(A); }
    assert.equal(signal?.aborted, true);
    pending.resolve(response({ doc: { url: 'https://example.invalid/member-a.png' } }));
    assert.equal((await uploading).ok, false);
    assert.equal(matching('/auth/update-user').length, 0);
  });
}

it('checks avatar ownership again after its JSON body resolves', async () => {
  const pending = delayedBody();
  intercept = ({ url }) => url.endsWith('/media') ? pending.result : undefined;
  const uploading = members.getState().uploadAvatar(photo);
  await pending.started.promise;
  await signIn(B);
  pending.body.resolve({ doc: { url: 'https://example.invalid/member-a.png' } });
  assert.equal((await uploading).ok, false);
  assert.equal(matching('/auth/update-user').length, 0);
  assertOwner(B);
});

it('does not chain avatar into an unconfirmed account during a refresh', async () => {
  const uploadingResponse = deferred<Response>();
  const checkingResponse = deferred<Response>();
  intercept = ({ url }) => {
    if (url.endsWith('/media')) return uploadingResponse.promise;
    if (url.endsWith('/auth/get-session')) return checkingResponse.promise;
    return undefined;
  };
  const uploading = members.getState().uploadAvatar(photo);
  cookieOwner = B;
  const refresh = members.getState().refresh();
  assert.equal((await members.getState().updateProfile({ name: 'Old A' })).ok, false);
  uploadingResponse.resolve(response({ doc: { url: 'https://example.invalid/member-a.png' } }));
  assert.equal((await uploading).ok, false);
  assert.equal(matching('/auth/update-user').length, 0);
  checkingResponse.resolve(response({ user: B }));
  await refresh;
  assertOwner(B);
});

it('an ordinary same-account refresh does not cancel an avatar upload', async () => {
  const pending = deferred<Response>();
  intercept = ({ url }) => url.endsWith('/media') ? pending.promise : undefined;
  const uploading = members.getState().uploadAvatar(photo);
  const signal = matching('/media')[0]?.init?.signal;
  await members.getState().refresh();
  assert.equal(signal?.aborted, false);
  pending.resolve(response({ doc: { url: 'https://example.invalid/member-a.png' } }));
  assert.deepEqual(await uploading, { ok: true });
  assert.deepEqual(JSON.parse(String(matching('/auth/update-user')[0]?.init?.body)), { image: 'https://example.invalid/member-a.png' });
  assertOwner(A);
});

for (const outcome of ['success', 'error-body', 'rejection'] as const) {
  it(`stale profile update ${outcome} neither reloads nor corrupts B`, async () => {
    const pending = deferred<Response>();
    intercept = ({ url }) => url.endsWith('/auth/update-user') ? pending.promise : undefined;
    const saving = members.getState().updateProfile({ name: 'Old A' });
    const signal = matching('/auth/update-user')[0]?.init?.signal;
    await signIn(B);
    const reads = matching('/auth/get-session').length;
    assert.equal(signal?.aborted, true);
    if (outcome === 'rejection') pending.reject(new Error('Old failure'));
    else pending.resolve(response({ message: 'Old error' }, outcome === 'success' ? 200 : 400));
    assert.equal((await saving).ok, false);
    assert.equal(matching('/auth/get-session').length, reads);
    assertOwner(B);
  });
}

it('checks ownership after parsing an old profile error body', async () => {
  const body = deferred<unknown>();
  const started = deferred<void>();
  const rejected = response({}, 400);
  rejected.json = () => { started.resolve(); return body.promise; };
  intercept = ({ url }) => url.endsWith('/auth/update-user') ? rejected : undefined;
  const saving = members.getState().updateProfile({ name: 'Old A' });
  await started.promise;
  await signIn(B);
  body.resolve({ message: 'Private old-account error' });
  const result = await saving;
  assert.equal(result.ok, false);
  if (!result.ok) assert.doesNotMatch(result.message, /Private old-account/);
  assertOwner(B);
});

it('cancels a profile refresh after sign-out without false success', async () => {
  const pending = deferred<Response>();
  const started = deferred<void>();
  intercept = ({ url }) => {
    if (url.endsWith('/auth/get-session')) { started.resolve(); return pending.promise; }
    return undefined;
  };
  const saving = members.getState().updateProfile({ name: 'New A' });
  await started.promise;
  await members.getState().signOut();
  pending.resolve(response({ user: { ...A, name: 'New A' } }));
  assert.equal((await saving).ok, false);
  assert.equal(members.getState().member, null);
});

it('allows retry after profile validation and network failures', async () => {
  intercept = ({ url }) => url.endsWith('/auth/update-user') ? response({ message: 'Invalid name' }, 400) : undefined;
  assert.deepEqual(await members.getState().updateProfile({ name: '' }), { ok: false, message: 'Invalid name' });
  intercept = ({ url }) => url.endsWith('/auth/update-user') ? Promise.reject(new Error('Offline')) : undefined;
  assert.equal((await members.getState().updateProfile({ name: 'New A' })).ok, false);
  intercept = () => undefined;
  cookieOwner = { ...A, name: 'New A' };
  assert.deepEqual(await members.getState().updateProfile({ name: 'New A' }), { ok: true });
  assert.equal(members.getState().member?.name, 'New A');
});

it('keeps avatar upload errors useful and permits a new upload retry', async () => {
  intercept = ({ url }) => url.endsWith('/media') ? response({ message: 'Unsupported photo' }, 400) : undefined;
  assert.deepEqual(await members.getState().uploadAvatar(photo), { ok: false, message: 'Unsupported photo' });
  intercept = ({ url }) => url.endsWith('/media') ? response({ doc: {} }) : undefined;
  assert.equal((await members.getState().uploadAvatar(photo)).ok, false);
  assert.equal(matching('/auth/update-user').length, 0);
  intercept = () => undefined;
  assert.deepEqual(await members.getState().uploadAvatar(photo), { ok: true });
  assert.equal(matching('/auth/update-user').length, 1);
});

it('uses the initiating origin for avatar upload and its relative URL', async () => {
  await signIn(A, 'https://harlem.example.invalid');
  requests = [];
  intercept = ({ url }) => url.endsWith('/media') ? response({ doc: { url: '/media/a.png' } }) : undefined;
  assert.deepEqual(await members.getState().uploadAvatar(photo), { ok: true });
  assert.equal(matching('/media')[0]?.url, 'https://harlem.example.invalid/payload-api/media');
  assert.deepEqual(JSON.parse(String(matching('/auth/update-user')[0]?.init?.body)), { image: 'https://harlem.example.invalid/media/a.png' });
  for (const request of requests) {
    assert.equal(request.init?.credentials, 'include');
    assert.ok(request.init?.signal instanceof AbortSignal);
  }
});

it('hydration remains idempotent across simultaneous mount calls', async () => {
  members.setState({ status: 'idle', member: null, savedPlaces: [] });
  const pending = deferred<Response>();
  intercept = ({ url }) => url.endsWith('/auth/get-session') ? pending.promise : undefined;
  const first = members.getState().hydrate('');
  await members.getState().hydrate('');
  assert.equal(matching('/auth/get-session').length, 1);
  pending.resolve(response({ user: A }));
  await first;
  assertOwner(A);
});

it('a synchronous sign-out subscriber prevents a new-session read from starting', async () => {
  const unsubscribe = members.subscribe((state) => {
    if (state.status === 'loading' && state.member === null) void state.signOut();
  });
  try {
    await members.getState().signedIn('');
    assert.equal(matching('/auth/get-session').length, 0);
    assert.equal(members.getState().member, null);
    assert.equal(members.getState().status, 'signed-out');
  } finally { unsubscribe(); }
});

it('allows a fresh B upload after cancelling the old A upload', async () => {
  const pending = deferred<Response>();
  intercept = ({ url }) => url.endsWith('/media') ? pending.promise : undefined;
  const oldUpload = members.getState().uploadAvatar(photo);
  await signIn(B);
  pending.resolve(response({ doc: { url: 'https://example.invalid/old-a.png' } }));
  assert.equal((await oldUpload).ok, false);
  intercept = () => undefined;
  assert.deepEqual(await members.getState().uploadAvatar(photo), { ok: true });
  assert.equal(matching('/auth/update-user').length, 1);
  assertOwner(B);
});

it('can retry session hydration after a failed login read', async () => {
  intercept = ({ url }) => url.endsWith('/auth/get-session') ? Promise.reject(new Error('Offline')) : undefined;
  await members.getState().signedIn('');
  assert.equal(members.getState().status, 'signed-out');
  assert.equal(members.getState().member, null);
  intercept = () => undefined;
  await signIn(B);
  assertOwner(B);
});

it('checks the owner independently of abort and session generation', async () => {
  const uploadResponse = deferred<Response>();
  const placesResponse = deferred<Response>();
  intercept = ({ url }) => {
    if (url.endsWith('/media')) return uploadResponse.promise;
    if (url.includes('/saved-places')) return placesResponse.promise;
    return undefined;
  };
  const uploading = members.getState().uploadAvatar(photo);
  const reading = members.getState().refreshSavedPlaces();
  // A replacement snapshot may come from a store integration rather than an
  // auth action. Its different owner must still reject A's continuations.
  members.setState({ member: B, savedPlaces: places('B') });
  assert.equal(matching('/media')[0]?.init?.signal?.aborted, false);
  uploadResponse.resolve(response({ doc: { url: 'https://example.invalid/old-a.png' } }));
  placesResponse.resolve(response({ docs: places('A') }));
  await reading;
  assert.equal((await uploading).ok, false);
  assert.equal(matching('/auth/update-user').length, 0);
  assertOwner(B);
});


it('reports failed HTTP logout without exposing private data and clears the warning on retry', async () => {
  intercept = ({ url }) => url.endsWith('/auth/sign-out') ? response({}, 500) : undefined;
  await members.getState().signOut();
  assert.match(members.getState().signOutError ?? '', /500/);
  assert.equal(members.getState().member, null);
  assert.deepEqual(members.getState().savedPlaces, []);
  intercept = () => undefined;
  await members.getState().signOut();
  assert.equal(members.getState().signOutError, null);
});

it('an obsolete failed logout cannot attach a warning to B', async () => {
  const pending = deferred<Response>();
  intercept = ({ url }) => url.endsWith('/auth/sign-out') ? pending.promise : undefined;
  const logout = members.getState().signOut();
  intercept = () => undefined;
  await signIn(B);
  pending.resolve(response({}, 500));
  await logout;
  assertOwner(B);
  assert.equal(members.getState().signOutError, null);
});

for (const owner of [A, B]) {
  it(`does not upload a photo chosen in an earlier session after a new ${owner.id} login`, async () => {
    const selected = deferred<typeof photo>();
    let previewed = false;
    const action = pickAndUploadMemberAvatar(() => selected.promise, () => true, () => { previewed = true; });
    await signIn(owner);
    selected.resolve(photo);
    const result = await action;
    assert.equal(result?.ok, false);
    assert.equal(previewed, false);
    assert.equal(matching('/media').length, 0);
    assert.equal(matching('/auth/update-user').length, 0);
    assertOwner(owner);
  });
}

it('does not upload when the profile closes while its picker is open', async () => {
  const selected = deferred<typeof photo>();
  let mounted = true;
  const action = pickAndUploadMemberAvatar(() => selected.promise, () => mounted, () => assert.fail('No preview after close'));
  mounted = false;
  selected.resolve(photo);
  assert.equal((await action)?.ok, false);
  assert.equal(matching('/media').length, 0);
});

it('cancelled selection causes no preview or upload', async () => {
  assert.equal(await pickAndUploadMemberAvatar(async () => null, () => true, () => assert.fail('No preview after cancellation')), null);
  assert.equal(matching('/media').length, 0);
});

it('uploads a photo chosen in the current member lifetime', async () => {
  let previewed = false;
  const result = await pickAndUploadMemberAvatar(async () => photo, () => true, () => { previewed = true; });
  assert.equal(result?.ok, true);
  assert.equal(previewed, true);
  assert.equal(matching('/media').length, 1);
  assert.equal(matching('/auth/update-user').length, 1);
});

it('account labels fall back to email for missing or blank display names', () => {
  for (const name of [null, undefined, '', '  ']) assert.equal(memberFirstName({ ...A, name }), A.email);
  assert.equal(memberFirstName({ ...A, name: '  Ada Lovelace ' }), 'Ada');
});

it('focus refresh cannot restore private data after an unconfirmed logout', async () => {
  intercept = ({ url }) => url.endsWith('/auth/sign-out') ? response({}, 500) : undefined;
  await members.getState().signOut();
  intercept = () => undefined;
  await members.getState().refresh();
  await members.getState().hydrate('');
  assert.equal(matching('/auth/get-session').length, 0);
  assert.equal(members.getState().member, null);
  assert.deepEqual(members.getState().savedPlaces, []);
  assert.match(members.getState().signOutError ?? '', /not be confirmed/);
  await signIn(B);
  assertOwner(B);
  assert.equal(members.getState().signOutError, null);
});

for (const failure of ['http-503', 'http-408', 'http-429', 'network', 'body'] as const) {
  it(`keeps a confirmed same-owner profile during a transient post-save ${failure}`, async () => {
    const pending = deferred<Response>();
    const started = deferred<void>();
    intercept = ({ url }) => {
      if (url.endsWith('/auth/get-session')) { started.resolve(); return pending.promise; }
      return undefined;
    };
    const saving = members.getState().updateProfile({ name: 'Updated A' });
    await started.promise;
    const duringRefresh = members.getState().status;
    if (failure.startsWith('http-')) pending.resolve(response({}, Number(failure.slice(5))));
    else if (failure === 'body') {
      const truncated = response({});
      truncated.json = async () => { throw new Error('Interrupted response body'); };
      pending.resolve(truncated);
    } else pending.reject(new Error('Temporary network failure'));
    const result = await saving;
    assertOwner(A);
    assert.deepEqual(result, { ok: true });
    assert.equal(duringRefresh, 'signed-in', 'post-save refresh must stay in the background');
  });
}

for (const outcome of ['http-401', 'http-403', 'session-null'] as const) {
  it(`revokes the confirmed owner after post-save ${outcome}`, async () => {
    intercept = ({ url }) => url.endsWith('/auth/get-session')
      ? response({ user: null }, outcome === 'http-401' ? 401 : outcome === 'http-403' ? 403 : 200)
      : undefined;
    assert.equal((await members.getState().updateProfile({ name: 'Updated A' })).ok, false);
    assert.equal(members.getState().status, 'signed-out');
    assert.equal(members.getState().member, null);
    assert.deepEqual(members.getState().savedPlaces, []);
  });
}

for (const loadKind of ['ordinary-refresh', 'auth-boundary', 'initial-hydrate'] as const) {
  it(`does not preserve a profile on ${loadKind} failure`, async () => {
    intercept = ({ url }) => url.endsWith('/auth/get-session') ? response({}, 503) : undefined;
    if (loadKind === 'ordinary-refresh') await members.getState().refresh();
    else if (loadKind === 'auth-boundary') await members.getState().signedIn('');
    else {
      members.setState({ status: 'idle', member: null, savedPlaces: [] });
      await members.getState().hydrate('');
    }
    assert.equal(members.getState().status, 'signed-out');
    assert.equal(members.getState().member, null);
    assert.deepEqual(members.getState().savedPlaces, []);
  });
}

for (const transition of ['new-owner', 'new-same-owner', 'logout'] as const) {
  it(`ignores an old post-save network failure after ${transition}`, async () => {
    const pending = deferred<Response>();
    const started = deferred<void>();
    intercept = ({ url }) => {
      if (url.endsWith('/auth/get-session')) { started.resolve(); return pending.promise; }
      return undefined;
    };
    const saving = members.getState().updateProfile({ name: 'Old A' });
    await started.promise;
    intercept = () => undefined;
    if (transition === 'logout') await members.getState().signOut();
    else await signIn(transition === 'new-owner' ? B : A);
    pending.reject(new Error('Obsolete failure'));
    assert.equal((await saving).ok, false);
    if (transition === 'logout') {
      assert.equal(members.getState().status, 'signed-out');
      assert.equal(members.getState().member, null);
      assert.deepEqual(members.getState().savedPlaces, []);
    } else assertOwner(transition === 'new-owner' ? B : A);
  });
}

it('publishes explicit logout start and confirmation boundaries while coalescing pending retries', async () => {
  const pending = deferred<Response>();
  intercept = ({ url }) => url.endsWith('/auth/sign-out') ? pending.promise : undefined;
  const before = members.getState().authBoundary;
  const first = members.getState().signOut();
  const started = members.getState().authBoundary;
  assert.ok(started > before);
  assert.equal(members.getState().signOut(), first);
  assert.equal(members.getState().authBoundary, started);
  pending.resolve(response({}));
  await first;
  assert.ok(members.getState().authBoundary > started);
});
