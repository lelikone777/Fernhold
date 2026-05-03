import type { Resources, VillageState } from '../types/game';

export const INITIAL_RESOURCES: Resources = {
  wood: 24,
  stone: 16,
  food: 14,
  tools: 0,
  weapons: 0,
};

export const INITIAL_VILLAGE: VillageState = {
  population: 2,
  morale: 55,
  housing: 2,
  foodNeed: 4,
  toolsNeed: 1,
  weaponsNeed: 1,
};
