import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import { tgpu, type TgpuRoot } from 'typegpu';
import { McpThreePresence } from '../../mcp/three/McpThreePresence';
import {
  LIGHTCYCLE_ASSET_NODES,
  LIGHTCYCLE_CLIPS,
  LIGHTCYCLE_METERS_PER_FIXED_UNIT,
  createLightCycleRenderFrame,
  validateLightCycleAssetManifest,
  type LightCycleClipName,
} from '../assetContract';
import {
  getLightCycleActiveTrails,
  type LightCycleDerezEvent,
  type LightCycleMatchState,
  type LightCyclePlayerId,
} from '../tabletopCore';
import { createLightCycleEnergyMaterial } from './energyMaterial';
import {
  disposeLightCycleWebGPURenderer,
  makeLightCycleWebGPURenderer,
} from './makeWebGPURenderer';

type CycleNodes = {
  root: THREE.Group;
  chassis: THREE.Object3D | null;
  frontWheelPivot: THREE.Object3D | null;
  frontWheel: THREE.Object3D | null;
  rearWheelPivot: THREE.Object3D | null;
  rearWheel: THREE.Object3D | null;
  riderRoot: THREE.Object3D | null;
  explosionOrigin: THREE.Object3D | null;
  mixer: THREE.AnimationMixer;
  actions: Map<LightCycleClipName, THREE.AnimationAction>;
};

type TrailMesh = THREE.Mesh<THREE.BoxGeometry, THREE.Material>;

type CrashFragment = {
  mesh: THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>;
  velocity: THREE.Vector3;
  spin: THREE.Vector3;
};

type CrashPresentation = {
  startedAt: number;
  until: number;
  group: THREE.Group;
  fragments: CrashFragment[];
};

const PLAYER_COLOR: Record<LightCyclePlayerId, string> = {
  p1: '#00f3ff',
  p2: '#ff7a00',
};

function findNode(root: THREE.Object3D, name: string) {
  return root.getObjectByName(name) ?? null;
}

function validateCycleAsset(
  root: THREE.Object3D,
  animations: readonly THREE.AnimationClip[],
) {
  const nodeNames: string[] = [];
  root.traverse((object) => {
    if (object.name) nodeNames.push(object.name);
  });

  const validation = validateLightCycleAssetManifest({
    nodeNames,
    clipNames: animations.map((clip) => clip.name),
  });

  if (validation.valid) return;

  const problems: string[] = [];
  if (validation.missingNodes.length > 0) {
    problems.push(
      `missing nodes: ${validation.missingNodes.join(', ')}`,
    );
  }
  if (validation.missingClips.length > 0) {
    problems.push(
      `missing clips: ${validation.missingClips.join(', ')}`,
    );
  }

  throw new Error(
    `Light Cycle GLB does not satisfy the portable Viro/Three asset contract (${problems.join('; ')}).`,
  );
}

