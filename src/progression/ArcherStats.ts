import { HEROES } from '../config/Tuning.ts';
import type { Hero, HeroTarget } from '../entities/Hero.ts';
import type { AbilityCallbacks, AttackContext } from './Abilities.ts';
import { distance2d } from '../util/Math.ts';
import { createRng } from '../util/Random.ts';

/**
 * Per-level scaling factors for an Archer. PRD §13.4.
 *
 * M5 ships full progression — base stat scaling + ability callbacks installed
 * at the matching level (Focus Shot L3, Skirmisher Step L5, Volley L7, Marksman L8).
 */

export interface ArcherLevelScale {
  /** Multiplier applied to baseHp (>=1). */
  hpMult: number;
  /** Multiplier applied to baseDamage (>=1). */
  damageMult: number;
  /** Multiplier applied to baseAttackRate (>=1). */
  attackRateMult: number;
  /** Multiplier applied to baseRange (>=1). */
  rangeMult: number;
  /** Multiplier applied to baseMoveSpeed (>=1). */
  moveSpeedMult: number;
}

const TABLE: readonly ArcherLevelScale[] = [
  /* L1 */ { hpMult: 1.00, damageMult: 1.00, attackRateMult: 1.00, rangeMult: 1.00, moveSpeedMult: 1.00 },
  /* L2 */ { hpMult: 1.00, damageMult: 1.12, attackRateMult: 1.10, rangeMult: 1.00, moveSpeedMult: 1.00 },
  /* L3 */ { hpMult: 1.00, damageMult: 1.12, attackRateMult: 1.10, rangeMult: 1.00, moveSpeedMult: 1.00 },
  /* L4 */ { hpMult: 1.00, damageMult: 1.12, attackRateMult: 1.10, rangeMult: 1.10, moveSpeedMult: 1.08 },
  /* L5 */ { hpMult: 1.00, damageMult: 1.12, attackRateMult: 1.10, rangeMult: 1.10, moveSpeedMult: 1.08 },
  /* L6 */ { hpMult: 1.00, damageMult: 1.12 * 1.15, attackRateMult: 1.10 * 1.10, rangeMult: 1.10, moveSpeedMult: 1.08 },
  /* L7 */ { hpMult: 1.00, damageMult: 1.12 * 1.15, attackRateMult: 1.10 * 1.10, rangeMult: 1.10, moveSpeedMult: 1.08 },
  /* L8 */ { hpMult: 1.00, damageMult: 1.12 * 1.15 * 1.20, attackRateMult: 1.10 * 1.10, rangeMult: 1.10, moveSpeedMult: 1.08 },
];

export function archerScaleForLevel(level: number): ArcherLevelScale {
  const idx = Math.max(1, Math.min(TABLE.length, level)) - 1;
  return TABLE[idx]!;
}

export interface ArcherStats {
  maxHp: number;
  damage: number;
  attackRate: number;
  moveSpeed: number;
  attackRange: number;
}

/** Derive Archer stats at the given level from the base tuning values. */
export function archerStatsAt(level: number): ArcherStats {
  const s = archerScaleForLevel(level);
  return {
    maxHp: Math.round(HEROES.archer.maxHp * s.hpMult),
    damage: HEROES.archer.damage * s.damageMult,
    attackRate: HEROES.archer.attackRate * s.attackRateMult,
    moveSpeed: HEROES.archer.moveSpeed * s.moveSpeedMult,
    attackRange: HEROES.archer.attackRange * s.rangeMult,
  };
}

// ---------------- Archer abilities (PRD §13.4) ----------------

const ARCHER_ABILITY_KEY = '__archerAbilitiesInstalled';

