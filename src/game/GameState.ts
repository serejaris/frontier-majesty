import type { GeneratedMap, NestPlacement } from '../world/MapGenerator.ts';
import { ECONOMY } from '../config/Tuning.ts';

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
 */
export class GameState {
  readonly seed: number;
  map: GeneratedMap;
  nests: NestPlacement[];
  kingdomGold: number;
  buildings: BuildingHandle[] = [];
  heroes: HeroHandle[] = [];

  constructor(seed: number, map: GeneratedMap) {
    this.seed = seed;
    this.map = map;
    this.nests = [...map.nests];
    this.kingdomGold = ECONOMY.startingGold;
  }
}
