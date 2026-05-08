export type ResourceType =
  | 'wood'
  | 'stone'
  | 'food'
  | 'tools'
  | 'weapons'
  | 'grain'
  | 'flour'
  | 'coal'
  | 'iron_ore'
  | 'copper_ore'
  | 'tin_ore'
  | 'silver_ore'
  | 'gold_ore'
  | 'bronze_ingot'
  | 'iron_ingot'
  | 'silver_ingot'
  | 'gold_ingot'
  | 'livestock'
  | 'meat'
  | 'milk'
  | 'cheese'
  | 'fish'
  | 'smoked_fish'
  | 'vegetables'
  | 'pickaxe'
  | 'axe'
  | 'shovel'
  | 'knife'
  | 'hammer';

export type VillagerRole = 'idle_villager' | 'lumberjack' | 'miner' | 'carrier' | 'worker' | 'builder';

export interface VillagerExperience {
  carrier: number;
  worker: number;
  builder: number;
}

export interface RoleExperienceSummary {
  count: number;
  avgLevel: number;
  avgProgress: number;
}
export type VillagerState =
  | 'idle'
  | 'walking'
  | 'working'
  | 'going_home'
  | 'going_to_work'
  | 'going_to_tool'
  | 'going_to_harvest'
  | 'harvesting'
  | 'carrying'
  | 'going_to_build'
  | 'building';
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
  role: VillagerRole;
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
  | 'lumberjack_camp_level_1'
  | 'lumberjack_camp_level_2'
  | 'lumberjack_camp_level_3'
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
  | 'stone_quarry_level_1'
  | 'stone_quarry_level_2'
  | 'stone_quarry_level_3'
  | 'stable'
  | 'field_level_1'
  | 'field_level_2'
  | 'field_level_3'
  | 'windmill_level_1'
  | 'windmill_level_2'
  | 'coal_mine_level_1'
  | 'coal_mine_level_2'
  | 'iron_mine_level_1'
  | 'iron_mine_level_2'
  | 'copper_tin_mine_level_1'
  | 'copper_tin_mine_level_2'
  | 'precious_mine_level_1'
  | 'precious_mine_level_2'
  | 'smelter_level_1'
  | 'smelter_level_2'
  | 'foundry'
  | 'mint'
  | 'tool_workshop'
  | 'pasture_level_1'
  | 'pasture_level_2'
  | 'pasture_level_3'
  | 'pasture_level_4'
  | 'pasture_level_5'
  | 'butcher_shop_level_1'
  | 'butcher_shop_level_2'
  | 'butcher_shop_level_3'
  | 'butcher_shop_level_4'
  | 'butcher_shop_level_5'
  | 'dairy_level_1'
  | 'dairy_level_2'
  | 'dairy_level_3'
  | 'dairy_level_4'
  | 'dairy_level_5'
  | 'creamery_level_1'
  | 'creamery_level_2'
  | 'creamery_level_3'
  | 'creamery_level_4'
  | 'creamery_level_5'
  | 'smokehouse_level_1'
  | 'smokehouse_level_2'
  | 'smokehouse_level_3'
  | 'smokehouse_level_4'
  | 'smokehouse_level_5'
  | 'kitchen_level_1'
  | 'kitchen_level_2'
  | 'kitchen_level_3'
  | 'kitchen_level_4'
  | 'kitchen_level_5';
export type BuildPlacementError = 'not_enough_resources' | 'tile_occupied' | 'cannot_build_here';
export type RoadType = 'dirt_path' | 'stone_path' | 'cobble_path' | 'country_path';

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

export interface HarvestableData {
  resourceType: Extract<ResourceType, 'wood' | 'stone'>;
  hp: number;
  maxHp: number;
  yield: number;
}

export interface PlacedFoliage {
  id: string;
  foliageId: string;
  x: number;
  y: number;
  harvestable?: HarvestableData;
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
  grain: number;
  flour: number;
  coal: number;
  iron_ore: number;
  copper_ore: number;
  tin_ore: number;
  silver_ore: number;
  gold_ore: number;
  bronze_ingot: number;
  iron_ingot: number;
  silver_ingot: number;
  gold_ingot: number;
  livestock: number;
  meat: number;
  milk: number;
  cheese: number;
  fish: number;
  smoked_fish: number;
  vegetables: number;
  pickaxe: number;
  axe: number;
  shovel: number;
  knife: number;
  hammer: number;
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

export interface ResourceDrop {
  id: string;
  resourceType: Extract<ResourceType, 'wood' | 'stone'>;
  amount: number;
  x: number;
  y: number;
  claimedBy: string | null;
  createdDay: number;
}

export interface BuildingSize {
  w: number;
  h: number;
}

export interface BuildingProduction {
  workerSlots: number;
  carrierSlots?: number;
  produces?: Partial<Resources>;
  consumes?: Partial<Resources>;
  moraleBonus?: number;
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
  production?: BuildingProduction;
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

export type BuildingRuntimeStatus = 'open' | 'closed' | 'blocked';

export interface BuildingResourceFlow {
  resource: ResourceType;
  amount: number;
  available?: number;
}

export interface BuildingDetailsPayload {
  id: string;
  type: BuildingType;
  name: string;
  level: number;
  purpose: string;
  status: BuildingRuntimeStatus;
  statusLabel: string;
  workersAssigned: number;
  workerSlots: number;
  efficiency: number;
  size: BuildingSize;
  position: { x: number; y: number };
  produces: BuildingResourceFlow[];
  consumes: BuildingResourceFlow[];
  moraleBonus: number;
  assignmentRole: Extract<VillagerRole, 'carrier' | 'worker' | 'lumberjack' | 'miner'> | null;
  assignmentAssigned: number;
  assignmentDesired: number;
  assignmentSlots: number;
}

export type ConstructionStage = 'foundation' | 'frame' | 'complete';

export interface ConstructionData {
  stage: ConstructionStage;
  resourcesNeeded: ResourceCost;
  resourcesDelivered: ResourceCost;
  buildProgress: number;
}

export interface PlacedBuilding {
  id: string;
  type: BuildingType;
  x: number;
  y: number;
  construction?: ConstructionData;
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
  resourceDrops?: ResourceDrop[];
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
