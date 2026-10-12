'use client';

import { useCallback, useEffect } from 'react';
import {
  ViroBox,
  ViroGameLoop,
  ViroNode,
  ViroText,
} from './viro';
import {
  advanceLightCycleMatch,
  createLightCycleMatch,
  getLightCycleActiveTrails,
  LIGHTCYCLE_FIXED_HZ,
  type LightCycleInputEvent,
  type LightCycleMatchState,
  type LightCyclePlayerId,
  type LightCycleTickInputs,
} from './lightcycle/tabletopCore';
import {
  LIGHTCYCLE_METERS_PER_FIXED_UNIT,
} from './lightcycle/assetContract';
import { LIGHTCYCLE_REPLICATION_IDS } from './lightcycle/sessionProtocol';
import { readLightCycleMatchState } from './lightcycle/replicatedMatchState';
import { tabletopRace, useTabletopRaceStore } from './tabletopRaceStore';
import { gridFx } from './rive-fx/store';
import { McpPresence } from './mcp/McpPresence.native';
import { McpVoiceSoundNative } from './mcp/McpVoiceSound.native';
import type { McpVoiceCueName } from './mcp/mcpVoice';

type ReplicatedEntity = {
  id: string;
  fields: Record<string, unknown>;
  version: number;
  owner: string | null;
};

type ReplicationSurface = {
  state: string;
  localPeerId: string;
  byId: (id: string) => ReplicatedEntity | undefined;
  claim: (id: string, opts?: { optimistic?: boolean }) => void;
  set: (
    id: string,
    fields: Record<string, unknown>,
    opts?: { optimistic?: boolean },
  ) => void;
  isMine: (id: string) => boolean;
};

type Props = {
  roomId: string;
  replication: ReplicationSurface;
  localPlayerId: LightCyclePlayerId;
  placementReady: boolean;
  playerNames: Record<LightCyclePlayerId, string>;
  bothReady: boolean;
};

const SNAPSHOT_INTERVAL_TICKS = 6;
const HOST_INPUT_LEAD_TICKS = 2;
const GUEST_INPUT_LEAD_TICKS = 8;
const INPUT_HISTORY_LIMIT = 32;
// Metro already treats GLB as a spatial asset; keep the real GNM head bundled
// for Quest/Pico/offline sessions while allowing a CDN URL override.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const BUNDLED_MCP_GNM_ASSET = require('./assets/mcp/mcp-gnm-head.glb') as number;
const MCP_GNM_ASSET_SOURCE = process.env.EXPO_PUBLIC_MCP_GNM_GLB_URL
  ? { uri: process.env.EXPO_PUBLIC_MCP_GNM_GLB_URL }
  : BUNDLED_MCP_GNM_ASSET;

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

function isInputEvent(value: unknown): value is LightCycleInputEvent {
  if (!value || typeof value !== 'object') return false;
  const event = value as Partial<LightCycleInputEvent>;
  return (
    (event.playerId === 'p1' || event.playerId === 'p2') &&
    typeof event.sequence === 'number' &&
    Number.isSafeInteger(event.sequence) &&
    typeof event.targetTick === 'number' &&
    Number.isSafeInteger(event.targetTick) &&
    (event.command === 'TURN_LEFT' ||
      event.command === 'TURN_RIGHT' ||
      event.command === 'BOOST_DOWN' ||
      event.command === 'BOOST_UP')
  );
}

function readInputEvents(value: unknown) {
  return Array.isArray(value) ? value.filter(isInputEvent) : [];
}

function roomSeed(roomId: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < roomId.length; index += 1) {
    hash ^= roomId.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash || 1982;
}

function toMeters(value: number) {
  return value * LIGHTCYCLE_METERS_PER_FIXED_UNIT;
}

function TrailWall({
  owner,
  from,
  to,
}: {
  owner: LightCyclePlayerId;
  from: { x: number; z: number };
  to: { x: number; z: number };
}) {
  const x0 = toMeters(from.x);
  const z0 = toMeters(from.z);
  const x1 = toMeters(to.x);
  const z1 = toMeters(to.z);
  const dx = Math.abs(x1 - x0);
  const dz = Math.abs(z1 - z0);
  const length = Math.max(dx, dz);
  if (length < 0.004) return null;

  return (
    <ViroBox
      position={[(x0 + x1) / 2, 0.075, (z0 + z1) / 2]}
      scale={
        dx >= dz
          ? [Math.max(0.004, length), 0.095, 0.012]
          : [0.012, 0.095, Math.max(0.004, length)]
      }
      materials={[owner === 'p1' ? 'raceCyan' : 'raceOrange']}
    />
  );
}

