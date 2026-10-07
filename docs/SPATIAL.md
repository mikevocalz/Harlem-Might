# Harlem Might runtime

Harlem Might is a spatial-first Expo SDK 58 / Next starter with a deliberately layered renderer:

- **Tailwind 4 + Uniwind** for ordinary product UI on native.
- **React Native Skia 2.13** for universal GPU-drawn 2D scenes on iOS, Android and web.
- **Rive** for interactive animated UI surfaces.
- **Viro / OpenXR** for immersive 3D on Quest, Pico, web and supported native targets.

## Universal Skia graphics

`@acme/ui` includes three related procedural backgrounds:

- `GridFloor` — scrolling perspective floor.
- `GridScene` — mirrored ceiling + floor planes around a shared horizon.
- `GlyphCity` — deterministic neon city silhouettes, glyph-like vector cells, antenna lights and flying traffic.

The drawing implementations live in `*.skia.tsx` and are shared. Native imports them directly. Web wrappers only initialize CanvasKit and then load the same Skia component. There is no separate CSS/SVG rendering path.

CanvasKit is copied to `/canvaskit` for Next, Storybook and Expo web during postinstall by `tooling/copy-skia-web-assets.mjs`. `SkiaWebGate` caches that initialization so multiple backgrounds do not load CanvasKit repeatedly.

The default Grid composition intentionally layers:

1. `GridScene` as the full-screen floor/ceiling field.
2. `GlyphCity` as a transparent lower-horizon city layer.
3. Normal semantic application UI above both.

## Futuristic UI kit

The starter exports `CircuitButton` and `GridCard`. They are universal semantic controls styled through the existing Tailwind 4 / Uniwind boundary; Skia remains reserved for scene graphics.

Storybook contains **Spatial / Grid World** stories for:

- the complete Grid gateway composition;
- Grid Scene + Glyph City;
- Grid Floor;
- cyan/orange CircuitButton variants;
- futuristic GridCard variants.

## XR entryway and light-cycle race

The `/spatial` route and Expo Spatial drawer screen act as a gateway rather than dropping directly into a game.

The Viro world uses an early-1980s computer-world visual grammar without shipping film logos, characters, audio, models or copied production assets: black void, cyan vector floor grid, warm orange geometry, light walls/trails, sparse skyline outlines and minimal HUD typography.

`GridRaceScene` is a playable Viro starter:

- a selectable in-world **GRID ACCESS** gate;
- `ViroGameLoop` fixed-step simulation at 30 Hz;
- analog steering and boost from `ViroVirtualJoystick` on web and flat native previews;
- controller/hand-clickable LEFT/RIGHT pads inside the 3D world for headset fallback;
- continuous track movement, obstacle wrapping, collisions, hit count and distance score;
- a procedural player cycle silhouette and vertical light wall/trail;
- sparse outlined horizon architecture designed to read like an early vector-computer world.

The old Viro AR Driving Car sample informed the input/simulation direction: acceleration, steering and continuously updated transforms are much closer to a light-cycle game than a static Viro scene. The starter does not copy the sample's art or vehicle assets.

## Immersive routing

`SpatialViroExperience.native.tsx` separates headset entry from ordinary app previews:

- **Quest** uses `ViroXRSceneNavigator`, which hands the virtual scene to the headset VR activity.
- **Pico** uses the same XR navigator when the mikevocalz fork is enabled; that fork adds PICO detection/routing and floor-origin support.
- **iOS / ordinary Android** keep the scene in a `Viro3DSceneNavigator` preview with the same race module and virtual joystick.
- **Web** uses Viro Web Renderer with the same race scene and the web `ViroVirtualJoystick`.

The headset scene remains usable without the 2D joystick because the steering pads live inside the world.


## Futuristic tabletop placement (implemented)

Classic Grid Duel uses a placement-first mixed-reality flow rather than spawning a board at an arbitrary offset.

1. The host enters a valid player name and chooses **Create Table**.
2. The shared tabletop route mounts `TabletopColocationScene` with a `ViroARScene` root. On Quest this is the Horizon OS/OpenXR mixed-reality path; on phones it is normal Viro AR.
3. `ViroARPlaneSelector` accepts horizontal **Table** and **Floor** classifications on Quest. Phone AR also accepts unclassified horizontal surfaces as a fallback.
4. Valid surfaces receive a translucent cyan selector. The host taps a real surface.
5. A 1.24 m × 0.84 m futuristic Grid mat preview appears at the tap point with a cyan vector grid, orange corner locks, **LOCK GRID**, and **MOVE** controls.
6. The room/shared frame is not created until **LOCK GRID** is confirmed.
7. Quest hosts create a Meta shared spatial frame. Phone hosts publish the selected local plane anchor and use the resulting ReactVision cloud-anchor frame.
8. After `ViroSharedFrame` localizes, the host's world-space tap is converted with `parseLocationTransform()` + `worldToLocation()` into the shared/location coordinate frame.
9. The host owns and replicates `lightcycle:placement`. Player 2 reads that location-frame pose only after localizing the same shared frame.
10. Both devices therefore render the Grid mat from the same shared-frame coordinate, never from raw session-world coordinates.

Quest surface data comes from the Horizon OS room model (`XR_FB_scene`), so the user must run **Settings → Physical Space → Space Setup** once for floor/table planes to exist. The app requests `horizonos.permission.USE_ANCHOR_API` before mounting tabletop placement.

The tabletop MR navigator keeps `hdrEnabled={false}` and `bloomEnabled={false}`. Horizon OS passthrough is a transparent compositor layer; the current HDR/bloom intermediate path makes the final target opaque and can hide passthrough.

### Player 2 / co-location contract

Physical alignment and game replication remain separate concerns:

