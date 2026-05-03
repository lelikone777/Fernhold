import type { ResourceCost, Resources } from '../types/game';

export class ResourceSystem {
  private resources: Resources;

  constructor(initialResources: Resources) {
    this.resources = { ...initialResources };
  }

  public setResources(resources: Resources): void {
    this.resources = { ...resources };
  }

  public getResources(): Resources {
    return { ...this.resources };
  }

  public canAfford(cost: ResourceCost): boolean {
    return Object.entries(cost).every(([resource, amount]) => {
      const needed = amount ?? 0;
      return this.resources[resource as keyof Resources] >= needed;
    });
  }

  public spend(cost: ResourceCost): boolean {
    if (!this.canAfford(cost)) {
      return false;
    }

    for (const [resource, amount] of Object.entries(cost)) {
      this.resources[resource as keyof Resources] -= amount ?? 0;
    }

    return true;
  }

  public add(change: ResourceCost): void {
    for (const [resource, amount] of Object.entries(change)) {
      this.resources[resource as keyof Resources] += amount ?? 0;
    }
  }
}
