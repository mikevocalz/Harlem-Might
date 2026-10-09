/**
 * The street scene's look: Harlem at dusk. A warm horizon under an indigo
 * sky, brownstone and brick buildings lit by a low sun from the west, and
 * haze that pulls distant ground and walls into the horizon colour so the
 * edge of the map never shows as a hard line.
 *
 * Viro has no fog, so the haze is a fragment shader modifier: the engine's
 * Constant and Lambert shaders expose `camera_position`, the world-space
 * `_surface.position` and `_output_color` at `#pragma fragment_modifier_body`
 * (~/virocore/ViroRenderer/constant_fsh.glsl, standard_fsh.glsl).
 */

/** Sky colour just below the horizon in harlem-dusk-sky.png; haze fades to it. */
export const HAZE_RGB = [0.42, 0.27, 0.19] as const;
/**
 * Haze starts past the nearest buildings and reaches 85% about four blocks
 * out, well inside the map's edge, so the ground meets the sky softly.
 */
export const HAZE_START_M = 15;
export const HAZE_END_M = 350;
export const HAZE_MAX = 0.85;

const glslFloat = (n: number) => (Number.isInteger(n) ? `${n}.0` : `${n}`);

/** Fragment modifier: mixes the lit colour toward the haze with distance from the eye. */
export const HAZE_FRAGMENT = [
  'highp float hm_haze_d = length(camera_position - _surface.position);',
  `highp float hm_haze_t = smoothstep(${glslFloat(HAZE_START_M)}, ${glslFloat(HAZE_END_M)}, hm_haze_d) * ${glslFloat(HAZE_MAX)};`,
  `_output_color.rgb = mix(_output_color.rgb, vec3(${HAZE_RGB.map(glslFloat).join(', ')}), hm_haze_t);`,
].join('\n');

/**
 * Surface modifier for building walls: one tile of buildings is a single mesh
 * with one material, so this shades each 11 m ground cell a little lighter or
 * darker, and neighbouring buildings read apart instead of as one block.
 */
export const BUILDING_VARIATION_SURFACE = [
  'highp vec2 hm_cell = floor(_surface.position.xz / 11.0);',
  'highp float hm_n = fract(sin(dot(hm_cell, vec2(12.9898, 78.233))) * 43758.5453);',
  '_surface.diffuse_color.rgb *= 0.82 + 0.36 * hm_n;',
].join('\n');

/** Brownstone, brick and limestone: the three facades Harlem's blocks are made of. */
export const BUILDING_TONES = ['#7A5642', '#8E4F3C', '#B9A88E'] as const;

/** Material name for a building tile; the tone is fixed per tile so it never flickers. */
export function buildingMaterialFor(tile: { readonly x: number; readonly y: number }): string {
  const h = Math.abs((tile.x * 73856093) ^ (tile.y * 19349663));
  return `harlemStreetBuilding${h % BUILDING_TONES.length}`;
}

/**
 * Low sun from the south-west, travelling north-east and down. The scene
 * opens facing north, so the walls ahead catch it; from the north-west it
 * backlit every facade the wearer first sees.
 */
export const SUN = { color: '#FFC48A', direction: [0.7, -0.45, -0.55] as const, intensity: 1100 } as const;
/** Fill from the dusk sky: cool, so shaded walls turn violet rather than grey. */
export const SKY_FILL = { color: '#A9A6CC', intensity: 300 } as const;

/** Ground under the map, and the grid when there is no satellite imagery. */
export const ASPHALT = '#31281F';
export const GRID_LINE = '#5C4624';
