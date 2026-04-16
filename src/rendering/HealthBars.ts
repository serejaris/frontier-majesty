import * as THREE from 'three';

/**
 * HealthBars — DOM-overlay manager for world-anchored HP bars.
 *
 * Bars live in `#world-overlay` (pointer-events:none, full-viewport).
 * Each entity registers a `getState` callback; `update()` projects world→screen
 * once per render frame and decides whether to show.
 *
 * Visibility rules:
 *   - hidden if not `visible`, hp ≥ maxHp, or maxHp ≤ 0;
 *   - if caller supplies `lastChangeT` and `nowT`, bar also hides once
 *     `nowT − lastChangeT > RECENT_CHANGE_WINDOW_SEC` (default 3s).
 *   - bar projects BELOW the unit (anchor y=5) so it sits at the feet.
 */
export interface HealthBarState {
  worldX: number;
  worldZ: number;
  hp: number;
  maxHp: number;
  visible: boolean;
  /** Optional sim-time (seconds) of last hp change; if present, bar auto-hides after stale. */
  lastChangeT?: number;
  /** Optional current sim-time; if present (paired with lastChangeT), used for stale check. */
  nowT?: number;
}

interface Entry {
  root: HTMLDivElement;
  fill: HTMLDivElement;
  getState: () => HealthBarState | null;
  mountedVisible: boolean;
}

const WORLD_Y = 5; // just above the ground plane — bar floats under the unit
const SCREEN_Y_OFFSET_PX = 18; // drop bar below the projected anchor for readability
const BAR_WIDTH = 48;
const BAR_HEIGHT = 4;
const RECENT_CHANGE_WINDOW_SEC = 3;

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
      const shouldShow = this.shouldShow(state);
      if (!shouldShow || !state) {
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

      const sx = (this.worldVec.x * 0.5 + 0.5) * viewport.w;
      const sy = (-this.worldVec.y * 0.5 + 0.5) * viewport.h + SCREEN_Y_OFFSET_PX;

      if (!entry.mountedVisible) {
        entry.root.style.display = 'block';
        entry.mountedVisible = true;
      }
      entry.root.style.transform = `translate(${(sx - BAR_WIDTH * 0.5).toFixed(1)}px, ${(sy - BAR_HEIGHT * 0.5).toFixed(1)}px)`;

      const pct = Math.max(0, Math.min(1, state.hp / state.maxHp));
      entry.fill.style.width = `${(pct * 100).toFixed(1)}%`;
      const hue = Math.round(pct * 120);
      entry.fill.style.background = `linear-gradient(90deg, hsl(${Math.max(0, hue - 20)} 85% 45%), hsl(${hue} 85% 50%))`;
    }
  }

  private shouldShow(state: HealthBarState | null): boolean {
    if (!state || !state.visible) return false;
    if (state.maxHp <= 0) return false;
    if (state.hp >= state.maxHp) return false;
    if (state.lastChangeT !== undefined && state.nowT !== undefined) {
      if (state.nowT - state.lastChangeT > RECENT_CHANGE_WINDOW_SEC) return false;
    }
    return true;
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

export { BAR_WIDTH as HP_BAR_WIDTH, BAR_HEIGHT as HP_BAR_HEIGHT };
