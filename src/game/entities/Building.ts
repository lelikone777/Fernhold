import Phaser from 'phaser';
import type { BuildingDefinition, PlacedBuilding } from '../types/game';
import { gridToWorld } from '../utils/grid';

const PRODUCTION_TYPES = new Set([
  'lumber_mill_level_1',
  'lumber_mill_level_2',
  'lumber_mill_level_3',
  'blacksmith_level_1',
  'blacksmith_level_2',
  'blacksmith_level_3',
  'bakery',
  'workshop',
  'mason_yard',
]);

const LIT_AT_NIGHT_TYPES = new Set([
  'house_level_1',
  'house_level_2',
  'house_level_3',
  'house_level_4',
  'house_level_5',
  'farmhouse',
  'tavern_level_1',
  'tavern_level_2',
  'tavern_level_3',
  'town_hall',
  'bakery',
  'blacksmith_level_1',
  'blacksmith_level_2',
  'blacksmith_level_3',
  'shrine',
  'watchtower',
]);

export interface BuildingViewMeta {
  light?: Phaser.GameObjects.Ellipse;
}

const VIEW_META = new WeakMap<Phaser.GameObjects.Container, BuildingViewMeta>();

export const getBuildingViewMeta = (
  view: Phaser.GameObjects.Container,
): BuildingViewMeta | undefined => VIEW_META.get(view);

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

  if (PRODUCTION_TYPES.has(definition.type) && scene.textures.exists('smoke_particle')) {
    const smoke = scene.add.particles(width * 0.5, height * 0.05, 'smoke_particle', {
      lifespan: { min: 1100, max: 1700 },
      speedY: { min: -22, max: -10 },
      speedX: { min: -6, max: 6 },
      scale: { start: 0.35, end: 1.1 },
      alpha: { start: 0.42, end: 0 },
      frequency: 380,
      quantity: 1,
      tint: definition.type.startsWith('blacksmith') ? [0x6a665e, 0x4a4640] : [0xd9d4c4, 0xa9a399],
    });
    smoke.setDepth(0.1);
    children.push(smoke);
  }

  const meta: BuildingViewMeta = {};
  if (LIT_AT_NIGHT_TYPES.has(definition.type)) {
    const lightColor = definition.type.startsWith('blacksmith')
      ? 0xff7a3a
      : definition.type === 'shrine'
        ? 0xc9b8ff
        : 0xffd089;
    const light = scene.add.ellipse(width * 0.5, height * 0.55, width * 1.4, height * 1.1, lightColor, 0);
    light.setBlendMode(Phaser.BlendModes.ADD);
    children.unshift(light);
    meta.light = light;
  }

  const container = scene.add.container(worldPos.x, worldPos.y, children).setDepth(0.6);
  if (meta.light) {
    VIEW_META.set(container, meta);
  }
  return container;
};

export const playPlaceTween = (
  scene: Phaser.Scene,
  view: Phaser.GameObjects.Container,
): void => {
  view.setScale(0.4);
  view.setAlpha(0);
  scene.tweens.add({
    targets: view,
    scale: 1,
    alpha: 1,
    ease: 'Back.easeOut',
    duration: 320,
  });
};

export const playDemolishTween = (
  scene: Phaser.Scene,
  view: Phaser.GameObjects.Container,
  onComplete: () => void,
): void => {
  scene.tweens.add({
    targets: view,
    scale: 0.6,
    alpha: 0,
    y: view.y + 8,
    ease: 'Quad.easeIn',
    duration: 220,
    onComplete,
  });
};
