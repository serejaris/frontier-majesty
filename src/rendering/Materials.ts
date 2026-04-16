import * as THREE from 'three';

/**
 * Cached toon + flat materials for low-poly rendering.
 *
 * Toon uses a 3-step gradient ramp generated once as a tiny DataTexture —
 * this gives the hard-banded cel shading look without per-material cost.
 * Lambert fallback is available for decorative/background meshes.
 */

interface MatOpts {
  opacity?: number;
  emissive?: number;
}

const toonCache = new Map<string, THREE.MeshToonMaterial>();
const flatCache = new Map<string, THREE.MeshLambertMaterial>();

let cachedGradient: THREE.DataTexture | null = null;

function getGradientMap(): THREE.DataTexture {
  if (cachedGradient) return cachedGradient;
  // 3-step ramp: shadow, mid, light.
  const data = new Uint8Array([80, 160, 255]);
  const tex = new THREE.DataTexture(data, 3, 1, THREE.RedFormat, THREE.UnsignedByteType);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  cachedGradient = tex;
  return tex;
}

function keyFor(color: number, opts?: MatOpts): string {
  const opacity = opts?.opacity ?? 1;
  const emissive = opts?.emissive ?? 0;
  return `${color.toString(16)}|${opacity}|${emissive.toString(16)}`;
}

/**
 * Cached MeshToonMaterial — cel-shaded primary material for units/buildings.
 */
export function toonMat(color: number, opts?: MatOpts): THREE.MeshToonMaterial {
  const key = keyFor(color, opts);
  const existing = toonCache.get(key);
  if (existing) return existing;

  const opacity = opts?.opacity ?? 1;
  const emissive = opts?.emissive ?? 0;
  const mat = new THREE.MeshToonMaterial({
    color,
    gradientMap: getGradientMap(),
    transparent: opacity < 1,
    opacity,
    emissive,
  });
  toonCache.set(key, mat);
  return mat;
}

/**
 * Cached MeshLambertMaterial — cheaper flat shading fallback for props/ground.
 */
export function flatMat(color: number, opts?: MatOpts): THREE.MeshLambertMaterial {
  const key = keyFor(color, opts);
  const existing = flatCache.get(key);
  if (existing) return existing;

  const opacity = opts?.opacity ?? 1;
  const emissive = opts?.emissive ?? 0;
  const mat = new THREE.MeshLambertMaterial({
    color,
    transparent: opacity < 1,
    opacity,
    emissive,
  });
  flatCache.set(key, mat);
  return mat;
}

/** Test/utility — clears material caches (mostly for hot-reload scenarios). */
export function __resetMaterialCaches(): void {
  toonCache.forEach((m) => m.dispose());
  flatCache.forEach((m) => m.dispose());
  toonCache.clear();
  flatCache.clear();
  if (cachedGradient) {
    cachedGradient.dispose();
    cachedGradient = null;
  }
}
