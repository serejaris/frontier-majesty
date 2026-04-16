import * as THREE from 'three';
import type { NavGrid } from '../world/NavGrid.ts';
import type { Pathfinder, PathPointWorld } from '../world/Pathfinder.ts';
import type { GameState } from '../game/GameState.ts';
import { createBlobShadow } from '../rendering/BlobShadows.ts';
import { COMBAT, HEROES } from '../config/Tuning.ts';
import { distance2d } from '../util/Math.ts';
import { levelForXp } from '../progression/Leveling.ts';

export type HeroKind = 'warrior' | 'archer';

/** A thing a hero can attack. Implemented by Monster and Nest. */
export interface HeroTarget {
  id: string;
  type: 'monster' | 'nest';
  alive: boolean;
  position: { x: number; z: number };
  hp: number;
  maxHp: number;
  mesh: THREE.Object3D;
  /** Apply damage; `sourceHeroId` lets the target credit reward split. */
  applyDamage(amount: number, sourceHeroId: string, nowT: number): void;
}

export interface HeroPosition {
  x: number;
  z: number;
}

/**
 * Base class for Warrior / Archer. Subclasses set the visual and stat floor
 * in their constructor — this class owns the shared simulation logic:
 * movement (direct or pathfinder-backed), attack cooldowns, regen, leveling.
 *
 * M4 is "combat-only" — the full AI FSM (Retreat, Shop, etc.) lands in M5.
 * The behavior here is a minimal: rally → seek nearest target → attack → regen.
 */
export abstract class Hero {
  readonly id: string;
  readonly kind: HeroKind;
  readonly mesh: THREE.Group;
  readonly position: HeroPosition;

  /** Tracks the current desired destination (if any). */
  targetPosition: HeroPosition | null = null;

  hp: number;
  maxHp: number;
  level: number;
  xp: number;
  personalGold: number;

  moveSpeed: number;
  baseDamage: number;
  attackRate: number;
  attackRange: number;

  lastAttackT = -Infinity;
  currentTarget: HeroTarget | null = null;
  currentPath: PathPointWorld[] | null = null;
  currentPathIndex = 0;

  inCombat = false;
  /** Time elapsed since we last dealt or received damage. Drives regen gate. */
  combatCooldown = Infinity;

  /** Seconds-since-game-start anchor we use to time rally + attacks. */
  protected simT = 0;

  /** Rally phase runs for rallySeconds after spawn — hero idles near barracks. */
  rallyUntil: number;

  /** Hero's tether — used by combat system to clamp chasing. */
  anchorX: number;
  anchorZ: number;

  alive = true;

  protected constructor(
    id: string,
    kind: HeroKind,
    position: HeroPosition,
    stats: {
      maxHp: number;
      damage: number;
      attackRate: number;
      moveSpeed: number;
      attackRange: number;
    },
    visualMesh: THREE.Group,
    blobRadius: number,
  ) {
    this.id = id;
    this.kind = kind;
    this.position = { x: position.x, z: position.z };
    this.anchorX = position.x;
    this.anchorZ = position.z;

    this.maxHp = stats.maxHp;
    this.hp = stats.maxHp;
    this.baseDamage = stats.damage;
    this.attackRate = stats.attackRate;
    this.moveSpeed = stats.moveSpeed;
    this.attackRange = stats.attackRange;

    this.level = 1;
    this.xp = 0;
    this.personalGold = 0;

    // Spawn-time rally window; `Game` offsets this via `startRally(simT)` so
    // rally is measured from the moment the hero was recruited.
    this.rallyUntil = HEROES.rallySeconds;

    this.mesh = new THREE.Group();
    this.mesh.name = `hero:${kind}:${id}`;
    this.mesh.userData = { type: 'hero', id };
    this.mesh.position.set(position.x, 0, position.z);
    this.mesh.add(visualMesh);
    this.mesh.add(createBlobShadow(blobRadius));
  }

  /** Apply stats derived from a new level. Subclasses implement per-class scaling. */
  abstract applyLevelStats(prevMaxHp: number): void;

  /** Set the rally-until timestamp relative to the current simulation time. */
  startRally(simT: number, seconds: number = HEROES.rallySeconds): void {
    this.rallyUntil = simT + seconds;
  }

  /**
   * Advance the hero one fixed step.
   *
   * `nav`/`pathfinder` are available if the hero needs to route around an
   * obstacle — in M4 we try a straight-line dash first, and fall back to A*
   * only when the target is far and the straight path is blocked.
   */
  update(
    dt: number,
    _state: GameState,
    nav: NavGrid,
    pathfinder: Pathfinder,
    simT: number,
  ): void {
    if (!this.alive) return;
    this.simT = simT;
    this.combatCooldown += dt;
    // Drop the in-combat flag once the window since last hit has elapsed.
    if (this.combatCooldown >= HEROES.regenCooldownSeconds) {
      this.inCombat = false;
    }

    // Rally: stand still near barracks for a short beat after spawn.
    if (simT < this.rallyUntil) {
      return;
    }

    // Regen (PRD §10.6).
    this.tickRegen(dt);

    // Movement toward a target position if we have one.
    this.tickMovement(dt, nav, pathfinder);
  }

