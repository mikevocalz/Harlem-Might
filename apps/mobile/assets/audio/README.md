# Audio assets

Drop app-level music and sound files here.

Recommended theme-song filename:

```
apps/mobile/assets/audio/theme-song.wav
```

The spatial package now exposes `@acme/spatial/audio`:

- `spatialAudio.playAmbient(...)` for theme music and non-positional beds.
- `spatialAudio.playSpatial(...)` for a 3D point source.
- `spatialAudio.setListenerTransform(...)` to follow the player's headset/camera.
- `spatialAudio.setSourcePosition(...)` to move emitters in world space.

For native playback, pass a Metro asset module:

```ts
const THEME = require('./assets/audio/theme-song.wav');

await spatialAudio.playAmbient('theme', THEME, {
  loop: true,
  volume: 0.7,
});
```

For spatial emitters, positions are in your scene's meter-based world coordinates:

```ts
await spatialAudio.playSpatial('arena-core', source, {
  position: [0, 1.8, -4],
  distanceModel: 'inverse',
  refDistance: 1,
  rolloffFactor: 1.2,
});
```

Use headphones/headsets when evaluating panning. React Native Audio API currently
uses its supported equal-power `PannerNode` spatialization model.


## Spatial Audio API version

This branch is locked to `react-native-audio-api@1.0.0-nightly-87cca81-20260930`.
That nightly contains the upstream PannerNode/AudioListener spatial-audio work
merged in commit `87cca81`. Stable `0.13.6` does not expose those APIs yet.
