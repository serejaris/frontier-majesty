import { MAP, MAP_GEN } from '../config/Tuning.ts';
import { createRng, type Rng } from '../util/Random.ts';
import {
  angularDelta,
  distanceSq2d,
  pointRectDistance,
  rectsOverlap,
  type Rect,
} from '../util/Math.ts';
import { NavGrid } from './NavGrid.ts';

export type NestTier = 'near' | 'mid' | 'far';

export interface BuildSlot {
  id: string;
  x: number;
  z: number;
}

export interface NestPlacement {
  id: string;
  tier: NestTier;
  x: number;
  z: number;
}

export interface GeneratedMap {
  seed: number;
  capital: { x: number; z: number };
  slots: BuildSlot[];
  nests: NestPlacement[];
  obstacles: Rect[];
  /** Coverage actually achieved (obstacle area / map area). */
  obstacleCoverage: number;
}

interface NestSpec {
  tier: NestTier;
  ringMin: number;
  ringMax: number;
  count: number;
}

const NEST_PLAN: readonly NestSpec[] = [
  { tier: 'near', ringMin: MAP_GEN.nearNestRing.min, ringMax: MAP_GEN.nearNestRing.max, count: 2 },
  { tier: 'mid', ringMin: MAP_GEN.midNestRing.min, ringMax: MAP_GEN.midNestRing.max, count: 2 },
  { tier: 'far', ringMin: MAP_GEN.farNestRing.min, ringMax: MAP_GEN.farNestRing.max, count: 1 },
];

/**
 * Build a fully deterministic map from `seed`. Retries a bounded number of times
 * if connectivity / approach-corridor checks fail. Throws if no attempt succeeds
 * (extremely unlikely with current tuning).
 */
export function generateMap(seed: number): GeneratedMap {
  let lastErr: Error | null = null;
  for (let attempt = 0; attempt < MAP_GEN.generationAttempts; attempt++) {
    // Derive a sub-seed so retries aren't identical but the top-level seed still dictates output.
    const subSeed = (seed ^ (attempt * 0x9e3779b9)) >>> 0;
    const rng = createRng(subSeed);
    try {
      return buildOnce(seed, rng);
    } catch (e) {
      lastErr = e as Error;
    }
  }
  throw new Error(`MapGenerator: could not produce a valid map for seed ${seed}: ${lastErr?.message ?? 'unknown'}`);
}

function buildOnce(seed: number, rng: Rng): GeneratedMap {
  const capital = { x: 0, z: 0 };
  const slots = placeSlots(rng);
  const nests = placeNests(rng);

  const obstacles = placeObstacles(rng, slots, nests);
  const coverage = totalCoverage(obstacles);

  // Connectivity check: capital → each nest via BFS.
  const grid = new NavGrid();
  grid.applyObstacles(obstacles);
  const unreachable = findUnreachable(grid, capital, nests);
  if (unreachable.length > 0) {
    // Prune obstacles that block any unreachable nest's straight path and re-check.
    pruneBlockingObstacles(grid, obstacles, capital, unreachable);
    const stillUnreachable = findUnreachable(grid, capital, nests);
    if (stillUnreachable.length > 0) {
      throw new Error(`unreachable nests: ${stillUnreachable.map((n) => n.id).join(',')}`);
    }
  }

  // Far-nest multi-approach check.
  for (const nest of nests) {
    if (nest.tier !== 'far') continue;
    if (!hasTwoApproaches(grid, capital, nest)) {
      throw new Error(`far nest ${nest.id} lacks 2 distinct approaches`);
    }
  }

  return {
    seed,
    capital,
    slots,
    nests,
    obstacles,
    obstacleCoverage: coverage / (MAP.width * MAP.height),
  };
}

// ----- Slots -----

function placeSlots(rng: Rng): BuildSlot[] {
  const slots: BuildSlot[] = [];
  const n = MAP_GEN.slotCount;
  const r = MAP_GEN.slotRingRadius;
  // Random phase so two different seeds don't produce identical angular layouts.
  const phase = rng.next() * Math.PI * 2;
  for (let i = 0; i < n; i++) {
    const a = phase + (i * Math.PI * 2) / n;
    slots.push({
      id: `slot-${i}`,
      x: Math.cos(a) * r,
      z: Math.sin(a) * r,
    });
  }
  return slots;
}

// ----- Nests -----

