import type { Hero, HeroTarget } from '../entities/Hero.ts';
import type { Monster } from '../entities/Monster.ts';
import type { Nest } from '../entities/Nest.ts';
import type { HitFlash } from '../rendering/HitFlash.ts';
import type { PerkMods } from '../progression/Perks.ts';
import { COMBAT, ECONOMY, HEROES } from '../config/Tuning.ts';
import { distance2d } from '../util/Math.ts';
import { createRng } from '../util/Random.ts';
import type { AttackContext } from '../progression/Abilities.ts';

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

interface PendingCleave {
  from: HeroTarget;
  damage: number;
}

interface PendingVolley {
  from: HeroTarget;
  radius: number;
  damage: number;
}

/**
 * CombatSystem — target-validation + damage + reward split.
 *
 * In M5 the AI FSM (`HeroAI`) is responsible for picking targets and
 * positioning. CombatSystem just:
 *  - validates the FSM-supplied `hero.currentTarget` (alive + in range),
 *  - swings on cooldown, applying ability hooks (Cleave AOE, Volley second
 *    arrow, Champion +25% nest dmg, Marksman crits, Deadeye perk, etc.),
 *  - distributes XP / gold to attackers on monster + nest deaths,
 *  - applies the Triumph (perk) heal on nest destruction,
 *  - applies the Battle Rhythm (perk) attack-speed buff on monster kill.
 */
export class CombatSystem {
  /**
   * Per-hero deterministic RNG for tier crit rolls (Archer weapon T3 signature).
   * Keyed by hero id so each hero has a stable stream across ticks.
   */
  private readonly critRngs = new Map<string, ReturnType<typeof createRng>>();

  private critRng(heroId: string): ReturnType<typeof createRng> {
    let r = this.critRngs.get(heroId);
    if (!r) {
      let h = 2166136261;
      for (let i = 0; i < heroId.length; i++) h = Math.imul(h ^ heroId.charCodeAt(i), 16777619);
      r = createRng((h ^ 0xc1a17) >>> 0);
      this.critRngs.set(heroId, r);
    }
    return r;
  }

  tick(world: CombatWorld, events: CombatEvents): void {
    // --- 1. Hero attacks (targeting now lives in HeroAI).
    for (const hero of world.heroes) {
      if (!hero.alive) continue;
      if (world.simT < hero.rallyUntil) continue;

      const tgt = hero.currentTarget;
      if (!tgt || !tgt.alive) continue;

      const dTgt = distance2d(
        hero.position.x,
        hero.position.z,
        tgt.position.x,
        tgt.position.z,
      );
      if (dTgt > hero.attackRange) continue; // AI is responsible for closing.

      const period = 1 / Math.max(0.01, hero.attackRate);
      if (world.simT - hero.lastAttackT < period) continue;
      this.applyHeroAttack(hero, tgt, world);
      flashTarget(tgt, world.hitFlash);

      // After-attack abilities may have stashed cleave / volley requests.
      processStashedAbilities(hero, world);
    }

    // --- 2. Resolve monster deaths.
    for (let i = world.monsters.length - 1; i >= 0; i--) {
      const m = world.monsters[i]!;
      if (m.alive) continue;
      // Battle Rhythm — on-kill attack-speed buff to the killing blow's hero.
      const buff = world.perkMods.onKillAttackSpeedBuff;
      if (buff) {
        const lastHitter = pickLastAttacker(m.attackers, world);
        if (lastHitter) {
          lastHitter.buffs.attackRatePct = buff.percent / 100;
          lastHitter.buffs.attackRateRemaining = buff.duration;
        }
      }
      distributeMonsterReward(m, world);
      events.onMonsterDied(m);
      world.monsters.splice(i, 1);
    }

    // --- 3. Resolve nest deaths.
    for (let i = world.nests.length - 1; i >= 0; i--) {
      const n = world.nests[i]!;
      if (n.alive) continue;
      distributeNestReward(n, world);
      // Triumph — heal living heroes a fraction of maxHp on nest down.
      const heal = world.perkMods.onNestDestroyHealPercent;
      if (heal > 0) {
        for (const h of world.heroes) {
          if (!h.alive) continue;
          h.hp = Math.min(h.maxHp, h.hp + h.maxHp * heal);
        }
      }
      events.onNestDestroyed(n);
      world.nests.splice(i, 1);
    }

    // --- 4. Resolve hero deaths.
    for (let i = world.heroes.length - 1; i >= 0; i--) {
      const h = world.heroes[i]!;
      if (h.alive) continue;
      events.onHeroDied(h);
      world.heroes.splice(i, 1);
    }
  }

