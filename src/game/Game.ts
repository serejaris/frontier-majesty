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
import { createRng, randomSeed, type Rng } from '../util/Random.ts';
import { HUD } from '../ui/HUD.ts';
import { BuildMenu } from '../ui/BuildMenu.ts';
import { PerkPicker } from '../ui/PerkPicker.ts';
import { RecruitPanel } from '../ui/RecruitPanel.ts';
import { ECONOMY, HEROES, MONSTERS } from '../config/Tuning.ts';
import type { Building, BuildingKind } from '../entities/Building.ts';
import { Barracks } from '../entities/Barracks.ts';
import { Market } from '../entities/Market.ts';
import { Blacksmith } from '../entities/Blacksmith.ts';
import type { BuildingSlot } from '../entities/BuildingSlot.ts';
import { Hero, type HeroKind } from '../entities/Hero.ts';
import { Warrior } from '../entities/Warrior.ts';
import { Archer } from '../entities/Archer.ts';
import { Monster } from '../entities/Monster.ts';
import { Nest } from '../entities/Nest.ts';
import { CombatSystem } from '../combat/CombatSystem.ts';
import { xpToNextLevel } from '../progression/Leveling.ts';

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

export interface GameUi {
  heroCard: HeroCard;
  endScreen: EndScreen;
}

const BUILDING_COSTS: Record<BuildingKind, number> = {
  barracks: ECONOMY.barracksCost,
  market: ECONOMY.marketCost,
  blacksmith: ECONOMY.blacksmithCost,
};

