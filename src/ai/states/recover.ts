import type { Hero } from '../../entities/Hero.ts';
import type { GameState } from '../../game/GameState.ts';
import type { NavGrid } from '../../world/NavGrid.ts';
import type { Pathfinder } from '../../world/Pathfinder.ts';
import type { AIWorld } from '../HeroAI.ts';

/**
 * Idle inside the safe zone — Hero.update's regen (4%/s in safe zone) handles
 * the actual healing. We just clear movement so the hero stops cleanly.
 */
export function actRecover(
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