- `ViroSharedFrame` = **where the Grid exists in the real room**.
- `useViroColocationRoom` = host room creation / six-character guest lookup.
- `useViroColocation` = peer membership and pose channel.
- `useViroReplicatedState` / `ViroReplicationClient` = mat placement, player presence, ready state, match authority, input intents and authoritative snapshots.

The host cannot create the room code until the mat has been locked and the shared frame has localized. The guest cannot become Ready until their own device has localized that frame and the replicated mat pose exists. Ready state alone is not proof of co-location.

Current supported physical shared-frame paths are feature-detected:

- **Quest ↔ Quest:** Meta group-shared spatial frame.
- **Phone ↔ phone:** ReactVision/cloud-anchor shared frame.
- **Vision ↔ Vision:** use the fork's visionOS shared-space path when the app supplies the required alignment transport.
- **PICO:** do not advertise physical co-location until a supported shared-frame source is present in the runtime.

Cross-family physical co-location is not claimed.

References:
- HorizonOS setup guide: https://viro-community.readme.io/docs/horizonos-setup-guide
- ReactVision co-location article: https://www.reactvision.xyz/updates/building-multi-user-experiences-with-co-location/
- ViroReact 3.0.0 five-platform architecture: https://www.reactvision.xyz/updates/viroreact-3-0-0-five-platforms-one-codebase/

## Meta Horizon and Meta VR Glasses

The current private Viro fork treats Meta immersive hardware as one **Meta Horizon/OpenXR runtime family** rather than assuming every Meta device is a Quest.

- `isMetaHorizonXR` owns immersive routing.
- `isKnownQuest` and reported model strings are diagnostics only.
- `metaVrGlassesCompatible: true` writes Meta's current `quest3+` Store delivery target while preserving the existing Quest compatibility metadata.
- `getOpenXRRuntimeCapabilities(viewTag)` reports negotiated gaze, hand tracking/aim, passthrough, plane detection, scene understanding, foveation, eye-tracked foveation and local-floor capabilities.
- Product behavior must feature-detect those runtime facts instead of branching on a headset model name.

The checked-in Android manifest mirrors the generated config-plugin result so bare/native builds and Expo prebuilds agree.

App config, look-and-pinch input, the testing ladder and open questions for the glasses: [META_VR_GLASSES.md](META_VR_GLASSES.md).

## System spatial windows

`ForkSpatialLayout` detects optional `ViroSpatialSceneProvider`, `ViroSpatialWindow` and layout-support exports from the mikevocalz Viro fork.

- Quest can use Meta Layout system windows when the fork is enabled.
- Pico uses the shared Viro/OpenXR scene and inline window fallback.
- Web uses the Viro browser renderer.

## Use the mikevocalz Viro fork

The Quest/PICO native development target is `mikevocalz/viro#decax9-three-panel`. Because this starter repository is public while that fork is private, the checked-in catalog keeps public `@reactvision/react-viro@3.0.2` only as an unauthenticated **web/Storybook/CI resolution fallback**. It is not an accepted native SDK-58 runtime.

Every native command now runs `apps/mobile/scripts/assert-viro-fork.mjs` first. If public Viro is installed, `dev`, `android`, `ios`, and `prebuild` fail before Expo starts. A native/headset build therefore cannot accidentally ship against the unsupported public 3.0.1 peer lane.

For native/headset development, enable the private fork so the Expo 58/RN 0.88 peer lane, PICO routing, OpenXR bridge, spatial windows and native Viro/Rive surface are present:

```yaml
overrides:
  "@reactvision/react-viro": "github:mikevocalz/viro#decax9-three-panel"
```

Then run:

```bash
pnpm install
pnpm --filter mobile viro:assert-fork
pnpm spatial:prepare-web
pnpm skia:prepare-web
```

## Checked-in Android XR project

The Android project is committed and kept in sync with the fork's generated Quest/OpenXR contract. `pnpm spatial:verify-android` verifies Viro Gradle projects/dependencies, Meta Layout SDK dependencies, AR/Quest/PICO package registration, Quest permissions/features, `VRActivity`, arm64 targeting, target SDK ceiling, scheme and app branding. CI runs this before the monorepo build so generated native drift fails visibly.

## Quest + Meta Layout SDK

The Expo app declares `@metavr/layout-compat` and `@metavr/layout-window-compat` directly. The Viro plugin config enables AR, Quest and Pico, with Meta spatial layouts enabled for Quest and inline/Viro fallback elsewhere.

## Assets / Metro

`apps/mobile/metro.config.js` keeps Expo SDK 58's resolver and adds authored spatial formats including `.riv`, GLB/GLTF, OBJ/MTL/FBX, HDR/EXR, KTX/KTX2, splat data and WASM.

## Routes

- Next: `/spatial`
- Expo: drawer → **Spatial**

Both mount the same `SpatialScreen`.

## Design and interaction references

- NeonBlade Grid Scene: https://neonbladeui.neuronrush.com/components/backgrounds/grid-scene
- NeonBlade Glyph City: https://neonbladeui.neuronrush.com/components/backgrounds/glyph-city
- ReactVision Viro sample app AR Car Driving: https://github.com/ReactVision/sample-app/tree/main/Screens/ARDrivingCarDemo
- Legacy Viro AR Driving Car sample: https://github.com/viromedia/viro/tree/master/code-samples/js/ARDrivingCarDemo

These are implementation references only. The starter's Skia backgrounds, product UI and Viro race are newly authored.


---

## Horizon OS tabletop placement and co-location contract

The tabletop duel is an **MR placement flow**, not a pure VR scene. On Quest, use a `ViroARScene` root through `ViroXRSceneNavigator` so Horizon OS room-model planes are available inside VRActivity.

Placement rules:

1. request `horizonos.permission.USE_ANCHOR_API` at runtime;
2. require Physical Space / Space Setup when Quest reports no planes;
3. accept horizontal `Floor` and `Table` classifications for the game mat;
4. render the futuristic Grid mat as a live animated preview on the detected plane;
5. let the host move/reselect before confirming;
6. disable HDR/bloom for the MR placement scene so passthrough remains visible;
7. once locked, convert the mat pose into the shared location frame;
8. only then create the co-location room / join code.

