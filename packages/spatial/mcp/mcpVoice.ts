import type {
  LightCycleMatchState,
  LightCyclePlayerId,
} from '../lightcycle/tabletopCore.ts';

export type McpVoiceCueName =
  | 'race-start'
  | 'boost'
  | 'low-energy'
  | 'derez-local'
  | 'derez-rival'
  | 'round-result'
  | 'match-end';

export type McpVoiceExpression =
  | 'neutral'
  | 'amused'
  | 'threat'
  | 'shock'
  | 'triumph'
  | 'final';

export type McpVoiceCue = {
  name: McpVoiceCueName;
  eventKey: string;
  text: string;
  assetFile: string;
  durationMs: number;
  expression: McpVoiceExpression;
  source: 'original' | 'film-quote';
  priority: number;
};

const CUES: Record<McpVoiceCueName, Omit<McpVoiceCue, 'eventKey'>> = {
  'race-start': {
    name: 'race-start',
    text: 'Programs. The Grid is live. Power cycles are stable. Begin.',
    assetFile: 'race-start.wav',
    durationMs: 3600,
    expression: 'neutral',
    source: 'original',
    priority: 40,
  },
  boost: {
    name: 'boost',
    text: 'Velocity anomaly detected. Interesting.',
    assetFile: 'boost.wav',
    durationMs: 2300,
    expression: 'amused',
    source: 'original',
    priority: 20,
  },
  'low-energy': {
    name: 'low-energy',
    text: 'Want me to slow down your power cycles for you?',
    assetFile: 'low-energy.wav',
    durationMs: 3200,
    expression: 'threat',
    source: 'film-quote',
    priority: 55,
  },
  'derez-local': {
    name: 'derez-local',
    text: 'Program derezzed. The Grid remembers every mistake.',
    assetFile: 'derez-local.wav',
    durationMs: 3100,
    expression: 'shock',
    source: 'original',
    priority: 80,
  },
  'derez-rival': {
    name: 'derez-rival',
    text: 'Rival process terminated. Continue.',
    assetFile: 'derez-rival.wav',
    durationMs: 2400,
    expression: 'triumph',
    source: 'original',
    priority: 80,
  },
  'round-result': {
    name: 'round-result',
    text: 'Round adjudicated. Return to your marks.',
    assetFile: 'round-result.wav',
    durationMs: 2600,
    expression: 'neutral',
    source: 'original',
    priority: 60,
  },
  'match-end': {
    name: 'match-end',
    text: 'End of line.',
    assetFile: 'end-of-line.wav',
    durationMs: 2100,
    expression: 'final',
    source: 'film-quote',
    priority: 100,
  },
};

function withKey(
  name: McpVoiceCueName,
  eventKey: string,
): McpVoiceCue {
  return { ...CUES[name], eventKey };
}

/**
 * Deterministically maps authoritative race state to at most one MCP line.
 *
 * Playback suppression is local: every peer derives the same eventKey, so
 * co-location never needs a second replicated "voice" entity.
 */
export function deriveMcpVoiceCue(
  state: LightCycleMatchState,
  localPlayerId: LightCyclePlayerId = 'p1',
): McpVoiceCue | null {
  if (state.phase === 'match-over') {
    return withKey(
      'match-end',
      `match-end:${state.round}:${state.matchWinner ?? 'none'}`,
    );
  }

  const derez = state.derezEvents.at(-1);
  if (derez && derez.tick >= state.tick - 2) {
    return withKey(
      derez.playerId === localPlayerId ? 'derez-local' : 'derez-rival',
      `derez:${derez.playerId}:${derez.tick}:${derez.seed}`,
    );
  }

  if (state.phase === 'round-over') {
    return withKey(
      'round-result',
      `round:${state.round}:${state.roundWinner ?? 'none'}`,
    );
  }

  if (state.phase === 'countdown') {
    // Speak once at the start of the round, not once per countdown number.
    const seconds = Math.max(1, Math.ceil(state.countdownTicks / 60));
    if (seconds >= 3) {
      return withKey('race-start', `race-start:${state.round}`);
    }
    return null;
  }

  if (state.phase !== 'running') return null;

  const local = state.riders[localPlayerId];
  const boostRatio =
    local.speedUnitsPerTick / Math.max(1, state.config.baseStepUnits);

  if (local.energy <= 220) {
    return withKey(
      'low-energy',
      `low-energy:${state.round}:${Math.floor(local.energy / 100)}`,
    );
  }

  if (boostRatio > 1.15) {
    // Bucket the tick so holding boost cannot chatter every fixed update.
    return withKey(
      'boost',
      `boost:${state.round}:${Math.floor(state.tick / 90)}`,
    );
  }

  return null;
}

export function mcpVoiceAssetUrl(
  cue: McpVoiceCue,
  baseUrl = '/assets/mcp/voice',
) {
  return `${baseUrl.replace(/\/$/, '')}/${cue.assetFile}`;
}

export const MCP_VOICE_CUES = CUES;
