'use client';

// The signed-in member, shared by every surface that needs to know (navbar
// account control, profile page, the auth screen's already-signed-in redirect).
// Session state lives in the cookie, so this store only mirrors what
// `/payload-api/auth/get-session` last said — it never holds credentials.

import { create } from 'zustand';
import type { MemberPhotoAsset } from './member-photo.ts';

export interface MemberProfile {
  id: number | string;
  email: string;
  name?: string | null;
  /** Better Auth's standard image URL; the member may not have one. */
  image?: string | null;
}

/** A saved-place row; `depth=1` populates the place relation where the read allows. */
export interface SavedPlaceEntry {
  id: number | string;
  place: number | string | { id?: number | string; name?: string | null; slug?: string | null };
}

export type MemberSessionStatus = 'idle' | 'loading' | 'signed-out' | 'signed-in';

export type MemberSessionResult = { ok: true } | { ok: false; message: string };

export interface MemberProfileUpdate {
  name?: string;
  /** Absolute URL of an uploaded photo, or null to remove it. */
  image?: string | null;
}

/** Cookie-changing auth requests must own a boundary before they can start. */
export interface MemberAuthenticationAttempt {
  signal: AbortSignal;
  isCurrent: () => boolean;
  /** Release this attempt only; successful auth starts a fresh session read. */
  finish: (succeeded: boolean) => boolean;
}

interface MemberSessionState {
  status: MemberSessionStatus;
  member: MemberProfile | null;
  savedPlaces: SavedPlaceEntry[];
  /** Origin the calls were bound to ('' = same-origin on web). */
  siteUrl: string;
  /** First read of the session cookie; safe to call on every mount. */
  hydrate: (siteUrl: string) => Promise<void>;
  /** Clears the previous identity before a sign-in/sign-up POST; refuses overlap. */
  beginAuthentication: (siteUrl: string) => MemberAuthenticationAttempt | null;
  /** Credentials were just accepted — fetch the member the cookie now names. */
  signedIn: (siteUrl: string) => Promise<void>;
  /** Re-reads the session; used after a profile edit. */
  refresh: () => Promise<void>;
  /** Saves name/photo through Better Auth's update-user, then refreshes. */
  updateProfile: (update: MemberProfileUpdate) => Promise<MemberSessionResult>;
  /** Uploads a picked photo to the media library and sets it as the avatar. */
  uploadAvatar: (photo: MemberPhotoAsset) => Promise<MemberSessionResult>;
  refreshSavedPlaces: () => Promise<void>;
  signOut: () => Promise<void>;
}

const api = (siteUrl: string, path: string) => `${siteUrl.replace(/\/$/, '')}/payload-api${path}`;

const getSession = async (siteUrl: string, signal: AbortSignal): Promise<MemberProfile | null> => {
  const response = await fetch(api(siteUrl, '/auth/get-session'), { credentials: 'include', signal });
  if (!response.ok) return null;
  const body = (await response.json().catch(() => null)) as { user?: MemberProfile | null } | null;
  return body?.user ?? null;
};

const errorText = (body: unknown, fallback: string): string => {
  const data = typeof body === 'object' && body !== null ? (body as { message?: unknown; error?: unknown }) : {};
  return (typeof data.message === 'string' && data.message) || (typeof data.error === 'string' && data.error) || fallback;
};

const unreachable = { ok: false as const, message: 'Could not reach Harlem Might. Check your connection and try again.' };

// A member ID alone is insufficient: A can sign out and sign back in while an
// old A request is still pending. Every explicit auth boundary gets a new epoch.
interface MemberScope {
  generation: number;
  siteUrl: string;
  owner: string;
}

const sessionChanged = { ok: false as const, message: 'Your login changed. Try again from your current account.' };

