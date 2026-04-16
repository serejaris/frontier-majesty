import * as THREE from 'three';

/**
 * Cheap blob shadows — a flat translucent disc pinned just above the ground.
 * Shared material across all blobs; per-blob geometry so radius can vary.
 *
 * PRD §18.3 prefers blob shadows over real-time shadow maps for V1.
 */

let sharedMat: THREE.MeshBasicMaterial | null = null;

function getShadowMaterial(): THREE.MeshBasicMaterial {
  if (sharedMat) return sharedMat;
  sharedMat = new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
  });
  return sharedMat;
}

/**
 * Create a blob shadow mesh of the given radius.
 * Rotated flat on XZ plane at y=0.5 (above ground, below unit feet).
 */
export function createBlobShadow(radius: number): THREE.Mesh {
  const geo = new THREE.CircleGeometry(radius, 16);
  const mesh = new THREE.Mesh(geo, getShadowMaterial());
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.5;
  mesh.renderOrder = 1;
  mesh.userData.type = 'blobShadow';
  return mesh;
}
