export type MotionPrimitive = number | string;

export type GradientStop = { color: string; position?: number };
export type LinearGradientValue = {
  type: 'linear-gradient';
  angle?: number;
  stops: readonly GradientStop[];
};
export type RadialGradientValue = {
  type: 'radial-gradient';
  stops: readonly GradientStop[];
};
export type GradientValue = LinearGradientValue | RadialGradientValue;

export type MotionValue = MotionPrimitive | GradientValue;
export type MotionState = Readonly<Record<string, MotionValue>>;
export type MotionInitial = Readonly<Record<string, MotionState>>;

export type EaseName =
  | 'linear'
  | 'quad.in'
  | 'quad.out'
  | 'quad.inOut'
  | 'cubic.in'
  | 'cubic.out'
  | 'cubic.inOut'
  | 'power2.in'
  | 'power2.out'
  | 'power2.inOut';

export type MotionTrack = Readonly<{
  target: string;
  from?: MotionState;
  to: MotionState;
  atMs?: number;
  durationMs: number;
  delayMs?: number;
  ease?: EaseName;
  repeat?: number;
  repeatDelayMs?: number;
  yoyo?: boolean;
}>;

export type MotionDefinition = Readonly<{
  schemaVersion?: 1;
  id: string;
  initial: MotionInitial;
  tracks: readonly MotionTrack[];
  labels?: Readonly<Record<string, number>>;
}>;

export type CompiledTrack = Readonly<MotionTrack & {
  atMs: number;
  endMs: number;
  ease: EaseName;
}>;

export type CompiledMotion = Readonly<{
  schemaVersion: 1;
  id: string;
  initial: MotionInitial;
  tracks: readonly CompiledTrack[];
  labels: Readonly<Record<string, number>>;
  durationMs: number;
}>;
