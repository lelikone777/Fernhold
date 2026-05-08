import type { BuildingType, VillagerPalette } from '../types/game';
import { BUILDING_DEFINITIONS } from './buildings';

export const VILLAGER_SPRITE_KEY_PREFIX = 'villager_sprite_';
export const VILLAGER_SPRITE_WIDTH = 12;
export const VILLAGER_SPRITE_HEIGHT = 16;
export const VILLAGER_FRAME_COUNT = 8;
export const VILLAGER_WALK_FPS = 6;
export const VILLAGER_SPEED_PIXELS_PER_SEC = 22;

export const VILLAGER_PALETTES: VillagerPalette[] = [
  { skin: 0xf2c79e, hair: 0x4b2e16, shirt: 0x8a5a3b, pants: 0x3a3f55 },
  { skin: 0xead0a8, hair: 0x2d1c10, shirt: 0x6e8a52, pants: 0x4a3725 },
  { skin: 0xd9a982, hair: 0xc78a3f, shirt: 0xa44a3a, pants: 0x33425b },
  { skin: 0xe8b58a, hair: 0x6b3c1c, shirt: 0x4f6b8a, pants: 0x4a3c2a },
  { skin: 0xf2c79e, hair: 0xa6712c, shirt: 0x8e6e3d, pants: 0x55392a },
  { skin: 0xc99372, hair: 0x231812, shirt: 0x6a8c5e, pants: 0x3b3527 },
  { skin: 0xeac3a3, hair: 0x844320, shirt: 0xa56b3e, pants: 0x2d3a4f },
  { skin: 0xddb290, hair: 0x4d3220, shirt: 0x547963, pants: 0x4d3a26 },
];

export const HOUSE_BUILDING_TYPES: ReadonlySet<BuildingType> = new Set<BuildingType>([
  'house_level_1',
  'house_level_2',
  'house_level_3',
  'house_level_4',
  'house_level_5',
  'farmhouse',
]);

export const WORK_BUILDING_TYPES: ReadonlySet<BuildingType> = new Set<BuildingType>(
  (Object.values(BUILDING_DEFINITIONS) as { type: BuildingType; production?: { workerSlots: number } }[])
    .filter((def) => def.production != null && def.production.workerSlots > 0)
    .map((def) => def.type),
);

const WORK_PRIORITY: ReadonlyMap<string, number> = new Map([
  ['food', 0],
  ['wood', 1],
  ['stone', 2],
  ['tools', 3],
  ['weapons', 4],
]);

export function getWorkPriority(buildingType: BuildingType): number {
  const def = BUILDING_DEFINITIONS[buildingType];
  if (!def.production) return 99;
  const produces = def.production.produces;
  if (!produces) return 50;
  let best = 99;
  for (const key of Object.keys(produces)) {
    const p = WORK_PRIORITY.get(key) ?? 90;
    if (p < best) best = p;
  }
  return best;
}

export const HOUSE_CAPACITY: Partial<Record<BuildingType, number>> = {
  house_level_1: 2,
  house_level_2: 4,
  house_level_3: 6,
  house_level_4: 8,
  house_level_5: 10,
  farmhouse: 1,
};
