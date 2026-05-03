import Phaser from 'phaser';
import type { BuildingDefinition, PlacedBuilding } from '../types/game';
import { gridToWorld } from '../utils/grid';

export const createBuildingView = (
  scene: Phaser.Scene,
  placed: PlacedBuilding,
  definition: BuildingDefinition,
  tileSize: number,
): Phaser.GameObjects.Container => {
  const worldPos = gridToWorld(placed.x, placed.y, tileSize);
  const width = definition.size.w * tileSize;
  const height = definition.size.h * tileSize;
  const visualWidth = Math.max(56, width * 2.34);
  const visualHeight = Math.max(40, height * 2.5);

  const shadow = scene.add.rectangle(width * 0.5, height - 4, width * 0.78, 6, 0x000000, 0.18).setOrigin(0.5);
  const base = scene.add.rectangle(0, 0, width, height, 0x000000, 0.08).setOrigin(0);
  base.setStrokeStyle(1, 0x2a221a, 0.3);

  const iconKey = `building_sprite_${definition.type}`;

  const children: Phaser.GameObjects.GameObject[] = [shadow, base];
  if (scene.textures.exists(iconKey)) {
    const sprite = scene.add.image(width * 0.5, height + 2, iconKey);
    sprite.setDisplaySize(visualWidth, visualHeight);
    sprite.setOrigin(0.5, 1);
    children.push(sprite);
  } else {
    const fallback = scene.add.rectangle(width * 0.5, height * 0.5, width * 0.9, height * 0.9, definition.color, 0.88);
    fallback.setStrokeStyle(1, 0x2a221a, 0.9);
    children.push(fallback);
  }

  return scene.add.container(worldPos.x, worldPos.y, children).setDepth(0.6);
};
