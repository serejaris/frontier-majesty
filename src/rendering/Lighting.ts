import * as THREE from 'three';

export function addLighting(scene: THREE.Scene): void {
  const ambient = new THREE.HemisphereLight(0xffffff, 0x3a4a2e, 0.55);
  scene.add(ambient);

  const sun = new THREE.DirectionalLight(0xfff2cf, 0.85);
  sun.position.set(-600, 1200, 400);
  sun.target.position.set(0, 0, 0);
  scene.add(sun);
  scene.add(sun.target);
}
