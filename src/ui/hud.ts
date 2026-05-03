import type {
  BuildingAvailability,
  BuildingDefinition,
  BuildingType,
  DevFoliageDefinition,
  DevRoadDefinition,
  Resources,
  VillageState,
} from '../game/types/game';

interface HudOptions {
  buildingOptions: BuildingDefinition[];
  devFoliageItems: DevFoliageDefinition[];
  devRoadItems: DevRoadDefinition[];
  onSelectBuilding: (type: BuildingType) => void;
  onSetBulldozeMode: (enabled: boolean) => void;
  onResetSave: () => void;
  onSetDevPaintEnabled: (enabled: boolean) => void;
  onSelectDevFoliage: (foliageId: string) => void;
  onSelectDevRoad: (roadId: string) => void;
  onEraseDevPaintTile: () => void;
}

export interface HudController {
  setResources: (resources: Resources) => void;
  setVillage: (village: VillageState) => void;
  setBuildingAvailability: (availability: Record<BuildingType, BuildingAvailability>) => void;
  setSelectedBuilding: (type: BuildingType | null, bulldozeMode: boolean) => void;
  setDay: (day: number) => void;
  setDevPaintState: (
    enabled: boolean,
    selectedFoliageId: string | null,
    selectedRoadId: string | null,
  ) => void;
  showMessage: (text: string) => void;
  destroy: () => void;
}

