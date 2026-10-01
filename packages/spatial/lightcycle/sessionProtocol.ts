import type {
  LightCycleInputEvent,
  LightCycleMatchState,
  LightCyclePhase,
  LightCyclePlayerId,
} from './tabletopCore.ts';
import { lightCycleStateHash } from './tabletopCore.ts';

export const LIGHTCYCLE_REPLICATION_IDS = {
  match: 'lightcycle:match',
  placement: 'lightcycle:placement',
  player: (id: LightCyclePlayerId) => `lightcycle:player:${id}`,
  input: (id: LightCyclePlayerId) => `lightcycle:input:${id}`,
  snapshot: 'lightcycle:snapshot',
} as const;

export type LightCycleLobbyPlayer = {
  playerId: LightCyclePlayerId;
  peerId: string;
  name: string;
  ready: boolean;
  localized: boolean;
  connected: boolean;
  cycleColor: 'cyan' | 'orange';
};

export type LightCycleAuthoritativeSnapshot = {
  tick: number;
  round: number;
  phase: LightCyclePhase;
  players: Record<
    LightCyclePlayerId,
    {
      x: number;
      z: number;
      direction: 0 | 1 | 2 | 3;
      speedUnitsPerTick: number;
      energy: number;
      alive: boolean;
    }
  >;
  score: Record<LightCyclePlayerId, number>;
  stateHash: string;
};

export type LightCycleQueuedInput = LightCycleInputEvent & {
  receivedAtMs?: number;
};

export function createAuthoritativeSnapshot(
  state: LightCycleMatchState,
): LightCycleAuthoritativeSnapshot {
  return {
    tick: state.tick,
    round: state.round,
    phase: state.phase,
    players: {
      p1: {
        x: state.riders.p1.position.x,
        z: state.riders.p1.position.z,
        direction: state.riders.p1.direction,
        speedUnitsPerTick: state.riders.p1.speedUnitsPerTick,
        energy: state.riders.p1.energy,
        alive: state.riders.p1.alive,
      },
      p2: {
        x: state.riders.p2.position.x,
        z: state.riders.p2.position.z,
        direction: state.riders.p2.direction,
        speedUnitsPerTick: state.riders.p2.speedUnitsPerTick,
        energy: state.riders.p2.energy,
        alive: state.riders.p2.alive,
      },
    },
    score: { ...state.scores },
    stateHash: lightCycleStateHash(state),
  };
}

/**
 * Sparse control-event queue for the host-authoritative simulation.
 * It rejects duplicate/stale sequence numbers and never accepts an event
 * targeted at a tick that has already been committed.
 */
export class LightCycleInputQueue {
  private readonly highestSequence: Record<LightCyclePlayerId, number> = {
    p1: -1,
    p2: -1,
  };

  private readonly events = new Map<number, LightCycleQueuedInput[]>();

  push(event: LightCycleQueuedInput, committedTick: number) {
    if (!Number.isSafeInteger(event.sequence) || event.sequence < 0) {
      return { accepted: false as const, reason: 'invalid-sequence' as const };
    }
    if (!Number.isSafeInteger(event.targetTick) || event.targetTick <= committedTick) {
      return { accepted: false as const, reason: 'stale-tick' as const };
    }
    if (event.sequence <= this.highestSequence[event.playerId]) {
      return { accepted: false as const, reason: 'duplicate-sequence' as const };
    }

    this.highestSequence[event.playerId] = event.sequence;
    const list = this.events.get(event.targetTick) ?? [];
    list.push(event);
    list.sort((a, b) =>
      a.playerId === b.playerId
        ? a.sequence - b.sequence
        : a.playerId.localeCompare(b.playerId),
    );
    this.events.set(event.targetTick, list);
    return { accepted: true as const };
  }

  drain(tick: number) {
    const events = this.events.get(tick) ?? [];
    this.events.delete(tick);
    return events;
  }

  clear() {
    this.events.clear();
    this.highestSequence.p1 = -1;
    this.highestSequence.p2 = -1;
  }
}

export function inputsForTick(
  events: readonly LightCycleQueuedInput[],
) {
  const result: Partial<
    Record<
      LightCyclePlayerId,
      {
        turn?: -1 | 0 | 1;
        boost?: boolean;
      }
    >
  > = {};

  for (const event of events) {
    const current = result[event.playerId] ?? {};
    switch (event.command) {
      case 'TURN_LEFT':
        current.turn = -1;
        break;
      case 'TURN_RIGHT':
        current.turn = 1;
        break;
      case 'BOOST_DOWN':
        current.boost = true;
        break;
      case 'BOOST_UP':
        current.boost = false;
        break;
    }
    result[event.playerId] = current;
  }

  return result;
}
