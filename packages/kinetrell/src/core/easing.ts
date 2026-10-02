import type { EaseName } from './types.js';

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export function applyEase(name: EaseName, progress: number): number {
  const t = clamp01(progress);
  switch (name) {
    case 'linear':
      return t;
    case 'quad.in':
      return t * t;
    case 'quad.out':
      return 1 - (1 - t) * (1 - t);
    case 'quad.inOut':
      return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    case 'cubic.in':
    case 'power2.in':
      return t * t * t;
    case 'cubic.out':
    case 'power2.out':
      return 1 - Math.pow(1 - t, 3);
    case 'cubic.inOut':
    case 'power2.inOut':
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }
}