export const createHud = (root: HTMLElement, options: HudOptions): HudController => {
  root.innerHTML = `
    <div class="hud-top panel">
      <div class="resource-list">
        <span>Wood: <strong data-res="wood">0</strong></span>
        <span>Stone: <strong data-res="stone">0</strong></span>
        <span>Food: <strong data-res="food">0</strong></span>
        <span>Tools: <strong data-res="tools">0</strong></span>
        <span>Weapons: <strong data-res="weapons">0</strong></span>
        <span>Day: <strong data-day>1</strong></span>
      </div>
      <div class="resource-list resource-list-secondary">
        <span>Pop: <strong data-village="population">0</strong></span>
        <span>Morale: <strong data-village="morale">0</strong></span>
        <span>Housing: <strong data-village="housing">0</strong></span>
        <span>Food Need: <strong data-village="foodNeed">0</strong></span>
        <span>Tools Need: <strong data-village="toolsNeed">0</strong></span>
        <span>Weapons Need: <strong data-village="weaponsNeed">0</strong></span>
      </div>
      <button type="button" class="hud-button" data-action="reset">Reset Save</button>
    </div>
    <div class="dev-paint panel">
      <div class="dev-paint-head">
        <strong>Palette</strong>
        <label class="dev-toggle">
          <input type="checkbox" data-action="dev-toggle" />
          <span>On</span>
        </label>
      </div>
      <div class="dev-tabs" data-dev-tabs>
        <button type="button" class="dev-tab is-active" data-tab="trees">Trees</button>
        <button type="button" class="dev-tab" data-tab="buildings">Buildings</button>
        <button type="button" class="dev-tab" data-tab="roads">Roads</button>
        <button type="button" class="dev-tab" data-tab="decor">Decor</button>
      </div>
      <div class="dev-panel is-active" data-panel="trees">
        <div class="dev-paint-section">
          <span class="dev-paint-section-title">Trees</span>
          <div class="dev-paint-grid dev-foliage-grid" data-dev-foliage-grid></div>
        </div>
      </div>
      <div class="dev-panel" data-panel="buildings">
        <div class="dev-paint-section">
          <span class="dev-paint-section-title">Buildings</span>
          <button type="button" class="hud-button bulldoze-button" data-action="bulldoze">Bulldoze</button>
          <div class="dev-buildings-groups" data-dev-buildings-grid></div>
          <span class="dev-panel-hint">Place unlocked buildings on the map. Cancel with ESC.</span>
        </div>
      </div>
      <div class="dev-panel" data-panel="roads">
        <div class="dev-paint-section">
          <span class="dev-paint-section-title">Roads</span>
          <div class="dev-paint-grid dev-roads-grid" data-dev-roads-grid></div>
          <span class="dev-panel-hint">Paint one-tile road segments on the map.</span>
        </div>
      </div>
      <div class="dev-panel" data-panel="decor">
        <div class="dev-paint-section">
          <span class="dev-paint-section-title">Decor</span>
          <div class="dev-empty-state">
            <strong>Slot reserved</strong>
            <span>Add new rocks, fences, plants or props here later.</span>
          </div>
        </div>
      </div>
      <button type="button" class="hud-button dev-erase" data-action="dev-erase">Erase</button>
    </div>
    <div class="hud-toast" data-toast aria-live="polite"></div>
  `;

  const woodEl = root.querySelector<HTMLElement>('[data-res="wood"]');
  const stoneEl = root.querySelector<HTMLElement>('[data-res="stone"]');
  const foodEl = root.querySelector<HTMLElement>('[data-res="food"]');
  const toolsEl = root.querySelector<HTMLElement>('[data-res="tools"]');
  const weaponsEl = root.querySelector<HTMLElement>('[data-res="weapons"]');
  const dayEl = root.querySelector<HTMLElement>('[data-day]');
  const populationEl = root.querySelector<HTMLElement>('[data-village="population"]');
  const moraleEl = root.querySelector<HTMLElement>('[data-village="morale"]');
  const housingEl = root.querySelector<HTMLElement>('[data-village="housing"]');
  const foodNeedEl = root.querySelector<HTMLElement>('[data-village="foodNeed"]');
  const toolsNeedEl = root.querySelector<HTMLElement>('[data-village="toolsNeed"]');
  const weaponsNeedEl = root.querySelector<HTMLElement>('[data-village="weaponsNeed"]');
  const devTabs = root.querySelector<HTMLElement>('[data-dev-tabs]');
  const devFoliageGrid = root.querySelector<HTMLElement>('[data-dev-foliage-grid]');
  const devBuildingsGrid = root.querySelector<HTMLElement>('[data-dev-buildings-grid]');
  const devRoadsGrid = root.querySelector<HTMLElement>('[data-dev-roads-grid]');
  const devToggle = root.querySelector<HTMLInputElement>('[data-action="dev-toggle"]');
  const devEraseButton = root.querySelector<HTMLButtonElement>('[data-action="dev-erase"]');
  const bulldozeButton = root.querySelector<HTMLButtonElement>('[data-action="bulldoze"]');
  const toastEl = root.querySelector<HTMLElement>('[data-toast]');
  const resetButton = root.querySelector<HTMLButtonElement>('[data-action="reset"]');

  if (
    !woodEl ||
    !stoneEl ||
    !foodEl ||
    !toolsEl ||
    !weaponsEl ||
    !dayEl ||
    !populationEl ||
    !moraleEl ||
    !housingEl ||
    !foodNeedEl ||
    !toolsNeedEl ||
    !weaponsNeedEl ||
    !devTabs ||
    !devFoliageGrid ||
    !devBuildingsGrid ||
    !devRoadsGrid ||
    !devToggle ||
    !devEraseButton ||
    !bulldozeButton ||
    !toastEl ||
    !resetButton
  ) {
    throw new Error('HUD layout is incomplete');
  }

  const devBuildingButtons = new Map<BuildingType, HTMLButtonElement>();
  const devFoliageButtons = new Map<string, HTMLButtonElement>();
  const devRoadButtons = new Map<string, HTMLButtonElement>();
  const devTabButtons = new Map<string, HTMLButtonElement>();
  const buildingGroupButtons = new Map<string, HTMLButtonElement>();
  const buildingGroupPanels = new Map<string, HTMLElement>();
  const buildingGroupsByType = new Map<BuildingType, string>();
  const openBuildingGroups = new Set<string>();
  let toastTimer: number | null = null;
  let activeTab = 'trees';
  const groupedBuildings = groupBuildings(options.buildingOptions);
  for (const group of groupedBuildings) {
    if (group.variants.length === 1) {
      const building = group.variants[0];
      const devButton = createBuildingTileButton(building);
      devBuildingButtons.set(building.type, devButton);
      devBuildingsGrid.appendChild(devButton);
      continue;
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'building-group';
    wrapper.dataset.groupId = group.id;
    const head = document.createElement('button');
    head.type = 'button';
    head.className = 'dev-paint-tile dev-building-tile building-group-head';
    head.dataset.groupId = group.id;
    head.innerHTML = `
      <img class="build-icon" alt="${group.label}" />
      <span class="dev-paint-label">
        <strong>${group.label}</strong>
        <small>Levels</small>
      </span>
    `;
    const headIcon = head.querySelector<HTMLImageElement>('.build-icon');
    if (headIcon) {
      bindImageFallback(headIcon, [group.variants[0].spritePath]);
    }
    head.addEventListener('click', () => {
      if (openBuildingGroups.has(group.id)) {
        openBuildingGroups.delete(group.id);
      } else {
        openBuildingGroups.add(group.id);
      }
      syncBuildingGroups();
    });

    const panel = document.createElement('div');
    panel.className = 'building-level-list';
    panel.dataset.groupId = group.id;
    for (const building of group.variants) {
      buildingGroupsByType.set(building.type, group.id);
      const tile = createBuildingTileButton(building, `Level ${extractLevel(building.type)}`);
      devBuildingButtons.set(building.type, tile);
      panel.appendChild(tile);
    }

    wrapper.append(head, panel);
    buildingGroupButtons.set(group.id, head);
    buildingGroupPanels.set(group.id, panel);
    devBuildingsGrid.appendChild(wrapper);
  }

  resetButton.addEventListener('click', () => {
    options.onResetSave();
  });

  devToggle.addEventListener('change', () => {
    options.onSetDevPaintEnabled(devToggle.checked);
  });

  devEraseButton.addEventListener('click', () => {
    options.onEraseDevPaintTile();
  });

  bulldozeButton.addEventListener('click', () => {
    options.onSetBulldozeMode(true);
  });

  for (const tabButton of devTabs.querySelectorAll<HTMLButtonElement>('[data-tab]')) {
    const tabId = tabButton.dataset.tab;
    if (!tabId) {
      continue;
    }
    devTabButtons.set(tabId, tabButton);
    tabButton.addEventListener('click', () => {
      activeTab = tabId;
      syncTabs();
    });
  }

  for (const foliage of options.devFoliageItems) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'dev-paint-tile dev-foliage-tile';
    button.title = foliage.name;
    button.dataset.foliageId = foliage.id;
    button.innerHTML = `
      <span class="dev-paint-swatch dev-foliage-swatch"></span>
      <span class="dev-paint-label">${foliage.name}</span>
    `;
    const swatch = button.querySelector<HTMLElement>('.dev-foliage-swatch');
    if (swatch) {
      swatch.style.background = foliage.swatchColor;
    }
    button.addEventListener('click', () => {
      options.onSelectDevFoliage(foliage.id);
    });
    devFoliageButtons.set(foliage.id, button);
    devFoliageGrid.appendChild(button);
  }

  for (const road of options.devRoadItems) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'dev-paint-tile dev-road-tile';
    button.title = road.name;
    button.dataset.roadId = road.id;
    button.innerHTML = `
      <span class="dev-paint-swatch"></span>
      <span class="dev-paint-label">${road.name}</span>
    `;
    const swatch = button.querySelector<HTMLElement>('.dev-paint-swatch');
    if (swatch) {
      swatch.style.backgroundImage = `url('${road.swatchImage}')`;
      swatch.style.backgroundSize = 'cover';
      swatch.style.backgroundPosition = 'center';
    }
    button.addEventListener('click', () => {
      options.onSelectDevRoad(road.id);
    });
    devRoadButtons.set(road.id, button);
    devRoadsGrid.appendChild(button);
  }

  const setSelectedBuilding = (type: BuildingType | null, bulldozeMode: boolean): void => {
    for (const [buttonType, button] of devBuildingButtons.entries()) {
      button.classList.toggle('is-selected', !bulldozeMode && buttonType === type);
    }
    for (const [groupId, headButton] of buildingGroupButtons.entries()) {
      const hasSelected = Boolean(
        type &&
          devBuildingButtons.get(type) &&
          buildingGroupsByType.get(type) === groupId &&
          !bulldozeMode,
      );
      headButton.classList.toggle('is-selected', hasSelected);
      if (hasSelected) {
        openBuildingGroups.add(groupId);
      }
    }
    bulldozeButton.classList.toggle('is-selected', bulldozeMode);
    if (type) {
      activeTab = 'buildings';
      syncTabs();
    }
    if (bulldozeMode) {
      activeTab = 'buildings';
      syncTabs();
    }
    syncBuildingGroups();
  };

  const setResources = (resources: Resources): void => {
    woodEl.textContent = String(resources.wood);
    stoneEl.textContent = String(resources.stone);
    foodEl.textContent = String(resources.food);
    toolsEl.textContent = String(resources.tools);
    weaponsEl.textContent = String(resources.weapons);
  };

  const setVillage = (village: VillageState): void => {
    populationEl.textContent = String(village.population);
    moraleEl.textContent = String(village.morale);
    housingEl.textContent = String(village.housing);
    foodNeedEl.textContent = String(village.foodNeed);
    toolsNeedEl.textContent = String(village.toolsNeed);
    weaponsNeedEl.textContent = String(village.weaponsNeed);
  };

  const setBuildingAvailability = (availability: Record<BuildingType, BuildingAvailability>): void => {
    for (const [buildingType, button] of devBuildingButtons.entries()) {
      const state = availability[buildingType];
      const reasonEl = button.querySelector<HTMLElement>('[data-lock-reason]');
      const unlocked = state?.unlocked ?? true;
      button.disabled = !unlocked;
      button.classList.toggle('is-locked', !unlocked);
      button.title = unlocked ? BUILDING_LIST_TOOLTIP_FALLBACK : state.reason ?? 'Locked';
      if (reasonEl) {
        reasonEl.textContent = unlocked ? '' : state.reason ?? 'Locked';
      }
    }
  };

  const setDay = (day: number): void => {
    dayEl.textContent = String(day);
  };

  const setDevPaintState = (
    enabled: boolean,
    selectedFoliageId: string | null,
    selectedRoadId: string | null,
  ): void => {
    devToggle.checked = enabled;
    root.querySelector('.dev-paint')?.classList.toggle('is-active', enabled);
    for (const [foliageId, button] of devFoliageButtons.entries()) {
      button.classList.toggle('is-selected', enabled && foliageId === selectedFoliageId);
    }
    for (const [roadId, button] of devRoadButtons.entries()) {
      button.classList.toggle('is-selected', enabled && roadId === selectedRoadId);
    }
    if (enabled && selectedFoliageId) {
      activeTab = 'trees';
      syncTabs();
    }
    if (enabled && selectedRoadId) {
      activeTab = 'roads';
      syncTabs();
    }
    devEraseButton.classList.toggle(
      'is-selected',
      enabled && selectedFoliageId === null && selectedRoadId === null,
    );
  };

  const syncTabs = (): void => {
    for (const [tabId, button] of devTabButtons.entries()) {
      button.classList.toggle('is-active', tabId === activeTab);
    }
    for (const panel of root.querySelectorAll<HTMLElement>('.dev-panel')) {
      panel.classList.toggle('is-active', panel.dataset.panel === activeTab);
    }
  };

  syncTabs();
  syncBuildingGroups();

  const showMessage = (text: string): void => {
    toastEl.textContent = text;
    toastEl.classList.add('visible');
    if (toastTimer !== null) {
      window.clearTimeout(toastTimer);
    }
    toastTimer = window.setTimeout(() => {
      toastEl.classList.remove('visible');
      toastTimer = null;
    }, 1500);
  };

  const destroy = (): void => {
    if (toastTimer !== null) {
      window.clearTimeout(toastTimer);
    }
    root.innerHTML = '';
  };

  return {
    setResources,
    setVillage,
    setBuildingAvailability,
    setSelectedBuilding,
    setDay,
    setDevPaintState,
    showMessage,
    destroy,
  };

  function createBuildingTileButton(building: BuildingDefinition, captionOverride?: string): HTMLButtonElement {
    const iconSrcList = [building.spritePath];
    const devButton = document.createElement('button');
    devButton.type = 'button';
    devButton.className = 'dev-paint-tile dev-building-tile';
    devButton.dataset.type = building.type;
    devButton.innerHTML = `
      ${iconSrcList ? `<img class="build-icon" alt="${building.name}" />` : ''}
      <span class="dev-paint-label">
        <strong>${captionOverride ?? building.name}</strong>
        <small>${building.size.w}x${building.size.h}</small>
        <small class="dev-lock-reason" data-lock-reason></small>
      </span>
    `;
    const icon = devButton.querySelector<HTMLImageElement>('.build-icon');
    if (icon) {
      bindImageFallback(icon, iconSrcList);
    }
    devButton.addEventListener('click', () => {
      options.onSetDevPaintEnabled(false);
      options.onSelectBuilding(building.type);
    });
    return devButton;
  }

  function syncBuildingGroups(): void {
    for (const [groupId, panel] of buildingGroupPanels.entries()) {
      panel.classList.toggle('is-open', openBuildingGroups.has(groupId));
    }
  }
};

