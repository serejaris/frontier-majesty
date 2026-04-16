import { Hero, type HeroPosition } from './Hero.ts';
import { createArcherMesh } from '../rendering/Silhouettes.ts';
import { archerStatsAt } from '../progression/ArcherStats.ts';

export class Archer extends Hero {
  constructor(id: string, position: HeroPosition, startLevel: number = 1) {
    const stats = archerStatsAt(startLevel);
    super(id, 'archer', position, stats, createArcherMesh(), 14);
    this.level = startLevel;
  }

  override applyLevelStats(prevMaxHp: number): void {
    const stats = archerStatsAt(this.level);
    const ratio = prevMaxHp > 0 ? this.hp / prevMaxHp : 1;
    this.maxHp = stats.maxHp;
    this.hp = Math.min(this.maxHp, Math.max(1, Math.round(stats.maxHp * ratio)));
    this.baseDamage = stats.damage;
    this.attackRate = stats.attackRate;
    this.moveSpeed = stats.moveSpeed;
    this.attackRange = stats.attackRange;
  }
}
