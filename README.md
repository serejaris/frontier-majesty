# Frontier Majesty

Browser indirect-strategy MVP in the spirit of Majesty. Three.js + TypeScript.

## Vision

Player grows a frontier kingdom through economy, buildings, and hero recruitment, but never directly commands heroes. Infrastructure (barracks, market, blacksmith) is what heroes use autonomously — the player builds the stage, heroes play on it.

Full product spec: [docs/PRD.md](docs/PRD.md).

## Status

M1 (bootstrap) — in progress. Roadmap: M1–M10 milestones tracked in GitHub issues.

## Running locally

```bash
pnpm install
pnpm dev
```

Open http://localhost:5173.

## Stack

- Three.js (stylized low-poly 3D)
- TypeScript
- Vite
- No framework

## Layout

```
src/
  game/         # loop, state, clock, events
  world/        # map gen, navgrid, pathfinding
  entities/     # capital, buildings, heroes, monsters, nests
  ai/           # hero FSM, target priority, monster AI
  combat/       # auto-combat, damage calc
  progression/  # leveling, equipment, perks
  economy/      # treasury, personal wallet, rewards
  rendering/    # three.js renderer, camera, materials, assets
  ui/           # DOM overlay (HUD, build menu, perk picker, end screen)
  input/        # picking, camera input
  config/       # Tuning.ts — single source of truth for PRD numbers
  util/         # seeded RNG, math helpers
```

## License

TBD.
