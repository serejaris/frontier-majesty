import * as THREE from 'three';
import { Building, type BuildingPosition } from './Building.ts';

const BARRACKS_BODY_COLOR = 0x6f4b2a;
const BARRACKS_ROOF_COLOR = 0xb84a3a;

/** Warm brown body, red pyramid roof. Reads as a martial structure. */
export class Barracks extends Building {
  constructor(id: string, slotId: string, position: BuildingPosition) {
    super(id, 'barracks', slotId, position);

    const bodyGeo = new THREE.BoxGeometry(160, 100, 160);
    const bodyMat = new THREE.MeshLambertMaterial({ color: BARRACKS_BODY_COLOR });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 50;
    body.userData = { type: 'building', id };

    // Pyramid roof as a 4-sided cone (cylinder with radiusTop=0).
    const roofGeo = new THREE.ConeGeometry(120, 80, 4);
    const roofMat = new THREE.MeshLambertMaterial({ color: BARRACKS_ROOF_COLOR });
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.rotation.y = Math.PI / 4;
    roof.position.y = 100 + 40;
    roof.userData = { type: 'building', id };

    this.mesh.add(body, roof);
  }
}
