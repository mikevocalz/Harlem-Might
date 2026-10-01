import type {
  LightCycleDerezEvent,
  LightCycleMatchState,
  LightCyclePlayerId,
  LightCycleTrailSegment,
} from './tabletopCore.ts';
import {
  LIGHTCYCLE_ARENA_HALF,
  LIGHTCYCLE_UNIT_SCALE,
} from './tabletopCore.ts';

export const LIGHTCYCLE_ASSET_NODES = {
  root: 'LightCycleRoot',
  chassis: 'Chassis',
  frontWheelPivot: 'FrontWheelPivot',
  frontWheel: 'FrontWheel',
  rearWheelPivot: 'RearWheelPivot',
  rearWheel: 'RearWheel',
  riderRoot: 'RiderRoot',
  trailSocket: 'TrailSocket',
  rearFxSocket: 'RearFXSocket',
  frontImpactSocket: 'FrontImpactSocket',
  cameraSocket: 'CameraSocket',
  explosionOrigin: 'ExplosionOrigin',
} as const;

export const LIGHTCYCLE_CLIPS = [
  'spawn',
  'idle',
  'rider_accelerate',
  'rider_brace',
  'rider_crash',
  'bike_powerup',
  'bike_impact',
  'bike_crumple',
  'respawn',
] as const;

export type LightCycleClipName = (typeof LIGHTCYCLE_CLIPS)[number];

export const LIGHTCYCLE_FRAGMENT_NODES = [
  'FrontCowling',
  'LeftBody',
  'RightBody',
  'FrontWheelFragment',
  'RearWheelFragment',
  'CanopyFragment',
  'EnergyCoreFragment',
] as const;

export type LightCycleFragmentNode =
  (typeof LIGHTCYCLE_FRAGMENT_NODES)[number];

export type LightCycleRenderTrail = {
  id: number;
  owner: LightCyclePlayerId;
  fromMeters: readonly [number, number, number];
  toMeters: readonly [number, number, number];
};

export type LightCycleRenderFrame = {
  playerId: LightCyclePlayerId;
  positionMeters: readonly [number, number, number];
  yawDegrees: number;
  wheelAngleDegrees: number;
  leanDegrees: number;
  energy01: number;
  emissionIntensity: number;
  alive: boolean;
  trails: LightCycleRenderTrail[];
  derez: LightCycleDerezEvent | null;
};

export type LightCycleEffectName =
  | 'spawn'
  | 'turn'
  | 'boost-start'
  | 'boost-end'
  | 'impact'
  | 'derez'
  | 'round-win'
  | 'match-win';

export interface LightCycleRendererAdapter {
  mount(assetUri: string): Promise<void> | void;
  render(frame: LightCycleRenderFrame): void;
  playClip(
    clip: LightCycleClipName,
    options?: { loop?: boolean; speed?: number; reset?: boolean },
  ): void;
  emit(
    effect: LightCycleEffectName,
    payload?: Record<string, unknown>,
  ): void;
  destroy(): void;
}

export const LIGHTCYCLE_TABLETOP_WIDTH_METERS = 1.2;

/**
 * Map the deterministic fixed-point arena into a 1.2m tabletop.
 * Gameplay truth stays in integer Grid units; renderers only consume metres.
 */
export const LIGHTCYCLE_METERS_PER_FIXED_UNIT =
  LIGHTCYCLE_TABLETOP_WIDTH_METERS / (LIGHTCYCLE_ARENA_HALF * 2);

function toMeters(value: number) {
  return value * LIGHTCYCLE_METERS_PER_FIXED_UNIT;
}

function trailToRender(
  trail: LightCycleTrailSegment,
): LightCycleRenderTrail {
  return {
    id: trail.id,
    owner: trail.owner,
    fromMeters: [toMeters(trail.from.x), 0, toMeters(trail.from.z)],
    toMeters: [toMeters(trail.to.x), 0, toMeters(trail.to.z)],
  };
}

export function createLightCycleRenderFrame(
  state: LightCycleMatchState,
  playerId: LightCyclePlayerId,
): LightCycleRenderFrame {
  const rider = state.riders[playerId];
  const recentTurnAge = rider.lastTurnTick < 0 ? Number.POSITIVE_INFINITY : state.tick - rider.lastTurnTick;
  const lean =
    recentTurnAge <= 10
      ? rider.lastTurn * Math.max(0, 18 * (1 - recentTurnAge / 10))
      : 0;

  return {
    playerId,
    positionMeters: [
      toMeters(rider.position.x),
      0,
      toMeters(rider.position.z),
    ],
    yawDegrees: rider.direction * 90,
    wheelAngleDegrees: (rider.wheelAngleMilliRad / 1000) * (180 / Math.PI),
    leanDegrees: lean,
    energy01: rider.energy / LIGHTCYCLE_UNIT_SCALE,
    emissionIntensity: 1 + (rider.speedUnitsPerTick / state.config.baseStepUnits - 1) * 0.8,
    alive: rider.alive,
    trails: state.trails.map(trailToRender),
    derez:
      state.derezEvents.find((event) => event.playerId === playerId) ?? null,
  };
}

export function validateLightCycleAssetManifest(input: {
  nodeNames: Iterable<string>;
  clipNames: Iterable<string>;
}) {
  const nodes = new Set(input.nodeNames);
  const clips = new Set(input.clipNames);
  const missingNodes = Object.values(LIGHTCYCLE_ASSET_NODES).filter(
    (name) => !nodes.has(name),
  );
  const missingClips = LIGHTCYCLE_CLIPS.filter((name) => !clips.has(name));

  return {
    valid: missingNodes.length === 0 && missingClips.length === 0,
    missingNodes,
    missingClips,
  };
}
