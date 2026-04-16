import type { Hero } from '../../entities/Hero.ts';
import type { GameState } from '../../game/GameState.ts';
import type { NavGrid } from '../../world/NavGrid.ts';
import type { Pathfinder } from '../../world/Pathfinder.ts';
import { type AIWorld, pickEngageTarget } from '../HeroAI.ts';
import { HEROES } from '../../config/Tuning.ts';

/**
 * Engage — pick a target per class priority and either close the gap (warrior /
 * archer outside band) or kite (archer inside min band).
 *
 * The actual swing/cooldown lives in CombatSystem. This state writes
 * `hero.currentTarget` and `hero.targetPosition`.
 */
export function actEngage(
  hero: Hero,
  _dt: number,
  _state: GameState,
  world: AIWorld,
  _nav: NavGrid,
  _pathfinder: Pathfinder,
): void {
  // Re-pick if invalid.
  if (!hero.currentTarget || !hero.currentTarget.alive) {
    hero.currentTarget = pickEngageTarget(hero, world);
  }
  const tgt = hero.currentTarget;
  if (!tgt || !tgt.alive) {
    hero.clearDestination();
    return;
  }

  const dx = tgt.position.x - hero.position.x;
  const dz = tgt.position.z - hero.position.z;
  const d = Math.hypot(dx, dz);

  if (hero.kind === 'archer') {
    // Kite: hold between archerKiteMin / kiteMax of the target.
    if (d < HEROES.archerKiteMin) {
      // Step back along (target → hero) vector by 60u.
      const back = 60;
      const nx = -dx / Math.max(1, d);
      const nz = -dz / Math.max(1, d);
      hero.setDestination(hero.position.x + nx * back, hero.position.z + nz * back);
      return;
    }
    if (d > hero.attackRange) {
      // Move toward target until in attack range.
      hero.setDestination(tgt.position.x, tgt.position.z);
      return;
    }
    // In band: stand and shoot.
    hero.clearDestination();
    return;
  }

  // Warrior — close to melee range.
  if (d > hero.attackRange) {
    hero.setDestination(tgt.position.x, tgt.position.z);
    return;
  }
  hero.clearDestination();
}
