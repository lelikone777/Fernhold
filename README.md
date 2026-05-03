# Fernhold

Fernhold is a cozy 2D village-builder foundation where the player restores an abandoned forest settlement: places buildings on a grid, spends resources, and shapes the map with a lightweight dev palette.

## Stack

- TypeScript (strict)
- Phaser 4
- Vite
- Tiled-ready map architecture
- Capacitor base config for future mobile packaging
- localStorage saves

## Run

```bash
npm install
npm run dev
```

Build and preview:

```bash
npm run build
npm run preview
```

Lint:

```bash
npm run lint
```

## Project Structure

```text
src/
  main.ts
  game/
    config.ts
    constants.ts
    scenes/
      BootScene.ts
      PreloadScene.ts
      WorldScene.ts
      UIScene.ts
    systems/
      BuildingSystem.ts
      ResourceSystem.ts
      SaveSystem.ts
      CameraSystem.ts
      InputSystem.ts
    entities/
      Building.ts
      Villager.ts
      ResourceNode.ts
    data/
      buildings.ts
      buildingAssetManifest.ts
      devFoliage.ts
      map.ts
      resources.ts
    types/
      game.ts
    utils/
      grid.ts
      storage.ts
      ids.ts
  ui/
    styles.css
    hud.ts
  assets/
    visual/
      buildings/
        placeholders/
        final/
    maps/
    ui/
public/
  assets/
    visual/
      buildings/
        placeholders/
        final/
```

## Implemented

- Scene pipeline: `Boot -> Preload -> World + UI`
- Grid world `64x64`, `tileSize: 32`
- Camera:
  - PC: WASD / arrows / mouse drag / wheel zoom
  - Mobile: touch drag / tap placement
- Square gameplay viewport with clamped camera bounds
- Top HUD with `wood`, `stone`, `food`, `tools`, `weapons`, `day`
- Village state in HUD:
  - `population`
  - `morale`
  - `housing`
  - `food/tools/weapons need`
- Left `Palette` panel with tabs:
  - `Trees`
  - `Buildings`
  - `Roads`
  - `Decor` (reserved)
- Building placement with placement validation and resource spending
- Building progression / unlock chain with locked reasons in UI
- Day-based economy loop with starter `Storage`
- Save/load for:
  - resources
  - village state
  - placed buildings
  - roads
  - foliage objects
  - day
  - camera state
- Reset save action

## Current Building Catalog

The project is wired for 20 building types:

- `small_house`
- `medium_house`
- `town_hall`
- `lumber_mill`
- `farmhouse`
- `barn`
- `storage`
- `well`
- `blacksmith`
- `workshop`
- `market_stall`
- `tavern`
- `watchtower`
- `shrine`
- `herb_hut`
- `fisher_hut`
- `bakery`
- `mason_yard`
- `stable`
- `large_storage`

## Art Direction

Fernhold targets a cozy pixel-art village simulator look:

- top-down / 3-4 game readability
- warm natural palette
- forest village mood
- wood, stone, moss, ferns, old paths, rustic details
- clean silhouette readability at small size
- handcrafted retro-game feel over flat vector shapes

## Building Art Pipeline

Runtime building art is intentionally split into stages:

- Active placeholders:
  - `public/assets/visual/buildings/placeholders/*`
- Reserved final art:
  - `public/assets/visual/buildings/final/*`

Source-of-truth manifest:

- `src/game/data/buildingAssetManifest.ts`

Pipeline notes:

- `src/assets/visual/README.md`
- `src/assets/visual/notes/pipeline.md`

Preview gallery:

- `public/building-art-gallery.html`

Current runtime uses technical placeholders by default. `small_house` is the only approved custom final sprite currently wired into the game.

## Roadmap

Milestone 1:

- grid map
- camera
- resources
- build mode
- foliage palette
- save/load
- 20-building asset pipeline

Milestone 2:

- Tiled map support
- production building sprite set
- better terrain layers
- better UI
- mobile polish

Milestone 3:

- villagers
- jobs
- pathfinding
- resource production
- crafting

Milestone 4:

- quests
- day/night cycle
- seasons
- Android build
