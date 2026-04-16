import type { NavGrid } from './NavGrid.ts';

export interface PathPointWorld {
  x: number;
  z: number;
}

export interface PathResult {
  /** Waypoints in world coords, from start (inclusive) to goal (inclusive). */
  world: PathPointWorld[];
  /** Cells visited along the path, in grid coords. */
  cells: Array<{ cx: number; cy: number }>;
}

interface Node {
  cx: number;
  cy: number;
  g: number;
  f: number;
  parent: number; // index into `all` nodes; -1 for start
}

const DIRS: Array<{ dx: number; dy: number; cost: number }> = [
  { dx: 1, dy: 0, cost: 1 },
  { dx: -1, dy: 0, cost: 1 },
  { dx: 0, dy: 1, cost: 1 },
  { dx: 0, dy: -1, cost: 1 },
  { dx: 1, dy: 1, cost: Math.SQRT2 },
  { dx: 1, dy: -1, cost: Math.SQRT2 },
  { dx: -1, dy: 1, cost: Math.SQRT2 },
  { dx: -1, dy: -1, cost: Math.SQRT2 },
];

/** Octile heuristic — admissible + consistent for 8-connected uniform grids. */
function octile(ax: number, ay: number, bx: number, by: number): number {
  const dx = Math.abs(ax - bx);
  const dy = Math.abs(ay - by);
  return (dx + dy) + (Math.SQRT2 - 2) * Math.min(dx, dy);
}

export class Pathfinder {
  private readonly cache = new Map<string, PathResult | null>();
  private lastGridVersion = -1;

  constructor(private readonly grid: NavGrid) {}

  /**
   * A* in world coordinates; points are snapped to the containing cells.
   * `null` if no path exists.
   */
  find(sx: number, sz: number, ex: number, ez: number): PathResult | null {
    const s = this.grid.worldToCell(sx, sz);
    const e = this.grid.worldToCell(ex, ez);
    return this.findCell(s.cx, s.cy, e.cx, e.cy);
  }

  findCell(sx: number, sy: number, ex: number, ey: number): PathResult | null {
    // Invalidate cache if the grid mutated.
    if (this.grid.version !== this.lastGridVersion) {
      this.cache.clear();
      this.lastGridVersion = this.grid.version;
    }
    const key = `${sx},${sy}->${ex},${ey}`;
    const cached = this.cache.get(key);
    if (cached !== undefined) return cached;

    const result = this.astar(sx, sy, ex, ey);
    this.cache.set(key, result);
    return result;
  }

  private astar(sx: number, sy: number, ex: number, ey: number): PathResult | null {
    const grid = this.grid;
    if (grid.isBlocked(sx, sy) || grid.isBlocked(ex, ey)) return null;
    if (sx === ex && sy === ey) {
      return {
        world: [worldAt(grid, sx, sy)],
        cells: [{ cx: sx, cy: sy }],
      };
    }
    const cols = grid.dims.cols;
    const all: Node[] = [];
    const indexByCell = new Map<number, number>(); // cy*cols+cx -> all[] index
    const closed = new Set<number>();
    // Simple array-backed open "heap": small maps keep cost low; we linear-scan.
    const open: number[] = [];

    const pushNode = (node: Node): number => {
      const idx = all.length;
      all.push(node);
      indexByCell.set(node.cy * cols + node.cx, idx);
      open.push(idx);
      return idx;
    };

    pushNode({ cx: sx, cy: sy, g: 0, f: octile(sx, sy, ex, ey), parent: -1 });

    while (open.length > 0) {
      // Pick lowest-f (linear). Grid is 96×54 = 5184 cells max — fine without a heap.
      let bestI = 0;
      for (let i = 1; i < open.length; i++) {
        if (all[open[i]]!.f < all[open[bestI]]!.f) bestI = i;
      }
      const currentIdx = open[bestI]!;
      open.splice(bestI, 1);
      const current = all[currentIdx]!;
      const curKey = current.cy * cols + current.cx;
      if (closed.has(curKey)) continue;
      closed.add(curKey);

      if (current.cx === ex && current.cy === ey) {
        return reconstruct(all, currentIdx, grid);
      }

      for (const d of DIRS) {
        const nx = current.cx + d.dx;
        const ny = current.cy + d.dy;
        if (grid.isBlocked(nx, ny)) continue;
        // Prevent diagonal through corners: both orthogonal neighbours must be free.
        if (d.dx !== 0 && d.dy !== 0) {
          if (grid.isBlocked(current.cx + d.dx, current.cy)) continue;
          if (grid.isBlocked(current.cx, current.cy + d.dy)) continue;
        }
        const nKey = ny * cols + nx;
        if (closed.has(nKey)) continue;

        const tentativeG = current.g + d.cost;
        const existingIdx = indexByCell.get(nKey);
        if (existingIdx === undefined) {
          const f = tentativeG + octile(nx, ny, ex, ey);
          pushNode({ cx: nx, cy: ny, g: tentativeG, f, parent: currentIdx });
        } else {
          const existing = all[existingIdx]!;
          if (tentativeG < existing.g) {
            existing.g = tentativeG;
            existing.f = tentativeG + octile(nx, ny, ex, ey);
            existing.parent = currentIdx;
            // Push a fresh pointer to re-consider it; closed check above filters duplicates.
            open.push(existingIdx);
          }
        }
      }
    }

    return null;
  }
}

function worldAt(grid: NavGrid, cx: number, cy: number): PathPointWorld {
  const { x, z } = grid.cellToWorld(cx, cy);
  return { x, z };
}

function reconstruct(all: Node[], endIdx: number, grid: NavGrid): PathResult {
  const cells: Array<{ cx: number; cy: number }> = [];
  const world: PathPointWorld[] = [];
  let idx = endIdx;
  while (idx !== -1) {
    const n = all[idx]!;
    cells.push({ cx: n.cx, cy: n.cy });
    world.push(worldAt(grid, n.cx, n.cy));
    idx = n.parent;
  }
  cells.reverse();
  world.reverse();
  return { cells, world };
}
