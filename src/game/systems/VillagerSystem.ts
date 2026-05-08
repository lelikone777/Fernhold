import type Phaser from 'phaser';
import { TOOL_BREAK_CHANCE, VILLAGER_XP_LEVELS } from '../data/balance';
import { BUILDING_DEFINITIONS } from '../data/buildings';
import {
  BUILDING_ROLE_MAP,
  getWorkPriority,
  HOUSE_BUILDING_TYPES,
  HOUSE_CAPACITY,
  VILLAGER_PALETTES,
  VILLAGER_SPEED_PIXELS_PER_SEC,
  VILLAGER_SPRITE_KEY_PREFIX,
  WORK_BUILDING_TYPES,
} from '../data/villagers';
import type { Villager } from '../entities/Villager';
import type { CarrierSystem } from './CarrierSystem';
import type { ConstructionSystem } from './ConstructionSystem';
import type { FoliagePaintSystem } from './FoliagePaintSystem';
import type { HarvestSystem } from './HarvestSystem';
import type { ResourceDropSystem } from './ResourceDropSystem';
import type {
  BuildingType,
  PlacedBuilding,
  ResourceType,
  RoleExperienceSummary,
  VillagerDirection,
  VillagerRole,
  VillagerState,
} from '../types/game';
import { gridToWorld } from '../utils/grid';
import { findPath } from '../utils/pathfinder';

const WORK_DURATION_MS = 8000;
const HOME_DURATION_MS = 4000;
const IDLE_REPLAN_MS = 1200;
const ARRIVAL_THRESHOLD_PX = 1.5;
const HARVEST_TICK_MS = 2500;
const BUILD_TICK_MS = 6000;

interface VillagerSystemOptions {
  scene: Phaser.Scene;
  tileSize: number;
  mapWidth: number;
  mapHeight: number;
  isTileBlocked: (x: number, y: number) => boolean;
  getBuildings: () => PlacedBuilding[];
  getFoliageSystem?: () => FoliagePaintSystem | null;
  getResourceDropSystem?: () => ResourceDropSystem | null;
  getHarvestSystem?: () => HarvestSystem | null;
  getCarrierSystem?: () => CarrierSystem | null;
  getConstructionSystem?: () => ConstructionSystem | null;
  onStorageDelivered?: (resource: 'wood' | 'stone', amount: number) => void;
  consumeResource?: (resource: ResourceType, amount: number) => boolean;
  hasResource?: (resource: ResourceType, amount: number) => boolean;
  onConstructionCompleted?: (buildingId: string) => void;
  getCurrentDay?: () => number;
}

type WorkRole = Extract<VillagerRole, 'carrier' | 'worker' | 'lumberjack' | 'miner'>;

export class VillagerSystem {
  private readonly scene: Phaser.Scene;
  private readonly tileSize: number;
  private readonly mapWidth: number;
  private readonly mapHeight: number;
  private readonly isTileBlocked: (x: number, y: number) => boolean;
  private readonly getBuildings: () => PlacedBuilding[];
  private readonly getFoliageSystem?: () => FoliagePaintSystem | null;
  private readonly getResourceDropSystem?: () => ResourceDropSystem | null;
  private readonly getHarvestSystem?: () => HarvestSystem | null;
  private readonly getCarrierSystem?: () => CarrierSystem | null;
  private readonly getConstructionSystem?: () => ConstructionSystem | null;
  private readonly onStorageDelivered?: (resource: 'wood' | 'stone', amount: number) => void;
  private readonly consumeResource?: (resource: ResourceType, amount: number) => boolean;
  private readonly hasResource?: (resource: ResourceType, amount: number) => boolean;
  private readonly onConstructionCompleted?: (buildingId: string) => void;
  private readonly getCurrentDay?: () => number;

  private readonly villagers = new Map<string, Villager>();
  private nextId = 1;
  private homeAssignments = new Map<string, number>();
  private workAssignments = new Map<string, number>();
  private roleCounts = new Map<VillagerRole, number>();
  private assignedByBuilding = new Map<string, Villager[]>();
  private desiredWorkAssignments = new Map<string, number>();

  constructor(options: VillagerSystemOptions) {
    this.scene = options.scene;
    this.tileSize = options.tileSize;
    this.mapWidth = options.mapWidth;
    this.mapHeight = options.mapHeight;
    this.isTileBlocked = options.isTileBlocked;
    this.getBuildings = options.getBuildings;
    this.getFoliageSystem = options.getFoliageSystem;
    this.getResourceDropSystem = options.getResourceDropSystem;
    this.getHarvestSystem = options.getHarvestSystem;
    this.getCarrierSystem = options.getCarrierSystem;
    this.getConstructionSystem = options.getConstructionSystem;
    this.onStorageDelivered = options.onStorageDelivered;
    this.consumeResource = options.consumeResource;
    this.hasResource = options.hasResource;
    this.onConstructionCompleted = options.onConstructionCompleted;
    this.getCurrentDay = options.getCurrentDay;
  }

  public syncPopulation(targetPopulation: number): void {
    const currentCount = this.villagers.size;
    if (targetPopulation > currentCount) {
      for (let i = 0; i < targetPopulation - currentCount; i += 1) this.spawnVillager();
    } else if (targetPopulation < currentCount) {
      const keysToRemove = [...this.villagers.keys()].slice(targetPopulation);
      for (const key of keysToRemove) this.removeVillager(key);
    }
    this.reassignJobs();
  }

