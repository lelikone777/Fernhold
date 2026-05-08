import { BUILDING_DEFINITIONS } from '../data/buildings';
import type { BuildingType, DayReport, PlacedBuilding, Resources, VillageState } from '../types/game';

interface DayResult {
  resources: Resources;
  village: VillageState;
  report: DayReport;
}

const countBuildings = (buildings: PlacedBuilding[]): Record<BuildingType, number> => {
  const counts = {} as Record<BuildingType, number>;
  for (const building of buildings) {
    if (building.construction && building.construction.stage !== 'complete') {
      continue;
    }
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

const sum5 = (
  counts: Partial<Record<BuildingType, number>>,
  a: BuildingType,
  b: BuildingType,
  c: BuildingType,
  d: BuildingType,
  e: BuildingType,
): number => (counts[a] ?? 0) + (counts[b] ?? 0) + (counts[c] ?? 0) + (counts[d] ?? 0) + (counts[e] ?? 0);

const computeHousing = (counts: Partial<Record<BuildingType, number>>): number =>
  2 +
  (counts.storage_level_1 ?? 0) * 2 +
  (counts.storage_level_2 ?? 0) * 4 +
  (counts.storage_level_3 ?? 0) * 6 +
  (counts.storage_level_4 ?? 0) * 8 +
  (counts.storage_level_5 ?? 0) * 10 +
  (counts.house_level_1 ?? 0) * 2 +
  (counts.house_level_2 ?? 0) * 4 +
  (counts.house_level_3 ?? 0) * 6 +
  (counts.house_level_4 ?? 0) * 8 +
  (counts.house_level_5 ?? 0) * 10 +
  (counts.farmhouse ?? 0) * 1 +
  (counts.town_hall ?? 0) * 2 +
  (counts.tavern_level_1 ?? 0) * 1 +
  (counts.tavern_level_2 ?? 0) * 1 +
  (counts.tavern_level_3 ?? 0) * 1;

const computeNeeds = (population: number): Pick<VillageState, 'foodNeed' | 'toolsNeed' | 'weaponsNeed'> => ({
  foodNeed: population * 2,
  toolsNeed: Math.max(1, Math.ceil(population / 3)),
  weaponsNeed: population > 4 ? Math.ceil(population / 4) : 0,
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

  public processDay(
    day: number,
    resources: Resources,
    buildings: PlacedBuilding[],
    village: VillageState,
    workerCounts: ReadonlyMap<string, number>,
    workerEfficiencyByBuilding?: ReadonlyMap<string, number>,
  ): DayResult {
    const nextResources = cloneResources(resources);
    const produced: Partial<Resources> = {};
    const consumed: Partial<Resources> = {};
    const notes: string[] = [];
    const counts = countBuildings(buildings);
    const housing = computeHousing(counts);
    const needsBefore = computeNeeds(village.population);

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

    let totalWorkerSlots = 0;
    let totalAssigned = 0;

    for (const building of buildings) {
      if (building.construction && building.construction.stage !== 'complete') {
        continue;
      }
      const def = BUILDING_DEFINITIONS[building.type];
      const prod = def.production;
      if (!prod) continue;

      const slots = prod.workerSlots;
      if (slots <= 0) {
        if (prod.moraleBonus) {
          village.morale += prod.moraleBonus;
        }
        continue;
      }

      totalWorkerSlots += slots;
      const assigned = workerCounts.get(building.id) ?? 0;
      totalAssigned += Math.min(assigned, slots);
      const staffRatio = Math.min(assigned / slots, 1);

      if (staffRatio <= 0) continue;

      if (prod.consumes) {
        let canProduce = true;
        for (const [res, amount] of Object.entries(prod.consumes) as [keyof Resources, number][]) {
          if (nextResources[res] < amount) {
            canProduce = false;
            break;
          }
        }
        if (!canProduce) continue;

        for (const [res, amount] of Object.entries(prod.consumes) as [keyof Resources, number][]) {
          addConsumed(res, amount);
        }
      }

      if (prod.produces) {
        const efficiencyBonus = workerEfficiencyByBuilding?.get(building.id) ?? 1;
        for (const [res, baseAmount] of Object.entries(prod.produces) as [keyof Resources, number][]) {
          const amount = Math.floor(baseAmount * staffRatio * productivity * efficiencyBonus);
          if (amount > 0) addProduced(res, amount);
        }
      }

      if (prod.moraleBonus && staffRatio > 0) {
        village.morale += Math.floor(prod.moraleBonus * staffRatio);
      }
    }

    const idleVillagers = Math.max(0, village.population - totalAssigned);
    if (idleVillagers > 0) {
      addProduced('food', idleVillagers);
      notes.push(`${idleVillagers} idle ${idleVillagers === 1 ? 'villager gathers' : 'villagers gather'} food.`);
    }

    const barnCount = sum5(counts, 'barn_level_1', 'barn_level_2', 'barn_level_3', 'barn_level_4', 'barn_level_5');
    const barnBoost = Math.min(barnCount, counts.farmhouse ?? 0) * 2;
    if (barnBoost > 0) {
      addProduced('food', barnBoost);
      notes.push('Barn storage reduced spoilage.');
    }

    if (totalWorkerSlots > 0 && totalAssigned < totalWorkerSlots) {
      const shortage = totalWorkerSlots - totalAssigned;
      notes.push(`Worker shortage: ${shortage} unfilled ${shortage === 1 ? 'slot' : 'slots'}.`);
    }

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
