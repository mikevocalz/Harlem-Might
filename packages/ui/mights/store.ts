import { create } from 'zustand';

// Shell UI state — zustand (repo rule: no bare useState).
export const useShell = create<{ scrolled: boolean; setScrolled: (v: boolean) => void }>((set) => ({
  scrolled: false,
  setScrolled: (scrolled) => set({ scrolled }),
}));
