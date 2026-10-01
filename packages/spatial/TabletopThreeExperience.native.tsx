'use client';

import { Pressable, Text, View } from '@acme/ui/tw';
import { Image } from 'react-native';
import { ThreeLightCycleCanvas } from './lightcycle/three/ThreeLightCycleCanvas.native';
import { McpVoicePlaybackNative } from './mcp/McpVoicePlayback.native';
import type { McpVoiceCueName } from './mcp/mcpVoice';
import { tabletopSoloInput } from './tabletopSoloInputStore';
import { useTabletopSoloDriver } from './useTabletopSoloDriver';
import { useTabletopSessionStore } from './tabletopSessionStore';
import { useTabletopRaceStore } from './tabletopRaceStore';

const LIGHTCYCLE_ASSET =
  process.env.EXPO_PUBLIC_LIGHTCYCLE_GLB_URL ?? undefined;

// Resolve the bundled GLB through React Native's Metro asset registry so
// Three/GLTFLoader receives a URI without introducing component state.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const BUNDLED_MCP_GNM_MODULE = require('./assets/mcp/mcp-gnm-head.glb') as number;
const BUNDLED_MCP_GNM_ASSET =
  Image.resolveAssetSource(BUNDLED_MCP_GNM_MODULE)?.uri;
const MCP_GNM_ASSET =
  process.env.EXPO_PUBLIC_MCP_GNM_GLB_URL ?? BUNDLED_MCP_GNM_ASSET;

const MCP_VOICE_SOURCES: Partial<Record<McpVoiceCueName, number>> = {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  'race-start': require('./assets/mcp/voice/race-start.wav') as number,
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  boost: require('./assets/mcp/voice/boost.wav') as number,
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  'low-energy': require('./assets/mcp/voice/low-energy.wav') as number,
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  'derez-local': require('./assets/mcp/voice/derez-local.wav') as number,
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  'derez-rival': require('./assets/mcp/voice/derez-rival.wav') as number,
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  'round-result': require('./assets/mcp/voice/round-result.wav') as number,
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  'match-end': require('./assets/mcp/voice/end-of-line.wav') as number,
};

function Control({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="min-h-12 min-w-24 items-center justify-center border border-cyan-300/60 bg-black/80 px-4"
    >
      <Text className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-100">
        {label}
      </Text>
    </Pressable>
  );
}

export function TabletopThreeExperience() {
  const playerName = useTabletopSessionStore((state) => state.playerName);
  const state = useTabletopRaceStore((race) => race.hostRenderState);
  const { getState } = useTabletopSoloDriver(playerName);

  return (
    <View className="relative flex-1 overflow-hidden bg-black">
      <McpVoicePlaybackNative state={state} localPlayerId="p1" sources={MCP_VOICE_SOURCES} />

      <ThreeLightCycleCanvas
        getState={getState}
        assetUri={LIGHTCYCLE_ASSET}
        mcpAssetUri={MCP_GNM_ASSET}
        style={{ flex: 1 }}
      />

      <View className="pointer-events-box-none absolute inset-x-0 bottom-5 flex-row items-end justify-between px-5">
        <Control label="Left" onPress={() => tabletopSoloInput.queueTurn(-1)} />

        <Pressable
          onPress={() => {
            tabletopSoloInput.setBoost(true);
            setTimeout(() => tabletopSoloInput.setBoost(false), 450);
          }}
          className="min-h-14 min-w-28 items-center justify-center border border-orange-300/70 bg-orange-500/20 px-4"
        >
          <Text className="text-xs font-bold uppercase tracking-[0.18em] text-orange-100">
            Boost
          </Text>
        </Pressable>

        <Control label="Right" onPress={() => tabletopSoloInput.queueTurn(1)} />
      </View>
    </View>
  );
}
