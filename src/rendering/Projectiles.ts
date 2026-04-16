import * as THREE from 'three';
import { flatMat } from './Materials.ts';
import { PALETTE } from './Palette.ts';

/**
 * Projectiles — cosmetic arrow visualizer for Archer shots.
 *
 * Damage is resolved instantly by CombatSystem; this system only animates a
 * thin shaft flying from `from` → `to` for readability. No collision, no
 * physics — arrows despawn on arrival (or on timeout).
 */

interface Arrow {
  mesh: THREE.Mesh;
  origin: THREE.Vector3;
  target: THREE.Vector3;
  /** Travel duration in seconds. */
  duration: number;
  elapsed: number;
}

export class Projectiles {
  readonly root = new THREE.Group();
  private readonly arrows: Arrow[] = [];
  private readonly geometry: THREE.CylinderGeometry;
  private readonly material: THREE.Material;

  constructor() {
    this.root.name = 'projectiles';
    // Arrow shape: thin cylinder, ~22u long, slightly tapered.
    this.geometry = new THREE.CylinderGeometry(0.4, 1.4, 22, 6);
    // Rotate so default +Y axis points along +Z (so we can aim by rotating the mesh).
    this.geometry.rotateX(Math.PI / 2);
    this.material = flatMat(PALETTE.obstacleTree);
  }

  spawn(from: { x: number; y?: number; z: number }, to: { x: number; y?: number; z: number }, speed = 1200): void {
    const y = 16; // fly slightly above the ground
    const origin = new THREE.Vector3(from.x, y, from.z);
    const target = new THREE.Vector3(to.x, y, to.z);
    const dist = origin.distanceTo(target);
    if (dist < 1) return; // no arrow for point-blank (degenerate)
    const duration = dist / Math.max(1, speed);
    const mesh = new THREE.Mesh(this.geometry, this.material);
    mesh.position.copy(origin);
    mesh.lookAt(target);
    this.root.add(mesh);
    this.arrows.push({ mesh, origin, target, duration, elapsed: 0 });
  }

  update(dt: number): void {
    if (this.arrows.length === 0) return;
    for (let i = this.arrows.length - 1; i >= 0; i--) {
      const a = this.arrows[i]!;
      a.elapsed += dt;
      const t = a.elapsed / a.duration;
      if (t >= 1) {
        this.root.remove(a.mesh);
        this.arrows.splice(i, 1);
        continue;
      }
      a.mesh.position.lerpVectors(a.origin, a.target, t);
    }
  }

  dispose(): void {
    for (const a of this.arrows) this.root.remove(a.mesh);
    this.arrows.length = 0;
    this.geometry.dispose();
  }

  get size(): number {
    return this.arrows.length;
  }
}
