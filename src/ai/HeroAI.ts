import type { Hero } from '../entities/Hero.ts';
import type { Monster } from '../entities/Monster.ts';
import type { Nest } from '../entities/Nest.ts';
import type { GameState } from '../game/GameState.ts';
import type { NavGrid } from '../world/NavGrid.ts';
import type { Pathfinder } from '../world/Pathfinder.ts';
import type { Building } from '../entities/Building.ts';
import type { Capital } from '../entities/Capital.ts';
import { HEROES, ECONOMY, equipmentRow } from '../config/Tuning.ts';
import { distance2d } from '../util/Math.ts';
import { assign } from './NestAssignment.ts';
import { actSpawnRally } from './states/spawnRally.ts';
import { actPatrol } from './states/patrol.ts';
import { actEngage } from './states/engage.ts';
import { actAssistAlly } from './states/assistAlly.ts';
import { actAssaultNest } from './states/assaultNest.ts';
import { actRetreat } from './states/retreat.ts';
import { actRecover } from './states/recover.ts';
import { actShopMarket } from './states/shopMarket.ts';
import { actShopBlacksmith } from './states/shopBlacksmith.ts';
import { actReturnToFront } from './states/returnToFront.ts';
import { trySkirmisherStep } from '../progression/ArcherStats.ts';

/** All hero AI states. PRD §10.1. */
export type HeroState =
  | 'spawn-rally'
  | 'patrol'
  | 'engage'
  | 'assist-ally'
  | 'assault-nest'
  | 'retreat'
  | 'recover'
  | 'shop-market'
  | 'shop-blacksmith'
  | 'return-to-front';

/**
 * ASCII glyphs surfaced through StatusIcons. Only "loud" states get a label —
 * PRD §12 wants combat/retreat/shop visible; other states are implied by
 * movement + HP bar. `null` hides the glyph (StatusIcons treats null as hidden).
 */
export const STATE_GLYPH: Record<HeroState, string | null> = {
  'spawn-rally': null,
  patrol: null,
  engage: null,
  'assist-ally': null,
  'assault-nest': null,
  retreat: 'FLEE',
  recover: null,
  'shop-market': 'BUY',
  'shop-blacksmith': 'FORGE',
  'return-to-front': null,
};

/** Snapshot the AI tick passes to state-act functions. */
export interface AIWorld {
  heroes: readonly Hero[];
  monsters: readonly Monster[];
  nests: readonly Nest[];
  buildings: readonly Building[];
  capital: Capital;
  /** Result of NestAssignment for this tick. */
  nestAssignmentByHero: ReadonlyMap<string, string | null>;
  /** True if any monster is within capitalThreatRadius of capital. */
  capitalAlarm: boolean;
}

const DEBUG = (() => {
  if (typeof window === 'undefined') return false;
  try {
    const q = new URLSearchParams(window.location.search);
    return q.get('aidebug') === '1';
  } catch {
    return false;
  }
})();

function log(...args: unknown[]): void {
  if (!DEBUG) return;
  // eslint-disable-next-line no-console
  console.log('[ai]', ...args);
}

/**
 * Per-hero priority FSM (PRD §10).
 *
 * `tick` is called once per fixed step from `Game.update`. It:
 *  1. Decrements `reconsiderCooldown`; reconsiders priorities every 0.5s
 *     (or immediately when state-specific triggers expire — e.g. potion use).
 *  2. Computes the AI snapshot (capital alarm + nest assignments) on the first
 *     hero per tick — subsequent heroes share via the cached snapshot in
 *     `_lastSnapshot`.
 *  3. Dispatches to the per-state `act*` function which sets `hero.targetPosition`
 *     / triggers immediate one-off actions.
 */
export class HeroAI {
  current: HeroState = 'spawn-rally';
  reconsiderCooldown = 0;
  /** Nest this hero is currently assigned to assault, if any. */
  nestAssignmentId: string | null = null;
  /** Building/capital target id for shop / retreat states. */
  serviceTargetId: string | null = null;
  /** When a service visit completes we record the timestamp here so we don't loop. */
  serviceCooldownUntil = 0;