The preview uses Viro's native animation system; placement animation must not be driven by React component state.

### Shared frame is not game replication

Keep these layers separate:

- **ViroSharedFrame / frame source** answers: *where is the physical tabletop?*
- **useViroColocationRoom** answers: *which room/code and which frame source does this session use?*
- **useViroColocation** answers: *which peers are actually present/localized in that shared frame?*
- **useViroReplicatedState** answers: *what durable lobby/match state exists?*

Never transmit raw device world coordinates. Camera/player poses are converted into the shared location frame before publishing.

For Quest host/join:

- host creates a Meta group frame using `metaSpatialAnchorFrameSource(groupId, 'create')`;
- guest resolves the room code and receives the same frame reference;
- guest joins using `metaSpatialAnchorFrameSource(groupId, 'join')`;
- the Grid mat pose is replicated **inside that shared frame**, not as a raw world pose.

A player may become Ready only when all of these are true:

- local shared frame localized;
- co-location channel state is `joined`;
- the remote peer is present and reports localized;
- the confirmed mat placement exists.

If co-location drops, Ready is revoked. A stale replicated `ready: true` is never sufficient to start the countdown.

Current physical co-location scope is same-family only unless separately tested:

- phone ↔ phone via cloud-anchor frame;
- Quest ↔ Quest via Meta shared spatial-anchor group;
- Vision ↔ Vision only when shared-space transport is fully wired.

Do not advertise cross-family physical alignment without a tested bridge between those coordinate systems.

### Zustand-only spatial state

Application/session/game state in `packages/spatial` lives in Zustand stores. Do not introduce React `useState` for:

- placement candidates;
- detected-surface state;
- permission state;
- room/join state;
- localization/readiness;
- race simulation state;
- authoritative tabletop snapshots;
- spatial-view visibility.

React refs are allowed for renderer handles, sequence cursors, timers and other non-render application internals. Effects may synchronize Zustand state with Viro/native systems.

## Production tabletop Light Cycle game

The current `GridRaceScene` is only the starting point. The intended Light Cycle experience is a complete tabletop competitive game that preserves iconic light-wall trapping gameplay while sharing one deterministic gameplay core across Viro and Three.js.

This section is the implementation contract for that work.

### Product goal

The primary tabletop mode is a two-player **Classic Grid Duel** played on a shared miniature Grid placed on a real table.

Both players must be able to:

- enter their own player name before Play/Ready;
- create or join the same tabletop session;
- see the same arena in the same physical tabletop location on supported Viro device families;
- see the same cycle positions, turns, trails and collisions;
- ready up independently;
- start on the exact same authoritative simulation tick;
- collide with light walls, arena boundaries and valid obstacles;
- derez/destroy on collision;
- score synchronized rounds;
- continue into subsequent rounds without state divergence;
- see synchronized Rive scoreboard/leaderboard panels.

The experience should feel like two people standing around a miniature Grid trying to trap each other with walls of light, not like two disconnected AR demos that happen to display motorcycles.

The broader Light Cycle race remains separate and must preserve the previously selected **37-cycle** race target. Do not reduce, replace or silently redefine that race scope while implementing this two-player tabletop duel.

### Research and gameplay references

Use the game-design lineage of:

- the 1982 TRON Light Cycle sequence;
- the original Bally/Midway TRON Light Cycles game;
- TRON 2.0 / Killer App;
- TRON: Evolution;
- TRON: Evolution — Battle Grids;
- TRON RUN/r;
- mature open-source light-cycle implementations such as Armagetron-family projects and 3dLightCycles.

Extract mechanics and engineering ideas only. Do not copy proprietary TRON models, logos, audio, characters, film assets or game code.

Useful engineering references:

- ReactVision Viro AR Driving Car sample:
  https://github.com/ReactVision/sample-app/tree/main/Screens/ARDrivingCarDemo
- Legacy Viro AR Driving Car sample:
  https://github.com/viromedia/viro/tree/master/code-samples/js/ARDrivingCarDemo
- 3dLightCycles:
  https://github.com/erichlof/3dLightCycles

The tabletop mode should retain the recognizable Light Cycle fundamentals:

- continuous forward movement while alive;
- fast left/right turns;
- hard 90-degree **logical** turns by default;
- a luminous wall generated behind every living cycle;
- opponent-wall collision is lethal;
- own-wall collision is lethal;
- arena-boundary collision is lethal;
- tactical speed/boost use;
- trapping, boxing-in and cutting across an opponent's projected path;
- immediate authoritative derez when a lethal collision occurs;
- dramatic destruction/derez presentation after the gameplay result is known.

Do not turn the default mode into a conventional free-steering motorcycle racer. Visual steering and lean may be smooth, but gameplay truth remains deterministic Grid movement.

### Engineering roster and skills

Treat this as work owned by:

- principal gameplay engineer;
- principal multiplayer/network engineer;
- principal XR/spatial engineer;
- principal Three.js/WebGL engineer;
- principal Rive engineer;
- senior technical artist;
- senior game designer;
- QA/performance engineer.

Use current project skills/tools before implementation, including:

- Viro MCP and current Viro docs/source;
- Three.js expertise/current docs;
- Rive current runtime/Data Binding guidance;
- current React Native/Expo guidance;
- any enabled game-development plugins/skills that are available in the coding environment.

The game plugins should be used to strengthen gameplay architecture, collision testing, game-loop design and multiplayer validation where applicable. They do not replace deterministic tests or current Viro/Rive documentation.

Do not invent APIs.

## Shared Light Cycle runtime

Do **not** make Viro or Three.js the gameplay engine.

