import type Phaser from 'phaser';
import type {
  ResourceType,
  VillagerDirection,
  VillagerExperience,
  VillagerRole,
  VillagerState,
} from '../types/game';

export interface Villager {
  id: string;
  paletteKey: string;
  homeBuildingId: string | null;
  workBuildingId: string | null;
  role: VillagerRole;
  state: VillagerState;
  direction: VillagerDirection;
  worldX: number;
  worldY: number;
  path: { x: number; y: number }[];
  pathTargetIndex: number;
  workTimerMs: number;
  idleTimerMs: number;
  targetNodeKey: string | null;
  pendingToolResource: ResourceType | null;
  pendingToolBreakChance: number;
  pendingToolMode: 'harvest' | 'work' | 'build' | null;
  carryingResource: ResourceType | null;
  carryingAmount: number;
  deliverToBuildingId: string | null;
  experience: VillagerExperience;
  promotedToWorker: boolean;
  promotedToBuilder: boolean;
  sprite: Phaser.GameObjects.Sprite;
  walkAnimKey: string;
  idleAnimKey: string;
}