function fallbackCycle(color: string) {
  const root = new THREE.Group();
  root.name = LIGHTCYCLE_ASSET_NODES.root;

  const material = new THREE.MeshStandardMaterial({
    color,
    emissive: new THREE.Color(color),
    emissiveIntensity: 2.2,
    metalness: 0.72,
    roughness: 0.23,
  });
  const dark = new THREE.MeshStandardMaterial({
    color: '#020407',
    metalness: 0.8,
    roughness: 0.18,
  });

  const chassis = new THREE.Mesh(
    new THREE.BoxGeometry(0.14, 0.07, 0.26),
    material,
  );
  chassis.name = LIGHTCYCLE_ASSET_NODES.chassis;
  root.add(chassis);

  const rider = new THREE.Mesh(
    new THREE.BoxGeometry(0.07, 0.09, 0.11),
    dark,
  );
  rider.position.y = 0.075;
  rider.name = LIGHTCYCLE_ASSET_NODES.riderRoot;
  root.add(rider);

  for (const [name, z] of [
    [LIGHTCYCLE_ASSET_NODES.frontWheelPivot, -0.105],
    [LIGHTCYCLE_ASSET_NODES.rearWheelPivot, 0.105],
  ] as const) {
    const pivot = new THREE.Group();
    pivot.name = name;
    pivot.position.z = z;
    const wheel = new THREE.Mesh(
      new THREE.TorusGeometry(0.055, 0.012, 12, 28),
      material,
    );
    wheel.rotation.y = Math.PI / 2;
    wheel.name =
      name === LIGHTCYCLE_ASSET_NODES.frontWheelPivot
        ? LIGHTCYCLE_ASSET_NODES.frontWheel
        : LIGHTCYCLE_ASSET_NODES.rearWheel;
    pivot.add(wheel);
    root.add(pivot);
  }

  for (const name of [
    LIGHTCYCLE_ASSET_NODES.trailSocket,
    LIGHTCYCLE_ASSET_NODES.rearFxSocket,
    LIGHTCYCLE_ASSET_NODES.frontImpactSocket,
    LIGHTCYCLE_ASSET_NODES.cameraSocket,
    LIGHTCYCLE_ASSET_NODES.explosionOrigin,
  ]) {
    const socket = new THREE.Group();
    socket.name = name;
    root.add(socket);
  }

  return root;
}

export type LightCycleGPUCanvasContext = GPUCanvasContext & {
  /** react-native-webgpu requires explicit presentation; browser WebGPU does not. */
  present?: () => void;
};

export type ThreeLightCycleRendererOptions = {
  context: LightCycleGPUCanvasContext;
  device: GPUDevice;
  width: number;
  height: number;
  assetUri?: string;
};

/**
 * Real Three/WebGPU implementation of the renderer-neutral Light Cycle contract.
 *
 * - react-native-webgpu owns the GPUCanvasContext + GPUDevice.
 * - Three WebGPURenderer renders the models/arena.
 * - TypeGPU is initialized FROM THE SAME GPUDevice.
 * - @typegpu/three supplies the energy-wall shader nodes.
 * - deterministic gameplay remains entirely in tabletopCore.ts.
 */
export class ThreeLightCycleRenderer {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGPURenderer;
  readonly typegpu: TgpuRoot;

  private readonly context: LightCycleGPUCanvasContext;
  private readonly device: GPUDevice;
  private readonly cycles = new Map<LightCyclePlayerId, CycleNodes>();
  private readonly mcpPresence = new McpThreePresence();
  private readonly trailPool: TrailMesh[] = [];
  private readonly trailMaterials = {
    p1: createLightCycleEnergyMaterial(PLAYER_COLOR.p1),
    p2: createLightCycleEnergyMaterial(PLAYER_COLOR.p2),
  };
  private readonly crashSeen = new Set<string>();
  private readonly crashPresentations = new Map<
    LightCyclePlayerId,
    CrashPresentation
  >();
  private lastFrameAt = 0;
  private disposed = false;

  constructor(options: ThreeLightCycleRendererOptions) {
    this.context = options.context;
    this.device = options.device;
    this.typegpu = tgpu.initFromDevice({ device: this.device });

    this.camera = new THREE.PerspectiveCamera(
      48,
      options.width / Math.max(1, options.height),
      0.01,
      30,
    );
    this.camera.position.set(0, 1.25, 1.45);
    this.camera.lookAt(0, 0, 0);

    this.renderer = makeLightCycleWebGPURenderer({
      context: options.context,
      device: options.device,
      antialias: true,
    });
    this.renderer.setSize(options.width, options.height, false);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;

    this.scene.background = new THREE.Color('#010205');
    this.scene.add(new THREE.HemisphereLight('#7cf8ff', '#020407', 1.25));

    const key = new THREE.DirectionalLight('#ff9b33', 2.4);
    key.position.set(1.5, 2.2, 1.2);
    this.scene.add(key);

    this.createArena();
    this.scene.add(this.mcpPresence.root);
  }

