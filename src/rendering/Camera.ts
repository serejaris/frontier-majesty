import * as THREE from 'three';
import { CAMERA, MAP } from '../config/Tuning.ts';

/**
 * Strategic camera: fixed pitch, orthographic, pan-only.
 * Target point slides across the XZ ground plane.
 */
export class StrategicCamera {
  readonly camera: THREE.OrthographicCamera;
  readonly target = new THREE.Vector3(0, 0, 0);

  private readonly offset: THREE.Vector3;

  constructor(aspect: number) {
    const pitch = THREE.MathUtils.degToRad(CAMERA.pitchDeg);
    const height = CAMERA.heightAbove;
    const horizontal = height / Math.tan(pitch);
    this.offset = new THREE.Vector3(0, height, horizontal);

    const halfW = CAMERA.orthoZoomWidth * 0.5;
    const halfH = halfW / aspect;
    this.camera = new THREE.OrthographicCamera(-halfW, halfW, halfH, -halfH, 1, 6000);
    this.apply();
  }

  resize(aspect: number): void {
    const halfW = CAMERA.orthoZoomWidth * 0.5;
    const halfH = halfW / aspect;
    this.camera.left = -halfW;
    this.camera.right = halfW;
    this.camera.top = halfH;
    this.camera.bottom = -halfH;
    this.camera.updateProjectionMatrix();
  }

  panBy(dx: number, dz: number): void {
    this.target.x += dx;
    this.target.z += dz;
    this.clampTargetToMap();
    this.apply();
  }

  panTo(x: number, z: number): void {
    this.target.set(x, 0, z);
    this.clampTargetToMap();
    this.apply();
  }

  private clampTargetToMap(): void {
    const halfW = MAP.width * 0.5;
    const halfH = MAP.height * 0.5;
    if (this.target.x < -halfW) this.target.x = -halfW;
    if (this.target.x > halfW) this.target.x = halfW;
    if (this.target.z < -halfH) this.target.z = -halfH;
    if (this.target.z > halfH) this.target.z = halfH;
  }

  private apply(): void {
    this.camera.position.copy(this.target).add(this.offset);
    this.camera.lookAt(this.target);
  }
}
