import Phaser from 'phaser';
import { DevPaintStateController } from '../controllers/DevPaintStateController';
import { WorldPersistenceController } from '../controllers/WorldPersistenceController';
import { DEV_FOLIAGE_ITEMS } from '../data/devFoliage';
import { createBuildingView } from '../entities/Building';
import { CAMERA, DAY_DURATION_MS, EVENT_KEYS } from '../constants';
import { BUILDING_DEFINITIONS } from '../data/buildings';
import { MAP_CONFIG } from '../data/map';
import { INITIAL_RESOURCES, INITIAL_VILLAGE } from '../data/resources';
import { BuildingSystem } from '../systems/BuildingSystem';
import { CameraSystem } from '../systems/CameraSystem';
import { EconomySystem } from '../systems/EconomySystem';
import { FoliagePaintSystem } from '../systems/FoliagePaintSystem';
import { InputSystem } from '../systems/InputSystem';
import { PlacementPreviewSystem } from '../systems/PlacementPreviewSystem';
import { PlacementSystem } from '../systems/PlacementSystem';
import { ProgressionSystem } from '../systems/ProgressionSystem';
import { ResourceSystem } from '../systems/ResourceSystem';
import { RoadPaintSystem } from '../systems/RoadPaintSystem';
import { VillagerSystem } from '../systems/VillagerSystem';
import type {
  BuildingAvailability,
  BuildingType,
  CameraState,
  DayReport,
  PlacedBuilding,
  RoadType,
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

  private readonly persistence = new WorldPersistenceController();
  private readonly devPaintState = new DevPaintStateController();
  private readonly buildingSystem = new BuildingSystem();
  private readonly economySystem = new EconomySystem();
  private readonly progressionSystem = new ProgressionSystem();

  private resourceSystem!: ResourceSystem;
  private village!: VillageState;
  private buildingAvailability!: Record<BuildingType, BuildingAvailability>;
  private cameraSystem!: CameraSystem;
  private inputSystem!: InputSystem;
  private villagerSystem!: VillagerSystem;
  private roadPaintSystem!: RoadPaintSystem;
  private foliagePaintSystem!: FoliagePaintSystem;
  private placementPreviewSystem!: PlacementPreviewSystem;
  private placementSystem!: PlacementSystem;
  private preview!: Phaser.GameObjects.Graphics;

  private selectedBuilding: BuildingType | null = null;
  private bulldozeMode = false;
  private day = 1;
  private autosaveElapsedMs = 0;
  private dayElapsedMs = 0;
  private isPointerDown = false;
  private roadStrokeAnchor: { x: number; y: number } | null = null;
  private roadStrokeAxis: 'x' | 'y' | null = null;

  private readonly buildingViews = new Map<string, Phaser.GameObjects.Container>();
  private readonly gridBounds = { width: MAP_CONFIG.mapWidth, height: MAP_CONFIG.mapHeight };

  constructor() {
    super('WorldScene');
  }

  public create(): void {
    const starterBuildings = this.getStarterBuildings();
    const initialState = this.persistence.loadInitialState(starterBuildings);

    this.resourceSystem = new ResourceSystem(initialState.resources);
    this.village = { ...initialState.village };

    this.buildingSystem.load(initialState.buildings);
    this.village = this.economySystem.syncVillage(this.buildingSystem.getBuildings(), this.village);
    setBuildingCounter(this.buildingSystem.getBuildings().length);
    this.day = initialState.day;
    this.refreshBuildingAvailability();
    this.devPaintState.setEnabled(
      Boolean(this.registry.get('devPaintAutostart')),
      DEV_FOLIAGE_ITEMS[0]?.id ?? null,
    );
    this.registry.set('devPaintAutostart', false);

    this.roadPaintSystem = new RoadPaintSystem(this, this.tileSize, this.mapWidth, this.mapHeight);
    this.roadPaintSystem.load(initialState.roads);
    this.foliagePaintSystem = new FoliagePaintSystem(this, this.tileSize, DEV_FOLIAGE_ITEMS);
    this.foliagePaintSystem.load(initialState.foliageObjects);

    this.drawGround();
    this.drawNatureDecor();
    this.drawGrid();
    this.roadPaintSystem.renderLayer();
    this.foliagePaintSystem.renderLayer();
    this.preview = this.add.graphics();
    this.placementPreviewSystem = new PlacementPreviewSystem(
      this.preview,
      this.buildingSystem,
      this.resourceSystem,
      this.gridBounds,
      (message) => this.emitToast(message),
    );
    this.renderAllBuildings();

    this.villagerSystem = new VillagerSystem({
      scene: this,
      tileSize: this.tileSize,
      mapWidth: this.mapWidth,
      mapHeight: this.mapHeight,
      isTileBlocked: (x, y) => this.buildingSystem.isTileOccupied(x, y),
      getBuildings: () => this.buildingSystem.getBuildings(),
    });
    this.villagerSystem.syncPopulation(this.village.population);
    this.placementSystem = new PlacementSystem(
      this,
      this.buildingSystem,
      this.resourceSystem,
      this.economySystem,
      this.villagerSystem,
      {
        updateVillage: (village) => {
          this.village = village;
        },
        refreshBuildingAvailability: () => this.refreshBuildingAvailability(),
        onBuildingPlaced: (buildingId, view) => {
          this.buildingViews.set(buildingId, view);
        },
        onBuildingRemoved: (buildingId) => {
          this.buildingViews.get(buildingId)?.destroy();
          this.buildingViews.delete(buildingId);
        },
        emitResourcesChanged: () => {
          this.game.events.emit(EVENT_KEYS.resourcesChanged, this.resourceSystem.getResources());
        },
        emitVillageChanged: () => {
          this.game.events.emit(EVENT_KEYS.villageChanged, this.village);
        },
        emitAvailabilityChanged: () => {
          this.game.events.emit(EVENT_KEYS.buildingAvailabilityChanged, this.buildingAvailability);
        },
        persistState: () => this.persistState(),
        updatePreview: (pointer) => this.updatePreview(pointer),
        emitToast: (message) => this.emitToast(message),
        clearSelection: () => this.clearSelection(),
      },
    );

    const worldPixelsWidth = this.mapWidth * this.tileSize;
    const worldPixelsHeight = this.mapHeight * this.tileSize;

    const mainCamera = this.cameras.main;
    mainCamera.setBounds(0, 0, worldPixelsWidth, worldPixelsHeight);

    this.cameraSystem = new CameraSystem(this, mainCamera, worldPixelsWidth, worldPixelsHeight);
    this.cameraSystem.setCanStartDragViewport(() => !this.isRoadPaintModeActive());
    this.cameraSystem.attach();

    const initialZoom = initialState.camera?.zoom ?? CAMERA.defaultZoom;
    mainCamera.setZoom(initialZoom);

    if (initialState.camera) {
      mainCamera.scrollX = initialState.camera.scrollX;
      mainCamera.scrollY = initialState.camera.scrollY;
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
        this.roadPaintSystem.beginStroke();
        this.paintAtPointer(pointer, true);
      }
    });
    this.input.on('pointerup', () => {
      this.isPointerDown = false;
      this.roadStrokeAnchor = null;
      this.roadStrokeAxis = null;
      this.roadPaintSystem.beginStroke();
    });

    this.bindUiEvents();
    this.emitFullState();
  }

  public update(_time: number, delta: number): void {
    this.cameraSystem.update(delta);
    this.villagerSystem?.update(delta);
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
      devPaintEnabled: this.devPaintState.getSnapshot().enabled,
      selectedFoliageId: this.devPaintState.getSnapshot().selectedFoliageId,
      selectedRoadId: this.devPaintState.getSnapshot().selectedRoadId,
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
    this.devPaintState.disable();
    this.bulldozeMode = false;
    this.selectedBuilding = type;
    this.preview.clear();
    this.emitDevPaintState();
    this.game.events.emit(EVENT_KEYS.buildingSelectionChanged, this.selectedBuilding, this.bulldozeMode);
  }

  private handleSetBulldozeMode(enabled: boolean): void {
    this.devPaintState.disable();
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
    this.devPaintState.setEnabled(enabled, DEV_FOLIAGE_ITEMS[0]?.id ?? null);
    this.bulldozeMode = false;
    this.selectedBuilding = enabled ? null : this.selectedBuilding;
    this.preview.clear();
    this.emitDevPaintState();
    this.game.events.emit(EVENT_KEYS.buildingSelectionChanged, this.selectedBuilding, this.bulldozeMode);
  }

  private handleSelectDevFoliage(foliageId: string): void {
    this.devPaintState.selectFoliage(foliageId);
    this.selectedBuilding = null;
    this.bulldozeMode = false;
    this.preview.clear();
    this.emitDevPaintState();
    this.game.events.emit(EVENT_KEYS.buildingSelectionChanged, this.selectedBuilding, this.bulldozeMode);
  }

  private handleSelectDevRoad(roadId: string): void {
    this.devPaintState.selectRoad(roadId);
    this.selectedBuilding = null;
    this.bulldozeMode = false;
    this.preview.clear();
    this.emitDevPaintState();
    this.game.events.emit(EVENT_KEYS.buildingSelectionChanged, this.selectedBuilding, this.bulldozeMode);
  }

  private handleEraseDevPaintTile(): void {
    this.devPaintState.selectErase();
    this.selectedBuilding = null;
    this.bulldozeMode = false;
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
    const devPaintSnapshot = this.devPaintState.getSnapshot();
    this.placementPreviewSystem.update(
      pointer,
      {
        devPaintEnabled: devPaintSnapshot.enabled,
        selectedRoadId: devPaintSnapshot.selectedRoadId,
        selectedFoliageId: devPaintSnapshot.selectedFoliageId,
        selectedBuilding: this.selectedBuilding,
        bulldozeMode: this.bulldozeMode,
        tileSize: this.tileSize,
      },
      {
        buildingAvailability: this.buildingAvailability,
        resources: this.resourceSystem.getResources(),
      },
      () => this.clearSelection(),
    );
  }

  private tryPlaceSelected(pointer: Phaser.Input.Pointer): void {
    if (this.devPaintState.getSnapshot().enabled) {
      this.paintAtPointer(pointer);
      return;
    }

    this.placementSystem.tryPlace(pointer, {
      selectedBuilding: this.selectedBuilding,
      bulldozeMode: this.bulldozeMode,
      tileSize: this.tileSize,
      gridBounds: this.gridBounds,
      buildingAvailability: this.buildingAvailability,
      village: this.village,
    });
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
    this.persistence.saveState({
      resources: this.resourceSystem.getResources(),
      village: this.village,
      buildings: this.buildingSystem.getBuildings(),
      roads: this.roadPaintSystem.serialize(),
      foliageObjects: this.foliagePaintSystem.serialize(),
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
    this.persistence.clearSave();
    resetIdCounters();
    const starterBuildings = this.getStarterBuildings();

    for (const view of this.buildingViews.values()) {
      view.destroy();
    }
    this.buildingViews.clear();

    this.buildingSystem.clear();
    this.buildingSystem.load(starterBuildings);
    this.roadPaintSystem.clear();
    this.foliagePaintSystem.clear();
    this.villagerSystem?.clear();
    this.resourceSystem.setResources(INITIAL_RESOURCES);
    this.village = this.economySystem.syncVillage(starterBuildings, { ...INITIAL_VILLAGE });
    this.day = 1;
    this.dayElapsedMs = 0;
    this.refreshBuildingAvailability();
    this.clearSelection();

    this.renderAllBuildings();
    this.villagerSystem?.syncPopulation(this.village.population);

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

    const devPaintSnapshot = this.devPaintState.getSnapshot();
    if (devPaintSnapshot.selectedRoadId !== null) {
      const constrained = this.getConstrainedRoadCell(gridPos);
      this.roadPaintSystem.paintSegment(
        constrained.x,
        constrained.y,
        devPaintSnapshot.selectedRoadId as RoadType,
      );
      this.persistState();
      return;
    }

    if (devPaintSnapshot.selectedFoliageId !== null) {
      const placed = this.foliagePaintSystem.place(
        devPaintSnapshot.selectedFoliageId,
        gridPos.x,
        gridPos.y,
      );
      if (!placed) {
        return;
      }
      this.persistState();
      return;
    }

    this.roadPaintSystem.removeAt(gridPos.x, gridPos.y);
    this.foliagePaintSystem.removeAt(gridPos.x, gridPos.y);
    this.persistState();
  }

  private emitDevPaintState(): void {
    const snapshot = this.devPaintState.getSnapshot();
    this.game.events.emit(
      EVENT_KEYS.devPaintStateChanged,
      snapshot.enabled,
      snapshot.selectedFoliageId,
      snapshot.selectedRoadId,
    );
  }

  private isRoadPaintModeActive(): boolean {
    return this.devPaintState.isRoadPaintModeActive();
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
    this.villagerSystem?.syncPopulation(this.village.population);
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
