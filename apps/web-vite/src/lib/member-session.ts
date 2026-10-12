'use client';

import { create } from 'zustand';
import { PAYLOAD_API_BASE, type CmsPlace } from './payload.ts';

// Reuse the Better Auth session shape consumed by the other supported hosts.
import type { MemberProfile } from '@acme/app/features/auth/member-session.ts';
export type { MemberProfile } from '@acme/app/features/auth/member-session.ts';

export interface SavedPlaceRecord {
  id: number | string;
  place: number | string | CmsPlace;
  createdAt: string;
}

type AuthMode = 'login' | 'register';
type SessionStatus = 'idle' | 'loading' | 'signed-out' | 'signed-in';

interface MemberSessionState {
  status: SessionStatus;
  mode: AuthMode;
  member: MemberProfile | null;
  savedPlaces: SavedPlaceRecord[];
  email: string;
  password: string;
  name: string;
  error: string | null;
  signOutError: string | null;
  signOutPending: boolean;
  setMode: (mode: AuthMode) => void;
  setEmail: (email: string) => void;
  setPassword: (password: string) => void;
  setName: (name: string) => void;
  hydrate: () => Promise<void>;
  submit: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshSavedPlaces: () => Promise<void>;
  savePlace: (placeId: number | string) => Promise<void>;
  removeSavedPlace: (savedPlaceId: number | string) => Promise<void>;
}

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`${PAYLOAD_API_BASE}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  const body = (await response.json().catch(() => null)) as
    | ({ message?: string; errors?: { message?: string }[] } & T)
    | null;

  if (!response.ok) {
    throw new Error(
      body?.errors?.[0]?.message ??
        body?.message ??
        `Request failed with status ${response.status}`,
    );
  }

  return body as T;
};

const getMember = async (signal: AbortSignal) => {
  const result = await request<{ user?: MemberProfile | null }>('/auth/get-session', { signal });
  return result.user ?? null;
};

const getSavedPlaces = async () => {
  const result = await request<{ docs: SavedPlaceRecord[] }>(
    '/saved-places?depth=1&sort=-createdAt&limit=100',
  );
  if (!result || !Array.isArray(result.docs)) throw new Error('Invalid saved-place response.');
  return result.docs;
};

export const useMemberSession = create<MemberSessionState>((set, get) => {
  let generation = 0;
  let authentication: AbortController | null = null;
  let logout: Promise<void> | null = null;
  const currentOwner = (owner: MemberProfile, scope: number) =>
    generation === scope && get().member === owner;
  return ({
  status: 'idle',
  mode: 'login',
  member: null,
  savedPlaces: [],
  email: '',
  password: '',
  name: '',
  error: null,
  signOutError: null,
  signOutPending: false,

  setMode: (mode) => set({ mode, error: null }),
  setEmail: (email) => set({ email }),
  setPassword: (password) => set({ password }),
  setName: (name) => set({ name }),

  hydrate: async () => {
    if (get().status !== 'idle' || logout) return;
    const scope = ++generation;
    const controller = new AbortController();
    authentication?.abort();
    authentication = controller;
    set({ status: 'loading', error: null });

    try {
      const member = await getMember(controller.signal);
      if (scope !== generation) return;
      if (!member) {
        set({ status: 'signed-out', member: null, savedPlaces: [] });
        return;
      }

      set({ status: 'signed-in', member });
      await get().refreshSavedPlaces();
    } catch {
      if (scope === generation) set({ status: 'signed-out', member: null, savedPlaces: [], error: 'Could not load your account. Check your connection and try again.' });
    } finally {
      if (authentication === controller) authentication = null;
    }
  },

  submit: async () => {
    if (logout || get().status === 'loading') return;
    const { mode, email, password, name } = get();
    const scope = ++generation;
    const controller = new AbortController();
    authentication?.abort();
    authentication = controller;
    set({ status: 'loading', member: null, savedPlaces: [], error: null, signOutError: null });

    try {
      if (mode === 'register') {
        if (!name.trim()) throw new Error('Add your name to create an account.');
        await request('/auth/sign-up/email', {
          signal: controller.signal,
          method: 'POST',
          body: JSON.stringify({ email: email.trim(), password, name: name.trim() }),
        });
      }

      if (scope !== generation) return;
      const result = await request<{ user: MemberProfile }>('/auth/sign-in/email', {
        signal: controller.signal,
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), password }),
      });

      if (scope !== generation) return;
      set({
        status: 'signed-in',
        member: result.user,
        password: '',
        error: null,
      });
      await get().refreshSavedPlaces();
    } catch (error) {
      if (scope !== generation) return;
      set({
        status: 'signed-out',
        password: '',
        error: error instanceof Error ? error.message : 'Could not sign in.',
      });
    } finally {
      if (authentication === controller) authentication = null;
    }
  },

  signOut: () => {
    if (logout) return logout;
    const scope = ++generation;
    authentication?.abort();
    authentication = null;
    // Clear private local state immediately; do not claim the cookie was
    // revoked until the server confirms the request.
    set({ status: 'signed-out', member: null, savedPlaces: [], email: '', password: '', name: '', error: null, signOutError: null, signOutPending: true });
    logout = (async () => {
      try {
        await request('/auth/sign-out', { method: 'POST' });
      } catch {
        if (scope === generation) set({ signOutError: 'Sign-out could not be confirmed. Check your connection and retry before leaving this device.' });
      } finally {
        if (scope === generation) set({ signOutPending: false });
      }
    })().finally(() => { logout = null; });
    return logout;
  },

  refreshSavedPlaces: async () => {
    const owner = get().member;
    const scope = generation;
    if (!owner) return;
    try {
      const savedPlaces = await getSavedPlaces();
      if (currentOwner(owner, scope)) set({ savedPlaces, error: null });
    } catch {
      if (currentOwner(owner, scope)) set({ error: 'Could not load your saved places. Check your connection and try again.' });
    }
  },

  savePlace: async (placeId) => {
    const owner = get().member;
    const scope = generation;
    if (!owner) return;
    try {
      await request('/saved-places', { method: 'POST', body: JSON.stringify({ place: placeId }) });
      if (currentOwner(owner, scope)) await get().refreshSavedPlaces();
    } catch {
      if (currentOwner(owner, scope)) set({ error: 'Could not save this place. Check your connection and try again.' });
    }
  },

  removeSavedPlace: async (savedPlaceId) => {
    const owner = get().member;
    const scope = generation;
    if (!owner) return;
    try {
      await request(`/saved-places/${savedPlaceId}`, { method: 'DELETE' });
      if (currentOwner(owner, scope)) await get().refreshSavedPlaces();
    } catch {
      if (currentOwner(owner, scope)) set({ error: 'Could not remove this place. Check your connection and try again.' });
    }
  },
  });
});
