/**
 * PauseController — central on/off switch for the simulation loop.
 *
 * When paused, Game.ts must skip clock.tick (no fixed-step updates), but still
 * render and still call input.update(frameDt) so the player can pan the camera
 * while paused. We own a tiny DOM chip (#hud-pause) that shows only when paused.
 */
export class PauseController {
  private paused = false;
  private chip: HTMLElement | null;

  private readonly onKeyDown: (e: KeyboardEvent) => void;

  constructor() {
    this.chip = document.getElementById('hud-pause');
    this.syncChip();

    this.onKeyDown = (e: KeyboardEvent) => {
      // Space toggles pause. Avoid firing when the user is typing in an input.
      if (e.code !== 'Space') return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      e.preventDefault();
      this.toggle();
    };
    window.addEventListener('keydown', this.onKeyDown);
  }

  isPaused(): boolean {
    return this.paused;
  }

  setPaused(b: boolean): void {
    if (this.paused === b) return;
    this.paused = b;
    this.syncChip();
  }

  toggle(): void {
    this.setPaused(!this.paused);
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
  }

  private syncChip(): void {
    if (!this.chip) return;
    this.chip.style.display = this.paused ? 'inline-flex' : 'none';
  }
}
