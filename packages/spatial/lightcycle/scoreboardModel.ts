import type {
  LightCycleMatchState,
  LightCyclePlayerId,
} from './tabletopCore';

export const LIGHTCYCLE_SCOREBOARD_ARTBOARD = 'LightCycleScoreboard';
export const LIGHTCYCLE_SCOREBOARD_MACHINE = 'Main';
export const LIGHTCYCLE_SCOREBOARD_VIEW_MODEL = 'MatchScoreboard';

export type LightCycleScoreboardPlayerState =
  | 'waiting'
  | 'ready'
  | 'riding'
  | 'derezzed'
  | 'winner';

export type LightCycleScoreboardPlayer = {
  id: LightCyclePlayerId;
  name: string;
  score: number;
  roundsWon: number;
  connected: boolean;
  localized: boolean;
  ready: boolean;
  color: 'cyan' | 'orange';
  state: LightCycleScoreboardPlayerState;
};

export type LightCycleScoreboardPhase =
  | 'lobby'
  | 'localizing'
  | 'ready'
  | 'countdown'
  | 'playing'
  | 'round-result'
  | 'match-winner'
  | 'reconnecting'
  | 'error';

export type LightCycleScoreboardModel = {
  player1: LightCycleScoreboardPlayer;
  player2: LightCycleScoreboardPlayer;
  match: {
    round: number;
    roundsToWin: number;
    countdown: number;
    phase: LightCycleScoreboardPhase;
    winnerName: string;
    joinCode: string;
    finalGrid: boolean;
  };
};

export type LightCycleLobbyPresence = Partial<
  Record<
    LightCyclePlayerId,
    {
      name?: string;
      connected?: boolean;
      localized?: boolean;
      ready?: boolean;
    }
  >
>;

function playerState(
  state: LightCycleMatchState | null,
  id: LightCyclePlayerId,
  presence: LightCycleLobbyPresence,
): LightCycleScoreboardPlayerState {
  const row = presence[id];

  if (!state) {
    return row?.ready ? 'ready' : 'waiting';
  }

  if (state.matchWinner === id) return 'winner';
  if (!state.riders[id].alive) return 'derezzed';
  if (state.phase === 'running') return 'riding';
  return row?.ready ? 'ready' : 'waiting';
}

function scoreboardPhase(
  state: LightCycleMatchState | null,
  presence: LightCycleLobbyPresence,
): LightCycleScoreboardPhase {
  if (!state) {
    const bothLocalized =
      Boolean(presence.p1?.localized) && Boolean(presence.p2?.localized);
    const bothReady =
      Boolean(presence.p1?.ready) && Boolean(presence.p2?.ready);
    if (!bothLocalized) return 'localizing';
    return bothReady ? 'ready' : 'lobby';
  }

  switch (state.phase) {
    case 'countdown':
      return 'countdown';
    case 'running':
      return 'playing';
    case 'round-over':
      return 'round-result';
    case 'match-over':
      return 'match-winner';
  }
}

export function createLightCycleScoreboardModel(input: {
  state: LightCycleMatchState | null;
  presence?: LightCycleLobbyPresence;
  joinCode?: string | null;
}): LightCycleScoreboardModel {
  const presence = input.presence ?? {};
  const state = input.state;
  const p1Name =
    state?.riders.p1.name || presence.p1?.name?.trim() || 'PLAYER 1';
  const p2Name =
    state?.riders.p2.name || presence.p2?.name?.trim() || 'WAITING…';

  const winnerId = state?.matchWinner ?? null;
  const winnerName =
    winnerId === 'p1' ? p1Name : winnerId === 'p2' ? p2Name : '';

  return {
    player1: {
      id: 'p1',
      name: p1Name,
      score: state?.scores.p1 ?? 0,
      roundsWon: state?.scores.p1 ?? 0,
      connected: Boolean(presence.p1?.connected),
      localized: Boolean(presence.p1?.localized),
      ready: Boolean(presence.p1?.ready),
      color: 'cyan',
      state: playerState(state, 'p1', presence),
    },
    player2: {
      id: 'p2',
      name: p2Name,
      score: state?.scores.p2 ?? 0,
      roundsWon: state?.scores.p2 ?? 0,
      connected: Boolean(presence.p2?.connected),
      localized: Boolean(presence.p2?.localized),
      ready: Boolean(presence.p2?.ready),
      color: 'orange',
      state: playerState(state, 'p2', presence),
    },
    match: {
      round: state?.round ?? 1,
      roundsToWin: state?.config.roundsToWin ?? 5,
      countdown:
        state?.phase === 'countdown'
          ? Math.max(1, Math.ceil(state.countdownTicks / 60))
          : 0,
      phase: scoreboardPhase(state, presence),
      winnerName,
      joinCode: input.joinCode ?? '',
      finalGrid:
        Boolean(state) &&
        state!.scores.p1 === state!.config.roundsToWin - 1 &&
        state!.scores.p2 === state!.config.roundsToWin - 1,
    },
  };
}

