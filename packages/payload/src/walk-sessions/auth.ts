import type { VerifiedWalkMember } from './service.ts';

export interface WalkAuth {
  api: {
    getSession(input: { headers: Headers; query: { disableCookieCache: true; disableRefresh: true } }): Promise<unknown>;
  };
}

/** No cookie-cache identity, req.user fallback, forwarded member ID or watch bearer token. */
export async function verifyWalkMember(auth: WalkAuth | undefined, headers: Headers): Promise<VerifiedWalkMember | null> {
  if (!auth || headers.has('authorization')) return null;
  const result = await auth.api.getSession({
    headers, query: { disableCookieCache: true, disableRefresh: true },
  });
  if (!result || typeof result !== 'object') return null;
  const { user, session } = result as { user?: { id?: unknown }; session?: { userId?: unknown; expiresAt?: unknown } };
  const id = user?.id;
  if ((typeof id !== 'string' && typeof id !== 'number') || !/^[1-9]\d*$/.test(String(id))) return null;
  const memberId = Number(id);
  if (!Number.isSafeInteger(memberId) || String(session?.userId) !== String(id)) return null;
  const expiresAt = session?.expiresAt;
  const expires = expiresAt instanceof Date ? expiresAt.valueOf()
    : typeof expiresAt === 'string' ? Date.parse(expiresAt) : NaN;
  if (!Number.isFinite(expires) || expires <= Date.now()) return null;
  return { memberId };
}
