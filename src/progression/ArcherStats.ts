import { HEROES } from '../config/Tuning.ts';

/**
 * Per-level scaling factors for an Archer. PRD §13.4.
 *
 * M4 ships STAT-ONLY deltas (damage, attack-speed, range, move-speed).
 * Abilities (Focus Shot L3, Skirmisher Step L5, Volley L7, Marksman L8) are M5.
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
