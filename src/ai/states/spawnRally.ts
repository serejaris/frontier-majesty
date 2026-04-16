import type { Hero } from '../../entities/Hero.ts';
import type { GameState } from '../../game/GameState.ts';
import type { NavGrid } from '../../world/NavGrid.ts';
import type { Pathfinder } from '../../world/Pathfinder.ts';
import type { AIWorld } from '../HeroAI.ts';

/**
 * Stay near the barracks for the rally window. The actual rally timer is
 * tracked on `hero.rallyUntil` (set when the hero is recruited); this state
 * just clears any stale destination so the hero stops cleanly.
 */
export function actSpawnRally(
  hero: Hero,
  _dt: number,
  _state: GameState,
  _world: AIWorld,
  _nav: NavGrid,
  _pathfinder: Pathfinder,
): void {
  hero.clearDestination();
  hero.currentTarget = null;
}
