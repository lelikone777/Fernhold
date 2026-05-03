import Phaser from 'phaser';
import { GAME_NAME } from './constants';
import { MAP_CONFIG } from './data/map';
import { BootScene } from './scenes/BootScene';
import { PreloadScene } from './scenes/PreloadScene';
import { UIScene } from './scenes/UIScene';
import { WorldScene } from './scenes/WorldScene';

export const createGameConfig = (parent: HTMLElement): Phaser.Types.Core.GameConfig => ({
  type: Phaser.AUTO,
  title: GAME_NAME,
  parent,
  backgroundColor: '#1d271d',
  pixelArt: true,
  antialias: false,
  scene: [BootScene, PreloadScene, WorldScene, UIScene],
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    min: {
      width: 320,
      height: 568,
    },
  },
  input: {
    activePointers: 3,
  },
  render: {
    roundPixels: true,
  },
  callbacks: {
    postBoot: (game) => {
      game.canvas.style.touchAction = 'none';
      game.canvas.setAttribute('aria-label', `${GAME_NAME} canvas`);
    },
  },
  disableContextMenu: true,
  banner: false,
  width: MAP_CONFIG.mapWidth * MAP_CONFIG.tileSize,
  height: MAP_CONFIG.mapHeight * MAP_CONFIG.tileSize,
});
