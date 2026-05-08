import Phaser from 'phaser';
import { BUILDING_LIST } from '../data/buildings';
import { DEV_FOLIAGE_ITEMS } from '../data/devFoliage';
import { DEV_ROAD_ITEMS } from '../data/devRoads';
import { EVENT_KEYS } from '../constants';
import { createHud, type HudController } from '../../ui/hud';
import type {
  BuildingAvailability,
  BuildingDetailsPayload,
  BuildingType,
  Resources,
  VillageState,
} from '../types/game';
import { generateTerrainPreviewItems } from '../utils/terrainTextures';
import { WorldScene } from './WorldScene';

export class UIScene extends Phaser.Scene {
  private hud?: HudController;

  constructor() {
    super('UIScene');
  }

  public create(): void {
    const root = document.querySelector<HTMLElement>('#hud-root');
    if (!root) {
      throw new Error('Missing #hud-root container');
    }
    const buildingIconMap = this.buildBuildingIconMap();

    this.hud = createHud(root, {
      buildingOptions: BUILDING_LIST,
      devFoliageItems: DEV_FOLIAGE_ITEMS,
      devRoadItems: DEV_ROAD_ITEMS,
      terrainPreviewItems: generateTerrainPreviewItems(),
      resolveBuildingIcon: (building) => buildingIconMap.get(building.type) ?? null,
      onSelectBuilding: (type) => {
        this.game.events.emit(EVENT_KEYS.requestSelectBuilding, type);
      },
      onSetBulldozeMode: (enabled) => {
        this.game.events.emit(EVENT_KEYS.requestSetBulldozeMode, enabled);
      },
      onResetSave: () => {
        this.game.events.emit(EVENT_KEYS.requestResetSave);
      },
      onSetDevPaintEnabled: (enabled) => {
        this.game.events.emit(EVENT_KEYS.requestSetDevPaintEnabled, enabled);
      },
      onSelectDevFoliage: (foliageId) => {
        this.game.events.emit(EVENT_KEYS.requestSelectDevFoliage, foliageId);
      },
      onSelectDevRoad: (roadId) => {
        this.game.events.emit(EVENT_KEYS.requestSelectDevRoad, roadId);
      },
      onEraseDevPaintTile: () => {
        this.game.events.emit(EVENT_KEYS.requestEraseDevPaintTile);
      },
      onCloseBuildingDetails: () => {
        this.game.events.emit(EVENT_KEYS.requestCloseBuildingDetails);
      },
    });

    this.game.events.on(EVENT_KEYS.resourcesChanged, this.handleResources, this);
    this.game.events.on(EVENT_KEYS.villageChanged, this.handleVillage, this);
    this.game.events.on(EVENT_KEYS.buildingAvailabilityChanged, this.handleBuildingAvailability, this);
    this.game.events.on(EVENT_KEYS.buildingSelectionChanged, this.handleSelection, this);
    this.game.events.on(EVENT_KEYS.dayChanged, this.handleDay, this);
    this.game.events.on(EVENT_KEYS.devPaintStateChanged, this.handleDevPaintState, this);
    this.game.events.on(EVENT_KEYS.toast, this.handleToast, this);
    this.game.events.on(EVENT_KEYS.workerInfoChanged, this.handleWorkerInfo, this);
    this.game.events.on(EVENT_KEYS.buildingDetailsChanged, this.handleBuildingDetails, this);

    const world = this.scene.get('WorldScene') as WorldScene | undefined;
    if (world) {
      const snapshot = world.getUiSnapshot();
      this.handleResources(snapshot.resources);
      this.handleVillage(snapshot.village);
      this.handleBuildingAvailability(snapshot.buildingAvailability);
      this.handleSelection(snapshot.selectedBuilding, snapshot.bulldozeMode);
      this.handleDay(snapshot.day);
      this.handleDevPaintState(
        snapshot.devPaintEnabled,
        snapshot.selectedFoliageId,
        snapshot.selectedRoadId,
      );
      this.handleWorkerInfo(snapshot.workersAssigned, snapshot.workerSlots);
      this.handleBuildingDetails(snapshot.buildingDetails);
    }

    this.events.once('shutdown', () => {
      this.game.events.off(EVENT_KEYS.resourcesChanged, this.handleResources, this);
      this.game.events.off(EVENT_KEYS.villageChanged, this.handleVillage, this);
      this.game.events.off(EVENT_KEYS.buildingAvailabilityChanged, this.handleBuildingAvailability, this);
      this.game.events.off(EVENT_KEYS.buildingSelectionChanged, this.handleSelection, this);
      this.game.events.off(EVENT_KEYS.dayChanged, this.handleDay, this);
      this.game.events.off(EVENT_KEYS.devPaintStateChanged, this.handleDevPaintState, this);
      this.game.events.off(EVENT_KEYS.toast, this.handleToast, this);
      this.game.events.off(EVENT_KEYS.workerInfoChanged, this.handleWorkerInfo, this);
      this.game.events.off(EVENT_KEYS.buildingDetailsChanged, this.handleBuildingDetails, this);
      this.hud?.destroy();
    });
  }

  private handleResources(resources: Resources): void {
    this.hud?.setResources(resources);
  }

  private handleVillage(village: VillageState): void {
    this.hud?.setVillage(village);
  }

  private handleBuildingAvailability(availability: Record<BuildingType, BuildingAvailability>): void {
    this.hud?.setBuildingAvailability(availability);
  }

  private handleSelection(selected: BuildingType | null, bulldozeMode = false): void {
    this.hud?.setSelectedBuilding(selected, bulldozeMode);
  }

  private handleDay(day: number): void {
    this.hud?.setDay(day);
  }

  private handleDevPaintState(
    enabled: boolean,
    selectedFoliageId: string | null,
    selectedRoadId: string | null,
  ): void {
    this.hud?.setDevPaintState(enabled, selectedFoliageId, selectedRoadId);
  }

  private handleToast(message: string): void {
    this.hud?.showMessage(message);
  }

  private handleWorkerInfo(assigned: number, totalSlots: number): void {
    this.hud?.setWorkerInfo(assigned, totalSlots);
  }

  private handleBuildingDetails(payload: BuildingDetailsPayload | null): void {
    this.hud?.setBuildingDetails(payload);
  }

  private buildBuildingIconMap(): Map<BuildingType, string> {
    const map = new Map<BuildingType, string>();
    for (const building of BUILDING_LIST) {
      const textureKey = `building_sprite_${building.type}`;
      const texture = this.textures.get(textureKey);
      if (!texture) {
        continue;
      }
      const source = texture.getSourceImage() as CanvasImageSource & {
        width?: number;
        height?: number;
        toDataURL?: (type?: string) => string;
      };
      if (!source) {
        continue;
      }
      if (typeof source.toDataURL === 'function') {
        map.set(building.type, source.toDataURL('image/png'));
        continue;
      }
      const width = source.width ?? 0;
      const height = source.height ?? 0;
      if (!width || !height) {
        continue;
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        continue;
      }
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(source, 0, 0, width, height);
      map.set(building.type, canvas.toDataURL('image/png'));
    }
    return map;
  }
}