Create a portable runtime above both renderers:

    @lightcycle/core
            |
            | deterministic GameFrame
            |
       +----+--------------------+
       |                         |
       v                         v
    @lightcycle/viro       @lightcycle/three

Suggested package split:

    packages/
      lightcycle-core/
      lightcycle-assets/
      lightcycle-viro/
      lightcycle-three/
      lightcycle-rive-ui/
      lightcycle-multiplayer/

The shared core owns:

- fixed simulation tick;
- player inputs;
- movement;
- direction;
- speed;
- boost;
- wheel angle;
- trail topology;
- collision;
- arena bounds;
- score;
- round lifecycle;
- match lifecycle;
- deterministic destruction events;
- deterministic random seeds;
- replay input logs;
- AI decisions;
- authoritative outcomes.

Renderer adapters own:

- GLB loading;
- mesh hierarchy;
- node transforms;
- skeletal/morph animation playback;
- wheel rendering;
- shaders;
- particles;
- trail geometry;
- visual interpolation;
- camera;
- audio playback;
- XR/world placement.

Renderer physics may be used for non-gameplay debris **after** an authoritative result is decided, but Viro or Three.js physics must never decide whether a cycle lives, dies, scores or wins.

## Deterministic simulation

Use a fixed **60 Hz** gameplay simulation.

Rendering may run at the display refresh rate and interpolate between authoritative simulation states.

Authoritative gameplay coordinates should use integer or fixed-point Grid units rather than arbitrary renderer-space floating-point positions.

Logical Grid coordinates are mapped into metres separately by each renderer.

The same:

- seed;
- match configuration;
- ordered input log;

must produce the same:

- turn points;
- trail segments;
- collision tick;
- derez event;
- round winner;
- score;

in Node/core tests, Three.js and Viro.

## Core movement rules

A living Light Cycle:

- always moves forward;
- cannot directly reverse;
- accepts LEFT and RIGHT relative turns;
- uses hard 90-degree logical turns by default;
- may accelerate/boost according to mode;
- cannot simply stop to avoid collision.

Recommended input commands:

    TURN_LEFT
    TURN_RIGHT
    BOOST_DOWN
    BOOST_UP

Reject illegal 180-degree reversals.

Visual turn interpolation must never change collision truth.

## Light Cycle model and animation contract

Do not depend on one monolithic GLB animation to provide wheel spin, steering, lean, boost and crash behavior.

The bike may look seamless but expose controllable nodes similar to:

    LightCycleRoot
    ├─ Chassis
    ├─ FrontWheelPivot
    │  └─ FrontWheel
    ├─ RearWheelPivot
    │  └─ RearWheel
    ├─ RiderRoot
    ├─ TrailSocket
    ├─ RearFXSocket
    ├─ FrontImpactSocket
    ├─ CameraSocket
    └─ ExplosionOrigin

Pre-fractured destruction pieces should be prepared for major components such as:

- front cowling;
- left/right body;
- front wheel;
- rear wheel;
- canopy;
- energy core;
- selected chassis fragments.

Authored GLB clips may include:

- spawn;
- idle;
- rider_accelerate;
- rider_brace;
- rider_crash;
- bike_powerup;
- bike_impact;
- bike_crumple;
- respawn.

Critical gameplay behavior must not require simultaneous clip blending that one renderer cannot reproduce.

### Wheel motion

Wheel spin is procedural:

    angularVelocity = linearVelocity / wheelRadius
    wheelAngle += angularVelocity * dt

The shared core calculates wheel angle. Viro and Three.js consume the same result.

This keeps wheel behavior correct under:

- acceleration;
- cruise;
- boost;
- slowdown;
- impact;
- wheel separation during destruction.

### Steering and lean

Logical turn:

    exact deterministic Grid direction change

Visual presentation may animate:

- front-wheel steering;
- chassis lean;
- rider lean;
- suspension;
- acceleration squat;
- a short curved visual interpolation.

The visual arc must never alter the authoritative collision path.

## Light wall / jet wall

Every living cycle continuously generates a lethal energy wall behind itself.

Represent gameplay walls as deterministic trail segments, **not** renderer meshes.

Each trail segment needs at minimum:

- owner player ID;
- start Grid coordinate;
- end Grid coordinate;
- creation tick;
- active/completed state.

When a player turns:

1. close the current straight segment;
2. record the exact deterministic turn point;
3. create a new segment from that point;
4. extend the new segment as the cycle advances.

The renderer converts those logical segments into luminous wall geometry.

### Default trail rule

Classic Grid Duel uses **persistent trails for the entire round**.

Optional later variants may support:

- timed trails;
- finite/receding trails.

Persistent trails are the default.

### Trail rendering

Both engines should reproduce the same high-level look:

- white-hot energy near the cycle;
- strong player-color emission;
- emissive halo/bloom where supported;
- Fresnel-like edge;
- subtle moving energy/noise;
- vertical energy striations;
- impact ripple;
- brief instability near newly generated wall.

Three.js should use batched/dynamic geometry and a custom shader.

Viro should use the best current procedural/batched geometry path plus matching custom material/shader behavior.

Do not create one React component per tiny trail section.

## Collision system

Collision is gameplay-critical and lives in `lightcycle-core`.

A cycle derezzes when its swept path intersects:

1. arena boundary;
2. opponent completed trail;
3. opponent active trail;
4. own completed trail;
5. own active trail when geometrically valid;
6. a lethal arena obstacle;
7. another cycle under explicit simultaneous-collision rules.

High speed/boost must never tunnel through a wall.

Use deterministic swept segment intersection with fixed-point/integer math. Add deterministic microsteps only if required.

### Same-tick collision resolution

Never resolve Player 1 first and Player 2 second in a way that grants player-order advantage.

For every authoritative tick:

1. collect eligible inputs;
2. compute proposed movement for every living cycle;
3. compute prospective new trail pieces;
4. evaluate all collisions against the same relevant world state;
5. resolve all same-tick outcomes;
6. commit valid movement/trails;
7. emit derez events;
8. update round/score.