  async init(assetUri?: string, mcpAssetUri?: string) {
    await this.renderer.init();
    await Promise.all([
      this.mountCycles(assetUri),
      this.mcpPresence.init(mcpAssetUri),
    ]);
  }

  resize(width: number, height: number) {
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  private createArena() {
    const floor = new THREE.Mesh(
      new THREE.BoxGeometry(1.24, 0.018, 0.84),
      new THREE.MeshStandardMaterial({
        color: '#020407',
        metalness: 0.72,
        roughness: 0.28,
      }),
    );
    floor.position.y = -0.018;
    this.scene.add(floor);

    const grid = new THREE.GridHelper(1.2, 24, '#00f3ff', '#07313a');
    grid.scale.z = 0.66;
    grid.position.y = -0.006;
    this.scene.add(grid);
  }

  private async mountCycles(assetUri?: string) {
    let source: THREE.Group;
    let animations: THREE.AnimationClip[] = [];

    if (assetUri) {
      const gltf = await new GLTFLoader().loadAsync(assetUri);
      validateCycleAsset(gltf.scene, gltf.animations);
      source = gltf.scene;
      animations = gltf.animations;
    } else {
      source = fallbackCycle(PLAYER_COLOR.p1);
    }

    for (const id of ['p1', 'p2'] as LightCyclePlayerId[]) {
      const root = cloneSkeleton(source) as THREE.Group;
      root.name = `${LIGHTCYCLE_ASSET_NODES.root}-${id}`;

      if (!assetUri && id === 'p2') {
        root.traverse((object) => {
          if (!(object instanceof THREE.Mesh)) return;
          const material = object.material;
          if (
            material instanceof THREE.MeshStandardMaterial &&
            material.color.getHexString() !== '020407'
          ) {
            object.material = material.clone();
            object.material.color.set(PLAYER_COLOR.p2);
            object.material.emissive.set(PLAYER_COLOR.p2);
          }
        });
      }

      const mixer = new THREE.AnimationMixer(root);
      const actions = new Map<LightCycleClipName, THREE.AnimationAction>();
      for (const name of LIGHTCYCLE_CLIPS) {
        const clip = animations.find((candidate) => candidate.name === name);
        if (clip) actions.set(name, mixer.clipAction(clip));
      }

      const nodes: CycleNodes = {
        root,
        chassis: findNode(root, LIGHTCYCLE_ASSET_NODES.chassis),
        frontWheelPivot: findNode(
          root,
          LIGHTCYCLE_ASSET_NODES.frontWheelPivot,
        ),
        frontWheel: findNode(root, LIGHTCYCLE_ASSET_NODES.frontWheel),
        rearWheelPivot: findNode(root, LIGHTCYCLE_ASSET_NODES.rearWheelPivot),
        rearWheel: findNode(root, LIGHTCYCLE_ASSET_NODES.rearWheel),
        riderRoot: findNode(root, LIGHTCYCLE_ASSET_NODES.riderRoot),
        explosionOrigin: findNode(
          root,
          LIGHTCYCLE_ASSET_NODES.explosionOrigin,
        ),
        mixer,
        actions,
      };

      this.cycles.set(id, nodes);
      this.scene.add(root);
      actions.get('idle')?.reset().play();
    }
  }

  private playClip(
    playerId: LightCyclePlayerId,
    clip: LightCycleClipName,
    options: { loop?: boolean; speed?: number; reset?: boolean } = {},
  ) {
    const action = this.cycles.get(playerId)?.actions.get(clip);
    if (!action) return;

    action.enabled = true;
    action.setEffectiveTimeScale(options.speed ?? 1);
    action.setLoop(
      options.loop === false ? THREE.LoopOnce : THREE.LoopRepeat,
      options.loop === false ? 1 : Number.POSITIVE_INFINITY,
    );
    action.clampWhenFinished = options.loop === false;
    if (options.reset !== false) action.reset();
    action.play();
  }

  private handleDerez(event: LightCycleDerezEvent, now: number) {
    const key = `${event.playerId}:${event.tick}:${event.seed}`;
    if (this.crashSeen.has(key)) return;
    this.crashSeen.add(key);

    this.playClip(event.playerId, 'rider_crash', {
      loop: false,
      reset: true,
    });
    this.playClip(event.playerId, 'bike_crumple', {
      loop: false,
      reset: true,
    });

    const cycle = this.cycles.get(event.playerId);
    if (cycle?.chassis) {
      cycle.chassis.rotation.z += event.playerId === 'p1' ? 0.55 : -0.55;
    }

    const group = new THREE.Group();
    group.position.set(
      event.point.x * LIGHTCYCLE_METERS_PER_FIXED_UNIT,
      0.08,
      event.point.z * LIGHTCYCLE_METERS_PER_FIXED_UNIT,
    );

    const fragmentMaterial = new THREE.MeshBasicMaterial({
      color: PLAYER_COLOR[event.playerId],
      transparent: true,
      opacity: 1,
    });
    const fragments: CrashFragment[] = [];

    let seed = event.seed >>> 0;
    const random = () => {
      seed ^= seed << 13;
      seed ^= seed >>> 17;
      seed ^= seed << 5;
      return (seed >>> 0) / 0xffffffff;
    };

    for (let index = 0; index < 10; index += 1) {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(
          0.014 + random() * 0.018,
          0.008 + random() * 0.014,
          0.018 + random() * 0.024,
        ),
        fragmentMaterial.clone(),
      );
      mesh.position.set(
        (random() - 0.5) * 0.08,
        random() * 0.06,
        (random() - 0.5) * 0.08,
      );
      group.add(mesh);
      fragments.push({
        mesh,
        velocity: new THREE.Vector3(
          (random() - 0.5) * 0.45,
          0.18 + random() * 0.4,
          (random() - 0.5) * 0.45,
        ),
        spin: new THREE.Vector3(
          (random() - 0.5) * 8,
          (random() - 0.5) * 8,
          (random() - 0.5) * 8,
        ),
      });
    }

    this.scene.add(group);
    this.crashPresentations.set(event.playerId, {
      startedAt: now,
      until: now + 1050,
      group,
      fragments,
    });
  }

