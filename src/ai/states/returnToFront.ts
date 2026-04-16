import type { Hero } from '../../entities/Hero.ts';
import type { GameState } from '../../game/GameState.ts';
import type { NavGrid } from '../../world/NavGrid.ts';
import type { Pathfinder } from '../../world/Pathfinder.ts';
import type { AIWorld } from '../HeroAI.ts';
import { HEROES } from '../../config/Tuning.ts';

/**
 * Walk back to the assigned nest, if any; otherwise drift to a default
 * inner-ring patrol point. The next reconsider tick promotes us to
 * `assault-nest` / `patrol` once we arrive.
 */
export function actReturnToFront(
  hero: Hero,
  _dt: number,
  _state: GameState,
  world: AIWorld,
  _nav: NavGrid,
  _pathfinder: Pathfinder,
  nestId: string | null,
): void {
  hero.currentTarget = null;
  if (nestId) {
    const nest = world.nests.find((n) => n.id === nestId);
    if (nest && nest.alive) {
      hero.setDestination(nest.position.x, nest.position.z);
      return;
    }
  }
  // Default: drift toward a point on the inner ring at this hero's spawn angle.
  const cap = world.capital;
  const ang = Math.atan2(hero.position.z - cap.position.z, hero.position.x - cap.position.x);
  const r = (HEROES.patrolRingMin + HEROES.patrolRingMax) * 0.5;
  hero.setDestination(cap.position.x + Math.cos(ang) * r, cap.position.z + Math.sin(ang) * r);
}
