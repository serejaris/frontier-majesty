import * as THREE from 'three';
import type { Rng } from '../util/Random.ts';
import { MONSTERS } from '../config/Tuning.ts';
import { distance2d } from '../util/Math.ts';
import { createMonsterMesh } from '../rendering/Silhouettes.ts';
import { createBlobShadow } from '../rendering/BlobShadows.ts';
import type { Hero, HeroTarget } from './Hero.ts';
import type { Capital } from './Capital.ts';

export type MonsterKind = 'grunt';
export type MonsterState = 'patrol' | 'aggro' | 'leash' | 'roaming';

interface MonsterPosition {
  x: number;
  z: number;
}

interface AttackerRecord {
  heroId: string;
  damage: number;
  lastT: number;
}

/**
 * Monster — patrol → aggro → leash, with M5 additions:
 *
 *  - When no hero in aggro range AND capital within `aggroRadius`-ish, attacks
 *    capital directly (PRD M5).
 *  - When `roamingTarget` is set by Nest.maybeSendRoamer, marches at a fixed
 *    target (usually the capital) until reached or interrupted by hero aggro.
 *
 * The combat loop continues to use `applyDamage` for HP / reward attribution.
 */
export class Monster implements HeroTarget {
  readonly id: string;
  readonly kind: MonsterKind = 'grunt';
  readonly mesh: THREE.Group;
  readonly position: MonsterPosition;
  readonly homeX: number;
  readonly homeZ: number;

  maxHp: number;
  hp: number;
  baseDamage: number;
  attackRate: number;
  moveSpeed: number;

  state: MonsterState = 'patrol';
  targetHero: Hero | null = null;
  targetCapital: Capital | null = null;
  /** When set, monster ignores leash and marches at this point. */
  roamingTarget: { x: number; z: number } | null = null;
  lastAttackT = -Infinity;
  alive = true;

  /** Current wander destination (patrol) or pursuit destination (aggro). */
  private dest: MonsterPosition | null = null;
  private nextPatrolRepickT = 0;

  /** Damage ledger per hero for reward-split on death. */
  readonly attackers = new Map<string, AttackerRecord>();

  constructor(id: string, homeX: number, homeZ: number, spawnX: number, spawnZ: number) {
    this.id = id;
    this.homeX = homeX;
    this.homeZ = homeZ;

    this.maxHp = MONSTERS.maxHp;
    this.hp = this.maxHp;
    this.baseDamage = MONSTERS.damage;
    this.attackRate = MONSTERS.attackRate;
    this.moveSpeed = MONSTERS.moveSpeed;

    this.position = { x: spawnX, z: spawnZ };

    this.mesh = new THREE.Group();
    this.mesh.name = `monster:${id}`;
    this.mesh.userData = { type: 'monster', id };
    this.mesh.position.set(spawnX, 0, spawnZ);
    this.mesh.add(createMonsterMesh());
    this.mesh.add(createBlobShadow(16));
  }

  get type(): 'monster' {
    return 'monster';
  }

  applyDamage(amount: number, sourceHeroId: string, nowT: number): void {
    if (!this.alive) return;
    this.hp = Math.max(0, this.hp - amount);
    const rec = this.attackers.get(sourceHeroId);
    if (rec) {
      rec.damage += amount;
      rec.lastT = nowT;
    } else {
      this.attackers.set(sourceHeroId, { heroId: sourceHeroId, damage: amount, lastT: nowT });
    }
    if (this.hp <= 0) {
      this.alive = false;
    }
  }

