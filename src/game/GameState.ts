import type { GeneratedMap, NestPlacement } from '../world/MapGenerator.ts';
import { ECONOMY } from '../config/Tuning.ts';
import { PerkManager, type PerkMods } from '../progression/Perks.ts';
import { PERK_POOL } from '../config/PerkPool.ts';

/** Placeholder handle; real shape lands in M3/M4/M6. */
export interface BuildingHandle {
  id: string;
  slotId: string;
  kind: 'barracks' | 'market' | 'blacksmith';
}

/** Placeholder handle; real shape lands in M4. */
export interface HeroHandle {
  id: string;
  kind: 'warrior' | 'archer';
}

/**
 * Central mutable state. Intentionally permissive — later milestones extend it.
 *
 * M7 additions:
 *  - `perks`: controller for roguelite perk pool (offer/choose).
 *  - `perkMods`: live reference to `perks.mods`; read by M3/M4/M5/M6 systems
 *    (do NOT copy — callers rely on mutations propagating).
 */
export class GameState {
  readonly seed: number;
  map: GeneratedMap;
  nests: NestPlacement[];
  kingdomGold: number;
  buildings: BuildingHandle[] = [];
  heroes: HeroHandle[] = [];
  readonly perks: PerkManager;
  readonly perkMods: PerkMods;

  constructor(seed: number, map: GeneratedMap) {
    this.seed = seed;
    this.map = map;
    this.nests = [...map.nests];
    this.kingdomGold = ECONOMY.startingGold;
    this.perks = new PerkManager(PERK_POOL);
    this.perkMods = this.perks.mods; // live reference, not a copy
  }
}