/** Install ability callbacks on an archer; idempotent and additive per level. */
export function applyArcherLevelAbilities(hero: Hero): void {
  if (hero.kind !== 'archer') return;
  const meta = hero as unknown as Record<string, unknown>;
  const installed = (meta[ARCHER_ABILITY_KEY] as Record<string, true>) ?? {};
  meta[ARCHER_ABILITY_KEY] = installed;

  if (hero.level >= 3 && !installed.focusShot) {
    installed.focusShot = true;
    hero.abilities.push(makeFocusShot());
  }
  if (hero.level >= 5 && !installed.skirmisher) {
    installed.skirmisher = true;
    // Skirmisher Step is reactive to nearby melee — implemented in HeroAI tick
    // (it needs world snapshot). We register a no-op marker so introspection works.
    hero.abilities.push({ onTick: () => {} });
  }
  if (hero.level >= 7 && !installed.volley) {
    installed.volley = true;
    hero.abilities.push(makeVolley(hero));
  }
  if (hero.level >= 8 && !installed.marksman) {
    installed.marksman = true;
    hero.abilities.push(makeMarksman(hero));
  }
}

/** Focus Shot (L3): every 5th shot crits ×2. */
function makeFocusShot(): AbilityCallbacks {
  return {
    onBeforeAttack: (hero: Hero, _t: HeroTarget, ctx: AttackContext, _simT: number): void => {
      hero.attackCount += 1;
      if (hero.attackCount % 5 === 0) {
        ctx.damage *= 2;
        ctx.crit = true;
      }
    },
  };
}

/**
 * Volley (L7): 20% chance to fire a second arrow at a nearby enemy within
 * 180u of the primary target. Like Cleave, the actual second-arrow application
 * is performed by CombatSystem from a stash on the hero.
 */
function makeVolley(hero: Hero): AbilityCallbacks {
  // Per-hero deterministic RNG so volley rolls are reproducible.
  const rng = createRng((stringHash(hero.id) ^ 0xa55a) >>> 0);
  return {
    onAfterAttack: (h: Hero, target: HeroTarget, _ctx: AttackContext, _simT: number): void => {
      if (!rng.chance(0.20)) return;
      (h as unknown as { pendingVolley?: { from: HeroTarget; radius: number; damage: number } }).pendingVolley = {
        from: target,
        radius: 180,
        damage: h.baseDamage,
      };
    },
  };
}

/**
 * Marksman (L8): +15% crit chance, +20% damage vs targets below 50% HP.
 * The low-HP bonus stacks multiplicatively with `Deadeye` perk (which the
 * combat system already applies once via `archerLowHpDamageBonus`).
 */
function makeMarksman(hero: Hero): AbilityCallbacks {
  const rng = createRng((stringHash(hero.id) ^ 0xfeed) >>> 0);
  return {
    onBeforeAttack: (_h: Hero, t: HeroTarget, ctx: AttackContext, _simT: number): void => {
      if (rng.chance(0.15)) {
        ctx.damage *= 2;
        ctx.crit = true;
      }
      if (t.hp / Math.max(1, t.maxHp) < 0.5) ctx.damage *= 1.20;
    },
  };
}

/**
 * Skirmisher Step (L5): triggered by HeroAI patrol/engage tick, not here —
 * exported helper applies a 100u retreat dash if a melee enemy is within 80u
 * and the cooldown is up.
 */
export function trySkirmisherStep(
  hero: Hero,
  enemies: ReadonlyArray<{ position: { x: number; z: number }; alive: boolean }>,
  _simT: number,
): boolean {
  if (hero.kind !== 'archer') return false;
  const meta = hero as unknown as Record<string, unknown>;
  const installed = (meta[ARCHER_ABILITY_KEY] as Record<string, true> | undefined) ?? {};
  if (!installed.skirmisher) return false;
  if ((hero.cooldowns.skirmisher ?? 0) > 0) return false;

  let nearest: { position: { x: number; z: number } } | null = null;
  let nearestD = Infinity;
  for (const e of enemies) {
    if (!e.alive) continue;
    const d = distance2d(hero.position.x, hero.position.z, e.position.x, e.position.z);
    if (d < nearestD) {
      nearestD = d;
      nearest = e;
    }
  }
  if (!nearest || nearestD > 80) return false;

  // Step away 100u along the vector from the enemy.
  const dx = hero.position.x - nearest.position.x;
  const dz = hero.position.z - nearest.position.z;
  const d = Math.hypot(dx, dz) || 1;
  const tx = hero.position.x + (dx / d) * 100;
  const tz = hero.position.z + (dz / d) * 100;
  hero.setDestination(tx, tz);
  hero.cooldowns.skirmisher = 8;
  return true;
}

function stringHash(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
  return h >>> 0;
}
