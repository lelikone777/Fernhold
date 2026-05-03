import Phaser from 'phaser';
import { DEV_FOLIAGE_ITEMS } from '../data/devFoliage';
import { DEV_ROAD_ITEMS } from '../data/devRoads';
import { createBuildingView } from '../entities/Building';
import { CAMERA, DAY_DURATION_MS, EVENT_KEYS, HUD_MESSAGES } from '../constants';
import { BUILDING_DEFINITIONS } from '../data/buildings';
import { MAP_CONFIG } from '../data/map';
import { INITIAL_RESOURCES, INITIAL_VILLAGE } from '../data/resources';
import { BuildingSystem } from '../systems/BuildingSystem';
import { CameraSystem } from '../systems/CameraSystem';
import { EconomySystem } from '../systems/EconomySystem';
import { InputSystem } from '../systems/InputSystem';
import { ProgressionSystem } from '../systems/ProgressionSystem';
import { ResourceSystem } from '../systems/ResourceSystem';
import { SaveSystem } from '../systems/SaveSystem';
import type {
  BuildPlacementError,
  BuildingAvailability,
  BuildingType,
  CameraState,
  DayReport,
  DevFoliageDefinition,
  DevRoadDefinition,
  PlacedFoliage,
  PlacedBuilding,
  PlacedRoad,
  Resources,
  VillageState,
} from '../types/game';
import { gridToWorld, worldToGrid } from '../utils/grid';
import { resetIdCounters, setBuildingCounter } from '../utils/ids';

interface UiSnapshot {
  resources: Resources;
  village: VillageState;
  buildingAvailability: Record<BuildingType, BuildingAvailability>;
  selectedBuilding: BuildingType | null;
  bulldozeMode: boolean;
  day: number;
  devPaintEnabled: boolean;
  selectedFoliageId: string | null;
  selectedRoadId: string | null;
}

export class WorldScene extends Phaser.Scene {
  private readonly mapWidth = MAP_CONFIG.mapWidth;
  private readonly mapHeight = MAP_CONFIG.mapHeight;
  private readonly tileSize = MAP_CONFIG.tileSize;

  private readonly saveSystem = new SaveSystem();
  private readonly buildingSystem = new BuildingSystem();
  private readonly economySystem = new EconomySystem();
  private readonly progressionSystem = new ProgressionSystem();

  private resourceSystem!: ResourceSystem;
  private village!: VillageState;
  private buildingAvailability!: Record<BuildingType, BuildingAvailability>;
  private cameraSystem!: CameraSystem;
  private inputSystem!: InputSystem;
  private preview!: Phaser.GameObjects.Graphics;
  private readonly roadSprites = new Map<string, Phaser.GameObjects.Container>();
  private readonly roads = new Map<string, PlacedRoad>();
  private readonly foliageSprites = new Map<string, Phaser.GameObjects.Image>();
  private readonly foliageObjects = new Map<string, PlacedFoliage>();
  private readonly roadDefinitions = new Map<string, DevRoadDefinition>(
    DEV_ROAD_ITEMS.map((item) => [item.id, item]),
  );
  private readonly foliageDefinitions = new Map<string, DevFoliageDefinition>(
    DEV_FOLIAGE_ITEMS.map((item) => [item.id, item]),
  );

  private selectedBuilding: BuildingType | null = null;
  private bulldozeMode = false;
  private devPaintEnabled = false;
  private selectedFoliageId: string | null = null;
  private selectedRoadId: string | null = null;
  private day = 1;
  private autosaveElapsedMs = 0;
  private dayElapsedMs = 0;
  private isPointerDown = false;
  private roadStrokeAnchor: { x: number; y: number } | null = null;
  private roadStrokeAxis: 'x' | 'y' | null = null;
  private roadLastPaintCell: { x: number; y: number } | null = null;

  private readonly buildingViews = new Map<string, Phaser.GameObjects.Container>();
  private readonly gridBounds = { width: MAP_CONFIG.mapWidth, height: MAP_CONFIG.mapHeight };

  constructor() {
    super('WorldScene');
  }