const HERO_COSTS: Record<HeroKind, number> = {
  warrior: ECONOMY.warriorCost,
  archer: ECONOMY.archerCost,
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
  private readonly combatRng: Rng;

  private readonly hudView: HUD;
  private readonly buildMenu: BuildMenu;
  private pendingKind: BuildingKind | null = null;
  private readonly slotDefaults = new WeakMap<
    THREE.Mesh,
    { scaleX: number; scaleZ: number; opacity: number }
  >();
  private buildingIdCounter = 0;
  private heroIdCounter = 0;

  private readonly perkPicker: PerkPicker;
  private readonly perkRng: Rng;
  private perkPicking = false;

  private readonly pause: PauseController;
  private readonly worldOverlay: HTMLElement;
  private readonly healthBars: HealthBars;
  private readonly statusIcons: StatusIcons;
  private readonly hitFlash: HitFlash;
  readonly ui: GameUi;

  private readonly combat = new CombatSystem();
  private readonly recruitPanel: RecruitPanel;
  private recruitBarracks: Barracks | null = null;

  private rafId = 0;
  private running = false;
  private frameCounter = 0;
  private frameTimeAcc = 0;
  private fpsSmoothed = 0;

  private debugPathNode: THREE.LineSegments | null = null;

  private demoHpVisible = true;
  private readonly demoHpState = { hp: 37, max: 120 };

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
    this.combatRng = createRng((useSeed ^ 0xc0ffee) >>> 0);

    // Seed live Nest entities from the map placements — these own spawn timers.
    const nestsGroup = this.world.root.getObjectByName('nests') as THREE.Group | null;
    for (const np of map.nests) {
      const nest = new Nest(np.id, np.tier, np.x, np.z);
      // We use the pre-placed World visual for the nest, not the Nest entity's own
      // mesh — swap: replace our fresh mesh with the one already rendered. This
      // avoids double-rendering AND keeps hit-flashes (which drive on the live
      // mesh handed to CombatSystem) affecting what the player sees.
      if (nestsGroup) {
        const existing = nestsGroup.children.find(
          (c) => (c.userData as { id?: string }).id === np.id,
        );
        if (existing) {
          nestsGroup.remove(existing);
        }
      }
      (nestsGroup ?? this.world.root).add(nest.mesh);
      this.state.nests.push(nest);
    }

    this.hudView = new HUD(this.hud.gold);
    this.buildMenu = new BuildMenu(bindings.uiRoot);
    this.buildMenu.onSelect = (kind) => this.beginPlacement(kind);
    this.buildMenu.onCancel = () => this.cancelPlacement();

    this.recruitPanel = new RecruitPanel({
      mountHost: bindings.uiRoot,
      canAfford: (kind) => this.canAffordHire(kind),
      atCap: () => this.state.heroes.length >= HEROES.cap,
      hireHint: () => this.hireHintText(),
      onRecruit: (kind) => this.recruit(kind),
      onClose: () => this.closeRecruitPanel(),
    });

    this.perkRng = createRng((useSeed ^ 0xbeefcafe) >>> 0);
    this.perkPicker = new PerkPicker();

    const aspect = host.clientWidth / host.clientHeight;
    this.cam = new StrategicCamera(aspect);
    this.cam.panTo(map.capital.x, map.capital.z);
    this.input = new CameraInput(this.canvas, this.cam);

    this.pause = new PauseController();
    this.worldOverlay = ensureWorldOverlay();
    this.healthBars = new HealthBars(this.worldOverlay);
    this.statusIcons = new StatusIcons(this.worldOverlay);
    this.hitFlash = new HitFlash();
    this.ui = {
      heroCard: new HeroCard(),
      endScreen: new EndScreen(() => {
        this.ui.endScreen.hide();
      }),
    };

    // Seed nest HP bars up-front.
    for (const nest of this.state.nests) this.registerNestOverlays(nest);

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
      // Clicking a built Barracks opens the Recruit panel.
      if (hit && hit.type === 'building') {
        const bld = this.state.buildings.find((b) => b.id === hit.id);
        if (bld && bld.kind === 'barracks') {
          this.openRecruitPanel(bld as Barracks);
          return;
        }
      }
      // Clicking a hero shows the hero card.
      if (hit && hit.type === 'hero') {
        const hero = this.state.heroes.find((h) => h.id === hit.id);
        if (hero) {
          this.showHeroCard(hero);
          return;
        }
      }
      if (hit) {
        // eslint-disable-next-line no-console
        console.log('[pick]', hit.type, hit.id, '@', hit.point.x.toFixed(1), hit.point.z.toFixed(1));
      } else {
        this.closeRecruitPanel();
        // eslint-disable-next-line no-console
        console.log('[pick] none');
      }
    };
    this.canvas.addEventListener('pointerdown', this.onPointerDownPick);
    this.canvas.addEventListener('pointerup', this.onPointerUpPick);

    this.onKeyDownDebug = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      ) {
        return;
      }
      const key = e.key.toLowerCase();
      if (key === 'p') {
        this.toggleDebugPath();
      } else if (key === 'k') {
        void this.triggerPerkPick();
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
          heroesAlive: this.state.heroes.length,
          nestsDestroyed: this.state.nestsDestroyed,
        });
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
    this.recruitPanel.dispose();
    for (const b of this.state.buildings) b.dispose();
    this.world.dispose();
    this.perkPicker.dispose();
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
      frameDt = this.clock.tickIdle();
    } else {
      frameDt = this.clock.tick((dt) => {
        this.update(dt);
      });
    }
    this.input.update(frameDt);

    this.hitFlash.update(frameDt);
    const vp = { w: this.host.clientWidth, h: this.host.clientHeight };
    this.healthBars.update(this.cam.camera, vp);
    this.statusIcons.update(this.cam.camera, vp);

    this.renderer.render(this.scene, this.cam.camera);
    this.hudView.update(this.state.treasury.gold);
    this.buildMenu.setGold(this.state.treasury.gold);
    this.recruitPanel.refresh();
    this.updateHud(frameDt);
  }

  private update(dt: number): void {
    this.state.simT += dt;
    this.state.treasury.tick(dt);

    // Nest spawn timers.
    for (const nest of this.state.nests) {
      if (!nest.alive) continue;
      const worldMonsterCount = this.state.monsters.length;
      const spawned = nest.tickSpawn(this.state.simT, worldMonsterCount, this.combatRng);
      if (spawned) {
        this.registerMonster(spawned);
      }
    }

    // Monsters act.
    for (const m of this.state.monsters) {
      m.update(dt, this.state.simT, this.state.heroes, this.combatRng);
    }

    // Heroes advance (movement + regen).
    for (const h of this.state.heroes) {
      h.update(dt, this.state, this.world.navGrid, this.pathfinder, this.state.simT);
    }

    // Combat resolves: targeting, attacks, deaths, rewards.
    this.combat.tick(
      {
        simT: this.state.simT,
        heroes: this.state.heroes,
        monsters: this.state.monsters,
        nests: this.state.nests,
        perkMods: this.state.perkMods,
        hitFlash: this.hitFlash,
      },
      {
        onHeroDied: (hero) => this.onHeroDied(hero),
        onMonsterDied: (m) => this.onMonsterDied(m),
        onNestDestroyed: (n) => this.onNestDestroyed(n),
      },
    );
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
    this.closeRecruitPanel();
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

  // ---------- Recruit / Hero lifecycle (M4) ----------

  private openRecruitPanel(barracks: Barracks): void {
    this.recruitBarracks = barracks;
    this.recruitPanel.show();
  }

  private closeRecruitPanel(): void {
    if (!this.recruitPanel.isVisible()) return;
    this.recruitBarracks = null;
    this.recruitPanel.hide();
  }

  private canAffordHire(kind: HeroKind): boolean {
    if (this.nextHireIsFree()) return true;
    return this.state.treasury.gold >= HERO_COSTS[kind];
  }

  private nextHireIsFree(): boolean {
    const period = this.state.perkMods.freeHirePeriod;
    if (period <= 0) return false;
    // The NEXT hire (recruitCount + 1). Free on every Nth = when (count+1) % period === 0.
    return (this.state.recruitCount + 1) % period === 0;
  }

  private hireHintText(): string {
    if (this.nextHireIsFree()) return 'Next hire free (Fast Muster).';
    const period = this.state.perkMods.freeHirePeriod;
    if (period > 0) {
      const till = period - (this.state.recruitCount % period);
      return `Fast Muster: free in ${till} hire(s).`;
    }
    return '';
  }

  private recruit(kind: HeroKind): void {
    if (!this.recruitBarracks) return;
    if (this.state.heroes.length >= HEROES.cap) return;

    const free = this.nextHireIsFree();
    const cost = HERO_COSTS[kind];
    if (!free) {
      if (!this.state.treasury.spend(cost)) return;
    }

    this.state.recruitCount += 1;
    this.heroIdCounter += 1;
    const id = `${kind}-${this.heroIdCounter}`;
    // Small random offset so multiple recruits don't overlap.
    const ang = this.combatRng.next() * Math.PI * 2;
    const r = 24 + this.combatRng.next() * 18;
    const bx = this.recruitBarracks.position.x;
    const bz = this.recruitBarracks.position.z;
    const position = { x: bx + Math.cos(ang) * r, z: bz + Math.sin(ang) * r };

    const startLevel = Math.max(1, this.state.perkMods.heroStartLevel);
    const hero: Hero = kind === 'warrior'
      ? new Warrior(id, position, startLevel)
      : new Archer(id, position, startLevel);
    hero.startRally(this.state.simT);

    // Anchor hero to barracks for engagement leash clamp.
    hero.anchorX = bx;
    hero.anchorZ = bz;

    this.state.heroes.push(hero);
    this.world.root.add(hero.mesh);
    this.registerHeroOverlays(hero);
  }

  private registerHeroOverlays(hero: Hero): void {
    this.healthBars.ensure(hero.id, () => hero.alive ? ({
      worldX: hero.position.x,
      worldZ: hero.position.z,
      hp: hero.hp,
      maxHp: hero.maxHp,
      visible: true,
    }) : null);
    this.statusIcons.ensure(hero.id, () => {
      if (!hero.alive) return null;
      if (this.state.simT < hero.rallyUntil) {
        return { worldX: hero.position.x, worldZ: hero.position.z, glyph: 'RALLY' };
      }
      const glyph = hero.inCombat && (this.state.simT - 0) >= 0 && hero.combatCooldown < 1.0
        ? 'ATK'
        : null;
      return { worldX: hero.position.x, worldZ: hero.position.z, glyph };
    });
  }

  private registerMonster(monster: Monster): void {
    // Cap sanity.
    if (this.state.monsters.length >= MONSTERS.worldCap) return;
    this.state.monsters.push(monster);
    this.world.root.add(monster.mesh);
    this.healthBars.ensure(monster.id, () => monster.alive ? ({
      worldX: monster.position.x,
      worldZ: monster.position.z,
      hp: monster.hp,
      maxHp: monster.maxHp,
      visible: true,
    }) : null);
    this.statusIcons.ensure(monster.id, () => {
      if (!monster.alive) return null;
      if (monster.state === 'aggro') {
        return { worldX: monster.position.x, worldZ: monster.position.z, glyph: 'AGR' };
      }
      return { worldX: monster.position.x, worldZ: monster.position.z, glyph: null };
    });
  }

  private registerNestOverlays(nest: Nest): void {
    this.healthBars.ensure(nest.id, () => nest.alive ? ({
      worldX: nest.position.x,
      worldZ: nest.position.z,
      hp: nest.hp,
      maxHp: nest.maxHp,
      visible: true,
    }) : null);
  }

  private onHeroDied(hero: Hero): void {
    // eslint-disable-next-line no-console
    console.log('[hero died]', hero.id);
    // Meshes use shared cached materials (toonMat/flatMat) — do not dispose
    // individually here. World.dispose() handles bulk cleanup on exit.
    this.world.root.remove(hero.mesh);
    this.healthBars.remove(hero.id);
    this.statusIcons.remove(hero.id);
  }

  private onMonsterDied(m: Monster): void {
    this.world.root.remove(m.mesh);
    this.healthBars.remove(m.id);
    this.statusIcons.remove(m.id);
  }

  private onNestDestroyed(nest: Nest): void {
    this.state.nestsDestroyed += 1;
    // eslint-disable-next-line no-console
    console.log('[nest destroyed]', nest.id, 'tier=', nest.tier);
    // Surviving defenders keep their state — without a spawner they'll chase
    // heroes/capital via their regular aggro→leash loop.
    const parent = nest.mesh.parent ?? this.world.root;
    parent.remove(nest.mesh);
    this.healthBars.remove(nest.id);
  }

  private showHeroCard(hero: Hero): void {
    this.ui.heroCard.show({
      class: hero.kind,
      level: hero.level,
      hp: hero.hp,
      maxHp: hero.maxHp,
      hasPotion: false,
      weaponTier: 0,
      armorTier: 0,
      personalGold: Math.floor(hero.personalGold),
      aiState: this.state.simT < hero.rallyUntil ? 'rally' : hero.inCombat ? 'combat' : 'idle',
      xp: Math.floor(hero.xp),
      xpToNext: xpToNextLevel(hero.xp),
    });
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

  // ---------- M8 demo hotkeys ----------

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

function ensureWorldOverlay(): HTMLElement {
  const existing = document.getElementById('world-overlay');
  if (existing) return existing;
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
