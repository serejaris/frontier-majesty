import * as THREE from 'three';
import type { Rng } from '../util/Random.ts';
import { NESTS, MONSTERS, ROAMING } from '../config/Tuning.ts';
import { createNestMesh } from '../rendering/Silhouettes.ts';
import type { NestTier } from '../world/MapGenerator.ts';
import { Monster } from './Monster.ts';
import type { HeroTarget } from './Hero.ts';

interface NestPosition {
  x: number;
  z: number;
}

interface AttackerRecord {
  heroId: string;
  damage: number;
  lastT: number;
}

/**
 * Nest — a monster spawner + destructible objective. Implements HeroTarget so
 * CombatSystem can target it once heroes stray into its aggro window.
 *
 * M4 scope: spawn at a fixed interval when under cap; on death, drop XP + gold,
 * stop spawning, mark defenders hostile (they just keep their current state).
 */
export class Nest implements HeroTarget {
  readonly id: string;
  readonly tier: NestTier;
  readonly mesh: THREE.Group;
  readonly position: NestPosition;

  maxHp: number;
  hp: number;
  readonly spawnInterval: number;
  readonly maxActiveDefenders: number;
  readonly defenders: Monster[] = [];
  lastSpawnT: number;

  alive = true;
  private monsterCounter = 0;
  /** simT of the next roaming dispatch attempt. Lazily initialized on first tick. */
  private nextRoamerT = -1;

  readonly attackers = new Map<string, AttackerRecord>();

  constructor(id: string, tier: NestTier, x: number, z: number) {
    this.id = id;
    this.tier = tier;
    this.position = { x, z };

    const t = NESTS[tier];
    this.maxHp = t.hp;
    this.hp = this.maxHp;
    this.spawnInterval = t.spawnIntervalSec;
    this.maxActiveDefenders = t.maxActiveDefenders;
    // Stagger the first spawn so all nests don't fire on the same tick.
    this.lastSpawnT = -this.spawnInterval * Math.random() * 0.5;

    this.mesh = new THREE.Group();
    this.mesh.name = `nest:${id}`;
    this.mesh.userData = { type: 'nest', id };
    this.mesh.position.set(x, 0, z);
    this.mesh.add(createNestMesh(tier));
  }

  get type(): 'nest' {
    return 'nest';
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
    if (this.hp <= 0) this.alive = false;
  }

  /** Prune dead defenders from this nest's roster. */
  pruneDeadDefenders(): void {
    for (let i = this.defenders.length - 1; i >= 0; i--) {
      if (!this.defenders[i]!.alive) this.defenders.splice(i, 1);
    }
  }

  /**
   * Returns a new Monster if this tick should spawn one, else null.
   * Caller is responsible for respecting the world monster cap.
   */
  tickSpawn(simT: number, worldMonsterCount: number, rng: Rng): Monster | null {
    if (!this.alive) return null;
    this.pruneDeadDefenders();
    if (this.defenders.length >= this.maxActiveDefenders) return null;
    if (worldMonsterCount >= MONSTERS.worldCap) return null;
    if (simT - this.lastSpawnT < this.spawnInterval) return null;

    this.lastSpawnT = simT;
    this.monsterCounter++;

    // Spawn just outside the dome with a random angular offset.
    const ang = rng.next() * Math.PI * 2;
    const r = 80 + rng.next() * 40;
    const sx = this.position.x + Math.cos(ang) * r;
    const sz = this.position.z + Math.sin(ang) * r;

    const monster = new Monster(`${this.id}-m${this.monsterCounter}`, this.position.x, this.position.z, sx, sz);
    this.defenders.push(monster);
    return monster;
  }

  /**
   * Possibly designate one defender as a roamer marching at `capitalPos` (PRD §11.2).
   * Fires at most once per `ROAMING.intervalMin..intervalMax` seconds per nest.
   */
  maybeSendRoamer(simT: number, capitalPos: { x: number; z: number }, rng: Rng): void {
    if (!this.alive) return;
    if (this.nextRoamerT < 0) {
      this.nextRoamerT = simT + rng.range(ROAMING.intervalMinSec, ROAMING.intervalMaxSec);
      return;
    }
    if (simT < this.nextRoamerT) return;
    this.nextRoamerT = simT + rng.range(ROAMING.intervalMinSec, ROAMING.intervalMaxSec);

    // Pick a defender that isn't already roaming.
    const eligible = this.defenders.filter((d) => d.alive && !d.roamingTarget);
    if (eligible.length === 0) return;
    const pick = eligible[rng.int(0, eligible.length)]!;
    pick.roamingTarget = { x: capitalPos.x, z: capitalPos.z };
  }
}
