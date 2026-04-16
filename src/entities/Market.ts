import * as THREE from 'three';
import { Building, type BuildingPosition } from './Building.ts';

const MARKET_BODY_COLOR = 0xd9a23e;
const MARKET_CANOPY_COLOR = 0x3d8a58;

/** Golden body, green flat triangular canopy above. High-contrast against barracks. */
export class Market extends Building {
  constructor(id: string, slotId: string, position: BuildingPosition) {
    super(id, 'market', slotId, position);

    const bodyGeo = new THREE.BoxGeometry(140, 80, 140);
    const bodyMat = new THREE.MeshLambertMaterial({ color: MARKET_BODY_COLOR });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 40;
    body.userData = { type: 'building', id };

    // Flat triangular canopy: a thin 3-sided prism sitting on the body.
    const canopyGeo = new THREE.CylinderGeometry(110, 110, 16, 3);
    const canopyMat = new THREE.MeshLambertMaterial({ color: MARKET_CANOPY_COLOR });
    const canopy = new THREE.Mesh(canopyGeo, canopyMat);
    canopy.rotation.y = Math.PI / 6;
    canopy.position.y = 80 + 12;
    canopy.userData = { type: 'building', id };

    this.mesh.add(body, canopy);
  }
}
