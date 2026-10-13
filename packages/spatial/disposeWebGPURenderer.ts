import type * as THREE from 'three/webgpu';

async function disposeBackend(backend: THREE.WebGPURenderer['backend']) {
  // Pinned Three implements this on both backends, but @types/three's base
  // Backend omits it. Check the runtime boundary rather than erase that type.
  if (!('dispose' in backend) || typeof backend.dispose !== 'function') {
    throw new Error('Three backend does not provide disposal');
  }
  await backend.dispose();
}

/** Call only after init has settled, and await before reusing the canvas. */
export async function disposeWebGPURenderer(
  renderer: THREE.WebGPURenderer,
  initialized: boolean,
  initialBackend: THREE.WebGPURenderer['backend'] = renderer.backend,
) {
  try {
    // Three can replace the WebGPU backend during init without disposing it.
    if (initialBackend !== renderer.backend) await disposeBackend(initialBackend);
  } finally {
    if (initialized) {
      await renderer.setAnimationLoop(null);
      await renderer.dispose();
    } else {
      // Three r186's setAnimationLoop(null), including the one inside dispose(),
      // calls init() again after failure. Release backend resources directly.
      const backend = renderer.backend as typeof renderer.backend & {
        isWebGLBackend?: boolean;
        gl?: { getExtension?: unknown } | null;
        _onContextLost?: EventListener;
      };
      if (backend.isWebGLBackend && typeof backend.gl?.getExtension !== 'function') {
        // r186 passes our GPUCanvasContext to its automatic WebGL fallback.
        // That fallback can register this listener, then fail before acquiring
        // a WebGL context. Its dispose() also assumes getExtension exists. No
        // GL resources can exist here; detach the exact registered listener.
        if (backend._onContextLost) {
          renderer.domElement.removeEventListener?.('webglcontextlost', backend._onContextLost);
        }
      } else {
        // WebGPUBackend only destroys devices it created, never our supplied
        // device (owned by the web canvas or react-native-webgpu's useDevice).
        await disposeBackend(backend);
      }
    }
  }
}
