export type FixedStepHandler = (dt: number) => void;

export class Clock {
  private last = performance.now();
  private accumulator = 0;
  private readonly fixedStep: number;
  private readonly maxFrame: number;

  constructor(stepHz = 60, maxFrameSeconds = 0.25) {
    this.fixedStep = 1 / stepHz;
    this.maxFrame = maxFrameSeconds;
  }

  reset(): void {
    this.last = performance.now();
    this.accumulator = 0;
  }

  tick(onFixed: FixedStepHandler): number {
    const now = performance.now();
    const frame = Math.min((now - this.last) / 1000, this.maxFrame);
    this.last = now;
    this.accumulator += frame;
    let steps = 0;
    while (this.accumulator >= this.fixedStep) {
      onFixed(this.fixedStep);
      this.accumulator -= this.fixedStep;
      steps += 1;
      if (steps > 8) {
        this.accumulator = 0;
        break;
      }
    }
    return frame;
  }

  /**
   * Advance wall-clock without running any fixed-step updates (pause path).
   * Returns raw frame dt so render-frame systems (overlay projection, camera
   * panning, hit-flash animation) still get a usable delta.
   */
  tickIdle(): number {
    const now = performance.now();
    const frame = Math.min((now - this.last) / 1000, this.maxFrame);
    this.last = now;
    // Don't touch the accumulator — when the player unpauses, we resume cleanly.
    return frame;
  }

  get alpha(): number {
    return this.accumulator / this.fixedStep;
  }
}
