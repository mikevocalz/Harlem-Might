import * as THREE from 'three/webgpu';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { tgpu, type TgpuRoot } from 'typegpu';
import { createSightlineLensMaterial } from './sightlineMaterial';

export type SightlineGPUCanvasContext = GPUCanvasContext & {
  present?: () => void;
};

export interface SightlineHeroRendererOptions {
  context: SightlineGPUCanvasContext;
  device: GPUDevice;
  width: number;
  height: number;
}

function roundedBox(
  width: number,
  height: number,
  depth: number,
  radius: number,
  material: THREE.Material,
) {
  return new THREE.Mesh(
    new RoundedBoxGeometry(width, height, depth, 5, radius),
    material,
  );
}

export class SightlineHeroRenderer {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGPURenderer;
  readonly typegpu: TgpuRoot;

  private readonly context: SightlineGPUCanvasContext;
  private readonly glasses = new THREE.Group();
  private readonly puck = new THREE.Group();
  private readonly route = new THREE.Group();
  private readonly markers = new THREE.Group();
  private readonly lens = createSightlineLensMaterial('#1F4FE0');
  private targetProgress = 0;
  private progress = 0;
  private disposed = false;

  constructor(options: SightlineHeroRendererOptions) {
    this.context = options.context;
    this.typegpu = tgpu.initFromDevice({ device: options.device });

    this.camera = new THREE.PerspectiveCamera(
      34,
      options.width / Math.max(1, options.height),
      0.01,
      50,
    );
    this.camera.position.set(0, 0.25, 4.25);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGPURenderer({
      antialias: true,
      alpha: true,
      canvas: options.context.canvas,
      context: options.context,
      device: options.device,
    });
    this.renderer.setSize(options.width, options.height, false);
    this.renderer.setPixelRatio(1);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.04;
    this.renderer.setClearColor(0x000000, 0);

    this.scene.add(new THREE.HemisphereLight('#FFFFFF', '#B9C1BC', 2.4));

    const key = new THREE.DirectionalLight('#FFF5E7', 5.5);
    key.position.set(3.2, 4.8, 5.1);
    this.scene.add(key);

    const rim = new THREE.DirectionalLight('#8DDDE7', 3.2);
    rim.position.set(-4.2, 1.8, -2.5);
    this.scene.add(rim);

    this.createGlasses();
    this.createPuck();
    this.createRoute();
    this.createMarkers();

    this.scene.add(this.glasses, this.puck, this.route, this.markers);
  }

  async init() {
    await this.renderer.init();
  }

  resize(width: number, height: number) {
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  setProgress(progress: number) {
    this.targetProgress = Math.min(1, Math.max(0, progress));
  }

  private createGlasses() {
    const metal = new THREE.MeshStandardMaterial({
      color: '#D6D2C8',
      metalness: 0.82,
      roughness: 0.21,
    });
    const graphite = new THREE.MeshStandardMaterial({
      color: '#222925',
      metalness: 0.7,
      roughness: 0.26,
    });
    const bronze = new THREE.MeshStandardMaterial({
      color: '#9A7251',
      metalness: 0.75,
      roughness: 0.24,
    });

    const lensWidth = 1.02;
    const lensHeight = 0.48;
    const lensDepth = 0.035;

    for (const side of [-1, 1] as const) {
      const x = side * 0.58;

      const frame = roundedBox(
        lensWidth + 0.09,
        lensHeight + 0.09,
        0.065,
        0.1,
        metal,
      );
      frame.position.set(x, 0.12, 0);
      this.glasses.add(frame);

      const lens = roundedBox(
        lensWidth,
        lensHeight,
        lensDepth,
        0.085,
        this.lens.material,
      );
      lens.position.set(x, 0.12, 0.043);
      this.glasses.add(lens);

      const temple = roundedBox(0.08, 0.075, 1.44, 0.03, graphite);
      temple.position.set(side * 1.12, 0.1, -0.64);
      temple.rotation.y = side * 0.07;
      this.glasses.add(temple);

      const hinge = roundedBox(0.11, 0.11, 0.18, 0.035, bronze);
      hinge.position.set(side * 1.1, 0.11, -0.05);
      this.glasses.add(hinge);
    }

    const bridge = roundedBox(0.18, 0.07, 0.07, 0.028, metal);
    bridge.position.set(0, 0.13, 0);
    this.glasses.add(bridge);

    const sensorRail = roundedBox(0.62, 0.055, 0.065, 0.024, graphite);
    sensorRail.position.set(0, 0.43, -0.018);
    this.glasses.add(sensorRail);

    for (const x of [-0.21, 0, 0.21]) {
      const sensor = new THREE.Mesh(
        new THREE.CylinderGeometry(0.034, 0.034, 0.025, 24),
        new THREE.MeshStandardMaterial({
          color: x === 0 ? '#0E8FA3' : '#121815',
          metalness: 0.45,
          roughness: 0.18,
          emissive: x === 0 ? new THREE.Color('#5FD1E1') : new THREE.Color('#000000'),
          emissiveIntensity: x === 0 ? 0.9 : 0,
        }),
      );
      sensor.rotation.x = Math.PI / 2;
      sensor.position.set(x, 0.43, 0.025);
      this.glasses.add(sensor);
    }

    this.glasses.rotation.set(-0.06, -0.16, -0.02);
    this.glasses.position.set(0.06, 0.2, 0);
  }

  private createPuck() {
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.31, 0.31, 0.09, 64),
      new THREE.MeshStandardMaterial({
        color: '#D8D4CA',
        metalness: 0.86,
        roughness: 0.2,
      }),
    );
    body.rotation.x = Math.PI / 2;
    this.puck.add(body);