/**
 * Canonical Rive View Model paths. The authored scoreboard .riv file must
 * expose these exact properties so native/web adapters can bind without
 * renderer-specific field-name translation.
 */
export const LIGHTCYCLE_RIVE_BINDINGS = {
  player1: {
    name: 'player1/name',
    score: 'player1/score',
    roundsWon: 'player1/roundsWon',
    ready: 'player1/ready',
    connected: 'player1/connected',
    localized: 'player1/localized',
    state: 'player1/state',
    color: 'player1/color',
  },
  player2: {
    name: 'player2/name',
    score: 'player2/score',
    roundsWon: 'player2/roundsWon',
    ready: 'player2/ready',
    connected: 'player2/connected',
    localized: 'player2/localized',
    state: 'player2/state',
    color: 'player2/color',
  },
  match: {
    round: 'match/round',
    roundsToWin: 'match/roundsToWin',
    countdown: 'match/countdown',
    phase: 'match/phase',
    winnerName: 'match/winnerName',
    joinCode: 'match/joinCode',
    finalGrid: 'match/finalGrid',
  },
} as const;


export type LightCycleRiveBindingValue =
  | string
  | number
  | boolean
  | { kind: 'enum'; value: string }
  | { kind: 'color'; value: number };

export type LightCycleRiveBindings = Record<
  string,
  LightCycleRiveBindingValue
>;

const RIVE_COLOR = {
  cyan: 0xff00f3ff,
  orange: 0xffff7a00,
} as const;

/**
 * Flatten the authoritative scoreboard model into the exact Rive View Model
 * paths authored for lightcycle_scoreboard.riv.
 */
export function createLightCycleRiveBindings(
  model: LightCycleScoreboardModel,
): LightCycleRiveBindings {
  return {
    [LIGHTCYCLE_RIVE_BINDINGS.player1.name]: model.player1.name,
    [LIGHTCYCLE_RIVE_BINDINGS.player1.score]: model.player1.score,
    [LIGHTCYCLE_RIVE_BINDINGS.player1.roundsWon]: model.player1.roundsWon,
    [LIGHTCYCLE_RIVE_BINDINGS.player1.ready]: model.player1.ready,
    [LIGHTCYCLE_RIVE_BINDINGS.player1.connected]: model.player1.connected,
    [LIGHTCYCLE_RIVE_BINDINGS.player1.localized]: model.player1.localized,
    [LIGHTCYCLE_RIVE_BINDINGS.player1.state]: {
      kind: 'enum',
      value: model.player1.state,
    },
    [LIGHTCYCLE_RIVE_BINDINGS.player1.color]: {
      kind: 'color',
      value: RIVE_COLOR.cyan,
    },

    [LIGHTCYCLE_RIVE_BINDINGS.player2.name]: model.player2.name,
    [LIGHTCYCLE_RIVE_BINDINGS.player2.score]: model.player2.score,
    [LIGHTCYCLE_RIVE_BINDINGS.player2.roundsWon]: model.player2.roundsWon,
    [LIGHTCYCLE_RIVE_BINDINGS.player2.ready]: model.player2.ready,
    [LIGHTCYCLE_RIVE_BINDINGS.player2.connected]: model.player2.connected,
    [LIGHTCYCLE_RIVE_BINDINGS.player2.localized]: model.player2.localized,
    [LIGHTCYCLE_RIVE_BINDINGS.player2.state]: {
      kind: 'enum',
      value: model.player2.state,
    },
    [LIGHTCYCLE_RIVE_BINDINGS.player2.color]: {
      kind: 'color',
      value: RIVE_COLOR.orange,
    },

    [LIGHTCYCLE_RIVE_BINDINGS.match.round]: model.match.round,
    [LIGHTCYCLE_RIVE_BINDINGS.match.roundsToWin]: model.match.roundsToWin,
    [LIGHTCYCLE_RIVE_BINDINGS.match.countdown]: model.match.countdown,
    [LIGHTCYCLE_RIVE_BINDINGS.match.phase]: {
      kind: 'enum',
      value: model.match.phase,
    },
    [LIGHTCYCLE_RIVE_BINDINGS.match.winnerName]: model.match.winnerName,
    [LIGHTCYCLE_RIVE_BINDINGS.match.joinCode]: model.match.joinCode,
    [LIGHTCYCLE_RIVE_BINDINGS.match.finalGrid]: model.match.finalGrid,
  };
}
