import type { PlacedBuilding, ResourceCost, ResourceType } from '../types/game';

const CONSTRUCTION_RESOURCES: ResourceType[] = ['wood', 'stone'];

export class ConstructionSystem {
  public initConstruction(
    building: PlacedBuilding,
    fullCost: ResourceCost,
    upfrontCost?: ResourceCost,
    upfrontRatio = 0.2,
  ): void {
    const resourcesNeeded: ResourceCost = {};
    for (const resource of CONSTRUCTION_RESOURCES) {
      const total = fullCost[resource] ?? 0;
      if (total <= 0) {
        continue;
      }
      const upfront = Math.min(
        total,
        (upfrontCost?.[resource] ?? Math.floor(total * upfrontRatio)) || 0,
      );
      const remaining = Math.max(0, total - upfront);
      if (remaining > 0) {
        resourcesNeeded[resource] = remaining;
      }
    }

    building.construction = {
      stage: 'foundation',
      resourcesNeeded,
      resourcesDelivered: {},
      buildProgress: 0,
    };

    if (!this.needsAnyResource(building)) {
      building.construction.stage = 'frame';
    }
  }

  public getPendingResourceSites(buildings: PlacedBuilding[]): PlacedBuilding[] {
    return buildings.filter((building) => this.isStage(building, 'foundation') && this.needsAnyResource(building));
  }

  public getFrameSites(buildings: PlacedBuilding[]): PlacedBuilding[] {
    return buildings.filter((building) => this.isStage(building, 'frame'));
  }

  public deliverResource(
    building: PlacedBuilding,
    resource: 'wood' | 'stone',
    amount: number,
  ): number {
    if (!building.construction || building.construction.stage !== 'foundation') {
      return 0;
    }
    const needed = building.construction.resourcesNeeded[resource] ?? 0;
    const delivered = building.construction.resourcesDelivered[resource] ?? 0;
    const remaining = Math.max(0, needed - delivered);
    if (remaining <= 0) {
      return 0;
    }
    const accepted = Math.min(amount, remaining);
    building.construction.resourcesDelivered[resource] = delivered + accepted;

    if (!this.needsAnyResource(building)) {
      building.construction.stage = 'frame';
    }
    return accepted;
  }

  public addBuilderProgress(building: PlacedBuilding, progressDelta: number): boolean {
    if (!building.construction || building.construction.stage !== 'frame') {
      return false;
    }
    building.construction.buildProgress = Math.min(1, building.construction.buildProgress + progressDelta);
    if (building.construction.buildProgress >= 1) {
      building.construction.stage = 'complete';
      return true;
    }
    return false;
  }

  public isConstructed(building: PlacedBuilding): boolean {
    if (!building.construction) {
      return true;
    }
    return building.construction.stage === 'complete';
  }

  public getConstructionProgress(building: PlacedBuilding): number {
    if (!building.construction) {
      return 1;
    }
    if (building.construction.stage === 'foundation') {
      const neededWood = building.construction.resourcesNeeded.wood ?? 0;
      const neededStone = building.construction.resourcesNeeded.stone ?? 0;
      const deliveredWood = building.construction.resourcesDelivered.wood ?? 0;
      const deliveredStone = building.construction.resourcesDelivered.stone ?? 0;
      const totalNeed = neededWood + neededStone;
      const totalDelivered = deliveredWood + deliveredStone;
      if (totalNeed <= 0) {
        return 0.4;
      }
      return Math.min(0.4, (totalDelivered / totalNeed) * 0.4);
    }
    if (building.construction.stage === 'frame') {
      return 0.4 + building.construction.buildProgress * 0.6;
    }
    return 1;
  }

  private isStage(building: PlacedBuilding, stage: 'foundation' | 'frame'): boolean {
    return building.construction?.stage === stage;
  }

  private needsAnyResource(building: PlacedBuilding): boolean {
    if (!building.construction) {
      return false;
    }
    for (const resource of CONSTRUCTION_RESOURCES) {
      const needed = building.construction.resourcesNeeded[resource] ?? 0;
      const delivered = building.construction.resourcesDelivered[resource] ?? 0;
      if (needed - delivered > 0) {
        return true;
      }
    }
    return false;
  }
}
