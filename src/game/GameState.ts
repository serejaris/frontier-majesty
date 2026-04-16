import type { GeneratedMap, NestPlacement } from '../world/MapGenerator.ts';
import { ECONOMY } from '../config/Tuning.ts';
import { Treasury } from '../economy/Treasury.ts';
import type { Building } from '../entities/Building.ts';
import { createBuildingSlot, type BuildingSlot } from '../entities/BuildingSlot.ts';

/** Placeholder handle for M4+. */
export interface HeroHandle {
  id: string;
  kind: 'warrior' | 'archer';
}

/**
 * Perk modifiers surface. M7 owns the real shape; we type it as optional
 * so M3 can compile whether or not M7 has been merged.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type PerkMods = any;

/**
 * Central mutable state. Intentionally permissive — later milestones extend it.
 */
export class GameState {
  readonly seed: number;
  map: GeneratedMap;
  nests: NestPlacement[];
  kingdomGold: number;
  treasury: Treasury;
  buildings: Building[] = [];
  slots: BuildingSlot[];
  heroes: HeroHandle[] = [];
  perkMods?: PerkMods;

  constructor(seed: number, map: GeneratedMap) {
    this.seed = seed;
    this.map = map;
    this.nests = [...map.nests];
    this.kingdomGold = ECONOMY.startingGold;
    this.slots = map.slots.map((s) => createBuildingSlot(s.id, s.x, s.z));
    this.treasury = new Treasury(
      ECONOMY.startingGold,
      () => this.perkMods?.goldTickMultiplier ?? 1,
    );
  }
}
