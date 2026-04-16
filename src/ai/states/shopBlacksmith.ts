import type { Hero } from '../../entities/Hero.ts';
import type { GameState } from '../../game/GameState.ts';
import type { NavGrid } from '../../world/NavGrid.ts';
import type { Pathfinder } from '../../world/Pathfinder.ts';
import type { AIWorld } from '../HeroAI.ts';
import { type HeroAI, nextSmithUpgrade, tierAllowed } from '../HeroAI.ts';
import { distance2d } from '../../util/Math.ts';
import { armorHpMult } from '../../entities/Hero.ts';

/**
 * Path to the Blacksmith and buy the next queued upgrade for this hero.
 * Applies the first-purchase discount once per hero, then bumps the relevant
 * tier and recomputes maxHp (armor) without disturbing current HP fraction.
 */
export function actShopBlacksmith(
  hero: Hero,
  _dt: number,
  state: GameState,
  world: AIWorld,
  _nav: NavGrid,
  _pathfinder: Pathfinder,
  ai: HeroAI,
): void {
  const smith = world.buildings.find((b) => b.kind === 'blacksmith');
  if (!smith) {
    ai.current = 'patrol';
    hero.clearDestination();
    return;
  }
  const d = distance2d(hero.position.x, hero.position.z, smith.position.x, smith.position.z);
  if (d > 60) {
    hero.setDestination(smith.position.x, smith.position.z);
    return;
  }

  const next = nextSmithUpgrade(hero);
  if (!next || !tierAllowed(hero, next.kind, next.tier)) {
    ai.serviceCooldownUntil = state.simT + 8;
    ai.current = 'patrol';
    hero.clearDestination();
    return;
  }
  let price = next.price;
  if (!hero.firstSmithPurchaseMade && state.perkMods.firstSmithUpgradeDiscount > 0) {
    price *= 1 - state.perkMods.firstSmithUpgradeDiscount;
  }
  if (hero.personalGold < price) {
    ai.serviceCooldownUntil = state.simT + 6;
    ai.current = 'patrol';
    hero.clearDestination();
    return;
  }
  hero.personalGold -= price;
  if (next.kind === 'weapon') {
    hero.weaponTier = next.tier;
  } else {
    const prevHpFrac = hero.hp / Math.max(1, hero.maxHp);
    hero.armorTier = next.tier;
    // Recompute max HP using existing class-base × new armor multiplier.
    // We re-derive class base from current maxHp / old armor mult.
    // Simpler: have the subclass re-apply level stats.
    // Re-apply: triggers Hero.applyLevelStats which uses armorHpMult.
    const prevMax = hero.maxHp;
    hero.applyLevelStats(prevMax);
    // Preserve the HP fraction the hero had before the upgrade.
    hero.hp = Math.min(hero.maxHp, Math.max(1, Math.round(hero.maxHp * prevHpFrac)));
    // Reference armorHpMult so unused-import linters stay happy.
    void armorHpMult;
  }
  hero.firstSmithPurchaseMade = true;
  ai.serviceCooldownUntil = state.simT + 8;
  ai.current = 'patrol';
  hero.clearDestination();
}
