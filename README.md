# Frontier Majesty

Браузерный MVP indirect-strategy игры в духе Majesty: игрок строит экономику, здания и инфраструктуру, а герои действуют автономно. Репозиторий хранит Three.js + TypeScript игру, roadmap M1-M10 и игровую архитектуру.

## Что внутри

| Путь | Роль |
|---|---|
| `docs/PRD.md` | полный product/game spec |
| `src/game/` | loop, state, clock, events |
| `src/world/` | map generation, navgrid, pathfinding |
| `src/entities/` | buildings, heroes, monsters |
| `src/ai/` | hero/monster AI |
| `src/rendering/` | Three.js renderer, camera, assets |
| `src/ui/` | HUD, build menu, end screen |
| `src/config/` | tuning values и PRD numbers |

## Запуск

```bash
pnpm install
pnpm dev
```

Открыть `http://localhost:5173`.
