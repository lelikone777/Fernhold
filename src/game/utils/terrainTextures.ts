import type Phaser from 'phaser';

export interface TerrainTextureDefinition {
  key: string;
  label: string;
  description: string;
  generate: (size: number) => HTMLCanvasElement;
}

const TILE_SIZE = 16;

const seededRandom = (seed: number): (() => number) => {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
};

const hex = (color: number): string =>
  `#${color.toString(16).padStart(6, '0')}`;

interface SpeckleSpec {
  color: number;
  density: number;
  size?: 1 | 2;
}

const paintBase = (
  ctx: CanvasRenderingContext2D,
  size: number,
  color: number,
): void => {
  ctx.fillStyle = hex(color);
  ctx.fillRect(0, 0, size, size);
};

const paintSpeckles = (
  ctx: CanvasRenderingContext2D,
  size: number,
  rng: () => number,
  speckles: SpeckleSpec[],
): void => {
  for (const spec of speckles) {
    ctx.fillStyle = hex(spec.color);
    const total = Math.max(1, Math.floor(size * size * spec.density));
    for (let i = 0; i < total; i += 1) {
      const x = Math.floor(rng() * size);
      const y = Math.floor(rng() * size);
      const s = spec.size ?? 1;
      ctx.fillRect(x, y, s, s);
    }
  }
};

const makeCanvas = (size: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } => {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('2D canvas context is unavailable');
  }
  ctx.imageSmoothingEnabled = false;
  return { canvas, ctx };
};

const generateGrassDark = (size: number): HTMLCanvasElement => {
  const { canvas, ctx } = makeCanvas(size);
  const rng = seededRandom(0xa11c0);
  paintBase(ctx, size, 0x4d7a3a);
  paintSpeckles(ctx, size, rng, [
    { color: 0x5e8b46, density: 0.18 },
    { color: 0x3d6a2c, density: 0.12 },
    { color: 0x6e9a52, density: 0.05 },
    { color: 0x355c25, density: 0.04, size: 2 },
  ]);
  return canvas;
};

const generateGrassLight = (size: number): HTMLCanvasElement => {
  const { canvas, ctx } = makeCanvas(size);
  const rng = seededRandom(0xb22d1);
  paintBase(ctx, size, 0x84b25e);
  paintSpeckles(ctx, size, rng, [
    { color: 0x96c46d, density: 0.18 },
    { color: 0x6f9f4d, density: 0.12 },
    { color: 0xa5d077, density: 0.06 },
    { color: 0xfff4a8, density: 0.02 },
  ]);
  return canvas;
};

const generateWater = (size: number): HTMLCanvasElement => {
  const { canvas, ctx } = makeCanvas(size);
  const rng = seededRandom(0xc34e2);
  paintBase(ctx, size, 0x3d6f9c);
  paintSpeckles(ctx, size, rng, [
    { color: 0x4f87b6, density: 0.14, size: 2 },
    { color: 0x2d5680, density: 0.10 },
  ]);
  ctx.fillStyle = hex(0x9ec6e3);
  for (let y = 2; y < size; y += 5) {
    const offset = Math.floor(rng() * 4);
    for (let x = offset; x < size; x += 4 + Math.floor(rng() * 2)) {
      ctx.fillRect(x, y, 2, 1);
    }
  }
  return canvas;
};

const generateSand = (size: number): HTMLCanvasElement => {
  const { canvas, ctx } = makeCanvas(size);
  const rng = seededRandom(0xd45f3);
  paintBase(ctx, size, 0xd8b888);
  paintSpeckles(ctx, size, rng, [
    { color: 0xe8c89c, density: 0.18 },
    { color: 0xc09870, density: 0.12 },
    { color: 0xa07854, density: 0.04 },
    { color: 0xf3dab0, density: 0.04 },
  ]);
  return canvas;
};

const generateStone = (size: number): HTMLCanvasElement => {
  const { canvas, ctx } = makeCanvas(size);
  const rng = seededRandom(0xe5604);
  paintBase(ctx, size, 0x868690);
  paintSpeckles(ctx, size, rng, [
    { color: 0x9ca0aa, density: 0.16 },
    { color: 0x6c6e78, density: 0.13 },
    { color: 0xb4b8c0, density: 0.05 },
    { color: 0x4e5058, density: 0.05, size: 2 },
  ]);
  // crack hint
  ctx.fillStyle = hex(0x4a4c54);
  ctx.fillRect(3, 7, 4, 1);
  ctx.fillRect(7, 6, 1, 1);
  ctx.fillRect(10, 12, 3, 1);
  return canvas;
};

