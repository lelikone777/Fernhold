import type Phaser from 'phaser';
import { BUILDING_DEFINITIONS } from '../data/buildings';
import {
  getWorkPriority,
  HOUSE_BUILDING_TYPES,
  HOUSE_CAPACITY,
  VILLAGER_PALETTES,
  VILLAGER_SPEED_PIXELS_PER_SEC,
  VILLAGER_SPRITE_KEY_PREFIX,
  WORK_BUILDING_TYPES,
} from '../data/villagers';
import type { Villager } from '../entities/Villager';
import type {
  BuildingType,
  PlacedBuilding,
  VillagerDirection,
  VillagerState,
} from '../types/game';
import { gridToWorld } from '../utils/grid';
import { findPath } from '../utils/pathfinder';

const WORK_DURATION_MS = 8000;
const HOME_DURATION_MS = 4000;
const IDLE_REPLAN_MS = 1500;
const ARRIVAL_THRESHOLD_PX = 1.5;

interface VillagerSystemOptions {
  scene: Phaser.Scene;
  tileSize: number;
  mapWidth: number;
  mapHeight: number;
  isTileBlocked: (x: number, y: number) => boolean;
  getBuildings: () => PlacedBuilding[];
}

interface BuildingFootprint {
  building: PlacedBuilding;
  type: BuildingType;
  size: { w: number; h: number };
  entryTiles: { x: number; y: number }[];
}

export class VillagerSystem {
  private readonly scene: Phaser.Scene;
  private readonly tileSize: number;
  private readonly mapWidth: number;
  private readonly mapHeight: number;
  private readonly isTileBlocked: (x: number, y: number) => boolean;
  private readonly getBuildings: () => PlacedBuilding[];
  private readonly villagers = new Map<string, Villager>();
  private nextId = 1;
  private homeAssignments = new Map<string, number>();
  private workAssignments = new Map<string, number>();

  constructor(options: VillagerSystemOptions) {
    this.scene = options.scene;
    this.tileSize = options.tileSize;
    this.mapWidth = options.mapWidth;
    this.mapHeight = options.mapHeight;
    this.isTileBlocked = options.isTileBlocked;
    this.getBuildings = options.getBuildings;
  }

  public syncPopulation(targetPopulation: number): void {
    const currentCount = this.villagers.size;
    if (targetPopulation > currentCount) {
      for (let i = 0; i < targetPopulation - currentCount; i += 1) {
        this.spawnVillager();
      }
    } else if (targetPopulation < currentCount) {
      const keysToRemove = [...this.villagers.keys()].slice(targetPopulation);
      for (const key of keysToRemove) {
        this.removeVillager(key);
      }
    }
    this.reassignJobs();
  }

  public reassignJobs(): void {
    const buildings = this.getBuildings();
    const homes = buildings.filter((b) => HOUSE_BUILDING_TYPES.has(b.type));
    const works = buildings.filter((b) => WORK_BUILDING_TYPES.has(b.type));
    const homeMap = new Map(homes.map((b) => [b.id, b]));
    const workMap = new Map(works.map((b) => [b.id, b]));

    this.homeAssignments.clear();
    this.workAssignments.clear();

    for (const villager of this.villagers.values()) {
      if (villager.homeBuildingId && !homeMap.has(villager.homeBuildingId)) {
        villager.homeBuildingId = null;
      }
      if (villager.workBuildingId && !workMap.has(villager.workBuildingId)) {
        villager.workBuildingId = null;
      }
    }

    for (const villager of this.villagers.values()) {
      if (villager.homeBuildingId) {
        this.homeAssignments.set(
          villager.homeBuildingId,
          (this.homeAssignments.get(villager.homeBuildingId) ?? 0) + 1,
        );
      }
      if (villager.workBuildingId) {
        this.workAssignments.set(
          villager.workBuildingId,
          (this.workAssignments.get(villager.workBuildingId) ?? 0) + 1,
        );
      }
    }

    const sortedWorks = [...works].sort(
      (a, b) => getWorkPriority(a.type) - getWorkPriority(b.type),
    );

    for (const villager of this.villagers.values()) {
      if (!villager.homeBuildingId) {
        const home = this.findFreeHome(homes);
        if (home) {
          villager.homeBuildingId = home.id;
          this.homeAssignments.set(home.id, (this.homeAssignments.get(home.id) ?? 0) + 1);
        }
      }
      if (!villager.workBuildingId) {
        const work = this.findFreeWorkplace(sortedWorks);
        if (work) {
          villager.workBuildingId = work.id;
          this.workAssignments.set(work.id, (this.workAssignments.get(work.id) ?? 0) + 1);
        }
      }
    }
  }

