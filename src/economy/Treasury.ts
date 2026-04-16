import { ECONOMY } from '../config/Tuning.ts';

/**
 * Kingdom gold treasury. Passive tick income + spend with
 * bool success. Perk multiplier is read defensively since M7
 * (perkMods) may or may not be merged by the time this runs.
 */
export class Treasury {
  private _gold: number;
  private readonly readPerkMult: () => number;

  constructor(
    startingGold: number = ECONOMY.startingGold,
    readPerkMult?: () => number,
  ) {
    this._gold = startingGold;
    this.readPerkMult = readPerkMult ?? (() => 1);
  }

  get gold(): number {
    return this._gold;
  }

  tick(dt: number): void {
    const mult = this.readPerkMult();
    this._gold += ECONOMY.goldTickPerSec * dt * mult;
  }

  spend(amount: number): boolean {
    if (amount < 0) return false;
    if (this._gold < amount) return false;
    this._gold -= amount;
    return true;
  }
}
