import { Building, type BuildingPosition, tagChildrenAsBuilding } from './Building.ts';
import { createMarketMesh } from '../rendering/Silhouettes.ts';

/** Market — M6 swaps to M9 silhouette (wide base, triangular canopy, crates). */
export class Market extends Building {
  constructor(id: string, slotId: string, position: BuildingPosition) {
    super(id, 'market', slotId, position);
    const silhouette = createMarketMesh();
    this.mesh.add(silhouette);
    tagChildrenAsBuilding(this.mesh, id);
  }
}
