import * as THREE from 'three';

/**
 * HitFlash — subtle emissive pulse on any Object3D when struck.
 *
 * Bumps emissive toward a warm amber (~#ffd080) with a triangle envelope and
 * restores. Unlike albedo-swap (old impl), this does NOT whiteout the silhouette
 * or tint neighbouring meshes hidden in the same Group — emissive is additive.
 *
 * Call `update(dt)` once per render frame.
 */

interface MaterialWithEmissive extends THREE.Material {
  emissive: THREE.Color;
  emissiveIntensity?: number;
}

interface FlashEntry {
  material: MaterialWithEmissive;
  originalEmissive: THREE.Color;
  originalIntensity: number;
  supportsIntensity: boolean;
}

interface ActiveFlash {
  durationMs: number;
  elapsedMs: number;
  entries: FlashEntry[];
}

const FLASH_COLOR = new THREE.Color(0xffd080);
const FLASH_COLOR_STRENGTH = 0.8;
const FLASH_INTENSITY_BOOST = 0.6;

function hasEmissive(material: THREE.Material): material is MaterialWithEmissive {
  const m = material as MaterialWithEmissive;
  return m.emissive instanceof THREE.Color;
}

export class HitFlash {
  private readonly active = new Map<THREE.Object3D, ActiveFlash>();

  flash(obj: THREE.Object3D, durationMs = 100): void {
    const existing = this.active.get(obj);
    if (existing) {
      existing.durationMs = durationMs;
      existing.elapsedMs = 0;
      return;
    }

    const entries: FlashEntry[] = [];
    obj.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mat = mesh.material;
      const collect = (m: THREE.Material): void => {
        if (!hasEmissive(m)) return;
        const supportsIntensity = m.emissiveIntensity !== undefined;
        entries.push({
          material: m,
          originalEmissive: m.emissive.clone(),
          originalIntensity: supportsIntensity ? (m.emissiveIntensity ?? 1) : 1,
          supportsIntensity,
        });
      };
      if (Array.isArray(mat)) mat.forEach(collect);
      else if (mat) collect(mat);
    });

    if (entries.length === 0) return;
    this.active.set(obj, { durationMs, elapsedMs: 0, entries });
  }

  update(dt: number): void {
    if (this.active.size === 0) return;
    const dtMs = dt * 1000;
    const done: THREE.Object3D[] = [];
    for (const [obj, flash] of this.active) {
      flash.elapsedMs += dtMs;
      const t = Math.min(1, flash.elapsedMs / Math.max(1, flash.durationMs));
      const k = t < 0.5 ? t * 2 : (1 - t) * 2;
      for (const e of flash.entries) {
        e.material.emissive.copy(e.originalEmissive).lerp(FLASH_COLOR, k * FLASH_COLOR_STRENGTH);
        if (e.supportsIntensity) {
          e.material.emissiveIntensity = e.originalIntensity + k * FLASH_INTENSITY_BOOST;
        }
      }
      if (t >= 1) {
        for (const e of flash.entries) this.restore(e);
        done.push(obj);
      }
    }
    for (const obj of done) this.active.delete(obj);
  }

  clear(): void {
    for (const flash of this.active.values()) {
      for (const e of flash.entries) this.restore(e);
    }
    this.active.clear();
  }

  dispose(): void {
    this.clear();
  }

  private restore(e: FlashEntry): void {
    e.material.emissive.copy(e.originalEmissive);
    if (e.supportsIntensity) e.material.emissiveIntensity = e.originalIntensity;
  }

  get activeCount(): number {
    return this.active.size;
  }
}
