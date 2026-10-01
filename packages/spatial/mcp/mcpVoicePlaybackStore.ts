import { create } from 'zustand';

type McpVoicePlaybackState = {
  activeKey: string | null;
  seenKeys: Record<string, true>;
  activate: (key: string) => void;
  clear: (key?: string) => void;
  reset: () => void;
};

export const useMcpVoicePlaybackStore = create<McpVoicePlaybackState>((set) => ({
  activeKey: null,
  seenKeys: {},
  activate: (key) =>
    set((state) => {
      if (state.seenKeys[key]) return state;
      return {
        activeKey: key,
        seenKeys: {
          ...state.seenKeys,
          [key]: true,
        },
      };
    }),
  clear: (key) =>
    set((state) => {
      if (key && state.activeKey !== key) return state;
      if (state.activeKey === null) return state;
      return { activeKey: null };
    }),
  reset: () => ({ activeKey: null, seenKeys: {} }),
}));