  /**
   * Advance the monster: pick a hero target in aggroRadius, pursue until
   * leashRadius, attack in melee. Patrol jitter around home when idle.
   * Capital becomes a fallback target if no hero is near.
   */
  update(
    dt: number,
    simT: number,
    heroes: readonly Hero[],
    rng: Rng,
    capital?: Capital,
  ): void {
    if (!this.alive) return;

    // 1. Decide state.
    const nearest = pickNearestAliveHero(heroes, this.position);
    const dHome = distance2d(this.position.x, this.position.z, this.homeX, this.homeZ);

    if (nearest) {
      const dHero = distance2d(
        this.position.x,
        this.position.z,
        nearest.position.x,
        nearest.position.z,
      );
      if (this.state === 'patrol' || this.state === 'leash' || this.state === 'roaming') {
        if (dHero <= MONSTERS.aggroRadius) {
          this.state = 'aggro';
          this.targetHero = nearest;
          this.targetCapital = null;
        }
      } else if (this.state === 'aggro') {
        if (!this.targetHero || !this.targetHero.alive) {
          this.targetHero = nearest;
        }
        if (this.roamingTarget) {
          // Roamers ignore leash — they're committed to the capital.
        } else if (dHome > MONSTERS.pursuitRadius) {
          this.state = 'leash';
          this.targetHero = null;
        } else if (this.targetHero) {
          const dTgt = distance2d(
            this.position.x,
            this.position.z,
            this.targetHero.position.x,
            this.targetHero.position.z,
          );
          // Drop aggro if hero escaped beyond sight + pursuit slack.
          if (dTgt > MONSTERS.aggroRadius + MONSTERS.pursuitRadius * 0.5) {
            this.state = 'leash';
            this.targetHero = null;
          }
        }
      }
    } else if (this.state === 'aggro') {
      this.state = this.roamingTarget ? 'roaming' : 'leash';
      this.targetHero = null;
    }

    // Roamer transition — if not currently aggro and we have a roamingTarget, march.
    if (this.roamingTarget && this.state !== 'aggro') {
      this.state = 'roaming';
    }

    // 2. Pick destination based on state.
    switch (this.state) {
      case 'aggro': {
        const tgt = this.targetHero;
        if (tgt && tgt.alive) {
          this.dest = { x: tgt.position.x, z: tgt.position.z };
          // Attack if in melee.
          const dTgt = distance2d(this.position.x, this.position.z, tgt.position.x, tgt.position.z);
          if (dTgt <= MONSTERS.meleeRange) {
            this.tryMeleeHero(simT, tgt);
          }
        }
        break;
      }
      case 'leash': {
        this.dest = { x: this.homeX, z: this.homeZ };
        if (dHome < MONSTERS.patrolRadius * 0.4) {
          this.state = 'patrol';
          this.dest = null;
          this.nextPatrolRepickT = simT;
        }
        break;
      }
      case 'patrol': {
        // While patrolling, opportunistically attack capital if it's right there
        // (e.g. nest is close to capital — unusual but PRD requires this fallback).
        if (capital && capital.alive) {
          const dCap = distance2d(this.position.x, this.position.z, capital.position.x, capital.position.z);
          if (dCap <= 300) {
            this.targetCapital = capital;
            this.dest = { x: capital.position.x, z: capital.position.z };
            if (dCap <= MONSTERS.meleeRange + 80) {
              this.tryMeleeCapital(simT, capital);
            }
            break;
          }
        }
        if (!this.dest || simT >= this.nextPatrolRepickT) {
          this.pickPatrolDest(rng);
          this.nextPatrolRepickT = simT + MONSTERS.patrolRepickPeriod;
        }
        break;
      }
      case 'roaming': {
        if (!this.roamingTarget) {
          this.state = 'leash';
          break;
        }
        this.dest = { x: this.roamingTarget.x, z: this.roamingTarget.z };
        if (capital && capital.alive) {
          const dCap = distance2d(this.position.x, this.position.z, capital.position.x, capital.position.z);
          if (dCap <= MONSTERS.meleeRange + 80) {
            this.tryMeleeCapital(simT, capital);
          }
        }
        break;
      }
    }

    // 3. Move.
    if (this.dest) {
      const dx = this.dest.x - this.position.x;
      const dz = this.dest.z - this.position.z;
      const d = Math.hypot(dx, dz);
      if (d > 2) {
        const step = Math.min(this.moveSpeed * dt, d);
        const nx = dx / d;
        const nz = dz / d;
        this.position.x += nx * step;
        this.position.z += nz * step;
        this.mesh.position.set(this.position.x, 0, this.position.z);
        this.mesh.rotation.y = Math.atan2(nx, nz);
      } else if (this.state === 'patrol') {
        this.dest = null;
      }
    }
  }

  private tryMeleeHero(simT: number, hero: Hero): void {
    const period = 1 / Math.max(0.01, this.attackRate);
    if (simT - this.lastAttackT < period) return;
    this.lastAttackT = simT;
    hero.receiveDamage(this.baseDamage);
  }

  private tryMeleeCapital(simT: number, capital: Capital): void {
    const period = 1 / Math.max(0.01, this.attackRate);
    if (simT - this.lastAttackT < period) return;
    this.lastAttackT = simT;
    capital.applyDamage(this.baseDamage, this.id, simT);
  }

  private pickPatrolDest(rng: Rng): void {
    const angle = rng.next() * Math.PI * 2;
    const r = rng.range(MONSTERS.patrolRadius * 0.3, MONSTERS.patrolRadius);
    this.dest = {
      x: this.homeX + Math.cos(angle) * r,
      z: this.homeZ + Math.sin(angle) * r,
    };
  }
}

function pickNearestAliveHero(heroes: readonly Hero[], from: MonsterPosition): Hero | null {
  let best: Hero | null = null;
  let bestD = Infinity;
  for (const h of heroes) {
    if (!h.alive) continue;
    const d = distance2d(from.x, from.z, h.position.x, h.position.z);
    if (d < bestD) {
      bestD = d;
      best = h;
    }
  }
  return best;
}