  private applyHeroAttack(hero: Hero, tgt: HeroTarget, world: CombatWorld): void {
    const mods = world.perkMods;
    const ctx: AttackContext = { damage: hero.baseDamage, crit: false };
    // Pre-attack ability hooks (Champion, Marksman, Focus Shot, ...).
    for (const ab of hero.abilities) ab.onBeforeAttack?.(hero, tgt, ctx, world.simT);

    // Archer weapon T3 signature: +10% crit chance (rolled after ability crits).
    if (hero.kind === 'archer' && !ctx.crit) {
      const critAdd = hero.weaponCritChanceBonus;
      if (critAdd > 0) {
        const rng = this.critRng(hero.id);
        if (rng.chance(critAdd)) {
          ctx.damage *= 2;
          ctx.crit = true;
        }
      }
    }

    // Warrior weapon T3 signature: +25% vs nests (additive with Champion L8 +25%).
    if (hero.kind === 'warrior' && tgt.type === 'nest') {
      const nestBonus = hero.weaponNestDamageBonus;
      if (nestBonus > 0) ctx.damage *= 1 + nestBonus;
    }

    if (tgt.type === 'nest') ctx.damage *= mods.nestDamageMultiplier;
    // Archer Deadeye perk: bonus vs <50% HP targets.
    if (hero.kind === 'archer' && mods.archerLowHpDamageBonus > 0 && tgt.hp / Math.max(1, tgt.maxHp) < 0.5) {
      ctx.damage *= 1 + mods.archerLowHpDamageBonus;
    }
    // Shield Wall perk: warrior-adjacency damage reduction is incoming-side; skip here.

    hero.lastAttackT = world.simT;
    hero.inCombat = true;
    hero.combatCooldown = 0;
    hero.lastInCombatT = world.simT;
    tgt.applyDamage(ctx.damage, hero.id, world.simT);

    // Post-attack ability hooks (Cleave, Volley counter increment, etc.).
    for (const ab of hero.abilities) ab.onAfterAttack?.(hero, tgt, ctx, world.simT);
  }
}

// ---------------- helpers ----------------

function processStashedAbilities(hero: Hero, world: CombatWorld): void {
  const stash = hero as unknown as { pendingCleaveDamage?: PendingCleave; pendingVolley?: PendingVolley };
  if (stash.pendingCleaveDamage) {
    const { from, damage } = stash.pendingCleaveDamage;
    let count = 0;
    for (const m of world.monsters) {
      if (count >= 2) break;
      if (!m.alive || m === from) continue;
      const d = distance2d(m.position.x, m.position.z, from.position.x, from.position.z);
      if (d <= 60) {
        m.applyDamage(damage, hero.id, world.simT);
        flashTarget(m, world.hitFlash);
        count++;
      }
    }
    stash.pendingCleaveDamage = undefined;
  }
  if (stash.pendingVolley) {
    const { from, radius, damage } = stash.pendingVolley;
    let bestTgt: Monster | null = null;
    let bestD = radius;
    for (const m of world.monsters) {
      if (!m.alive || m === from) continue;
      const d = distance2d(m.position.x, m.position.z, from.position.x, from.position.z);
      if (d < bestD) {
        bestD = d;
        bestTgt = m;
      }
    }
    if (bestTgt) {
      bestTgt.applyDamage(damage, hero.id, world.simT);
      flashTarget(bestTgt, world.hitFlash);
    }
    stash.pendingVolley = undefined;
  }

  // Shield Wall — upgrade incoming-side DR is applied as incoming-time buff.
  const mods = world.perkMods;
  if (hero.kind === 'warrior' && mods.warriorAdjacencyDamageReduction > 0) {
    let nearWarrior = false;
    for (const a of world.heroes) {
      if (a === hero || a.kind !== 'warrior' || !a.alive) continue;
      const d = distance2d(hero.position.x, hero.position.z, a.position.x, a.position.z);
      if (d <= 120) {
        nearWarrior = true;
        break;
      }
    }
    if (nearWarrior) {
      // Apply as transient damage reduction (overwrites only if larger). Tracked
      // via the same buff slot; refreshed each tick we're adjacent.
      hero.damageReductionBuff = Math.max(hero.damageReductionBuff, mods.warriorAdjacencyDamageReduction);
      hero.damageReductionRemaining = Math.max(hero.damageReductionRemaining, 0.5);
    }
  }
}

function flashTarget(tgt: HeroTarget, hitFlash: HitFlash): void {
  hitFlash.flash(tgt.mesh);
}

function pickLastAttacker(
  attackers: ReadonlyMap<string, { heroId: string; lastT: number }>,
  world: CombatWorld,
): Hero | null {
  let bestId: string | null = null;
  let bestT = -Infinity;
  for (const a of attackers.values()) {
    if (a.lastT > bestT) {
      bestT = a.lastT;
      bestId = a.heroId;
    }
  }
  if (!bestId) return null;
  return world.heroes.find((h) => h.id === bestId) ?? null;
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
    let goldShare: number;
    if (i === winning.length - 1) {
      goldShare = Math.max(COMBAT.minRewardGold, goldRemaining);
    } else {
      goldShare = Math.max(COMBAT.minRewardGold, Math.floor(totalGold * frac));
      goldRemaining -= goldShare;
    }
    hero.grantXp(xpShare, 1);
    hero.personalGold += goldShare;
  }
}

// HEROES is referenced via getter logic in Hero.ts; export remains for future tuning use.
export const __HEROES = HEROES;
