import * as THREE from 'three';
import type { NavGrid } from '../world/NavGrid.ts';
import type { Pathfinder, PathPointWorld } from '../world/Pathfinder.ts';
import type { GameState } from '../game/GameState.ts';
import { createBlobShadow } from '../rendering/BlobShadows.ts';
import { COMBAT, HEROES, equipmentRow } from '../config/Tuning.ts';
import { distance2d } from '../util/Math.ts';
import { levelForXp } from '../progression/Leveling.ts';
import type { AbilityCallbacks, IncomingContext } from '../progression/Abilities.ts';
import type { HeroAI, HeroState } from '../ai/HeroAI.ts';
import { applyWarriorLevelAbilities } from '../progression/WarriorStats.ts';
import { applyArcherLevelAbilities } from '../progression/ArcherStats.ts';

export type HeroKind = 'warrior' | 'archer';

/** A thing a hero can attack. Implemented by Monster, Nest, Capital. */
export interface HeroTarget {
  id: string;
  type: 'monster' | 'nest' | 'capital';
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

/** Tier index (0..3) for a single equipment slot. */
export type EquipmentTier = 0 | 1 | 2 | 3;

/**
 * Base class for Warrior / Archer.
 *
 * Subclasses set the visual + class-base stat floor in the constructor — this
 * class owns shared simulation logic: movement (direct or A*), regen, leveling,
 * tier-based stat overlay, and an `ai` field that drives the FSM each tick
 * (HeroAI from M5).
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

  // ---- Class-base stats (set by Warrior/Archer.applyLevelStats). ----
  /** Per-level base damage from class stats table. Effective `baseDamage` folds in tiers/buffs. */
  classBaseDamage: number;
  classBaseAttackRate: number;
  classBaseAttackRange: number;

  lastAttackT = -Infinity;
  currentTarget: HeroTarget | null = null;
  currentPath: PathPointWorld[] | null = null;
  currentPathIndex = 0;

  inCombat = false;
  /** Time elapsed since we last dealt or received damage. Drives regen gate. */
  combatCooldown = Infinity;
  /** Time of last in-combat event (sec). Used by 6s out-of-combat shop gate. */
  lastInCombatT = -Infinity;
  lastHpChangeT = -Infinity;
  /** Tracks how long we've been continuously in combat — for the AI 6s gate logic. */
  aiCombatTimer = 0;

  /** Seconds-since-game-start anchor we use to time rally + attacks. */
  protected simT = 0;

  /** Rally phase runs for rallySeconds after spawn — hero idles near barracks. */
  rallyUntil: number;

  /** Hero's tether — used by combat system to clamp chasing. */
  anchorX: number;
  anchorZ: number;

  alive = true;

  // ---- M5 fields ----
  /** AI controller — assigned by Game on recruit. */
  ai!: HeroAI;
  /** Equipment tiers: 0 = nothing bought yet, 3 = max. */
  weaponTier: EquipmentTier = 0;
  armorTier: EquipmentTier = 0;
  /** Healing potions in inventory (cap is 1 + perkMods.potionCarryBonus). */
  potionCount = 0;
  /** Has this hero ever bought a smith upgrade? Drives the first-purchase discount. */
  firstSmithPurchaseMade = false;
  /** Cooldown timers keyed by ability id (seconds remaining). */
  readonly cooldowns: Record<string, number> = {};
  /** Buff timers (seconds remaining); generic — folded into `attackRate` etc. */
  readonly buffs: { attackRatePct: number; attackRateRemaining: number } = {
    attackRatePct: 0,
    attackRateRemaining: 0,
  };
  /** Damage-reduction buff (Last Stand, etc.) as fractional reduction. */
  damageReductionBuff = 0;
  damageReductionRemaining = 0;
  /** Tracks "first time HP < 25%" for Last Stand. */
  lastStandTriggered = false;
  /** Hit counter for cleave/focus-shot procs. */
  attackCount = 0;
  /** Ability hooks attached by class progression. */
  readonly abilities: AbilityCallbacks[] = [];

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
    this.classBaseDamage = stats.damage;
    this.classBaseAttackRate = stats.attackRate;
    this.moveSpeed = stats.moveSpeed;
    this.classBaseAttackRange = stats.attackRange;

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

  /** Hook to install ability callbacks on level-up. Called after `applyLevelStats`. */
  protected installLevelAbilities(): void {
    if (this.kind === 'warrior') applyWarriorLevelAbilities(this);
    else applyArcherLevelAbilities(this);
  }

  // ---- Effective combat stats (tier + perk + buff overlay). ----

  /** Effective base damage applied per swing — class base × weapon tier × buffs. */
  get baseDamage(): number {
    let d = this.classBaseDamage;
    for (let t = 1; t <= this.weaponTier; t++) {
      const row = equipmentRow('weapon', t as 1 | 2 | 3);
      if (row) d *= row.dmgMult;
    }
    return d;
  }

  /** Effective attacks-per-second — class base × warrior T2 secondary × ability buffs. */
  get attackRate(): number {
    let rate = this.classBaseAttackRate;
    if (this.kind === 'warrior') {
      for (let t = 1; t <= this.weaponTier; t++) {
        const row = equipmentRow('weapon', t as 1 | 2 | 3);
        if (row) rate *= row.warriorRateMult;
      }
    }
    if (this.buffs.attackRateRemaining > 0) rate *= 1 + this.buffs.attackRatePct;
    return rate;
  }