const BUILDING_LIST_TOOLTIP_FALLBACK = 'Select building';

interface BuildingGroup {
  id: string;
  label: string;
  variants: BuildingDefinition[];
}

const extractLevel = (type: BuildingType): number => {
  const match = type.match(/_level_(\d+)$/);
  return match ? Number(match[1]) : 1;
};

const getFamilyKey = (type: BuildingType): string | null => {
  const match = type.match(/^(.+)_level_\d+$/);
  return match ? match[1] : null;
};

const formatFamilyLabel = (family: string): string =>
  family
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const groupBuildings = (buildings: BuildingDefinition[]): BuildingGroup[] => {
  const groups = new Map<string, BuildingDefinition[]>();
  for (const building of buildings) {
    const family = getFamilyKey(building.type);
    const key = family ?? building.type;
    const list = groups.get(key) ?? [];
    list.push(building);
    groups.set(key, list);
  }

  const result: BuildingGroup[] = [];
  for (const [key, variants] of groups.entries()) {
    variants.sort((a, b) => extractLevel(a.type) - extractLevel(b.type));
    result.push({
      id: key,
      label: key === variants[0].type ? variants[0].name : formatFamilyLabel(key),
      variants,
    });
  }
  result.sort((a, b) => a.label.localeCompare(b.label));
  return result;
};

const bindImageFallback = (img: HTMLImageElement, sources: string[]): void => {
  let index = 0;
  const tryNext = (): void => {
    if (index >= sources.length) {
      img.style.display = 'none';
      return;
    }
    img.src = sources[index];
    index += 1;
  };
  img.addEventListener('error', tryNext);
  tryNext();
};
