import Phaser from 'phaser';
import { createGameConfig } from './game/config';
import './ui/styles.css';

const gameParent = document.querySelector<HTMLDivElement>('#game-root');

if (!gameParent) {
  throw new Error('Missing #game-root container');
}

const config = createGameConfig(gameParent);

new Phaser.Game(config);