function Rider({
  id,
  state,
}: {
  id: LightCyclePlayerId;
  state: LightCycleMatchState;
}) {
  const rider = state.riders[id];
  if (!rider.alive) return null;

  const x = toMeters(rider.position.x);
  const z = toMeters(rider.position.z);
  const material = id === 'p1' ? 'raceCyan' : 'raceOrange';

  return (
    <ViroNode
      position={[x, 0.075, z]}
      rotation={[0, rider.direction * 90, 0]}
    >
      <ViroBox scale={[0.07, 0.045, 0.13]} materials={[material]} />
      <ViroBox
        position={[0, 0.055, 0.015]}
        scale={[0.035, 0.04, 0.055]}
        materials={['raceDark']}
      />
      <ViroBox
        position={[-0.065, -0.025, 0]}
        scale={[0.018, 0.06, 0.05]}
        materials={[material]}
      />
      <ViroBox
        position={[0.065, -0.025, 0]}
        scale={[0.018, 0.06, 0.05]}
        materials={[material]}
      />
    </ViroNode>
  );
}

function RaceVisual({ state }: { state: LightCycleMatchState }) {
  const trails = [...state.trails, ...getLightCycleActiveTrails(state)];
  const countdown =
    state.phase === 'countdown'
      ? Math.max(1, Math.ceil(state.countdownTicks / LIGHTCYCLE_FIXED_HZ))
      : null;

  let status = 'GRID';
  if (countdown !== null) status = String(countdown);
  else if (state.phase === 'round-over') {
    status =
      state.roundWinner === 'draw'
        ? 'DOUBLE DEREZ'
        : (state.roundWinner ?? '').toUpperCase() + ' +1';
  } else if (state.phase === 'match-over') {
    status =
      (state.matchWinner ?? 'GRID').toUpperCase() + ' WINS';
  }

  return (
    <ViroNode>
      {trails.map((trail) => (
        <TrailWall
          key={String(trail.owner) + '-' + String(trail.id)}
          owner={trail.owner}
          from={trail.from}
          to={trail.to}
        />
      ))}

      <Rider id="p1" state={state} />
      <Rider id="p2" state={state} />

      <ViroText
        text={status}
        position={[0, 0.22, 0]}
        rotation={[-90, 0, 0]}
        width={0.65}
        height={0.1}
        style={{ fontSize: 14, color: '#fff6cf', textAlign: 'center' }}
      />
      <ViroText
        text={
          'P1 ' +
          String(state.scores.p1) +
          '  ·  ROUND ' +
          String(state.round) +
          '  ·  P2 ' +
          String(state.scores.p2)
        }
        position={[0, 0.18, -0.3]}
        rotation={[-90, 0, 0]}
        width={0.9}
        height={0.08}
        style={{ fontSize: 9, color: '#00f3ff', textAlign: 'center' }}
      />
    </ViroNode>
  );
}

function ControlButton({
  label,
  x,
  tone,
  onClick,
}: {
  label: string;
  x: number;
  tone: 'cyan' | 'orange';
  onClick: () => void;
}) {
  return (
    <ViroNode>
      <ViroBox
        position={[x, 0.11, 0.34]}
        scale={[0.12, 0.035, 0.06]}
        materials={[tone === 'cyan' ? 'raceCyan' : 'raceOrange']}
        onClick={onClick}
      />
      <ViroText
        text={label}
        position={[x, 0.15, 0.34]}
        rotation={[-90, 0, 0]}
        width={0.22}
        height={0.06}
        style={{ fontSize: 8, color: '#020407', textAlign: 'center' }}
      />
    </ViroNode>
  );
}

