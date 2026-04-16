export const MAP = {
  width: 3840,
  height: 2160,
  cellSize: 40,
} as const;

export const CAMERA = {
  pitchDeg: 55,
  heightAbove: 1200,
  orthoZoomWidth: 2200,
  panSpeed: 900,
  dragSpeed: 1.5,
  edgePanMargin: 12,
  edgePanSpeed: 700,
} as const;

export const WORLD = {
  groundColor: 0x4c6b3a,
  skyColor: 0xa6c3dc,
} as const;

export const MAP_GEN = {
  /** Number of evenly-spaced build slots around the capital. */
  slotCount: 6,
  /** Capital-to-slot ring radius (PRD §6.2 allows 250–350). */
  slotRingRadius: 300,
  /** Keep-out radius around the capital where obstacles are forbidden. */
  capitalSafeRadius: 350,
  /** Keep-out radius around each build slot. */
  slotAuraRadius: 120,
  /** Keep-out radius around each nest. */
  nestAuraRadius: 250,
  /** Ring bounds for the 2 near nests. */
  nearNestRing: { min: 700, max: 900 } as const,
  /** Ring bounds for the 2 mid nests. */
  midNestRing: { min: 1100, max: 1400 } as const,
  /** Ring bounds for the 1 far nest. */
  farNestRing: { min: 1400, max: 1600 } as const,
  /** Minimum angular spread between nests (rad). */
  nestMinAngularGap: (35 * Math.PI) / 180,
  /** Target fraction of map area covered by obstacles. */
  obstacleCoverageMin: 0.1,
  obstacleCoverageMax: 0.15,
  /** Obstacle rectangle size range (world units per side). */
  obstacleMinSide: 80,
  obstacleMaxSide: 220,
  /** Max attempts before giving up regeneration on a single seed. */
  generationAttempts: 40,
  /** Minimum angular separation between the two approach corridors of a far nest. */
  farApproachMinAngle: (30 * Math.PI) / 180,
} as const;

export const ECONOMY = {
  startingGold: 180,
  goldTickPerSec: 2,
  barracksCost: 100,
  marketCost: 90,
  blacksmithCost: 120,
  warriorCost: 60,
  archerCost: 70,
  potionPrice: 25,
  /** Gold reward for killing a regular monster (split across attackers). PRD §7.4. */
  monsterKillGold: 8,
  /** Gold reward for destroying a nest (split across attackers). PRD §7.4. */
  nestKillGold: 40,
} as const;

// --------------------- M4 Combat tuning ---------------------

/** Warrior + Archer base stats per PRD §9.3. */
export const HEROES = {
  /** Hard cap on simultaneously-alive heroes. */
  cap: 12,
  /** Rally time at barracks before heroes start acting. Seconds. */
  rallySeconds: 2.5,
  /** Capital safe zone radius (PRD §10.6 — 4% regen inside). */
  safeZoneRadius: 350,
  /** Max distance hero will chase from its anchor before leashing back. */
  engagementLeashRadius: 600,
  /** Target re-evaluation period (seconds). */
  retargetPeriod: 0.5,
  /** Out-of-combat time needed before regen kicks in. Seconds. */
  regenCooldownSeconds: 3,
  /** Base world regen (fraction of maxHp per second, out of combat, outside safe zone). */
  worldRegenPerSec: 0.01,
  /** Safe-zone regen (fraction of maxHp per second). */
  safeZoneRegenPerSec: 0.04,
  /** Aggro radius for a hero picking a monster target. */
  aggroRadius: 420,

  // ---------------- M5 AI tuning ----------------
  /** AI reconsider period (seconds). PRD §10. */
  aiReconsiderPeriod: 0.5,
  /** Healing potion restores this fraction of max HP. */
  potionHealFraction: 0.40,
  /** Warrior auto-drinks potion at this HP fraction. */
  warriorPotionThreshold: 0.35,
  /** Archer auto-drinks potion at this HP fraction. */
  archerPotionThreshold: 0.45,
  /** Warrior retreats below this HP fraction (no potion). */
  warriorRetreatThreshold: 0.20,
  /** Archer retreats below this HP fraction (no potion). */
  archerRetreatThreshold: 0.30,
  /** Warrior re-enters combat once HP rises above this fraction. */
  warriorResumeThreshold: 0.75,
  /** Archer re-enters combat once HP rises above this fraction. */
  archerResumeThreshold: 0.80,
  /** Archer kiting band — try to stay between min/max from melee enemy. */
  archerKiteMin: 220,
  archerKiteMax: 320,
  /** Hero must be out of combat at least this long to leave field for shopping. */
  outOfCombatForServiceSeconds: 6,
  /** Trigger AssistAlly if a friendly within this radius is in combat. */
  assistAllyRadius: 240,
  /** Capital is "under threat" if any monster is within this radius of capital. */
  capitalThreatRadius: 500,
  /** Patrol ring around capital. */
  patrolRingMin: 600,
  patrolRingMax: 900,

  warrior: {
    maxHp: 120,
    damage: 12,
    attackRate: 1.0,
    moveSpeed: 90,
    /** Melee reach (units). */
    attackRange: 40,
  },
  archer: {
    maxHp: 75,
    damage: 10,
    attackRate: 1.2,
    moveSpeed: 100,
    attackRange: 260,
  },
} as const;