Required cases:

- same-cell head-on: both derez;
- head swap: both derez;
- both hit separate walls on same tick: both derez;
- perpendicular crossing: resolve by deterministic intersection timing;
- endpoint collision: deterministic and tested;
- boost crossing a wall: still collides;
- illegal reverse: rejected before movement.

## Derez / destruction

Do not simply hide the cycle.

The gameplay result occurs immediately. The presentation follows.

Core emits a deterministic event similar to:

    DEREZ_EVENT {
      playerId,
      tick,
      position,
      impactNormal,
      impactType,
      seed
    }

The seed controls corresponding fragment motion/effect variation across renderers.

Recommended visual timeline:

    0 ms    collision result committed
    15 ms   energy overload
    35 ms   impact flash
    60 ms   wall impact ripple
    80 ms   sparks
    100 ms  shell destabilization
    130 ms  chassis fracture
    160 ms  major energy explosion
    180 ms  fragments separate
    250 ms  light wall flicker
    350 ms  cycle/program dissolution
    600 ms  trail round-end fade
    1000 ms residual debris/energy fade

Use pre-fractured meshes for important pieces.

The core should provide deterministic initial fragment velocity/angular velocity where useful.

## Game mode 1 — Classic Grid Duel

Finish this mode completely before adding multiple half-finished variants.

Default:

- 2 players;
- persistent trails;
- no random powerups;
- continuous forward movement;
- hard 90-degree logical turns;
- limited boost;
- lethal trail walls;
- lethal arena edge;
- one life per round;
- first to 5 round wins.

Configurable:

    Rounds to Win:
      3
      5
      7

    Boost:
      Off
      Limited
      Regenerating

    Trail:
      Persistent
      Timed
      Receding

Default:

    First to 5
    Limited Boost
    Persistent Trail

### Round state machine

    LOBBY
      ↓
    PLAYER_READY
      ↓
    COUNTDOWN
      ↓
    ROUND_ACTIVE
      ↓
    DEREZ / ROUND_END
      ↓
    ROUND_RESULT
      ↓
    RESET_GRID
      ↓
    NEXT_ROUND
      ↓
    MATCH_RESULT

Countdown:

    3
    2
    1
    GRID!

Both cycles become active on the same authoritative simulation tick.

Never start gameplay because a local animation happened to finish.

### Scoring

Default Classic rules:

- opponent crashes into your trail: you win the round;
- opponent hits own trail: you win, cause = SELF_DEREZ;
- opponent hits arena wall: you win, cause = ARENA;
- both derez on same authoritative tick: draw round, no point, restart.

At 4–4 in first-to-5, Rive should announce:

    FINAL GRID

## Boost

Boost should add strategy without replacing the wall-trapping game.

Example tunable values:

    capacity: 100
    drain while boosting: 28/sec
    recharge delay: 1.5 sec
    recharge: 14/sec

Boost should:

- increase forward speed;
- increase procedural wheel RPM;
- intensify trail emission;
- intensify engine/core light;
- alter audio pitch;
- increase motion intensity.

Boost never grants invulnerability.

Boosting into a wall derezzes the player sooner.

## Tabletop arena

The arena should feel like a physical miniature Grid board sitting on a real table.

Suggested physical footprint:

- approximately 1.0–1.4 m wide;
- approximately 0.65–0.9 m deep;
- user-resizable before the match begins.

Include:

- dark glass-like Grid floor;
- luminous grid subdivisions;
- raised perimeter;
- cycle spawn gates;
- readable light walls;
- animated countdown/start gate;
- spatial Rive score panels;
- dramatic derez effects readable from all sides.

Players must be able to physically walk around the board in XR.

Do not force a fixed spectator camera in tabletop XR.

## Table placement

Host flow:

    Scan environment
      ↓
    Detect/select tabletop
      ↓
    Preview arena
      ↓
    Scale/orient arena
      ↓
    Confirm placement
      ↓
    Establish shared spatial frame
      ↓
    Create multiplayer room

Once placement is confirmed, normal gameplay transforms are represented relative to the shared frame.

The physical tabletop surface does not determine gameplay collision. The virtual arena boundary does.

## Viro co-location

Use **current Viro co-location APIs and source**. Do not rebuild spatial coordinate sharing from scratch if the fork/current Viro already provides it.

Use the current equivalents of:

- `ViroSharedFrame`;
- `useViroColocationRoom`;
- `useViroColocation`;
- `useViroReplicatedState`;
- `ViroReplicationClient`;
- peer/entity smoothing helpers where appropriate.

Treat spatial multiplayer as two separate concerns:

    SHARED FRAME
      = where the tabletop exists physically

    REPLICATION
      = what the game currently contains

Do not confuse them.

### Shared/location coordinates

Shared spatial positions must use Viro's shared/location coordinate frame.

Never transmit raw device-session world coordinates as authoritative shared tabletop coordinates.

Where supported, render shared game content inside the shared frame root.

### Platform-family behavior

Respect the actual current Viro support matrix and feature-detect.

Expected co-located families:

- phone ↔ phone;
- Quest ↔ Quest;
- Vision ↔ Vision where supported by the current fork/runtime.

Do **not** advertise Quest↔phone, Quest↔Vision or phone↔Vision physical co-location unless a real tested cross-family spatial-alignment solution exists.

### Quest

Quest shared tabletop mode must use the correct mixed-reality/AR scene root required by the current Viro co-location implementation.

Use current Meta spatial-anchor/group-sharing support exposed by the Viro fork.

Enable all required current permissions/config-plugin flags.

### Phone

Use the current supported cloud/shared-anchor path exposed by Viro.

Host places/publishes the frame; guest resolves/localizes before becoming Ready.

### Vision Pro

Use the current shared-space alignment path available in the fork/runtime.

