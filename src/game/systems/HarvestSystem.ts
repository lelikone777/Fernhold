import type { FoliagePaintSystem } from './FoliagePaintSystem';

export class HarvestSystem {
  private readonly claimedNodes = new Map<string, string>();

  public assignTarget(
    villagerId: string,
    fromX: number,
    fromY: number,
    resourceType: 'wood' | 'stone',
    foliageSystem: FoliagePaintSystem,
  ): { x: number; y: number; key: string } | null {
    const target = foliageSystem.findNearestHarvestable(fromX, fromY, resourceType, new Set(this.claimedNodes.keys()));
    if (!target) {
      return null;
    }
    const key = this.toKey(target.x, target.y);
    this.claimedNodes.set(key, villagerId);
    return { x: target.x, y: target.y, key };
  }

  public isNodeClaimed(x: number, y: number): boolean {
    return this.claimedNodes.has(this.toKey(x, y));
  }

  public releaseTarget(villagerId: string): void {
    for (const [key, owner] of this.claimedNodes.entries()) {
      if (owner === villagerId) {
        this.claimedNodes.delete(key);
      }
    }
  }

  public releaseTargetByKey(key: string, villagerId: string): void {
    if (this.claimedNodes.get(key) === villagerId) {
      this.claimedNodes.delete(key);
    }
  }

  private toKey(x: number, y: number): string {
    return `${x}:${y}`;
  }
}
