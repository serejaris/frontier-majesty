import * as THREE from 'three';

/**
 * StatusIcons — DOM-overlay chips showing ascii status tags above units
 * ("RET", "MKT", "BSM", "POT", "ATK", …).
 *
 * Same lifecycle as HealthBars: ensure/remove/update, reuse DOM nodes, project
 * world→screen once per render frame. glyph === null hides the chip.
 */
export interface StatusIconState {
  worldX: number;
  worldZ: number;
  glyph: string | null;
}

interface Entry {
  root: HTMLDivElement;
  getState: () => StatusIconState | null;
  currentGlyph: string | null;
  mountedVisible: boolean;
}

const WORLD_Y = 55; // slightly above HP bar anchor

export class StatusIcons {
  private readonly overlay: HTMLElement;
  private readonly entries = new Map<string, Entry>();
  private readonly worldVec = new THREE.Vector3();

  constructor(overlay: HTMLElement) {
    this.overlay = overlay;
  }

  ensure(id: string, getState: () => StatusIconState | null): void {
    const existing = this.entries.get(id);
    if (existing) {
      existing.getState = getState;
      return;
    }
    const root = document.createElement('div');
    root.className = 'status-icon';
    root.style.display = 'none';
    this.overlay.appendChild(root);
    this.entries.set(id, { root, getState, currentGlyph: null, mountedVisible: false });
  }

  remove(id: string): void {
    const entry = this.entries.get(id);
    if (!entry) return;
    entry.root.remove();
    this.entries.delete(id);
  }

  update(camera: THREE.Camera, viewport: { w: number; h: number }): void {
    for (const entry of this.entries.values()) {
      const state = entry.getState();
      if (!state || state.glyph === null || state.glyph === '') {
        if (entry.mountedVisible) {
          entry.root.style.display = 'none';
          entry.mountedVisible = false;
        }
        continue;
      }

      this.worldVec.set(state.worldX, WORLD_Y, state.worldZ);
      this.worldVec.project(camera);

      if (this.worldVec.z < -1 || this.worldVec.z > 1) {
        if (entry.mountedVisible) {
          entry.root.style.display = 'none';
          entry.mountedVisible = false;
        }
        continue;
      }

      if (state.glyph !== entry.currentGlyph) {
        entry.root.textContent = state.glyph;
        entry.currentGlyph = state.glyph;
      }

      const sx = (this.worldVec.x * 0.5 + 0.5) * viewport.w;
      const sy = (-this.worldVec.y * 0.5 + 0.5) * viewport.h;

      if (!entry.mountedVisible) {
        entry.root.style.display = 'inline-block';
        entry.mountedVisible = true;
      }
      // 50% horizontal offset; vertical we leave as-is (label sits above anchor).
      entry.root.style.transform = `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px) translate(-50%, -100%)`;
    }
  }

  dispose(): void {
    for (const entry of this.entries.values()) {
      entry.root.remove();
    }
    this.entries.clear();
  }

  get size(): number {
    return this.entries.size;
  }
}
