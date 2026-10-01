export const GRID_FX_TYPES = [
  'impact',
  'derez',
  'sparks',
  'laser-slice',
  'energy-arc',
  'grid-shockwave',
  'boost',
  'trail-burn',
  'near-miss',
  'spawn',
  'final-grid',
  'winner-surge',
  'mat-lock',
  'room-sync',
] as const;

export type GridFxType = (typeof GRID_FX_TYPES)[number];

export type GridFxCollisionCause =
  | 'boundary'
  | 'own-trail'
  | 'opponent-trail'
  | 'head-on'
  | 'head-swap'
  | 'crossing'
  | 'obstacle'
  | 'none';

export type GridFxQualityTier = 'standard' | 'ultra';
export type GridFxPlayer = 'p1' | 'p2' | 'none';
export type GridFxColor = `#${string}`;

export type GridFxWorldPoint = {
  x: number;
  y: number;
  z: number;
};

export type GridFxEvent = {
  serial: number;
  type: GridFxType;
  intensity: number;
  seed: number;
  playerColor: GridFxColor;
  opponentColor: GridFxColor;
  impactAngle: number;
  velocity: number;
  world: GridFxWorldPoint;
  collisionCause: GridFxCollisionCause;
  winner: GridFxPlayer;
  localPlayer: GridFxPlayer;
  qualityTier: GridFxQualityTier;
};

export type GridFxEventInput = Partial<
  Omit<GridFxEvent, 'serial' | 'type' | 'world'>
> & {
  type: GridFxType;
  world?: Partial<GridFxWorldPoint>;
};