  private updateCrashPresentations(now: number) {
    for (const [playerId, presentation] of this.crashPresentations) {
      const elapsed = Math.max(0, (now - presentation.startedAt) / 1000);
      const fade = Math.max(0, 1 - elapsed / 1.05);

      for (const fragment of presentation.fragments) {
        fragment.mesh.position.x += fragment.velocity.x / 60;
        fragment.mesh.position.y +=
          (fragment.velocity.y - 1.35 * elapsed) / 60;
        fragment.mesh.position.z += fragment.velocity.z / 60;
        fragment.mesh.rotation.x += fragment.spin.x / 60;
        fragment.mesh.rotation.y += fragment.spin.y / 60;
        fragment.mesh.rotation.z += fragment.spin.z / 60;
        fragment.mesh.material.opacity = fade;
      }

      if (now >= presentation.until) {
        this.scene.remove(presentation.group);
        for (const fragment of presentation.fragments) {
          fragment.mesh.geometry.dispose();
          fragment.mesh.material.dispose();
        }
        this.crashPresentations.delete(playerId);
      }
    }
  }

  private acquireTrail(index: number, owner: LightCyclePlayerId) {
    let mesh = this.trailPool[index];
    if (!mesh) {
      mesh = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        this.trailMaterials[owner].material,
      );
      this.trailPool[index] = mesh;
      this.scene.add(mesh);
    }

