# Validate geospatial accuracy and confidence

Implemented on top of #69. The shared controller and existing Viro/Mapbox scene remain the only trip and renderer owners.

- Audited the exact pinned native bridge: ARCore Earth accuracy is 68%, passed through unchanged. Current ReactVision build is explicitly compass-only; SDK/key-dependent Earth calls are disabled by a shared build capability guard.
- Corrected the legacy positioning.sigmaM boundary, which already contains a rounded 68% radius. A real-controller 18 m regression prevents double conversion.
- Require fresh camera, heading, route-match and source observations; expire old placements, reject mismatched route frames and stale/reordered async results.
- Treat fixed eye height as estimated. Approximate floating cues are allowed when evidence supports them; ground ribbon, chevrons and precise destination remain hidden without measured ground.
- Serialize geospatial setup and release every temporary anchor, including partial failure and cancellation. Recalibration clears evidence without replacing the route or renderer.

See [AR_PLACEMENT_CONFIDENCE.md](../AR_PLACEMENT_CONFIDENCE.md) for source links, thresholds and validation. Pure/injected boundaries and real controller regressions run locally; exact branch results are recorded in the PR. Native binary, outdoor placement, elevation, camera and device UX remain unverified. No credential, dependency, deployment, migration or merge is included. Draft pending native acceptance.
