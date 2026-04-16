import type { Hero, HeroTarget } from '../entities/Hero.ts';

/**
 * Ability callbacks attached to a Hero by class progression (PRD §13.3 / §13.4).
 *
 * Each callback is optional. CombatSystem invokes the relevant hooks during the
 * attack pipeline (`onBeforeAttack` for damage modifiers, `onAfterAttack` for
 * AOE / volley / on-hit counters), and the AI / hero update loop invokes
 * `onIncomingDamage` (defensive procs) and `onTick` (per-frame upkeep).
 */
export interface AttackContext {
  /** Final damage value about to be applied. May be mutated. */
  damage: number;
  /** Was this hit a critical strike? */
  crit: boolean;
}

export interface IncomingContext {
  /** Final damage about to apply. May be mutated. */
  damage: number;
}

export interface AbilityCallbacks {
  /** Mutate `ctx.damage` / `ctx.crit` before the hit lands on `target`. */
  onBeforeAttack?: (hero: Hero, target: HeroTarget, ctx: AttackContext, simT: number) => void;
  /** Triggered after the primary hit resolves (AOE, second arrow, etc.). */
  onAfterAttack?: (hero: Hero, target: HeroTarget, ctx: AttackContext, simT: number) => void;
  /** Mutate incoming damage (defensive procs like Last Stand). */
  onIncomingDamage?: (hero: Hero, ctx: IncomingContext, simT: number) => void;
  /** Per-frame upkeep — drive cooldowns, expire buffs. */
  onTick?: (hero: Hero, dt: number, simT: number) => void;
}
