import type Phaser from 'phaser';
import { createBuildingView, playPlaceTween } from '../entities/Building';
import { HUD_MESSAGES } from '../constants';
import type { BuildingSystem } from './BuildingSystem';
import type { EconomySystem } from './EconomySystem';
import type { ResourceSystem } from './ResourceSystem';
import type { VillagerSystem } from './VillagerSystem';
import type { ConstructionSystem } from './ConstructionSystem';
import type {
  BuildPlacementError,
  BuildingAvailability,
  BuildingType,
  ResourceCost,
  VillageState,
} from '../types/game';
import { worldToGrid } from '../utils/grid';

interface PlacementContext {
  selectedBuilding: BuildingType | null;
  bulldozeMode: boolean;
  tileSize: number;
  gridBounds: { width: number; height: number };
  buildingAvailability: Record<BuildingType, BuildingAvailability>;
  village: VillageState;
}

interface PlacementHandlers {
  updateVillage: (village: VillageState) => void;
  refreshBuildingAvailability: () => void;
  onBuildingPlaced: (buildingId: string, view: Phaser.GameObjects.Container) => void;
  onBuildingRemoved: (buildingId: string) => void;
  emitResourcesChanged: () => void;
  emitVillageChanged: () => void;
  emitAvailabilityChanged: () => void;
  persistState: () => void;
  updatePreview: (pointer: Phaser.Input.Pointer) => void;
  emitToast: (message: string) => void;
  clearSelection: () => void;
}

export class PlacementSystem {
  private readonly scene: Phaser.Scene;
  private readonly buildingSystem: BuildingSystem;
  private readonly resourceSystem: ResourceSystem;
  private readonly economySystem: EconomySystem;
  private readonly villagerSystem: VillagerSystem;
  private readonly constructionSystem: ConstructionSystem;
  private readonly handlers: PlacementHandlers;

  constructor(
    scene: Phaser.Scene,
    buildingSystem: BuildingSystem,
    resourceSystem: ResourceSystem,
    economySystem: EconomySystem,
    villagerSystem: VillagerSystem,
    constructionSystem: ConstructionSystem,
    handlers: PlacementHandlers,
  ) {
    this.scene = scene;
    this.buildingSystem = buildingSystem;
    this.resourceSystem = resourceSystem;
    this.economySystem = economySystem;
    this.villagerSystem = villagerSystem;
    this.constructionSystem = constructionSystem;
    this.handlers = handlers;
  }

  public tryPlace(pointer: Phaser.Input.Pointer, ctx: PlacementContext): void {
    if (ctx.bulldozeMode) {
      this.tryBulldoze(pointer, ctx);
      return;
    }
    if (!ctx.selectedBuilding) {
      return;
    }
    if (pointer.getDistance() > 10) {
      return;
    }
    const gridPos = worldToGrid(pointer.worldX, pointer.worldY, ctx.tileSize);
    const definition = this.buildingSystem.getDefinition(ctx.selectedBuilding);
    const availability = ctx.buildingAvailability[ctx.selectedBuilding];

    if (availability && !availability.unlocked) {
      this.handlers.emitToast(availability.reason ?? 'Building is locked');
      this.handlers.clearSelection();
      return;
    }
    const upfrontCost = this.getUpfrontCost(definition.cost);
    if (!this.resourceSystem.canAfford(upfrontCost)) {
      this.handlers.emitToast(HUD_MESSAGES.notEnoughResources);
      this.handlers.updatePreview(pointer);
      return;
    }
    const placement = this.buildingSystem.canPlace(
      ctx.selectedBuilding,
      gridPos.x,
      gridPos.y,
      ctx.gridBounds,
    );
    if (!placement.ok) {
      this.emitPlacementError(placement.error);
      this.handlers.updatePreview(pointer);
      return;
    }
    const spent = this.resourceSystem.spend(upfrontCost);
    if (!spent) {
      this.handlers.emitToast(HUD_MESSAGES.notEnoughResources);
      return;
    }
    const result = this.buildingSystem.place(
      ctx.selectedBuilding,
      gridPos.x,
      gridPos.y,
      ctx.gridBounds,
    );
    if (!result.ok || !result.building) {
      this.resourceSystem.add(upfrontCost);
      this.emitPlacementError(result.error);
      return;
    }
    this.constructionSystem.initConstruction(result.building, definition.cost, upfrontCost, 0.2);
    const view = createBuildingView(this.scene, result.building, definition, ctx.tileSize);
    playPlaceTween(this.scene, view);
    this.handlers.onBuildingPlaced(result.building.id, view);
    this.postChange(ctx, pointer);
    this.handlers.emitResourcesChanged();
  }

  private tryBulldoze(pointer: Phaser.Input.Pointer, ctx: PlacementContext): void {
    if (pointer.getDistance() > 10) {
      return;
    }
    const gridPos = worldToGrid(pointer.worldX, pointer.worldY, ctx.tileSize);
    const removed = this.buildingSystem.removeAt(gridPos.x, gridPos.y);
    if (!removed.ok || !removed.building) {
      this.handlers.emitToast('Nothing to remove');
      this.handlers.updatePreview(pointer);
      return;
    }
    this.handlers.onBuildingRemoved(removed.building.id);
    this.postChange(ctx, pointer);
    this.handlers.emitToast('Building removed');
  }

  private postChange(ctx: PlacementContext, pointer: Phaser.Input.Pointer): void {
    const nextVillage = this.economySystem.syncVillage(this.buildingSystem.getBuildings(), ctx.village);
    this.handlers.updateVillage(nextVillage);
    this.handlers.refreshBuildingAvailability();
    this.villagerSystem.reassignJobs();
    this.handlers.emitVillageChanged();
    this.handlers.emitAvailabilityChanged();
    this.handlers.persistState();
    this.handlers.updatePreview(pointer);
  }

  private emitPlacementError(error?: BuildPlacementError): void {
    if (!error) {
      this.handlers.emitToast(HUD_MESSAGES.cannotBuild);
      return;
    }
    const messages: Record<BuildPlacementError, string> = {
      not_enough_resources: HUD_MESSAGES.notEnoughResources,
      tile_occupied: HUD_MESSAGES.tileOccupied,
      cannot_build_here: HUD_MESSAGES.cannotBuild,
    };
    this.handlers.emitToast(messages[error]);
  }

  private getUpfrontCost(cost: ResourceCost): ResourceCost {
    const upfront: ResourceCost = {};
    for (const [resource, value] of Object.entries(cost)) {
      const amount = value ?? 0;
      if (amount <= 0) {
        continue;
      }
      upfront[resource as keyof ResourceCost] = Math.max(1, Math.floor(amount * 0.2));
    }
    return upfront;
  }
}
