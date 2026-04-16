import * as THREE from 'three';

/**
 * HealthBars — DOM-overlay manager for world-anchored HP bars.
 *
 * Bars live in #world-overlay (a pointer-events:none, full-viewport div).
 * Each entity registers a `getState` callback; update() projects world→screen
 * once per render frame and hides bars that are offscreen, at full HP, or
 * explicitly invisible. DOM nodes are reused across frames — no churn.
 */
export interface HealthBarState {
  worldX: number;
  worldZ: number;
  hp: number;
  maxHp: number;
  visible: boolean;
}

interface Entry {
  root: HTMLDivElement;
  fill: HTMLDivElement;
  getState: () => HealthBarState | null;
  mountedVisible: boolean;
}

const WORLD_Y = 40; // anchor slightly above ground so bar floats over unit heads
const BAR_WIDTH = 48;
const BAR_HEIGHT = 4;

export class HealthBars {
  private readonly overlay: HTMLElement;
  private readonly entries = new Map<string, Entry>();
  private readonly worldVec = new THREE.Vector3();

  constructor(overlay: HTMLElement) {
    this.overlay = overlay;
  }

  ensure(id: string, getState: () => HealthBarState | null): void {
    const existing = this.entries.get(id);
    if (existing) {
      existing.getState = getState;
      return;
    }
    const root = document.createElement('div');
    root.className = 'hp-bar';
    root.style.display = 'none';
    const fill = document.createElement('div');
    fill.className = 'hp-bar-fill';
    root.appendChild(fill);
    this.overlay.appendChild(root);
    this.entries.set(id, { root, fill, getState, mountedVisible: false });
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
      if (!state || !state.visible || state.hp >= state.maxHp || state.maxHp <= 0) {
        if (entry.mountedVisible) {
          entry.root.style.display = 'none';
          entry.mountedVisible = false;
        }
        continue;
      }

      this.worldVec.set(state.worldX, WORLD_Y, state.worldZ);
      this.worldVec.project(camera);

      // Behind the camera (ortho still flips Z past the far plane) — hide.
      if (this.worldVec.z < -1 || this.worldVec.z > 1) {
        if (entry.mountedVisible) {
          entry.root.style.display = 'none';
          entry.mountedVisible = false;
        }
        continue;
      }

      const sx = (this.worldVec.x * 0.5 + 0.5) * viewport.w;
      const sy = (-this.worldVec.y * 0.5 + 0.5) * viewport.h;

      if (!entry.mountedVisible) {
        entry.root.style.display = 'block';
        entry.mountedVisible = true;
      }
      entry.root.style.transform = `translate(${(sx - BAR_WIDTH * 0.5).toFixed(1)}px, ${(sy - BAR_HEIGHT * 0.5).toFixed(1)}px)`;

      const pct = Math.max(0, Math.min(1, state.hp / state.maxHp));
      entry.fill.style.width = `${(pct * 100).toFixed(1)}%`;
      // red (low) → green (full)
      const hue = Math.round(pct * 120);
      entry.fill.style.background = `linear-gradient(90deg, hsl(${Math.max(0, hue - 20)} 85% 45%), hsl(${hue} 85% 50%))`;
    }
  }

  dispose(): void {
    for (const entry of this.entries.values()) {
      entry.root.remove();
    }
    this.entries.clear();
  }

  /** Exposed for diagnostics/tests. */
  get size(): number {
    return this.entries.size;
  }
}

export { BAR_WIDTH as HP_BAR_WIDTH, BAR_HEIGHT as HP_BAR_HEIGHT };
