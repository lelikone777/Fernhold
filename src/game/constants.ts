export const GAME_NAME = 'Fernhold';
export const SAVE_VERSION = 2;
export const SAVE_KEY = 'fernhold_save_v2';
export const DAY_DURATION_MS = 12000;

export const EVENT_KEYS = {
  resourcesChanged: 'fernhold:resources-changed',
  villageChanged: 'fernhold:village-changed',
  buildingAvailabilityChanged: 'fernhold:building-availability-changed',
  buildingSelectionChanged: 'fernhold:building-selection-changed',
  buildingDetailsChanged: 'fernhold:building-details-changed',
  devPaintStateChanged: 'fernhold:dev-paint-state-changed',
  dayChanged: 'fernhold:day-changed',
  workerInfoChanged: 'fernhold:worker-info-changed',
  workerRolesChanged: 'fernhold:worker-roles-changed',
  resourceDropsChanged: 'fernhold:resource-drops-changed',
  toast: 'fernhold:toast',
  requestSelectBuilding: 'fernhold:request-select-building',
  requestSetBulldozeMode: 'fernhold:request-set-bulldoze-mode',
  requestResetSave: 'fernhold:request-reset-save',
  requestSetDevPaintEnabled: 'fernhold:request-set-dev-paint-enabled',
  requestSelectDevFoliage: 'fernhold:request-select-dev-foliage',
  requestSelectDevRoad: 'fernhold:request-select-dev-road',
  requestEraseDevPaintTile: 'fernhold:request-erase-dev-paint-tile',
  requestCloseBuildingDetails: 'fernhold:request-close-building-details',
  requestAdjustBuildingWorkers: 'fernhold:request-adjust-building-workers',
} as const;

export const CAMERA = {
  speed: 560,
  zoomMin: 0.55,
  zoomMax: 2.25,
  zoomStep: 0.1,
  defaultZoom: 1,
} as const;

export const ITEM_SPRITESHEET = {
  key: 'items_atlas',
  imagePath: 'assets/items/items-spritesheet.png',
  atlasPath: 'assets/items/items-spritesheet.json',
  enabled: true,
} as const;

export const HUD_MESSAGES = {
  notEnoughResources: 'Not enough resources',
  tileOccupied: 'Tile is occupied',
  cannotBuild: 'Cannot build here',
} as const;
