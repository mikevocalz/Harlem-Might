import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BUILDING_TONES, HAZE_FRAGMENT, HAZE_RGB, buildingMaterialFor } from './streetLook.ts';

describe('buildingMaterialFor', () => {
  it('gives a tile the same tone every time', () => {
    assert.equal(buildingMaterialFor({ x: 9650, y: 12301 }), buildingMaterialFor({ x: 9650, y: 12301 }));
  });

  it('names one of the registered tone materials, and neighbouring tiles use more than one', () => {
    const names = new Set<string>();
    for (let x = 9640; x < 9660; x++) {
      for (let y = 12290; y < 12310; y++) names.add(buildingMaterialFor({ x, y }));
    }
    for (const name of names) assert.match(name, new RegExp(`^harlemStreetBuilding[0-${BUILDING_TONES.length - 1}]$`));
    assert.ok(names.size > 1);
  });
});

describe('HAZE_FRAGMENT', () => {
  it('is GLSL with float literals and only the names the engine fragment shaders define', () => {
    assert.match(HAZE_FRAGMENT, /smoothstep\(\d+\.\d+, \d+\.\d+, hm_haze_d\) \* \d+\.\d+;/);
    assert.ok(HAZE_FRAGMENT.includes(`vec3(${HAZE_RGB.join(', ')})`));
    for (const name of HAZE_FRAGMENT.match(/\b_?[a-z_]+(?=\b)/g) ?? []) {
      if (name.startsWith('_')) assert.ok(['_output_color', '_surface'].includes(name), name);
    }
  });
});
