# Sightline concept render

Sightline is a concept render of original Harlem Might glasses and a compute puck. The hardware does not exist and no place-label AR build has passed the bar in `docs/XR-PLATFORM-MATRIX.md`, so every surface that shows it calls it a concept render.

It mounts on `/ar` only, as a lazy island below the page's LCP element (`docs/adr/0004-sightline-placement.md`). It is not the homepage hero.

## Rendering stack

- Three.js WebGPURenderer owns scene graph, camera, PBR materials and geometry.
- TypeGPU is initialized from the exact same GPUDevice.
- @typegpu/three supplies the lens shader bridge into Three's node-material graph.
- Browser uses WebGPU Canvas through the universal UI primitive.
- Native uses react-native-webgpu Canvas.
- The scene accepts one normalized scroll progress value. It does not own scroll physics.

## Industrial-design direction

The model is original Harlem Might hardware:
- slim open spatial glasses
- warm silver / stone metal frame
- restrained graphite sensor rail
- small spatial cyan sensor accent
- separate round compute puck
- route ribbon + POI anchors showing the intended AR navigation use

It may reference the product category established by modern glasses + compute-puck systems, but it must not duplicate the industrial design of Meta, Valve, PICO, Apple or another vendor.

## Performance budget

Target:
- one WebGPU device
- one Three renderer
- one TypeGPU root
- no React rerender per animation frame
- procedural geometry until an approved GLB beats it visually within budget
- cap browser DPR at 2
- reduced motion renders one static frame and runs no loop (resize redraws that frame)
- no adapter, a failed init or a lost device calls `onUnavailable`, so the host swaps in its text fallback instead of a blank canvas
- dispose every geometry/material/renderer/root on unmount

When a production GLB replaces procedural geometry, run the required game-asset-production, visual-debugging and performance-optimization skills before admission.
