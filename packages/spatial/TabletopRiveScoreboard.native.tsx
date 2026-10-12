'use client';

import { useEffect, useMemo } from 'react';
import { readLightCycleMatchState } from './lightcycle/replicatedMatchState';
import {
  LIGHTCYCLE_SCOREBOARD_ARTBOARD,
  LIGHTCYCLE_SCOREBOARD_MACHINE,
  createLightCycleRiveBindings,
  createLightCycleScoreboardModel,
  type LightCycleLobbyPresence,
} from './lightcycle/scoreboardModel';
import {
  SpatialRivePanel,
  type SpatialRiveBindings,
} from './SpatialRivePanel.native';
import { useTabletopRiveScoreboardAssetStore } from './tabletopRiveScoreboardAssetStore';

const SCOREBOARD_URL =
  process.env.EXPO_PUBLIC_LIGHTCYCLE_SCOREBOARD_RIV_URL ?? '';

export function TabletopRiveScoreboard({
  replicatedState,
  presence,
  joinCode,
}: {
  replicatedState: unknown;
  presence: LightCycleLobbyPresence;
  joinCode?: string | null;
}) {
  const bytes = useTabletopRiveScoreboardAssetStore(
    (asset) => asset.bytes,
  );
  const loadScoreboard = useTabletopRiveScoreboardAssetStore(
    (asset) => asset.load,
  );

  useEffect(() => {
    void loadScoreboard(SCOREBOARD_URL);
  }, [loadScoreboard]);

  const bindings = useMemo(() => {
    const model = createLightCycleScoreboardModel({
      state: readLightCycleMatchState(replicatedState),
      presence,
      joinCode,
    });
    return createLightCycleRiveBindings(model) as SpatialRiveBindings;
  }, [joinCode, presence, replicatedState]);

  // Both sides display the same authoritative data but are physically oriented
  // toward opposite players.
  return (
    <>
      <SpatialRivePanel
        bytes={bytes}
        bindings={bindings}
        artboard={LIGHTCYCLE_SCOREBOARD_ARTBOARD}
        stateMachine={LIGHTCYCLE_SCOREBOARD_MACHINE}
        position={[0, 0.31, 0.51]}
        rotation={[0, 0, 0]}
        width={0.92}
        height={0.31}
      />
      <SpatialRivePanel
        bytes={bytes}
        bindings={bindings}
        artboard="LightCycleScoreboard"
        stateMachine="Main"
        position={[0, 0.31, -0.51]}
        rotation={[0, 180, 0]}
        width={0.92}
        height={0.31}
      />
    </>
  );
}
