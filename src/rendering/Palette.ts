/**
 * Curated low-poly palette. All values are 0xRRGGBB hex literals.
 *
 * Design intent (PRD §18.2):
 * - Cohesive saturation across families (slightly desaturated, painterly).
 * - Kingdom/hero = warm, readable accents; enemy = dark red/rust.
 * - Nest tiers escalate from warm orange -> red -> deep purple to signal threat.
 * - Environment (ground/sky/obstacles) stays muted so units pop.
 */
export const PALETTE = {
  // Kingdom / capital
  kingdomPrimary: 0xd8a84b,    // heraldic gold
  kingdomSecondary: 0xf2e6c7,  // cream stone

  // Heroes
  heroWarrior: 0x4a6a85,       // blue-steel plate
  heroArcher: 0x3f6b47,        // forest green cloak

  // Enemies
  enemyPrimary: 0x7a2a32,      // wine red hide
  enemySecondary: 0x3a1f1a,    // dark rust accents

  // Nest threat tiers
  nestNear: 0xd9702a,          // warm orange (low threat)
  nestMid: 0xa8322b,           // red (mid threat)
  nestFar: 0x4a2a66,           // deep purple (high threat)

  // Buildings — shared shell + per-type accent
  buildingRoof: 0x7a3a2a,          // muted terracotta roof
  buildingWall: 0xd9c9a3,          // warm stone wall
  buildingAccentBarracks: 0x5a6d7c,   // cool steel (military)
  buildingAccentMarket: 0xc47a3a,     // canopy warm ochre (commerce)
  buildingAccentBlacksmith: 0x2d2a27, // near-black soot (forge)

  // Obstacles
  obstacleStone: 0x8a8580,     // grey granite
  obstacleTree: 0x2f5a35,      // pine green foliage

  // Build slots
  slotHighlight: 0x9bd97a,     // soft green when buildable
  slotOccupied: 0x8a8a8a,      // neutral grey when taken

  // World (match existing WORLD tuning)
  ground: 0x4c6b3a,            // mirrors WORLD.groundColor
  sky: 0xa6c3dc,               // mirrors WORLD.skyColor
} as const;

export type PaletteKey = keyof typeof PALETTE;
