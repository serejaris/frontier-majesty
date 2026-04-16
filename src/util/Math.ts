// Math helpers kept intentionally lean; add more as subsequent milestones need them.

export interface Vec2 {
  x: number;
  y: number;
}

export interface Rect {
  /** Min corner (inclusive) in world units. */
  minX: number;
  minZ: number;
  /** Max corner (exclusive) in world units. */
  maxX: number;
  maxZ: number;
}

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function distance2d(ax: number, az: number, bx: number, bz: number): number {
  const dx = ax - bx;
  const dz = az - bz;
  return Math.sqrt(dx * dx + dz * dz);
}

export function distanceSq2d(ax: number, az: number, bx: number, bz: number): number {
  const dx = ax - bx;
  const dz = az - bz;
  return dx * dx + dz * dz;
}

/** Wrap angle into [-PI, PI]. */
export function wrapAngle(a: number): number {
  let r = a;
  while (r > Math.PI) r -= Math.PI * 2;
  while (r < -Math.PI) r += Math.PI * 2;
  return r;
}

/** Absolute signed angular difference in radians, in [0, PI]. */
export function angularDelta(a: number, b: number): number {
  return Math.abs(wrapAngle(a - b));
}

export function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.minX < b.maxX && a.maxX > b.minX && a.minZ < b.maxZ && a.maxZ > b.minZ;
}

export function rectArea(r: Rect): number {
  return Math.max(0, r.maxX - r.minX) * Math.max(0, r.maxZ - r.minZ);
}

export function rectContainsPoint(r: Rect, x: number, z: number): boolean {
  return x >= r.minX && x < r.maxX && z >= r.minZ && z < r.maxZ;
}

/** Minimum distance from point (x,z) to an axis-aligned rect (0 if inside). */
export function pointRectDistance(r: Rect, x: number, z: number): number {
  const cx = clamp(x, r.minX, r.maxX);
  const cz = clamp(z, r.minZ, r.maxZ);
  const dx = x - cx;
  const dz = z - cz;
  return Math.sqrt(dx * dx + dz * dz);
}
