import { SAVE_KEY, SAVE_VERSION } from '../constants';
import type { BuildingType, GameSaveData } from '../types/game';
import { INITIAL_RESOURCES, INITIAL_VILLAGE } from '../data/resources';
import { HARVESTABLE_BY_FOLIAGE_ID } from '../data/naturalResources';
import { loadFromStorage, removeFromStorage, saveToStorage } from '../utils/storage';

const BUILDING_TYPE_MIGRATION: Record<string, BuildingType> = {
  house: 'house_level_1',
  small_house: 'house_level_1',
  medium_house: 'house_level_2',
  farm: 'farmhouse',
  storage: 'storage_level_1',
  lumber_mill: 'lumber_mill_level_1',
  barn: 'barn_level_1',
  blacksmith: 'blacksmith_level_1',
  tavern: 'tavern_level_1',
  butcher_shop: 'butcher_shop_level_1',
  dairy: 'dairy_level_1',
  creamery: 'creamery_level_1',
  smokehouse: 'smokehouse_level_1',
  kitchen: 'kitchen_level_1',
};

const LEGACY_SAVE_KEYS = ['fernhold_save_v1'];

export class SaveSystem {
  public load(): GameSaveData | null {
    const current = loadFromStorage<GameSaveData>(SAVE_KEY);
    const legacy = LEGACY_SAVE_KEYS
      .map((key) => loadFromStorage<GameSaveData>(key))
      .find((entry) => Boolean(entry));
    const data = current ?? legacy;
    if (!data) {
      return null;
    }

    const migrated = this.migrate(data);
    if (migrated.version !== SAVE_VERSION) {
      return null;
    }

    return {
      ...migrated,
      resources: {
        ...INITIAL_RESOURCES,
        ...migrated.resources,
      },
      village: {
        ...INITIAL_VILLAGE,
        ...(migrated.village ?? {}),
      },
      roads: migrated.roads ?? [],
      foliageObjects: (migrated.foliageObjects ?? []).map((item) => ({
        ...item,
        harvestable: item.harvestable ?? HARVESTABLE_BY_FOLIAGE_ID[item.foliageId],
      })),
      resourceDrops: migrated.resourceDrops ?? [],
      buildings: migrated.buildings.map((building) => ({
        ...building,
        type: BUILDING_TYPE_MIGRATION[building.type] ?? building.type,
      })),
    };
  }

  public save(payload: Omit<GameSaveData, 'version'>): void {
    const saveData: GameSaveData = {
      version: SAVE_VERSION,
      ...payload,
    };
    saveToStorage(SAVE_KEY, saveData);
  }

  public clear(): void {
    removeFromStorage(SAVE_KEY);
    for (const key of LEGACY_SAVE_KEYS) {
      removeFromStorage(key);
    }
  }

  private migrate(data: GameSaveData): GameSaveData {
    if (data.version === SAVE_VERSION) {
      return data;
    }

    if (data.version === 1) {
      return {
        ...data,
        version: SAVE_VERSION,
        foliageObjects: (data.foliageObjects ?? []).map((item) => ({
          ...item,
          harvestable: item.harvestable ?? HARVESTABLE_BY_FOLIAGE_ID[item.foliageId],
        })),
        resourceDrops: [],
      };
    }

    return data;
  }
}
