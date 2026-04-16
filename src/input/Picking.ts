import * as THREE from 'three';
import type { PickableType, PickableUserData } from '../world/World.ts';

export interface PickResult {
  type: PickableType;
  id: string;
  point: THREE.Vector3;
  object: THREE.Object3D;
}

const ndc = new THREE.Vector2();
const ray = new THREE.Raycaster();

/**
 * Raycast the given root against descendants whose userData has a non-empty `type`.
 * Returns the closest hit, or null. `clientX/clientY` are in canvas-client coords.
 */
export function pickAt(
  clientX: number,
  clientY: number,
  canvas: HTMLCanvasElement,
  camera: THREE.Camera,
  root: THREE.Object3D,
): PickResult | null {
  const rect = canvas.getBoundingClientRect();
  ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  ndc.y = -(((clientY - rect.top) / rect.height) * 2 - 1);
  ray.setFromCamera(ndc, camera);

  // Raycaster already does depth sorting; we simply filter hits whose object (or
  // any ancestor) carries a pickable userData. Tags live on the leaf meshes, so
  // the first hit is usually authoritative.
  const hits = ray.intersectObject(root, true);
  for (const h of hits) {
    const tagged = findTagged(h.object);
    if (tagged) {
      const ud = tagged.userData as PickableUserData;
      return {
        type: ud.type,
        id: ud.id,
        point: h.point.clone(),
        object: tagged,
      };
    }
  }
  return null;
}

function findTagged(obj: THREE.Object3D): THREE.Object3D | null {
  let cur: THREE.Object3D | null = obj;
  while (cur) {
    const ud = cur.userData as Partial<PickableUserData> | undefined;
    if (ud && typeof ud.type === 'string' && ud.type.length > 0) return cur;
    cur = cur.parent;
  }
  return null;
}