/** Capital health + auto-defense aura. PRD §7.1. */
export const CAPITAL = {
  maxHp: 1500,
  /** Aura radius — monsters inside take aura damage. */
  auraRadius: 350,
  /** Damage per aura tick (one nearest monster). */
  weakAuraDamage: 4,
  /** Period between aura ticks (seconds). */
  weakAuraRate: 1.0,
} as const;

/** Per-nest roaming-monster dispatch interval (seconds). PRD §11.2. */
export const ROAMING = {
  intervalMinSec: 45,
  intervalMaxSec: 60,
} as const;

/** Monster base stats. PRD §11. */
export const MONSTERS = {
  /** Hard cap across entire world (PRD §11.2). */
  worldCap: 30,
  maxHp: 60,
  damage: 6,
  attackRate: 1.0,
  moveSpeed: 75,
  /** Radius monster detects heroes within. */
  aggroRadius: 260,
  /** Max distance monster will chase before leashing home. */
  pursuitRadius: 500,
  /** Patrol wander radius around home. */
  patrolRadius: 80,
  /** Melee engagement range. */
  meleeRange: 40,
  /** Roaming interval bounds — used in M5. Seconds. */
  roamingIntervalMin: 45,
  roamingIntervalMax: 60,
  /** Period (seconds) between patrol wander re-picks. */
  patrolRepickPeriod: 4,
} as const;

/** Nest tier data per PRD §11.2. */
export interface NestTierTuning {
  hp: number;
  spawnIntervalSec: number;
  maxActiveDefenders: number;
}

export const NESTS: Record<'near' | 'mid' | 'far', NestTierTuning> = {
  near: { hp: 400, spawnIntervalSec: 20, maxActiveDefenders: 4 },
  mid: { hp: 550, spawnIntervalSec: 18, maxActiveDefenders: 5 },
  far: { hp: 700, spawnIntervalSec: 16, maxActiveDefenders: 6 },
};

/**
 * Equipment tier table per PRD §14.3.
 *
 * Kept data-driven so `Hero` getters just look up — avoids hand-rolled
 * per-tier branches and makes future tuning a single-table edit.
 *
 * Tier multipliers are **incremental** at the row level. Effective values
 * are the product of all rows with tier ≤ hero.weaponTier / armorTier.
 *
 *  - weapon rows (kind='weapon'):
 *      dmgMult — multiplicative damage bump this tier contributes
 *      rateMult — warrior secondary (T2 +10% attack rate)
 *      rangeMult — archer secondary (T2 +20% attack range)
 *      nestDmgMult — warrior signature (T3 +25% vs nests)
 *      critAddPct — archer signature (T3 +10% crit chance)
 *  - armor rows (kind='armor'):
 *      hpMult — multiplicative max HP bump
 *      drAdd — additive fractional damage reduction
 *
 * Prices match PRD §14.3 gold costs.
 */
