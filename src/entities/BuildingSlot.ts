import type { Building } from './Building.ts';

/**
 * Runtime state for a single build slot on the map.
 * Seeded once per game from `map.slots`; mutated as buildings are placed.
 */
export interface BuildingSlot {
  id: string;
  x: number;
  z: number;
  occupied: boolean;
  building?: Building;
}

export function createBuildingSlot(id: string, x: number, z: number): BuildingSlot {
  return { id, x, z, occupied: false };
}