  public create(): void {
    const save = this.saveSystem.load();
    const starterBuildings = this.getStarterBuildings();
    const initialBuildings = save?.buildings ?? starterBuildings;

    this.resourceSystem = new ResourceSystem(save?.resources ?? INITIAL_RESOURCES);
    this.village = { ...(save?.village ?? INITIAL_VILLAGE) };

    this.buildingSystem.load(initialBuildings);
    this.village = this.economySystem.syncVillage(this.buildingSystem.getBuildings(), this.village);
    setBuildingCounter(this.buildingSystem.getBuildings().length);
    this.day = save?.day ?? 1;
    this.refreshBuildingAvailability();
    this.devPaintEnabled = Boolean(this.registry.get('devPaintAutostart'));
    this.selectedFoliageId = this.devPaintEnabled ? DEV_FOLIAGE_ITEMS[0]?.id ?? null : null;
    this.selectedRoadId = null;
    this.registry.set('devPaintAutostart', false);
    for (const road of save?.roads ?? []) {
      this.roads.set(this.toGridKey(road.x, road.y), road);
    }
    for (const foliageObject of save?.foliageObjects ?? []) {
      this.foliageObjects.set(this.toGridKey(foliageObject.x, foliageObject.y), foliageObject);
    }

    this.drawGround();
    this.drawNatureDecor();
    this.drawGrid();
    this.renderRoadLayer();
    this.renderFoliageLayer();
    this.preview = this.add.graphics();
    this.renderAllBuildings();

    const worldPixelsWidth = this.mapWidth * this.tileSize;
    const worldPixelsHeight = this.mapHeight * this.tileSize;

    const mainCamera = this.cameras.main;
    mainCamera.setBounds(0, 0, worldPixelsWidth, worldPixelsHeight);

    this.cameraSystem = new CameraSystem(this, mainCamera, worldPixelsWidth, worldPixelsHeight);
    this.cameraSystem.setCanStartDragViewport(() => !this.isRoadPaintModeActive());
    this.cameraSystem.attach();

    const initialZoom = save?.camera?.zoom ?? CAMERA.defaultZoom;
    mainCamera.setZoom(initialZoom);

    if (save?.camera) {
      mainCamera.scrollX = save.camera.scrollX;
      mainCamera.scrollY = save.camera.scrollY;
    } else {
      mainCamera.centerOn(worldPixelsWidth * 0.5, worldPixelsHeight * 0.5);
    }
    this.cameraSystem.update(0);

    this.inputSystem = new InputSystem(this);
    this.inputSystem.bind();
    this.inputSystem.setPointerMoveCallback((pointer) => {
      this.updatePreview(pointer);
      if (this.isRoadPaintModeActive() && pointer.isDown) {
        this.paintAtPointer(pointer, true);
      }
    });
    this.inputSystem.setConfirmCallback((pointer) => {
      this.tryPlaceSelected(pointer);
    });
    this.inputSystem.setCancelCallback(() => {
      this.clearSelection();
    });

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.isPointerDown = true;
      if (this.isRoadPaintModeActive()) {
        const gridPos = worldToGrid(pointer.worldX, pointer.worldY, this.tileSize);
        this.roadStrokeAnchor = { x: gridPos.x, y: gridPos.y };
        this.roadStrokeAxis = null;
        this.roadLastPaintCell = null;
        this.paintAtPointer(pointer, true);
      }
    });
    this.input.on('pointerup', () => {
      this.isPointerDown = false;
      this.roadStrokeAnchor = null;
      this.roadStrokeAxis = null;
      this.roadLastPaintCell = null;
    });

    this.bindUiEvents();
    this.emitFullState();
  }

  public update(_time: number, delta: number): void {
    this.cameraSystem.update(delta);
    this.autosaveElapsedMs += delta;
    this.dayElapsedMs += delta;

    if (this.dayElapsedMs >= DAY_DURATION_MS) {
      this.dayElapsedMs = 0;
      this.advanceDay();
    }

    if (this.autosaveElapsedMs >= 2000 && !this.isPointerDown) {
      this.persistState();
      this.autosaveElapsedMs = 0;
    }
  }

  public cleanup(): void {
    this.cameraSystem.destroy();
    this.inputSystem.destroy();
  }

  public getUiSnapshot(): UiSnapshot {
    return {
      resources: this.resourceSystem.getResources(),
      village: this.village,
      buildingAvailability: this.buildingAvailability,
      selectedBuilding: this.selectedBuilding,
      bulldozeMode: this.bulldozeMode,
      day: this.day,
      devPaintEnabled: this.devPaintEnabled,
      selectedFoliageId: this.selectedFoliageId,
      selectedRoadId: this.selectedRoadId,
    };
  }

  private drawGround(): void {
    for (let y = 0; y < this.mapHeight; y += 1) {
      for (let x = 0; x < this.mapWidth; x += 1) {
        const world = gridToWorld(x, y, this.tileSize);
        this.add.image(world.x, world.y, 'terrain_grass_solid').setOrigin(0);
      }
    }
  }

  private drawNatureDecor(): void {
    // Intentionally empty: user requested only grass on map.
  }

  private drawGrid(): void {
    // Intentionally empty: user requested only grass on map.
  }

  private renderAllBuildings(): void {
    for (const view of this.buildingViews.values()) {
      view.destroy();
    }
    this.buildingViews.clear();

    for (const placed of this.buildingSystem.getBuildings()) {
      const definition = BUILDING_DEFINITIONS[placed.type];
      const view = createBuildingView(this, placed, definition, this.tileSize);
      this.buildingViews.set(placed.id, view);
    }
  }

  private bindUiEvents(): void {
    this.game.events.on(EVENT_KEYS.requestSelectBuilding, this.handleSelectBuilding, this);
    this.game.events.on(EVENT_KEYS.requestSetBulldozeMode, this.handleSetBulldozeMode, this);
    this.game.events.on(EVENT_KEYS.requestResetSave, this.handleResetSave, this);
    this.game.events.on(EVENT_KEYS.requestSetDevPaintEnabled, this.handleSetDevPaintEnabled, this);
    this.game.events.on(EVENT_KEYS.requestSelectDevFoliage, this.handleSelectDevFoliage, this);
    this.game.events.on(EVENT_KEYS.requestSelectDevRoad, this.handleSelectDevRoad, this);
    this.game.events.on(EVENT_KEYS.requestEraseDevPaintTile, this.handleEraseDevPaintTile, this);

    this.events.once('shutdown', () => {
      this.game.events.off(EVENT_KEYS.requestSelectBuilding, this.handleSelectBuilding, this);
      this.game.events.off(EVENT_KEYS.requestSetBulldozeMode, this.handleSetBulldozeMode, this);
      this.game.events.off(EVENT_KEYS.requestResetSave, this.handleResetSave, this);
      this.game.events.off(EVENT_KEYS.requestSetDevPaintEnabled, this.handleSetDevPaintEnabled, this);
      this.game.events.off(EVENT_KEYS.requestSelectDevFoliage, this.handleSelectDevFoliage, this);
      this.game.events.off(EVENT_KEYS.requestSelectDevRoad, this.handleSelectDevRoad, this);
      this.game.events.off(EVENT_KEYS.requestEraseDevPaintTile, this.handleEraseDevPaintTile, this);
      this.cleanup();
    });
  }

  private handleSelectBuilding(type: BuildingType): void {
    const availability = this.buildingAvailability[type];
    if (availability && !availability.unlocked) {
      this.emitToast(availability.reason ?? 'Building is locked');
      return;
    }
    this.devPaintEnabled = false;
    this.bulldozeMode = false;
    this.selectedFoliageId = null;
    this.selectedRoadId = null;
    this.selectedBuilding = type;
    this.preview.clear();
    this.emitDevPaintState();
    this.game.events.emit(EVENT_KEYS.buildingSelectionChanged, this.selectedBuilding, this.bulldozeMode);
  }

  private handleSetBulldozeMode(enabled: boolean): void {
    this.devPaintEnabled = false;
    this.selectedFoliageId = null;
    this.selectedRoadId = null;
    this.selectedBuilding = null;
    this.bulldozeMode = enabled;
    this.preview.clear();
    this.emitDevPaintState();
    this.game.events.emit(EVENT_KEYS.buildingSelectionChanged, this.selectedBuilding, this.bulldozeMode);
  }

  private handleResetSave(): void {
    this.resetGameState();
  }

  private handleSetDevPaintEnabled(enabled: boolean): void {
    this.devPaintEnabled = enabled;
    if (enabled && this.selectedFoliageId === null && this.selectedRoadId === null) {
      this.selectedFoliageId = DEV_FOLIAGE_ITEMS[0]?.id ?? null;
    }
    if (!enabled) {
      this.selectedFoliageId = null;
      this.selectedRoadId = null;
    }
    this.bulldozeMode = false;
    this.selectedBuilding = enabled ? null : this.selectedBuilding;
    this.preview.clear();
    this.emitDevPaintState();
    this.game.events.emit(EVENT_KEYS.buildingSelectionChanged, this.selectedBuilding, this.bulldozeMode);
  }

  private handleSelectDevFoliage(foliageId: string): void {
    this.devPaintEnabled = true;
    this.selectedBuilding = null;
    this.bulldozeMode = false;
    this.selectedFoliageId = foliageId;
    this.selectedRoadId = null;
    this.preview.clear();
    this.emitDevPaintState();
    this.game.events.emit(EVENT_KEYS.buildingSelectionChanged, this.selectedBuilding, this.bulldozeMode);
  }

  private handleSelectDevRoad(roadId: string): void {
    this.devPaintEnabled = true;
    this.selectedBuilding = null;
    this.bulldozeMode = false;
    this.selectedFoliageId = null;
    this.selectedRoadId = roadId;
    this.preview.clear();
    this.emitDevPaintState();
    this.game.events.emit(EVENT_KEYS.buildingSelectionChanged, this.selectedBuilding, this.bulldozeMode);
  }

  private handleEraseDevPaintTile(): void {
    this.devPaintEnabled = true;
    this.selectedBuilding = null;
    this.bulldozeMode = false;
    this.selectedFoliageId = null;
    this.selectedRoadId = null;
    this.preview.clear();
    this.emitDevPaintState();
    this.game.events.emit(EVENT_KEYS.buildingSelectionChanged, this.selectedBuilding, this.bulldozeMode);
  }

  private clearSelection(): void {
    this.selectedBuilding = null;
    this.bulldozeMode = false;
    this.preview.clear();
    this.game.events.emit(EVENT_KEYS.buildingSelectionChanged, this.selectedBuilding, this.bulldozeMode);
  }

  private updatePreview(pointer: Phaser.Input.Pointer): void {
    if (this.devPaintEnabled) {
      const gridPos = worldToGrid(pointer.worldX, pointer.worldY, this.tileSize);
      const worldPos = gridToWorld(gridPos.x, gridPos.y, this.tileSize);
      const color = this.selectedRoadId !== null ? 0xd3b06e : this.selectedFoliageId !== null ? 0x6fd4aa : 0xe0c37a;
      this.preview.clear();
      this.preview.fillStyle(color, 0.32);
      this.preview.fillRect(worldPos.x, worldPos.y, this.tileSize, this.tileSize);
      this.preview.lineStyle(2, color, 0.9);
      this.preview.strokeRect(worldPos.x, worldPos.y, this.tileSize, this.tileSize);
      return;
    }

    if (!this.selectedBuilding) {
      if (this.bulldozeMode) {
        const gridPos = worldToGrid(pointer.worldX, pointer.worldY, this.tileSize);
        const target = this.buildingSystem.getBuildingAt(gridPos.x, gridPos.y);
        const worldPos = target ? gridToWorld(target.x, target.y, this.tileSize) : gridToWorld(gridPos.x, gridPos.y, this.tileSize);
        const width = target ? BUILDING_DEFINITIONS[target.type].size.w * this.tileSize : this.tileSize;
        const height = target ? BUILDING_DEFINITIONS[target.type].size.h * this.tileSize : this.tileSize;
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

    const gridPos = worldToGrid(pointer.worldX, pointer.worldY, this.tileSize);
    const definition = this.buildingSystem.getDefinition(this.selectedBuilding);
    const availability = this.buildingAvailability[this.selectedBuilding];
    if (availability && !availability.unlocked) {
      this.emitToast(availability.reason ?? 'Building is locked');
      this.clearSelection();
      return;
    }
    const canAfford = this.resourceSystem.canAfford(definition.cost);
    const placement = this.buildingSystem.canPlace(
      this.selectedBuilding,
      gridPos.x,
      gridPos.y,
      this.gridBounds,
    );
    const isValid = canAfford && placement.ok;

    const worldPos = gridToWorld(gridPos.x, gridPos.y, this.tileSize);
    const width = definition.size.w * this.tileSize;
    const height = definition.size.h * this.tileSize;

    this.preview.clear();
    this.preview.fillStyle(isValid ? 0x61ad62 : 0xd05353, 0.4);
    this.preview.fillRect(worldPos.x, worldPos.y, width, height);
    this.preview.lineStyle(2, isValid ? 0x9ee29c : 0xf3c0c0, 0.9);
    this.preview.strokeRect(worldPos.x, worldPos.y, width, height);
  }

  private tryPlaceSelected(pointer: Phaser.Input.Pointer): void {
    if (this.devPaintEnabled) {
      this.paintAtPointer(pointer);
      return;
    }

    if (this.bulldozeMode) {
      if (pointer.getDistance() > 10) {
        return;
      }
      const gridPos = worldToGrid(pointer.worldX, pointer.worldY, this.tileSize);
      const removed = this.buildingSystem.removeAt(gridPos.x, gridPos.y);
      if (!removed.ok || !removed.building) {
        this.emitToast('Nothing to remove');
        this.updatePreview(pointer);
        return;
      }
      this.buildingViews.get(removed.building.id)?.destroy();
      this.buildingViews.delete(removed.building.id);
      this.village = this.economySystem.syncVillage(this.buildingSystem.getBuildings(), this.village);
      this.refreshBuildingAvailability();
      this.game.events.emit(EVENT_KEYS.villageChanged, this.village);
      this.game.events.emit(EVENT_KEYS.buildingAvailabilityChanged, this.buildingAvailability);
      this.persistState();
      this.updatePreview(pointer);
      this.emitToast('Building removed');
      return;
    }

    if (!this.selectedBuilding) {
      return;
    }

    if (pointer.getDistance() > 10) {
      return;
    }

    const gridPos = worldToGrid(pointer.worldX, pointer.worldY, this.tileSize);
    const definition = this.buildingSystem.getDefinition(this.selectedBuilding);
    const availability = this.buildingAvailability[this.selectedBuilding];

    if (availability && !availability.unlocked) {
      this.emitToast(availability.reason ?? 'Building is locked');
      this.clearSelection();
      return;
    }

    if (!this.resourceSystem.canAfford(definition.cost)) {
      this.emitToast(HUD_MESSAGES.notEnoughResources);
      this.updatePreview(pointer);
      return;
    }

    const placement = this.buildingSystem.canPlace(
      this.selectedBuilding,
      gridPos.x,
      gridPos.y,
      this.gridBounds,
    );
    if (!placement.ok) {
      this.emitPlacementError(placement.error);
      this.updatePreview(pointer);
      return;
    }

    const spent = this.resourceSystem.spend(definition.cost);
    if (!spent) {
      this.emitToast(HUD_MESSAGES.notEnoughResources);
      return;
    }

    const result = this.buildingSystem.place(
      this.selectedBuilding,
      gridPos.x,
      gridPos.y,
      this.gridBounds,
    );

    if (!result.ok || !result.building) {
      this.resourceSystem.add(definition.cost);
      this.emitPlacementError(result.error);
      return;
    }

    const view = createBuildingView(this, result.building, definition, this.tileSize);
    this.buildingViews.set(result.building.id, view);

    this.village = this.economySystem.syncVillage(this.buildingSystem.getBuildings(), this.village);
    this.refreshBuildingAvailability();
    this.game.events.emit(EVENT_KEYS.resourcesChanged, this.resourceSystem.getResources());
    this.game.events.emit(EVENT_KEYS.villageChanged, this.village);
    this.game.events.emit(EVENT_KEYS.buildingAvailabilityChanged, this.buildingAvailability);
    this.persistState();
    this.updatePreview(pointer);
  }

  private emitPlacementError(error?: BuildPlacementError): void {
    if (!error) {
      this.emitToast(HUD_MESSAGES.cannotBuild);
      return;
    }

    const messages: Record<BuildPlacementError, string> = {
      not_enough_resources: HUD_MESSAGES.notEnoughResources,
      tile_occupied: HUD_MESSAGES.tileOccupied,
      cannot_build_here: HUD_MESSAGES.cannotBuild,
    };

    this.emitToast(messages[error]);
  }

  private emitToast(message: string): void {
    this.game.events.emit(EVENT_KEYS.toast, message);
  }

  private emitFullState(): void {
    this.game.events.emit(EVENT_KEYS.resourcesChanged, this.resourceSystem.getResources());
    this.game.events.emit(EVENT_KEYS.villageChanged, this.village);
    this.game.events.emit(EVENT_KEYS.buildingAvailabilityChanged, this.buildingAvailability);
    this.game.events.emit(EVENT_KEYS.buildingSelectionChanged, this.selectedBuilding, this.bulldozeMode);
    this.game.events.emit(EVENT_KEYS.dayChanged, this.day);
    this.emitDevPaintState();
  }

  private persistState(): void {
    this.saveSystem.save({
      resources: this.resourceSystem.getResources(),
      village: this.village,
      buildings: this.buildingSystem.getBuildings(),
      roads: [...this.roads.values()],
      foliageObjects: [...this.foliageObjects.values()],
      day: this.day,
      camera: this.getCameraState(),
    });
  }

  private getCameraState(): CameraState {
    const camera = this.cameras.main;
    return {
      scrollX: camera.scrollX,
      scrollY: camera.scrollY,
      zoom: camera.zoom,
    };
  }

  private resetGameState(): void {
    this.saveSystem.clear();
    resetIdCounters();
    const starterBuildings = this.getStarterBuildings();

    for (const view of this.buildingViews.values()) {
      view.destroy();
    }
    this.buildingViews.clear();

    this.buildingSystem.clear();
    this.buildingSystem.load(starterBuildings);
    this.clearRoadLayer();
    this.clearFoliageLayer();
    this.resourceSystem.setResources(INITIAL_RESOURCES);
    this.village = this.economySystem.syncVillage(starterBuildings, { ...INITIAL_VILLAGE });
    this.day = 1;
    this.dayElapsedMs = 0;
    this.refreshBuildingAvailability();
    this.clearSelection();

    this.renderAllBuildings();

    const camera = this.cameras.main;
    camera.setZoom(CAMERA.defaultZoom);
    camera.centerOn((this.mapWidth * this.tileSize) / 2, (this.mapHeight * this.tileSize) / 2);

    this.persistState();
    this.emitFullState();
    this.emitToast('Save reset');
  }

  private paintAtPointer(pointer: Phaser.Input.Pointer, allowDrag = false): void {
    if (!allowDrag && pointer.getDistance() > 10) {
      return;
    }

    const gridPos = worldToGrid(pointer.worldX, pointer.worldY, this.tileSize);
    if (
      gridPos.x < 0 ||
      gridPos.y < 0 ||
      gridPos.x >= this.mapWidth ||
      gridPos.y >= this.mapHeight
    ) {
      return;
    }

    const key = this.toGridKey(gridPos.x, gridPos.y);
    if (this.selectedRoadId !== null) {
      const roadDefinition = this.roadDefinitions.get(this.selectedRoadId);
      if (!roadDefinition) {
        return;
      }

      const constrained = this.getConstrainedRoadCell(gridPos);
      this.paintRoadSegment(constrained.x, constrained.y, roadDefinition.id);
      this.persistState();
      return;
    }

    if (this.selectedFoliageId !== null) {
      const foliageDefinition = this.foliageDefinitions.get(this.selectedFoliageId);
      if (!foliageDefinition) {
        return;
      }

      const foliage: PlacedFoliage = {
        id: `${this.selectedFoliageId}_${gridPos.x}_${gridPos.y}`,
        foliageId: foliageDefinition.id,
        x: gridPos.x,
        y: gridPos.y,
      };
      this.foliageObjects.set(key, foliage);
      this.renderFoliageObject(foliage);
      this.persistState();
      return;
    }

    this.removeRoadTile(key);
    this.removeFoliageObject(key);
    this.persistState();
  }

  private renderRoadLayer(): void {
    for (const road of this.roads.values()) {
      this.renderRoadTile(road);
    }
  }

  private renderFoliageLayer(): void {
    for (const foliage of this.foliageObjects.values()) {
      this.renderFoliageObject(foliage);
    }
  }

  private renderRoadTile(road: PlacedRoad): void {
    const roadKey = this.toGridKey(road.x, road.y);
    this.roadSprites.get(roadKey)?.destroy();

    const neighbors = this.getRoadNeighbors(road.x, road.y, road.roadId);
    const textureKey = this.getRoadTextureKey(road.roadId);
    if (!textureKey) {
      return;
    }

    const world = gridToWorld(road.x, road.y, this.tileSize);
    const centerX = world.x + this.tileSize * 0.5;
    const centerY = world.y + this.tileSize * 0.5;
    const style = this.getRoadBaseStyle(road.roadId);

    const background = this.add.graphics();
    const roadShape = this.add.graphics();
    const maskShape = this.add.graphics();

    background.fillStyle(style.shadow, 0.2);
    background.fillEllipse(centerX, centerY + 1, this.tileSize * 0.92, this.tileSize * 0.6);

    this.drawRoadShape(roadShape, world.x, world.y, neighbors, style.edge, style.innerWidth + 2, style.capInset + 1);
    this.drawRoadShape(roadShape, world.x, world.y, neighbors, style.base, style.innerWidth, style.capInset);
    this.drawRoadShape(maskShape, world.x, world.y, neighbors, 0xffffff, style.innerWidth + 1, style.capInset);
    maskShape.setVisible(false);

    const textureFrame = this.getRoadTextureOverlayFrame(neighbors);
    const children: Phaser.GameObjects.GameObject[] = [background, roadShape];
    if (textureFrame !== null) {
      const texture = this.add.image(centerX, centerY, textureKey, textureFrame).setOrigin(0.5);
      texture.setDisplaySize(this.tileSize + 4, this.tileSize + 4);
      texture.setAlpha(0.55);
      texture.setMask(maskShape.createGeometryMask());
      children.push(texture);
    }
    children.push(maskShape);

    const container = this.add.container(0, 0, children);
    container.setDepth(0.35);
    this.roadSprites.set(roadKey, container);
  }

  private renderFoliageObject(foliage: PlacedFoliage): void {
    const definition = this.foliageDefinitions.get(foliage.foliageId);
    if (!definition) {
      return;
    }

    const key = this.toGridKey(foliage.x, foliage.y);
    this.foliageSprites.get(key)?.destroy();
    const world = gridToWorld(foliage.x, foliage.y, this.tileSize);
    const sprite = this.add
      .image(world.x + this.tileSize * 0.5, world.y + this.tileSize, definition.textureKey)
      .setOrigin(0.5, 1);
    sprite.setDepth(0.75);
    this.foliageSprites.set(key, sprite);
  }

  private removeFoliageObject(key: string): void {
    this.foliageObjects.delete(key);
    this.foliageSprites.get(key)?.destroy();
    this.foliageSprites.delete(key);
  }

  private removeRoadTile(key: string): void {
    const road = this.roads.get(key);
    this.roads.delete(key);
    this.roadSprites.get(key)?.destroy();
    this.roadSprites.delete(key);
    if (road) {
      this.refreshAdjacentRoads(road.x, road.y);
    }
  }

  private clearRoadLayer(): void {
    for (const sprite of this.roadSprites.values()) {
      sprite.destroy();
    }
    this.roadSprites.clear();
    this.roads.clear();
  }

  private clearFoliageLayer(): void {
    for (const sprite of this.foliageSprites.values()) {
      sprite.destroy();
    }
    this.foliageSprites.clear();
    this.foliageObjects.clear();
  }

  private emitDevPaintState(): void {
    this.game.events.emit(
      EVENT_KEYS.devPaintStateChanged,
      this.devPaintEnabled,
      this.selectedFoliageId,
      this.selectedRoadId,
    );
  }

  private toGridKey(x: number, y: number): string {
    return `${x}:${y}`;
  }

  private isRoadPaintModeActive(): boolean {
    return this.devPaintEnabled && this.selectedRoadId !== null;
  }

  private refreshRoadAt(x: number, y: number): void {
    const road = this.roads.get(this.toGridKey(x, y));
    if (road) {
      this.renderRoadTile(road);
    }
    this.refreshAdjacentRoads(x, y);
  }

  private refreshAdjacentRoads(x: number, y: number): void {
    for (const [dx, dy] of [
      [0, -1],
      [0, 1],
      [-1, 0],
      [1, 0],
    ]) {
      const neighbor = this.roads.get(this.toGridKey(x + dx, y + dy));
      if (neighbor) {
        this.renderRoadTile(neighbor);
      }
    }
  }

  private getRoadNeighbors(x: number, y: number, roadId: string): Record<'up' | 'down' | 'left' | 'right', boolean> {
    return {
      up: this.roads.get(this.toGridKey(x, y - 1))?.roadId === roadId,
      down: this.roads.get(this.toGridKey(x, y + 1))?.roadId === roadId,
      left: this.roads.get(this.toGridKey(x - 1, y))?.roadId === roadId,
      right: this.roads.get(this.toGridKey(x + 1, y))?.roadId === roadId,
    };
  }

  private getConstrainedRoadCell(gridPos: { x: number; y: number }): { x: number; y: number } {
    if (!this.roadStrokeAnchor) {
      this.roadStrokeAnchor = { ...gridPos };
      return gridPos;
    }
    if (!this.roadStrokeAxis) {
      const dx = Math.abs(gridPos.x - this.roadStrokeAnchor.x);
      const dy = Math.abs(gridPos.y - this.roadStrokeAnchor.y);
      if (dx > 0 || dy > 0) {
        this.roadStrokeAxis = dx >= dy ? 'x' : 'y';
      }
    }
    if (this.roadStrokeAxis === 'x') {
      return { x: gridPos.x, y: this.roadStrokeAnchor.y };
    }
    if (this.roadStrokeAxis === 'y') {
      return { x: this.roadStrokeAnchor.x, y: gridPos.y };
    }
    return gridPos;
  }

  private paintRoadSegment(x: number, y: number, roadId: PlacedRoad['roadId']): void {
    const put = (tileX: number, tileY: number): void => {
      if (tileX < 0 || tileY < 0 || tileX >= this.mapWidth || tileY >= this.mapHeight) {
        return;
      }
      const tileKey = this.toGridKey(tileX, tileY);
      const road: PlacedRoad = {
        id: `${roadId}_${tileX}_${tileY}`,
        roadId,
        x: tileX,
        y: tileY,
      };
      this.roads.set(tileKey, road);
      this.refreshRoadAt(tileX, tileY);
    };

    if (!this.roadLastPaintCell) {
      put(x, y);
      this.roadLastPaintCell = { x, y };
      return;
    }

    const from = this.roadLastPaintCell;
    const dx = x - from.x;
    const dy = y - from.y;
    if (dx !== 0 && dy !== 0) {
      // Should not happen with axis lock; keep safe fallback.
      put(x, y);
      this.roadLastPaintCell = { x, y };
      return;
    }

    const stepX = dx === 0 ? 0 : dx > 0 ? 1 : -1;
    const stepY = dy === 0 ? 0 : dy > 0 ? 1 : -1;
    let cx = from.x;
    let cy = from.y;
    while (cx !== x || cy !== y) {
      cx += stepX;
      cy += stepY;
      put(cx, cy);
    }
    this.roadLastPaintCell = { x, y };
  }

  private getRoadTextureKey(roadId: string): string | null {
    switch (roadId) {
      case 'dirt_path':
        return 'road_dirt_tiles_runtime';
      case 'stone_path':
        return 'road_stone_tiles_runtime';
      case 'cobble_path':
        return 'road_cobble_tiles_runtime';
      default:
        return null;
    }
  }

  private getRoadTextureOverlayFrame(
    neighbors: Record<'up' | 'down' | 'left' | 'right', boolean>,
  ): number | null {
    const U = neighbors.up ? 1 : 0;
    const R = neighbors.right ? 1 : 0;
    const D = neighbors.down ? 1 : 0;
    const L = neighbors.left ? 1 : 0;
    const mask = U | (R << 1) | (D << 2) | (L << 3);

    switch (mask) {
      case 0:
        return 0;
      case 1:
      case 4:
        return 2;
      case 2:
      case 8:
        return 1;
      case 5:
        return 2;
      case 10:
        return 1;
      case 3:
      case 6:
      case 12:
      case 9:
      case 7:
      case 14:
      case 13:
      case 11:
      case 15:
        return 12;
      default:
        return 12;
    }
  }

  private drawRoadShape(
    graphics: Phaser.GameObjects.Graphics,
    worldX: number,
    worldY: number,
    neighbors: Record<'up' | 'down' | 'left' | 'right', boolean>,
    color: number,
    width: number,
    capInset: number,
  ): void {
    const centerX = worldX + this.tileSize * 0.5;
    const centerY = worldY + this.tileSize * 0.5;
    const halfWidth = width * 0.5;
    const left = centerX - halfWidth;
    const top = centerY - halfWidth;
    const extendLeft = neighbors.left ? worldX - 1 : worldX + capInset;
    const extendRight = neighbors.right ? worldX + this.tileSize + 1 : worldX + this.tileSize - capInset;
    const extendUp = neighbors.up ? worldY - 1 : worldY + capInset;
    const extendDown = neighbors.down ? worldY + this.tileSize + 1 : worldY + this.tileSize - capInset;

    graphics.fillStyle(color, 1);
    graphics.fillRoundedRect(left, top, width, width, Math.max(2, width * 0.28));

    if (neighbors.up) {
      graphics.fillRect(left, extendUp, width, centerY - extendUp);
    }
    if (neighbors.down) {
      graphics.fillRect(left, centerY, width, extendDown - centerY);
    }
    if (neighbors.left) {
      graphics.fillRect(extendLeft, top, centerX - extendLeft, width);
    }
    if (neighbors.right) {
      graphics.fillRect(centerX, top, extendRight - centerX, width);
    }

    if (!neighbors.up && !neighbors.down && !neighbors.left && !neighbors.right) {
      graphics.fillCircle(centerX, centerY, halfWidth + 1);
    }
  }

  private getRoadBaseStyle(
    roadId: string,
  ): { base: number; edge: number; shadow: number; innerWidth: number; capInset: number } {
    switch (roadId) {
      case 'dirt_path':
        return { base: 0x8e6a43, edge: 0x6d4d2f, shadow: 0x2f2418, innerWidth: 10, capInset: 3 };
      case 'stone_path':
        return { base: 0x8f8d87, edge: 0x6b6a66, shadow: 0x2f2418, innerWidth: 10, capInset: 3 };
      case 'cobble_path':
        return { base: 0x9f9987, edge: 0x756f62, shadow: 0x2f2418, innerWidth: 10, capInset: 3 };
      default:
        return { base: 0x8f8d87, edge: 0x6b6a66, shadow: 0x2f2418, innerWidth: 10, capInset: 3 };
    }
  }

  private getStarterBuildings(): PlacedBuilding[] {
    return [
      {
        id: 'storage_001',
        type: 'storage_level_1',
        x: Math.floor(this.mapWidth * 0.5) - 1,
        y: Math.floor(this.mapHeight * 0.5) - 1,
      },
    ];
  }

  private advanceDay(): void {
    this.day += 1;
    const result = this.economySystem.processDay(
      this.day,
      this.resourceSystem.getResources(),
      this.buildingSystem.getBuildings(),
      { ...this.village },
    );
    this.resourceSystem.setResources(result.resources);
    this.village = result.village;
    this.refreshBuildingAvailability();
    this.emitFullState();
    this.persistState();
    this.emitDayReport(result.report);
  }

  private emitDayReport(report: DayReport): void {
    const foodDelta = (report.produced.food ?? 0) - (report.consumed.food ?? 0);
    const toolsDelta = (report.produced.tools ?? 0) - (report.consumed.tools ?? 0);
    const weaponsDelta = (report.produced.weapons ?? 0) - (report.consumed.weapons ?? 0);
    const parts = [`Day ${report.day}`];
    if (foodDelta !== 0) {
      parts.push(`Food ${foodDelta > 0 ? '+' : ''}${foodDelta}`);
    }
    if (toolsDelta !== 0) {
      parts.push(`Tools ${toolsDelta > 0 ? '+' : ''}${toolsDelta}`);
    }
    if (weaponsDelta !== 0) {
      parts.push(`Weapons ${weaponsDelta > 0 ? '+' : ''}${weaponsDelta}`);
    }
    if (report.notes.length > 0) {
      parts.push(report.notes[0]);
    }
    this.emitToast(parts.join(' | '));
  }

  private refreshBuildingAvailability(): void {
    this.buildingAvailability = this.progressionSystem.getAvailabilityMap(
      this.day,
      this.resourceSystem.getResources(),
      this.village,
      this.buildingSystem.getBuildings(),
    );
    if (this.selectedBuilding && !this.buildingAvailability[this.selectedBuilding]?.unlocked) {
      this.selectedBuilding = null;
      if (this.preview) {
        this.preview.clear();
      }
    }
  }
}
