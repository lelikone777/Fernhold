import type Phaser from 'phaser';
import type { PlacedRoad, RoadType } from '../types/game';
import { gridToWorld } from '../utils/grid';

export class RoadPaintSystem {
  private readonly scene: Phaser.Scene;
  private readonly tileSize: number;
  private readonly mapWidth: number;
  private readonly mapHeight: number;
  private readonly roadSprites = new Map<string, Phaser.GameObjects.Container>();
  private readonly roads = new Map<string, PlacedRoad>();
  private lastPaintCell: { x: number; y: number } | null = null;

  constructor(scene: Phaser.Scene, tileSize: number, mapWidth: number, mapHeight: number) {
    this.scene = scene;
    this.tileSize = tileSize;
    this.mapWidth = mapWidth;
    this.mapHeight = mapHeight;
  }

  public load(roads: PlacedRoad[]): void {
    this.clear();
    for (const road of roads) {
      this.roads.set(this.toGridKey(road.x, road.y), road);
    }
  }

  public renderLayer(): void {
    for (const road of this.roads.values()) {
      this.renderRoadTile(road);
    }
  }

  public beginStroke(): void {
    this.lastPaintCell = null;
  }

  public paintSegment(x: number, y: number, roadId: RoadType): void {
    const put = (tileX: number, tileY: number): void => {
      if (tileX < 0 || tileY < 0 || tileX >= this.mapWidth || tileY >= this.mapHeight) {
        return;
      }
      const key = this.toGridKey(tileX, tileY);
      const road: PlacedRoad = {
        id: `${roadId}_${tileX}_${tileY}`,
        roadId,
        x: tileX,
        y: tileY,
      };
      this.roads.set(key, road);
      this.refreshRoadAt(tileX, tileY);
    };

    if (!this.lastPaintCell) {
      put(x, y);
      this.lastPaintCell = { x, y };
      return;
    }

    const from = this.lastPaintCell;
    const dx = x - from.x;
    const dy = y - from.y;
    if (dx !== 0 && dy !== 0) {
      put(x, y);
      this.lastPaintCell = { x, y };
      return;
    }

    const stepX = dx === 0 ? 0 : dx > 0 ? 1 : -1;
    const stepY = dy === 0 ? 0 : dy > 0 ? 1 : -1;
    let cx = from.x;
    let cy = from.y;
    while (cx !== x || cy !== y) {
      cx += stepX;
      cy += stepY;
      put(cx, cy);
    }
    this.lastPaintCell = { x, y };
  }

  public removeAt(x: number, y: number): void {
    const key = this.toGridKey(x, y);
    const road = this.roads.get(key);
    this.roads.delete(key);
    this.roadSprites.get(key)?.destroy();
    this.roadSprites.delete(key);
    if (road) {
      this.refreshAdjacentRoads(road.x, road.y);
    }
  }

  public clear(): void {
    for (const sprite of this.roadSprites.values()) {
      sprite.destroy();
    }
    this.roadSprites.clear();
    this.roads.clear();
    this.lastPaintCell = null;
  }

  public serialize(): PlacedRoad[] {
    return [...this.roads.values()];
  }

  private refreshRoadAt(x: number, y: number): void {
    const road = this.roads.get(this.toGridKey(x, y));
    if (road) {
      this.renderRoadTile(road);
    }
    this.refreshAdjacentRoads(x, y);
  }

  private refreshAdjacentRoads(x: number, y: number): void {
    for (const [dx, dy] of [
      [0, -1],
      [0, 1],
      [-1, 0],
      [1, 0],
    ]) {
      const neighbor = this.roads.get(this.toGridKey(x + dx, y + dy));
      if (neighbor) {
        this.renderRoadTile(neighbor);
      }
    }
  }

  private renderRoadTile(road: PlacedRoad): void {
    const roadKey = this.toGridKey(road.x, road.y);
    this.roadSprites.get(roadKey)?.destroy();

    const neighbors = this.getRoadNeighbors(road.x, road.y, road.roadId);
    const textureKey = this.getRoadTextureKey(road.roadId);
    if (!textureKey) {
      return;
    }

    const world = gridToWorld(road.x, road.y, this.tileSize);
    const centerX = world.x + this.tileSize * 0.5;
    const centerY = world.y + this.tileSize * 0.5;
    const style = this.getRoadBaseStyle(road.roadId);

    const background = this.scene.add.graphics();
    const roadShape = this.scene.add.graphics();
    const maskShape = this.scene.add.graphics();

    background.fillStyle(style.shadow, 0.2);
    background.fillEllipse(centerX, centerY + 1, this.tileSize * 0.92, this.tileSize * 0.6);

    this.drawRoadShape(roadShape, world.x, world.y, neighbors, style.edge, style.innerWidth + 2, style.capInset + 1);
    this.drawRoadShape(roadShape, world.x, world.y, neighbors, style.base, style.innerWidth, style.capInset);
    this.drawRoadShape(maskShape, world.x, world.y, neighbors, 0xffffff, style.innerWidth + 1, style.capInset);
    maskShape.setVisible(false);

    const textureFrame = this.getRoadTextureOverlayFrame(neighbors);
    const children: Phaser.GameObjects.GameObject[] = [background, roadShape];
    if (textureFrame !== null) {
      const texture = this.scene.add.image(centerX, centerY, textureKey, textureFrame).setOrigin(0.5);
      texture.setDisplaySize(this.tileSize + 4, this.tileSize + 4);
      texture.setAlpha(0.55);
      texture.setMask(maskShape.createGeometryMask());
      children.push(texture);
    }
    children.push(maskShape);

    const container = this.scene.add.container(0, 0, children);
    container.setDepth(0.35);
    this.roadSprites.set(roadKey, container);
  }