export function TabletopRaceRuntime({
  roomId,
  replication,
  localPlayerId,
  placementReady,
  playerNames,
  bothReady,
}: Props) {
  const isHost = localPlayerId === 'p1';
  const inputId = LIGHTCYCLE_REPLICATION_IDS.input(localPlayerId);
  const snapshotId = LIGHTCYCLE_REPLICATION_IDS.snapshot;
  const matchId = LIGHTCYCLE_REPLICATION_IDS.match;

  const inputEntity = replication.byId(inputId);
  const snapshotEntity = replication.byId(snapshotId);

  const roomRuntime = useTabletopRaceStore((state) =>
    state.roomRuntime?.roomId === roomId ? state.roomRuntime : null,
  );
  const hostRenderState = useTabletopRaceStore((state) =>
    state.roomRuntime?.roomId === roomId ? state.hostRenderState : null,
  );

  useEffect(() => {
    if (replication.state !== 'synced') return;
    if (!inputEntity) {
      replication.claim(inputId);
    }
    if (isHost && !snapshotEntity) {
      replication.claim(snapshotId);
    }
  }, [
    inputEntity,
    inputId,
    isHost,
    replication,
    snapshotEntity,
    snapshotId,
  ]);

  const guestState = readLightCycleMatchState(snapshotEntity?.fields.state);
  const displayState = isHost ? hostRenderState : guestState;

  const sendCommand = useCallback(
    (command: LightCycleInputEvent['command'], offsetTicks = 0) => {
      const runtime = tabletopRace.getState().roomRuntime;
      if (
        !runtime ||
        runtime !== roomRuntime ||
        !placementReady ||
        !bothReady ||
        replication.state !== 'synced'
      ) {
        return;
      }
      const currentEntity = replication.byId(inputId);
      if (!currentEntity) {
        replication.claim(inputId);
        return;
      }
      if (!replication.isMine(inputId)) return;

      const existing = readInputEvents(currentEntity.fields.events);
      for (const event of existing) {
        if (event.sequence > runtime.localSequence) {
          runtime.localSequence = event.sequence;
        }
      }

      const baseTick = displayState?.tick ?? 0;
      const lead = isHost ? HOST_INPUT_LEAD_TICKS : GUEST_INPUT_LEAD_TICKS;
      const event: LightCycleInputEvent = {
        playerId: localPlayerId,
        sequence: runtime.localSequence + 1,
        targetTick: baseTick + lead + offsetTicks,
        command,
      };
      runtime.localSequence = event.sequence;

      const merged = [
        ...existing.filter(
          (item) =>
            item.sequence !== event.sequence &&
            item.playerId === localPlayerId,
        ),
        ...runtime.localHistory,
        event,
      ]
        .sort((a, b) => a.sequence - b.sequence)
        .filter(
          (item, index, list) =>
            index === 0 || item.sequence !== list[index - 1]?.sequence,
        )
        .slice(-INPUT_HISTORY_LIMIT);

      runtime.localHistory = merged;
      replication.set(
        inputId,
        { events: merged },
        { optimistic: true },
      );
    },
    [
      bothReady,
      displayState?.tick,
      inputId,
      isHost,
      localPlayerId,
      placementReady,
      replication,
      roomRuntime,
    ],
  );

  const pulseBoost = useCallback(() => {
    if (
      !roomRuntime ||
      tabletopRace.getState().roomRuntime !== roomRuntime ||
      !placementReady ||
      !bothReady ||
      replication.state !== 'synced'
    ) {
      return;
    }
    sendCommand('BOOST_DOWN');
    sendCommand('BOOST_UP', Math.round(LIGHTCYCLE_FIXED_HZ * 0.45));
    gridFx.emit({
      type: 'boost',
      intensity: 0.9,
      localPlayer: localPlayerId,
      playerColor: localPlayerId === 'p1' ? '#00f3ff' : '#ff7a00',
      opponentColor: localPlayerId === 'p1' ? '#ff7a00' : '#00f3ff',
      velocity: displayState?.riders[localPlayerId].speedUnitsPerTick ?? 0,
    });
  }, [
    bothReady,
    displayState,
    localPlayerId,
    placementReady,
    replication.state,
    roomRuntime,
    sendCommand,
  ]);

  useEffect(() => {
    const runtime = tabletopRace.getState().roomRuntime;
    if (
      !runtime ||
      runtime !== roomRuntime ||
      !displayState?.derezEvents.length
    ) return;

    for (const event of displayState.derezEvents) {
      if (event.tick <= runtime.lastDerezFxTick) continue;
      runtime.lastDerezFxTick = event.tick;

      const playerColor = event.playerId === 'p1' ? '#00f3ff' : '#ff7a00';
      const opponentColor = event.playerId === 'p1' ? '#ff7a00' : '#00f3ff';

      gridFx.emit({
        type: 'derez',
        seed: event.seed,
        intensity: 1,
        playerColor,
        opponentColor,
        localPlayer: localPlayerId,
        winner:
          event.byPlayerId === 'p1'
            ? 'p1'
            : event.byPlayerId === 'p2'
              ? 'p2'
              : 'none',
        collisionCause: event.cause,
        world: {
          x: toMeters(event.point.x),
          y: 0.08,
          z: toMeters(event.point.z),
        },
      });
    }
  }, [displayState, localPlayerId, roomRuntime]);

  const onFixedUpdate = useCallback(() => {
    const runtime = tabletopRace.getState().roomRuntime;
    if (
      !runtime ||
      runtime !== roomRuntime ||
      !isHost ||
      !placementReady ||
      !bothReady ||
      replication.state !== 'synced'
    ) {
      return;
    }

    if (!runtime.hostState) {
      const initial = createLightCycleMatch({
        seed: roomSeed(roomId),
        names: playerNames,
      });
      runtime.hostState = initial;
      runtime.queue.clear();
      runtime.boostHeld = { p1: false, p2: false };
      tabletopRace.setRoomRenderState(runtime, initial);
    }

    const current = runtime.hostState;
    if (!current) return;

    for (const id of ['p1', 'p2'] as LightCyclePlayerId[]) {
      const entity = replication.byId(
        LIGHTCYCLE_REPLICATION_IDS.input(id),
      );
      const events = readInputEvents(entity?.fields.events);
      for (const event of events) {
        if (event.sequence <= runtime.seenSequence[id]) continue;
        runtime.seenSequence[id] = event.sequence;
        runtime.queue.push(event, current.tick);
      }
    }

    const nextTick = current.tick + 1;
    const events = runtime.queue.drain(nextTick);
    const tickInputs: LightCycleTickInputs = {};

    for (const event of events) {
      if (event.command === 'BOOST_DOWN') {
        runtime.boostHeld[event.playerId] = true;
      } else if (event.command === 'BOOST_UP') {
        runtime.boostHeld[event.playerId] = false;
      } else {
        tickInputs[event.playerId] = {
          ...(tickInputs[event.playerId] ?? {}),
          turn: event.command === 'TURN_LEFT' ? -1 : 1,
        };
      }
    }

    for (const id of ['p1', 'p2'] as LightCyclePlayerId[]) {
      tickInputs[id] = {
        ...(tickInputs[id] ?? {}),
        boost: runtime.boostHeld[id],
      };
    }

    const next = advanceLightCycleMatch(current, tickInputs);
    runtime.hostState = next;

    if (next.round !== current.round) {
      runtime.queue.clear();
      runtime.boostHeld = { p1: false, p2: false };
    }

    if (next.tick % 2 === 0 || next.phase !== current.phase) {
      tabletopRace.setRoomRenderState(runtime, next);
    }

    if (
      next.tick % SNAPSHOT_INTERVAL_TICKS === 0 ||
      next.phase !== current.phase ||
      next.round !== current.round
    ) {
      if (replication.isMine(snapshotId)) {
        replication.set(
          snapshotId,
          { state: next },
          { optimistic: true },
        );
      }

      const match = replication.byId(matchId);
      if (match && replication.isMine(matchId)) {
        replication.set(
          matchId,
          {
            phase: next.phase,
            tick: next.tick,
            round: next.round,
            score: next.scores,
            winner: next.matchWinner,
          },
          { optimistic: true },
        );
      }
    }
  }, [
    bothReady,
    isHost,
    matchId,
    placementReady,
    playerNames,
    replication,
    roomId,
    roomRuntime,
    snapshotId,
  ]);

  if (!roomRuntime || !placementReady) return null;

  return (
    <ViroNode>
      <ViroGameLoop fixedHz={LIGHTCYCLE_FIXED_HZ} onFixedUpdate={onFixedUpdate} />

      {displayState ? (
        <>
          <RaceVisual state={displayState} />
          <McpPresence
            state={displayState}
            localPlayerId={localPlayerId}
            assetSource={MCP_GNM_ASSET_SOURCE}
          />
          <McpVoiceSoundNative
            state={displayState}
            localPlayerId={localPlayerId}
            sources={MCP_VOICE_SOURCES}
          />

          {bothReady && displayState.phase === 'running' ? (
            <>
              <ControlButton
                label="LEFT"
                x={-0.28}
                tone="cyan"
                onClick={() => sendCommand('TURN_LEFT')}
              />
              <ControlButton
                label="BOOST"
                x={0}
                tone="orange"
                onClick={pulseBoost}
              />
              <ControlButton
                label="RIGHT"
                x={0.28}
                tone="cyan"
                onClick={() => sendCommand('TURN_RIGHT')}
              />
            </>
          ) : null}
        </>
      ) : (
        <ViroText
          text={
            bothReady
              ? 'HOST STARTING SYNCHRONIZED COUNTDOWN…'
              : 'WAITING FOR BOTH PLAYERS'
          }
          position={[0, 0.18, 0]}
          rotation={[-90, 0, 0]}
          width={0.9}
          height={0.1}
          style={{ fontSize: 10, color: '#fff6cf', textAlign: 'center' }}
        />
      )}
    </ViroNode>
  );
}
