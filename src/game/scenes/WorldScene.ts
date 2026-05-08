import Phaser from 'phaser';
import { DevPaintStateController } from '../controllers/DevPaintStateController';
import { WorldPersistenceController } from '../controllers/WorldPersistenceController';
import { DEV_FOLIAGE_ITEMS } from '../data/devFoliage';
import { createBuildingView, getBuildingViewMeta, playDemolishTween } from '../entities/Building';
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
  BuildingDetailsPayload,
  BuildingRuntimeStatus,
  BuildingType,
  CameraState,
  DayReport,
  PlacedBuilding,
  RoadType,
  ResourceType,
  Resources,
  VillageState,
} from '../types/game';
import { computeDayNightTint } from '../utils/dayNight';
import { worldToGrid } from '../utils/grid';
import { resetIdCounters, setBuildingCounter } from '../utils/ids';

const EARLY_HINTS = new Map<number, string>([
  [2, 'Tip: Build a Lumber Mill for wood production. Idle villagers gather basic resources.'],
  [4, 'Tip: You need stone to expand. Keep some villagers idle or build a Mason Yard.'],
  [6, 'Tip: Build a Workshop to craft tools. Tools boost all production.'],
  [8, 'Tip: Build houses and raise morale above 75 to attract new villagers.'],
]);

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
  workersAssigned: number;
  workerSlots: number;
  buildingDetails: BuildingDetailsPayload | null;
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
  private dayNightOverlay!: Phaser.GameObjects.Rectangle;
  private hoveredBuildingId: string | null = null;
  private inspectedBuildingId: string | null = null;
  private buildingDetailsElapsedMs = 0;
  private groundImage!: Phaser.GameObjects.Image;

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
    this.createDayNightOverlay();
    this.preview = this.add.graphics();
    this.tweens.add({
      targets: this.preview,
      alpha: { from: 0.78, to: 1.0 },
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
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
          this.spawnPlacementRing(buildingId);
        },
        onBuildingRemoved: (buildingId) => {
          const view = this.buildingViews.get(buildingId);
          this.buildingViews.delete(buildingId);
          if (this.hoveredBuildingId === buildingId) {
            this.hoveredBuildingId = null;
          }
          if (this.inspectedBuildingId === buildingId) {
            this.clearBuildingDetails();
          }
          if (view) {
            this.tweens.killTweensOf(view);
            playDemolishTween(this, view, () => view.destroy());
          }
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
      this.updateBuildingHover(pointer);
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

    this.updateDayNightOverlay();
    if (this.inspectedBuildingId) {
      this.buildingDetailsElapsedMs += delta;
      if (this.buildingDetailsElapsedMs >= 220) {
        this.buildingDetailsElapsedMs = 0;
        this.emitBuildingDetails();
      }
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
    const workerInfo = this.computeWorkerInfo();
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
      workersAssigned: workerInfo.assigned,
      workerSlots: workerInfo.totalSlots,
      buildingDetails: this.getBuildingDetailsPayload(this.inspectedBuildingId),
    };
  }

  private computeWorkerInfo(): { assigned: number; totalSlots: number } {
    const workerCounts = this.villagerSystem?.getWorkerCounts() ?? new Map<string, number>();
    let totalSlots = 0;
    let assigned = 0;
    for (const building of this.buildingSystem.getBuildings()) {
      const slots = BUILDING_DEFINITIONS[building.type].production?.workerSlots ?? 0;
      if (slots <= 0) continue;
      totalSlots += slots;
      assigned += Math.min(workerCounts.get(building.id) ?? 0, slots);
    }
    return { assigned, totalSlots };
  }

  private drawGround(): void {
    if (this.groundImage) {
      this.groundImage.destroy();
    }
    this.groundImage = this.add.image(0, 0, 'terrain_ground_full').setOrigin(0).setDepth(-1);
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
    this.game.events.on(EVENT_KEYS.requestCloseBuildingDetails, this.handleCloseBuildingDetails, this);

    this.events.once('shutdown', () => {
      this.game.events.off(EVENT_KEYS.requestSelectBuilding, this.handleSelectBuilding, this);
      this.game.events.off(EVENT_KEYS.requestSetBulldozeMode, this.handleSetBulldozeMode, this);
      this.game.events.off(EVENT_KEYS.requestResetSave, this.handleResetSave, this);
      this.game.events.off(EVENT_KEYS.requestSetDevPaintEnabled, this.handleSetDevPaintEnabled, this);
      this.game.events.off(EVENT_KEYS.requestSelectDevFoliage, this.handleSelectDevFoliage, this);
      this.game.events.off(EVENT_KEYS.requestSelectDevRoad, this.handleSelectDevRoad, this);
      this.game.events.off(EVENT_KEYS.requestEraseDevPaintTile, this.handleEraseDevPaintTile, this);
      this.game.events.off(EVENT_KEYS.requestCloseBuildingDetails, this.handleCloseBuildingDetails, this);
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
    this.clearBuildingDetails();
    this.emitDevPaintState();
    this.game.events.emit(EVENT_KEYS.buildingSelectionChanged, this.selectedBuilding, this.bulldozeMode);
  }

  private handleSetBulldozeMode(enabled: boolean): void {
    this.devPaintState.disable();
    this.selectedBuilding = null;
    this.bulldozeMode = enabled;
    this.preview.clear();
    this.clearBuildingDetails();
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
    this.clearBuildingDetails();
    this.emitDevPaintState();
    this.game.events.emit(EVENT_KEYS.buildingSelectionChanged, this.selectedBuilding, this.bulldozeMode);
  }

  private handleSelectDevFoliage(foliageId: string): void {
    this.devPaintState.selectFoliage(foliageId);
    this.selectedBuilding = null;
    this.bulldozeMode = false;
    this.preview.clear();
    this.clearBuildingDetails();
    this.emitDevPaintState();
    this.game.events.emit(EVENT_KEYS.buildingSelectionChanged, this.selectedBuilding, this.bulldozeMode);
  }

  private handleSelectDevRoad(roadId: string): void {
    this.devPaintState.selectRoad(roadId);
    this.selectedBuilding = null;
    this.bulldozeMode = false;
    this.preview.clear();
    this.clearBuildingDetails();
    this.emitDevPaintState();
    this.game.events.emit(EVENT_KEYS.buildingSelectionChanged, this.selectedBuilding, this.bulldozeMode);
  }

  private handleEraseDevPaintTile(): void {
    this.devPaintState.selectErase();
    this.selectedBuilding = null;
    this.bulldozeMode = false;
    this.preview.clear();
    this.clearBuildingDetails();
    this.emitDevPaintState();
    this.game.events.emit(EVENT_KEYS.buildingSelectionChanged, this.selectedBuilding, this.bulldozeMode);
  }

  private handleCloseBuildingDetails(): void {
    this.clearBuildingDetails();
  }

  private clearSelection(): void {
    this.selectedBuilding = null;
    this.bulldozeMode = false;
    this.preview.clear();
    this.clearBuildingDetails();
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
    if (!this.selectedBuilding && !this.bulldozeMode) {
      this.inspectBuildingAtPointer(pointer);
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
    const workerInfo = this.computeWorkerInfo();
    this.game.events.emit(EVENT_KEYS.workerInfoChanged, workerInfo.assigned, workerInfo.totalSlots);
    this.emitBuildingDetails();
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
    this.hoveredBuildingId = null;
    this.clearBuildingDetails();

    this.drawGround();

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
    const cx = Math.floor(this.mapWidth * 0.5);
    const cy = Math.floor(this.mapHeight * 0.5);
    return [
      {
        id: 'storage_001',
        type: 'storage_level_1',
        x: cx - 1,
        y: cy - 1,
      },
      {
        id: 'farmhouse_001',
        type: 'farmhouse',
        x: cx + 2,
        y: cy - 1,
      },
    ];
  }

  private advanceDay(): void {
    this.day += 1;
    const workerCounts = this.villagerSystem?.getWorkerCounts() ?? new Map<string, number>();
    const result = this.economySystem.processDay(
      this.day,
      this.resourceSystem.getResources(),
      this.buildingSystem.getBuildings(),
      { ...this.village },
      workerCounts,
    );
    this.resourceSystem.setResources(result.resources);
    this.village = result.village;
    this.refreshBuildingAvailability();
    this.villagerSystem?.syncPopulation(this.village.population);
    this.emitFullState();
    this.persistState();
    this.emitDayReport(result.report);
    this.showEarlyGameHint();
  }

  private showEarlyGameHint(): void {
    const hint = EARLY_HINTS.get(this.day);
    if (hint) {
      this.emitToast(hint);
    }
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

  private updateBuildingHover(pointer: Phaser.Input.Pointer): void {
    const isInteractingMode =
      this.selectedBuilding !== null ||
      this.bulldozeMode ||
      this.devPaintState.getSnapshot().enabled;
    let hoveredId: string | null = null;
    if (!isInteractingMode) {
      const grid = worldToGrid(pointer.worldX, pointer.worldY, this.tileSize);
      const placed = this.buildingSystem.getBuildingAt(grid.x, grid.y);
      hoveredId = placed?.id ?? null;
    }
    if (hoveredId === this.hoveredBuildingId) {
      return;
    }
    if (this.hoveredBuildingId) {
      const prev = this.buildingViews.get(this.hoveredBuildingId);
      if (prev) {
        this.tweens.killTweensOf(prev);
        this.tweens.add({
          targets: prev,
          scale: 1,
          duration: 140,
          ease: 'Quad.easeOut',
        });
      }
    }
    this.hoveredBuildingId = hoveredId;
    if (hoveredId) {
      const next = this.buildingViews.get(hoveredId);
      if (next) {
        this.tweens.killTweensOf(next);
        this.tweens.add({
          targets: next,
          scale: 1.045,
          duration: 160,
          ease: 'Quad.easeOut',
        });
      }
    }
  }

  private spawnPlacementRing(buildingId: string): void {
    const view = this.buildingViews.get(buildingId);
    if (!view) {
      return;
    }
    const placed = this.buildingSystem.getBuildings().find((b) => b.id === buildingId);
    if (!placed) {
      return;
    }
    const definition = BUILDING_DEFINITIONS[placed.type];
    const cx = view.x + (definition.size.w * this.tileSize) * 0.5;
    const cy = view.y + (definition.size.h * this.tileSize) * 0.5;
    const ring = this.add.circle(cx, cy, definition.size.w * this.tileSize * 0.35, 0xffe8b0, 0);
    ring.setStrokeStyle(2, 0xffe8b0, 0.85);
    ring.setDepth(1.2);
    this.tweens.add({
      targets: ring,
      scale: 2.4,
      alpha: 0,
      duration: 520,
      ease: 'Quad.easeOut',
      onComplete: () => ring.destroy(),
    });
  }

  private createDayNightOverlay(): void {
    const worldPixelsWidth = this.mapWidth * this.tileSize;
    const worldPixelsHeight = this.mapHeight * this.tileSize;
    this.dayNightOverlay = this.add
      .rectangle(0, 0, worldPixelsWidth, worldPixelsHeight, 0x000018, 0)
      .setOrigin(0)
      .setDepth(900)
      .setBlendMode(Phaser.BlendModes.MULTIPLY);
  }

  private updateDayNightOverlay(): void {
    if (!this.dayNightOverlay) {
      return;
    }
    const t = (this.dayElapsedMs % DAY_DURATION_MS) / DAY_DURATION_MS;
    const tint = computeDayNightTint(t);
    this.dayNightOverlay.fillColor = tint.color;
    this.dayNightOverlay.fillAlpha = tint.alpha;

    const lightAlpha = Math.min(0.9, tint.alpha * 1.7);
    for (const view of this.buildingViews.values()) {
      const meta = getBuildingViewMeta(view);
      if (meta?.light) {
        meta.light.setFillStyle(meta.light.fillColor, lightAlpha);
      }
    }
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

  private inspectBuildingAtPointer(pointer: Phaser.Input.Pointer): void {
    if (pointer.getDistance() > 10) {
      return;
    }
    const grid = worldToGrid(pointer.worldX, pointer.worldY, this.tileSize);
    const placed = this.buildingSystem.getBuildingAt(grid.x, grid.y);
    if (!placed) {
      this.clearBuildingDetails();
      return;
    }
    this.inspectedBuildingId = placed.id;
    this.emitBuildingDetails();
  }

  private clearBuildingDetails(): void {
    if (this.inspectedBuildingId === null) {
      return;
    }
    this.inspectedBuildingId = null;
    this.buildingDetailsElapsedMs = 0;
    this.game.events.emit(EVENT_KEYS.buildingDetailsChanged, null);
  }

  private emitBuildingDetails(): void {
    this.game.events.emit(
      EVENT_KEYS.buildingDetailsChanged,
      this.getBuildingDetailsPayload(this.inspectedBuildingId),
    );
  }

  private getBuildingDetailsPayload(buildingId: string | null): BuildingDetailsPayload | null {
    if (!buildingId) {
      return null;
    }
    const placed = this.buildingSystem.getBuildings().find((entry) => entry.id === buildingId);
    if (!placed) {
      return null;
    }
    const definition = BUILDING_DEFINITIONS[placed.type];
    const production = definition.production;
    const workerSlots = production?.workerSlots ?? 0;
    const workersAssigned = this.villagerSystem?.getWorkerCounts().get(placed.id) ?? 0;
    const effectiveWorkers = workerSlots > 0 ? Math.min(workersAssigned, workerSlots) : 0;
    const resources = this.resourceSystem.getResources();

    const consumes = Object.entries(production?.consumes ?? {}).map(([resource, amount]) => ({
      resource: resource as ResourceType,
      amount,
      available: resources[resource as ResourceType],
    }));
    const produces = Object.entries(production?.produces ?? {}).map(([resource, amount]) => ({
      resource: resource as ResourceType,
      amount,
    }));
    const moraleBonus = production?.moraleBonus ?? 0;

    const hasInputs = consumes.length > 0;
    const missingInputs = consumes.some((line) => (line.available ?? 0) < line.amount);

    let status: BuildingRuntimeStatus = 'closed';
    let statusLabel = 'Closed';
    if (workerSlots > 0) {
      if (effectiveWorkers <= 0) {
        status = 'closed';
        statusLabel = 'Closed (no workers)';
      } else if (hasInputs && missingInputs) {
        status = 'blocked';
        statusLabel = 'Blocked (missing resources)';
      } else {
        status = 'open';
        statusLabel = 'Open';
      }
    } else if (produces.length > 0 || consumes.length > 0 || moraleBonus !== 0) {
      status = hasInputs && missingInputs ? 'blocked' : 'open';
      statusLabel = status === 'open' ? 'Open (passive)' : 'Blocked';
    }

    const match = definition.type.match(/_level_(\d+)$/);
    const level = match ? Number(match[1]) : 1;
    const efficiency =
      workerSlots > 0 ? Math.round((Math.min(effectiveWorkers / workerSlots, 1) * 100)) : 100;

    return {
      id: placed.id,
      type: placed.type,
      name: definition.name,
      level,
      purpose: definition.purpose,
      status,
      statusLabel,
      workersAssigned: effectiveWorkers,
      workerSlots,
      efficiency,
      size: definition.size,
      position: { x: placed.x, y: placed.y },
      produces,
      consumes,
      moraleBonus,
    };
  }
}
