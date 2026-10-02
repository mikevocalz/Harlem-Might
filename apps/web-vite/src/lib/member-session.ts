'use client';

import { create } from 'zustand';
import { PAYLOAD_API_BASE, type CmsPlace } from './payload';

export interface MemberProfile {
  id: number | string;
  email: string;
  name?: string | null;
  avatar?: number | string | { id: number | string; url?: string | null } | null;
}

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

const getMember = async () => {
  const result = await request<{ user?: MemberProfile | null }>('/members/me');
  return result.user ?? null;
};

const getSavedPlaces = async () => {
  const result = await request<{ docs: SavedPlaceRecord[] }>(
    '/saved-places?depth=1&sort=-createdAt&limit=100',
  );
  return result.docs;
};

export const useMemberSession = create<MemberSessionState>((set, get) => ({
  status: 'idle',
  mode: 'login',
  member: null,
  savedPlaces: [],
  email: '',
  password: '',
  name: '',
  error: null,

  setMode: (mode) => set({ mode, error: null }),
  setEmail: (email) => set({ email }),
  setPassword: (password) => set({ password }),
  setName: (name) => set({ name }),

  hydrate: async () => {
    if (get().status !== 'idle') return;
    set({ status: 'loading', error: null });

    try {
      const member = await getMember();
      if (!member) {
        set({ status: 'signed-out', member: null, savedPlaces: [] });
        return;
      }

      set({ status: 'signed-in', member });
      await get().refreshSavedPlaces();
    } catch {
      set({ status: 'signed-out', member: null, savedPlaces: [] });
    }
  },

  submit: async () => {
    const { mode, email, password, name } = get();
    set({ status: 'loading', error: null });

    try {
      if (mode === 'register') {
        if (!name.trim()) throw new Error('Add your name to create an account.');
        await request('/members', {
          method: 'POST',
          body: JSON.stringify({ email: email.trim(), password, name: name.trim() }),
        });
      }

      const result = await request<{ user: MemberProfile }>('/members/login', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), password }),
      });

      set({
        status: 'signed-in',
        member: result.user,
        password: '',
        error: null,
      });
      await get().refreshSavedPlaces();
    } catch (error) {
      set({
        status: 'signed-out',
        password: '',
        error: error instanceof Error ? error.message : 'Could not sign in.',
      });
    }
  },

  signOut: async () => {
    try {
      await request('/members/logout', { method: 'POST' });
    } finally {
      set({
        status: 'signed-out',
        member: null,
        savedPlaces: [],
        email: '',
        password: '',
        name: '',
        error: null,
      });
    }
  },

  refreshSavedPlaces: async () => {
    if (!get().member) return;
    try {
      const savedPlaces = await getSavedPlaces();
      set({ savedPlaces });
    } catch (error) {
      set({
        error:
          error instanceof Error ? error.message : 'Could not load your saved places.',
      });
    }
  },

  savePlace: async (placeId) => {
    await request('/saved-places', {
      method: 'POST',
      body: JSON.stringify({ place: placeId }),
    });
    await get().refreshSavedPlaces();
  },

  removeSavedPlace: async (savedPlaceId) => {
    await request(`/saved-places/${savedPlaceId}`, { method: 'DELETE' });
    await get().refreshSavedPlaces();
  },
}));
