import type { GridFxType } from './types';

export const GRID_FX_VIEW_MODEL = 'GridFx';
export const GRID_FX_MACHINE = 'FX';
export const GRID_CORE_SPINNER_ARTBOARD = 'GridCoreSpinner';
export const GRID_CORE_SPINNER_MACHINE = 'Spinner';

export const GRID_FX_BINDINGS = {
  playerColor: 'playerColor',
  opponentColor: 'opponentColor',
  intensity: 'intensity',
  seed: 'seed',
  impactAngle: 'impactAngle',
  velocity: 'velocity',
  worldX: 'worldX',
  worldY: 'worldY',
  worldZ: 'worldZ',
  serial: 'serial',
  effectType: 'effectType',
  collisionCause: 'collisionCause',
  qualityTier: 'qualityTier',
  winner: 'winner',
  localPlayer: 'localPlayer',
} as const;

export const GRID_FX_ARTBOARDS: Record<GridFxType, string> = {
  impact: 'GridImpact',
  derez: 'GridDerez',
  sparks: 'GridImpact',
  'laser-slice': 'GridLaserSlice',
  'energy-arc': 'GridImpact',
  'grid-shockwave': 'GridShockwave',
  boost: 'GridBoost',
  'trail-burn': 'GridImpact',
  'near-miss': 'GridLaserSlice',
  spawn: 'GridBoost',
  'final-grid': 'GridShockwave',
  'winner-surge': 'GridShockwave',
  'mat-lock': 'GridMatLock',
  'room-sync': 'GridRoomSync',
};

export function gridFxArtboardFor(type: GridFxType) {
  return GRID_FX_ARTBOARDS[type];
}