  /** The shared per-tick snapshot. Built once per tick by `prepareSnapshot`. */
  private static _lastSnapshot: { simT: number; world: AIWorld } | null = null;

  /** Build (or reuse) the per-tick AIWorld snapshot. Called by every hero in turn. */
  private static prepareSnapshot(state: GameState): AIWorld {
    const cached = HeroAI._lastSnapshot;
    if (cached && cached.simT === state.simT) return cached.world;

    const capital = state.capital;
    let alarm = false;
    for (const m of state.monsters) {
      if (!m.alive) continue;
      const d = distance2d(m.position.x, m.position.z, capital.position.x, capital.position.z);
      if (d <= HEROES.capitalThreatRadius) {
        alarm = true;
        break;
      }
    }
    const result = assign(state.heroes, state.nests, alarm);
    const world: AIWorld = {
      heroes: state.heroes,
      monsters: state.monsters,
      nests: state.nests,
      buildings: state.buildings,
      capital,
      nestAssignmentByHero: result.byHero,
      capitalAlarm: alarm,
    };
    HeroAI._lastSnapshot = { simT: state.simT, world };
    return world;
  }

  tick(
    hero: Hero,
    dt: number,
    state: GameState,
    nav: NavGrid,
    pathfinder: Pathfinder,
  ): void {
    if (!hero.alive) return;

    const world = HeroAI.prepareSnapshot(state);

    // Stash allies snapshot for ability hooks (Guard, etc.).
    (hero as unknown as { _alliesSnapshot?: readonly Hero[] })._alliesSnapshot = world.heroes;

    // Auto-potion: triggered in the priority eval but applied here so it works
    // mid-state without waiting for next reconsider.
    if (autoApplyPotion(hero)) {
      log(hero.id, 'auto-potion at hp', hero.hp.toFixed(1));
    }

    // Update assignment slot.
    this.nestAssignmentId = world.nestAssignmentByHero.get(hero.id) ?? null;

    // Reconsider priorities every 0.5s, or immediately if the current state's target invalidates.
    this.reconsiderCooldown -= dt;
    if (this.reconsiderCooldown <= 0 || this.shouldForceReconsider(hero, world)) {
      const prev = this.current;
      this.current = this.reconsider(hero, state, world);
      this.reconsiderCooldown = HEROES.aiReconsiderPeriod;
      if (prev !== this.current) log(hero.id, prev, '→', this.current);
    }

    // Run per-state act.
    switch (this.current) {
      case 'spawn-rally':
        actSpawnRally(hero, dt, state, world, nav, pathfinder);
        break;
      case 'patrol':
        actPatrol(hero, dt, state, world, nav, pathfinder);
        break;
      case 'engage':
        actEngage(hero, dt, state, world, nav, pathfinder);
        break;
      case 'assist-ally':
        actAssistAlly(hero, dt, state, world, nav, pathfinder);
        break;
      case 'assault-nest':
        actAssaultNest(hero, dt, state, world, nav, pathfinder, this.nestAssignmentId);
        break;
      case 'retreat':
        actRetreat(hero, dt, state, world, nav, pathfinder);
        break;
      case 'recover':
        actRecover(hero, dt, state, world, nav, pathfinder);
        break;
      case 'shop-market':
        actShopMarket(hero, dt, state, world, nav, pathfinder, this);
        break;
      case 'shop-blacksmith':
        actShopBlacksmith(hero, dt, state, world, nav, pathfinder, this);
        break;
      case 'return-to-front':
        actReturnToFront(hero, dt, state, world, nav, pathfinder, this.nestAssignmentId);
        break;
    }

    // Skirmisher Step (Archer L5) reactive trigger — independent of FSM transitions.
    if (hero.kind === 'archer' && this.current !== 'retreat' && this.current !== 'shop-market' && this.current !== 'shop-blacksmith') {
      trySkirmisherStep(hero, world.monsters, state.simT);
    }
  }

