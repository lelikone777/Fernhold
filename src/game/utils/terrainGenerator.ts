export type TerrainKey =
  | 'terrain_water'
  | 'terrain_sand'
  | 'terrain_grass_light'
  | 'terrain_grass_dark'
  | 'terrain_forest_floor'
  | 'terrain_dirt'
  | 'terrain_stone';

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

const smoothstep = (t: number): number => t * t * (3 - 2 * t);

const hash2D = (x: number, y: number, seed: number): number => {
  let h = (x | 0) * 374761393 + (y | 0) * 668265263 + (seed | 0) * 1274126177;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = h ^ (h >>> 16);
  return (h >>> 0) / 0xffffffff;
};

const valueNoise = (x: number, y: number, seed: number): number => {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const v00 = hash2D(ix, iy, seed);
  const v10 = hash2D(ix + 1, iy, seed);
  const v01 = hash2D(ix, iy + 1, seed);
  const v11 = hash2D(ix + 1, iy + 1, seed);
  const u = smoothstep(fx);
  const v = smoothstep(fy);
  return lerp(lerp(v00, v10, u), lerp(v01, v11, u), v);
};

const fbm = (x: number, y: number, seed: number, baseFreq: number, octaves: number): number => {
  let total = 0;
  let amp = 1;
  let freq = baseFreq;
  let sum = 0;
  for (let octave = 0; octave < octaves; octave += 1) {
    total += valueNoise(x * freq, y * freq, seed + octave * 1013) * amp;
    sum += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return total / sum;
};

const classifyByElevation = (elevation: number, moisture: number): TerrainKey => {
  if (elevation < 0.30) return 'terrain_water';
  if (elevation < 0.36) return 'terrain_sand';
  if (elevation < 0.50) {
    return moisture > 0.55 ? 'terrain_grass_dark' : 'terrain_grass_light';
  }
  if (elevation < 0.62) {
    return moisture > 0.60 ? 'terrain_forest_floor' : 'terrain_grass_dark';
  }
  if (elevation < 0.74) {
    return moisture > 0.50 ? 'terrain_forest_floor' : 'terrain_dirt';
  }
  if (elevation < 0.84) return 'terrain_dirt';
  return 'terrain_stone';
};

export const generateTerrainMap = (
  width: number,
  height: number,
  seed: number,
): TerrainKey[][] => {
  const elevationSeed = seed | 0;
  const moistureSeed = (seed * 31 + 17) | 0;
  const map: TerrainKey[][] = [];
  for (let y = 0; y < height; y += 1) {
    const row: TerrainKey[] = [];
    for (let x = 0; x < width; x += 1) {
      const elevation = fbm(x, y, elevationSeed, 0.06, 4);
      const moisture = fbm(x + 1000, y - 500, moistureSeed, 0.10, 3);
      row.push(classifyByElevation(elevation, moisture));
    }
    map.push(row);
  }
  return map;
};

export const randomTerrainSeed = (): number => Math.floor(Math.random() * 0x7fffffff) || 1;

export const isWalkableTerrain = (key: TerrainKey): boolean =>
  key !== 'terrain_water' && key !== 'terrain_stone';
