import type Phaser from 'phaser';
import { BUILDING_DEFINITIONS } from '../data/buildings';
import type { BuildingSystem } from './BuildingSystem';
import type { BuildingAvailability, BuildingType, Resources } from '../types/game';
import type { ResourceSystem } from './ResourceSystem';
import { gridToWorld, worldToGrid } from '../utils/grid';

interface PreviewState {
  devPaintEnabled: boolean;
  selectedRoadId: string | null;
  selectedFoliageId: string | null;
  selectedBuilding: BuildingType | null;
  bulldozeMode: boolean;
  tileSize: number;
}

interface BuildState {
  buildingAvailability: Record<BuildingType, BuildingAvailability>;
  resources: Resources;
}

export class PlacementPreviewSystem {
  private readonly preview: Phaser.GameObjects.Graphics;
  private readonly buildingSystem: BuildingSystem;
  private readonly resourceSystem: ResourceSystem;
  private readonly gridBounds: { width: number; height: number };
  private readonly emitToast: (message: string) => void;

  constructor(
    preview: Phaser.GameObjects.Graphics,
    buildingSystem: BuildingSystem,
    resourceSystem: ResourceSystem,
    gridBounds: { width: number; height: number },
    emitToast: (message: string) => void,
  ) {
    this.preview = preview;
    this.buildingSystem = buildingSystem;
    this.resourceSystem = resourceSystem;
    this.gridBounds = gridBounds;
    this.emitToast = emitToast;
  }

  public clear(): void {
    this.preview.clear();
  }

  public update(
    pointer: Phaser.Input.Pointer,
    state: PreviewState,
    buildState: BuildState,
    onLockedBuilding: () => void,
  ): void {
    if (state.devPaintEnabled) {
      const gridPos = worldToGrid(pointer.worldX, pointer.worldY, state.tileSize);
      const worldPos = gridToWorld(gridPos.x, gridPos.y, state.tileSize);
      const color =
        state.selectedRoadId !== null ? 0xd3b06e : state.selectedFoliageId !== null ? 0x6fd4aa : 0xe0c37a;
      this.preview.clear();
      this.preview.fillStyle(color, 0.32);
      this.preview.fillRect(worldPos.x, worldPos.y, state.tileSize, state.tileSize);
      this.preview.lineStyle(2, color, 0.9);
      this.preview.strokeRect(worldPos.x, worldPos.y, state.tileSize, state.tileSize);
      return;
    }

    if (!state.selectedBuilding) {
      if (state.bulldozeMode) {
        const gridPos = worldToGrid(pointer.worldX, pointer.worldY, state.tileSize);
        const target = this.buildingSystem.getBuildingAt(gridPos.x, gridPos.y);
        const worldPos = target
          ? gridToWorld(target.x, target.y, state.tileSize)
          : gridToWorld(gridPos.x, gridPos.y, state.tileSize);
        const width = target ? BUILDING_DEFINITIONS[target.type].size.w * state.tileSize : state.tileSize;
        const height = target ? BUILDING_DEFINITIONS[target.type].size.h * state.tileSize : state.tileSize;
        this.preview.clear();
        this.preview.fillStyle(target ? 0xc05555 : 0x8f6f53, 0.34);
        this.preview.fillRect(worldPos.x, worldPos.y, width, height);
        this.preview.lineStyle(2, target ? 0xf0b0b0 : 0xc49a68, 0.9);
        this.preview.strokeRect(worldPos.x, worldPos.y, width, height);
        return;
      }
      this.preview.clear();
      return;
    }

    const gridPos = worldToGrid(pointer.worldX, pointer.worldY, state.tileSize);
    const definition = this.buildingSystem.getDefinition(state.selectedBuilding);
    const availability = buildState.buildingAvailability[state.selectedBuilding];
    if (availability && !availability.unlocked) {
      this.emitToast(availability.reason ?? 'Building is locked');
      onLockedBuilding();
      return;
    }
    const canAfford = this.resourceSystem.canAfford(definition.cost);
    const placement = this.buildingSystem.canPlace(
      state.selectedBuilding,
      gridPos.x,
      gridPos.y,
      this.gridBounds,
    );
    const isValid = canAfford && placement.ok;
    const worldPos = gridToWorld(gridPos.x, gridPos.y, state.tileSize);
    const width = definition.size.w * state.tileSize;
    const height = definition.size.h * state.tileSize;

    this.preview.clear();
    this.preview.fillStyle(isValid ? 0x61ad62 : 0xd05353, 0.4);
    this.preview.fillRect(worldPos.x, worldPos.y, width, height);
    this.preview.lineStyle(2, isValid ? 0x9ee29c : 0xf3c0c0, 0.9);
    this.preview.strokeRect(worldPos.x, worldPos.y, width, height);
  }
}