const generateDirt = (size: number): HTMLCanvasElement => {
  const { canvas, ctx } = makeCanvas(size);
  const rng = seededRandom(0xf6715);
  paintBase(ctx, size, 0x8a6240);
  paintSpeckles(ctx, size, rng, [
    { color: 0xa07a5c, density: 0.18 },
    { color: 0x6e4a30, density: 0.13 },
    { color: 0xb18866, density: 0.05 },
    { color: 0x55381e, density: 0.04, size: 2 },
  ]);
  return canvas;
};

const generateForestFloor = (size: number): HTMLCanvasElement => {
  const { canvas, ctx } = makeCanvas(size);
  const rng = seededRandom(0x07826);
  paintBase(ctx, size, 0x3a5630);
  paintSpeckles(ctx, size, rng, [
    { color: 0x4d6a40, density: 0.16 },
    { color: 0x2a3e22, density: 0.13, size: 2 },
    { color: 0x8c6a40, density: 0.05 }, // stray twig browns
    { color: 0x7e9c52, density: 0.04 },
  ]);
  return canvas;
};

export const TERRAIN_TEXTURES: TerrainTextureDefinition[] = [
  {
    key: 'terrain_grass_dark',
    label: 'Dark Grass',
    description: 'Lush meadow grass with deep green tones.',
    generate: generateGrassDark,
  },
  {
    key: 'terrain_grass_light',
    label: 'Light Grass',
    description: 'Sun-bleached open grassland with the odd flower.',
    generate: generateGrassLight,
  },
  {
    key: 'terrain_water',
    label: 'Water',
    description: 'Shallow water tile with subtle wave highlights.',
    generate: generateWater,
  },
  {
    key: 'terrain_sand',
    label: 'Sand',
    description: 'Warm sandy soil — riverbanks and beaches.',
    generate: generateSand,
  },
  {
    key: 'terrain_stone',
    label: 'Stone',
    description: 'Bare rocky ground with cracks and bright flecks.',
    generate: generateStone,
  },
  {
    key: 'terrain_dirt',
    label: 'Dirt',
    description: 'Tilled earth — exposed soil for paths and farms.',
    generate: generateDirt,
  },
  {
    key: 'terrain_forest_floor',
    label: 'Forest Floor',
    description: 'Shaded undergrowth with twigs and patchy moss.',
    generate: generateForestFloor,
  },
];

export const TERRAIN_TILE_SIZE = TILE_SIZE;

export const registerTerrainTextures = (scene: Phaser.Scene): void => {
  const textures = scene.textures as unknown as {
    addCanvas: (key: string, source: HTMLCanvasElement) => unknown;
  };
  for (const def of TERRAIN_TEXTURES) {
    if (scene.textures.exists(def.key)) {
      continue;
    }
    const canvas = def.generate(TILE_SIZE);
    textures.addCanvas(def.key, canvas);
  }
};

export interface TerrainPreviewItem {
  key: string;
  label: string;
  description: string;
  /** PNG dataURL of a small preview tile (TILE_SIZE × TILE_SIZE). */
  thumbnailUrl: string;
  /** PNG dataURL of an upscaled preview, for hover popup. */
  largePreviewUrl: string;
}

const upscaleCanvas = (source: HTMLCanvasElement, factor: number): HTMLCanvasElement => {
  const target = document.createElement('canvas');
  target.width = source.width * factor;
  target.height = source.height * factor;
  const ctx = target.getContext('2d');
  if (!ctx) {
    throw new Error('2D canvas context is unavailable');
  }
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(source, 0, 0, target.width, target.height);
  return target;
};

export const generateTerrainPreviewItems = (): TerrainPreviewItem[] =>
  TERRAIN_TEXTURES.map((def) => {
    const tile = def.generate(TILE_SIZE);
    return {
      key: def.key,
      label: def.label,
      description: def.description,
      thumbnailUrl: tile.toDataURL('image/png'),
      largePreviewUrl: upscaleCanvas(tile, 12).toDataURL('image/png'),
    };
  });
