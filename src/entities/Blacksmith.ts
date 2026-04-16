import * as THREE from 'three';
import { Building, type BuildingPosition } from './Building.ts';

const BLACKSMITH_BODY_COLOR = 0x3b4049;
const BLACKSMITH_CHIMNEY_COLOR = 0x1b1e24;

/** Dark slate body, tall black chimney. Silhouette reads as industrial. */
export class Blacksmith extends Building {
  constructor(id: string, slotId: string, position: BuildingPosition) {
    super(id, 'blacksmith', slotId, position);

    const bodyGeo = new THREE.BoxGeometry(150, 110, 150);
    const bodyMat = new THREE.MeshLambertMaterial({ color: BLACKSMITH_BODY_COLOR });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 55;
    body.userData = { type: 'building', id };

    const chimneyGeo = new THREE.CylinderGeometry(22, 28, 140, 12);
    const chimneyMat = new THREE.MeshLambertMaterial({ color: BLACKSMITH_CHIMNEY_COLOR });
    const chimney = new THREE.Mesh(chimneyGeo, chimneyMat);
    chimney.position.set(45, 110 + 70, 45);
    chimney.userData = { type: 'building', id };

    this.mesh.add(body, chimney);
  }
}
