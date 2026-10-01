'use client';

import { useEffect, useMemo } from 'react';
import {
  useRive,
  useViewModel,
  useViewModelInstance,
  type ViewModelInstance,
} from '@rive-app/react-webgl2';
import { View } from '@acme/ui/tw';
import {
  LIGHTCYCLE_SCOREBOARD_ARTBOARD,
  LIGHTCYCLE_SCOREBOARD_MACHINE,
  LIGHTCYCLE_SCOREBOARD_VIEW_MODEL,
  createLightCycleRiveBindings,
  createLightCycleScoreboardModel,
  type LightCycleLobbyPresence,
  type LightCycleRiveBindings,
} from './lightcycle/scoreboardModel';
import type { LightCycleMatchState } from './lightcycle/tabletopCore';

const SCOREBOARD_URL =
  process.env.NEXT_PUBLIC_LIGHTCYCLE_SCOREBOARD_RIV_URL ?? '';

function applyScoreboardBindings(
  instance: ViewModelInstance,
  bindings: LightCycleRiveBindings,
) {
  for (const [path, binding] of Object.entries(bindings)) {
    if (typeof binding === 'string') {
      const property = instance.string(path);
      if (property) property.value = binding;
      continue;
    }
    if (typeof binding === 'number') {
      const property = instance.number(path);
      if (property) property.value = binding;
      continue;
    }
    if (typeof binding === 'boolean') {
      const property = instance.boolean(path);
      if (property) property.value = binding;
      continue;
    }
    if (binding.kind === 'enum') {
      const property = instance.enum(path);
      if (property) property.value = binding.value;
      continue;
    }
    if (binding.kind === 'color') {
      const property = instance.color(path);
      if (property) property.value = binding.value;
    }
  }
}

function BoundWebScoreboard({
  source,
  state,
  presence,
  joinCode,
  className,
  height,
}: {
  source: string;
  state: LightCycleMatchState | null;
  presence?: LightCycleLobbyPresence;
  joinCode?: string | null;
  className?: string;
  height: number;
}) {
  const { rive, RiveComponent } = useRive({
    src: source,
    artboard: LIGHTCYCLE_SCOREBOARD_ARTBOARD,
    stateMachines: LIGHTCYCLE_SCOREBOARD_MACHINE,
    autoplay: true,
    autoBind: false,
  });

  const viewModel = useViewModel(rive, {
    name: LIGHTCYCLE_SCOREBOARD_VIEW_MODEL,
  });
  const instance = useViewModelInstance(viewModel, {
    useDefault: true,
    rive,
  });

  const bindings = useMemo(
    () =>
      createLightCycleRiveBindings(
        createLightCycleScoreboardModel({
          state,
          presence,
          joinCode,
        }),
      ),
    [joinCode, presence, state],
  );

  useEffect(() => {
    if (!instance) return;
    applyScoreboardBindings(instance, bindings);
  }, [bindings, instance]);

  return (
    <View
      className={`overflow-hidden border border-cyan-300/25 bg-black/55 ${className ?? ''}`}
      style={{ height }}
    >
      <RiveComponent style={{ width: '100%', height: '100%' }} />
    </View>
  );
}

/**
 * Web/Three scoreboard using the exact same MatchScoreboard View Model paths
 * as the native ViroRivePanel. No second HUD state model is introduced.
 */
export function TabletopRiveScoreboardWeb({
  state,
  presence,
  joinCode,
  className,
  height = 150,
  source = SCOREBOARD_URL,
}: {
  state: LightCycleMatchState | null;
  presence?: LightCycleLobbyPresence;
  joinCode?: string | null;
  className?: string;
  height?: number;
  source?: string;
}) {
  if (!source) return null;

  return (
    <BoundWebScoreboard
      source={source}
      state={state}
      presence={presence}
      joinCode={joinCode}
      className={className}
      height={height}
    />
  );
}
