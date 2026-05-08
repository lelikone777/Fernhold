import type { BuildingType, VillagerPalette, VillagerRole } from '../types/game';
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
  (
    Object.values(BUILDING_DEFINITIONS) as {
      type: BuildingType;
      production?: { workerSlots: number; carrierSlots?: number };
    }[]
  )
    .filter(
      (def) =>
        def.production != null &&
        ((def.production.workerSlots ?? 0) > 0 || (def.production.carrierSlots ?? 0) > 0),
    )
    .map((def) => def.type),
);

export const BUILDING_ROLE_MAP: Partial<Record<BuildingType, VillagerRole>> = {
  lumberjack_camp_level_1: 'lumberjack',
  lumberjack_camp_level_2: 'lumberjack',
  lumberjack_camp_level_3: 'lumberjack',
  stone_quarry_level_1: 'miner',
  stone_quarry_level_2: 'miner',
  stone_quarry_level_3: 'miner',
  storage_level_1: 'carrier',
  storage_level_2: 'carrier',
  storage_level_3: 'carrier',
  storage_level_4: 'carrier',
  storage_level_5: 'carrier',
  lumber_mill_level_1: 'worker',
  lumber_mill_level_2: 'worker',
  lumber_mill_level_3: 'worker',
  blacksmith_level_1: 'worker',
  blacksmith_level_2: 'worker',
  blacksmith_level_3: 'worker',
  tavern_level_1: 'worker',
  tavern_level_2: 'worker',
  tavern_level_3: 'worker',
  farmhouse: 'worker',
  workshop: 'worker',
  market_stall: 'worker',
  watchtower: 'worker',
  herb_hut: 'worker',
  fisher_hut: 'worker',
  bakery: 'worker',
  mason_yard: 'worker',
  stable: 'worker',
  field_level_1: 'worker',
  field_level_2: 'worker',
  field_level_3: 'worker',
  windmill_level_1: 'worker',
  windmill_level_2: 'worker',
  pasture_level_1: 'worker',
  pasture_level_2: 'worker',
  pasture_level_3: 'worker',
  pasture_level_4: 'worker',
  pasture_level_5: 'worker',
  butcher_shop_level_1: 'worker',
  butcher_shop_level_2: 'worker',
  butcher_shop_level_3: 'worker',
  butcher_shop_level_4: 'worker',
  butcher_shop_level_5: 'worker',
  dairy_level_1: 'worker',
  dairy_level_2: 'worker',
  dairy_level_3: 'worker',
  dairy_level_4: 'worker',
  dairy_level_5: 'worker',
  creamery_level_1: 'worker',
  creamery_level_2: 'worker',
  creamery_level_3: 'worker',
  creamery_level_4: 'worker',
  creamery_level_5: 'worker',
  smokehouse_level_1: 'worker',
  smokehouse_level_2: 'worker',
  smokehouse_level_3: 'worker',
  smokehouse_level_4: 'worker',
  smokehouse_level_5: 'worker',
  kitchen_level_1: 'worker',
  kitchen_level_2: 'worker',
  kitchen_level_3: 'worker',
  kitchen_level_4: 'worker',
  kitchen_level_5: 'worker',
  coal_mine_level_1: 'worker',
  coal_mine_level_2: 'worker',
  iron_mine_level_1: 'worker',
  iron_mine_level_2: 'worker',
  copper_tin_mine_level_1: 'worker',
  copper_tin_mine_level_2: 'worker',
  precious_mine_level_1: 'worker',
  precious_mine_level_2: 'worker',
  smelter_level_1: 'worker',
  smelter_level_2: 'worker',
  foundry: 'worker',
  mint: 'worker',
  tool_workshop: 'worker',
};

const WORK_PRIORITY: ReadonlyMap<string, number> = new Map([
  ['physical_wood', 0],
  ['physical_stone', 1],
  ['carrier', 2],
  ['food', 3],
  ['grain', 4],
  ['flour', 5],
  ['vegetables', 6],
  ['livestock', 7],
  ['fish', 8],
  ['meat', 9],
  ['milk', 10],
  ['cheese', 11],
  ['smoked_fish', 12],
  ['coal', 13],
  ['iron_ore', 14],
  ['copper_ore', 15],
  ['tin_ore', 16],
  ['silver_ore', 17],
  ['gold_ore', 18],
  ['bronze_ingot', 19],
  ['iron_ingot', 20],
  ['silver_ingot', 21],
  ['gold_ingot', 22],
  ['pickaxe', 23],
  ['axe', 24],
  ['shovel', 25],
  ['knife', 26],
  ['hammer', 27],
  ['wood', 28],
  ['stone', 29],
  ['tools', 30],
  ['weapons', 31],
]);

export function getWorkPriority(buildingType: BuildingType): number {
  if (
    buildingType === 'lumberjack_camp_level_1' ||
    buildingType === 'lumberjack_camp_level_2' ||
    buildingType === 'lumberjack_camp_level_3'
  ) {
    return WORK_PRIORITY.get('physical_wood') ?? 0;
  }
  if (
    buildingType === 'stone_quarry_level_1' ||
    buildingType === 'stone_quarry_level_2' ||
    buildingType === 'stone_quarry_level_3'
  ) {
    return WORK_PRIORITY.get('physical_stone') ?? 1;
  }
  if (
    buildingType === 'storage_level_1' ||
    buildingType === 'storage_level_2' ||
    buildingType === 'storage_level_3' ||
    buildingType === 'storage_level_4' ||
    buildingType === 'storage_level_5'
  ) {
    return WORK_PRIORITY.get('carrier') ?? 2;
  }
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
