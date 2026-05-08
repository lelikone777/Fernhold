import { describe, expect, it } from 'vitest';
import { EconomySystem } from './EconomySystem';
import type { PlacedBuilding, Resources, VillageState } from '../types/game';

const makeBuilding = (id: string, type: PlacedBuilding['type'], x = 0, y = 0): PlacedBuilding => ({
  id,
  type,
  x,
  y,
});

const baseResources = (): Resources => ({
  wood: 50,
  stone: 50,
  food: 50,
  tools: 50,
  weapons: 50,
  grain: 50,
  flour: 50,
  coal: 50,
  iron_ore: 50,
  copper_ore: 50,
  tin_ore: 50,
  silver_ore: 50,
  gold_ore: 50,
  bronze_ingot: 50,
  iron_ingot: 50,
  silver_ingot: 50,
  gold_ingot: 50,
  livestock: 50,
  meat: 50,
  milk: 50,
  cheese: 50,
  fish: 50,
  smoked_fish: 50,
  vegetables: 50,
  pickaxe: 50,
  axe: 50,
  shovel: 50,
  knife: 50,
  hammer: 50,
});

const baseVillage = (): VillageState => ({
  population: 4,
  morale: 60,
  housing: 6,
  foodNeed: 8,
  toolsNeed: 2,
  weaponsNeed: 0,
});

const noWorkers = new Map<string, number>();

function workersFor(...entries: [string, number][]): ReadonlyMap<string, number> {
  return new Map(entries);
}

describe('EconomySystem.syncVillage', () => {
  it('recomputes housing from placed buildings', () => {
    const economy = new EconomySystem();
    const buildings = [
      makeBuilding('a', 'house_level_1'),
      makeBuilding('b', 'house_level_2'),
      makeBuilding('c', 'storage_level_1'),
    ];
    const village = economy.syncVillage(buildings, baseVillage());
    expect(village.housing).toBe(2 + 2 + 4 + 2);
  });

  it('scales food/tool/weapon needs with population', () => {
    const economy = new EconomySystem();
    const village = economy.syncVillage([], { ...baseVillage(), population: 9 });
    expect(village.foodNeed).toBe(18);
    expect(village.toolsNeed).toBe(3);
    expect(village.weaponsNeed).toBe(3);
  });

  it('sets weaponsNeed to 0 for small settlements', () => {
    const economy = new EconomySystem();
    const village = economy.syncVillage([], { ...baseVillage(), population: 4 });
    expect(village.weaponsNeed).toBe(0);
  });

  it('enables weaponsNeed when population exceeds 4', () => {
    const economy = new EconomySystem();
    const village = economy.syncVillage([], { ...baseVillage(), population: 5 });
    expect(village.weaponsNeed).toBe(2);
  });
});

