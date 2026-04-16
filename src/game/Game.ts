import * as THREE from 'three';
import { Clock } from './Clock.ts';
import { GameState } from './GameState.ts';
import { createRenderer } from '../rendering/Renderer.ts';
import { addLighting } from '../rendering/Lighting.ts';
import { StrategicCamera } from '../rendering/Camera.ts';
import { CameraInput } from '../input/CameraInput.ts';
import { pickAt } from '../input/Picking.ts';
import { createGround, createMapGrid } from '../world/Ground.ts';
import { World } from '../world/World.ts';
import { farthestNest, generateMap } from '../world/MapGenerator.ts';
import { Pathfinder } from '../world/Pathfinder.ts';
import { createRng, randomSeed, type Rng } from '../util/Random.ts';
import { PerkPicker } from '../ui/PerkPicker.ts';

export interface HudBinding {
  fps: HTMLElement;
  camera: HTMLElement;
  seed: HTMLElement;
  perks: HTMLElement;
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

  private readonly state: GameState;
  private readonly world: World;
  private readonly pathfinder: Pathfinder;

  private readonly perkPicker: PerkPicker;
  // Perk RNG derived from the world seed so the sequence is reproducible.
  // M8 will replace the `K` demo hotkey with a real on-nest-destroyed trigger.
  private readonly perkRng: Rng;
  private perkPicking = false;

  private rafId = 0;
  private running = false;
  private frameCounter = 0;
  private frameTimeAcc = 0;
  private fpsSmoothed = 0;

  private debugPathNode: THREE.LineSegments | null = null;

  private readonly onPointerDownPick: (e: PointerEvent) => void;
  private readonly onPointerUpPick: (e: PointerEvent) => void;
  private readonly onKeyDownDebug: (e: KeyboardEvent) => void;
  private pointerDownX = 0;
  private pointerDownY = 0;
  private pointerDownButton = -1;

  constructor(host: HTMLElement, hud: HudBinding, seed?: number) {
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

    // --- World ---
    const useSeed = seed ?? randomSeed();
    const map = generateMap(useSeed);
    this.state = new GameState(useSeed, map);
    this.world = new World(map);
    this.scene.add(this.world.root);
    this.pathfinder = new Pathfinder(this.world.navGrid);

    // Offset perk RNG stream from world gen so generation isn't affected.
    this.perkRng = createRng((useSeed ^ 0xbeefcafe) >>> 0);

    // --- Camera ---
    const aspect = host.clientWidth / host.clientHeight;
    this.cam = new StrategicCamera(aspect);
    this.cam.panTo(map.capital.x, map.capital.z);
    this.input = new CameraInput(this.canvas, this.cam);

    // --- Perk picker (M7). Real trigger lands in M8 on-nest-destroyed. ---
    this.perkPicker = new PerkPicker();

    // --- Picking: track pointerdown→pointerup to ignore drags. ---
    this.onPointerDownPick = (e: PointerEvent) => {
      if (e.button !== 0) return;
      this.pointerDownX = e.clientX;
      this.pointerDownY = e.clientY;
      this.pointerDownButton = e.button;
    };
    this.onPointerUpPick = (e: PointerEvent) => {
      if (this.pointerDownButton !== 0 || e.button !== 0) return;
      this.pointerDownButton = -1;
      const dx = e.clientX - this.pointerDownX;
      const dy = e.clientY - this.pointerDownY;
      if (dx * dx + dy * dy > 4 * 4) return; // drag → ignore
      const hit = pickAt(e.clientX, e.clientY, this.canvas, this.cam.camera, this.world.root);
      if (hit) {
        // eslint-disable-next-line no-console
        console.log('[pick]', hit.type, hit.id, '@', hit.point.x.toFixed(1), hit.point.z.toFixed(1));
      } else {
        // eslint-disable-next-line no-console
        console.log('[pick] none');
      }
    };
    this.canvas.addEventListener('pointerdown', this.onPointerDownPick);
    this.canvas.addEventListener('pointerup', this.onPointerUpPick);

    // --- Debug hotkeys ---
    //   P = toggle A* visualisation capital → farthest nest.
    //   K = M7 demo: pause sim, offer 3 perks, apply chosen. M8 replaces this
    //       with the real "on nest destroyed" event.
    this.onKeyDownDebug = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === 'p') {
        this.toggleDebugPath();
        return;
      }
      if (k === 'k') {
        void this.triggerPerkPick();
        return;
      }
    };
    window.addEventListener('keydown', this.onKeyDownDebug);

    window.addEventListener('resize', this.onResize);

    // HUD chips.
    this.hud.seed.textContent = String(this.state.seed);
    this.refreshPerkHud();
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.clock.reset();
    this.scheduleFrame();
  }

  private scheduleFrame = (): void => {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(this.scheduleFrame);
    this.step();
  };

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  dispose(): void {
    this.stop();
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('keydown', this.onKeyDownDebug);
    this.canvas.removeEventListener('pointerdown', this.onPointerDownPick);
    this.canvas.removeEventListener('pointerup', this.onPointerUpPick);
    this.input.dispose();
    this.world.dispose();
    this.perkPicker.dispose();
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
    // M2: no simulation logic yet.
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

  private refreshPerkHud(): void {
    const pm = this.state.perks;
    this.hud.perks.textContent = `${pm.chosen.length}/${pm.maxPerks}`;
  }

  /**
   * Demo flow: pause the game loop, show picker, apply chosen perk.
   * Reentry-guarded via `perkPicking`. M8 replaces the `K` hotkey entry
   * point with a real on-nest-destroyed trigger but keeps this same flow.
   */
  private async triggerPerkPick(): Promise<void> {
    if (this.perkPicking) return;
    const perks = this.state.perks;
    if (!perks.canOffer()) return;

    this.perkPicking = true;
    const wasRunning = this.running;
    // Pause the main loop while modal is shown.
    this.running = false;

    try {
      const offer = perks.offer(this.perkRng);
      const picked = await this.perkPicker.show(offer);
      perks.choose(picked.id);
      this.refreshPerkHud();
    } finally {
      this.perkPicking = false;
      if (wasRunning) {
        // Reset clock so the pause doesn't produce a huge dt spike.
        this.clock.reset();
        this.running = true;
        this.rafId = requestAnimationFrame(this.scheduleFrame);
      }
    }
  }

  private toggleDebugPath(): void {
    if (this.debugPathNode) {
      this.scene.remove(this.debugPathNode);
      this.debugPathNode.geometry.dispose();
      (this.debugPathNode.material as THREE.Material).dispose();
      this.debugPathNode = null;
      return;
    }
    const farNest = farthestNest(this.state.map);
    const path = this.pathfinder.find(
      this.state.map.capital.x,
      this.state.map.capital.z,
      farNest.x,
      farNest.z,
    );
    if (!path || path.world.length < 2) {
      // eslint-disable-next-line no-console
      console.warn('[debug] no A* path found capital → far nest');
      return;
    }
    const positions: number[] = [];
    for (let i = 0; i < path.world.length - 1; i++) {
      const a = path.world[i]!;
      const b = path.world[i + 1]!;
      positions.push(a.x, 5, a.z, b.x, 5, b.z);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const mat = new THREE.LineBasicMaterial({ color: 0xffe28a });
    const lines = new THREE.LineSegments(geo, mat);
    lines.name = 'debug-astar-path';
    this.scene.add(lines);
    this.debugPathNode = lines;
  }

  private readonly onResize = (): void => {
    this.renderer.setSize(this.host.clientWidth, this.host.clientHeight, false);
    this.cam.resize(this.host.clientWidth / this.host.clientHeight);
  };
}
