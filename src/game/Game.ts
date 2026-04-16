import * as THREE from 'three';
import { Clock } from './Clock.ts';
import { createRenderer } from '../rendering/Renderer.ts';
import { addLighting } from '../rendering/Lighting.ts';
import { StrategicCamera } from '../rendering/Camera.ts';
import { CameraInput } from '../input/CameraInput.ts';
import { createGround, createMapGrid, createOriginMarker } from '../world/Ground.ts';

export interface HudBinding {
  fps: HTMLElement;
  camera: HTMLElement;
}

export class Game {
  private readonly host: HTMLElement;
  private readonly hud: HudBinding;
  private readonly scene: THREE.Scene;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly canvas: HTMLCanvasElement;
  private readonly cam: StrategicCamera;
  private readonly input: CameraInput;
  private readonly clock = new Clock(60);
  private readonly disposeRenderer: () => void;

  private rafId = 0;
  private running = false;
  private frameCounter = 0;
  private frameTimeAcc = 0;
  private fpsSmoothed = 0;

  constructor(host: HTMLElement, hud: HudBinding) {
    this.host = host;
    this.hud = hud;

    const bundle = createRenderer(host);
    this.scene = bundle.scene;
    this.renderer = bundle.renderer;
    this.canvas = bundle.canvas;
    this.disposeRenderer = bundle.dispose;

    addLighting(this.scene);
    this.scene.add(createGround());
    this.scene.add(createMapGrid());
    this.scene.add(createOriginMarker());

    const aspect = host.clientWidth / host.clientHeight;
    this.cam = new StrategicCamera(aspect);
    this.input = new CameraInput(this.canvas, this.cam);

    window.addEventListener('resize', this.onResize);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.clock.reset();
    const frame = () => {
      if (!this.running) return;
      this.rafId = requestAnimationFrame(frame);
      this.step();
    };
    this.rafId = requestAnimationFrame(frame);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  dispose(): void {
    this.stop();
    window.removeEventListener('resize', this.onResize);
    this.input.dispose();
    this.disposeRenderer();
  }

  private step(): void {
    const frameDt = this.clock.tick((dt) => {
      this.update(dt);
    });
    this.input.update(frameDt);
    this.renderer.render(this.scene, this.cam.camera);
    this.updateHud(frameDt);
  }

  private update(_dt: number): void {
    // M1: no simulation logic yet. Systems will plug in from M2+.
  }

  private updateHud(frameDt: number): void {
    this.frameCounter += 1;
    this.frameTimeAcc += frameDt;
    if (this.frameTimeAcc >= 0.5) {
      const fps = this.frameCounter / this.frameTimeAcc;
      this.fpsSmoothed = this.fpsSmoothed === 0 ? fps : this.fpsSmoothed * 0.5 + fps * 0.5;
      this.hud.fps.textContent = this.fpsSmoothed.toFixed(0);
      this.frameCounter = 0;
      this.frameTimeAcc = 0;
    }
    const t = this.cam.target;
    this.hud.camera.textContent = `${t.x.toFixed(0)}, ${t.z.toFixed(0)}`;
  }

  private readonly onResize = (): void => {
    this.renderer.setSize(this.host.clientWidth, this.host.clientHeight, false);
    this.cam.resize(this.host.clientWidth / this.host.clientHeight);
  };
}