  private getRoadNeighbors(x: number, y: number, roadId: string): Record<'up' | 'down' | 'left' | 'right', boolean> {
    return {
      up: this.roads.get(this.toGridKey(x, y - 1))?.roadId === roadId,
      down: this.roads.get(this.toGridKey(x, y + 1))?.roadId === roadId,
      left: this.roads.get(this.toGridKey(x - 1, y))?.roadId === roadId,
      right: this.roads.get(this.toGridKey(x + 1, y))?.roadId === roadId,
    };
  }

  private getRoadTextureKey(roadId: string): string | null {
    switch (roadId) {
      case 'dirt_path':
        return 'road_dirt_tiles_runtime';
      case 'stone_path':
        return 'road_stone_tiles_runtime';
      case 'cobble_path':
        return 'road_cobble_tiles_runtime';
      default:
        return null;
    }
  }

  private getRoadTextureOverlayFrame(
    neighbors: Record<'up' | 'down' | 'left' | 'right', boolean>,
  ): number | null {
    const U = neighbors.up ? 1 : 0;
    const R = neighbors.right ? 1 : 0;
    const D = neighbors.down ? 1 : 0;
    const L = neighbors.left ? 1 : 0;
    const mask = U | (R << 1) | (D << 2) | (L << 3);

    switch (mask) {
      case 0:
        return 0;
      case 1:
      case 4:
        return 2;
      case 2:
      case 8:
        return 1;
      case 5:
        return 2;
      case 10:
        return 1;
      case 3:
      case 6:
      case 12:
      case 9:
      case 7:
      case 14:
      case 13:
      case 11:
      case 15:
        return 12;
      default:
        return 12;
    }
  }

  private drawRoadShape(
    graphics: Phaser.GameObjects.Graphics,
    worldX: number,
    worldY: number,
    neighbors: Record<'up' | 'down' | 'left' | 'right', boolean>,
    color: number,
    width: number,
    capInset: number,
  ): void {
    const centerX = worldX + this.tileSize * 0.5;
    const centerY = worldY + this.tileSize * 0.5;
    const halfWidth = width * 0.5;
    const left = centerX - halfWidth;
    const top = centerY - halfWidth;
    const extendLeft = neighbors.left ? worldX - 1 : worldX + capInset;
    const extendRight = neighbors.right ? worldX + this.tileSize + 1 : worldX + this.tileSize - capInset;
    const extendUp = neighbors.up ? worldY - 1 : worldY + capInset;
    const extendDown = neighbors.down ? worldY + this.tileSize + 1 : worldY + this.tileSize - capInset;

    graphics.fillStyle(color, 1);
    graphics.fillRoundedRect(left, top, width, width, Math.max(2, width * 0.28));

    if (neighbors.up) {
      graphics.fillRect(left, extendUp, width, centerY - extendUp);
    }
    if (neighbors.down) {
      graphics.fillRect(left, centerY, width, extendDown - centerY);
    }
    if (neighbors.left) {
      graphics.fillRect(extendLeft, top, centerX - extendLeft, width);
    }
    if (neighbors.right) {
      graphics.fillRect(centerX, top, extendRight - centerX, width);
    }

    if (!neighbors.up && !neighbors.down && !neighbors.left && !neighbors.right) {
      graphics.fillCircle(centerX, centerY, halfWidth + 1);
    }
  }

  private getRoadBaseStyle(
    roadId: string,
  ): { base: number; edge: number; shadow: number; innerWidth: number; capInset: number } {
    switch (roadId) {
      case 'dirt_path':
        return { base: 0x8e6a43, edge: 0x6d4d2f, shadow: 0x2f2418, innerWidth: 10, capInset: 3 };
      case 'stone_path':
        return { base: 0x8f8d87, edge: 0x6b6a66, shadow: 0x2f2418, innerWidth: 10, capInset: 3 };
      case 'cobble_path':
        return { base: 0x9f9987, edge: 0x756f62, shadow: 0x2f2418, innerWidth: 10, capInset: 3 };
      default:
        return { base: 0x8f8d87, edge: 0x6b6a66, shadow: 0x2f2418, innerWidth: 10, capInset: 3 };
    }
  }

  private toGridKey(x: number, y: number): string {
    return `${x}:${y}`;
  }
}