  public reassignJobs(): void {
    const buildings = this.getBuildings();
    const homes = buildings.filter((b) => HOUSE_BUILDING_TYPES.has(b.type));
    const works = buildings
      .filter((b) => WORK_BUILDING_TYPES.has(b.type))
      .filter((b) => !b.construction || b.construction.stage === 'complete')
      .sort((a, b) => getWorkPriority(a.type) - getWorkPriority(b.type));
    const homeMap = new Map(homes.map((b) => [b.id, b]));
    const workMap = new Map(works.map((b) => [b.id, b]));
    for (const id of [...this.desiredWorkAssignments.keys()]) {
      if (!workMap.has(id)) this.desiredWorkAssignments.delete(id);
    }

    this.homeAssignments.clear();
    this.workAssignments.clear();
    this.assignedByBuilding.clear();

    for (const villager of this.villagers.values()) {
      if (villager.homeBuildingId && !homeMap.has(villager.homeBuildingId)) villager.homeBuildingId = null;
      if (villager.workBuildingId && !workMap.has(villager.workBuildingId)) {
        this.resetTask(villager);
        villager.workBuildingId = null;
      }
      if (villager.homeBuildingId) {
        this.homeAssignments.set(villager.homeBuildingId, (this.homeAssignments.get(villager.homeBuildingId) ?? 0) + 1);
      }
      villager.workBuildingId = null;
      if (villager.role !== 'builder') villager.role = 'idle_villager';
    }

    for (const villager of this.villagers.values()) {
      if (!villager.homeBuildingId) {
        const home = this.findFreeHome(homes);
        if (!home) continue;
        villager.homeBuildingId = home.id;
        this.homeAssignments.set(home.id, (this.homeAssignments.get(home.id) ?? 0) + 1);
      }
    }

    for (const work of works) {
      const role = this.resolveRoleForBuilding(work.type);
      const slots = this.getSlotsForWork(work.type, role);
      if (!this.desiredWorkAssignments.has(work.id)) {
        this.desiredWorkAssignments.set(work.id, role === 'carrier' ? slots : 0);
      }
      const desired = Math.max(0, Math.min(slots, this.desiredWorkAssignments.get(work.id) ?? 0));
      this.desiredWorkAssignments.set(work.id, desired);
      for (let i = 0; i < desired; i += 1) {
        const villager = this.pickAssignee(role);
        if (!villager) break;
        villager.workBuildingId = work.id;
        villager.role = role;
        this.workAssignments.set(work.id, (this.workAssignments.get(work.id) ?? 0) + 1);
        const list = this.assignedByBuilding.get(work.id) ?? [];
        list.push(villager);
        this.assignedByBuilding.set(work.id, list);
      }
    }

    this.recomputeRoleCounts();
  }

  public getWorkerCounts(): ReadonlyMap<string, number> {
    return this.workAssignments;
  }

  public getRoleCounts(): ReadonlyMap<VillagerRole, number> {
    return this.roleCounts;
  }

  public getRoleExperienceSummary(): Record<'carrier' | 'worker' | 'builder', RoleExperienceSummary> {
    return {
      carrier: this.summarizeRole('carrier'),
      worker: this.summarizeRole('worker'),
      builder: this.summarizeRole('builder'),
    };
  }

  public getProductionEfficiencyByBuilding(): ReadonlyMap<string, number> {
    const result = new Map<string, number>();
    for (const [buildingId, villagers] of this.assignedByBuilding.entries()) {
      const workers = villagers.filter((v) => v.role === 'worker');
      if (workers.length === 0) continue;
      const avg = workers.reduce((sum, v) => sum + this.workerOutputMultiplier(v), 0) / workers.length;
      result.set(buildingId, avg);
    }
    return result;
  }

  public update(deltaMs: number): void {
    for (const villager of this.villagers.values()) this.updateVillager(villager, deltaMs);
    this.recomputeRoleCounts();
  }

  public clear(): void {
    for (const villager of this.villagers.values()) villager.sprite.destroy();
    this.villagers.clear();
    this.homeAssignments.clear();
    this.workAssignments.clear();
    this.roleCounts.clear();
    this.assignedByBuilding.clear();
    this.desiredWorkAssignments.clear();
    this.nextId = 1;
  }

  public adjustDesiredWorkers(buildingId: string, delta: number): boolean {
    const building = this.getBuildings().find((b) => b.id === buildingId);
    if (!building || (building.construction && building.construction.stage !== 'complete')) return false;
    if (!WORK_BUILDING_TYPES.has(building.type)) return false;
    const role = this.resolveRoleForBuilding(building.type);
    const slots = this.getSlotsForWork(building.type, role);
    if (slots <= 0) return false;
    const current = this.desiredWorkAssignments.get(buildingId) ?? (role === 'carrier' ? slots : 0);
    const next = Math.max(0, Math.min(slots, current + delta));
    if (next === current) return false;
    if (next > current && role !== 'carrier') {
      this.rebalanceCarrierTargets(next - current);
    }
    this.desiredWorkAssignments.set(buildingId, next);
    this.reassignJobs();
    return true;
  }

