import type { Rng } from '../util/Random.ts';

/**
 * Roguelite perk modifiers — read by gameplay systems across milestones.
 *
 * Integration points:
 *  - M3 Treasury reads `goldTickMultiplier`.
 *  - M4/M5 shop & hiring read `potionPriceMultiplier`, `heroStartLevel`,
 *    `xpMultiplier`, `freeHirePeriod`, `firstSmithUpgradeDiscount`, `potionCarryBonus`.
 *  - M6 combat reads `warriorAdjacencyDamageReduction`, `archerLowHpDamageBonus`,
 *    `onKillAttackSpeedBuff`, `nestDamageMultiplier`, `onNestDestroyHealPercent`.
 *  - M8 nest-destroy event triggers `PerkManager.offer()` / `choose()`.
 *
 * All fields are present (no optional chaining in hot paths); defaults are
 * the identity values for each effect.
 */
export interface PerkMods {
  /** Royal Tax: multiplier applied to the kingdom gold tick. Default 1. */
  goldTickMultiplier: number;
  /** Smith Subsidy: fractional discount on the FIRST smith upgrade of each hero. 0..1, default 0. */
  firstSmithUpgradeDiscount: number;
  /** Merchant Guild: multiplier on potion purchase price. Default 1 (0.80 with perk). */
  potionPriceMultiplier: number;
  /** Veterans: level new heroes start at. Default 1. */
  heroStartLevel: number;
  /** Training Grounds: XP gain multiplier. Default 1 (1.25 with perk). */
  xpMultiplier: number;
  /** Fast Muster: every Nth hire is free. 0 = disabled, 3 = every 3rd hire free. */
  freeHirePeriod: number;
  /** Shield Wall: fractional damage reduction when warrior is adjacent to another warrior. 0..1. */
  warriorAdjacencyDamageReduction: number;
  /** Deadeye: fractional bonus damage archers deal to targets below 50% HP. 0..1. */
  archerLowHpDamageBonus: number;
  /** Battle Rhythm: on-kill attack-speed buff (null = disabled). */
  onKillAttackSpeedBuff: { percent: number; duration: number } | null;
  /** Quartermaster: extra potion carry capacity. Default 0. */
  potionCarryBonus: number;
  /** Siege Training: multiplier on damage dealt to nests. Default 1 (1.35 with perk). */
  nestDamageMultiplier: number;
  /** Triumph: fractional heal applied to all living heroes on nest destroyed. 0..1. */
  onNestDestroyHealPercent: number;
}

/** Fresh PerkMods with identity-default values. */
export function defaultPerkMods(): PerkMods {
  return {
    goldTickMultiplier: 1,
    firstSmithUpgradeDiscount: 0,
    potionPriceMultiplier: 1,
    heroStartLevel: 1,
    xpMultiplier: 1,
    freeHirePeriod: 0,
    warriorAdjacencyDamageReduction: 0,
    archerLowHpDamageBonus: 0,
    onKillAttackSpeedBuff: null,
    potionCarryBonus: 0,
    nestDamageMultiplier: 1,
    onNestDestroyHealPercent: 0,
  };
}

export interface PerkDef {
  /** Stable kebab-case identifier. */
  id: string;
  title: string;
  description: string;
  apply: (mods: PerkMods) => void;
}

/**
 * Controller for the roguelite perk choice flow.
 *
 * Lifecycle (per PRD §16):
 *  - On nest destroyed (except last): UI calls `offer(rng)` → shows picker →
 *    calls `choose(id)` with the player's selection.
 *  - Up to `maxPerks` (4) can be picked per run. No duplicates.
 */
export class PerkManager {
  readonly maxPerks = 4;
  readonly mods: PerkMods;
  readonly chosen: PerkDef[] = [];
  readonly available: PerkDef[];

  constructor(pool: readonly PerkDef[]) {
    this.mods = defaultPerkMods();
    this.available = [...pool];
  }

  /**
   * Pick 3 distinct perks at random from `available`. Does NOT remove them;
   * removal happens in `choose()` so the player sees the selection first.
   * Returns fewer than 3 only if the pool is smaller (shouldn't happen in V1).
   */
  offer(rng: Rng): PerkDef[] {
    const desired = Math.min(3, this.available.length);
    const pool = [...this.available];
    const out: PerkDef[] = [];
    for (let i = 0; i < desired; i++) {
      const idx = rng.int(0, pool.length);
      out.push(pool[idx]!);
      pool.splice(idx, 1);
    }
    return out;
  }

  /**
   * Finalize a player's choice: move from `available` to `chosen` and apply effect.
   * Returns the chosen PerkDef, or null if the id was not offerable
   * (already chosen, unknown, or cap reached).
   */
  choose(id: string): PerkDef | null {
    if (this.chosen.length >= this.maxPerks) return null;
    const idx = this.available.findIndex((p) => p.id === id);
    if (idx < 0) return null;
    const perk = this.available[idx]!;
    this.available.splice(idx, 1);
    this.chosen.push(perk);
    perk.apply(this.mods);
    return perk;
  }

  /** Whether a fresh offer can be made (cap not reached & enough distinct options). */
  canOffer(): boolean {
    return this.chosen.length < this.maxPerks && this.available.length >= 3;
  }
}
