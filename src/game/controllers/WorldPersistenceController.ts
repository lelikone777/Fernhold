import { INITIAL_RESOURCES, INITIAL_VILLAGE } from '../data/resources';
import { SaveSystem } from '../systems/SaveSystem';
import type {
  CameraState,
  GameSaveData,
  PlacedBuilding,
  PlacedFoliage,
  PlacedRoad,
  ResourceDrop,
  Resources,
  VillageState,
} from '../types/game';

export interface LoadedWorldState {
  resources: Resources;
  village: VillageState;
  buildings: PlacedBuilding[];
  roads: PlacedRoad[];
  foliageObjects: PlacedFoliage[];
  resourceDrops: ResourceDrop[];
  day: number;
  camera?: CameraState;
  terrainSeed?: number;
}

export type WorldSavePayload = Omit<GameSaveData, 'version'>;

export class WorldPersistenceController {
  private readonly saveSystem = new SaveSystem();

  public loadInitialState(starterBuildings: PlacedBuilding[]): LoadedWorldState {
    const save = this.saveSystem.load();
    return {
      resources: save?.resources ?? INITIAL_RESOURCES,
      village: { ...(save?.village ?? INITIAL_VILLAGE) },
      buildings: save?.buildings ?? starterBuildings,
      roads: save?.roads ?? [],
      foliageObjects: save?.foliageObjects ?? [],
      resourceDrops: save?.resourceDrops ?? [],
      day: save?.day ?? 1,
      camera: save?.camera,
      terrainSeed: save?.terrainSeed,
    };
  }

  public saveState(payload: WorldSavePayload): void {
    this.saveSystem.save(payload);
  }

  public clearSave(): void {
    this.saveSystem.clear();
  }
}