  public getBuildingAssignmentInfo(
    buildingId: string,
  ): {
    role: WorkRole | null;
    slots: number;
    assigned: number;
    desired: number;
  } {
    const building = this.getBuildings().find((b) => b.id === buildingId);
    if (!building || (building.construction && building.construction.stage !== 'complete')) {
      return { role: null, slots: 0, assigned: 0, desired: 0 };
    }
    if (!WORK_BUILDING_TYPES.has(building.type)) return { role: null, slots: 0, assigned: 0, desired: 0 };
    const role = this.resolveRoleForBuilding(building.type);
    const slots = this.getSlotsForWork(building.type, role);
    const assigned = this.workAssignments.get(buildingId) ?? 0;
    const desired = Math.max(0, Math.min(slots, this.desiredWorkAssignments.get(buildingId) ?? (role === 'carrier' ? slots : 0)));
    return { role, slots, assigned, desired };
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
    sprite.setOrigin(0.5, 0.95).setDepth(0.78).setScale(1);
    const idleAnimKey = `${paletteKey}_idle_down`;
    const walkAnimKey = `${paletteKey}_walk_down`;
    if (this.scene.anims.exists(idleAnimKey)) sprite.play(idleAnimKey);
    this.villagers.set(id, {
      id,
      paletteKey,
      homeBuildingId: null,
      workBuildingId: null,
      role: 'idle_villager',
      state: 'idle',
      direction: 'down',
      worldX: worldPos.x,
      worldY: worldPos.y,
      path: [],
      pathTargetIndex: 0,
      workTimerMs: 0,
      idleTimerMs: 0,
      targetNodeKey: null,
      pendingToolResource: null,
      pendingToolBreakChance: 0,
      pendingToolMode: null,
      carryingResource: null,
      carryingAmount: 0,
      deliverToBuildingId: null,
      experience: { carrier: 0, worker: 0, builder: 0 },
      promotedToWorker: false,
      promotedToBuilder: false,
      sprite,
      walkAnimKey,
      idleAnimKey,
    });
  }

  private removeVillager(id: string): void {
    const villager = this.villagers.get(id);
    if (!villager) return;
    this.resetTask(villager);
    villager.sprite.destroy();
    this.villagers.delete(id);
  }

  private updateVillager(villager: Villager, deltaMs: number): void {
    switch (villager.state) {
      case 'idle':
        this.updateIdle(villager, deltaMs);
        return;
      case 'walking':
      case 'going_to_work':
      case 'going_home':
      case 'going_to_tool':
      case 'going_to_harvest':
      case 'carrying':
      case 'going_to_build':
        this.updateMoving(villager, deltaMs);
        return;
      case 'working':
        this.updateWorking(villager, deltaMs);
        return;
      case 'harvesting':
        this.updateHarvesting(villager, deltaMs);
        return;
      case 'building':
        this.updateBuilding(villager, deltaMs);
        return;
    }
  }

  private updateIdle(villager: Villager, deltaMs: number): void {
    villager.idleTimerMs += deltaMs;
    if (villager.idleTimerMs < IDLE_REPLAN_MS) return;
    villager.idleTimerMs = 0;
    if ((villager.role === 'lumberjack' || villager.role === 'miner') && this.startHarvestLoop(villager)) return;
    if (villager.role === 'carrier' && this.startCarrierLoop(villager)) return;
    if (villager.role === 'worker' && this.startWorkerLoop(villager)) return;
    if (this.startBuilderLoop(villager)) return;
    if (villager.workBuildingId) {
      this.startGoingTo(villager, villager.workBuildingId, 'going_to_work');
      return;
    }
    this.startWander(villager);
  }

  private updateWorking(villager: Villager, deltaMs: number): void {
    villager.workTimerMs += deltaMs;
    const duration = villager.role === 'worker' ? WORK_DURATION_MS / this.classSpeed(villager.experience.worker, 0.2) : WORK_DURATION_MS;
    if (villager.workTimerMs < duration) return;
    villager.workTimerMs = 0;
    if (villager.role === 'worker') {
      const neededTool = this.getWorkerToolForBuilding(villager.workBuildingId);
      if (neededTool && !this.tryUseTool(neededTool, villager.experience.worker, TOOL_BREAK_CHANCE.worker)) {
        villager.state = 'idle';
        return;
      }
    }
    if (villager.role === 'worker') villager.experience.worker += 5;
    if (villager.homeBuildingId) this.startGoingTo(villager, villager.homeBuildingId, 'going_home');
    else this.startWander(villager);
  }

  private updateHarvesting(villager: Villager, deltaMs: number): void {
    villager.workTimerMs += deltaMs;
    if (villager.workTimerMs < HARVEST_TICK_MS) return;
    villager.workTimerMs = 0;
    if (!villager.targetNodeKey) {
      villager.state = 'idle';
      return;
    }
    const [sx, sy] = villager.targetNodeKey.split(':');
    const x = Number(sx);
    const y = Number(sy);
    const foliage = this.getFoliageSystem?.();
    const harvest = this.getHarvestSystem?.();
    const drops = this.getResourceDropSystem?.();
    if (!foliage || !harvest || !drops || Number.isNaN(x) || Number.isNaN(y)) {
      this.resetTask(villager);
      villager.state = 'idle';
      return;
    }
    const damage = foliage.damageAt(x, y, 1);
    if (!damage.destroyed || !damage.drop) return;
    harvest.releaseTargetByKey(villager.targetNodeKey, villager.id);
    villager.targetNodeKey = null;
    villager.carryingResource = damage.drop.resourceType;
    villager.carryingAmount = damage.drop.amount;
    villager.deliverToBuildingId = villager.workBuildingId;
    if (villager.workBuildingId) this.startGoingTo(villager, villager.workBuildingId, 'carrying');
    else {
      drops.spawnDrop(x, y, damage.drop.resourceType, damage.drop.amount, this.getCurrentDay?.() ?? 1);
      villager.carryingResource = null;
      villager.carryingAmount = 0;
      villager.deliverToBuildingId = null;
      villager.state = 'idle';
    }
  }

