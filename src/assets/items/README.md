# Fernhold Item Icons

Generated retro pixel-art assets:

- `items-spritesheet.png` - 10x10 sheet, 100 icons, `32x32` each.
- `items-spritesheet.json` - atlas frame map (name -> frame).
- `fantasy-items-grid-10x10-labeled.png` - presentation grid with labels on white tiles.
- `items-catalog.json` - structured list of all 100 items.

Regenerate:

```bash
npm run assets:generate
```

The script writes files to both:

- `src/assets/items/` (source assets)
- `public/assets/items/` (runtime loading by Phaser)
