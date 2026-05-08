import type { Resources, VillageState } from '../types/game';

export const INITIAL_RESOURCES: Resources = {
  wood: 30,
  stone: 20,
  food: 20,
  tools: 3,
  weapons: 0,
};

export const INITIAL_VILLAGE: VillageState = {
  population: 3,
  morale: 70,
  housing: 5,
  foodNeed: 6,
  toolsNeed: 1,
  weaponsNeed: 1,
};
