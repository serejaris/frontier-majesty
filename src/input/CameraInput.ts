import * as THREE from 'three';
import { CAMERA } from '../config/Tuning.ts';
import type { StrategicCamera } from '../rendering/Camera.ts';

type Keys = { w: boolean; a: boolean; s: boolean; d: boolean };

export class CameraInput {
  private readonly keys: Keys = { w: false, a: false, s: false, d: false };
  private pointerIn = false;
  private pointerX = 0;
  private pointerY = 0;
  private dragging = false;
  private lastDragX = 0;
  private lastDragY = 0;

  private readonly onKeyDown: (e: KeyboardEvent) => void;
  private readonly onKeyUp: (e: KeyboardEvent) => void;
  private readonly onPointerMove: (e: PointerEvent) => void;
  private readonly onPointerDown: (e: PointerEvent) => void;
  private readonly onPointerUp: (e: PointerEvent) => void;
  private readonly onPointerLeave: () => void;
  private readonly onContextMenu: (e: Event) => void;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly camera: StrategicCamera,
  ) {
    this.onKeyDown = (e: KeyboardEvent) => this.setKey(e.key, true);
    this.onKeyUp = (e: KeyboardEvent) => this.setKey(e.key, false);
    this.onPointerMove = (e: PointerEvent) => {
      this.pointerIn = true;
      this.pointerX = e.clientX;
      this.pointerY = e.clientY;
      if (this.dragging) {
        const dx = e.clientX - this.lastDragX;
        const dy = e.clientY - this.lastDragY;
        this.lastDragX = e.clientX;
        this.lastDragY = e.clientY;
        this.camera.panBy(-dx * CAMERA.dragSpeed, -dy * CAMERA.dragSpeed);
      }
    };
    this.onPointerDown = (e: PointerEvent) => {
      if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
        this.dragging = true;
        this.lastDragX = e.clientX;
        this.lastDragY = e.clientY;
        this.canvas.setPointerCapture(e.pointerId);
        e.preventDefault();
      }
    };
    this.onPointerUp = (e: PointerEvent) => {
      if (this.dragging && (e.button === 1 || e.button === 0)) {
        this.dragging = false;
        if (this.canvas.hasPointerCapture(e.pointerId)) {
          this.canvas.releasePointerCapture(e.pointerId);
        }
      }
    };
    this.onPointerLeave = () => {
      this.pointerIn = false;
    };
    this.onContextMenu = (e: Event) => e.preventDefault();

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('pointerleave', this.onPointerLeave);
    canvas.addEventListener('contextmenu', this.onContextMenu);
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('pointerup', this.onPointerUp);
    this.canvas.removeEventListener('pointerleave', this.onPointerLeave);
    this.canvas.removeEventListener('contextmenu', this.onContextMenu);
  }

  update(dt: number): void {
    const dir = new THREE.Vector2(0, 0);
    if (this.keys.w) dir.y -= 1;
    if (this.keys.s) dir.y += 1;
    if (this.keys.a) dir.x -= 1;
    if (this.keys.d) dir.x += 1;
    if (dir.lengthSq() > 0) {
      dir.normalize().multiplyScalar(CAMERA.panSpeed * dt);
      this.camera.panBy(dir.x, dir.y);
    }
    if (this.pointerIn && !this.dragging) {
      this.applyEdgePan(dt);
    }
  }

  private applyEdgePan(dt: number): void {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    const margin = CAMERA.edgePanMargin;
    let ex = 0;
    let ez = 0;
    if (this.pointerX <= margin) ex -= 1;
    else if (this.pointerX >= w - margin) ex += 1;
    if (this.pointerY <= margin) ez -= 1;
    else if (this.pointerY >= h - margin) ez += 1;
    if (ex !== 0 || ez !== 0) {
      const speed = CAMERA.edgePanSpeed * dt;
      this.camera.panBy(ex * speed, ez * speed);
    }
  }

  private setKey(key: string, value: boolean): void {
    const lower = key.toLowerCase();
    if (lower === 'w' || lower === 'arrowup') this.keys.w = value;
    else if (lower === 'a' || lower === 'arrowleft') this.keys.a = value;
    else if (lower === 's' || lower === 'arrowdown') this.keys.s = value;
    else if (lower === 'd' || lower === 'arrowright') this.keys.d = value;
  }
}