    const face = new THREE.Mesh(
      new THREE.CylinderGeometry(0.255, 0.255, 0.096, 64),
      new THREE.MeshStandardMaterial({
        color: '#222925',
        metalness: 0.68,
        roughness: 0.18,
      }),
    );
    face.rotation.x = Math.PI / 2;
    this.puck.add(face);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.22, 0.012, 14, 64),
      new THREE.MeshBasicMaterial({
        color: '#0E8FA3',
        transparent: true,
        opacity: 0.9,
      }),
    );
    ring.position.z = 0.055;
    this.puck.add(ring);

    this.puck.position.set(1.25, -0.68, 0.28);
    this.puck.rotation.set(0.18, -0.28, 0.14);
  }

  private createRoute() {
    const points = [
      new THREE.Vector3(-1.5, -0.86, 0.1),
      new THREE.Vector3(-0.8, -0.55, 0.32),
      new THREE.Vector3(-0.12, -0.72, 0.52),
      new THREE.Vector3(0.56, -0.45, 0.4),
      new THREE.Vector3(1.38, -0.61, 0.08),
    ];

    const curve = new THREE.CatmullRomCurve3(points);
    const tube = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 96, 0.018, 12, false),
      new THREE.MeshBasicMaterial({
        color: '#1F4FE0',
        transparent: true,
        opacity: 0.86,
      }),
    );
    this.route.add(tube);
  }

  private createMarkers() {
    const positions = [
      [-1.48, -0.84, 0.12],
      [-0.14, -0.69, 0.55],
      [1.36, -0.58, 0.1],
    ] as const;

    positions.forEach(([x, y, z], index) => {
      const group = new THREE.Group();
      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(0.045, 24, 24),
        new THREE.MeshBasicMaterial({
          color: index === 1 ? '#C8102E' : '#0E8FA3',
        }),
      );
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.09, 0.008, 12, 48),
        new THREE.MeshBasicMaterial({
          color: index === 1 ? '#C8102E' : '#0E8FA3',
          transparent: true,
          opacity: 0.62,
        }),
      );
      ring.rotation.x = Math.PI / 2;
      group.add(dot, ring);
      group.position.set(x, y, z);
      this.markers.add(group);
    });
  }

  render(now = performance.now(), reducedMotion = false) {
    if (this.disposed) return;

    const smoothing = reducedMotion ? 1 : 0.075;
    this.progress += (this.targetProgress - this.progress) * smoothing;
    const p = this.progress;

    this.lens.setProgress(p);

    this.glasses.rotation.y = -0.16 + p * 0.46;
    this.glasses.rotation.x = -0.06 + p * 0.08;
    this.glasses.position.y = 0.2 + Math.sin(p * Math.PI) * 0.12;

    this.puck.rotation.z = 0.14 - p * 0.22;
    this.puck.position.x = 1.25 - p * 0.24;
    this.puck.position.y = -0.68 + p * 0.12;

    this.route.position.z = 0.06 + p * 0.16;
    this.route.rotation.z = -0.03 + p * 0.055;

    this.markers.children.forEach((marker, index) => {
      const pulse = reducedMotion
        ? 1
        : 1 + Math.sin(now * 0.0025 + index * 0.9) * 0.06;
      marker.scale.setScalar(pulse);
    });

    this.camera.position.z = 4.25 - p * 0.32;
    this.camera.lookAt(0, -0.02, 0);

    this.renderer.render(this.scene, this.camera);
    this.context.present?.();
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.renderer.setAnimationLoop(null);

    this.scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.geometry.dispose();
      const materials = Array.isArray(object.material)
        ? object.material
        : [object.material];
      materials.forEach((material) => material.dispose());
    });

    this.lens.material.dispose();
    this.typegpu.destroy();
    this.renderer.dispose();
  }
}
