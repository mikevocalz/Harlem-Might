'use client';

// Shared calls for the Payload Better Auth member endpoints. The caller owns
// the base URL: web passes an empty string for same-origin cookies, native
// passes the public site origin. Credentials live only for this request.

import { useMemberSession, type MemberAuthenticationAttempt } from './member-session.ts';

export interface MemberCredentials {
  email: string;
  password: string;
}

export interface MemberRegistration extends MemberCredentials {
  name: string;
}

export type MemberAuthResult = { ok: true } | { ok: false; message: string };

export interface MemberAuthActions {
  signInEmail: (credentials: MemberCredentials) => Promise<MemberAuthResult>;
  signUpEmail: (registration: MemberRegistration) => Promise<MemberAuthResult>;
}

interface ErrorBody {
  message?: unknown;
  error?: unknown;
  error_description?: unknown;
  errors?: unknown;
}

const text = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value : undefined;

function errorMessage(body: unknown, status: number) {
  const data = typeof body === 'object' && body !== null ? (body as ErrorBody) : {};
  const first = Array.isArray(data.errors)
    ? data.errors.find((item): item is { message: string } =>
        typeof item === 'object' && item !== null && typeof (item as { message?: unknown }).message === 'string')
    : undefined;
  return (
    first?.message ??
    text(data.message) ??
    text(data.error_description) ??
    text(data.error) ??
    `The member service returned ${status}.`
  );
}

const sessionChanged = { ok: false as const, message: 'Your login changed. Try again from your current account.' };
const unreachable = { ok: false as const, message: 'Could not reach Harlem Might. Check your connection and try again.' };

async function post(baseUrl: string, path: string, body: Record<string, string>, attempt: MemberAuthenticationAttempt): Promise<MemberAuthResult> {
  if (!attempt.isCurrent()) return sessionChanged;
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      credentials: 'include',
      signal: attempt.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!attempt.isCurrent()) return sessionChanged;
    const parsed = (await response.json().catch(() => null)) as unknown;
    if (!attempt.isCurrent()) return sessionChanged;
    if (!response.ok) return { ok: false, message: errorMessage(parsed, response.status) };
    return { ok: true };
  } catch {
    return attempt.isCurrent() ? unreachable : sessionChanged;
  }
}

/** Bind the shared screen to one deployment's `/payload-api/auth` mount. */
export function createMemberAuthActions(siteUrl: string): MemberAuthActions {
  const baseUrl = `${siteUrl.replace(/\/$/, '')}/payload-api/auth`;
  const authenticate = async (action: (attempt: MemberAuthenticationAttempt) => Promise<MemberAuthResult>): Promise<MemberAuthResult> => {
    // Own the boundary before fetch: Set-Cookie can take effect before the
    // response JSON resolves, and registration may itself create a session.
    const attempt = useMemberSession.getState().beginAuthentication(siteUrl);
    if (!attempt) return { ok: false, message: 'An account change is already in progress. Please wait.' };
    let result: MemberAuthResult;
    try {
      result = await action(attempt);
    } catch {
      result = unreachable;
    }
    return attempt.finish(result.ok) ? result : sessionChanged;
  };
  return {
    signInEmail: ({ email, password }) => authenticate((attempt) =>
      post(baseUrl, '/sign-in/email', { email: email.trim(), password }, attempt)),
    signUpEmail: ({ name, email, password }) => authenticate(async (attempt) => {
      const created = await post(baseUrl, '/sign-up/email', {
        name: name.trim(),
        email: email.trim(),
        password,
      }, attempt);
      if (!created.ok) return created;
      // Keep the same boundary across both requests: sign-up can issue a
      // cookie, but the plugin does not guarantee it, so sign in explicitly.
      return post(baseUrl, '/sign-in/email', { email: email.trim(), password }, attempt);
    }),
  };
}
