import type Phaser from 'phaser';
import { HARVESTABLE_BY_FOLIAGE_ID } from '../data/naturalResources';
import type { DevFoliageDefinition, PlacedFoliage } from '../types/game';
import { gridToWorld } from '../utils/grid';

export class FoliagePaintSystem {
  private readonly scene: Phaser.Scene;
  private readonly tileSize: number;
  private readonly foliageDefinitions: Map<string, DevFoliageDefinition>;
  private readonly foliageSprites = new Map<string, Phaser.GameObjects.Image>();
  private readonly foliageObjects = new Map<string, PlacedFoliage>();

  constructor(
    scene: Phaser.Scene,
    tileSize: number,
    definitions: DevFoliageDefinition[],
  ) {
    this.scene = scene;
    this.tileSize = tileSize;
    this.foliageDefinitions = new Map(definitions.map((item) => [item.id, item]));
  }

  public load(items: PlacedFoliage[]): void {
    this.clear();
    for (const item of items) {
      const key = this.toGridKey(item.x, item.y);
      this.foliageObjects.set(key, this.withHarvestableData(item));
    }
  }

  public renderLayer(): void {
    for (const foliage of this.foliageObjects.values()) {
      this.renderFoliageObject(foliage);
    }
  }

  public place(foliageId: string, x: number, y: number): boolean {
    const definition = this.foliageDefinitions.get(foliageId);
    if (!definition) {
      return false;
    }
    const key = this.toGridKey(x, y);
    const foliage = this.withHarvestableData({
      id: `${foliageId}_${x}_${y}`,
      foliageId: definition.id,
      x,
      y,
    });
    this.foliageObjects.set(key, foliage);
    this.renderFoliageObject(foliage);
    return true;
  }

  public removeAt(x: number, y: number): void {
    const key = this.toGridKey(x, y);
    this.foliageObjects.delete(key);
    this.foliageSprites.get(key)?.destroy();
    this.foliageSprites.delete(key);
  }

  public clear(): void {
    for (const sprite of this.foliageSprites.values()) {
      sprite.destroy();
    }
    this.foliageSprites.clear();
    this.foliageObjects.clear();
  }

  public serialize(): PlacedFoliage[] {
    return [...this.foliageObjects.values()].map((entry) => ({ ...entry }));
  }

  public getHarvestableAt(x: number, y: number): PlacedFoliage | null {
    const item = this.foliageObjects.get(this.toGridKey(x, y));
    if (!item?.harvestable) {
      return null;
    }
    return { ...item, harvestable: { ...item.harvestable } };
  }

  public findNearestHarvestable(
    fromX: number,
    fromY: number,
    resourceType: 'wood' | 'stone',
    excludeSet: Set<string>,
  ): PlacedFoliage | null {
    const entries = [...this.foliageObjects.values()]
      .filter((entry) => entry.harvestable?.resourceType === resourceType)
      .filter((entry) => (entry.harvestable?.hp ?? 0) > 0)
      .filter((entry) => !excludeSet.has(this.toGridKey(entry.x, entry.y)))
      .sort((a, b) => {
        const da = Math.abs(a.x - fromX) + Math.abs(a.y - fromY);
        const db = Math.abs(b.x - fromX) + Math.abs(b.y - fromY);
        return da - db;
      });
    const picked = entries[0];
    if (!picked) {
      return null;
    }
    return { ...picked, harvestable: picked.harvestable ? { ...picked.harvestable } : undefined };
  }

  public damageAt(
    x: number,
    y: number,
    amount: number,
  ): { destroyed: boolean; drop?: { resourceType: 'wood' | 'stone'; amount: number } } {
    const key = this.toGridKey(x, y);
    const entry = this.foliageObjects.get(key);
    if (!entry?.harvestable) {
      return { destroyed: false };
    }
    entry.harvestable.hp = Math.max(0, entry.harvestable.hp - amount);
    this.updateDamageVisual(entry);

    if (entry.harvestable.hp > 0) {
      return { destroyed: false };
    }

    const drop = {
      resourceType: entry.harvestable.resourceType,
      amount: entry.harvestable.yield,
    };
    const sprite = this.foliageSprites.get(key);
    if (sprite) {
      this.scene.tweens.add({
        targets: sprite,
        scaleX: 0,
        scaleY: 0,
        angle: 8,
        duration: 280,
        ease: 'Quad.easeIn',
        onComplete: () => sprite.destroy(),
      });
    }
    this.foliageSprites.delete(key);
    this.foliageObjects.delete(key);
    return { destroyed: true, drop };
  }

  public getAllPositionsFor(foliageIds: readonly string[]): { x: number; y: number }[] {
    const set = new Set(foliageIds);
    return [...this.foliageObjects.values()]
      .filter((entry) => set.has(entry.foliageId))
      .map((entry) => ({ x: entry.x, y: entry.y }));
  }

  private renderFoliageObject(foliage: PlacedFoliage): void {
    const definition = this.foliageDefinitions.get(foliage.foliageId);
    if (!definition) {
      return;
    }
    const key = this.toGridKey(foliage.x, foliage.y);
    this.foliageSprites.get(key)?.destroy();
    const world = gridToWorld(foliage.x, foliage.y, this.tileSize);
    const sprite = this.scene.add
      .image(world.x + this.tileSize * 0.5, world.y + this.tileSize, definition.textureKey)
      .setOrigin(0.5, 1);
    sprite.setDepth(0.75);
    this.foliageSprites.set(key, sprite);
    this.attachSway(sprite, foliage.x, foliage.y);
    this.updateDamageVisual(foliage);
  }

  private updateDamageVisual(foliage: PlacedFoliage): void {
    const sprite = this.foliageSprites.get(this.toGridKey(foliage.x, foliage.y));
    if (!sprite) {
      return;
    }
    if (!foliage.harvestable) {
      sprite.clearTint();
      return;
    }
    const ratio = foliage.harvestable.maxHp > 0 ? foliage.harvestable.hp / foliage.harvestable.maxHp : 1;
    if (ratio >= 0.66) {
      sprite.clearTint();
      return;
    }
    if (ratio >= 0.33) {
      sprite.setTint(0xd4c48f);
      return;
    }
    sprite.setTint(0xb88e74);
  }

  private withHarvestableData(item: PlacedFoliage): PlacedFoliage {
    const definition = HARVESTABLE_BY_FOLIAGE_ID[item.foliageId];
    if (item.harvestable) {
      return {
        ...item,
        harvestable: {
          ...item.harvestable,
          maxHp: item.harvestable.maxHp || item.harvestable.hp,
          yield: item.harvestable.yield || item.harvestable.maxHp || item.harvestable.hp,
        },
      };
    }
    if (!definition) {
      return { ...item };
    }
    return {
      ...item,
      harvestable: { ...definition },
    };
  }

  private attachSway(
    sprite: Phaser.GameObjects.Image,
    gridX: number,
    gridY: number,
  ): void {
    const seed = (gridX * 73856093) ^ (gridY * 19349663);
    const phase = Math.abs(seed % 1500);
    const duration = 1700 + (Math.abs(seed) % 800);
    this.scene.tweens.add({
      targets: sprite,
      angle: { from: -1.4, to: 1.4 },
      duration,
      delay: phase,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private toGridKey(x: number, y: number): string {
    return `${x}:${y}`;
  }
}
