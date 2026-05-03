import type { ResourceType } from '../types/game';

export interface ResourceNode {
  id: string;
  type: ResourceType;
  gridX: number;
  gridY: number;
  amount: number;
}
