# Sightline hero

The Harlem Might hero is a shared WebGPU scene, not a web-only mockup.

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

Hero target:
- one WebGPU device
- one Three renderer
- one TypeGPU root
- no React rerender per animation frame
- procedural geometry until an approved GLB beats it visually within budget
- cap browser DPR at 2
- reduced-motion freezes the ambient pulse and snaps scroll interpolation
- dispose every geometry/material/renderer/root on unmount

When a production GLB replaces procedural geometry, run the required game-asset-production, visual-debugging and performance-optimization skills before admission.
