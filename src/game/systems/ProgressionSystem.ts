import { BUILDING_DEFINITIONS } from '../data/buildings';
import type {
  BuildingAvailability,
  BuildingDefinition,
  BuildingType,
  PlacedBuilding,
  Resources,
  VillageState,
} from '../types/game';

const countBuildings = (buildings: PlacedBuilding[]): Partial<Record<BuildingType, number>> => {
  const counts: Partial<Record<BuildingType, number>> = {};
  for (const building of buildings) {
    counts[building.type] = (counts[building.type] ?? 0) + 1;
  }
  return counts;
};

const hasBuildingRequirements = (
  counts: Partial<Record<BuildingType, number>>,
  requirements: Partial<Record<BuildingType, number>>,
): string | null => {
  for (const [buildingType, amount] of Object.entries(requirements) as [BuildingType, number][]) {
    const current = counts[buildingType] ?? 0;
    if (current < amount) {
      const name = BUILDING_DEFINITIONS[buildingType].name;
      return `Requires ${amount}x ${name}`;
    }
  }
  return null;
};

const hasResourceRequirements = (
  resources: Resources,
  requirements: Partial<Resources>,
): string | null => {
  for (const [resourceKey, amount] of Object.entries(requirements) as [keyof Resources, number][]) {
    if (resources[resourceKey] < amount) {
      const label = resourceKey.charAt(0).toUpperCase() + resourceKey.slice(1);
      return `Needs ${amount} ${label}`;
    }
  }
  return null;
};

export class ProgressionSystem {
  public getAvailabilityMap(
    day: number,
    resources: Resources,
    village: VillageState,
    buildings: PlacedBuilding[],
  ): Record<BuildingType, BuildingAvailability> {
    const counts = countBuildings(buildings);
    const result = {} as Record<BuildingType, BuildingAvailability>;

    for (const definition of Object.values(BUILDING_DEFINITIONS)) {
      result[definition.type] = this.evaluate(definition, day, resources, village, counts);
    }

    return result;
  }

  public isUnlocked(
    type: BuildingType,
    day: number,
    resources: Resources,
    village: VillageState,
    buildings: PlacedBuilding[],
  ): BuildingAvailability {
    const counts = countBuildings(buildings);
    return this.evaluate(BUILDING_DEFINITIONS[type], day, resources, village, counts);
  }

  private evaluate(
    definition: BuildingDefinition,
    day: number,
    resources: Resources,
    village: VillageState,
    counts: Partial<Record<BuildingType, number>>,
  ): BuildingAvailability {
    const rule = definition.unlock;
    if (!rule) {
      return { unlocked: true, reason: null };
    }

    if (rule.minDay && day < rule.minDay) {
      return { unlocked: false, reason: `Unlocks on day ${rule.minDay}` };
    }
    if (rule.minPopulation && village.population < rule.minPopulation) {
      return { unlocked: false, reason: `Needs population ${rule.minPopulation}` };
    }
    if (rule.minMorale && village.morale < rule.minMorale) {
      return { unlocked: false, reason: `Needs morale ${rule.minMorale}` };
    }
    if (rule.requiresBuildings) {
      const reason = hasBuildingRequirements(counts, rule.requiresBuildings);
      if (reason) {
        return { unlocked: false, reason };
      }
    }
    if (rule.requiresResources) {
      const reason = hasResourceRequirements(resources, rule.requiresResources);
      if (reason) {
        return { unlocked: false, reason };
      }
    }

    return { unlocked: true, reason: null };
  }
}