    mesh.material = this.trailMaterials[owner].material;
    mesh.visible = true;
    return mesh;
  }

  render(state: LightCycleMatchState, now = performance.now()) {
    if (this.disposed) return;
    const dt =
      this.lastFrameAt === 0
        ? 1 / 60
        : Math.min(0.1, Math.max(0, (now - this.lastFrameAt) / 1000));
    this.lastFrameAt = now;

    for (const id of ['p1', 'p2'] as LightCyclePlayerId[]) {
      const frame = createLightCycleRenderFrame(state, id);
      const cycle = this.cycles.get(id);
      if (!cycle) continue;

      const crashPresentation = this.crashPresentations.get(id);
      cycle.root.visible =
        frame.alive ||
        Boolean(frame.derez) ||
        Boolean(crashPresentation && now < crashPresentation.until);
      cycle.root.position.set(...frame.positionMeters);
      cycle.root.rotation.set(
        0,
        THREE.MathUtils.degToRad(frame.yawDegrees),
        THREE.MathUtils.degToRad(-frame.leanDegrees),
      );

      const wheelAngle = THREE.MathUtils.degToRad(frame.wheelAngleDegrees);
      if (cycle.frontWheel) cycle.frontWheel.rotation.x = wheelAngle;
      if (cycle.rearWheel) cycle.rearWheel.rotation.x = wheelAngle;

      cycle.mixer.update(dt);
      if (frame.derez) this.handleDerez(frame.derez, now);
    }

    this.updateCrashPresentations(now);

    let trailIndex = 0;
    const visibleTrails = [
      ...state.trails,
      ...getLightCycleActiveTrails(state),
    ];

    for (const segment of visibleTrails) {
      const x0 = segment.from.x * LIGHTCYCLE_METERS_PER_FIXED_UNIT;
      const z0 = segment.from.z * LIGHTCYCLE_METERS_PER_FIXED_UNIT;
      const x1 = segment.to.x * LIGHTCYCLE_METERS_PER_FIXED_UNIT;
      const z1 = segment.to.z * LIGHTCYCLE_METERS_PER_FIXED_UNIT;
      const dx = Math.abs(x1 - x0);
      const dz = Math.abs(z1 - z0);
      const mesh = this.acquireTrail(trailIndex++, segment.owner);
      mesh.position.set((x0 + x1) / 2, 0.075, (z0 + z1) / 2);
      mesh.scale.set(
        dx >= dz ? Math.max(0.002, dx) : 0.012,
        0.15,
        dz > dx ? Math.max(0.002, dz) : 0.012,
      );
    }

    for (let index = trailIndex; index < this.trailPool.length; index += 1) {
      const mesh = this.trailPool[index];
      if (mesh) mesh.visible = false;
    }

    const boostIntensity = {
      p1:
        state.riders.p1.speedUnitsPerTick / state.config.baseStepUnits,
      p2:
        state.riders.p2.speedUnitsPerTick / state.config.baseStepUnits,
    };
    this.trailMaterials.p1.setIntensity(boostIntensity.p1);
    this.trailMaterials.p2.setIntensity(boostIntensity.p2);
    this.mcpPresence.update(state, now, 'p1');

    this.renderer.render(this.scene, this.camera);
    this.context.present?.();
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;

    for (const cycle of this.cycles.values()) {
      cycle.mixer.stopAllAction();
      cycle.root.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        object.geometry.dispose();
        const materials = Array.isArray(object.material)
          ? object.material
          : [object.material];
        materials.forEach((material) => material.dispose());
      });
    }

    this.trailPool.forEach((mesh) => mesh.geometry.dispose());
    for (const presentation of this.crashPresentations.values()) {
      this.scene.remove(presentation.group);
      for (const fragment of presentation.fragments) {
        fragment.mesh.geometry.dispose();
        fragment.mesh.material.dispose();
      }
    }
    this.crashPresentations.clear();
    this.trailMaterials.p1.material.dispose();
    this.trailMaterials.p2.material.dispose();
    this.mcpPresence.dispose();
    this.typegpu.destroy();
    disposeLightCycleWebGPURenderer(this.renderer);
  }
}
