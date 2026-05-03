# Fernhold Visual Assets

This folder is the single source of truth for visual asset organization.

```text
src/assets/visual/
  buildings/
    placeholders/   active technical placeholders for every building type
    final/          approved production sprites
  notes/
    pipeline.md     short rules for naming and replacement
```

Runtime copies live in `public/assets/visual/`.

## Rules

1. Building filenames must match `BuildingType` exactly.
2. Keep placeholders for every building even when final art is missing.
3. Only approved art goes into `final/`.
4. Runtime paths are controlled from `src/game/data/buildingAssetManifest.ts`.
