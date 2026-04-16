import type { Hero } from '../../entities/Hero.ts';
import type { GameState } from '../../game/GameState.ts';
import type { NavGrid } from '../../world/NavGrid.ts';
import type { Pathfinder } from '../../world/Pathfinder.ts';
import type { AIWorld } from '../HeroAI.ts';
import { HEROES } from '../../config/Tuning.ts';
import { distance2d } from '../../util/Math.ts';

/**
 * Walk toward the capital safe zone; ignore enemies (combat targeting is gated
 * by HeroAI in this state — `currentTarget` cleared so CombatSystem skips us).
 */
export function actRetreat(
  hero: Hero,
  _dt: number,
  _state: GameState,
  world: AIWorld,
  _nav: NavGrid,
  _pathfinder: Pathfinder,
): void {
  hero.currentTarget = null;
  const cap = world.capital;
  const d = distance2d(hero.position.x, hero.position.z, cap.position.x, cap.position.z);
  if (d > HEROES.safeZoneRadius * 0.6) {
    hero.setDestination(cap.position.x, cap.position.z);
  } else {
    hero.clearDestination();
  }
}
