export const MAP = {
  width: 3840,
  height: 2160,
  cellSize: 40,
} as const;

export const CAMERA = {
  pitchDeg: 55,
  heightAbove: 1200,
  orthoZoomWidth: 2200,
  panSpeed: 900,
  dragSpeed: 1.5,
  edgePanMargin: 12,
  edgePanSpeed: 700,
} as const;

export const WORLD = {
  groundColor: 0x4c6b3a,
  skyColor: 0xa6c3dc,
} as const;

export const ECONOMY = {
  startingGold: 180,
  goldTickPerSec: 2,
  barracksCost: 100,
  marketCost: 90,
  blacksmithCost: 120,
  warriorCost: 60,
  archerCost: 70,
  potionPrice: 25,
} as const;
