import type Phaser from 'phaser';
import type { VillagerDirection, VillagerState } from '../types/game';

export interface Villager {
  id: string;
  paletteKey: string;
  homeBuildingId: string | null;
  workBuildingId: string | null;
  state: VillagerState;
  direction: VillagerDirection;
  worldX: number;
  worldY: number;
  path: { x: number; y: number }[];
  pathTargetIndex: number;
  workTimerMs: number;
  idleTimerMs: number;
  sprite: Phaser.GameObjects.Sprite;
  walkAnimKey: string;
  idleAnimKey: string;
}
