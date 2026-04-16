/**
 * XP curve + level lookup. PRD §13.1.
 *
 * Table is cumulative total XP required to REACH that level. Level 1 needs 0,
 * level 2 needs 40 cumulative, level 8 needs 700. No level 9 — cap is 8.
 */

export const MAX_LEVEL = 8;

/** Cumulative XP required to be AT each level (index = level). Level 1 is the starting floor. */
const CUMULATIVE_XP: readonly number[] = [
  /* L1 */ 0,
  /* L2 */ 40,
  /* L3 */ 100,
  /* L4 */ 180,
  /* L5 */ 280,
  /* L6 */ 400,
  /* L7 */ 540,
  /* L8 */ 700,
];

/**
 * Given total cumulative XP, return the resulting level (1..MAX_LEVEL).
 * Used when awarding XP — hero.xp is cumulative total.
 */
export function levelForXp(xp: number): number {
  if (xp <= 0) return 1;
  let lvl = 1;
  for (let i = 1; i < CUMULATIVE_XP.length; i++) {
    if (xp >= CUMULATIVE_XP[i]!) lvl = i + 1;
    else break;
  }
  return Math.min(MAX_LEVEL, lvl);
}

/** Cumulative XP required to REACH `level`. Level 1 → 0. Clamps past cap. */
export function xpToReachLevel(level: number): number {
  if (level <= 1) return 0;
  const idx = Math.min(MAX_LEVEL, level) - 1;
  return CUMULATIVE_XP[idx]!;
}

/** XP needed to reach the NEXT level, or null at cap. */
export function xpToNextLevel(currentXp: number): number | null {
  const lvl = levelForXp(currentXp);
  if (lvl >= MAX_LEVEL) return null;
  return xpToReachLevel(lvl + 1);
}
