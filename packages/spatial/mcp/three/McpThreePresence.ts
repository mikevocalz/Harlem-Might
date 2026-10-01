import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type {
  LightCycleMatchState,
  LightCyclePlayerId,
} from '../../lightcycle/tabletopCore';
import { deriveMcpPresentation } from '../mcpBrain';
import { deriveMcpVoiceCue } from '../mcpVoice';

const MCP_RED = '#ff2b1c';
const MCP_WHITE = '#f5f2eb';
const MCP_BLACK = '#050609';

function disposeMaterial(material: THREE.Material | THREE.Material[]) {
  const materials = Array.isArray(material) ? material : [material];
  materials.forEach((item) => item.dispose());
}

function makeSpine(
  material: THREE.Material,
  x: number,
  height: number,
  z = -0.055,
) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.012, height, 0.012),
    material,
  );
  mesh.position.set(x, -0.01 + height * 0.05, z);
  return mesh;
}

/**
 * Renderer-side MCP presence.
 *
 * GNM is used as an offline head generator. Runtime never loads Python, JAX,
 * PyTorch, TensorFlow, or GNM model weights; it consumes a normal GLB and adds
 * the futuristic control shell around it.
 */
export class McpThreePresence {
  readonly root = new THREE.Group();

  private readonly headMount = new THREE.Group();
  private readonly fallbackHead = new THREE.Group();
  private readonly redMaterial = new THREE.MeshStandardMaterial({
    color: MCP_RED,
    emissive: new THREE.Color(MCP_RED),
    emissiveIntensity: 2.2,
    metalness: 0.68,
    roughness: 0.16,
  });
  private readonly chromeMaterial = new THREE.MeshStandardMaterial({
    color: MCP_BLACK,
    emissive: new THREE.Color('#130201'),
    emissiveIntensity: 0.25,
    metalness: 0.96,
    roughness: 0.13,
  });
  private readonly whiteMaterial = new THREE.MeshStandardMaterial({
    color: MCP_WHITE,
    emissive: new THREE.Color('#5a1b14'),
    emissiveIntensity: 0.35,
    metalness: 0.42,
    roughness: 0.22,
  });
  private readonly haloA: THREE.Mesh<
    THREE.TorusGeometry,
    THREE.MeshStandardMaterial
  >;
  private readonly haloB: THREE.Mesh<
    THREE.TorusGeometry,
    THREE.MeshStandardMaterial
  >;
  private loadedHead: THREE.Object3D | null = null;
  private loadedInternal: THREE.Object3D | null = null;
  private currentEventKey = '';

