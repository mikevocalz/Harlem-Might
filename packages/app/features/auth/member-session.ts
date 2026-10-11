'use client';

// The signed-in member, shared by every surface that needs to know (navbar
// account control, profile page, the auth screen's already-signed-in redirect).
// Session state lives in the cookie, so this store only mirrors what
// `/payload-api/auth/get-session` last said — it never holds credentials.

import { create } from 'zustand';

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
