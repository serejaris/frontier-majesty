import type { GeneratedMap } from '../world/MapGenerator.ts';
import { ECONOMY } from '../config/Tuning.ts';
import { Treasury } from '../economy/Treasury.ts';
import type { Building } from '../entities/Building.ts';
import { createBuildingSlot, type BuildingSlot } from '../entities/BuildingSlot.ts';
import { PerkManager, type PerkMods } from '../progression/Perks.ts';
import { PERK_POOL } from '../config/PerkPool.ts';
import type { Hero } from '../entities/Hero.ts';
import type { Monster } from '../entities/Monster.ts';
import type { Nest } from '../entities/Nest.ts';
import { Capital } from '../entities/Capital.ts';

/**
 * Central mutable state. Intentionally permissive — later milestones extend it.
 *
 * M4 additions:
 *  - live hero / monster / nest lists (swapped in for map.nests placements)
 *  - recruitCount for `perkMods.freeHirePeriod`
 *  - simT for attack cooldowns + rally timing
 */
export class GameState {
  readonly seed: number;
  map: GeneratedMap;
  kingdomGold: number;
  treasury: Treasury;
  buildings: Building[] = [];
  slots: BuildingSlot[];
  heroes: Hero[] = [];
  monsters: Monster[] = [];
  nests: Nest[] = [];
  /** Monotonic recruit counter — drives `perkMods.freeHirePeriod`. */
  recruitCount = 0;
  /** Simulation time in seconds since Game start. Advanced by fixed-step update. */
  simT = 0;
  /** Total nests destroyed this run. */
  nestsDestroyed = 0;
  /** Once set, the Game has reported victory/defeat. Gate end-screen so it fires once. */
  endReported = false;
  /** Set by combat → onNestDestroyed; Game.step consumes it to open the perk picker. */
  pendingPerkPick = false;
  readonly perks: PerkManager;
  readonly perkMods: PerkMods;
  /** The Capital — loss condition + weak defense aura (PRD §7.1). */
  readonly capital: Capital;

  constructor(seed: number, map: GeneratedMap) {
    this.seed = seed;
    this.map = map;
    this.kingdomGold = ECONOMY.startingGold;
    this.slots = map.slots.map((s) => createBuildingSlot(s.id, s.x, s.z));
    this.perks = new PerkManager(PERK_POOL);
    this.perkMods = this.perks.mods;
    this.treasury = new Treasury(
      ECONOMY.startingGold,
      () => this.perkMods.goldTickMultiplier ?? 1,
    );
    this.capital = new Capital({ x: map.capital.x, z: map.capital.z });
  }
}
