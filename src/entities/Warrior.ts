import { Hero, type HeroPosition } from './Hero.ts';
import { createWarriorMesh } from '../rendering/Silhouettes.ts';
import { warriorStatsAt } from '../progression/WarriorStats.ts';

export class Warrior extends Hero {
  constructor(id: string, position: HeroPosition, startLevel: number = 1) {
    const stats = warriorStatsAt(startLevel);
    super(id, 'warrior', position, stats, createWarriorMesh(), 18);
    this.level = startLevel;
  }

  override applyLevelStats(prevMaxHp: number): void {
    const stats = warriorStatsAt(this.level);
    // Preserve HP % on level-up (no instant heal, but scale with new max).
    const ratio = prevMaxHp > 0 ? this.hp / prevMaxHp : 1;
    this.maxHp = stats.maxHp;
    this.hp = Math.min(this.maxHp, Math.max(1, Math.round(stats.maxHp * ratio)));
    this.baseDamage = stats.damage;
    this.attackRate = stats.attackRate;
    this.moveSpeed = stats.moveSpeed;
    this.attackRange = stats.attackRange;
  }
}