export const useMemberSession = create<MemberSessionState>((set, get) => {
  let generation = 0;
  let sessionRead: AbortController | undefined;
  let savedPlacesRead: AbortController | undefined;
  let authentication: AbortController | undefined;
  let logout: { controller: AbortController; promise?: Promise<void> } | undefined;
  const mutations = new Set<AbortController>();
  const ownerOf = (member: MemberProfile | null) => member ? String(member.id) : null;

  const invalidate = () => {
    generation++;
    authentication?.abort();
    authentication = undefined;
    sessionRead?.abort();
    sessionRead = undefined;
    savedPlacesRead?.abort();
    savedPlacesRead = undefined;
    for (const controller of mutations) controller.abort();
    mutations.clear();
    logout?.controller.abort();
    logout = undefined;
  };

  const scopeFor = (): MemberScope | null => {
    const { siteUrl, member } = get();
    return !authentication && member && get().status === 'signed-in' ? { generation, siteUrl, owner: String(member.id) } : null;
  };
  const owns = (scope: MemberScope) => !authentication && scope.generation === generation
    && scope.siteUrl === get().siteUrl && scope.owner === ownerOf(get().member);
  const active = (scope: MemberScope, controller: AbortController) => !controller.signal.aborted && owns(scope);

  const readSavedPlaces = async (scope: MemberScope) => {
    if (!owns(scope)) return;
    savedPlacesRead?.abort();
    const controller = new AbortController();
    savedPlacesRead = controller;
    const current = () => savedPlacesRead === controller && active(scope, controller);
    try {
      const response = await fetch(api(scope.siteUrl, '/saved-places?depth=1&sort=-createdAt&limit=100'), {
        credentials: 'include',
        signal: controller.signal,
      });
      if (!current() || !response.ok) return;
      const body = (await response.json().catch(() => null)) as { docs?: SavedPlaceEntry[] } | null;
      // Parsing the body can also finish after the account or request changes.
      if (current()) set({ savedPlaces: body?.docs ?? [] });
    } catch {
      // A failed list read keeps the session and its last successful list.
    } finally {
      if (savedPlacesRead === controller) savedPlacesRead = undefined;
    }
  };

  const load = async (siteUrl: string, newSession = false) => {
    // A login may already have changed the cookie before its response body
    // settles. No read may certify an identity inside that window.
    if (authentication) return;
    const boundary = newSession || get().siteUrl !== siteUrl;
    if (boundary) {
      invalidate();
    } else if (logout) {
      // The cookie may still be valid while sign-out is in flight.
      return;
    }
    sessionRead?.abort();
    const controller = new AbortController();
    sessionRead = controller;
    const startedGeneration = generation;
    const current = () => generation === startedGeneration && sessionRead === controller
      && !controller.signal.aborted && get().siteUrl === siteUrl;
    set({ status: 'loading', siteUrl, ...(boundary ? { member: null, savedPlaces: [] } : {}) });
    try {
      if (!current()) return;
      const member = await getSession(siteUrl, controller.signal);
      if (!current()) return;
      const changedOwner = ownerOf(member) !== ownerOf(get().member);
      if (changedOwner) invalidate();
      if (!member) {
        set({ status: 'signed-out', member: null, savedPlaces: [] });
        return;
      }
      const scope = { generation, siteUrl, owner: String(member.id) };
      set({ status: 'signed-in', member, ...(changedOwner ? { savedPlaces: [] } : {}) });
      await readSavedPlaces(scope);
    } catch {
      if (!current()) return;
      invalidate();
      set({ status: 'signed-out', member: null, savedPlaces: [] });
    } finally {
      if (sessionRead === controller) sessionRead = undefined;
    }
  };

  // Avatar upload and its follow-on write share the initiating scope. Never
  // recapture get().member between those requests, even if it has the same ID.
  const saveProfile = async (update: MemberProfileUpdate, scope: MemberScope, controller: AbortController): Promise<MemberSessionResult> => {
    if (!active(scope, controller) || get().status !== 'signed-in') return sessionChanged;
    try {
      const response = await fetch(api(scope.siteUrl, '/auth/update-user'), {
        method: 'POST',
        credentials: 'include',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(update),
      });
      if (!active(scope, controller)) return sessionChanged;
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as unknown;
        if (!active(scope, controller)) return sessionChanged;
        return { ok: false, message: errorText(body, `The member service returned ${response.status}.`) };
      }
      await load(scope.siteUrl);
      return active(scope, controller) ? { ok: true } : sessionChanged;
    } catch {
      return active(scope, controller) ? unreachable : sessionChanged;
    }
  };

  return {
    status: 'idle',
    member: null,
    savedPlaces: [],
    siteUrl: '',

    hydrate: async (siteUrl) => {
      if (get().status !== 'idle') return;
      await load(siteUrl, true);
    },

    beginAuthentication: (siteUrl) => {
      if (authentication || logout) return null;
      invalidate();
      const controller = new AbortController();
      authentication = controller;
      const startedGeneration = generation;
      const isCurrent = () => authentication === controller && generation === startedGeneration
        && !controller.signal.aborted && get().siteUrl === siteUrl;
      set({ status: 'loading', siteUrl, member: null, savedPlaces: [] });
      return {
        signal: controller.signal,
        isCurrent,
        finish: (succeeded) => {
          if (!isCurrent()) return false;
          authentication = undefined;
          // Keep credentials out of the store. Auth callers can clear their
          // form immediately while this guarded session/list read completes.
          if (succeeded) void load(siteUrl);
          else set({ status: 'signed-out', member: null, savedPlaces: [] });
          return true;
        },
      };
    },

    signedIn: (siteUrl) => load(siteUrl, true),

    refresh: async () => {
      await load(get().siteUrl);
    },

    updateProfile: async (update) => {
      const scope = scopeFor();
      if (!scope) return { ok: false, message: 'You are not signed in.' };
      const controller = new AbortController();
      mutations.add(controller);
      try {
        return await saveProfile(update, scope, controller);
      } finally {
        mutations.delete(controller);
      }
    },

    uploadAvatar: async (photo) => {
      const scope = scopeFor();
      const member = get().member;
      if (!scope || !member) return { ok: false, message: 'You are not signed in.' };
      const controller = new AbortController();
      mutations.add(controller);
      try {
        const form = new FormData();
        // RN's FormData takes { uri, name, type } for a file:// pick; the
        // browser takes the File itself.
        if (photo.file) form.append('file', photo.file);
        else form.append('file', { uri: photo.uri, name: photo.fileName, type: photo.mimeType } as unknown as Blob);
        form.append('_payload', JSON.stringify({ alt: `Profile photo for ${member.name ?? member.email}` }));
        if (!active(scope, controller)) return sessionChanged;
        const uploaded = await fetch(api(scope.siteUrl, '/media'), {
          method: 'POST',
          credentials: 'include',
          signal: controller.signal,
          body: form,
        });
        if (!active(scope, controller)) return sessionChanged;
        if (!uploaded.ok) {
          const body = (await uploaded.json().catch(() => null)) as unknown;
          if (!active(scope, controller)) return sessionChanged;
          return { ok: false, message: errorText(body, `The photo could not be uploaded (${uploaded.status}).`) };
        }
        const body = (await uploaded.json().catch(() => null)) as { doc?: { url?: string | null } } | null;
        if (!active(scope, controller)) return sessionChanged;
        const url = body?.doc?.url;
        if (!url) return { ok: false, message: 'The photo uploaded but no file URL came back.' };
        const base = scope.siteUrl || (typeof location === 'undefined' ? '' : location.origin);
        const image = url.startsWith('http') ? url : `${base}${url}`;
        return await saveProfile({ image }, scope, controller);
      } catch {
        return active(scope, controller) ? unreachable : sessionChanged;
      } finally {
        mutations.delete(controller);
      }
    },

    refreshSavedPlaces: async () => {
      const scope = scopeFor();
      if (scope) await readSavedPlaces(scope);
    },

    signOut: () => {
      if (logout?.promise) return logout.promise;
      const { siteUrl } = get();
      invalidate();
      const operation = { controller: new AbortController(), promise: undefined as Promise<void> | undefined };
      logout = operation;
      // Invalidate and hide private data before the network can yield. A late
      // logout response must never overwrite a newer sign-in.
      set({ status: 'signed-out', member: null, savedPlaces: [] });
      operation.promise = (async () => {
        try {
          if (logout !== operation || operation.controller.signal.aborted) return;
          await fetch(api(siteUrl, '/auth/sign-out'), {
            method: 'POST',
            credentials: 'include',
            signal: operation.controller.signal,
            headers: { 'Content-Type': 'application/json' },
            body: '{}',
          });
        } catch (error) {
          if (!operation.controller.signal.aborted) throw error;
        } finally {
          if (logout === operation) logout = undefined;
        }
      })();
      return operation.promise;
    },
  };
});

/** The first word of a display name, for the account control's label. */
export const memberFirstName = (member: MemberProfile): string => {
  const name = member.name?.trim();
  const first = name?.split(/\s+/)[0];
  return first ?? member.email;
};