  constructor() {
    this.root.name = 'MCP_ROOT';
    this.root.position.set(0, 0.43, -0.32);

    this.headMount.name = 'MCP_HEAD_MOUNT';
    this.root.add(this.headMount);

    const skull = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.112, 4),
      this.chromeMaterial,
    );
    skull.scale.set(0.78, 1.18, 0.82);
    skull.position.y = 0.005;
    skull.name = 'MCP_FALLBACK_SKULL';
    this.fallbackHead.add(skull);

    const jaw = new THREE.Mesh(
      new THREE.BoxGeometry(0.105, 0.052, 0.09),
      this.chromeMaterial,
    );
    jaw.position.set(0, -0.095, 0.014);
    jaw.name = 'MCP_FALLBACK_JAW';
    jaw.rotation.x = -0.08;
    this.fallbackHead.add(jaw);

    for (const x of [-0.038, 0.038]) {
      const eye = new THREE.Mesh(
        new THREE.BoxGeometry(0.044, 0.011, 0.012),
        this.redMaterial,
      );
      eye.position.set(x, 0.028, 0.093);
      eye.rotation.z = x < 0 ? -0.08 : 0.08;
      this.fallbackHead.add(eye);
    }

    const brow = new THREE.Mesh(
      new THREE.BoxGeometry(0.13, 0.012, 0.012),
      this.whiteMaterial,
    );
    brow.position.set(0, 0.057, 0.087);
    this.fallbackHead.add(brow);

    this.headMount.add(this.fallbackHead);

    this.haloA = new THREE.Mesh(
      new THREE.TorusGeometry(0.168, 0.0045, 10, 96),
      this.redMaterial,
    );
    this.haloA.position.z = -0.06;
    this.root.add(this.haloA);

    this.haloB = new THREE.Mesh(
      new THREE.TorusGeometry(0.205, 0.0025, 8, 96),
      this.whiteMaterial,
    );
    this.haloB.position.z = -0.075;
    this.root.add(this.haloB);

    for (const [x, height] of [
      [-0.24, 0.34],
      [-0.205, 0.26],
      [-0.17, 0.2],
      [0.17, 0.2],
      [0.205, 0.26],
      [0.24, 0.34],
    ] as const) {
      this.root.add(makeSpine(this.chromeMaterial, x, height));
    }

    const centerSpine = makeSpine(this.redMaterial, 0, 0.38, -0.08);
    centerSpine.position.y = 0.08;
    this.root.add(centerSpine);

    for (const y of [-0.16, -0.205, -0.245]) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(
          0.105 + Math.abs(y + 0.16) * 0.55,
          0.003,
          8,
          64,
        ),
        this.redMaterial,
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = y;
      this.root.add(ring);
    }

    const core = new THREE.Mesh(
      new THREE.ConeGeometry(0.085, 0.19, 12),
      this.chromeMaterial,
    );
    core.position.y = -0.32;
    core.rotation.x = Math.PI;
    this.root.add(core);

    const coreLine = new THREE.Mesh(
      new THREE.BoxGeometry(0.01, 0.17, 0.012),
      this.redMaterial,
    );
    coreLine.position.set(0, -0.31, 0.055);
    this.root.add(coreLine);
  }

  async init(assetUri?: string) {
    if (!assetUri) return;

    try {
      const gltf = await new GLTFLoader().loadAsync(assetUri);
      const model = gltf.scene;
      model.name = 'MCP_GNM_HEAD';

      const bounds = new THREE.Box3().setFromObject(model);
      const size = new THREE.Vector3();
      const center = new THREE.Vector3();
      bounds.getSize(size);
      bounds.getCenter(center);
      const sourceHeight = Math.max(0.0001, size.y);
      const scale = 0.255 / sourceHeight;

      model.scale.setScalar(scale);
      model.position.set(
        -center.x * scale,
        -center.y * scale,
        -center.z * scale,
      );

      model.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        const normalizedName = object.name.toLowerCase();
        if (normalizedName.includes('eye_interior')) {
          object.material = this.redMaterial;
        } else if (normalizedName.includes('internal_structure')) {
          this.loadedInternal = object;
        } else if (
          normalizedName.includes('skin') ||
          normalizedName.includes('head')
        ) {
          object.material = this.chromeMaterial;
        }
      });

      this.loadedHead = model;
      this.headMount.add(model);
      this.fallbackHead.visible = false;
    } catch {
      // Keep the procedural MCP online if the hosted GLB is unavailable.
      this.loadedHead = null;
    this.loadedInternal = null;
      this.fallbackHead.visible = true;
    }
  }

  update(
    state: LightCycleMatchState,
    now: number,
    localPlayerId: LightCyclePlayerId = 'p1',
  ) {
    const presentation = deriveMcpPresentation(state, localPlayerId);
    const voiceCue = deriveMcpVoiceCue(state, localPlayerId);
    const seconds = now / 1000;
    const pulse =
      0.76 +
      Math.sin(seconds * (2.4 + presentation.haloSpeed * 1.4)) *
        0.18 *
        presentation.pulse;

    this.redMaterial.emissiveIntensity =
      presentation.eyeIntensity * Math.max(0.72, pulse);
    this.whiteMaterial.emissiveIntensity =
      0.22 + presentation.threat * 0.9;

    const voicePulse = voiceCue
      ? 0.5 +
        0.3 * Math.sin(seconds * 10.4) +
        0.2 * Math.sin(seconds * 17.7 + 0.8)
      : 0;
    const expression = voiceCue?.expression ?? 'neutral';
    const expressionTilt = {
      neutral: [0, 0, 0],
      amused: [-0.01, 0.035, 0.025],
      threat: [-0.025, 0, 0],
      shock: [-0.065, 0, 0],
      triumph: [0.01, -0.04, -0.015],
      final: [0.025, 0, 0],
    }[expression] as [number, number, number];

    this.haloA.rotation.z =
      seconds * 0.42 * presentation.haloSpeed + voicePulse * 0.025;
    this.haloB.rotation.z =
      -seconds * 0.24 * presentation.haloSpeed - voicePulse * 0.018;
    this.headMount.position.y =
      Math.sin(seconds * 1.35) * 0.008 + Math.max(0, voicePulse) * 0.0018;
    this.headMount.rotation.set(
      expressionTilt[0] + (voiceCue ? Math.sin(seconds * 3.1) * 0.007 : 0),
      expressionTilt[1],
      expressionTilt[2],
    );

    const fallbackJaw = this.fallbackHead.getObjectByName('MCP_FALLBACK_JAW');
    if (fallbackJaw) {
      fallbackJaw.position.y = -0.095 - Math.max(0, voicePulse) * 0.008;
    }
    if (this.loadedInternal) {
      this.loadedInternal.position.y = -Math.max(0, voicePulse) * 0.0018;
    }

    if (voiceCue) {
      this.redMaterial.emissiveIntensity *= 1 + Math.max(0, voicePulse) * 0.22;
    }

    if (this.currentEventKey !== presentation.eventKey) {
      this.currentEventKey = presentation.eventKey;
      const scale = presentation.mood === 'derez' ? 1.085 : 1;
      this.root.scale.setScalar(scale);
    } else {
      const target = 1 + (pulse - 0.76) * 0.035;
      this.root.scale.setScalar(
        THREE.MathUtils.lerp(this.root.scale.x, target, 0.08),
      );
    }
  }

  dispose() {
    this.root.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.geometry.dispose();
      if (
        object.material !== this.redMaterial &&
        object.material !== this.chromeMaterial &&
        object.material !== this.whiteMaterial
      ) {
        disposeMaterial(object.material);
      }
    });

    this.redMaterial.dispose();
    this.chromeMaterial.dispose();
    this.whiteMaterial.dispose();
    this.root.clear();
    this.loadedHead = null;
  }
}
