import type { MotionValue } from './types.js';

type Rgba = readonly [number, number, number, number];

function parseHex(input: string): Rgba | null {
  const value = input.trim();
  const match = /^#([\da-f]{3,8})$/i.exec(value);
  if (!match) return null;
  const hex = match[1]!;
  if (hex.length === 3 || hex.length === 4) {
    const parts = hex.split('').map((part) => parseInt(part + part, 16));
    return [parts[0]!, parts[1]!, parts[2]!, parts[3] ?? 255];
  }
  if (hex.length === 6 || hex.length === 8) {
    return [
      parseInt(hex.slice(0, 2), 16),
      parseInt(hex.slice(2, 4), 16),
      parseInt(hex.slice(4, 6), 16),
      hex.length === 8 ? parseInt(hex.slice(6, 8), 16) : 255,
    ];
  }
  return null;
}

function channel(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

export function interpolateColorValue(
  from: MotionValue | undefined,
  to: MotionValue,
  progress: number,
): MotionValue | null {
  if (typeof from !== 'string' || typeof to !== 'string') return null;
  const a = parseHex(from);
  const b = parseHex(to);
  if (!a || !b) return null;

  const t = Math.max(0, Math.min(1, progress));
  const rgba = a.map((value, index) =>
    channel(value + (b[index]! - value) * t),
  ) as unknown as Rgba;

  const rgb = rgba
    .slice(0, 3)
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
  const alpha =
    rgba[3] === 255 ? '' : rgba[3].toString(16).padStart(2, '0');

  return `#${rgb}${alpha}`;
}
