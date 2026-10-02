# Mights Sightline spatial hero

The homepage hero is a real cross-platform GPU scene, not a raster mockup.

- Three.js WebGPURenderer owns the scene.
- Browser WebGPU and react-native-webgpu use the same renderer contract.
- TypeGPU is initialized from the exact same GPUDevice.
- Kinetrell core evaluates the scroll-linked parallax state behind a universal UI component.
- Route code composes only @acme/ui and @acme/spatial.

The product object is an original Harlem Mights concept: lightweight spatial glasses plus a separate circular compute puck and a restrained route/POI ribbon. It references the broader lightweight-glasses/external-compute product category without copying one vendor's industrial design.

Kinetrell is pinned from mikevocalz/Kinetrell commit 5f1dbb88f90f0340a075eb16e654447450b6ffaa. Replace the workspace source snapshot with the published package when its dist release is available; do not fork the motion API inside Harlem Mights.
