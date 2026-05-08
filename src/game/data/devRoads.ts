import type { DevRoadDefinition } from '../types/game';

const BASE = import.meta.env.BASE_URL;

export const DEV_ROAD_ITEMS: DevRoadDefinition[] = [
  {
    id: 'dirt_path',
    name: 'Country Path',
    swatchImage: `${BASE}assets/visual/roads/road_single_tile.png`,
  },
  {
    id: 'stone_path',
    name: 'Stone Path',
    swatchImage: `${BASE}assets/visual/roads/stone_road_single_tile.jpg`,
  },
  {
    id: 'cobble_path',
    name: 'Cobble Path',
    swatchImage: `${BASE}assets/visual/roads/cobble_road_single_tile.png`,
  },
];
