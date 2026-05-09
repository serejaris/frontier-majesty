<!-- hq-readme-ru: 2026-05-09 -->
# frontier-majesty

Коротко: Браузерная indirect-strategy игра на Three.js + TypeScript.

## Что здесь

- Назначение: Браузерная indirect-strategy игра на Three.js + TypeScript.
- Основной стек: TypeScript.
- Видимость: публичный репозиторий.
- Статус: активный репозиторий; актуальность проверять по issues и последним коммитам.

## Где смотреть работу

- Задачи и текущие решения: GitHub Issues этого репозитория.
- Код и материалы: файлы в корне и профильные папки проекта.
- Связь с HQ: если проект влияет на продукт, контент или воронку, сверяйте канон в `0_hq` и репозитории-владельце.

## Для агентов

- Сначала прочитайте этот README и открытые issues.
- Не переносите сюда канон соседних проектов без ссылки на источник.
- Перед правками проверьте существующие scripts, package.json/pyproject и локальные инструкции.

---

## Исходный README

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
