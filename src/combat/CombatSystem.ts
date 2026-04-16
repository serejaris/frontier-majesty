import type { Hero, HeroTarget } from '../entities/Hero.ts';
import type { Monster } from '../entities/Monster.ts';
import type { Nest } from '../entities/Nest.ts';
import type { HitFlash } from '../rendering/HitFlash.ts';
import type { PerkMods } from '../progression/Perks.ts';
import { COMBAT, ECONOMY, HEROES } from '../config/Tuning.ts';
import { distance2d } from '../util/Math.ts';

/** Events surfaced to `Game` so it can remove meshes, toggle perks, etc. */
export interface CombatEvents {
  onHeroDied: (hero: Hero) => void;
  onMonsterDied: (monster: Monster) => void;
  onNestDestroyed: (nest: Nest) => void;
}

/** World-view the combat system needs; supplied by `Game` each tick. */
export interface CombatWorld {
  simT: number;
  heroes: Hero[];
  monsters: Monster[];
  nests: Nest[];
  perkMods: PerkMods;
  hitFlash: HitFlash;
}

/**
 * CombatSystem — minimal target-picking + damage + reward split (PRD §12, §13.2, §7.4).
 *
 * Per-tick responsibilities:
 *  1. For each alive hero: pick nearest eligible target (monster in aggro, else nearby nest);
 *     if in range + cooldown elapsed → attack → hit flash.
 *  2. Collect deaths; award XP+gold splits proportionally to attacker damage.
 *  3. Surface events for scene-graph / UI cleanup.
 *
 * Retargeting is gated to every `HEROES.retargetPeriod` seconds for determinism
 * and to avoid jitter.
 */
export class CombatSystem {
  /** Keyed by hero id; `simT` of the last retarget pass. */
  private readonly lastRetarget = new Map<string, number>();

  tick(world: CombatWorld, events: CombatEvents): void {
    // --- 1. Hero targeting + attacks.
    for (const hero of world.heroes) {
      if (!hero.alive) continue;
      // Skip targeting during rally.
      if (world.simT < hero.rallyUntil) continue;
      // Retarget on interval, or when current target is invalid.
      const prevT = this.lastRetarget.get(hero.id) ?? -Infinity;
      const needsRetarget =
        world.simT - prevT >= HEROES.retargetPeriod ||
        !hero.currentTarget ||
        !hero.currentTarget.alive;

      if (needsRetarget) {
        this.lastRetarget.set(hero.id, world.simT);
        hero.currentTarget = pickHeroTarget(hero, world);
      }

      const tgt = hero.currentTarget;
      if (!tgt || !tgt.alive) {
        // No target: hero remains at anchor. A future M5 state could add patrol.
        continue;
      }

      // Move toward the target if not already in range.
      const dTgt = distance2d(
        hero.position.x,
        hero.position.z,
        tgt.position.x,
        tgt.position.z,
      );
      if (dTgt > hero.attackRange) {
        hero.setDestination(tgt.position.x, tgt.position.z);
      } else {
        hero.clearDestination();
        // Attack on cooldown; hit-flash on impact.
        const period = 1 / Math.max(0.01, hero.attackRate);
        if (world.simT - hero.lastAttackT >= period) {
          applyHeroAttack(hero, tgt, world);
          flashTarget(tgt, world.hitFlash);
        }
      }
    }

    // --- 2. Resolve monster deaths.
    for (let i = world.monsters.length - 1; i >= 0; i--) {
      const m = world.monsters[i]!;
      if (m.alive) continue;
      distributeMonsterReward(m, world);
      events.onMonsterDied(m);
      world.monsters.splice(i, 1);
    }

    // --- 3. Resolve nest deaths.
    for (let i = world.nests.length - 1; i >= 0; i--) {
      const n = world.nests[i]!;
      if (n.alive) continue;
      distributeNestReward(n, world);
      events.onNestDestroyed(n);
      world.nests.splice(i, 1);
    }

    // --- 4. Resolve hero deaths.
    for (let i = world.heroes.length - 1; i >= 0; i--) {
      const h = world.heroes[i]!;
      if (h.alive) continue;
      events.onHeroDied(h);
      // Clear retarget bookkeeping.
      this.lastRetarget.delete(h.id);
      world.heroes.splice(i, 1);
    }
  }
}

