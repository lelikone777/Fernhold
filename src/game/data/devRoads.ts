import type { DevRoadDefinition } from '../types/game';

const BASE = import.meta.env.BASE_URL;

export const DEV_ROAD_ITEMS: DevRoadDefinition[] = [
  {
    id: 'dirt_path',
    name: 'Dirt Path',
    swatchImage: `${BASE}assets/visual/roads/dirt_path_tiles.png`,
  },
  {
    id: 'stone_path',
    name: 'Stone Path',
    swatchImage: `${BASE}assets/visual/roads/stone_path_tiles.png`,
  },
  {
    id: 'cobble_path',
    name: 'Cobble Path',
    swatchImage: `${BASE}assets/visual/roads/cobble_path_tiles.png`,
  },
];