describe('EconomySystem.processDay', () => {
  it('produces wood from lumber mills when staffed', () => {
    const economy = new EconomySystem();
    const buildings = [
      makeBuilding('lm', 'lumber_mill_level_1'),
      makeBuilding('lm2', 'lumber_mill_level_2'),
    ];
    const workers = workersFor(['lm', 2], ['lm2', 3]);
    const result = economy.processDay(2, baseResources(), buildings, baseVillage(), workers);
    expect(result.report.produced.wood).toBeGreaterThan(0);
    expect(result.resources.wood).toBeGreaterThan(baseResources().wood);
  });

  it('unstaffed buildings produce no building output', () => {
    const economy = new EconomySystem();
    const buildings = [makeBuilding('lm', 'lumber_mill_level_1')];
    const village = baseVillage();
    const result = economy.processDay(2, baseResources(), buildings, village, noWorkers);
    expect(result.report.produced.wood ?? 0).toBe(0);
  });

  it('scales production with partial staffing', () => {
    const economy = new EconomySystem();
    const buildings = [makeBuilding('lm', 'lumber_mill_level_1')];
    const full = economy.processDay(2, baseResources(), buildings, baseVillage(), workersFor(['lm', 2]));
    const half = economy.processDay(2, baseResources(), buildings, baseVillage(), workersFor(['lm', 1]));
    expect(full.report.produced.wood ?? 0).toBeGreaterThan(half.report.produced.wood ?? 0);
  });

  it('idle villagers gather only food', () => {
    const economy = new EconomySystem();
    const village = { ...baseVillage(), population: 3 };
    const result = economy.processDay(2, baseResources(), [], village, noWorkers);
    expect(result.report.produced.wood ?? 0).toBe(0);
    expect(result.report.produced.stone ?? 0).toBe(0);
    expect(result.report.produced.food).toBe(3);
    expect(result.report.notes.some((n) => n.includes('gather'))).toBe(true);
  });

  it('consumes food equal to foodNeed when supply is sufficient', () => {
    const economy = new EconomySystem();
    const village = baseVillage();
    const result = economy.processDay(2, baseResources(), [], village, noWorkers);
    expect(result.report.consumed.food).toBe(village.foodNeed);
    // food = 50 + 4 (gathering by 4 idle) - 8 (consumption) = 46
    expect(result.resources.food).toBe(baseResources().food + village.population - village.foodNeed);
  });

  it('drops morale on food shortage and reports it', () => {
    const economy = new EconomySystem();
    const village = { ...baseVillage(), morale: 60 };
    const lowFood: Resources = { ...baseResources(), food: 2 };
    const result = economy.processDay(2, lowFood, [], village, noWorkers);
    expect(result.resources.food).toBe(0);
    expect(result.village.morale).toBeLessThan(60);
    expect(result.report.notes.some((n) => n.includes('Food shortage'))).toBe(true);
  });

  it('reduces productivity when tools are insufficient', () => {
    const economy = new EconomySystem();
    const buildings = [makeBuilding('lm', 'lumber_mill_level_1')];
    const noTools: Resources = { ...baseResources(), tools: 0 };
    const village = baseVillage();
    const workers = workersFor(['lm', 2]);
    const withTools = economy.processDay(2, baseResources(), buildings, village, workers);
    const withoutTools = economy.processDay(2, noTools, buildings, village, workers);
    expect(withoutTools.report.produced.wood ?? 0).toBeLessThan(
      withTools.report.produced.wood ?? 0,
    );
  });

  it('clamps morale to [0, 100]', () => {
    const economy = new EconomySystem();
    const village = { ...baseVillage(), morale: 95, population: 1 };
    const result = economy.processDay(
      2,
      { ...baseResources(), food: 100 },
      [makeBuilding('w', 'well'), makeBuilding('s', 'shrine'), makeBuilding('m', 'market_stall')],
      village,
      workersFor(['m', 1]),
    );
    expect(result.village.morale).toBeLessThanOrEqual(100);
    expect(result.village.morale).toBeGreaterThanOrEqual(0);
  });

  it('grows population on day-3 with high morale and surplus food', () => {
    const economy = new EconomySystem();
    const village: VillageState = {
      population: 2,
      morale: 90,
      housing: 10,
      foodNeed: 4,
      toolsNeed: 1,
      weaponsNeed: 0,
    };
    const result = economy.processDay(
      3,
      { ...baseResources(), food: 100 },
      [makeBuilding('h', 'house_level_2')],
      village,
      noWorkers,
    );
    expect(result.village.population).toBe(3);
  });

  it('shrinks population when morale is critically low', () => {
    const economy = new EconomySystem();
    const village = { ...baseVillage(), population: 4, morale: 10 };
    const result = economy.processDay(
      2,
      { ...baseResources(), food: 0 },
      [],
      village,
      noWorkers,
    );
    expect(result.village.population).toBeLessThan(4);
  });

  it('reports worker shortage when slots are unfilled', () => {
    const economy = new EconomySystem();
    const buildings = [
      makeBuilding('lm', 'lumber_mill_level_1'),
      makeBuilding('ws', 'workshop'),
    ];
    const workers = workersFor(['lm', 1]);
    const result = economy.processDay(2, baseResources(), buildings, baseVillage(), workers);
    expect(result.report.notes.some((n) => n.includes('Worker shortage'))).toBe(true);
  });
});
