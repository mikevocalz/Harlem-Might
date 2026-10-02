import * as THREE from 'three/webgpu';
import { tgpu, type TgpuRoot } from 'typegpu';
import {
  disposeLightCycleWebGPURenderer,
  makeLightCycleWebGPURenderer,
} from './lightcycle/three/makeWebGPURenderer';

export type MightsHeroGPUContext = GPUCanvasContext & {
  present?: () => void;
};

export class MightsSightlineHeroRenderer {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGPURenderer;
  readonly typegpu: TgpuRoot;

  private readonly context: MightsHeroGPUContext;
  private readonly product = new THREE.Group();
  private readonly route = new THREE.Group();
  private disposed = false;

  constructor(options: {
    context: MightsHeroGPUContext;
    device: GPUDevice;
    width: number;
    height: number;
  }) {
    this.context = options.context;
    this.typegpu = tgpu.initFromDevice({ device: options.device });

    this.camera = new THREE.PerspectiveCamera(
      44,
      options.width / Math.max(1, options.height),
      0.01,
      50,
    );
    this.camera.position.set(0, 0.2, 3.3);
    this.camera.lookAt(0, 0.05, 0);

    this.renderer = makeLightCycleWebGPURenderer({
      context: options.context,
      device: options.device,
      antialias: true,
    });
    this.renderer.setSize(options.width, options.height, false);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.setClearColor('#EEF0EC', 0);

    this.scene.add(new THREE.HemisphereLight('#ffffff', '#8ca098', 2.2));

    const key = new THREE.DirectionalLight('#ffffff', 5);
    key.position.set(3, 4, 4);
    this.scene.add(key);

    const rim = new THREE.DirectionalLight('#5fd1e1', 3.2);
    rim.position.set(-3, 1.8, -2);
    this.scene.add(rim);

    this.buildProduct();
    this.buildRoute();
    this.scene.add(this.product, this.route);
  }

  async init() {
    await this.renderer.init();
  }

  resize(width: number, height: number) {
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  private buildProduct() {
    const metal = new THREE.MeshStandardMaterial({
      color: '#d8ddd9',
      metalness: 0.86,
      roughness: 0.2,
    });
    const dark = new THREE.MeshStandardMaterial({
      color: '#29322e',
      metalness: 0.65,
      roughness: 0.26,
    });
    const glass = new THREE.MeshPhysicalMaterial({
      color: '#bde6eb',
      transmission: 0.52,
      transparent: true,
      opacity: 0.62,
      roughness: 0.09,
      thickness: 0.025,
    });
    const accent = new THREE.MeshStandardMaterial({
      color: '#1F4FE0',
      emissive: new THREE.Color('#1F4FE0'),
      emissiveIntensity: 1.7,
      metalness: 0.35,
      roughness: 0.2,
    });

    const glasses = new THREE.Group();
    glasses.position.set(-0.22, 0.18, 0);
    glasses.rotation.set(-0.08, -0.17, 0.02);

    for (const x of [-0.5, 0.5]) {
      const lens = new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 0.44, 0.045),
        glass,
      );
      lens.position.x = x;
      glasses.add(lens);

      const brow = new THREE.Mesh(
        new THREE.BoxGeometry(0.88, 0.052, 0.07),
        metal,
      );
      brow.position.set(x, 0.25, 0.01);
      glasses.add(brow);
    }

    const bridge = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.045, 0.06),
      metal,
    );
    bridge.position.y = 0.12;
    glasses.add(bridge);

    for (const side of [-1, 1]) {
      const temple = new THREE.Mesh(
        new THREE.BoxGeometry(0.72, 0.055, 0.065),
        dark,
      );
      temple.position.set(side * 0.9, 0.11, -0.23);
      temple.rotation.y = side * 0.47;
      glasses.add(temple);
    }

    const sensor = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.045, 0.025, 24),
      accent,
    );
    sensor.rotation.x = Math.PI / 2;
    sensor.position.set(0.66, 0.26, 0.065);
    glasses.add(sensor);

    const puck = new THREE.Group();
    puck.position.set(0.8, -0.56, 0.12);
    puck.rotation.x = -0.13;

    const puckBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.35, 0.11, 64),
      metal,
    );
    puckBody.rotation.x = Math.PI / 2;
    puck.add(puckBody);

    const puckCore = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.22, 0.116, 64),
      dark,
    );
    puckCore.rotation.x = Math.PI / 2;
    puck.add(puckCore);

    const pulse = new THREE.Mesh(
      new THREE.TorusGeometry(0.16, 0.018, 16, 64),
      accent,
    );
    pulse.position.z = 0.064;
    puck.add(pulse);

    this.product.add(glasses, puck);
  }

  private buildRoute() {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-1.6, -0.9, -0.45),
      new THREE.Vector3(-0.84, -0.72, -0.1),
      new THREE.Vector3(-0.15, -0.82, 0.2),
      new THREE.Vector3(0.62, -0.71, -0.02),
      new THREE.Vector3(1.5, -0.84, -0.34),
    ]);

    this.route.add(
      new THREE.Mesh(
        new THREE.TubeGeometry(curve, 96, 0.018, 10, false),
        new THREE.MeshBasicMaterial({
          color: '#0E8FA3',
          transparent: true,
          opacity: 0.75,
        }),
      ),
    );

    for (let index = 0; index < 5; index += 1) {
      const marker = new THREE.Mesh(
        new THREE.SphereGeometry(0.045, 20, 20),
        new THREE.MeshBasicMaterial({
          color: index === 3 ? '#C8102E' : '#1F4FE0',
        }),
      );
      marker.position.copy(curve.getPoint(index / 4));
      this.route.add(marker);
    }
  }

  render(now: number) {
    if (this.disposed) return;
    const t = now * 0.001;
    this.product.rotation.y = Math.sin(t * 0.42) * 0.085;
    this.product.position.y = Math.sin(t * 0.7) * 0.025;
    this.route.position.z = Math.sin(t * 0.38) * 0.018;
    this.renderer.render(this.scene, this.camera);
    this.context.present?.();
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;

    this.scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.geometry.dispose();
      const materials = Array.isArray(object.material)
        ? object.material
        : [object.material];
      materials.forEach((material) => material.dispose());
    });

    this.typegpu.destroy();
    disposeLightCycleWebGPURenderer(this.renderer);
  }
}
