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
