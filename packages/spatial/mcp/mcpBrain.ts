import {
  LIGHTCYCLE_FIXED_HZ,
  type LightCycleCrashCause,
  type LightCycleMatchState,
  type LightCyclePlayerId,
} from '../lightcycle/tabletopCore.ts';

export type McpMood =
  | 'countdown'
  | 'observing'
  | 'overdrive'
  | 'warning'
  | 'derez'
  | 'round-victory'
  | 'round-defeat'
  | 'match-victory'
  | 'match-defeat';

export type McpPresentation = {
  mood: McpMood;
  headline: string;
  detail: string;
  eventKey: string;
  pulse: number;
  threat: number;
  eyeIntensity: number;
  haloSpeed: number;
};

const CRASH_LABEL: Record<LightCycleCrashCause, string> = {
  boundary: 'ARENA BOUNDARY',
  'own-trail': 'OWN LIGHT WALL',
  'opponent-trail': 'RIVAL LIGHT WALL',
  'head-on': 'HEAD-ON COLLISION',
  'head-swap': 'HEAD-SWAP COLLISION',
  crossing: 'CROSSING COLLISION',
};

function otherPlayer(id: LightCyclePlayerId): LightCyclePlayerId {
  return id === 'p1' ? 'p2' : 'p1';
}

function basePresentation(
  mood: McpMood,
  headline: string,
  detail: string,
  eventKey: string,
  values: Pick<McpPresentation, 'pulse' | 'threat' | 'eyeIntensity' | 'haloSpeed'>,
): McpPresentation {
  return { mood, headline, detail, eventKey, ...values };
}

/**
 * Pure projection of deterministic Light Cycle state into MCP presentation state.
 *
 * The MCP is intentionally NOT a replicated multiplayer entity. Every peer derives
 * the same event timing from the authoritative match snapshot, avoiding a second
 * source of truth or co-location drift.
 */
export function deriveMcpPresentation(
  state: LightCycleMatchState,
  localPlayerId: LightCyclePlayerId = 'p1',
): McpPresentation {
  const rivalId = otherPlayer(localPlayerId);
  const local = state.riders[localPlayerId];
  const rival = state.riders[rivalId];
  const derez = state.derezEvents.at(-1);

  if (derez) {
    const localWasDerezzed = derez.playerId === localPlayerId;
    return basePresentation(
      'derez',
      localWasDerezzed ? 'USER DEREZZED' : 'RIVAL DEREZZED',
      CRASH_LABEL[derez.cause],
      `derez:${derez.playerId}:${derez.tick}:${derez.seed}`,
      {
        pulse: 1,
        threat: localWasDerezzed ? 1 : 0.82,
        eyeIntensity: 3.2,
        haloSpeed: 2.8,
      },
    );
  }

  if (state.phase === 'match-over') {
    const localWon = state.matchWinner === localPlayerId;
    return basePresentation(
      localWon ? 'match-victory' : 'match-defeat',
      localWon ? 'CONTROL BREACH' : 'SYSTEM SUPREMACY',
      localWon
        ? `${local.name} OVERRIDES THE GRID`
        : `${rival.name} CONTROLS THE GRID`,
      `match:${state.round}:${state.matchWinner ?? 'none'}`,
      {
        pulse: 0.9,
        threat: localWon ? 1 : 0.62,
        eyeIntensity: localWon ? 3 : 2.1,
        haloSpeed: localWon ? 2.2 : 0.72,
      },
    );
  }

  if (state.phase === 'round-over') {
    if (state.roundWinner === 'draw') {
      return basePresentation(
        'derez',
        'MUTUAL DEREZ',
        `ROUND ${state.round} INVALIDATED`,
        `round:${state.round}:draw`,
        {
          pulse: 1,
          threat: 0.92,
          eyeIntensity: 2.8,
          haloSpeed: 2.4,
        },
      );
    }

    const localWon = state.roundWinner === localPlayerId;
    return basePresentation(
      localWon ? 'round-victory' : 'round-defeat',
      localWon ? 'ANOMALY SCORED' : 'GRID ORDER RESTORED',
      `ROUND ${state.round} // ${state.scores.p1}-${state.scores.p2}`,
      `round:${state.round}:${state.roundWinner ?? 'none'}`,
      {
        pulse: 0.78,
        threat: localWon ? 0.86 : 0.48,
        eyeIntensity: localWon ? 2.5 : 1.7,
        haloSpeed: localWon ? 1.85 : 0.82,
      },
    );
  }

  if (state.phase === 'countdown') {
    const count = Math.max(
      1,
      Math.ceil(state.countdownTicks / LIGHTCYCLE_FIXED_HZ),
    );
    return basePresentation(
      'countdown',
      'MCP // GRID CONTROL',
      `RACE INITIALIZATION // ${count}`,
      `countdown:${state.round}:${count}`,
      {
        pulse: 0.64 + (3 - Math.min(3, count)) * 0.1,
        threat: 0.56,
        eyeIntensity: 1.5 + (3 - Math.min(3, count)) * 0.35,
        haloSpeed: 0.85 + (3 - Math.min(3, count)) * 0.3,
      },
    );
  }

  const boostRatio =
    local.speedUnitsPerTick / Math.max(1, state.config.baseStepUnits);
  if (boostRatio > 1.15) {
    return basePresentation(
      'overdrive',
      'VELOCITY EXCEPTION',
      `${local.name} // BOOST ${Math.round(boostRatio * 100)}%`,
      `boost:${state.round}:${state.tick >> 3}`,
      {
        pulse: 0.86,
        threat: 0.74,
        eyeIntensity: 2.35,
        haloSpeed: 1.95,
      },
    );
  }

  if (local.energy <= 220) {
    return basePresentation(
      'warning',
      'ENERGY RESERVE CRITICAL',
      `${local.name} // ${Math.round(local.energy / 10)}%`,
      `energy:${state.round}:${Math.floor(local.energy / 50)}`,
      {
        pulse: 0.92,
        threat: 0.88,
        eyeIntensity: 2.6,
        haloSpeed: 1.7,
      },
    );
  }

  return basePresentation(
    'observing',
    'GRID UNDER OBSERVATION',
    `${local.name} VS ${rival.name} // ROUND ${state.round}`,
    `observe:${state.round}:${state.tick >> 5}`,
    {
      pulse: 0.5,
      threat: 0.42,
      eyeIntensity: 1.45,
      haloSpeed: 0.72,
    },
  );
}
