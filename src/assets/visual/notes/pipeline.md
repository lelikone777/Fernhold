## Building Visual Pipeline

- `placeholders/` is the safe default set used during development.
- `final/house_level_3.png` is currently the only approved custom building sprite.
- When a new building sprite is approved:
  1. put it in `src/assets/visual/buildings/final/`
  2. copy it to `public/assets/visual/buildings/final/`
  3. switch `artStatus` and `activeSpritePath` in `buildingAssetManifest.ts`

Keep runtime free from legacy experiments, imported reference packs and abandoned art passes.