export interface EquipmentRow {
  readonly kind: 'weapon' | 'armor';
  readonly tier: 1 | 2 | 3;
  readonly price: number;
  /** Damage multiplier (weapon). 1 for non-weapon rows. */
  readonly dmgMult: number;
  /** Warrior attack-rate multiplier (weapon T2/T3). 1 = no change. */
  readonly warriorRateMult: number;
  /** Archer attack-range multiplier (weapon T2). 1 = no change. */
  readonly archerRangeMult: number;
  /** Warrior +% damage vs nests signature (weapon T3). 0 = none. */
  readonly warriorNestDmgAdd: number;
  /** Archer +% crit chance signature (weapon T3). 0 = none. */
  readonly archerCritAdd: number;
  /** Max HP multiplier (armor). 1 = no change. */
  readonly hpMult: number;
  /** Additive damage reduction (armor). 0..1. */
  readonly drAdd: number;
}

export const EQUIPMENT: readonly EquipmentRow[] = [
  // Weapons
  { kind: 'weapon', tier: 1, price: 40,
    dmgMult: 1.15, warriorRateMult: 1, archerRangeMult: 1,
    warriorNestDmgAdd: 0, archerCritAdd: 0, hpMult: 1, drAdd: 0 },
  { kind: 'weapon', tier: 2, price: 90,
    dmgMult: 1.15, warriorRateMult: 1.10, archerRangeMult: 1.20,
    warriorNestDmgAdd: 0, archerCritAdd: 0, hpMult: 1, drAdd: 0 },
  { kind: 'weapon', tier: 3, price: 160,
    dmgMult: 1.20, warriorRateMult: 1, archerRangeMult: 1,
    warriorNestDmgAdd: 0.25, archerCritAdd: 0.10, hpMult: 1, drAdd: 0 },
  // Armor
  { kind: 'armor', tier: 1, price: 35,
    dmgMult: 1, warriorRateMult: 1, archerRangeMult: 1,
    warriorNestDmgAdd: 0, archerCritAdd: 0, hpMult: 1.15, drAdd: 0 },
  { kind: 'armor', tier: 2, price: 75,
    dmgMult: 1, warriorRateMult: 1, archerRangeMult: 1,
    warriorNestDmgAdd: 0, archerCritAdd: 0, hpMult: 1.10, drAdd: 0.10 },
  { kind: 'armor', tier: 3, price: 130,
    dmgMult: 1, warriorRateMult: 1, archerRangeMult: 1,
    warriorNestDmgAdd: 0, archerCritAdd: 0, hpMult: 1.15, drAdd: 0.15 },
];

/** Lookup the incremental row for a given slot + tier. Returns null for tier 0. */
export function equipmentRow(kind: 'weapon' | 'armor', tier: 0 | 1 | 2 | 3): EquipmentRow | null {
  if (tier === 0) return null;
  return EQUIPMENT.find((r) => r.kind === kind && r.tier === tier) ?? null;
}

/** Combat rules — reward splits + damage attribution. */
export const COMBAT = {
  /** XP reward for killing a single monster (split across attackers). PRD §13.2. */
  monsterKillXp: 12,
  /** XP reward for destroying a nest (split across attackers). PRD §13.2. */
  nestKillXp: 60,
  /** Minimum XP each contributing attacker receives when splitting. */
  minRewardXp: 1,
  /** Minimum gold each contributing attacker receives when splitting. */
  minRewardGold: 1,
  /** Attacker contribution window — if a hero hasn't damaged the target in this many seconds, they drop off the reward split. */
  attackerWindowSec: 10,
  /** Straight-line threshold — below this distance units skip pathfinding and go direct. */
  directMoveMaxDistance: 200,
} as const;
