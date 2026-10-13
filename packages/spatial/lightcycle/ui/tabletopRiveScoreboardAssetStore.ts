'use client';

import { create } from 'zustand';

type ScoreboardAssetStatus = 'idle' | 'loading' | 'ready' | 'failed';

type TabletopRiveScoreboardAssetState = {
  source: string;
  bytes?: ArrayBuffer;
  status: ScoreboardAssetStatus;
  error: string | null;
  load: (source: string) => Promise<void>;
  reset: () => void;
};

export const useTabletopRiveScoreboardAssetStore =
  create<TabletopRiveScoreboardAssetState>((set, get) => {
    let generation = 0;
    // Source equality cannot distinguish reset/reload or A → B → A requests.
    return {
      source: '',
      bytes: undefined,
      status: 'idle',
      error: null,

      load: async (source) => {
        if (!source) {
          generation += 1;
          set({
            source: '',
            bytes: undefined,
            status: 'idle',
            error: null,
          });
          return;
        }

        const current = get();
        if (
          current.source === source &&
          (current.status === 'loading' || current.status === 'ready')
        ) {
          return;
        }

        const request = ++generation;
        set({
          source,
          bytes: undefined,
          status: 'loading',
          error: null,
        });

        try {
          const response = await fetch(source);
          if (!response.ok) {
            throw new Error(
              `Scoreboard .riv request failed (${response.status})`,
            );
          }
          const bytes = await response.arrayBuffer();

          if (request !== generation) return;
          set({ bytes, status: 'ready', error: null });
        } catch (error) {
          if (request !== generation) return;
          set({
            bytes: undefined,
            status: 'failed',
            error:
              error instanceof Error
                ? error.message
                : 'Unable to load scoreboard .riv file.',
          });
        }
      },

      reset: () => {
        generation += 1;
        set({
          source: '',
          bytes: undefined,
          status: 'idle',
          error: null,
        });
      },
    };
  });

export const tabletopRiveScoreboardAsset = {
  getState: useTabletopRiveScoreboardAssetStore.getState,
  load: (source: string) =>
    useTabletopRiveScoreboardAssetStore.getState().load(source),
  reset: () =>
    useTabletopRiveScoreboardAssetStore.getState().reset(),
};
