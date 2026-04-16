import { Building, type BuildingPosition, tagChildrenAsBuilding } from './Building.ts';
import { createBarracksMesh } from '../rendering/Silhouettes.ts';

/**
 * Barracks — M6 wires the M9 compound silhouette factory. The outer `mesh`
 * Group provided by Building still owns the `position` and `userData` tag;
 * we nest the silhouette group beneath it and propagate the pickable tag to
 * each leaf so raycasts on sub-meshes still resolve back to this building.
 */
export class Barracks extends Building {
  constructor(id: string, slotId: string, position: BuildingPosition) {
    super(id, 'barracks', slotId, position);
    const silhouette = createBarracksMesh();
    this.mesh.add(silhouette);
    tagChildrenAsBuilding(this.mesh, id);
  }
}