  /** Effective attack range — class base × archer T2 range secondary. */
  get attackRange(): number {
    let r = this.classBaseAttackRange;
    if (this.kind === 'archer') {
      for (let t = 1; t <= this.weaponTier; t++) {
        const row = equipmentRow('weapon', t as 1 | 2 | 3);
        if (row) r *= row.archerRangeMult;
      }
    }
    return r;
  }

  /** Effective damage reduction (0..1) from armor tier + buff stacks. */
  get damageReduction(): number {
    let dr = 0;
    for (let t = 1; t <= this.armorTier; t++) {
      const row = equipmentRow('armor', t as 1 | 2 | 3);
      if (row) dr += row.drAdd;
    }
    if (this.damageReductionRemaining > 0) dr = Math.min(0.85, dr + this.damageReductionBuff);
    return dr;
  }

  /** Warrior T3 signature: additive +% damage vs nests. */
  get weaponNestDamageBonus(): number {
    if (this.kind !== 'warrior') return 0;
    let bonus = 0;
    for (let t = 1; t <= this.weaponTier; t++) {
      const row = equipmentRow('weapon', t as 1 | 2 | 3);
      if (row) bonus += row.warriorNestDmgAdd;
    }
    return bonus;
  }

  /** Archer T3 signature: additive +% crit chance (0..1). */
  get weaponCritChanceBonus(): number {
    if (this.kind !== 'archer') return 0;
    let bonus = 0;
    for (let t = 1; t <= this.weaponTier; t++) {
      const row = equipmentRow('weapon', t as 1 | 2 | 3);
      if (row) bonus += row.archerCritAdd;
    }
    return bonus;
  }

  /** Set the rally-until timestamp relative to the current simulation time. */
  startRally(simT: number, seconds: number = HEROES.rallySeconds): void {
    this.rallyUntil = simT + seconds;
  }

  /**
   * Advance the hero one fixed step. The AI FSM (`hero.ai.tick`) sets the
   * destination + state, then this method advances movement and regen.
   *
   * Rally is honored here: during rally we just sit still and let the regen
   * tick.
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
      this.aiCombatTimer = 0;
    } else {
      this.aiCombatTimer += dt;
    }

    // Tick down ability buffs / cooldowns.
    for (const k of Object.keys(this.cooldowns)) {
      this.cooldowns[k] = Math.max(0, this.cooldowns[k]! - dt);
    }
    if (this.buffs.attackRateRemaining > 0) {
      this.buffs.attackRateRemaining = Math.max(0, this.buffs.attackRateRemaining - dt);
      if (this.buffs.attackRateRemaining === 0) this.buffs.attackRatePct = 0;
    }
    if (this.damageReductionRemaining > 0) {
      this.damageReductionRemaining = Math.max(0, this.damageReductionRemaining - dt);
      if (this.damageReductionRemaining === 0) this.damageReductionBuff = 0;
    }
    for (const ab of this.abilities) ab.onTick?.(this, dt, simT);

    // Rally: stand still near barracks for a short beat after spawn.
    if (simT < this.rallyUntil) {
      return;
    }

    // Regen — gated by AI state via `regenAllowed` flag set by HeroAI when in
    // recover or out-of-combat patrol.
    this.tickRegen(dt);

    // Movement toward a target position if we have one.
    this.tickMovement(dt, nav, pathfinder);
  }

  receiveDamage(amount: number): void {
    if (!this.alive) return;
    let dmg = amount * (1 - this.damageReduction);
    const ctx: IncomingContext = { damage: dmg };
    for (const ab of this.abilities) ab.onIncomingDamage?.(this, ctx, this.simT);
    dmg = Math.max(0, ctx.damage);
    if (dmg > 0) {
      this.hp = Math.max(0, this.hp - dmg);
      this.lastHpChangeT = this.simT;
    }
    this.inCombat = true;
    this.combatCooldown = 0;
    this.lastInCombatT = this.simT;
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
      this.installLevelAbilities();
    }
  }

  /** Drink a healing potion if any are carried. Returns true if applied. */
  applyPotion(): boolean {
    if (this.potionCount <= 0) return false;
    if (!this.alive) return false;
    this.potionCount -= 1;
    this.hp = Math.min(this.maxHp, this.hp + this.maxHp * HEROES.potionHealFraction);
    return true;
  }

  /** Stamp the AI state for status icons / hero card. */
  get aiState(): HeroState {
    return this.ai ? this.ai.current : 'spawn-rally';
  }

  /** Point a hero at a new destination. Clears the cached path so it replans. */
  setDestination(x: number, z: number): void {
    if (this.targetPosition && Math.abs(this.targetPosition.x - x) < 1 && Math.abs(this.targetPosition.z - z) < 1) {
      return;
    }
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
    // PRD §10.6: 1% out-of-combat in world; 4% in safe zone (also implicit "Recover" state).
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

/** PRD §14.3 armor HP multiplier (cumulative). T1 +15%, T2 +10% more, T3 +15% more.
 *  Data-driven: derives from the EQUIPMENT table so tuning edits in one place. */
export function armorHpMult(tier: EquipmentTier): number {
  let m = 1;
  for (let t = 1; t <= tier; t++) {
    const row = equipmentRow('armor', t as 1 | 2 | 3);
    if (row) m *= row.hpMult;
  }
  return m;
}
