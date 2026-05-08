export type ResourceType = 'wood' | 'stone' | 'food' | 'tools' | 'weapons';

export type VillagerState = 'idle' | 'walking' | 'working' | 'going_home' | 'going_to_work';
export type VillagerDirection = 'down' | 'up' | 'left' | 'right';

export interface VillagerPalette {
  skin: number;
  hair: number;
  shirt: number;
  pants: number;
}

export interface PlacedVillager {
  id: string;
  homeBuildingId: string | null;
  workBuildingId: string | null;
  paletteKey: string;
  spawnTileX: number;
  spawnTileY: number;
}
export type BuildingType =
  | 'house_level_1'
  | 'house_level_2'
  | 'house_level_3'
  | 'house_level_4'
  | 'house_level_5'
  | 'storage_level_1'
  | 'storage_level_2'
  | 'storage_level_3'
  | 'storage_level_4'
  | 'storage_level_5'
  | 'lumber_mill_level_1'
  | 'lumber_mill_level_2'
  | 'lumber_mill_level_3'
  | 'barn_level_1'
  | 'barn_level_2'
  | 'barn_level_3'
  | 'barn_level_4'
  | 'barn_level_5'
  | 'blacksmith_level_1'
  | 'blacksmith_level_2'
  | 'blacksmith_level_3'
  | 'tavern_level_1'
  | 'tavern_level_2'
  | 'tavern_level_3'
  | 'town_hall'
  | 'farmhouse'
  | 'well'
  | 'workshop'
  | 'market_stall'
  | 'watchtower'
  | 'shrine'
  | 'herb_hut'
  | 'fisher_hut'
  | 'bakery'
  | 'mason_yard'
  | 'stable';
export type BuildPlacementError = 'not_enough_resources' | 'tile_occupied' | 'cannot_build_here';
export type RoadType = 'dirt_path' | 'stone_path' | 'cobble_path';

export interface DevFoliageDefinition {
  id: string;
  name: string;
  textureKey: string;
  swatchColor: string;
  shape: 'pine' | 'round';
  width: number;
  height: number;
  canopyColor: number;
  shadeColor: number;
  trunkColor: number;
}

export interface DevRoadDefinition {
  id: RoadType;
  name: string;
  swatchImage: string;
}

export interface PlacedFoliage {
  id: string;
  foliageId: string;
  x: number;
  y: number;
}

export interface PlacedRoad {
  id: string;
  roadId: RoadType;
  x: number;
  y: number;
}

export interface Resources {
  wood: number;
  stone: number;
  food: number;
  tools: number;
  weapons: number;
}

export interface VillageState {
  population: number;
  morale: number;
  housing: number;
  foodNeed: number;
  toolsNeed: number;
  weaponsNeed: number;
}

export interface DayReport {
  day: number;
  produced: Partial<Resources>;
  consumed: Partial<Resources>;
  notes: string[];
}

export type ResourceCost = Partial<Resources>;

export interface BuildingSize {
  w: number;
  h: number;
}

export interface BuildingDefinition {
  type: BuildingType;
  name: string;
  size: BuildingSize;
  cost: ResourceCost;
  purpose: string;
  color: number;
  spritePath: string;
  unlock?: BuildingUnlockRule;
}

export interface BuildingUnlockRule {
  minDay?: number;
  minPopulation?: number;
  minMorale?: number;
  requiresBuildings?: Partial<Record<BuildingType, number>>;
  requiresResources?: Partial<Resources>;
}

export interface BuildingAvailability {
  unlocked: boolean;
  reason: string | null;
}

export interface PlacedBuilding {
  id: string;
  type: BuildingType;
  x: number;
  y: number;
}

export interface CameraState {
  scrollX: number;
  scrollY: number;
  zoom: number;
}

export interface GameSaveData {
  version: number;
  resources: Resources;
  village: VillageState;
  buildings: PlacedBuilding[];
  roads: PlacedRoad[];
  foliageObjects: PlacedFoliage[];
  day: number;
  camera?: CameraState;
  terrainSeed?: number;
}

export interface PlacementResult {
  ok: boolean;
  error?: BuildPlacementError;
  building?: PlacedBuilding;
}

export interface RemovalResult {
  ok: boolean;
  building?: PlacedBuilding;
}
