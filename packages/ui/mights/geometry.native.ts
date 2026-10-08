// Native counterpart of geometry.ts. React Native has no clip-path, so the
// same NeonBlade cuts are drawn as react-native-svg paths sized from
// onLayout. The web class strings are re-exported unchanged so `index.ts`
// exposes one surface on both platforms; the explicit `.ts` extension keeps
// Metro from resolving this file back to itself.
export * from './geometry.ts';

/**
 * A measured box in dp, as reported by `onLayout`.
 * @see {@linkcode cornerCutPath}
 * @see {@linkcode notchPath}
 */
export interface Size {
  width: number;
  height: number;
}

/**
 * Diagonal cut at the bottom-right corner, in dp. Matches `cornerCut` (md
 * button, 20px) and `cornerCutSm` (compact controls, 12px) on the web.
 */
export const CORNER_CUT = { md: 20, sm: 12 } as const;

/**
 * Card silhouette from the web `notch` clip-path: trapezoid notches centred on
 * the top and bottom edges plus a cut bottom-right corner. All values in dp.
 */
export const NOTCH = {
  /** Half the notch width where it meets the edge (web: 50% ± 78px). */
  outerHalfWidth: 78,
  /** Half the notch width at its floor (web: 50% ± 70px). */
  innerHalfWidth: 70,
  /** How far the notch bites into the card (web: 8px). */
  depth: 8,
  /** Bottom-right corner cut (web: 20px). */
  cornerCut: 20,
  /**
   * Narrowest card that still gets notches: both notches plus the corner cut
   * must fit inside a 2dp rail (2 × (78 + 20) + 2 × 2). Narrower cards fall
   * back to the corner cut alone instead of drawing a self-crossing outline.
   */
  minWidth: 200,
} as const;

const fmt = (n: number) => String(Math.round(n * 100) / 100);

const toPath = (points: readonly (readonly [number, number])[]) =>
  points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${fmt(x)} ${fmt(y)}`).join(' ') + ' Z';

/** The box left after insetting every edge, or undefined when nothing is left. */
function insetBox({ width, height }: Size, inset: number) {
  const x0 = inset;
  const y0 = inset;
  const x1 = width - inset;
  const y1 = height - inset;
  if (!(x1 > x0) || !(y1 > y0)) return undefined;
  return { x0, y0, x1, y1 };
}

/**
 * SVG path for a box with its bottom-right corner cut at 45°.
 *
 * `inset` shrinks the box on every side and keeps the same cut, which is how
 * the web draws a 1px rail: an outer clipped box with an inner clipped box
 * inside it. The cut is clamped to the box so tiny boxes stay convex.
 *
 * @param size Measured box, in dp.
 * @param cut Cut length along each edge, in dp. See {@linkcode CORNER_CUT}.
 * @param inset Distance from every edge, in dp.
 * @default inset 0
 * @returns An SVG path string, or `''` when the inset box is empty.
 */
export function cornerCutPath(size: Size, cut: number, inset = 0): string {
  const box = insetBox(size, inset);
  if (!box) return '';
  const { x0, y0, x1, y1 } = box;
  const c = Math.max(0, Math.min(cut, x1 - x0, y1 - y0));
  return toPath([
    [x0, y0],
    [x1, y0],
    [x1, y1 - c],
    [x1 - c, y1],
    [x0, y1],
  ]);
}

/**
 * SVG path for the notch-card silhouette (see {@linkcode NOTCH}).
 *
 * The notches stay centred on the full card width, so the outer rail path and
 * the inset fill path line up exactly as the web's two clipped layers do.
 * Cards narrower than {@linkcode NOTCH.minWidth} get the corner cut alone,
 * decided on the full width so every layer of one card agrees.
 *
 * @param size Measured card, in dp.
 * @param inset Distance from every edge, in dp (2 for the fill inside the rail).
 * @default inset 0
 * @returns An SVG path string, or `''` when the inset box is empty.
 */
export function notchPath(size: Size, inset = 0): string {
  if (size.width < NOTCH.minWidth) return cornerCutPath(size, NOTCH.cornerCut, inset);
  const box = insetBox(size, inset);
  if (!box) return '';
  const { x0, y0, x1, y1 } = box;
  const { outerHalfWidth: ow, innerHalfWidth: iw, depth: d } = NOTCH;
  const c = Math.max(0, Math.min(NOTCH.cornerCut, x1 - x0, y1 - y0));
  const cx = size.width / 2;
  return toPath([
    [x0, y0],
    [cx - ow, y0],
    [cx - iw, y0 + d],
    [cx + iw, y0 + d],
    [cx + ow, y0],
    [x1, y0],
    [x1, y1 - c],
    [x1 - c, y1],
    [cx + ow, y1],
    [cx + iw, y1 - d],
    [cx - iw, y1 - d],
    [cx - ow, y1],
    [x0, y1],
  ]);
}