If alignment packets require explicit transport, implement that transport rather than assuming automatic propagation.

## Three.js parity

The Three.js build uses the exact same `lightcycle-core`.

It must reproduce:

- movement;
- trail topology;
- collision;
- score;
- match state;
- derez event;
- replay.

Three.js does not magically gain Viro physical shared-frame support.

Provide separate capabilities such as:

- local browser game;
- remote multiplayer over a web transport adapter;
- spectator mode where backend transport exists.

Use an abstraction similar to:

    interface MultiplayerTransport {
      connect(roomId: string): Promise<void>;
      sendInput(input: PlayerInput): void;
      subscribe(handler: GameNetworkHandler): Unsubscribe;
      disconnect(): void;
    }

Implement platform adapters rather than coupling the core to Viro networking.

## Player name and lobby flow

The player must enter a valid name **before** Play/Create/Join becomes available.

Recommended validation:

- required;
- trim whitespace;
- 1–16 visible characters;
- reject all-whitespace;
- reject control characters.

Flow:

    ENTER NAME
      ↓
    CREATE TABLE
    JOIN TABLE
    SOLO / AI

Rive displays the supplied name.

Application/native UI owns actual text entry. Do not force Rive to become a text editor/IME.

Bind the final name string into the Rive View Model.

## Two-player join flow

### Player 1 — Host

    1. Open app.
    2. Enter player name.
    3. Press CREATE TABLE.
    4. Scan/place tabletop arena.
    5. Confirm placement.
    6. Establish shared spatial frame.
    7. Create Viro co-location room.
    8. Receive/display six-character join code.
    9. Rive shows WAITING FOR PLAYER.
    10. Host remains in lobby until guest localizes and both players are Ready.

The displayed room code is the baseline join mechanism.

QR/share can be added only if implemented correctly; do not make them prerequisites.

### Player 2 — Guest

    1. Open app.
    2. Enter player name.
    3. Press JOIN TABLE.
    4. Enter six-character code.
    5. Resolve room.
    6. Resolve the platform's shared frame source.
    7. Localize into the same physical coordinate frame.
    8. Join replication channel.
    9. Publish player presence.
    10. Rive shows LOCATING GRID…
    11. Once localized, Rive shows GRID FOUND / READY.

Both users must see the arena occupying the same physical tabletop location before the guest can Ready.

## Player presence and slots

Maintain shared player state similar to:

    player:p1
    player:p2

Fields should include:

- peer ID;
- slot;
- name;
- ready;
- localized;
- connected;
- cycle color;
- score;
- rounds won.

Slot assignment must be authoritative.

Never allow both peers to claim the same player slot.

## Ready system

Joining does not immediately start gameplay.

Require:

- P1 localized;
- P2 localized;
- P1 ready;
- P2 ready;
- host match state ready.

Then host schedules an authoritative start tick.

Rive sequence:

    PLAYER 2 CONNECTED
      ↓
    BOTH PLAYERS READY
      ↓
    3
    2
    1
    GRID!

## Network authority

Use **host-authoritative gameplay**.

The host owns the authoritative match simulation.

The guest sends input intents.

The guest must never directly decide:

- winner;
- score;
- opponent death;
- trail collision result.

Input event shape should be compact, for example:

    {
      playerId,
      sequence,
      targetTick,
      command:
        TURN_LEFT |
        TURN_RIGHT |
        BOOST_DOWN |
        BOOST_UP
    }

Do not stream the whole bike transform as the primary gameplay protocol.

Deterministic simulation reconstructs movement from ordered inputs.

## Client prediction and reconciliation

For responsiveness, a guest may predict their own valid local inputs immediately.

Host processes the same command.

Host publishes periodic authoritative snapshots.

If prediction differs:

- smooth harmless render drift;
- hard-correct gameplay truth when state/collision differs;
- never visually allow a cycle to continue through a wall after authoritative derez.

## Replication strategy

Use current Viro replicated state / long-lived replication client where appropriate.

Good replicated concepts:

- match;
- player:p1;
- player:p2;
- compact input state/events;
- compact authoritative snapshots.

Do **not** create one replicated network entity per trail segment forever.

Trail state should be reconstructed from deterministic turn/input history and periodic authoritative snapshots.

Suggested ownership:

    match
      host-owned

    player input
      respective player-owned/requested

    authoritative snapshots
      host-owned

    score
      host-owned

The guest may never write authoritative score.

## Snapshots and desync detection

Host periodically emits compact snapshots containing:

- authoritative tick;
- round;
- phase;
- each player's Grid coordinate;
- each player's direction;
- speed/boost state;
- alive state;
- score;
- compact trail hash/state hash.

Create a deterministic hash over critical gameplay state.

On hash mismatch:

    DESYNC_DETECTED
      ↓
    request authoritative snapshot
      ↓
    repair local core state
      ↓
    continue

Log desyncs in development.

## Disconnect/reconnect

During lobby:

- reserve a disconnected slot briefly;
- show RECONNECTING.

During a live match:

- allow a short network grace window;
- pause if peer loss exceeds that window;
- allow rejoin for a configurable timeout;
- end match cleanly if reconnect fails.

Do not silently replace the human with AI.

Host disconnect is more serious because host is authoritative.

For the first production implementation:

- pause;
- attempt host reconnect;
- if host cannot return, end the match cleanly.

Do not claim host migration exists until it is implemented and tested.

## Solo / AI

Single-player uses the same core and the same input-event interface.

AI may produce:

    TURN_LEFT
    TURN_RIGHT
    BOOST_DOWN
    BOOST_UP

AI should not use privileged collision knowledge unavailable to a human.

Possible behaviors:

- Survivor: maximize open space;
- Hunter: cut predicted opponent route;
- Trapper: build corridors and enclosures;
- Aggressor: use speed for cutoffs;
- Adaptive: switch strategies based on reachable area.

Use flood-fill/reachable-area evaluation for higher difficulties.

