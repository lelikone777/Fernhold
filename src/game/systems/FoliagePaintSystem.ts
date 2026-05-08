import type Phaser from 'phaser';
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
      this.foliageObjects.set(key, item);
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
    const foliage: PlacedFoliage = {
      id: `${foliageId}_${x}_${y}`,
      foliageId: definition.id,
      x,
      y,
    };
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
    return [...this.foliageObjects.values()];
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
  }

  private toGridKey(x: number, y: number): string {
    return `${x}:${y}`;
  }
}
