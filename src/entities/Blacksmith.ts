import { Building, type BuildingPosition, tagChildrenAsBuilding } from './Building.ts';
import { createBlacksmithMesh } from '../rendering/Silhouettes.ts';

/** Blacksmith — M6 swaps to M9 silhouette (box + tall chimney + anvil hint). */
export class Blacksmith extends Building {
  constructor(id: string, slotId: string, position: BuildingPosition) {
    super(id, 'blacksmith', slotId, position);
    const silhouette = createBlacksmithMesh();
    this.mesh.add(silhouette);
    tagChildrenAsBuilding(this.mesh, id);
  }
}
