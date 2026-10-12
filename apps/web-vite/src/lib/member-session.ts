'use client';

import { create } from 'zustand';
import { createMemberAuthActions } from '@acme/app/features/auth/member-auth.ts';
import { createMemberSession } from '@acme/app/features/auth/member-session.ts';
import { PAYLOAD_API_BASE } from './payload.ts';

export type { MemberProfile, SavedPlaceEntry as SavedPlaceRecord } from '@acme/app/features/auth/member-session.ts';

// Bind the exact mount once. Session reads, auth, logout and saved-place writes
// all use the shared owner/lifetime guards, including nondefault API paths.
export const useMemberSession = createMemberSession({ apiBase: PAYLOAD_API_BASE });

type AuthMode = 'login' | 'register';
interface MemberAuthFormState {
  mode: AuthMode;
  email: string;
  password: string;
  name: string;
  error: string | null;
  setMode: (mode: AuthMode) => void;
  setEmail: (email: string) => void;
  setPassword: (password: string) => void;
  setName: (name: string) => void;
  submit: () => Promise<void>;
  signOut: () => Promise<void>;
}

/** Vite presentation only: transient inputs, validation and form feedback. */
export const useMemberAuthForm = create<MemberAuthFormState>((set, get) => {
  const auth = createMemberAuthActions('', useMemberSession);
  return {
    mode: 'login', email: '', password: '', name: '', error: null,
    setMode: (mode) => set({ mode, error: null }),
    setEmail: (email) => set({ email }),
    setPassword: (password) => set({ password }),
    setName: (name) => set({ name }),
    submit: async () => {
      const session = useMemberSession.getState();
      if (session.signOutPending || session.status === 'loading') return;
      const { mode, email, password, name } = get();
      set({ password: '', error: null });
      if (mode === 'register' && !name.trim()) {
        set({ error: 'Add your name to create an account.' });
        return;
      }
      const submitting = mode === 'register'
        ? auth.signUpEmail({ name, email, password })
        : auth.signInEmail({ email, password });
      const boundary = useMemberSession.getState().authBoundary;
      const result = await submitting;
      // Form feedback belongs to the boundary that submitted it. The shared
      // store alone owns cancellation, identity, cookies and saved-place IO.
      if (useMemberSession.getState().authBoundary !== boundary) return;
      set({ error: result.ok ? null : result.message });
    },
    signOut: () => {
      set({ email: '', password: '', name: '', error: null });
      return useMemberSession.getState().signOut();
    },
  };
});
