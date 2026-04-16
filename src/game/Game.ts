import * as THREE from 'three';
import { Clock } from './Clock.ts';
import { GameState } from './GameState.ts';
import { PauseController } from './PauseController.ts';
import { createRenderer } from '../rendering/Renderer.ts';
import { addLighting } from '../rendering/Lighting.ts';
import { StrategicCamera } from '../rendering/Camera.ts';
import { HealthBars } from '../rendering/HealthBars.ts';
import { StatusIcons } from '../rendering/StatusIcons.ts';
import { HitFlash } from '../rendering/HitFlash.ts';
import { HeroCard } from '../ui/HeroCard.ts';
import { EndScreen } from '../ui/EndScreen.ts';
import { CameraInput } from '../input/CameraInput.ts';
import { pickAt } from '../input/Picking.ts';
import { createGround, createMapGrid } from '../world/Ground.ts';
import { World } from '../world/World.ts';
import { farthestNest, generateMap } from '../world/MapGenerator.ts';
import { Pathfinder } from '../world/Pathfinder.ts';
import { randomSeed } from '../util/Random.ts';

export interface HudBinding {
  fps: HTMLElement;
  camera: HTMLElement;
  seed: HTMLElement;
}

export interface GameUi {
  heroCard: HeroCard;
  endScreen: EndScreen;
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

  private readonly pause: PauseController;
  private readonly worldOverlay: HTMLElement;
  private readonly healthBars: HealthBars;
  private readonly statusIcons: StatusIcons;
  private readonly hitFlash: HitFlash;
  readonly ui: GameUi;

  private rafId = 0;
  private running = false;
  private frameCounter = 0;
  private frameTimeAcc = 0;
  private fpsSmoothed = 0;

  private debugPathNode: THREE.LineSegments | null = null;

  // Demo state for M8 hotkeys (H/L/U) — replaced by real wiring in M4/M8-proper.
  private demoHpVisible = true;
  private readonly demoHpState = { hp: 37, max: 120 };

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

    // --- Camera ---
    const aspect = host.clientWidth / host.clientHeight;
    this.cam = new StrategicCamera(aspect);
    this.cam.panTo(map.capital.x, map.capital.z);
    this.input = new CameraInput(this.canvas, this.cam);

    // --- M8 UX infra ---
    this.pause = new PauseController();
    this.worldOverlay = ensureWorldOverlay();
    this.healthBars = new HealthBars(this.worldOverlay);
    this.statusIcons = new StatusIcons(this.worldOverlay);
    this.hitFlash = new HitFlash();
    this.ui = {
      heroCard: new HeroCard(),
      endScreen: new EndScreen(() => {
        // M8-proper will wire a real restart; for now, just dismiss.
        this.ui.endScreen.hide();
      }),
    };

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

    // --- Debug + demo hotkeys. ---
    this.onKeyDownDebug = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      const key = e.key.toLowerCase();
      if (key === 'p') {
        this.toggleDebugPath();
      } else if (key === 'h') {
        this.toggleDemoHeroCard();
      } else if (key === 'l') {
        this.toggleDemoHpBar();
      } else if (key === 'u') {
        this.ui.endScreen.show({
          outcome: 'victory',
          seed: this.state.seed,
          durationSec: 630,
          perks: ['Royal Tax'],
          heroesAlive: 3,
          nestsDestroyed: 5,
        });
      }
    };
    window.addEventListener('keydown', this.onKeyDownDebug);

    window.addEventListener('resize', this.onResize);

    // HUD seed chip.
    this.hud.seed.textContent = String(this.state.seed);
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
    window.removeEventListener('keydown', this.onKeyDownDebug);
    this.canvas.removeEventListener('pointerdown', this.onPointerDownPick);
    this.canvas.removeEventListener('pointerup', this.onPointerUpPick);
    this.input.dispose();
    this.world.dispose();
    this.pause.dispose();
    this.healthBars.dispose();
    this.statusIcons.dispose();
    this.hitFlash.dispose();
    this.ui.heroCard.dispose();
    this.ui.endScreen.dispose();
    this.disposeRenderer();
  }

  private step(): void {
    let frameDt: number;
    if (this.pause.isPaused()) {
      // Use raw frame dt without advancing fixed-step sim, so pan + overlays animate.
      frameDt = this.clock.tickIdle();
    } else {
      frameDt = this.clock.tick((dt) => {
        this.update(dt);
      });
    }
    // Pan works while paused.
    this.input.update(frameDt);

    // Per-render updates (hit-flash lerp, overlay projection).
    this.hitFlash.update(frameDt);
    const vp = { w: this.host.clientWidth, h: this.host.clientHeight };
    this.healthBars.update(this.cam.camera, vp);
    this.statusIcons.update(this.cam.camera, vp);

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

  private toggleDemoHeroCard(): void {
    if (this.ui.heroCard.isVisible()) {
      this.ui.heroCard.hide();
      return;
    }
    this.ui.heroCard.show({
      class: 'warrior',
      level: 3,
      hp: 74,
      maxHp: 120,
      hasPotion: true,
      weaponTier: 2,
      armorTier: 1,
      personalGold: 48,
      aiState: 'advancing',
      xp: 140,
      xpToNext: 220,
    });
  }

  private toggleDemoHpBar(): void {
    this.demoHpVisible = !this.demoHpVisible;
    const id = 'demo-hp';
    if (!this.demoHpVisible) {
      this.healthBars.remove(id);
      return;
    }
    this.healthBars.ensure(id, () => ({
      worldX: 0,
      worldZ: 200,
      hp: this.demoHpState.hp,
      maxHp: this.demoHpState.max,
      visible: true,
    }));
  }

  private readonly onResize = (): void => {
    this.renderer.setSize(this.host.clientWidth, this.host.clientHeight, false);
    this.cam.resize(this.host.clientWidth / this.host.clientHeight);
  };
}

function ensureWorldOverlay(): HTMLElement {
  const existing = document.getElementById('world-overlay');
  if (existing) return existing;
  // Fallback if index.html wasn't updated (shouldn't happen, but safe).
  const el = document.createElement('div');
  el.id = 'world-overlay';
  Object.assign(el.style, {
    position: 'fixed',
    inset: '0',
    pointerEvents: 'none',
    overflow: 'hidden',
  });
  document.body.appendChild(el);
  return el;
}