  private updateBuilding(villager: Villager, deltaMs: number): void {
    villager.workTimerMs += deltaMs;
    const duration = BUILD_TICK_MS / this.classSpeed(villager.experience.builder, 0.22);
    if (villager.workTimerMs < duration) return;
    villager.workTimerMs = 0;
    if (!this.tryUseTool('hammer', villager.experience.builder, TOOL_BREAK_CHANCE.builder)) {
      villager.state = 'idle';
      return;
    }
    const buildingId = villager.deliverToBuildingId;
    const construction = this.getConstructionSystem?.();
    if (!buildingId || !construction) {
      villager.state = 'idle';
      return;
    }
    const target = this.getBuildings().find((b) => b.id === buildingId);
    if (!target) {
      villager.state = 'idle';
      villager.deliverToBuildingId = null;
      return;
    }
    villager.experience.builder += 6;
    const progress = 0.2 + (this.level(villager.experience.builder) - 1) * 0.05;
    const done = construction.addBuilderProgress(target, progress);
    if (done) {
      this.onConstructionCompleted?.(target.id);
      this.reassignJobs();
    }
    villager.state = 'idle';
  }

  private updateMoving(villager: Villager, deltaMs: number): void {
    if (villager.path.length === 0 || villager.pathTargetIndex >= villager.path.length) {
      this.handleArrival(villager);
      return;
    }
    const target = villager.path[villager.pathTargetIndex];
    const world = this.tileCenter(target.x, target.y);
    const dx = world.x - villager.worldX;
    const dy = world.y - villager.worldY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance <= ARRIVAL_THRESHOLD_PX) {
      villager.worldX = world.x;
      villager.worldY = world.y;
      villager.pathTargetIndex += 1;
      if (villager.pathTargetIndex >= villager.path.length) this.handleArrival(villager);
      return;
    }
    const carrierBonus = villager.role === 'carrier' ? this.classSpeed(villager.experience.carrier, 0.12) : 1;
    const step = ((VILLAGER_SPEED_PIXELS_PER_SEC * carrierBonus) * deltaMs) / 1000;
    const move = Math.min(step, distance);
    villager.worldX += (dx / distance) * move;
    villager.worldY += (dy / distance) * move;
    const newDirection = this.directionFromDelta(dx, dy);
    if (newDirection !== villager.direction) {
      villager.direction = newDirection;
      villager.walkAnimKey = `${villager.paletteKey}_walk_${newDirection}`;
      villager.idleAnimKey = `${villager.paletteKey}_idle_${newDirection}`;
      if (this.scene.anims.exists(villager.walkAnimKey)) villager.sprite.play(villager.walkAnimKey, true);
    } else if (!villager.sprite.anims.isPlaying || villager.sprite.anims.currentAnim?.key !== villager.walkAnimKey) {
      if (this.scene.anims.exists(villager.walkAnimKey)) villager.sprite.play(villager.walkAnimKey, true);
    }
    villager.sprite.setTint(villager.carryingAmount > 0 ? 0xd9e6b8 : 0xffffff);
    villager.sprite.setPosition(villager.worldX, villager.worldY);
    villager.sprite.setDepth(0.78 + villager.worldY * 0.0001);
  }

  private handleArrival(villager: Villager): void {
    villager.path = [];
    villager.pathTargetIndex = 0;
    villager.sprite.clearTint();
    if (this.scene.anims.exists(villager.idleAnimKey)) villager.sprite.play(villager.idleAnimKey, true);
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
    if (villager.state === 'going_to_harvest') {
      villager.state = 'harvesting';
      villager.workTimerMs = 0;
      return;
    }
    if (villager.state === 'going_to_tool') {
      this.completeToolPickup(villager);
      return;
    }
    if (villager.state === 'going_to_build') {
      villager.state = 'building';
      villager.workTimerMs = 0;
      return;
    }
    if (villager.state === 'walking' && villager.role === 'carrier' && villager.carryingAmount === 0) {
      this.pickUpCarrierDrop(villager);
      return;
    }
    if (villager.state === 'carrying') {
      this.completeCarrierDelivery(villager);
      return;
    }
    villager.state = 'idle';
    villager.idleTimerMs = 0;
  }

  private startGoingTo(villager: Villager, buildingId: string, state: VillagerState): boolean {
    const building = this.getBuildings().find((b) => b.id === buildingId);
    if (!building) {
      villager.state = 'idle';
      return false;
    }
    const size = BUILDING_DEFINITIONS[building.type].size;
    const entries: { x: number; y: number }[] = [];
    for (let dx = 0; dx < size.w; dx += 1) {
      entries.push({ x: building.x + dx, y: building.y - 1 }, { x: building.x + dx, y: building.y + size.h });
    }
    for (let dy = 0; dy < size.h; dy += 1) {
      entries.push({ x: building.x - 1, y: building.y + dy }, { x: building.x + size.w, y: building.y + dy });
    }
    const start = this.worldToTile(villager.worldX, villager.worldY);
    const target = entries
      .filter((t) => this.isInBounds(t.x, t.y))
      .filter((t) => !this.isTileBlocked(t.x, t.y))
      .sort((a, b) => Math.abs(a.x - start.x) + Math.abs(a.y - start.y) - (Math.abs(b.x - start.x) + Math.abs(b.y - start.y)))[0];
    if (!target) {
      villager.state = 'idle';
      return false;
    }
    const path = findPath(start, target, {
      width: this.mapWidth,
      height: this.mapHeight,
      isBlocked: (x, y) => (x === target.x && y === target.y ? false : this.isTileBlocked(x, y)),
    });
    if (!path || path.length === 0) {
      villager.state = 'idle';
      return false;
    }
    villager.path = path;
    villager.pathTargetIndex = 0;
    villager.state = state;
    return true;
  }

  private startGoingToTile(villager: Villager, x: number, y: number, state: VillagerState): boolean {
    const start = this.worldToTile(villager.worldX, villager.worldY);
    const path = findPath(start, { x, y }, {
      width: this.mapWidth,
      height: this.mapHeight,
      isBlocked: (tx, ty) => (tx === x && ty === y ? false : this.isTileBlocked(tx, ty)),
    });
    if (!path || path.length === 0) return false;
    villager.path = path;
    villager.pathTargetIndex = 0;
    villager.state = state;
    return true;
  }

  private startWander(villager: Villager): void {
    const from = this.worldToTile(villager.worldX, villager.worldY);
    for (let i = 0; i < 6; i += 1) {
      const tx = Math.max(0, Math.min(this.mapWidth - 1, from.x + Math.floor(Math.random() * 13) - 6));
      const ty = Math.max(0, Math.min(this.mapHeight - 1, from.y + Math.floor(Math.random() * 13) - 6));
      if (this.isTileBlocked(tx, ty)) continue;
      const path = findPath(from, { x: tx, y: ty }, {
        width: this.mapWidth,
        height: this.mapHeight,
        isBlocked: (x, y) => this.isTileBlocked(x, y),
      });
      if (!path || path.length === 0) continue;
      villager.path = path;
      villager.pathTargetIndex = 0;
      villager.state = 'walking';
      return;
    }
    villager.state = 'idle';
  }

  private startHarvestLoop(villager: Villager): boolean {
    const foliage = this.getFoliageSystem?.();
    const harvest = this.getHarvestSystem?.();
    if (!foliage || !harvest) return false;
    const from = this.worldToTile(villager.worldX, villager.worldY);
    const target = harvest.assignTarget(villager.id, from.x, from.y, villager.role === 'miner' ? 'stone' : 'wood', foliage);
    if (!target) return false;
    const tool = villager.role === 'miner' ? 'pickaxe' : 'axe';
    const storageId = this.findNearestStorageBuildingId(villager);
    if (!storageId) {
      harvest.releaseTargetByKey(target.key, villager.id);
      return false;
    }
    villager.targetNodeKey = target.key;
    const ok = this.startToolPickup(villager, tool, TOOL_BREAK_CHANCE.harvest, 'harvest', storageId);
    if (!ok) {
      harvest.releaseTargetByKey(target.key, villager.id);
      villager.targetNodeKey = null;
      return false;
    }
    return true;
  }

  private startWorkerLoop(villager: Villager): boolean {
    if (!villager.workBuildingId) return false;
    const neededTool = this.getWorkerToolForBuilding(villager.workBuildingId);
    if (!neededTool) return this.startGoingTo(villager, villager.workBuildingId, 'going_to_work');
    const storageId = this.findNearestStorageBuildingId(villager);
    if (!storageId) return false;
    return this.startToolPickup(villager, neededTool, TOOL_BREAK_CHANCE.worker, 'work', storageId);
  }

  private startCarrierLoop(villager: Villager): boolean {
    if (!this.tryUseTool('shovel', villager.experience.carrier, TOOL_BREAK_CHANCE.carrier)) return false;
    const carrier = this.getCarrierSystem?.();
    if (!carrier) return false;
    const from = this.worldToTile(villager.worldX, villager.worldY);
    const task = carrier.createTask(villager.id, from, villager.workBuildingId, this.getBuildings());
    if (!task) return false;
    villager.targetNodeKey = task.drop.id;
    villager.deliverToBuildingId = task.destinationBuildingId;
    const ok = this.startGoingToTile(villager, task.drop.x, task.drop.y, 'walking');
    if (!ok) {
      this.getResourceDropSystem?.()?.releaseClaim(task.drop.id, villager.id);
      villager.targetNodeKey = null;
      villager.deliverToBuildingId = null;
      return false;
    }
    return true;
  }

  private startBuilderLoop(villager: Villager): boolean {
    const construction = this.getConstructionSystem?.();
    if (!construction) return false;
    const canBuild = villager.role === 'builder' || villager.role === 'carrier' || villager.promotedToBuilder;
    if (!canBuild) return false;
    const frameSites = construction.getFrameSites(this.getBuildings());
    if (frameSites.length === 0) return false;
    const from = this.worldToTile(villager.worldX, villager.worldY);
    const target = frameSites.sort((a, b) => Math.abs(a.x - from.x) + Math.abs(a.y - from.y) - (Math.abs(b.x - from.x) + Math.abs(b.y - from.y)))[0];
    if (!target) return false;
    const storageId = this.findNearestStorageBuildingId(villager);
    if (!storageId) return false;
    villager.promotedToBuilder = true;
    villager.role = 'builder';
    villager.deliverToBuildingId = target.id;
    return this.startToolPickup(villager, 'hammer', TOOL_BREAK_CHANCE.builder, 'build', storageId);
  }

  private pickUpCarrierDrop(villager: Villager): void {
    const dropId = villager.targetNodeKey;
    const drops = this.getResourceDropSystem?.();
    if (!dropId || !drops) {
      villager.state = 'idle';
      return;
    }
    const picked = drops.pickUp(dropId, villager.id);
    if (!picked) {
      villager.state = 'idle';
      villager.targetNodeKey = null;
      return;
    }
    villager.carryingResource = picked.resourceType;
    villager.carryingAmount = picked.amount;
    villager.targetNodeKey = null;
    if (villager.deliverToBuildingId) this.startGoingTo(villager, villager.deliverToBuildingId, 'carrying');
    else villager.state = 'idle';
  }

  private completeCarrierDelivery(villager: Villager): void {
    const res = villager.carryingResource;
    const amount = villager.carryingAmount;
    if (!res || amount <= 0) {
      villager.state = 'idle';
      return;
    }
    if (
      (villager.role === 'lumberjack' || villager.role === 'miner') &&
      (res === 'wood' || res === 'stone') &&
      villager.deliverToBuildingId
    ) {
      const drops = this.getResourceDropSystem?.();
      const destination = this.getBuildings().find((b) => b.id === villager.deliverToBuildingId);
      if (drops && destination) {
        const tile = this.findDropTileNearBuilding(destination);
        drops.spawnDrop(tile.x, tile.y, res, amount, this.getCurrentDay?.() ?? 1);
      }
      villager.carryingResource = null;
      villager.carryingAmount = 0;
      villager.deliverToBuildingId = null;
      villager.state = 'idle';
      return;
    }
    let delivered = false;
    const destination = villager.deliverToBuildingId ? this.getBuildings().find((b) => b.id === villager.deliverToBuildingId) : null;
    const construction = this.getConstructionSystem?.();
    if (destination && construction && (res === 'wood' || res === 'stone') && destination.construction?.stage === 'foundation') {
      delivered = construction.deliverResource(destination, res, amount) > 0;
    }
    if (!delivered && (res === 'wood' || res === 'stone')) {
      this.onStorageDelivered?.(res, amount);
      delivered = true;
    }
    if (delivered) {
      villager.experience.carrier += 8;
      villager.carryingResource = null;
      villager.carryingAmount = 0;
      villager.deliverToBuildingId = null;
      villager.state = 'idle';
      this.reassignJobs();
      return;
    }
    villager.state = 'idle';
  }

  private findDropTileNearBuilding(building: PlacedBuilding): { x: number; y: number } {
    const size = BUILDING_DEFINITIONS[building.type].size;
    const entries: { x: number; y: number }[] = [];
    for (let dx = 0; dx < size.w; dx += 1) {
      entries.push({ x: building.x + dx, y: building.y - 1 }, { x: building.x + dx, y: building.y + size.h });
    }
    for (let dy = 0; dy < size.h; dy += 1) {
      entries.push({ x: building.x - 1, y: building.y + dy }, { x: building.x + size.w, y: building.y + dy });
    }
    const target = entries
      .filter((t) => this.isInBounds(t.x, t.y))
      .filter((t) => !this.isTileBlocked(t.x, t.y))[0];
    if (target) return target;
    return { x: building.x, y: building.y };
  }

  private findFreeHome(homes: PlacedBuilding[]): PlacedBuilding | null {
    for (const home of homes) {
      const cap = HOUSE_CAPACITY[home.type] ?? 1;
      if ((this.homeAssignments.get(home.id) ?? 0) < cap) return home;
    }
    return homes[0] ?? null;
  }

  private findSpawnTile(): { x: number; y: number } {
    for (const building of this.getBuildings()) {
      const size = BUILDING_DEFINITIONS[building.type].size;
      const candidates = [
        { x: building.x, y: building.y - 1 },
        { x: building.x + size.w - 1, y: building.y + size.h },
      ].filter((t) => this.isInBounds(t.x, t.y) && !this.isTileBlocked(t.x, t.y));
      if (candidates.length > 0) return candidates[0];
    }
    const cx = Math.floor(this.mapWidth * 0.5);
    const cy = Math.floor(this.mapHeight * 0.5);
    return { x: cx, y: cy };
  }

  private tileCenter(tileX: number, tileY: number): { x: number; y: number } {
    const world = gridToWorld(tileX, tileY, this.tileSize);
    return { x: world.x + this.tileSize * 0.5, y: world.y + this.tileSize * 0.5 };
  }

  private worldToTile(worldX: number, worldY: number): { x: number; y: number } {
    return { x: Math.floor(worldX / this.tileSize), y: Math.floor(worldY / this.tileSize) };
  }

  private isInBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.mapWidth && y < this.mapHeight;
  }

  private directionFromDelta(dx: number, dy: number): VillagerDirection {
    if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left';
    return dy > 0 ? 'down' : 'up';
  }

  private resetTask(villager: Villager): void {
    this.getHarvestSystem?.()?.releaseTarget(villager.id);
    if (villager.targetNodeKey) this.getResourceDropSystem?.()?.releaseClaim(villager.targetNodeKey, villager.id);
    villager.targetNodeKey = null;
    villager.pendingToolResource = null;
    villager.pendingToolBreakChance = 0;
    villager.pendingToolMode = null;
    villager.carryingAmount = 0;
    villager.carryingResource = null;
    villager.deliverToBuildingId = null;
  }

  private completeToolPickup(villager: Villager): void {
    const tool = villager.pendingToolResource;
    const mode = villager.pendingToolMode;
    if (!tool || !mode) {
      villager.state = 'idle';
      return;
    }
    const exp =
      mode === 'build'
        ? villager.experience.builder
        : mode === 'work'
          ? villager.experience.worker
          : villager.experience.worker;
    const ok = this.tryUseTool(tool, exp, villager.pendingToolBreakChance || TOOL_BREAK_CHANCE.harvest);
    villager.pendingToolResource = null;
    villager.pendingToolBreakChance = 0;
    villager.pendingToolMode = null;
    if (!ok) {
      if (villager.targetNodeKey) this.getHarvestSystem?.()?.releaseTargetByKey(villager.targetNodeKey, villager.id);
      villager.targetNodeKey = null;
      villager.state = 'idle';
      return;
    }
    if (mode === 'work') {
      if (villager.workBuildingId && this.startGoingTo(villager, villager.workBuildingId, 'going_to_work')) return;
      villager.state = 'idle';
      return;
    }
    if (mode === 'build') {
      if (villager.deliverToBuildingId && this.startGoingTo(villager, villager.deliverToBuildingId, 'going_to_build')) return;
      villager.state = 'idle';
      return;
    }
    if (!villager.targetNodeKey) {
      villager.state = 'idle';
      return;
    }
    const [sx, sy] = villager.targetNodeKey.split(':');
    const tx = Number(sx);
    const ty = Number(sy);
    if (Number.isNaN(tx) || Number.isNaN(ty)) {
      this.getHarvestSystem?.()?.releaseTargetByKey(villager.targetNodeKey, villager.id);
      villager.targetNodeKey = null;
      villager.state = 'idle';
      return;
    }
    const moved = this.startGoingToTile(villager, tx, ty, 'going_to_harvest');
    if (!moved) {
      this.getHarvestSystem?.()?.releaseTargetByKey(villager.targetNodeKey, villager.id);
      villager.targetNodeKey = null;
      villager.state = 'idle';
    }
  }

  private startToolPickup(
    villager: Villager,
    tool: ResourceType,
    breakChance: number,
    mode: 'harvest' | 'work' | 'build',
    storageId: string,
  ): boolean {
    villager.pendingToolResource = tool;
    villager.pendingToolBreakChance = breakChance;
    villager.pendingToolMode = mode;
    const ok = this.startGoingTo(villager, storageId, 'going_to_tool');
    if (ok) return true;
    villager.pendingToolResource = null;
    villager.pendingToolBreakChance = 0;
    villager.pendingToolMode = null;
    return false;
  }

  private findNearestStorageBuildingId(villager: Villager): string | null {
    const from = this.worldToTile(villager.worldX, villager.worldY);
    const candidates = this.getBuildings()
      .filter((b) => !b.construction || b.construction.stage === 'complete')
      .filter((b) => b.type.startsWith('storage_level_'))
      .sort((a, b) => Math.abs(a.x - from.x) + Math.abs(a.y - from.y) - (Math.abs(b.x - from.x) + Math.abs(b.y - from.y)));
    return candidates[0]?.id ?? null;
  }

  private recomputeRoleCounts(): void {
    const map = new Map<VillagerRole, number>();
    const roles: VillagerRole[] = ['idle_villager', 'lumberjack', 'miner', 'carrier', 'worker', 'builder'];
    for (const role of roles) map.set(role, 0);
    for (const villager of this.villagers.values()) map.set(villager.role, (map.get(villager.role) ?? 0) + 1);
    this.roleCounts = map;
  }

  private resolveRoleForBuilding(type: BuildingType): WorkRole {
    const mapped = BUILDING_ROLE_MAP[type];
    if (mapped === 'carrier' || mapped === 'worker' || mapped === 'lumberjack' || mapped === 'miner') return mapped;
    return 'worker';
  }

  private getSlotsForWork(type: BuildingType, role: WorkRole): number {
    const production = BUILDING_DEFINITIONS[type].production;
    if (!production) return 0;
    if (role === 'carrier') return production.carrierSlots ?? 0;
    return production.workerSlots ?? 0;
  }

  private pickAssignee(role: WorkRole): Villager | null {
    const free = [...this.villagers.values()].filter((v) => v.workBuildingId === null);
    if (free.length === 0) return null;
    if (role === 'lumberjack' || role === 'miner') {
      const byCarrierExp = [...free].sort((a, b) => a.experience.carrier - b.experience.carrier);
      return byCarrierExp[0] ?? free[0];
    }
    if (role === 'carrier') return free.find((v) => !v.promotedToWorker || v.role === 'carrier') ?? free[0];
    if (role === 'worker') {
      const promoted = free.find((v) => v.promotedToWorker);
      if (promoted) return promoted;
      const carrierLike = free.find((v) => v.role === 'carrier' || v.experience.carrier > 0);
      if (!carrierLike) return null;
      const chosen = carrierLike;
      chosen.promotedToWorker = true;
      return chosen;
    }
    return free[0];
  }

  private rebalanceCarrierTargets(required: number): void {
    if (required <= 0) return;
    const carriers = this.getBuildings()
      .filter((b) => !b.construction || b.construction.stage === 'complete')
      .filter((b) => WORK_BUILDING_TYPES.has(b.type))
      .map((b) => ({ building: b, role: this.resolveRoleForBuilding(b.type) }))
      .filter((entry) => entry.role === 'carrier')
      .map((entry) => {
        const slots = this.getSlotsForWork(entry.building.type, entry.role);
        const desired = this.desiredWorkAssignments.get(entry.building.id) ?? slots;
        return { id: entry.building.id, desired };
      })
      .filter((entry) => entry.desired > 0)
      .sort((a, b) => b.desired - a.desired);

    let left = required;
    for (const carrier of carriers) {
      if (left <= 0) break;
      const take = Math.min(left, carrier.desired);
      this.desiredWorkAssignments.set(carrier.id, carrier.desired - take);
      left -= take;
    }
  }

  private classSpeed(exp: number, perLevel: number): number {
    return 1 + (this.level(exp) - 1) * perLevel;
  }

  private tryConsume(resource: ResourceType, amount: number): boolean {
    if (amount <= 0) return true;
    if (!this.consumeResource) return true;
    return this.consumeResource(resource, amount);
  }

  private hasAny(resource: ResourceType, amount: number): boolean {
    if (amount <= 0) return true;
    if (!this.hasResource) return true;
    return this.hasResource(resource, amount);
  }

  private tryUseTool(resource: ResourceType, exp: number, baseBreakChance: number): boolean {
    if (!this.hasAny(resource, 1)) return false;
    const lvl = this.level(exp);
    const effectiveBreakChance = Math.max(
      TOOL_BREAK_CHANCE.min,
      baseBreakChance * (1 - (lvl - 1) * TOOL_BREAK_CHANCE.levelReductionPerTier),
    );
    if (Math.random() >= effectiveBreakChance) return true;
    return this.tryConsume(resource, 1);
  }

  private getWorkerToolForBuilding(buildingId: string | null): ResourceType | null {
    if (!buildingId) return null;
    const placed = this.getBuildings().find((entry) => entry.id === buildingId);
    if (!placed) return null;
    switch (placed.type) {
      case 'lumber_mill_level_1':
      case 'lumber_mill_level_2':
      case 'lumber_mill_level_3':
        return 'axe';
      case 'coal_mine_level_1':
      case 'coal_mine_level_2':
      case 'iron_mine_level_1':
      case 'iron_mine_level_2':
      case 'copper_tin_mine_level_1':
      case 'copper_tin_mine_level_2':
      case 'precious_mine_level_1':
      case 'precious_mine_level_2':
      case 'mason_yard':
        return 'pickaxe';
      case 'field_level_1':
      case 'field_level_2':
      case 'field_level_3':
      case 'farmhouse':
      case 'herb_hut':
      case 'pasture_level_1':
      case 'pasture_level_2':
      case 'pasture_level_3':
      case 'pasture_level_4':
      case 'pasture_level_5':
        return 'shovel';
      case 'windmill_level_1':
      case 'windmill_level_2':
      case 'bakery':
      case 'fisher_hut':
      case 'butcher_shop_level_1':
      case 'butcher_shop_level_2':
      case 'butcher_shop_level_3':
      case 'butcher_shop_level_4':
      case 'butcher_shop_level_5':
      case 'dairy_level_1':
      case 'dairy_level_2':
      case 'dairy_level_3':
      case 'dairy_level_4':
      case 'dairy_level_5':
      case 'creamery_level_1':
      case 'creamery_level_2':
      case 'creamery_level_3':
      case 'creamery_level_4':
      case 'creamery_level_5':
      case 'smokehouse_level_1':
      case 'smokehouse_level_2':
      case 'smokehouse_level_3':
      case 'smokehouse_level_4':
      case 'smokehouse_level_5':
      case 'kitchen_level_1':
      case 'kitchen_level_2':
      case 'kitchen_level_3':
      case 'kitchen_level_4':
      case 'kitchen_level_5':
        return 'knife';
      case 'workshop':
      case 'blacksmith_level_1':
      case 'blacksmith_level_2':
      case 'blacksmith_level_3':
      case 'smelter_level_1':
      case 'smelter_level_2':
      case 'foundry':
      case 'mint':
      case 'tool_workshop':
        return 'hammer';
      default:
        return null;
    }
  }

  private workerOutputMultiplier(v: Villager): number {
    return 1 + (this.level(v.experience.worker) - 1) * 0.1;
  }

  private level(exp: number): number {
    for (let i = VILLAGER_XP_LEVELS.length - 1; i >= 0; i -= 1) {
      if (exp >= VILLAGER_XP_LEVELS[i]) return i + 1;
    }
    return 1;
  }

  private progress(exp: number): number {
    const lvl = this.level(exp);
    if (lvl >= 5) return 1;
    const low = VILLAGER_XP_LEVELS[lvl - 1];
    const high = VILLAGER_XP_LEVELS[lvl];
    return Math.max(0, Math.min(1, (exp - low) / Math.max(1, high - low)));
  }

  private summarizeRole(role: 'carrier' | 'worker' | 'builder'): RoleExperienceSummary {
    const list = [...this.villagers.values()].filter((v) => v.role === role);
    if (list.length === 0) return { count: 0, avgLevel: 1, avgProgress: 0 };
    const avgLevel = list.reduce((sum, v) => sum + this.level(v.experience[role]), 0) / list.length;
    const avgProgress = list.reduce((sum, v) => sum + this.progress(v.experience[role]), 0) / list.length;
    return { count: list.length, avgLevel, avgProgress };
  }
}
