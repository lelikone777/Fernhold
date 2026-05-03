import type { BuildingType, DayReport, PlacedBuilding, Resources, VillageState } from '../types/game';

interface DayResult {
  resources: Resources;
  village: VillageState;
  report: DayReport;
}

const countBuildings = (buildings: PlacedBuilding[]): Record<BuildingType, number> => {
  const counts = {} as Record<BuildingType, number>;
  for (const building of buildings) {
    counts[building.type] = (counts[building.type] ?? 0) + 1;
  }
  return counts;
};

const cloneResources = (resources: Resources): Resources => ({ ...resources });

const addResource = (store: Partial<Resources>, key: keyof Resources, value: number): void => {
  if (value <= 0) {
    return;
  }
  store[key] = (store[key] ?? 0) + value;
};

const sum3 = (
  counts: Partial<Record<BuildingType, number>>,
  a: BuildingType,
  b: BuildingType,
  c: BuildingType,
): number => (counts[a] ?? 0) + (counts[b] ?? 0) + (counts[c] ?? 0);

const computeHousing = (counts: Partial<Record<BuildingType, number>>): number =>
  2 +
  (counts.storage_level_1 ?? 0) * 2 +
  (counts.storage_level_2 ?? 0) * 4 +
  (counts.storage_level_3 ?? 0) * 6 +
  (counts.house_level_1 ?? 0) * 2 +
  (counts.house_level_2 ?? 0) * 4 +
  (counts.house_level_3 ?? 0) * 6 +
  (counts.house_level_4 ?? 0) * 8 +
  (counts.house_level_5 ?? 0) * 10 +
  (counts.farmhouse ?? 0) * 1 +
  (counts.town_hall ?? 0) * 2 +
  (sum3(counts, 'tavern_level_1', 'tavern_level_2', 'tavern_level_3')) * 1;

const computeNeeds = (population: number): Pick<VillageState, 'foodNeed' | 'toolsNeed' | 'weaponsNeed'> => ({
  foodNeed: population * 2,
  toolsNeed: Math.max(1, Math.ceil(population / 3)),
  weaponsNeed: Math.max(1, Math.ceil(population / 4)),
});

export class EconomySystem {
  public syncVillage(buildings: PlacedBuilding[], village: VillageState): VillageState {
    const counts = countBuildings(buildings);
    const housing = computeHousing(counts);
    const needs = computeNeeds(village.population);
    return {
      ...village,
      housing,
      foodNeed: needs.foodNeed,
      toolsNeed: needs.toolsNeed,
      weaponsNeed: needs.weaponsNeed,
    };
  }

