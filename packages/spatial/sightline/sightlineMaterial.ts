import * as THREE from 'three/webgpu';
import * as t3 from '@typegpu/three';
import { d, std } from 'typegpu';

export type SightlineLensMaterial = {
  material: THREE.MeshBasicNodeMaterial;
  setProgress: (progress: number) => void;
};

export function createSightlineLensMaterial(
  color = '#1F4FE0',
): SightlineLensMaterial {
  const colorValue = new THREE.Color(color);
  const colorUniform = t3.uniform(colorValue, d.vec3f);
  const progressUniform = t3.uniform(0, d.f32);

  const material = new THREE.MeshBasicNodeMaterial();
  material.transparent = true;
  material.depthWrite = false;
  material.side = THREE.DoubleSide;

  const node = t3.toTSL(() => {
    'use gpu';

    const uv = t3.uv().$;
    const time = t3.time.$;
    const sweep = std.abs(
      std.sin(
        std.mul(
          std.add(
            std.mul(uv.x, 6),
            std.add(std.mul(time, 0.32), std.mul(progressUniform.$, 2.2)),
          ),
          3.14159265,
        ),
      ),
    );
    const edgeX = std.sub(1, std.abs(std.sub(std.mul(uv.x, 2), 1)));
    const edgeY = std.sub(1, std.abs(std.sub(std.mul(uv.y, 2), 1)));
    const edge = std.mul(edgeX, edgeY);
    const alpha = std.add(0.09, std.mul(edge, 0.18));
    const light = std.add(0.74, std.mul(sweep, 0.26));

    return d.vec4f(std.mul(colorUniform.$, light), alpha);
  });

  material.colorNode = node as unknown as NonNullable<typeof material.colorNode>;

  return {
    material,
    setProgress(progress) {
      progressUniform.node.value = Math.min(1, Math.max(0, progress));
    },
  };
}
