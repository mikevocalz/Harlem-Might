import type { MotionDefinition } from './types.js';

export function defineMotion<const T extends MotionDefinition>(definition: T): T {
  return Object.freeze(definition);
}
