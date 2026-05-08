import type { HarvestableData } from '../types/game';

const woodNode = (hp: number, yieldAmount: number): HarvestableData => ({
  resourceType: 'wood',
  hp,
  maxHp: hp,
  yield: yieldAmount,
});

const stoneNode = (hp: number, yieldAmount: number): HarvestableData => ({
  resourceType: 'stone',
  hp,
  maxHp: hp,
  yield: yieldAmount,
});

export const HARVESTABLE_BY_FOLIAGE_ID: Record<string, HarvestableData> = {
  tree_pine_small: woodNode(2, 2),
  tree_pine_medium: woodNode(3, 3),
  tree_pine_large: woodNode(4, 4),
  tree_pine_wide: woodNode(4, 4),
  tree_oak_small: woodNode(3, 3),
  tree_round_medium: woodNode(4, 4),
  stone_deposit_small: stoneNode(3, 3),
  stone_deposit_large: stoneNode(5, 5),
};

export const TREE_FOLIAGE_IDS = [
  'tree_pine_small',
  'tree_pine_medium',
  'tree_pine_large',
  'tree_pine_wide',
  'tree_oak_small',
  'tree_round_medium',
] as const;

export const STONE_FOLIAGE_IDS = ['stone_deposit_small', 'stone_deposit_large'] as const;
