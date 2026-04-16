import type { Hero } from '../../entities/Hero.ts';
import type { GameState } from '../../game/GameState.ts';
import type { NavGrid } from '../../world/NavGrid.ts';
import type { Pathfinder } from '../../world/Pathfinder.ts';
import type { AIWorld } from '../HeroAI.ts';
import { HEROES } from '../../config/Tuning.ts';
import { distance2d } from '../../util/Math.ts';
import { createRng } from '../../util/Random.ts';

/**
 * Patrol — slow pacing on the inner ring (PRD §10.1, §10.2 fallback).
 *
 * Each hero gets a deterministic per-id RNG for waypoint jitter so two heroes
 * with similar ids don't synchronize their patrol paths.
 */
const _wanderRng = new Map<string, ReturnType<typeof createRng>>();
const _nextRepick = new Map<string, number>();

function rngFor(hero: Hero, seed: number): ReturnType<typeof createRng> {
  const cached = _wanderRng.get(hero.id);
  if (cached) return cached;
  const r = createRng((stringHash(hero.id) ^ seed) >>> 0);
  _wanderRng.set(hero.id, r);
  return r;
}

function stringHash(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
  return h >>> 0;
}

export function actPatrol(
  hero: Hero,
  _dt: number,
  state: GameState,
  world: AIWorld,
  _nav: NavGrid,
  _pathfinder: Pathfinder,
): void {
  hero.currentTarget = null;
  const cap = world.capital;
  const dCap = distance2d(hero.position.x, hero.position.z, cap.position.x, cap.position.z);
  const ringMin = HEROES.patrolRingMin;
  const ringMax = HEROES.patrolRingMax;
  const next = _nextRepick.get(hero.id) ?? 0;
  const inBand = dCap >= ringMin && dCap <= ringMax;

  // Re-pick a waypoint every 3-6s, or if hero arrived/strayed from band.
  const noDest = !hero.targetPosition;
  if (state.simT >= next || (!inBand && noDest)) {
    const rng = rngFor(hero, state.seed);
    const ang = rng.next() * Math.PI * 2;
    const r = ringMin + rng.next() * (ringMax - ringMin);
    hero.setDestination(cap.position.x + Math.cos(ang) * r, cap.position.z + Math.sin(ang) * r);
    _nextRepick.set(hero.id, state.simT + 3 + rng.next() * 3);
  }
}