## Rive scoreboard and leaderboard

Use the project's existing Rive panel infrastructure.

Do not reinvent the Rive XR panel.

Create/reuse a dedicated scoreboard artboard/file such as:

    lightcycle_scoreboard.riv

Use current Rive:

- View Models;
- Data Binding;
- State Machines;
- nested reusable components;
- string/number/color properties;
- runtime events.

Rive is a presentation layer.

The game core owns score and match state.

### Rive View Model

Model should expose at minimum:

    MatchScoreboard
    ├─ player1
    │  ├─ name
    │  ├─ score
    │  ├─ roundsWon
    │  ├─ color
    │  ├─ ready
    │  ├─ connected
    │  └─ state
    ├─ player2
    │  ├─ name
    │  ├─ score
    │  ├─ roundsWon
    │  ├─ color
    │  ├─ ready
    │  ├─ connected
    │  └─ state
    └─ match
       ├─ round
       ├─ roundsToWin
       ├─ countdown
       ├─ phase
       ├─ winnerName
       ├─ joinCode
       └─ overtime/final-grid state

### Rive scoreboard states

Include animated states for:

- LOBBY;
- WAITING_FOR_PLAYER;
- PLAYER_JOINING;
- LOCALIZING;
- PLAYER_CONNECTED;
- READY_CHECK;
- COUNTDOWN;
- PLAYING;
- P1_DEREZZED;
- P2_DEREZZED;
- ROUND_RESULT;
- MATCH_POINT;
- FINAL_GRID;
- MATCH_WINNER;
- RECONNECTING;
- INVALID_CODE;
- ROOM_NOT_FOUND;
- ROOM_FULL;
- COLOCATION_UNSUPPORTED;
- LOCALIZATION_FAILED;
- NETWORK_ERROR.

### Spatial placement

In tabletop XR:

- P1 gets a readable panel on one long edge;
- P2 gets an appropriately oriented panel on the opposite edge;
- a center match-status/countdown panel may float above the arena.

Do not mirror text backward for the opposite player.

Panels remain spatially tied to the shared arena frame.

### Score animation

When a player scores:

    old score
      ↓
    number pulse
      ↓
    energy sweep
      ↓
    new score

When a player derezzes:

- loser panel shows DEREZZED;
- winner panel shows ROUND +1.

At match point show MATCH POINT.

At victory show:

    WINNER
    PLAYER_NAME

## Session leaderboard

Track, at minimum:

- Name;
- Wins;
- Losses;
- Rounds Won;
- Derezzes Caused;
- Self-Derezzes;
- Current Streak;
- Best Streak;
- Longest Survival;
- Longest Trail;
- Fastest Win.

For two players, present this as a polished animated head-to-head summary in Rive.

Persistent storage should sit behind an interface such as:

    interface LeaderboardStore {
      submitMatch(result: MatchResult): Promise<void>;
      getLeaderboard(): Promise<LeaderboardEntry[]>;
    }

Use the project's existing backend pattern if persistence already exists. Do not add a second database unnecessarily.

## Controls

### Phone/tablet

Primary controls:

- LEFT;
- RIGHT;
- BOOST.

Optional swipe left/right may supplement them.

Do not require tiny analogue joystick precision for the Classic Grid mode.

### Quest

Use controller actions for:

- left turn;
- right turn;
- boost.

Hand input can be added only if robust on the current stack.

### Vision Pro

Use the current supported spatial input path.

### Web

Keyboard defaults:

- A / LeftArrow = LEFT;
- D / RightArrow = RIGHT;
- Space = BOOST.

Optional gamepad support is welcome.

LEFT and RIGHT are relative to the current cycle heading.

## Audio

Create an engine-independent event contract including:

- ENGINE_START;
- ENGINE_IDLE;
- ENGINE_ACCELERATE;
- BOOST_START;
- BOOST_END;
- TURN;
- TRAIL_HUM;
- IMPACT;
- DEREZ;
- ROUND_WIN;
- MATCH_WIN;
- COUNTDOWN.

Use Viro spatial audio where appropriate and Web Audio/positional audio on Three.js.

Game events drive audio timing.

## Replay

Because the simulation is deterministic, store lightweight replay data:

- seed;
- match configuration;
- player names/colors;
- spawn positions;
- ordered input events;
- authoritative derez events;
- final score.

Do not store every rendered frame.

Replay should re-run the simulation.

Use replay data for:

- debugging;
- desync reproduction;
- short round highlights;
- winner recap.

## Visual style

Preserve the starter's early-computer-world / TRON-inspired direction:

- black/deep charcoal void;
- cyan/blue player;
- orange/red opponent;
- bright white energy cores;
- luminous Grid;
- dark glass;
- sparse futuristic architecture;
- restrained high-contrast HUD treatment.

Avoid generic cyberpunk clutter.

The player must instantly read:

- MY CYCLE;
- THEIR CYCLE;
- MY WALL;
- THEIR WALL;
- OPEN SPACE;
- ARENA EDGE.

Do not rely on color alone. Add distinct player labels/icons or subtle wall-pattern differences for accessibility.

## Effect parity contract

Create a renderer contract similar to:

    interface LightCycleEffectRenderer {
      setTrail(state): void;
      setEmission(state): void;
      playImpact(event): void;
      playDerez(event): void;
      playBoost(event): void;
      updateFragments(frame): void;
    }

Implement Viro and Three.js adapters.

Neither renderer may invent gameplay outcome state.

Baseline GLB materials should stick to portable PBR features where practical:

- base color;
- metallic;
- roughness;
- normal;
- emissive;
- AO.

High-end energy treatment belongs behind renderer adapters so Three.js-only material extensions do not become required for visual identity.

## Performance rules

### Viro

- do not React-rerender every simulation transform;
- use current Viro game-loop/direct transform mechanisms;
- pool trail geometry;
- pool particles;
- reuse materials;
- minimize allocations;
- avoid creating/destroying React nodes every frame.

