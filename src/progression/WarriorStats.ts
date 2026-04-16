import { HEROES } from '../config/Tuning.ts';
import type { Hero, HeroTarget } from '../entities/Hero.ts';
import type { AbilityCallbacks, AttackContext, IncomingContext } from './Abilities.ts';
import { distance2d } from '../util/Math.ts';

/**
 * Per-level scaling factors for a Warrior. PRD §13.3.
 *
 * M5 ships full progression — base stat scaling + ability callbacks installed
 * at the matching level (Cleave L3, Guard L5, Last Stand L7, Champion L8).
 *
 * We multiply BASE stats by these cumulative fractions at each level.
 */

export interface WarriorLevelScale {
  /** Multiplier applied to baseHp (>=1). */
  hpMult: number;
  /** Multiplier applied to baseDamage (>=1). */
  damageMult: number;
  /** Multiplier applied to baseMoveSpeed (>=1). */
  moveSpeedMult: number;
  /** Additive fractional damage reduction from armor (0..1). M4: unused, reserved. */
  armorDR: number;
}

/** Index by level (1..8). */
const TABLE: readonly WarriorLevelScale[] = [
  /* L1 */ { hpMult: 1.00, damageMult: 1.00, moveSpeedMult: 1.00, armorDR: 0 },
  /* L2 */ { hpMult: 1.18, damageMult: 1.08, moveSpeedMult: 1.00, armorDR: 0 },
  /* L3 */ { hpMult: 1.18, damageMult: 1.08, moveSpeedMult: 1.00, armorDR: 0 },
  /* L4 */ { hpMult: 1.18, damageMult: 1.08, moveSpeedMult: 1.05, armorDR: 0.12 },
  /* L5 */ { hpMult: 1.18, damageMult: 1.08, moveSpeedMult: 1.05, armorDR: 0.12 },
  /* L6 */ { hpMult: 1.18 * 1.15, damageMult: 1.08 * 1.10, moveSpeedMult: 1.05, armorDR: 0.12 },
  /* L7 */ { hpMult: 1.18 * 1.15, damageMult: 1.08 * 1.10, moveSpeedMult: 1.05, armorDR: 0.12 },
  /* L8 */ { hpMult: 1.18 * 1.15 * 1.20, damageMult: 1.08 * 1.10 * 1.15, moveSpeedMult: 1.05, armorDR: 0.12 },
];

export function warriorScaleForLevel(level: number): WarriorLevelScale {
  const idx = Math.max(1, Math.min(TABLE.length, level)) - 1;
  return TABLE[idx]!;
}

export interface WarriorStats {
  maxHp: number;
  damage: number;
  attackRate: number;
  moveSpeed: number;
  attackRange: number;
  armorDR: number;
}

/** Derive Warrior stats at the given level from the base tuning values. */
export function warriorStatsAt(level: number): WarriorStats {
  const s = warriorScaleForLevel(level);
  return {
    maxHp: Math.round(HEROES.warrior.maxHp * s.hpMult),
    damage: HEROES.warrior.damage * s.damageMult,
    attackRate: HEROES.warrior.attackRate,
    moveSpeed: HEROES.warrior.moveSpeed * s.moveSpeedMult,
    attackRange: HEROES.warrior.attackRange,
    armorDR: s.armorDR,
  };
}

// ---------------- Warrior abilities (PRD §13.3) ----------------

const WARRIOR_ABILITY_KEY = '__warriorAbilitiesInstalled';

/** Install ability callbacks on a warrior; idempotent and additive. */
export function applyWarriorLevelAbilities(hero: Hero): void {
  if (hero.kind !== 'warrior') return;
  const meta = hero as unknown as Record<string, unknown>;
  const installed = (meta[WARRIOR_ABILITY_KEY] as Record<string, true>) ?? {};
  meta[WARRIOR_ABILITY_KEY] = installed;

  if (hero.level >= 3 && !installed.cleave) {
    installed.cleave = true;
    hero.abilities.push(makeCleave());
  }
  if (hero.level >= 5 && !installed.guard) {
    installed.guard = true;
    hero.abilities.push(makeGuard(hero));
  }
  if (hero.level >= 7 && !installed.lastStand) {
    installed.lastStand = true;
    hero.abilities.push(makeLastStand());
  }
  if (hero.level >= 8 && !installed.champion) {
    installed.champion = true;
    hero.abilities.push(makeChampion());
  }
}

