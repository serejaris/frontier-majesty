import { HEROES } from '../config/Tuning.ts';

/**
 * Per-level scaling factors for a Warrior. PRD §13.3.
 *
 * M4 ships STAT-ONLY deltas (hp, damage, move-speed, armor).
 * Abilities (Cleave L3, Guard L5, Last Stand L7, Champion bonus L8) are M5.
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
