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
});

const baseVillage = (): VillageState => ({
  population: 4,
  morale: 60,
  housing: 6,
  foodNeed: 8,
  toolsNeed: 2,
  weaponsNeed: 1,
});

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
});

describe('EconomySystem.processDay', () => {
  it('produces wood from lumber mills', () => {
    const economy = new EconomySystem();
    const buildings = [
      makeBuilding('lm', 'lumber_mill_level_1'),
      makeBuilding('lm2', 'lumber_mill_level_2'),
    ];
    const result = economy.processDay(2, baseResources(), buildings, baseVillage());
    expect(result.report.produced.wood).toBeGreaterThan(0);
    expect(result.resources.wood).toBeGreaterThan(baseResources().wood - 1);
  });

  it('consumes food equal to foodNeed when supply is sufficient', () => {
    const economy = new EconomySystem();
    const village = baseVillage();
    const result = economy.processDay(2, baseResources(), [], village);
    expect(result.report.consumed.food).toBe(village.foodNeed);
    expect(result.resources.food).toBe(baseResources().food - village.foodNeed);
  });

  it('drops morale on food shortage and reports it', () => {
    const economy = new EconomySystem();
    const village = { ...baseVillage(), morale: 60 };
    const lowFood: Resources = { ...baseResources(), food: 2 };
    const result = economy.processDay(2, lowFood, [], village);
    expect(result.resources.food).toBe(0);
    expect(result.village.morale).toBeLessThan(60);
    expect(result.report.notes.some((n) => n.includes('Food shortage'))).toBe(true);
  });

  it('reduces productivity when tools are insufficient', () => {
    const economy = new EconomySystem();
    const buildings = [makeBuilding('lm', 'lumber_mill_level_1')];
    const noTools: Resources = { ...baseResources(), tools: 0 };
    const village = baseVillage();
    const withTools = economy.processDay(2, baseResources(), buildings, village);
    const withoutTools = economy.processDay(2, noTools, buildings, village);
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
      weaponsNeed: 1,
    };
    const result = economy.processDay(
      3,
      { ...baseResources(), food: 100 },
      [makeBuilding('h', 'house_level_2')],
      village,
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
    );
    expect(result.village.population).toBeLessThan(4);
  });
});
