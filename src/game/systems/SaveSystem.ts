import { SAVE_KEY, SAVE_VERSION } from '../constants';
import type { BuildingType, GameSaveData } from '../types/game';
import { INITIAL_RESOURCES, INITIAL_VILLAGE } from '../data/resources';
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
};

export class SaveSystem {
  public load(): GameSaveData | null {
    const data = loadFromStorage<GameSaveData>(SAVE_KEY);
    if (!data || data.version !== SAVE_VERSION) {
      return null;
    }

    return {
      ...data,
      resources: {
        ...INITIAL_RESOURCES,
        ...data.resources,
      },
      village: {
        ...INITIAL_VILLAGE,
        ...(data.village ?? {}),
      },
      roads: data.roads ?? [],
      foliageObjects: data.foliageObjects ?? [],
      buildings: data.buildings.map((building) => ({
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
  }
}
