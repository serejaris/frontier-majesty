import type { Rect } from '../util/Math.ts';
import { MAP } from '../config/Tuning.ts';

export interface GridDims {
  cols: number;
  rows: number;
  cellSize: number;
  /** World-space min corner of cell (0,0). */
  originX: number;
  originZ: number;
}

/**
 * Uniform grid over the map plane. Cells outside the map bounds or intersecting
 * obstacle rects are marked blocked. Coordinates: +X east, +Z south.
 */
export class NavGrid {
  readonly dims: GridDims;
  private readonly blocked: Uint8Array;
  /** Monotonic version, bumped on any mutation — used as path-cache key. */
  private _version = 0;

  constructor(
    mapWidth: number = MAP.width,
    mapHeight: number = MAP.height,
    cellSize: number = MAP.cellSize,
  ) {
    const cols = Math.floor(mapWidth / cellSize);
    const rows = Math.floor(mapHeight / cellSize);
    this.dims = {
      cols,
      rows,
      cellSize,
      originX: -mapWidth * 0.5,
      originZ: -mapHeight * 0.5,
    };
    this.blocked = new Uint8Array(cols * rows);
  }

  get version(): number {
    return this._version;
  }

  worldToCell(x: number, z: number): { cx: number; cy: number } {
    const { cellSize, originX, originZ } = this.dims;
    return {
      cx: Math.floor((x - originX) / cellSize),
      cy: Math.floor((z - originZ) / cellSize),
    };
  }

  /** World coordinate of a cell's centre. */
  cellToWorld(cx: number, cy: number): { x: number; z: number } {
    const { cellSize, originX, originZ } = this.dims;
    return {
      x: originX + (cx + 0.5) * cellSize,
      z: originZ + (cy + 0.5) * cellSize,
    };
  }

  inBounds(cx: number, cy: number): boolean {
    return cx >= 0 && cy >= 0 && cx < this.dims.cols && cy < this.dims.rows;
  }

  isBlocked(cx: number, cy: number): boolean {
    if (!this.inBounds(cx, cy)) return true;
    return this.blocked[cy * this.dims.cols + cx] === 1;
  }

  /** Mark all cells that intersect any rect in `obstacles` as blocked. */
  applyObstacles(obstacles: readonly Rect[]): void {
    const { cellSize, cols, rows, originX, originZ } = this.dims;
    for (const r of obstacles) {
      const minCX = Math.max(0, Math.floor((r.minX - originX) / cellSize));
      const maxCX = Math.min(cols - 1, Math.floor((r.maxX - originX) / cellSize));
      const minCY = Math.max(0, Math.floor((r.minZ - originZ) / cellSize));
      const maxCY = Math.min(rows - 1, Math.floor((r.maxZ - originZ) / cellSize));
      for (let cy = minCY; cy <= maxCY; cy++) {
        for (let cx = minCX; cx <= maxCX; cx++) {
          this.blocked[cy * cols + cx] = 1;
        }
      }
    }
    this._version++;
  }

  clear(): void {
    this.blocked.fill(0);
    this._version++;
  }
}
