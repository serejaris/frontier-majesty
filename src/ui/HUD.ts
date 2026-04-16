/**
 * Owns the #hud-gold chip. Single-method class so integration
 * into Game is a one-liner per frame.
 */
export class HUD {
  private readonly goldEl: HTMLElement;
  private lastRendered = Number.NaN;

  constructor(goldEl: HTMLElement) {
    this.goldEl = goldEl;
  }

  update(gold: number): void {
    const rounded = Math.floor(gold);
    if (rounded === this.lastRendered) return;
    this.lastRendered = rounded;
    this.goldEl.textContent = String(rounded);
  }
}