  public processDay(day: number, resources: Resources, buildings: PlacedBuilding[], village: VillageState): DayResult {
    const nextResources = cloneResources(resources);
    const produced: Partial<Resources> = {};
    const consumed: Partial<Resources> = {};
    const notes: string[] = [];
    const counts = countBuildings(buildings);
    const housing = computeHousing(counts);
    const needsBefore = computeNeeds(village.population);
    const lumberMillCount = sum3(counts, 'lumber_mill_level_1', 'lumber_mill_level_2', 'lumber_mill_level_3');
    const barnCount = sum3(counts, 'barn_level_1', 'barn_level_2', 'barn_level_3');
    const blacksmithCount = sum3(counts, 'blacksmith_level_1', 'blacksmith_level_2', 'blacksmith_level_3');
    const tavernCount = sum3(counts, 'tavern_level_1', 'tavern_level_2', 'tavern_level_3');

    const toolPenalty = nextResources.tools < needsBefore.toolsNeed ? 0.75 : 1;
    const weaponPenalty = nextResources.weapons < needsBefore.weaponsNeed ? 0.9 : 1;
    const productivity = Math.max(0.5, toolPenalty * weaponPenalty);

    const addProduced = (key: keyof Resources, value: number): void => {
      nextResources[key] += value;
      addResource(produced, key, value);
    };

    const addConsumed = (key: keyof Resources, value: number): void => {
      nextResources[key] = Math.max(0, nextResources[key] - value);
      addResource(consumed, key, value);
    };

    addProduced('wood', Math.floor(lumberMillCount * 6 * productivity));
    addProduced('stone', Math.floor((counts.mason_yard ?? 0) * 5 * productivity));
    addProduced('food', Math.floor((counts.farmhouse ?? 0) * 4 * productivity));
    addProduced('food', Math.floor((counts.fisher_hut ?? 0) * 3 * productivity));
    addProduced('food', Math.floor((counts.herb_hut ?? 0) * 2 * productivity));

    const barnBoost = Math.min(barnCount, counts.farmhouse ?? 0) * 2;
    if (barnBoost > 0) {
      addProduced('food', barnBoost);
      notes.push('Barn storage reduced spoilage.');
    }

    const bakeryCount = counts.bakery ?? 0;
    for (let index = 0; index < bakeryCount; index += 1) {
      if (nextResources.food >= 2 && nextResources.wood >= 1) {
        addConsumed('food', 2);
        addConsumed('wood', 1);
        addProduced('food', 4);
      }
    }

    const workshopCount = counts.workshop ?? 0;
    for (let index = 0; index < workshopCount; index += 1) {
      if (nextResources.wood >= 2 && nextResources.stone >= 1) {
        addConsumed('wood', 2);
        addConsumed('stone', 1);
        addProduced('tools', 1);
      }
    }

    for (let index = 0; index < blacksmithCount; index += 1) {
      if (nextResources.wood >= 1 && nextResources.stone >= 2 && nextResources.tools >= 1) {
        addConsumed('wood', 1);
        addConsumed('stone', 2);
        addProduced('weapons', 1);
      }
    }

    const moraleBonus =
      (counts.well ?? 0) +
      tavernCount * 2 +
      (counts.shrine ?? 0) +
      (counts.market_stall ?? 0);

    if (nextResources.food >= needsBefore.foodNeed) {
      addConsumed('food', needsBefore.foodNeed);
    } else {
      const deficit = needsBefore.foodNeed - nextResources.food;
      addConsumed('food', nextResources.food);
      notes.push(`Food shortage: -${deficit}`);
      village.morale -= deficit * 6;
    }

    if (nextResources.tools < needsBefore.toolsNeed) {
      village.morale -= 4;
      notes.push('Tool shortage slowed production.');
    } else {
      village.morale += 1;
    }

    if (nextResources.weapons < needsBefore.weaponsNeed) {
      village.morale -= 3;
      notes.push('Village feels unprotected.');
    } else if ((counts.watchtower ?? 0) > 0) {
      village.morale += 2;
      notes.push('Watchtower security is stable.');
    }

    if (housing < village.population) {
      village.morale -= 5;
      notes.push('Not enough housing for current population.');
    }

    village.morale += moraleBonus;
    village.morale = Math.max(0, Math.min(100, village.morale));

    let nextPopulation = village.population;
    if (village.morale >= 75 && housing > nextPopulation && nextResources.food >= needsBefore.foodNeed * 2 && day % 3 === 0) {
      nextPopulation += 1;
      notes.push('A new villager joined Fernhold.');
    } else if (village.morale <= 15 && nextPopulation > 1) {
      nextPopulation -= 1;
      notes.push('A villager left the settlement.');
    }

    const nextNeeds = computeNeeds(nextPopulation);
    const nextVillage: VillageState = {
      population: nextPopulation,
      morale: village.morale,
      housing,
      foodNeed: nextNeeds.foodNeed,
      toolsNeed: nextNeeds.toolsNeed,
      weaponsNeed: nextNeeds.weaponsNeed,
    };

    return {
      resources: nextResources,
      village: nextVillage,
      report: {
        day,
        produced,
        consumed,
        notes,
      },
    };
  }
}