function placeNests(rng: Rng): NestPlacement[] {
  const nests: NestPlacement[] = [];
  // Accumulate all placed angles for cross-tier spacing.
  const angles: number[] = [];
  let counter = 0;
  for (const spec of NEST_PLAN) {
    for (let i = 0; i < spec.count; i++) {
      const a = pickSpreadAngle(rng, angles);
      angles.push(a);
      const r = rng.range(spec.ringMin, spec.ringMax);
      nests.push({
        id: `nest-${spec.tier}-${counter++}`,
        tier: spec.tier,
        x: Math.cos(a) * r,
        z: Math.sin(a) * r,
      });
    }
  }
  return nests;
}

function pickSpreadAngle(rng: Rng, existing: readonly number[]): number {
  const minGap = MAP_GEN.nestMinAngularGap;
  for (let attempt = 0; attempt < 80; attempt++) {
    const a = rng.next() * Math.PI * 2;
    let ok = true;
    for (const b of existing) {
      if (angularDelta(a, b) < minGap) {
        ok = false;
        break;
      }
    }
    if (ok) return a;
  }
  // Fallback: return least-crowded angle deterministically.
  let best = 0;
  let bestScore = -Infinity;
  for (let i = 0; i < 32; i++) {
    const a = (i / 32) * Math.PI * 2;
    let minDist = Infinity;
    for (const b of existing) {
      const d = angularDelta(a, b);
      if (d < minDist) minDist = d;
    }
    if (minDist > bestScore) {
      bestScore = minDist;
      best = a;
    }
  }
  return best;
}

// ----- Obstacles -----

function placeObstacles(rng: Rng, slots: BuildSlot[], nests: NestPlacement[]): Rect[] {
  const halfW = MAP.width * 0.5;
  const halfH = MAP.height * 0.5;
  const targetMin = MAP.width * MAP.height * MAP_GEN.obstacleCoverageMin;
  const targetMax = MAP.width * MAP.height * MAP_GEN.obstacleCoverageMax;

  const placed: Rect[] = [];
  let areaAcc = 0;
  let guard = 0;
  const maxAttempts = 4000;

  while (areaAcc < targetMin && guard < maxAttempts) {
    guard++;
    const w = rng.range(MAP_GEN.obstacleMinSide, MAP_GEN.obstacleMaxSide);
    const h = rng.range(MAP_GEN.obstacleMinSide, MAP_GEN.obstacleMaxSide);
    const cx = rng.range(-halfW + w * 0.5, halfW - w * 0.5);
    const cz = rng.range(-halfH + h * 0.5, halfH - h * 0.5);
    const rect: Rect = {
      minX: cx - w * 0.5,
      minZ: cz - h * 0.5,
      maxX: cx + w * 0.5,
      maxZ: cz + h * 0.5,
    };

    if (!isLegalObstacle(rect, slots, nests, placed)) continue;

    // Do not exceed the upper coverage target.
    const rectArea = w * h;
    if (areaAcc + rectArea > targetMax) continue;

    placed.push(rect);
    areaAcc += rectArea;
  }
  return placed;
}

function isLegalObstacle(
  r: Rect,
  slots: readonly BuildSlot[],
  nests: readonly NestPlacement[],
  existing: readonly Rect[],
): boolean {
  // Capital safe zone.
  if (pointRectDistance(r, 0, 0) < MAP_GEN.capitalSafeRadius) return false;
  // Slot aura.
  for (const s of slots) {
    if (pointRectDistance(r, s.x, s.z) < MAP_GEN.slotAuraRadius) return false;
  }
  // Nest aura.
  for (const n of nests) {
    if (pointRectDistance(r, n.x, n.z) < MAP_GEN.nestAuraRadius) return false;
  }
  // Keep obstacles from overlapping each other (simpler silhouettes).
  for (const other of existing) {
    if (rectsOverlap(r, other)) return false;
  }
  return true;
}

function totalCoverage(obstacles: readonly Rect[]): number {
  let acc = 0;
  for (const r of obstacles) {
    acc += (r.maxX - r.minX) * (r.maxZ - r.minZ);
  }
  return acc;
}

// ----- Connectivity -----

function findUnreachable(
  grid: NavGrid,
  capital: { x: number; z: number },
  nests: readonly NestPlacement[],
): NestPlacement[] {
  const start = grid.worldToCell(capital.x, capital.z);
  const reach = bfsReachable(grid, start.cx, start.cy);
  const unreachable: NestPlacement[] = [];
  for (const n of nests) {
    const c = grid.worldToCell(n.x, n.z);
    if (!reach.has(c.cy * grid.dims.cols + c.cx)) unreachable.push(n);
  }
  return unreachable;
}

