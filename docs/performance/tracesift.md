# TraceSift performance workflow

TraceSift is the default local analyzer for React Profiler, Hermes, and JavaScript CPU captures in Harlem Might.

## Setup

Requires macOS or Linux and Node.js 22.19 or newer.

```sh
pnpm perf:tracesift:init
pnpm perf:tracesift
```

## Harlem Might scenarios

Keep device/build/data constant and profile one flow at a time:

- Explore map pan/zoom plus place selection;
- draggable map + information-pane updates;
- place carousel and Inspector/split-view transitions;
- Sightline hero animation;
- Rive HMI interactions;
- Three.js/WebGPU spatial scenes;
- Viro AR entry/exit and overlay updates;
- menu/PDF/webview transitions;
- saved-place/profile lists with realistic data.

Use React Profiler exports for render/commit problems and Hermes/JavaScript CPU profiles for JS hot spots.

TraceSift does not replace native/GPU profiling. If a finding points into Mapbox, ViroCore, WebGPU, camera, Skia, Metal/Vulkan, or another native layer, continue with the appropriate profiler and keep the TraceSift result as the JS-side handoff.

Do not commit raw profile files by default. Put the scenario, finding, and before/after measurement in the PR.