  public getWorkerCounts(): ReadonlyMap<string, number> {
    return this.workAssignments;
  }

  public update(deltaMs: number): void {
    for (const villager of this.villagers.values()) {
      this.updateVillager(villager, deltaMs);
    }
  }

  public clear(): void {
    for (const villager of this.villagers.values()) {
      villager.sprite.destroy();
    }
    this.villagers.clear();
    this.homeAssignments.clear();
    this.workAssignments.clear();
    this.nextId = 1;
  }

  public getVillagerCount(): number {
    return this.villagers.size;
  }

  private spawnVillager(): void {
    const id = `villager_${String(this.nextId).padStart(3, '0')}`;
    this.nextId += 1;

    const paletteIndex = (this.nextId - 1) % VILLAGER_PALETTES.length;
    const paletteKey = `${VILLAGER_SPRITE_KEY_PREFIX}${paletteIndex}`;
    const spawnTile = this.findSpawnTile();
    const worldPos = this.tileCenter(spawnTile.x, spawnTile.y);

    const sprite = this.scene.add.sprite(worldPos.x, worldPos.y, paletteKey, 0);
    sprite.setOrigin(0.5, 0.95);
    sprite.setDepth(0.78);
    sprite.setScale(1);

    const idleAnimKey = `${paletteKey}_idle_down`;
    const walkAnimKey = `${paletteKey}_walk_down`;
    if (this.scene.anims.exists(idleAnimKey)) {
      sprite.play(idleAnimKey);
    }

    const villager: Villager = {
      id,
      paletteKey,
      homeBuildingId: null,
      workBuildingId: null,
      state: 'idle',
      direction: 'down',
      worldX: worldPos.x,
      worldY: worldPos.y,
      path: [],
      pathTargetIndex: 0,
      workTimerMs: 0,
      idleTimerMs: 0,
      sprite,
      walkAnimKey,
      idleAnimKey,
    };
    this.villagers.set(id, villager);
  }

  private removeVillager(id: string): void {
    const villager = this.villagers.get(id);
    if (!villager) {
      return;
    }
    villager.sprite.destroy();
    this.villagers.delete(id);
  }

  private updateVillager(villager: Villager, deltaMs: number): void {
    switch (villager.state) {
      case 'idle':
        this.updateIdle(villager, deltaMs);
        break;
      case 'walking':
      case 'going_to_work':
      case 'going_home':
        this.updateMoving(villager, deltaMs);
        break;
      case 'working':
        this.updateWorking(villager, deltaMs);
        break;
    }
  }

  private updateIdle(villager: Villager, deltaMs: number): void {
    villager.idleTimerMs += deltaMs;
    if (villager.idleTimerMs < IDLE_REPLAN_MS) {
      return;
    }
    villager.idleTimerMs = 0;

    if (villager.workBuildingId) {
      this.startGoingTo(villager, villager.workBuildingId, 'going_to_work');
      return;
    }

    this.startWander(villager);
  }

  private updateWorking(villager: Villager, deltaMs: number): void {
    villager.workTimerMs += deltaMs;
    if (villager.workTimerMs < WORK_DURATION_MS) {
      return;
    }
    villager.workTimerMs = 0;
    if (villager.homeBuildingId) {
      this.startGoingTo(villager, villager.homeBuildingId, 'going_home');
    } else {
      this.startWander(villager);
    }
  }

  private updateMoving(villager: Villager, deltaMs: number): void {
    if (villager.path.length === 0 || villager.pathTargetIndex >= villager.path.length) {
      this.handleArrival(villager);
      return;
    }

    const target = villager.path[villager.pathTargetIndex];
    const targetWorld = this.tileCenter(target.x, target.y);
    const dx = targetWorld.x - villager.worldX;
    const dy = targetWorld.y - villager.worldY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance <= ARRIVAL_THRESHOLD_PX) {
      villager.worldX = targetWorld.x;
      villager.worldY = targetWorld.y;
      villager.pathTargetIndex += 1;
      if (villager.pathTargetIndex >= villager.path.length) {
        this.handleArrival(villager);
      }
      return;
    }

