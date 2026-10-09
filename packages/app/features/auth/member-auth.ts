'use client';

// Shared calls for the Payload Better Auth member endpoints. The caller owns
// the base URL: web passes an empty string for same-origin cookies, native
// passes the public site origin. Credentials live only for this request.

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

async function post(baseUrl: string, path: string, body: Record<string, string>): Promise<MemberAuthResult> {
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const parsed = (await response.json().catch(() => null)) as unknown;
    if (!response.ok) return { ok: false, message: errorMessage(parsed, response.status) };
    return { ok: true };
  } catch {
    return { ok: false, message: 'Could not reach Harlem Might. Check your connection and try again.' };
  }
}

/** Bind the shared screen to one deployment's `/payload-api/auth` mount. */
export function createMemberAuthActions(siteUrl: string): MemberAuthActions {
  const baseUrl = `${siteUrl.replace(/\/$/, '')}/payload-api/auth`;
  return {
    signInEmail: ({ email, password }) =>
      post(baseUrl, '/sign-in/email', { email: email.trim(), password }),
    signUpEmail: async ({ name, email, password }) => {
      const created = await post(baseUrl, '/sign-up/email', {
        name: name.trim(),
        email: email.trim(),
        password,
      });
      if (!created.ok) return created;
      // The plugin does not guarantee that sign-up issues a session, so the
      // member enters with the same email sign-in path that Vite already uses.
      return post(baseUrl, '/sign-in/email', { email: email.trim(), password });
    },
  };
}
