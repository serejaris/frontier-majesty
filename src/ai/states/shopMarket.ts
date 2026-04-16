import type { Hero } from '../../entities/Hero.ts';
import type { GameState } from '../../game/GameState.ts';
import type { NavGrid } from '../../world/NavGrid.ts';
import type { Pathfinder } from '../../world/Pathfinder.ts';
import type { AIWorld } from '../HeroAI.ts';
import type { HeroAI } from '../HeroAI.ts';
import { ECONOMY } from '../../config/Tuning.ts';
import { distance2d } from '../../util/Math.ts';

/**
 * Path to the Market and buy a single Healing Potion. After purchase, set a
 * brief service-cooldown so we don't immediately try to shop again, and fall
 * through to next reconsider (which usually returns 'return-to-front').
 */
export function actShopMarket(
  hero: Hero,
  _dt: number,
  state: GameState,
  world: AIWorld,
  _nav: NavGrid,
  _pathfinder: Pathfinder,
  ai: HeroAI,
): void {
  const market = world.buildings.find((b) => b.kind === 'market');
  if (!market) {
    ai.current = 'patrol';
    hero.clearDestination();
    return;
  }
  const d = distance2d(hero.position.x, hero.position.z, market.position.x, market.position.z);
  if (d > 60) {
    hero.setDestination(market.position.x, market.position.z);
    return;
  }

  // Arrived. Try to buy.
  const cap = 1 + state.perkMods.potionCarryBonus;
  if (hero.potionCount >= cap) {
    ai.current = 'patrol';
    hero.clearDestination();
    return;
  }
  const price = ECONOMY.potionPrice * state.perkMods.potionPriceMultiplier;
  if (hero.personalGold >= price) {
    hero.personalGold -= price;
    hero.potionCount = Math.min(cap, hero.potionCount + 1);
  }
  ai.serviceCooldownUntil = state.simT + 4;
  ai.current = 'patrol';
  hero.clearDestination();
}
