import {
  advanceLightCycleMatch,
  type LightCycleMatchState,
  type LightCycleTickInput,
  type LightCycleTurn,
} from './tabletopCore';

const TURN_CHOICES: LightCycleTurn[] = [0, -1, 1];

function tieBreak(seed: number, tick: number, turn: LightCycleTurn) {
  let value =
    (seed ^
      Math.imul(tick + 1, 0x45d9f3b) ^
      (turn === -1 ? 0x13579bdf : turn === 1 ? 0x2468ace0 : 0x10203040)) >>>
    0;
  value ^= value >>> 16;
  value = Math.imul(value, 0x45d9f3b) >>> 0;
  value ^= value >>> 16;
  return value >>> 0;
}

function evaluateTurn(
  state: LightCycleMatchState,
  turn: LightCycleTurn,
  horizonTicks: number,
) {
  let probe = state;
  let survived = 0;

  for (let index = 0; index < horizonTicks; index += 1) {
    probe = advanceLightCycleMatch(probe, {
      p2: index === 0 ? { turn } : {},
    });
    if (!probe.riders.p2.alive) break;
    survived += 1;
    if (probe.phase !== 'running') break;
  }

  const rider = probe.riders.p2;
  const edgeDistance = Math.min(
    24_000 - Math.abs(rider.position.x),
    24_000 - Math.abs(rider.position.z),
  );

  return survived * 1_000_000 + Math.max(0, edgeDistance);
}

/**
 * Deterministic survival-oriented AI for renderer-parity / solo testing.
 *
 * It uses the same core as human players: no renderer raycasts and no hidden
 * physics. Every decision is reproducible from the match state.
 */
export function chooseTabletopAiInput(
  state: LightCycleMatchState,
  options?: { horizonTicks?: number; decisionEveryTicks?: number },
): LightCycleTickInput {
  const rider = state.riders.p2;
  if (!rider.alive || state.phase !== 'running') return {};

  const decisionEveryTicks = options?.decisionEveryTicks ?? 10;
  if (rider.turnCooldownTicks > 0 || state.tick % decisionEveryTicks !== 0) {
    return {
      boost:
        rider.energy > 500 &&
        state.tick % 90 >= 18 &&
        state.tick % 90 <= 38,
    };
  }

  const horizon = options?.horizonTicks ?? 110;
  let bestTurn: LightCycleTurn = 0;
  let bestScore = Number.NEGATIVE_INFINITY;
  let bestTie = 0;

  for (const turn of TURN_CHOICES) {
    const score = evaluateTurn(state, turn, horizon);
    const tie = tieBreak(state.seed, state.tick, turn);
    if (score > bestScore || (score === bestScore && tie > bestTie)) {
      bestScore = score;
      bestTie = tie;
      bestTurn = turn;
    }
  }

  return {
    turn: bestTurn,
    boost:
      bestScore > horizon * 1_000_000 * 0.72 &&
      rider.energy > 600 &&
      state.tick % 120 < 28,
  };
}
