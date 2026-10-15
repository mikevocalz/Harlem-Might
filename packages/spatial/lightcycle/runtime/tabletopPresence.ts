import type { LightCyclePlayerId } from '../tabletopCore.ts';
import type { LightCycleLobbyPlayer } from '../sessionProtocol.ts';

/** Compare the exact projection we publish, so optimistic writes converge. */
export function tabletopPresenceUpdate(
  fields: Record<string, unknown>,
  player: {
    playerId: LightCyclePlayerId;
    peerId: string;
    name: string;
    ready: boolean;
    frameLocalized: boolean;
    connected: boolean;
  },
): LightCycleLobbyPlayer | null {
  const desired: LightCycleLobbyPlayer = {
    playerId: player.playerId,
    peerId: player.peerId,
    name: player.name,
    ready: player.ready,
    localized: player.frameLocalized && player.connected,
    connected: player.connected,
    cycleColor: player.playerId === 'p1' ? 'cyan' : 'orange',
  };
  return Object.entries(desired).some(([key, value]) => fields[key] !== value)
    ? desired
    : null;
}