  receiveDamage(amount: number): void {
    if (!this.alive) return;
    this.hp = Math.max(0, this.hp - amount);
    this.inCombat = true;
    this.combatCooldown = 0;
    if (this.hp <= 0) {
      this.alive = false;
    }
  }

  /** Grant XP; applies level-ups. `mult` from perk `xpMultiplier`. */
  grantXp(base: number, mult: number): void {
    if (!this.alive) return;
    const gained = Math.max(0, base) * Math.max(0, mult);
    this.xp += gained;
    const newLvl = levelForXp(this.xp);
    if (newLvl > this.level) {
      const prevMax = this.maxHp;
      this.level = newLvl;
      this.applyLevelStats(prevMax);
    }
  }

  /** Point a hero at a new destination. Clears the cached path so it replans. */
  setDestination(x: number, z: number): void {
    this.targetPosition = { x, z };
    this.currentPath = null;
    this.currentPathIndex = 0;
  }

  clearDestination(): void {
    this.targetPosition = null;
    this.currentPath = null;
    this.currentPathIndex = 0;
  }

  /**
   * Low-level move step: prefer straight line; fall back to A* when obstacles
   * are between us and a distant target. Blob shadow + mesh get synced here.
   */
  private tickMovement(dt: number, nav: NavGrid, pathfinder: Pathfinder): void {
    const dest = this.targetPosition;
    if (!dest) return;

    const dx = dest.x - this.position.x;
    const dz = dest.z - this.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 2) {
      this.clearDestination();
      return;
    }

    const useDirect =
      dist <= COMBAT.directMoveMaxDistance || isLineOfSightClear(nav, this.position, dest);

    let stepX: number;
    let stepZ: number;
    if (useDirect) {
      stepX = dx / dist;
      stepZ = dz / dist;
    } else {
      // Use A* waypoints.
      if (!this.currentPath || this.currentPathIndex >= this.currentPath.length) {
        const pr = pathfinder.find(this.position.x, this.position.z, dest.x, dest.z);
        if (pr && pr.world.length > 0) {
          this.currentPath = pr.world;
          this.currentPathIndex = 1; // skip starting cell
        } else {
          // No path — fall back to direct and let clipping sort it out.
          stepX = dx / dist;
          stepZ = dz / dist;
          const stepLen = this.moveSpeed * dt;
          this.advanceAlong(stepX, stepZ, stepLen, dist);
          return;
        }
      }
      const wp = this.currentPath[this.currentPathIndex];
      if (!wp) {
        this.currentPath = null;
        return;
      }
      const wpDx = wp.x - this.position.x;
      const wpDz = wp.z - this.position.z;
      const wpD = Math.hypot(wpDx, wpDz);
      if (wpD < 6) {
        this.currentPathIndex++;
        return;
      }
      stepX = wpDx / wpD;
      stepZ = wpDz / wpD;
    }

    const stepLen = this.moveSpeed * dt;
    this.advanceAlong(stepX, stepZ, stepLen, dist);
  }

  private advanceAlong(nx: number, nz: number, stepLen: number, remaining: number): void {
    const s = Math.min(stepLen, remaining);
    this.position.x += nx * s;
    this.position.z += nz * s;
    this.mesh.position.set(this.position.x, 0, this.position.z);
    // Face movement direction.
    const heading = Math.atan2(nx, nz);
    this.mesh.rotation.y = heading;
  }

  private tickRegen(dt: number): void {
    if (this.hp >= this.maxHp) return;
    if (this.combatCooldown < HEROES.regenCooldownSeconds) return;
    const inSafeZone = Math.hypot(this.position.x, this.position.z) < HEROES.safeZoneRadius;
    const rate = inSafeZone ? HEROES.safeZoneRegenPerSec : HEROES.worldRegenPerSec;
    this.hp = Math.min(this.maxHp, this.hp + this.maxHp * rate * dt);
  }
}

/** Walk the straight segment (a → b) on the nav grid and return true if no cell is blocked. */
export function isLineOfSightClear(
  nav: NavGrid,
  a: { x: number; z: number },
  b: { x: number; z: number },
): boolean {
  const samples = Math.max(4, Math.ceil(distance2d(a.x, a.z, b.x, b.z) / nav.dims.cellSize));
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const x = a.x + (b.x - a.x) * t;
    const z = a.z + (b.z - a.z) * t;
    const c = nav.worldToCell(x, z);
    if (nav.isBlocked(c.cx, c.cy)) return false;
  }
  return true;
}