### Three.js

- reuse BufferGeometry;
- prefer typed arrays;
- pool particles;
- avoid per-frame garbage;
- batch updates where sensible.

### Rive

Update bound values only when semantic values change.

Do not resend identical score/name/readiness values every frame.

## Automated collision test matrix

At minimum, test:

1. arena edge collision;
2. own trail collision;
3. opponent trail collision;
4. perpendicular T-bone;
5. same-cell head-on;
6. head swap;
7. both players hit separate walls same tick;
8. boost tunneling attempt;
9. rapid double turn;
10. illegal reverse command;
11. exact trail endpoint collision;
12. collision immediately after turn;
13. spawn safety;
14. stale input;
15. duplicate sequence;
16. out-of-order input;
17. reconnect;
18. desync repair;
19. round reset;
20. match reset.

The same deterministic input log must produce the same gameplay result in core tests, Three.js and Viro.

## Real two-device QA

Do not mark co-location complete using mocks alone.

### Two phones

Validate:

- create room;
- enter code;
- localize same table;
- same spawn positions;
- same walls;
- same collision;
- same scoreboard;
- same replay.

### Two Quest headsets

Validate:

- host room;
- spatial frame creation;
- guest join;
- guest localization;
- same physical board;
- full round;
- multiple rounds;
- disconnect/rejoin.

### Vision pair

If hardware/runtime support is available, validate shared-space alignment and convergence.

## Latency and race-condition tests

Simulate:

- 30 ms;
- 75 ms;
- 125 ms;
- 200 ms;
- jitter;
- packet reordering;
- brief disconnect.

Also test:

- both players turn same tick;
- both boost same tick;
- both collide same tick;
- player disconnects on collision tick;
- round ends while late input arrives;
- guest reconnects during countdown;
- host requests rematch while guest is not Ready.

Never award duplicate points.

## Diagnostics

Development diagnostics should expose:

- simulation tick;
- host/client role;
- peer IDs;
- room ID/code;
- shared-frame state;
- localization state;
- latency/ping;
- latest input sequence;
- authoritative tick;
- prediction delta;
- trail segment count;
- gameplay-state hash;
- desync count;
- FPS.

Hide this in production unless diagnostics are enabled.

## Security / trust boundary

The guest may request legal control inputs.

The guest may **not** directly submit:

- "I won";
- arbitrary score;
- "opponent died";
- arbitrary authoritative trail/collision state.

Host validates gameplay commands.

Persistent leaderboard submissions must also be validated by the backend if implemented.

## Implementation order

Complete in this order:

1. audit the current Light Cycle model and starter code;
2. create `lightcycle-core`;
3. implement deterministic movement and trail topology;
4. implement collision plus automated tests;
5. connect Three.js renderer;
6. connect Viro renderer;
7. finish wheel/lean/trail model hierarchy;
8. finish crash/derez pipeline;
9. create Rive scoreboard View Model and state machine;
10. finish single-device Classic Grid Duel against AI;
11. implement Viro host co-location;
12. implement six-character guest join flow;
13. implement host-authoritative two-player synchronization;
14. implement prediction/reconciliation/desync repair;
15. test on two real devices;
16. performance profile;
17. polish audio/effects/Rive transitions;
18. only then expand secondary modes and the separate 37-cycle race.

Do not skip deterministic core testing and jump straight to multiplayer visuals.

## Required implementation report

When the feature is implemented, report:

1. architecture summary;
2. exact files created/changed;
3. package versions;
4. GLB hierarchy;
5. core simulation design;
6. collision rules;
7. Viro co-location implementation;
8. host/join flow;
9. platform support matrix;
10. Rive View Model schema;
11. Three.js renderer implementation;
12. Viro renderer implementation;
13. network authority model;
14. automated test results;
15. real two-device test results;
16. performance results;
17. known limitations;
18. anything genuinely remaining.

Do not call scaffolding "complete."

## Tabletop definition of done

The tabletop duel is done only when:

- Light Cycle wheels move correctly;
- bikes lean correctly;
- bikes create persistent lethal walls;
- own trail can destroy the player;
- opponent trail can destroy the player;
- arena edge can destroy the player;
- boost cannot tunnel through a wall;
- derez/destruction works;
- Viro and Three.js use the same gameplay core;
- effects exist in both renderers;
- each player enters a name first;
- Player 1 can create a shared table;
- Player 1 receives a six-character room code;
- Player 2 can enter their own name;
- Player 2 can join using that code;
- supported Viro devices spatially align the board;
- both users see the board in the same real-world position;
- both can Ready;
- countdown/start is synchronized;
- host is authoritative;
- score remains synchronized;
- Rive displays both names;
- Rive displays both scores;
- Rive displays readiness/match state;
- Rive displays derez and winner states;
- session leaderboard works;
- disconnect/reconnect has defined behavior;
- deterministic tests pass;
- real two-device testing passes.

### Canonical two-player acceptance scenario

Player 1:

    enters "Michael"
    creates tabletop
    places arena
    receives join code
    waits

Player 2:

    enters "Alex"
    chooses Join
    enters the code
    localizes
    sees the same arena on the same physical table

Both Rive panels show:

    MICHAEL        ALEX
    READY          READY

Then:

    3
    2
    1
    GRID!

Both cycles start on the same authoritative tick.

Michael creates a blue wall.

Alex creates an orange wall.

Alex turns too late and intersects Michael's trail.

The host-authoritative deterministic simulation resolves:

    ALEX DEREZZED
    MICHAEL +1

Alex's Light Cycle destroys/derezzes at the same tabletop location on both devices.

Both Rive scoreboards update to:

    MICHAEL 1
    ALEX    0

The Grid resets and the next round starts in sync.

That exact scenario is the minimum bar for calling the two-player tabletop experience complete.