  /**
   * Force an early reconsider when the current state's anchor disappears
   * (e.g. target died, nest fell, capital alarm started/ended).
   */
  private shouldForceReconsider(hero: Hero, world: AIWorld): boolean {
    // Capital alarm transition is high-priority — reconsider immediately.
    if (world.capitalAlarm && this.current !== 'engage' && this.current !== 'spawn-rally' && this.current !== 'retreat') {
      return true;
    }
    if (this.current === 'engage' && (!hero.currentTarget || !hero.currentTarget.alive)) return true;
    if (this.current === 'assault-nest' && !this.nestAssignmentId) return true;
    return false;
  }

  /** Priority eval per PRD §10.2. */
  reconsider(hero: Hero, state: GameState, world: AIWorld): HeroState {
    // 0. Spawn rally takes precedence until it elapses.
    if (state.simT < hero.rallyUntil) return 'spawn-rally';

    // 1. Capital threat — drop everything non-critical.
    if (world.capitalAlarm) {
      // Find the most threatening monster (closest to capital).
      const cap = world.capital;
      let nearest: Monster | null = null;
      let nd = Infinity;
      for (const m of world.monsters) {
        if (!m.alive) continue;
        const d = distance2d(m.position.x, m.position.z, cap.position.x, cap.position.z);
        if (d < nd) {
          nd = d;
          nearest = m;
        }
      }
      if (nearest) hero.currentTarget = nearest;
      return 'engage';
    }

    // 2. Self-preservation.
    const hpFrac = hero.hp / Math.max(1, hero.maxHp);
    const potionThresh = hero.kind === 'warrior' ? HEROES.warriorPotionThreshold : HEROES.archerPotionThreshold;
    const retreatThresh = hero.kind === 'warrior' ? HEROES.warriorRetreatThreshold : HEROES.archerRetreatThreshold;
    const resumeThresh = hero.kind === 'warrior' ? HEROES.warriorResumeThreshold : HEROES.archerResumeThreshold;

    if (hpFrac <= potionThresh && hero.potionCount > 0) {
      hero.applyPotion();
      // Continue evaluating — we still want to pick a sensible action.
    }
    // If already retreating and HP recovered above resume threshold, return to front.
    if (this.current === 'retreat' || this.current === 'recover') {
      if (hpFrac < resumeThresh) {
        // Stay in recover/retreat until resume threshold met.
        // If we're at safe zone keep recovering, else still retreating.
        const cap = world.capital;
        const dCap = distance2d(hero.position.x, hero.position.z, cap.position.x, cap.position.z);
        return dCap < HEROES.safeZoneRadius ? 'recover' : 'retreat';
      }
      // Otherwise resume: pick return-to-front fall-through below.
      return 'return-to-front';
    }
    if (hpFrac <= retreatThresh && hero.potionCount === 0) {
      return 'retreat';
    }

    // 3. Assist ally — only if we're not actively engaging.
    if (!hero.inCombat || !hero.currentTarget || !hero.currentTarget.alive) {
      const ally = nearestAllyInCombat(hero, world.heroes, HEROES.assistAllyRadius);
      if (ally) return 'assist-ally';
    }

    // 4. Finishing current fight.
    if (this.current === 'engage' && hero.currentTarget && hero.currentTarget.alive) {
      const d = distance2d(
        hero.position.x,
        hero.position.z,
        hero.currentTarget.position.x,
        hero.currentTarget.position.z,
      );
      if (d <= HEROES.engagementLeashRadius) return 'engage';
    }

    // Aggressive enemies pulling us into combat — engage even from patrol.
    const tgt = pickEngageTarget(hero, world);
    if (tgt) {
      hero.currentTarget = tgt;
      return 'engage';
    }

    // 5. Service visit (Market / Blacksmith).
    const outOfCombatLong = state.simT - hero.lastInCombatT >= HEROES.outOfCombatForServiceSeconds;
    if (!world.capitalAlarm && outOfCombatLong && state.simT >= this.serviceCooldownUntil) {
      // Market: no potion + can afford + market exists.
      const market = world.buildings.find((b) => b.kind === 'market');
      const potionCap = 1 + state.perkMods.potionCarryBonus;
      const potionPrice = ECONOMY.potionPrice * state.perkMods.potionPriceMultiplier;
      if (market && hero.potionCount < potionCap && hero.personalGold >= potionPrice) {
        this.serviceTargetId = market.id;
        return 'shop-market';
      }
      // Blacksmith: at least one upgrade available + can afford.
      const smith = world.buildings.find((b) => b.kind === 'blacksmith');
      if (smith) {
        const next = nextSmithUpgrade(hero);
        if (next) {
          let price = next.price;
          if (!hero.firstSmithPurchaseMade && state.perkMods.firstSmithUpgradeDiscount > 0) {
            price *= 1 - state.perkMods.firstSmithUpgradeDiscount;
          }
          if (hero.personalGold >= price && tierAllowed(hero, next.kind, next.tier)) {
            this.serviceTargetId = smith.id;
            return 'shop-blacksmith';
          }
        }
      }
    }

    // 6. Assault nest — assigned by NestAssignment.
    if (this.nestAssignmentId) {
      const nest = world.nests.find((n) => n.id === this.nestAssignmentId);
      if (nest && nest.alive) return 'assault-nest';
    }

    // 7. Patrol fallback.
    return 'patrol';
  }
}

