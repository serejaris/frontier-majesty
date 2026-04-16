import * as THREE from 'three';
import { CAPITAL } from '../config/Tuning.ts';
import { distance2d } from '../util/Math.ts';
import type { Monster } from './Monster.ts';
import type { HeroTarget } from './Hero.ts';

interface CapitalPosition {
  x: number;
  z: number;
}

/**
 * Capital — the central building. Loss condition (HP = 0) and weak auto-defense
 * aura (PRD §7.1). Implements `HeroTarget` so monsters can attack it via the
 * standard damage interface.
 *
 * The mesh is owned by `World` (built in `World.build`); we hold a reference
 * via `attachMesh()` so hit-flash events have somewhere to land.
 */
export class Capital implements HeroTarget {
  readonly id = 'capital';
  readonly type = 'capital';
  readonly position: CapitalPosition;
  hp: number;
  maxHp: number;
  alive = true;
  lastHpChangeT = -Infinity;

  /** Set lazily by Game once the World mesh is built. */
  mesh!: THREE.Object3D;

  private auraTickTimer = 0;

  constructor(position: CapitalPosition) {
    this.position = { x: position.x, z: position.z };
    this.maxHp = CAPITAL.maxHp;
    this.hp = this.maxHp;
  }

  attachMesh(mesh: THREE.Object3D): void {
    this.mesh = mesh;
  }

  applyDamage(amount: number, _sourceHeroId: string, nowT: number): void {
    if (!this.alive) return;
    this.hp = Math.max(0, this.hp - amount);
    this.lastHpChangeT = nowT;
    if (this.hp <= 0) this.alive = false;
  }

  /**
   * Weak defensive aura — once per `weakAuraRate` seconds, deal `weakAuraDamage`
   * to the closest monster within `auraRadius`. Prevents instant losses when a
   * lone roamer slips past the heroes.
   */
  tickAura(dt: number, monsters: readonly Monster[], simT: number): void {
    if (!this.alive) return;
    this.auraTickTimer += dt;
    if (this.auraTickTimer < CAPITAL.weakAuraRate) return;
    this.auraTickTimer = 0;

    let nearest: Monster | null = null;
    let nd: number = CAPITAL.auraRadius;
    for (const m of monsters) {
      if (!m.alive) continue;
      const d = distance2d(m.position.x, m.position.z, this.position.x, this.position.z);
      if (d < nd) {
        nd = d;
        nearest = m;
      }
    }
    if (nearest) nearest.applyDamage(CAPITAL.weakAuraDamage, 'capital-aura', simT);
  }
}
