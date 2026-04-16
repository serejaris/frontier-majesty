/**
 * Public API for the M9 visual library.
 *
 * Consumers should import from here rather than individual modules so we can
 * later swap procedural silhouettes for glTF-backed factories without a ripple.
 */

export { PALETTE, type PaletteKey } from './Palette.ts';
export { toonMat, flatMat } from './Materials.ts';
export { createBlobShadow } from './BlobShadows.ts';
export { InstancedPool } from './Instancing.ts';

export {
  createCapitalMesh,
  createBuildSlotMesh,
  createBarracksMesh,
  createMarketMesh,
  createBlacksmithMesh,
  createObstacleMesh,
  createNestMesh,
  createWarriorMesh,
  createArcherMesh,
  createMonsterMesh,
  type BuildSlotMesh,
} from './Silhouettes.ts';
