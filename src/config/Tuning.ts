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
} as const;
