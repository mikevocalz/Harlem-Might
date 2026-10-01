import * as THREE from 'three/webgpu';

export interface LightCycleWebGPURendererOptions {
  context: GPUCanvasContext;
  device: GPUDevice;
  antialias?: boolean;
  requiredLimits?: Record<string, number>;
}

/**
 * React Native WebGPU / Three bridge.
 *
 * Mirrors the current react-native-webgpu ThreeJS example: Three receives the
 * exact GPUCanvasContext + GPUDevice owned by react-native-webgpu and the caller
 * explicitly presents each rendered frame.
 */
export function makeLightCycleWebGPURenderer({
  context,
  device,
  antialias = true,
  requiredLimits,
}: LightCycleWebGPURendererOptions) {
  return new THREE.WebGPURenderer({
    antialias,
    canvas: context.canvas,
    context,
    device,
    requiredLimits,
  });
}

/**
 * Three's WebGPU renderer owns an internal animation loop and module-level
 * render objects. Stop it explicitly before dropping the scene.
 */
export function disposeLightCycleWebGPURenderer(
  renderer: THREE.WebGPURenderer,
) {
  renderer.setAnimationLoop(null);
  renderer.dispose();

  // Temporary parity with react-native-webgpu's example cleanup for Three's
  // shared QuadMesh listener leak (upstream Three cleanup is still evolving).
  const ThreeWithQuad = THREE as typeof THREE & {
    QuadMesh?: new () => {
      geometry: THREE.BufferGeometry & {
        _listeners?: Record<string, unknown>;
        index?: (THREE.BufferAttribute & {
          _listeners?: Record<string, unknown>;
        }) | null;
      };
    };
  };
  if (!ThreeWithQuad.QuadMesh) return;

  const quad = new ThreeWithQuad.QuadMesh();
  const targets = [
    quad.geometry,
    quad.geometry.index,
    ...Object.values(quad.geometry.attributes),
  ] as (
    | ({ _listeners?: Record<string, unknown> } & object)
    | null
    | undefined
  )[];

  for (const target of targets) {
    if (target?._listeners) target._listeners = {};
  }
}
