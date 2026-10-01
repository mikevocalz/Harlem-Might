import { create } from 'zustand';
import { setThemePreference, type ThemePreference } from '@acme/theme/switch';

// Profile + settings state — zustand always (repo rule).
// Same pinned-avatar scheme as the schedule roster (see fixtures.ts).
export const AVATAR_URI =
  'https://api.dicebear.com/9.x/avataaars/png?size=256&eyes=default&mouth=smile&eyebrows=default' +
  '&seed=nina&top=curly&hairColor=2c1b18&skinColor=d08b5b&clothing=blazerAndShirt';

interface ProfileState {
  name: string;
  handle: string;
  email: string;
  notifications: boolean;
  digest: boolean;
  publicProfile: boolean;
  theme: ThemePreference;
  setName: (name: string) => void;
  setEmail: (email: string) => void;
  setNotifications: (v: boolean) => void;
  setDigest: (v: boolean) => void;
  setPublicProfile: (v: boolean) => void;
  setTheme: (theme: ThemePreference) => void;
}

export const useProfile = create<ProfileState>((set) => ({
  name: 'Nina Alvarez',
  handle: '@nina',
  email: 'nina@example.com',
  notifications: true,
  digest: false,
  publicProfile: true,
  theme: 'system',
  setName: (name) => set({ name }),
  setEmail: (email) => set({ email }),
  setNotifications: (notifications) => set({ notifications }),
  setDigest: (digest) => set({ digest }),
  setPublicProfile: (publicProfile) => set({ publicProfile }),
  setTheme: (theme) => { setThemePreference(theme); set({ theme }); },
}));

export type { ThemePreference };
