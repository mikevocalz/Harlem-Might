import { create } from 'zustand';

// Route parity with the mobile shell: tabs (home/explore/notifications/profile)
// + the drawer's settings entry.
export const NAV_ITEMS = [
  { label: 'Home', href: '/' },
  { label: 'Explore', href: '/explore' },
  { label: 'Schedule', href: '/schedule' },
  { label: 'Spatial', href: '/spatial' },
  { label: 'Notifications', href: '/notifications' },
] as const;

// Profile (with settings inside) gets the avatar slot, not a text link.
export const PROFILE = { label: 'Profile', href: '/profile' } as const;

// Menu state — zustand always (repo rule).
export const useMobileMenu = create<{ open: boolean; toggle: () => void; close: () => void }>(
  (set) => ({
    open: false,
    toggle: () => set((s) => ({ open: !s.open })),
    close: () => set({ open: false }),
  }),
);
