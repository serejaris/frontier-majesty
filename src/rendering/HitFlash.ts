import * as THREE from 'three';

/**
 * HitFlash — white "ouch" flash for any Object3D.
 *
 * Walks all descendant Mesh materials, caches each material's original color,
 * lerps the color toward white over a short window, then restores. Calling
 * flash() again on an already-flashing object resets the timer (reentrant-safe).
 *
 * Call update(dt) once per render frame to advance.
 */
interface MaterialWithColor extends THREE.Material {
  color: THREE.Color;
}

interface ActiveFlash {
  durationMs: number;
  elapsedMs: number;
  entries: Array<{ material: MaterialWithColor; originalColor: THREE.Color }>;
}

const WHITE = new THREE.Color(1, 1, 1);

function hasColor(material: THREE.Material): material is MaterialWithColor {
  return 'color' in material && (material as MaterialWithColor).color instanceof THREE.Color;
}

export class HitFlash {
  private readonly active = new Map<THREE.Object3D, ActiveFlash>();

  flash(obj: THREE.Object3D, durationMs = 120): void {
    // If already active: reset timer (keep cached originals — they still point
    // at pre-flash colors, which is what we want to restore to).
    const existing = this.active.get(obj);
    if (existing) {
      existing.durationMs = durationMs;
      existing.elapsedMs = 0;
      return;
    }

    const entries: Array<{ material: MaterialWithColor; originalColor: THREE.Color }> = [];
    obj.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mat = mesh.material;
      if (Array.isArray(mat)) {
        for (const m of mat) {
          if (hasColor(m)) entries.push({ material: m, originalColor: m.color.clone() });
        }
      } else if (mat && hasColor(mat)) {
        entries.push({ material: mat, originalColor: mat.color.clone() });
      }
    });

    if (entries.length === 0) return;

    this.active.set(obj, { durationMs, elapsedMs: 0, entries });
  }

  /** dt in seconds. */
  update(dt: number): void {
    if (this.active.size === 0) return;
    const dtMs = dt * 1000;
    const done: THREE.Object3D[] = [];
    for (const [obj, flash] of this.active) {
      flash.elapsedMs += dtMs;
      const t = Math.min(1, flash.elapsedMs / Math.max(1, flash.durationMs));
      // Triangle curve: ramp up to white at midpoint, back down to original.
      const k = t < 0.5 ? t * 2 : (1 - t) * 2;
      for (const { material, originalColor } of flash.entries) {
        material.color.copy(originalColor).lerp(WHITE, k);
      }
      if (t >= 1) {
        // Restore exactly.
        for (const { material, originalColor } of flash.entries) {
          material.color.copy(originalColor);
        }
        done.push(obj);
      }
    }
    for (const obj of done) this.active.delete(obj);
  }

  /** Force immediate restore on all active flashes (e.g., on dispose). */
  clear(): void {
    for (const flash of this.active.values()) {
      for (const { material, originalColor } of flash.entries) {
        material.color.copy(originalColor);
      }
    }
    this.active.clear();
  }

  dispose(): void {
    this.clear();
  }

  get activeCount(): number {
    return this.active.size;
  }
}
