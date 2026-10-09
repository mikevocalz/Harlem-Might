'use client';

import { create } from 'zustand';

// Form state for the shared member auth screen. In-memory only: passwords are
// never persisted, logged, put in URLs, or kept after a submit attempt ends.
interface MemberAuthState {
  name: string;
  email: string;
  password: string;
  pending: boolean;
  error: string | null;
  setField: (field: 'name' | 'email' | 'password', value: string) => void;
  begin: () => void;
  fail: (message: string) => void;
  succeed: () => void;
}

export const useMemberAuth = create<MemberAuthState>((set) => ({
  name: '',
  email: '',
  password: '',
  pending: false,
  error: null,
  setField: (field, value) => set({ [field]: value, error: null }),
  begin: () => set({ pending: true, error: null }),
  fail: (message) => set({ pending: false, password: '', error: message }),
  succeed: () => set({ name: '', email: '', password: '', pending: false, error: null }),
}));
