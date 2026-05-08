import type Phaser from 'phaser';
import type { ResourceDrop } from '../types/game';
import { gridToWorld } from '../utils/grid';

interface ResourceDropSystemOptions {
  scene: Phaser.Scene;
  tileSize: number;
}

export class ResourceDropSystem {
  private readonly scene: Phaser.Scene;
  private readonly tileSize: number;
  private readonly drops = new Map<string, ResourceDrop>();
  private readonly dropSprites = new Map<string, Phaser.GameObjects.Image>();
  private nextId = 1;

  constructor(options: ResourceDropSystemOptions) {
    this.scene = options.scene;
    this.tileSize = options.tileSize;
  }

  public clear(): void {
    for (const sprite of this.dropSprites.values()) {
      sprite.destroy();
    }
    this.dropSprites.clear();
    this.drops.clear();
    this.nextId = 1;
  }

  public load(drops: ResourceDrop[]): void {
    this.clear();
    for (const drop of drops) {
      this.nextId = Math.max(this.nextId, this.extractIdNumber(drop.id) + 1);
      this.drops.set(drop.id, { ...drop, claimedBy: null });
      this.renderDrop(drop.id);
    }
  }

  public serialize(): ResourceDrop[] {
    return [...this.drops.values()].map((drop) => ({ ...drop }));
  }

  public getCount(): number {
    return this.drops.size;
  }

  public spawnDrop(
    x: number,
    y: number,
    resourceType: ResourceDrop['resourceType'],
    amount: number,
    createdDay: number,
  ): ResourceDrop {
    const existing = [...this.drops.values()].find(
      (drop) => drop.x === x && drop.y === y && drop.resourceType === resourceType && drop.claimedBy === null,
    );
    if (existing) {
      existing.amount += amount;
      this.renderDrop(existing.id);
      return { ...existing };
    }

    const id = `drop_${String(this.nextId).padStart(4, '0')}`;
    this.nextId += 1;
    const drop: ResourceDrop = {
      id,
      x,
      y,
      resourceType,
      amount,
      claimedBy: null,
      createdDay,
    };
    this.drops.set(id, drop);
    this.renderDrop(id);
    return { ...drop };
  }

  public claimNearest(
    fromTile: { x: number; y: number },
    villagerId: string,
    resourceType?: ResourceDrop['resourceType'],
  ): ResourceDrop | null {
    const candidates = [...this.drops.values()]
      .filter((drop) => drop.claimedBy === null)
      .filter((drop) => (resourceType ? drop.resourceType === resourceType : true))
      .sort((a, b) => {
        const da = Math.abs(a.x - fromTile.x) + Math.abs(a.y - fromTile.y);
        const db = Math.abs(b.x - fromTile.x) + Math.abs(b.y - fromTile.y);
        return da - db;
      });
    const picked = candidates[0];
    if (!picked) {
      return null;
    }
    picked.claimedBy = villagerId;
    return { ...picked };
  }

  public releaseClaim(dropId: string, villagerId: string): void {
    const drop = this.drops.get(dropId);
    if (!drop) {
      return;
    }
    if (drop.claimedBy !== villagerId) {
      return;
    }
    drop.claimedBy = null;
  }

  public pickUp(dropId: string, villagerId: string): ResourceDrop | null {
    const drop = this.drops.get(dropId);
    if (!drop) {
      return null;
    }
    if (drop.claimedBy !== null && drop.claimedBy !== villagerId) {
      return null;
    }
    this.drops.delete(dropId);
    this.dropSprites.get(dropId)?.destroy();
    this.dropSprites.delete(dropId);
    return { ...drop, claimedBy: villagerId };
  }

  public releaseExpiredDrops(currentDay: number): Partial<Record<'wood' | 'stone', number>> {
    const reclaimed: Partial<Record<'wood' | 'stone', number>> = {};
    for (const drop of [...this.drops.values()]) {
      if (drop.claimedBy !== null) {
        continue;
      }
      if (currentDay - drop.createdDay < 10) {
        continue;
      }
      const amount = Math.max(1, Math.floor(drop.amount * 0.5));
      reclaimed[drop.resourceType] = (reclaimed[drop.resourceType] ?? 0) + amount;
      this.dropSprites.get(drop.id)?.destroy();
      this.dropSprites.delete(drop.id);
      this.drops.delete(drop.id);
    }
    return reclaimed;
  }

  public getDrop(dropId: string): ResourceDrop | null {
    const drop = this.drops.get(dropId);
    return drop ? { ...drop } : null;
  }

  private renderDrop(dropId: string): void {
    const drop = this.drops.get(dropId);
    if (!drop) {
      return;
    }
    this.dropSprites.get(dropId)?.destroy();
    const key = drop.resourceType === 'wood' ? 'resource_drop_wood' : 'resource_drop_stone';
    const world = gridToWorld(drop.x, drop.y, this.tileSize);
    const sprite = this.scene.add
      .image(world.x + this.tileSize * 0.5, world.y + this.tileSize * 0.72, key)
      .setOrigin(0.5, 0.8)
      .setDepth(0.72);
    const scale = 0.8 + Math.min(0.6, drop.amount / 8);
    sprite.setScale(scale);
    this.dropSprites.set(dropId, sprite);
  }

  private extractIdNumber(id: string): number {
    const match = id.match(/(\d+)$/);
    return match ? Number(match[1]) : 0;
  }
}