// ---------------- helpers (exported for state files) ----------------

export function nearestAllyInCombat(hero: Hero, allies: readonly Hero[], radius: number): Hero | null {
  let best: Hero | null = null;
  let bestD = radius;
  for (const a of allies) {
    if (a === hero || !a.alive) continue;
    if (!a.inCombat) continue;
    if (!a.currentTarget || !a.currentTarget.alive) continue;
    const d = distance2d(hero.position.x, hero.position.z, a.position.x, a.position.z);
    if (d < bestD) {
      bestD = d;
      best = a;
    }
  }
  return best;
}

/** Hero target selection per class priority (PRD §10.4 Warrior / §10.5 Archer). */
export function pickEngageTarget(hero: Hero, world: AIWorld): Monster | Nest | null {
  if (hero.kind === 'warrior') return pickWarriorTarget(hero, world);
  return pickArcherTarget(hero, world);
}

function pickWarriorTarget(hero: Hero, world: AIWorld): Monster | Nest | null {
  // 1. Monster attacking capital.
  const cap = world.capital;
  for (const m of world.monsters) {
    if (!m.alive) continue;
    const dCap = distance2d(m.position.x, m.position.z, cap.position.x, cap.position.z);
    if (dCap <= HEROES.capitalThreatRadius) {
      const dHero = distance2d(hero.position.x, hero.position.z, m.position.x, m.position.z);
      if (dHero <= HEROES.engagementLeashRadius) return m;
    }
  }

  // 2. Monster attacking a nearby Archer.
  for (const ally of world.heroes) {
    if (ally === hero || !ally.alive || ally.kind !== 'archer') continue;
    const dAlly = distance2d(hero.position.x, hero.position.z, ally.position.x, ally.position.z);
    if (dAlly > HEROES.assistAllyRadius) continue;
    for (const m of world.monsters) {
      if (!m.alive) continue;
      // Monster targeting archer (proximity proxy).
      const dArcher = distance2d(m.position.x, m.position.z, ally.position.x, ally.position.z);
      if (dArcher < 100) return m;
    }
  }

  // 3. Nearest enemy in aggro.
  let best: Monster | Nest | null = null;
  let bestD = Infinity;
  for (const m of world.monsters) {
    if (!m.alive) continue;
    const d = distance2d(hero.position.x, hero.position.z, m.position.x, m.position.z);
    if (d > HEROES.aggroRadius) continue;
    if (d < bestD) {
      bestD = d;
      best = m;
    }
  }
  if (best) return best;

  // 4/5. Nest defenders / nest itself (handled by assault-nest state).
  return null;
}

