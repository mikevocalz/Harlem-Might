'use client';

import { useEffect, useRef } from 'react';
import {
  LIGHTCYCLE_FIXED_STEP_MS,
  advanceLightCycleMatch,
  createLightCycleMatch,
  type LightCycleMatchState,
  type LightCycleTurn,
} from './lightcycle/tabletopCore';
import { chooseTabletopAiInput } from './lightcycle/tabletopAi';
import { tabletopRace } from './tabletopRaceStore';
import { tabletopSoloInput } from './tabletopSoloInputStore';

export function useTabletopSoloDriver(playerName: string) {
  const lastFrameAt = useRef(0);
  const accumulator = useRef(0);
  const lastTurnSerial = useRef(-1);
  const stateRef = useRef<LightCycleMatchState | null>(null);

  useEffect(() => {
    const initial = createLightCycleMatch({
      seed: 1982,
      names: { p1: playerName || 'PLAYER', p2: 'GRID AI' },
    });

    stateRef.current = initial;
    tabletopRace.setHostRenderState(initial);
    tabletopSoloInput.reset();
    lastTurnSerial.current = tabletopSoloInput.getState().turnSerial;
    lastFrameAt.current = 0;
    accumulator.current = 0;

    let cancelled = false;
    let frame = 0;

    const loop = (now: number) => {
      if (cancelled) return;

      if (lastFrameAt.current === 0) lastFrameAt.current = now;
      accumulator.current += Math.min(100, now - lastFrameAt.current);
      lastFrameAt.current = now;

      while (accumulator.current >= LIGHTCYCLE_FIXED_STEP_MS) {
        const current = stateRef.current;
        if (!current) break;

        const input = tabletopSoloInput.getState();
        let turn: LightCycleTurn = 0;
        if (input.turnSerial !== lastTurnSerial.current) {
          turn = input.turn;
          lastTurnSerial.current = input.turnSerial;
        }

        const next = advanceLightCycleMatch(current, {
          p1: { turn, boost: input.boostHeld },
          p2: chooseTabletopAiInput(current),
        });
        stateRef.current = next;
        tabletopRace.setHostRenderState(next);
        accumulator.current -= LIGHTCYCLE_FIXED_STEP_MS;
      }

      frame = requestAnimationFrame(loop);
    };

    frame = requestAnimationFrame(loop);

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      tabletopSoloInput.reset();
      tabletopRace.reset();
      stateRef.current = null;
    };
  }, [playerName]);

  return {
    getState: () => stateRef.current,
  };
}
