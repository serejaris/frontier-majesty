import { Hero, type HeroPosition, armorHpMult } from './Hero.ts';
import { createWarriorMesh } from '../rendering/Silhouettes.ts';
import { warriorStatsAt } from '../progression/WarriorStats.ts';

export class Warrior extends Hero {
  constructor(id: string, position: HeroPosition, startLevel: number = 1) {
    const stats = warriorStatsAt(startLevel);
    super(id, 'warrior', position, stats, createWarriorMesh(), 18);
    this.level = startLevel;
    // Apply abilities matching the starting level (in case Veterans perk gave L2+).
    this.installLevelAbilities();
  }

  override applyLevelStats(prevMaxHp: number): void {
    const stats = warriorStatsAt(this.level);
    // Preserve HP % on level-up (no instant heal, but scale with new max).
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
