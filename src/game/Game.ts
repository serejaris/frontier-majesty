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
import { HUD } from '../ui/HUD.ts';
import { BuildMenu } from '../ui/BuildMenu.ts';
import { PerkPicker } from '../ui/PerkPicker.ts';
import { ECONOMY } from '../config/Tuning.ts';
import type { Building, BuildingKind } from '../entities/Building.ts';
import { Barracks } from '../entities/Barracks.ts';
import { Market } from '../entities/Market.ts';
import { Blacksmith } from '../entities/Blacksmith.ts';
import type { BuildingSlot } from '../entities/BuildingSlot.ts';

export interface HudBinding {
  fps: HTMLElement;
  camera: HTMLElement;
  seed: HTMLElement;
  gold: HTMLElement;
  perks: HTMLElement;
}

export interface GameBindings {
  hud: HudBinding;
  uiRoot: HTMLElement;
}

const BUILDING_COSTS: Record<BuildingKind, number> = {
  barracks: ECONOMY.barracksCost,
  market: ECONOMY.marketCost,
  blacksmith: ECONOMY.blacksmithCost,
};

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

  private readonly hudView: HUD;
  private readonly buildMenu: BuildMenu;
  private pendingKind: BuildingKind | null = null;
  private readonly slotDefaults = new WeakMap<
    THREE.Mesh,
    { scaleX: number; scaleZ: number; opacity: number }
  >();
  private buildingIdCounter = 0;

  private readonly perkPicker: PerkPicker;
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

  constructor(host: HTMLElement, bindings: GameBindings, seed?: number) {
    this.host = host;
    this.hud = bindings.hud;

    const bundle = createRenderer(host);
    this.scene = bundle.scene;
    this.renderer = bundle.renderer;
    this.canvas = bundle.canvas;
    this.disposeRenderer = bundle.dispose;

    addLighting(this.scene);
    this.scene.add(createGround());
    this.scene.add(createMapGrid());

    const useSeed = seed ?? randomSeed();
    const map = generateMap(useSeed);
    this.state = new GameState(useSeed, map);
    this.world = new World(map);
    this.scene.add(this.world.root);
    this.pathfinder = new Pathfinder(this.world.navGrid);

    this.hudView = new HUD(this.hud.gold);
    this.buildMenu = new BuildMenu(bindings.uiRoot);
    this.buildMenu.onSelect = (kind) => this.beginPlacement(kind);
    this.buildMenu.onCancel = () => this.cancelPlacement();

    this.perkRng = createRng((useSeed ^ 0xbeefcafe) >>> 0);
    this.perkPicker = new PerkPicker();

    const aspect = host.clientWidth / host.clientHeight;
    this.cam = new StrategicCamera(aspect);
    this.cam.panTo(map.capital.x, map.capital.z);
    this.input = new CameraInput(this.canvas, this.cam);

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
      if (dx * dx + dy * dy > 4 * 4) return;
      const hit = pickAt(e.clientX, e.clientY, this.canvas, this.cam.camera, this.world.root);
      if (this.pendingKind !== null) {
        this.handleBuildPick(hit);
        return;
      }
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
    this.buildMenu.dispose();
    for (const b of this.state.buildings) b.dispose();
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
    this.hudView.update(this.state.treasury.gold);
    this.buildMenu.setGold(this.state.treasury.gold);
    this.updateHud(frameDt);
  }

  private update(dt: number): void {
    this.state.treasury.tick(dt);
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

  // ---------- Placement flow (M3) ----------

  private beginPlacement(kind: BuildingKind): void {
    if (this.state.treasury.gold < BUILDING_COSTS[kind]) return;
    this.pendingKind = kind;
    this.highlightFreeSlots(true);
  }

  private cancelPlacement(): void {
    if (this.pendingKind === null) return;
    this.pendingKind = null;
    this.highlightFreeSlots(false);
  }

  private handleBuildPick(hit: ReturnType<typeof pickAt>): void {
    if (!hit || hit.type !== 'slot' || this.pendingKind === null) return;
    const kind = this.pendingKind;
    const slot = this.state.slots.find((s) => s.id === hit.id);
    if (!slot || slot.occupied) return;
    const cost = BUILDING_COSTS[kind];
    if (!this.state.treasury.spend(cost)) return;

    const building = this.instantiateBuilding(kind, slot);
    slot.occupied = true;
    slot.building = building;
    this.state.buildings.push(building);
    this.world.root.add(building.mesh);
    this.hideSlotMarker(slot);

    this.pendingKind = null;
    this.highlightFreeSlots(false);
  }

  private instantiateBuilding(kind: BuildingKind, slot: BuildingSlot): Building {
    this.buildingIdCounter += 1;
    const id = `${kind}-${this.buildingIdCounter}`;
    const position = { x: slot.x, z: slot.z };
    switch (kind) {
      case 'barracks':
        return new Barracks(id, slot.id, position);
      case 'market':
        return new Market(id, slot.id, position);
      case 'blacksmith':
        return new Blacksmith(id, slot.id, position);
    }
  }

  private highlightFreeSlots(active: boolean): void {
    const slotsGroup = this.world.root.getObjectByName('slots');
    if (!slotsGroup) return;
    const occupied = new Set(this.state.slots.filter((s) => s.occupied).map((s) => s.id));
    for (const child of slotsGroup.children) {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) continue;
      const ud = mesh.userData as { type?: string; id?: string };
      if (ud.type !== 'slot' || !ud.id) continue;
      if (occupied.has(ud.id)) continue;

      let defaults = this.slotDefaults.get(mesh);
      if (!defaults) {
        const baseMat = mesh.material as THREE.MeshBasicMaterial;
        defaults = {
          scaleX: mesh.scale.x,
          scaleZ: mesh.scale.z,
          opacity: baseMat.opacity,
        };
        this.slotDefaults.set(mesh, defaults);
      }

      if (active) {
        mesh.scale.x = defaults.scaleX * 1.3;
        mesh.scale.z = defaults.scaleZ * 1.3;
        if (!(mesh.material as { __m3HighlightClone?: boolean }).__m3HighlightClone) {
          const cloned = (mesh.material as THREE.MeshBasicMaterial).clone();
          (cloned as { __m3HighlightClone?: boolean }).__m3HighlightClone = true;
          mesh.material = cloned;
        }
        (mesh.material as THREE.MeshBasicMaterial).opacity = Math.min(1, defaults.opacity + 0.4);
      } else {
        mesh.scale.x = defaults.scaleX;
        mesh.scale.z = defaults.scaleZ;
        const mat = mesh.material as THREE.MeshBasicMaterial & { __m3HighlightClone?: boolean };
        if (mat.__m3HighlightClone) {
          mat.opacity = defaults.opacity;
        }
      }
    }
  }

  private hideSlotMarker(slot: BuildingSlot): void {
    const slotsGroup = this.world.root.getObjectByName('slots');
    if (!slotsGroup) return;
    for (const child of slotsGroup.children) {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) continue;
      const ud = mesh.userData as { type?: string; id?: string };
      if (ud.type !== 'slot' || ud.id !== slot.id) continue;
      mesh.visible = false;
      return;
    }
  }

  // ---------- Perks (M7) ----------

  private refreshPerkHud(): void {
    const pm = this.state.perks;
    this.hud.perks.textContent = `${pm.chosen.length}/${pm.maxPerks}`;
  }

  private async triggerPerkPick(): Promise<void> {
    if (this.perkPicking) return;
    const perks = this.state.perks;
    if (!perks.canOffer()) return;

    this.perkPicking = true;
    const wasRunning = this.running;
    this.running = false;

    try {
      const offer = perks.offer(this.perkRng);
      const picked = await this.perkPicker.show(offer);
      perks.choose(picked.id);
      this.refreshPerkHud();
    } finally {
      this.perkPicking = false;
      if (wasRunning) {
        this.clock.reset();
        this.running = true;
        this.rafId = requestAnimationFrame(this.scheduleFrame);
      }
    }
  }

  // ---------- Debug A* path ----------

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