function pickArcherTarget(hero: Hero, world: AIWorld): Monster | Nest | null {
  const r = hero.attackRange;

  // 1. Enemy already engaged by a nearby Warrior.
  for (const ally of world.heroes) {
    if (ally === hero || !ally.alive || ally.kind !== 'warrior') continue;
    if (!ally.currentTarget || !ally.currentTarget.alive) continue;
    if (ally.currentTarget.type !== 'monster') continue;
    const tgt = ally.currentTarget as unknown as Monster;
    const d = distance2d(hero.position.x, hero.position.z, tgt.position.x, tgt.position.z);
    if (d <= r * 1.2) return tgt;
  }

  // 2. Lowest-HP monster within aggro.
  let lowHp: Monster | null = null;
  let lowHpFrac = Infinity;
  for (const m of world.monsters) {
    if (!m.alive) continue;
    const d = distance2d(hero.position.x, hero.position.z, m.position.x, m.position.z);
    if (d > HEROES.aggroRadius) continue;
    const f = m.hp / Math.max(1, m.maxHp);
    if (f < lowHpFrac) {
      lowHpFrac = f;
      lowHp = m;
    }
  }
  if (lowHp && lowHpFrac < 0.6) return lowHp;

  // 3. Closest monster.
  let best: Monster | null = null;
  let bestD = Infinity;
  for (const m of world.monsters) {
    if (!m.alive) continue;
    const d = distance2d(hero.position.x, hero.position.z, m.position.x, m.position.z);
    if (d > HEROES.aggroRadius) continue;
    if (d < bestD) {
      bestD = d;
      best = m;
    }
  }
  return best;
}

/** Auto-drink potion if HP fell below the class threshold. Returns true on use. */
function autoApplyPotion(hero: Hero): boolean {
  if (hero.potionCount <= 0) return false;
  const f = hero.hp / Math.max(1, hero.maxHp);
  const t = hero.kind === 'warrior' ? HEROES.warriorPotionThreshold : HEROES.archerPotionThreshold;
  if (f > t) return false;
  return hero.applyPotion();
}

// ---------------- Smith purchase queues (PRD §14.4) ----------------

export interface SmithStep {
  kind: 'weapon' | 'armor';
  tier: 1 | 2 | 3;
  price: number;
}

const WARRIOR_QUEUE: ReadonlyArray<{ kind: 'weapon' | 'armor'; tier: 1 | 2 | 3 }> = [
  { kind: 'weapon', tier: 1 },
  { kind: 'armor', tier: 1 },
  { kind: 'weapon', tier: 2 },
  { kind: 'armor', tier: 2 },
  { kind: 'weapon', tier: 3 },
  { kind: 'armor', tier: 3 },
];

const ARCHER_QUEUE: ReadonlyArray<{ kind: 'weapon' | 'armor'; tier: 1 | 2 | 3 }> = [
  { kind: 'weapon', tier: 1 },
  { kind: 'weapon', tier: 2 },
  { kind: 'armor', tier: 1 },
  { kind: 'weapon', tier: 3 },
  { kind: 'armor', tier: 2 },
  { kind: 'armor', tier: 3 },
];

/** Next purchase step for the hero, or null if fully equipped. Prices come from EQUIPMENT. */
export function nextSmithUpgrade(hero: Hero): SmithStep | null {
  const queue = hero.kind === 'warrior' ? WARRIOR_QUEUE : ARCHER_QUEUE;
  for (const step of queue) {
    const have = step.kind === 'weapon' ? hero.weaponTier : hero.armorTier;
    if (have < step.tier) {
      const row = equipmentRow(step.kind, step.tier);
      const price = row ? row.price : 0;
      return { kind: step.kind, tier: step.tier, price };
    }
  }
  return null;
}

/** Tier unlock guard (PRD §14.2). */
export function tierAllowed(hero: Hero, _kind: 'weapon' | 'armor', tier: 1 | 2 | 3): boolean {
  if (tier === 1) return true; // implicit Blacksmith built since we're heading there
  if (tier === 2) return hero.level >= 3;
  if (tier === 3) return hero.level >= 5;
  return false;
}
