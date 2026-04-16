import * as THREE from 'three';

export type BuildingKind = 'barracks' | 'market' | 'blacksmith';

export interface BuildingPosition {
  x: number;
  z: number;
}

/**
 * Base class for all placed buildings. Subclasses build a THREE.Group mesh
 * in their constructor (placeholder BoxGeometry + MeshLambertMaterial). The
 * M9 visual library will replace these meshes without changing callers.
 */
export abstract class Building {
  readonly id: string;
  readonly kind: BuildingKind;
  readonly slotId: string;
  readonly position: BuildingPosition;
  readonly mesh: THREE.Group;

  protected constructor(id: string, kind: BuildingKind, slotId: string, position: BuildingPosition) {
    this.id = id;
    this.kind = kind;
    this.slotId = slotId;
    this.position = { x: position.x, z: position.z };
    this.mesh = new THREE.Group();
    this.mesh.name = `building:${kind}:${id}`;
    this.mesh.position.set(position.x, 0, position.z);
    this.mesh.userData = { type: 'building', id };
  }

  dispose(): void {
    this.mesh.traverse((obj) => {
      const asMesh = obj as THREE.Mesh;
      if (asMesh.isMesh) {
        asMesh.geometry.dispose();
        const m = asMesh.material;
        if (Array.isArray(m)) m.forEach((mm) => mm.dispose());
        else m.dispose();
      }
    });
  }
}
