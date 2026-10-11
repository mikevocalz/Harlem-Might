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

interface MemberSessionState {
  status: MemberSessionStatus;
  member: MemberProfile | null;
  savedPlaces: SavedPlaceEntry[];
  /** Origin the calls were bound to ('' = same-origin on web). */
  siteUrl: string;
  /** First read of the session cookie; safe to call on every mount. */
  hydrate: (siteUrl: string) => Promise<void>;
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

const getSession = async (siteUrl: string): Promise<MemberProfile | null> => {
  const response = await fetch(api(siteUrl, '/auth/get-session'), { credentials: 'include' });
  if (!response.ok) return null;
  const body = (await response.json().catch(() => null)) as { user?: MemberProfile | null } | null;
  return body?.user ?? null;
};

const errorText = (body: unknown, fallback: string): string => {
  const data = typeof body === 'object' && body !== null ? (body as { message?: unknown; error?: unknown }) : {};
  return (typeof data.message === 'string' && data.message) || (typeof data.error === 'string' && data.error) || fallback;
};

const unreachable = { ok: false as const, message: 'Could not reach Harlem Might. Check your connection and try again.' };

export const useMemberSession = create<MemberSessionState>((set, get) => {
  const load = async (siteUrl: string) => {
    set({ status: 'loading', siteUrl });
    try {
      const member = await getSession(siteUrl);
      if (!member) {
        set({ status: 'signed-out', member: null, savedPlaces: [] });
        return;
      }
      set({ status: 'signed-in', member });
      await get().refreshSavedPlaces();
    } catch {
      set({ status: 'signed-out', member: null, savedPlaces: [] });
    }
  };

  return {
    status: 'idle',
    member: null,
    savedPlaces: [],
    siteUrl: '',

    hydrate: async (siteUrl) => {
      if (get().status !== 'idle') return;
      await load(siteUrl);
    },

    signedIn: load,

    refresh: async () => {
      await load(get().siteUrl);
    },

    updateProfile: async (update) => {
      const { siteUrl, member } = get();
      if (!member) return { ok: false, message: 'You are not signed in.' };
      try {
        const response = await fetch(api(siteUrl, '/auth/update-user'), {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(update),
        });
        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as unknown;
          return { ok: false, message: errorText(body, `The member service returned ${response.status}.`) };
        }
        await load(siteUrl);
        return { ok: true };
      } catch {
        return unreachable;
      }
    },

    uploadAvatar: async (photo) => {
      const { siteUrl, member } = get();
      if (!member) return { ok: false, message: 'You are not signed in.' };
      try {
        const form = new FormData();
        // RN's FormData takes { uri, name, type } for a file:// pick; the
        // browser takes the File itself.
        if (photo.file) form.append('file', photo.file);
        else form.append('file', { uri: photo.uri, name: photo.fileName, type: photo.mimeType } as unknown as Blob);
        form.append('_payload', JSON.stringify({ alt: `Profile photo for ${member.name ?? member.email}` }));
        const uploaded = await fetch(api(siteUrl, '/media'), {
          method: 'POST',
          credentials: 'include',
          body: form,
        });
        if (!uploaded.ok) {
          const body = (await uploaded.json().catch(() => null)) as unknown;
          return { ok: false, message: errorText(body, `The photo could not be uploaded (${uploaded.status}).`) };
        }
        const body = (await uploaded.json().catch(() => null)) as { doc?: { url?: string | null } } | null;
        const url = body?.doc?.url;
        if (!url) return { ok: false, message: 'The photo uploaded but no file URL came back.' };
        const base = siteUrl || (typeof location === 'undefined' ? '' : location.origin);
        const image = url.startsWith('http') ? url : `${base}${url}`;
        return get().updateProfile({ image });
      } catch {
        return unreachable;
      }
    },

    refreshSavedPlaces: async () => {
      const { siteUrl, member } = get();
      if (!member) return;
      try {
        const response = await fetch(api(siteUrl, '/saved-places?depth=1&sort=-createdAt&limit=100'), {
          credentials: 'include',
        });
        if (!response.ok) return;
        const body = (await response.json().catch(() => null)) as { docs?: SavedPlaceEntry[] } | null;
        set({ savedPlaces: body?.docs ?? [] });
      } catch {
        // A failed list read keeps the session; saved places just stay empty.
      }
    },

    signOut: async () => {
      const { siteUrl } = get();
      try {
        await fetch(api(siteUrl, '/auth/sign-out'), {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: '{}',
        });
      } finally {
        set({ status: 'signed-out', member: null, savedPlaces: [] });
      }
    },
  };
});

/** The first word of a display name, for the account control's label. */
export const memberFirstName = (member: MemberProfile): string => {
  const name = member.name?.trim();
  const first = name?.split(/\s+/)[0];
  return first ?? member.email;
};
