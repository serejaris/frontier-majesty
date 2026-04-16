import type { Hero } from '../entities/Hero.ts';
import type { Nest } from '../entities/Nest.ts';
import { distance2d } from '../util/Math.ts';

/**
 * Assigns heroes to nests based on PRD §10.3 desired-force quotas:
 *  - Near nests: 1 Warrior + 1 of any class
 *  - Mid  nests: 1 Warrior + 2 of any class
 *  - Far  nests: 2 Warrior + 2 Archer
 *
 * Heroes "shopping", "retreating", or in active combat near the capital are
 * skipped. Archers prefer nests where a Warrior is already assigned.
 *
 * Returns a map of hero.id → nest.id (or null = no assignment).
 *
 * Recompute is cheap (O(heroes × nests)) — call from each hero's reconsider
 * tick, or once per simulation tick.
 */
export interface AssignmentResult {
  /** hero.id → nest.id (null if hero is unassigned). */
  byHero: Map<string, string | null>;
  /** nest.id → list of assigned hero ids in priority order. */
  byNest: Map<string, string[]>;
}

interface Quota {
  warriors: number;
  any: number;
  archers: number;
}

function quotaFor(tier: Nest['tier']): Quota {
  switch (tier) {
    case 'near':
      return { warriors: 1, any: 1, archers: 0 };
    case 'mid':
      return { warriors: 1, any: 2, archers: 0 };
    case 'far':
      return { warriors: 2, any: 0, archers: 2 };
  }
}

export function assign(
  heroes: readonly Hero[],
  nests: readonly Nest[],
  capitalAlarm: boolean,
): AssignmentResult {
  const byHero = new Map<string, string | null>();
  const byNest = new Map<string, string[]>();

  // Capital alarm: drop all assignments — heroes defend.
  if (capitalAlarm) {
    for (const h of heroes) byHero.set(h.id, null);
    for (const n of nests) byNest.set(n.id, []);
    return { byHero, byNest };
  }

  // Initialize remaining quotas + empty rosters.
  const remaining = new Map<string, Quota>();
  for (const n of nests) {
    if (!n.alive) continue;
    remaining.set(n.id, { ...quotaFor(n.tier) });
    byNest.set(n.id, []);
  }

  // Eligible heroes: alive, not currently shopping/retreating/recovering.
  const eligible = heroes.filter((h) => {
    if (!h.alive) return false;
    if (!h.ai) return false;
    const s = h.ai.current;
    if (s === 'shop-market' || s === 'shop-blacksmith' || s === 'retreat' || s === 'recover') {
      return false;
    }
    return true;
  });

  // Pass 1 — Warriors fill warrior slots, then any-slots in remaining quota.
  // Archers prefer nests where a warrior is already present (boost factor).
  // Sort assignment by (hero, nearest free nest with quota).
  // We do simple greedy: per hero, pick the lowest-cost (distance + class-fit) nest.
  for (const hero of eligible) {
    let bestId: string | null = null;
    let bestScore = Infinity;
    for (const nest of nests) {
      if (!nest.alive) continue;
      const q = remaining.get(nest.id);
      if (!q) continue;

      const fits = canFit(hero, q);
      if (!fits) continue;

      const d = distance2d(hero.position.x, hero.position.z, nest.position.x, nest.position.z);
      let score = d;

      // Archer preference: boost (lower score) if warrior already on this nest.
      if (hero.kind === 'archer') {
        const roster = byNest.get(nest.id)!;
        const hasWarrior = roster.some((hid) => heroes.find((h) => h.id === hid)?.kind === 'warrior');
        if (hasWarrior) score *= 0.6;
        else score *= 1.4;
      }

      if (score < bestScore) {
        bestScore = score;
        bestId = nest.id;
      }
    }
    if (bestId) {
      const q = remaining.get(bestId)!;
      consume(hero, q);
      byHero.set(hero.id, bestId);
      byNest.get(bestId)!.push(hero.id);
    } else {
      byHero.set(hero.id, null);
    }
  }

  return { byHero, byNest };
}

function canFit(hero: Hero, q: Quota): boolean {
  if (hero.kind === 'warrior') {
    return q.warriors > 0 || q.any > 0;
  }
  // Archer: prefer dedicated archer slots, fall back to any.
  return q.archers > 0 || q.any > 0;
}

function consume(hero: Hero, q: Quota): void {
  if (hero.kind === 'warrior') {
    if (q.warriors > 0) q.warriors -= 1;
    else if (q.any > 0) q.any -= 1;
    return;
  }
  if (q.archers > 0) q.archers -= 1;
  else if (q.any > 0) q.any -= 1;
}