// ---------------- helpers ----------------

function applyHeroAttack(hero: Hero, tgt: HeroTarget, world: CombatWorld): void {
  const mods = world.perkMods;
  let damage = hero.baseDamage;
  if (tgt.type === 'nest') damage *= mods.nestDamageMultiplier;
  // Archer low-hp bonus (perk): fire only against targets <50% HP.
  if (hero.kind === 'archer' && mods.archerLowHpDamageBonus > 0 && tgt.hp / tgt.maxHp < 0.5) {
    damage *= 1 + mods.archerLowHpDamageBonus;
  }
  hero.lastAttackT = world.simT;
  hero.inCombat = true;
  hero.combatCooldown = 0;
  tgt.applyDamage(damage, hero.id, world.simT);
}

function flashTarget(tgt: HeroTarget, hitFlash: HitFlash): void {
  hitFlash.flash(tgt.mesh);
}

function pickHeroTarget(hero: Hero, world: CombatWorld): HeroTarget | null {
  // Rally phase: no targeting.
  if (world.simT < hero.rallyUntil) return null;

  const leashR = HEROES.engagementLeashRadius;
  let best: HeroTarget | null = null;
  let bestD = Infinity;

  // Monsters first.
  for (const m of world.monsters) {
    if (!m.alive) continue;
    const dHero = distance2d(hero.position.x, hero.position.z, m.position.x, m.position.z);
    if (dHero > HEROES.aggroRadius) continue;
    const dAnchor = distance2d(hero.anchorX, hero.anchorZ, m.position.x, m.position.z);
    if (dAnchor > leashR) continue;
    if (dHero < bestD) {
      bestD = dHero;
      best = m;
    }
  }
  if (best) return best;

  // Nest fallback: pick nearest nest within reach + a generous range.
  for (const n of world.nests) {
    if (!n.alive) continue;
    const dHero = distance2d(hero.position.x, hero.position.z, n.position.x, n.position.z);
    // Heroes will walk to a nest even when it's farther than aggro, but still within leash.
    const dAnchor = distance2d(hero.anchorX, hero.anchorZ, n.position.x, n.position.z);
    if (dAnchor > leashR * 1.5) continue;
    if (dHero < bestD) {
      bestD = dHero;
      best = n;
    }
  }
  return best;
}

function distributeMonsterReward(m: Monster, world: CombatWorld): void {
  const totalXp = COMBAT.monsterKillXp * world.perkMods.xpMultiplier;
  splitRewards(m.attackers, world, totalXp, ECONOMY.monsterKillGold);
}

function distributeNestReward(n: Nest, world: CombatWorld): void {
  const totalXp = COMBAT.nestKillXp * world.perkMods.xpMultiplier;
  splitRewards(n.attackers, world, totalXp, ECONOMY.nestKillGold);
}

function splitRewards(
  attackers: ReadonlyMap<string, { heroId: string; damage: number; lastT: number }>,
  world: CombatWorld,
  totalXp: number,
  totalGold: number,
): void {
  // Filter attackers in-window; build proportional shares.
  const winning: Array<{ heroId: string; damage: number }> = [];
  let totalDmg = 0;
  for (const a of attackers.values()) {
    if (world.simT - a.lastT > COMBAT.attackerWindowSec) continue;
    winning.push({ heroId: a.heroId, damage: a.damage });
    totalDmg += a.damage;
  }
  if (winning.length === 0 || totalDmg <= 0) return;

  let goldRemaining = totalGold;
  for (let i = 0; i < winning.length; i++) {
    const w = winning[i]!;
    const hero = world.heroes.find((h) => h.id === w.heroId) ?? null;
    if (!hero || !hero.alive) continue;
    const frac = w.damage / totalDmg;
    const xpShare = Math.max(COMBAT.minRewardXp, Math.round(totalXp * frac));
    // Last attacker mops up leftover gold to avoid rounding drift.
    let goldShare: number;
    if (i === winning.length - 1) {
      goldShare = Math.max(COMBAT.minRewardGold, goldRemaining);
    } else {
      goldShare = Math.max(COMBAT.minRewardGold, Math.floor(totalGold * frac));
      goldRemaining -= goldShare;
    }
    // We already folded xpMult into totalXp above.
    hero.grantXp(xpShare, 1);
    hero.personalGold += goldShare;
  }
}
