import { describe, expect, it } from 'vitest';
import { generateTerrainMap, randomTerrainSeed } from './terrainGenerator';

describe('generateTerrainMap', () => {
  it('produces deterministic output for the same seed', () => {
    const a = generateTerrainMap(16, 16, 12345);
    const b = generateTerrainMap(16, 16, 12345);
    expect(a).toEqual(b);
  });

  it('produces different output for different seeds', () => {
    const a = generateTerrainMap(32, 32, 1);
    const b = generateTerrainMap(32, 32, 99999);
    let sameTiles = 0;
    let total = 0;
    for (let y = 0; y < 32; y += 1) {
      for (let x = 0; x < 32; x += 1) {
        total += 1;
        if (a[y][x] === b[y][x]) {
          sameTiles += 1;
        }
      }
    }
    expect(sameTiles / total).toBeLessThan(0.85);
  });

  it('produces a map of the requested dimensions', () => {
    const map = generateTerrainMap(48, 24, 7);
    expect(map.length).toBe(24);
    expect(map[0].length).toBe(48);
  });

  it('includes multiple terrain biomes on a sufficiently large map', () => {
    const map = generateTerrainMap(64, 64, 42);
    const keys = new Set<string>();
    for (const row of map) {
      for (const cell of row) {
        keys.add(cell);
      }
    }
    expect(keys.size).toBeGreaterThanOrEqual(3);
  });

  it('only emits known terrain keys', () => {
    const allowed = new Set([
      'terrain_water',
      'terrain_sand',
      'terrain_grass_light',
      'terrain_grass_dark',
      'terrain_forest_floor',
      'terrain_dirt',
      'terrain_stone',
    ]);
    const map = generateTerrainMap(20, 20, 555);
    for (const row of map) {
      for (const cell of row) {
        expect(allowed.has(cell)).toBe(true);
      }
    }
  });
});

describe('randomTerrainSeed', () => {
  it('never returns 0', () => {
    for (let i = 0; i < 50; i += 1) {
      expect(randomTerrainSeed()).not.toBe(0);
    }
  });

  it('stays inside 31-bit positive range', () => {
    for (let i = 0; i < 50; i += 1) {
      const seed = randomTerrainSeed();
      expect(seed).toBeGreaterThan(0);
      expect(seed).toBeLessThanOrEqual(0x7fffffff);
    }
  });
});