function bfsReachable(grid: NavGrid, sx: number, sy: number): Set<number> {
  const cols = grid.dims.cols;
  const visited = new Set<number>();
  if (grid.isBlocked(sx, sy)) return visited;
  const queue: Array<[number, number]> = [[sx, sy]];
  visited.add(sy * cols + sx);
  const dirs: Array<[number, number]> = [
    [1, 0], [-1, 0], [0, 1], [0, -1],
  ];
  while (queue.length > 0) {
    const [cx, cy] = queue.shift()!;
    for (const [dx, dy] of dirs) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (grid.isBlocked(nx, ny)) continue;
      const k = ny * cols + nx;
      if (visited.has(k)) continue;
      visited.add(k);
      queue.push([nx, ny]);
    }
  }
  return visited;
}

function pruneBlockingObstacles(
  grid: NavGrid,
  obstacles: Rect[],
  capital: { x: number; z: number },
  unreachable: readonly NestPlacement[],
): void {
  // For each unreachable nest, remove the obstacle closest to the straight segment capital→nest.
  for (const nest of unreachable) {
    let bestIdx = -1;
    let bestDist = Infinity;
    for (let i = 0; i < obstacles.length; i++) {
      const r = obstacles[i]!;
      const d = segmentRectDistance(capital.x, capital.z, nest.x, nest.z, r);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    if (bestIdx >= 0) obstacles.splice(bestIdx, 1);
  }
  // Rebuild grid occupancy.
  grid.clear();
  grid.applyObstacles(obstacles);
}

function segmentRectDistance(
  ax: number, az: number, bx: number, bz: number, r: Rect,
): number {
  // Sample a few points along the segment; coarse but sufficient.
  let best = Infinity;
  const samples = 12;
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const px = ax + (bx - ax) * t;
    const pz = az + (bz - az) * t;
    const d = pointRectDistance(r, px, pz);
    if (d < best) best = d;
  }
  return best;
}

// ----- Approach corridors -----

/**
 * Coarse heuristic: from the nest, try BFS towards the capital along sectors offset
 * angularly. If two sectors at least `farApproachMinAngle` apart both yield a path
 * whose last segment enters the nest from within that sector, the nest has 2 approaches.
 */
function hasTwoApproaches(
  grid: NavGrid,
  capital: { x: number; z: number },
  nest: NestPlacement,
): boolean {
  // The incoming direction at the nest is captured by a 1-ring scan: which of 8
  // neighbours of the nest cell are reachable from the capital? A separation of
  // ≥30° between any two reachable neighbour directions → 2 distinct approaches.
  const cap = grid.worldToCell(capital.x, capital.z);
  const reach = bfsReachable(grid, cap.cx, cap.cy);
  const nestCell = grid.worldToCell(nest.x, nest.z);
  const neigh: Array<{ dx: number; dy: number }> = [
    { dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 },
    { dx: 1, dy: 1 }, { dx: 1, dy: -1 }, { dx: -1, dy: 1 }, { dx: -1, dy: -1 },
  ];
  const approachAngles: number[] = [];
  for (const d of neigh) {
    const nx = nestCell.cx + d.dx;
    const ny = nestCell.cy + d.dy;
    if (grid.isBlocked(nx, ny)) continue;
    const key = ny * grid.dims.cols + nx;
    if (!reach.has(key)) continue;
    approachAngles.push(Math.atan2(d.dy, d.dx));
  }
  const min = MAP_GEN.farApproachMinAngle;
  for (let i = 0; i < approachAngles.length; i++) {
    for (let j = i + 1; j < approachAngles.length; j++) {
      if (angularDelta(approachAngles[i]!, approachAngles[j]!) >= min) return true;
    }
  }
  return false;
}

// Re-export type for consumers who want to avoid importing Math.ts directly.
export type { Rect } from '../util/Math.ts';

// Small helper for deterministic farthest-nest selection used by Game's debug path.
export function farthestNest(map: GeneratedMap): NestPlacement {
  let best: NestPlacement = map.nests[0]!;
  let bestDist = -Infinity;
  for (const n of map.nests) {
    const d = distanceSq2d(map.capital.x, map.capital.z, n.x, n.z);
    if (d > bestDist) {
      bestDist = d;
      best = n;
    }
  }
  return best;
}
