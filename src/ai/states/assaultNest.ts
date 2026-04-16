import type { Hero } from '../../entities/Hero.ts';
import type { GameState } from '../../game/GameState.ts';
import type { NavGrid } from '../../world/NavGrid.ts';
import type { Pathfinder } from '../../world/Pathfinder.ts';
import type { AIWorld } from '../HeroAI.ts';
import { distance2d } from '../../util/Math.ts';

/**
 * Path to the assigned nest. Once within attack range, set `currentTarget` to
 * the nest so CombatSystem starts swinging at it. If a defender is nearer than
 * the nest, leave target picking to CombatSystem (handled in next reconsider).
 */
export function actAssaultNest(
  hero: Hero,
  _dt: number,
  _state: GameState,
  world: AIWorld,
  _nav: NavGrid,
  _pathfinder: Pathfinder,
  nestId: string | null,
): void {
  if (!nestId) {
    hero.clearDestination();
    return;
  }
  const nest = world.nests.find((n) => n.id === nestId);
  if (!nest || !nest.alive) {
    hero.clearDestination();
    return;
  }
  const d = distance2d(hero.position.x, hero.position.z, nest.position.x, nest.position.z);
  if (d > hero.attackRange) {
    hero.setDestination(nest.position.x, nest.position.z);
    return;
  }
  hero.clearDestination();
  hero.currentTarget = nest;
}
