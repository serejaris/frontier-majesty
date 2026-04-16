import { Hero, type HeroPosition, armorHpMult } from './Hero.ts';
import { createArcherMesh } from '../rendering/Silhouettes.ts';
import { archerStatsAt } from '../progression/ArcherStats.ts';

export class Archer extends Hero {
  constructor(id: string, position: HeroPosition, startLevel: number = 1) {
    const stats = archerStatsAt(startLevel);
    super(id, 'archer', position, stats, createArcherMesh(), 14);
    this.level = startLevel;
    this.installLevelAbilities();
  }

  override applyLevelStats(prevMaxHp: number): void {
    const stats = archerStatsAt(this.level);
    const ratio = prevMaxHp > 0 ? this.hp / prevMaxHp : 1;
    const armorMult = armorHpMult(this.armorTier);
    this.maxHp = Math.round(stats.maxHp * armorMult);
    this.hp = Math.min(this.maxHp, Math.max(1, Math.round(this.maxHp * ratio)));
    this.classBaseDamage = stats.damage;
    this.classBaseAttackRate = stats.attackRate;
    this.moveSpeed = stats.moveSpeed;
    this.classBaseAttackRange = stats.attackRange;
  }
}
