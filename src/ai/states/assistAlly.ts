import type { Hero } from '../../entities/Hero.ts';
import type { GameState } from '../../game/GameState.ts';
import type { NavGrid } from '../../world/NavGrid.ts';
import type { Pathfinder } from '../../world/Pathfinder.ts';
import { type AIWorld, nearestAllyInCombat } from '../HeroAI.ts';
import { HEROES } from '../../config/Tuning.ts';
import { distance2d } from '../../util/Math.ts';

/**
 * Walk toward the nearest ally currently in combat. The next reconsider tick
 * will flip us to `engage` once we close the gap (the ally's target is in our
 * own aggro radius).
 */
export function actAssistAlly(
  hero: Hero,
  _dt: number,
  _state: GameState,
  world: AIWorld,
  _nav: NavGrid,
  _pathfinder: Pathfinder,
): void {
  const ally = nearestAllyInCombat(hero, world.heroes, HEROES.assistAllyRadius * 2);
  if (!ally || !ally.currentTarget || !ally.currentTarget.alive) {
    hero.clearDestination();
    return;
  }
  const tx = ally.currentTarget.position.x;
  const tz = ally.currentTarget.position.z;
  const d = distance2d(hero.position.x, hero.position.z, tx, tz);
  if (d > hero.attackRange * 0.9) {
    hero.setDestination(tx, tz);
  } else {
    hero.currentTarget = ally.currentTarget;
    hero.clearDestination();
  }
}
