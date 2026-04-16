import * as THREE from 'three';
import { MAP, WORLD } from '../config/Tuning.ts';

export function createGround(): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(MAP.width, MAP.height, 1, 1);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshLambertMaterial({ color: WORLD.groundColor });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = false;
  mesh.name = 'ground';
  return mesh;
}

export function createMapGrid(): THREE.LineSegments {
  const half = new THREE.Vector2(MAP.width * 0.5, MAP.height * 0.5);
  const step = MAP.cellSize * 5;
  const positions: number[] = [];
  for (let x = -half.x; x <= half.x; x += step) {
    positions.push(x, 0.3, -half.y, x, 0.3, half.y);
  }
  for (let z = -half.y; z <= half.y; z += step) {
    positions.push(-half.x, 0.3, z, half.x, 0.3, z);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const mat = new THREE.LineBasicMaterial({ color: 0x3a5a2a, transparent: true, opacity: 0.35 });
  const lines = new THREE.LineSegments(geo, mat);
  lines.name = 'mapGrid';
  return lines;
}

export function createOriginMarker(): THREE.Mesh {
  const geo = new THREE.CylinderGeometry(24, 24, 4, 24);
  const mat = new THREE.MeshLambertMaterial({ color: 0xffcc66 });
  const m = new THREE.Mesh(geo, mat);
  m.position.set(0, 2, 0);
  m.name = 'originMarker';
  return m;
}