/**
 * Cleave (L3): every 4th hit deals 50% AoE damage to up to 2 extra enemies
 * within 60u of the primary target.
 *
 * The AoE list is supplied by CombatSystem via `_pendingCleave` on `hero` —
 * a tiny stash so we don't widen the AbilityCallback signature with a world
 * snapshot. CombatSystem reads this after `onAfterAttack`.
 */
function makeCleave(): AbilityCallbacks {
  return {
    onAfterAttack: (hero: Hero, target: HeroTarget, _ctx: AttackContext, _simT: number): void => {
      hero.attackCount += 1;
      if (target.type === 'nest') return;
      if (hero.attackCount % 4 !== 0) return;
      // Stash a request — CombatSystem reads `pendingCleaveDamage` and applies the splash.
      (hero as unknown as { pendingCleaveDamage?: { from: HeroTarget; damage: number } }).pendingCleaveDamage = {
        from: target,
        damage: hero.baseDamage * 0.5,
      };
    },
  };
}

/**
 * Guard (L5): while adjacent (≤120u) to an Archer ally, +15% threat (handled
 * by monster targeting upweight) and -10% incoming damage.
 *
 * Threat upweight requires a snapshot of allies — we read it from
 * `(hero as any)._allies` set each tick by HeroAI, so this stays self-contained.
 */
function makeGuard(_hero: Hero): AbilityCallbacks {
  return {
    onIncomingDamage: (hero: Hero, ctx: IncomingContext, _simT: number): void => {
      const allies = (hero as unknown as { _alliesSnapshot?: Hero[] })._alliesSnapshot ?? [];
      let nearArcher = false;
      for (const a of allies) {
        if (a === hero || a.kind !== 'archer' || !a.alive) continue;
        const d = distance2d(hero.position.x, hero.position.z, a.position.x, a.position.z);
        if (d <= 120) {
          nearArcher = true;
          break;
        }
      }
      if (nearArcher) ctx.damage *= 0.90;
    },
  };
}

/**
 * Last Stand (L7): first time HP drops below 25%, gain 30% damage reduction
 * for 4s. CD 40s (per-hero). The `lastStandTriggered` flag prevents re-arming
 * within the same engagement; the cooldown is wall-clock.
 */
function makeLastStand(): AbilityCallbacks {
  return {
    onIncomingDamage: (hero: Hero, ctx: IncomingContext, simT: number): void => {
      const after = hero.hp - ctx.damage;
      if (after / hero.maxHp >= 0.25) return;
      const cd = hero.cooldowns.lastStand ?? 0;
      if (cd > 0) return;
      if (hero.lastStandTriggered) return;
      hero.lastStandTriggered = true;
      hero.cooldowns.lastStand = 40;
      hero.damageReductionBuff = 0.30;
      hero.damageReductionRemaining = 4;
      // Reset the trigger flag once HP recovers above 30% — we re-arm next dip.
      const meta = hero as unknown as { _lastStandResetCheckT?: number };
      meta._lastStandResetCheckT = simT;
    },
    onTick: (hero: Hero, _dt: number, _simT: number): void => {
      if (hero.lastStandTriggered && hero.hp / hero.maxHp > 0.30 && hero.damageReductionRemaining === 0) {
        hero.lastStandTriggered = false;
      }
    },
  };
}

/**
 * Champion (L8): passive +25% damage vs nests. The HP/damage flat bonuses live
 * in the L8 row of `TABLE` already (1.20 hp, 1.15 dmg multipliers). The nest
 * bonus rides through `onBeforeAttack`.
 */
function makeChampion(): AbilityCallbacks {
  return {
    onBeforeAttack: (_hero: Hero, target: HeroTarget, ctx: AttackContext, _simT: number): void => {
      if (target.type === 'nest') ctx.damage *= 1.25;
    },
  };
}
