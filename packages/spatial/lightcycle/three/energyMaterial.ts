import * as THREE from 'three/webgpu';
import * as t3 from '@typegpu/three';
import { d, std } from 'typegpu';

export type LightCycleEnergyMaterial = {
  material: THREE.MeshBasicNodeMaterial;
  setColor: (hex: string) => void;
  setIntensity: (value: number) => void;
};

/**
 * Energy material authored in TypeGPU and embedded into Three's TSL graph.
 *
 * This deliberately stays renderer-agnostic at the gameplay layer: the same
 * simulation only supplies color/intensity. WebGPU is responsible for the
 * animated energy treatment.
 */
export function createLightCycleEnergyMaterial(
  color = '#00f3ff',
): LightCycleEnergyMaterial {
  const colorValue = new THREE.Color(color);
  const colorUniform = t3.uniform(colorValue, d.vec3f);
  const intensityUniform = t3.uniform(1, d.f32);

  const material = new THREE.MeshBasicNodeMaterial();
  material.transparent = true;
  material.depthWrite = true;
  const energyNode = t3.toTSL(() => {
    'use gpu';

    const uv = t3.uv().$;
    const time = t3.time.$;
    const stripePhase = std.mul(
      std.add(std.mul(uv.y, 42), std.mul(time, 4.5)),
      3.14159265,
    );
    const stripe = std.abs(std.sin(stripePhase));
    const core = std.add(0.72, std.mul(stripe, 0.28));
    const edge = std.sub(1, std.abs(std.sub(std.mul(uv.x, 2), 1)));
    const glow = std.mul(
      std.mul(core, std.add(0.78, std.mul(edge, 0.22))),
      intensityUniform.$,
    );

    return d.vec4f(std.mul(colorUniform.$, glow), 0.92);
  });

  // @typegpu/three returns a generic TSL node because its return type is
  // discovered when Three builds the shader. This function always returns
  // vec4f, which is exactly what MeshBasicNodeMaterial.colorNode accepts.
  material.colorNode = energyNode as unknown as NonNullable<
    typeof material.colorNode
  >;

  return {
    material,
    setColor(hex) {
      colorUniform.node.value.set(hex);
    },
    setIntensity(value) {
      intensityUniform.node.value = Math.max(0, value);
    },
  };
}