    const step = (VILLAGER_SPEED_PIXELS_PER_SEC * deltaMs) / 1000;
    const moveDistance = Math.min(step, distance);
    const moveX = (dx / distance) * moveDistance;
    const moveY = (dy / distance) * moveDistance;
    villager.worldX += moveX;
    villager.worldY += moveY;

    const newDirection = this.directionFromDelta(dx, dy);
    if (newDirection !== villager.direction) {
      villager.direction = newDirection;
      villager.walkAnimKey = `${villager.paletteKey}_walk_${newDirection}`;
      villager.idleAnimKey = `${villager.paletteKey}_idle_${newDirection}`;
      if (this.scene.anims.exists(villager.walkAnimKey)) {
        villager.sprite.play(villager.walkAnimKey, true);
      }
    } else if (!villager.sprite.anims.isPlaying || villager.sprite.anims.currentAnim?.key !== villager.walkAnimKey) {
      if (this.scene.anims.exists(villager.walkAnimKey)) {
        villager.sprite.play(villager.walkAnimKey, true);
      }
    }

    villager.sprite.setPosition(villager.worldX, villager.worldY);
    villager.sprite.setDepth(0.78 + villager.worldY * 0.0001);
  }

  private handleArrival(villager: Villager): void {
    villager.path = [];
    villager.pathTargetIndex = 0;
    if (this.scene.anims.exists(villager.idleAnimKey)) {
      villager.sprite.play(villager.idleAnimKey, true);
    }

    if (villager.state === 'going_to_work') {
      villager.state = 'working';
      villager.workTimerMs = 0;
      return;
    }
    if (villager.state === 'going_home') {
      villager.state = 'idle';
      villager.idleTimerMs = -HOME_DURATION_MS;
      return;
    }
    villager.state = 'idle';
    villager.idleTimerMs = 0;
  }

  private startGoingTo(villager: Villager, buildingId: string, state: VillagerState): void {
    const footprint = this.getFootprint(buildingId);
    if (!footprint) {
      villager.state = 'idle';
      return;
    }
    const startTile = this.worldToTile(villager.worldX, villager.worldY);
    const targetTile = this.findReachableEntry(startTile, footprint);
    if (!targetTile) {
      villager.state = 'idle';
      villager.idleTimerMs = 0;
      return;
    }
    const path = findPath(startTile, targetTile, {
      width: this.mapWidth,
      height: this.mapHeight,
      isBlocked: (x, y) => {
        if (x === targetTile.x && y === targetTile.y) {
          return false;
        }
        return this.isTileBlocked(x, y);
      },
    });
    if (!path || path.length === 0) {
      villager.state = 'idle';
      villager.idleTimerMs = 0;
      return;
    }
    villager.path = path;
    villager.pathTargetIndex = 0;
    villager.state = state;
  }

  private startWander(villager: Villager): void {
    const startTile = this.worldToTile(villager.worldX, villager.worldY);
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const radius = 6;
      const dx = Math.floor((Math.random() - 0.5) * radius * 2);
      const dy = Math.floor((Math.random() - 0.5) * radius * 2);
      const tx = Math.max(0, Math.min(this.mapWidth - 1, startTile.x + dx));
      const ty = Math.max(0, Math.min(this.mapHeight - 1, startTile.y + dy));
      if (this.isTileBlocked(tx, ty)) {
        continue;
      }
      const path = findPath(startTile, { x: tx, y: ty }, {
        width: this.mapWidth,
        height: this.mapHeight,
        isBlocked: (x, y) => this.isTileBlocked(x, y),
      });
      if (path && path.length > 0) {
        villager.path = path;
        villager.pathTargetIndex = 0;
        villager.state = 'walking';
        return;
      }
    }
    villager.state = 'idle';
    villager.idleTimerMs = 0;
  }

  private getFootprint(buildingId: string): BuildingFootprint | null {
    const buildings = this.getBuildings();
    const building = buildings.find((b) => b.id === buildingId);
    if (!building) {
      return null;
    }
    const definition = BUILDING_DEFINITIONS[building.type];
    const entryTiles = this.computeEntryTiles(building, definition.size);
    return {
      building,
      type: building.type,
      size: definition.size,
      entryTiles,
    };
  }

  private computeEntryTiles(
    building: PlacedBuilding,
    size: { w: number; h: number },
  ): { x: number; y: number }[] {
    const tiles: { x: number; y: number }[] = [];
    const bottomY = building.y + size.h;
    const topY = building.y - 1;
    for (let dx = 0; dx < size.w; dx += 1) {
      tiles.push({ x: building.x + dx, y: bottomY });
      tiles.push({ x: building.x + dx, y: topY });
    }
    const leftX = building.x - 1;
    const rightX = building.x + size.w;
    for (let dy = 0; dy < size.h; dy += 1) {
      tiles.push({ x: leftX, y: building.y + dy });
      tiles.push({ x: rightX, y: building.y + dy });
    }
    return tiles;
  }

  private findReachableEntry(
    from: { x: number; y: number },
    footprint: BuildingFootprint,
  ): { x: number; y: number } | null {
    const candidates = footprint.entryTiles
      .filter((tile) => this.isInBounds(tile.x, tile.y))
      .filter((tile) => !this.isTileBlocked(tile.x, tile.y))
      .sort((a, b) => {
        const da = Math.abs(a.x - from.x) + Math.abs(a.y - from.y);
        const db = Math.abs(b.x - from.x) + Math.abs(b.y - from.y);
        return da - db;
      });
    return candidates[0] ?? null;
  }

  private findFreeHome(homes: PlacedBuilding[]): PlacedBuilding | null {
    for (const home of homes) {
      const capacity = HOUSE_CAPACITY[home.type] ?? 1;
      const occupants = this.homeAssignments.get(home.id) ?? 0;
      if (occupants < capacity) {
        return home;
      }
    }
    return homes[0] ?? null;
  }

  private findFreeWorkplace(sortedWorks: PlacedBuilding[]): PlacedBuilding | null {
    for (const work of sortedWorks) {
      const def = BUILDING_DEFINITIONS[work.type];
      const slots = def.production?.workerSlots ?? 0;
      if (slots <= 0) continue;
      const assigned = this.workAssignments.get(work.id) ?? 0;
      if (assigned < slots) {
        return work;
      }
    }
    return null;
  }

  private findSpawnTile(): { x: number; y: number } {
    const buildings = this.getBuildings();
    for (const building of buildings) {
      const definition = BUILDING_DEFINITIONS[building.type];
      const candidates = this.computeEntryTiles(building, definition.size).filter(
        (tile) => this.isInBounds(tile.x, tile.y) && !this.isTileBlocked(tile.x, tile.y),
      );
      if (candidates.length > 0) {
        return candidates[0];
      }
    }
    const cx = Math.floor(this.mapWidth * 0.5);
    const cy = Math.floor(this.mapHeight * 0.5);
    if (!this.isTileBlocked(cx, cy)) {
      return { x: cx, y: cy };
    }
    for (let r = 1; r < Math.max(this.mapWidth, this.mapHeight); r += 1) {
      for (let dx = -r; dx <= r; dx += 1) {
        for (let dy = -r; dy <= r; dy += 1) {
          const tx = cx + dx;
          const ty = cy + dy;
          if (this.isInBounds(tx, ty) && !this.isTileBlocked(tx, ty)) {
            return { x: tx, y: ty };
          }
        }
      }
    }
    return { x: 0, y: 0 };
  }

  private isInBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.mapWidth && y < this.mapHeight;
  }

  private tileCenter(tileX: number, tileY: number): { x: number; y: number } {
    const world = gridToWorld(tileX, tileY, this.tileSize);
    return {
      x: world.x + this.tileSize * 0.5,
      y: world.y + this.tileSize * 0.5,
    };
  }

  private worldToTile(worldX: number, worldY: number): { x: number; y: number } {
    return {
      x: Math.floor(worldX / this.tileSize),
      y: Math.floor(worldY / this.tileSize),
    };
  }

  private directionFromDelta(dx: number, dy: number): VillagerDirection {
    if (Math.abs(dx) > Math.abs(dy)) {
      return dx > 0 ? 'right' : 'left';
    }
    return dy > 0 ? 'down' : 'up';
  }
}
