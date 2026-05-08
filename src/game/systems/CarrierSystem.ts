import type { BuildingType, PlacedBuilding, ResourceDrop } from '../types/game';
import { BUILDING_DEFINITIONS } from '../data/buildings';
import type { ConstructionSystem } from './ConstructionSystem';
import type { ResourceDropSystem } from './ResourceDropSystem';

const STORAGE_TYPES: BuildingType[] = [
  'storage_level_1',
  'storage_level_2',
  'storage_level_3',
  'storage_level_4',
  'storage_level_5',
];

export interface CarryTask {
  drop: ResourceDrop;
  destinationBuildingId: string;
  destinationKind: 'construction' | 'storage';
}

export class CarrierSystem {
  private readonly dropSystem: ResourceDropSystem;
  private readonly constructionSystem: ConstructionSystem;

  constructor(dropSystem: ResourceDropSystem, constructionSystem: ConstructionSystem) {
    this.dropSystem = dropSystem;
    this.constructionSystem = constructionSystem;
  }

  public createTask(
    villagerId: string,
    fromTile: { x: number; y: number },
    workBuildingId: string | null,
    buildings: PlacedBuilding[],
  ): CarryTask | null {
    const claimed = this.dropSystem.claimNearest(fromTile, villagerId);
    if (!claimed) {
      return null;
    }

    const destination = this.findDestination(claimed, workBuildingId, buildings);
    if (!destination) {
      this.dropSystem.releaseClaim(claimed.id, villagerId);
      return null;
    }

    return {
      drop: claimed,
      destinationBuildingId: destination.building.id,
      destinationKind: destination.kind,
    };
  }

  private findDestination(
    drop: ResourceDrop,
    workBuildingId: string | null,
    buildings: PlacedBuilding[],
  ): { building: PlacedBuilding; kind: 'construction' | 'storage' } | null {
    const pendingSites = this.constructionSystem.getPendingResourceSites(buildings);
    const neededSite = pendingSites
      .filter((building) => this.getRemainingNeed(building, drop.resourceType) > 0)
      .sort((a, b) => {
        const da = Math.abs(a.x - drop.x) + Math.abs(a.y - drop.y);
        const db = Math.abs(b.x - drop.x) + Math.abs(b.y - drop.y);
        return da - db;
      })[0];
    if (neededSite) {
      return { building: neededSite, kind: 'construction' };
    }

    const storageCandidates = buildings.filter((building) => STORAGE_TYPES.includes(building.type));
    if (storageCandidates.length === 0) {
      return null;
    }
    if (workBuildingId) {
      const assigned = storageCandidates.find((entry) => entry.id === workBuildingId);
      if (assigned) {
        return { building: assigned, kind: 'storage' };
      }
    }
    const nearest = storageCandidates.sort((a, b) => {
      const da = Math.abs(a.x - drop.x) + Math.abs(a.y - drop.y);
      const db = Math.abs(b.x - drop.x) + Math.abs(b.y - drop.y);
      return da - db;
    })[0];
    return nearest ? { building: nearest, kind: 'storage' } : null;
  }

  public getCarrierSlots(building: PlacedBuilding): number {
    return BUILDING_DEFINITIONS[building.type].production?.carrierSlots ?? 0;
  }

  private getRemainingNeed(building: PlacedBuilding, resource: 'wood' | 'stone'): number {
    const construction = building.construction;
    if (!construction || construction.stage !== 'foundation') {
      return 0;
    }
    const needed = construction.resourcesNeeded[resource] ?? 0;
    const delivered = construction.resourcesDelivered[resource] ?? 0;
    return Math.max(0, needed - delivered);
  }
}
