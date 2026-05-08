import type {
  BuildingAvailability,
  BuildingDetailsPayload,
  BuildingDefinition,
  BuildingType,
  DevFoliageDefinition,
  DevRoadDefinition,
  ResourceType,
  Resources,
  VillageState,
} from '../game/types/game';

export interface TerrainPreviewItemInput {
  key: string;
  label: string;
  description: string;
  thumbnailUrl: string;
  largePreviewUrl: string;
}

interface HudOptions {
  buildingOptions: BuildingDefinition[];
  devFoliageItems: DevFoliageDefinition[];
  devRoadItems: DevRoadDefinition[];
  terrainPreviewItems?: TerrainPreviewItemInput[];
  resolveBuildingIcon?: (building: BuildingDefinition) => string | null;
  onSelectBuilding: (type: BuildingType) => void;
  onSetBulldozeMode: (enabled: boolean) => void;
  onResetSave: () => void;
  onSetDevPaintEnabled: (enabled: boolean) => void;
  onSelectDevFoliage: (foliageId: string) => void;
  onSelectDevRoad: (roadId: string) => void;
  onEraseDevPaintTile: () => void;
  onCloseBuildingDetails: () => void;
}

export interface HudController {
  setResources: (resources: Resources) => void;
  setVillage: (village: VillageState) => void;
  setWorkerInfo: (assigned: number, totalSlots: number) => void;
  setBuildingAvailability: (availability: Record<BuildingType, BuildingAvailability>) => void;
  setSelectedBuilding: (type: BuildingType | null, bulldozeMode: boolean) => void;
  setDay: (day: number) => void;
  setDevPaintState: (
    enabled: boolean,
    selectedFoliageId: string | null,
    selectedRoadId: string | null,
  ) => void;
  setBuildingDetails: (payload: BuildingDetailsPayload | null) => void;
  showMessage: (text: string) => void;
  destroy: () => void;
}

export const createHud = (root: HTMLElement, options: HudOptions): HudController => {
  const getBuildingIconSrc = (building: BuildingDefinition): string =>
    options.resolveBuildingIcon?.(building) ?? building.spritePath;

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
        <span>Workers: <strong data-workers>0/0</strong></span>
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
          <span class="dev-paint-section-title">Terrain Tiles</span>
          <div class="terrain-preview-grid" data-terrain-grid></div>
          <span class="dev-panel-hint">Procedurally generated 16×16 pixel tiles. Hover for an upscaled preview.</span>
        </div>
      </div>
      <button type="button" class="hud-button dev-erase" data-action="dev-erase">Erase</button>
    </div>
    <div class="building-details panel is-hidden" data-building-details>
      <div class="building-details-head">
        <strong class="building-details-title" data-bd-name>Building</strong>
        <button type="button" class="building-details-close" data-action="close-building-details">×</button>
      </div>
      <div class="building-details-grid">
        <span>Type</span><strong data-bd-type>-</strong>
        <span>Status</span><strong data-bd-status>-</strong>
        <span>Workers</span><strong data-bd-workers>-</strong>
        <span>Efficiency</span><strong data-bd-efficiency>-</strong>
        <span>Footprint</span><strong data-bd-size>-</strong>
        <span>Position</span><strong data-bd-position>-</strong>
      </div>
      <p class="building-details-purpose" data-bd-purpose></p>
      <div class="building-details-section">
        <span class="building-details-section-title">Produces</span>
        <div class="building-details-list" data-bd-produces></div>
      </div>
      <div class="building-details-section">
        <span class="building-details-section-title">Consumes</span>
        <div class="building-details-list" data-bd-consumes></div>
      </div>
      <div class="building-details-foot" data-bd-extra></div>
    </div>
    <div class="hud-toast" data-toast aria-live="polite"></div>
    <div class="hud-preview" data-preview aria-hidden="true">
      <img class="hud-preview-img" alt="" />
      <div class="hud-preview-caption" data-preview-caption></div>
    </div>
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
  const workersEl = root.querySelector<HTMLElement>('[data-workers]');
  const devTabs = root.querySelector<HTMLElement>('[data-dev-tabs]');
  const devFoliageGrid = root.querySelector<HTMLElement>('[data-dev-foliage-grid]');
  const devBuildingsGrid = root.querySelector<HTMLElement>('[data-dev-buildings-grid]');
  const devRoadsGrid = root.querySelector<HTMLElement>('[data-dev-roads-grid]');
  const devToggle = root.querySelector<HTMLInputElement>('[data-action="dev-toggle"]');
  const devEraseButton = root.querySelector<HTMLButtonElement>('[data-action="dev-erase"]');
  const bulldozeButton = root.querySelector<HTMLButtonElement>('[data-action="bulldoze"]');
  const toastEl = root.querySelector<HTMLElement>('[data-toast]');
  const resetButton = root.querySelector<HTMLButtonElement>('[data-action="reset"]');
  const buildingDetailsEl = root.querySelector<HTMLElement>('[data-building-details]');
  const closeBuildingDetailsButton = root.querySelector<HTMLButtonElement>(
    '[data-action="close-building-details"]',
  );
  const buildingDetailsNameEl = root.querySelector<HTMLElement>('[data-bd-name]');
  const buildingDetailsTypeEl = root.querySelector<HTMLElement>('[data-bd-type]');
  const buildingDetailsStatusEl = root.querySelector<HTMLElement>('[data-bd-status]');
  const buildingDetailsWorkersEl = root.querySelector<HTMLElement>('[data-bd-workers]');
  const buildingDetailsEfficiencyEl = root.querySelector<HTMLElement>('[data-bd-efficiency]');
  const buildingDetailsSizeEl = root.querySelector<HTMLElement>('[data-bd-size]');
  const buildingDetailsPositionEl = root.querySelector<HTMLElement>('[data-bd-position]');
  const buildingDetailsPurposeEl = root.querySelector<HTMLElement>('[data-bd-purpose]');
  const buildingDetailsProducesEl = root.querySelector<HTMLElement>('[data-bd-produces]');
  const buildingDetailsConsumesEl = root.querySelector<HTMLElement>('[data-bd-consumes]');
  const buildingDetailsExtraEl = root.querySelector<HTMLElement>('[data-bd-extra]');
  const previewEl = root.querySelector<HTMLElement>('[data-preview]');
  const previewImgEl = previewEl?.querySelector<HTMLImageElement>('.hud-preview-img') ?? null;
  const previewCaptionEl = root.querySelector<HTMLElement>('[data-preview-caption]');

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
    !resetButton ||
    !buildingDetailsEl ||
    !closeBuildingDetailsButton ||
    !buildingDetailsNameEl ||
    !buildingDetailsTypeEl ||
    !buildingDetailsStatusEl ||
    !buildingDetailsWorkersEl ||
    !buildingDetailsEfficiencyEl ||
    !buildingDetailsSizeEl ||
    !buildingDetailsPositionEl ||
    !buildingDetailsPurposeEl ||
    !buildingDetailsProducesEl ||
    !buildingDetailsConsumesEl ||
    !buildingDetailsExtraEl ||
    !previewEl ||
    !previewImgEl ||
    !previewCaptionEl
  ) {
    throw new Error('HUD layout is incomplete');
  }

  const attachPreview = (
    target: HTMLElement,
    imageSrc: string,
    caption: string,
    pixelArt = true,
  ): void => {
    const show = (): void => {
      previewImgEl.src = imageSrc;
      previewImgEl.classList.toggle('is-pixel', pixelArt);
      previewCaptionEl.textContent = caption;
      const rect = target.getBoundingClientRect();
      const previewWidth = 220;
      const margin = 12;
      let left = rect.right + margin;
      if (left + previewWidth > window.innerWidth - 8) {
        left = rect.left - previewWidth - margin;
      }
      const top = Math.max(8, Math.min(rect.top, window.innerHeight - 260));
      previewEl.style.left = `${left}px`;
      previewEl.style.top = `${top}px`;
      previewEl.classList.add('is-visible');
    };
    const hide = (): void => {
      previewEl.classList.remove('is-visible');
    };
    target.addEventListener('mouseenter', show);
    target.addEventListener('mouseleave', hide);
    target.addEventListener('focus', show);
    target.addEventListener('blur', hide);
  };

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
  const categorized = groupByCategory(groupedBuildings);
  for (const category of CATEGORY_ORDER) {
    const groups = categorized.get(category);
    if (!groups || groups.length === 0) {
      continue;
    }
    const section = document.createElement('div');
    section.className = 'building-category';
    section.dataset.category = category;

    const header = document.createElement('div');
    header.className = 'building-category-head';
    header.innerHTML = `
      <span class="building-category-icon">${CATEGORY_META[category].icon}</span>
      <span class="building-category-title">${CATEGORY_META[category].label}</span>
    `;
    section.appendChild(header);

    const grid = document.createElement('div');
    grid.className = 'building-category-grid';
    for (const group of groups) {
      if (group.variants.length === 1) {
        const building = group.variants[0];
        const devButton = createBuildingTileButton(building);
        devBuildingButtons.set(building.type, devButton);
        grid.appendChild(devButton);
        continue;
      }

      const wrapper = document.createElement('div');
      wrapper.className = 'building-group';
      wrapper.dataset.groupId = group.id;
      const head = document.createElement('button');
      head.type = 'button';
      head.className = 'dev-paint-tile dev-building-tile building-group-head';
      head.dataset.groupId = group.id;
      const totalLevels = group.variants.length;
      head.innerHTML = `
        <div class="bld-card-icon">
          <img class="build-icon" alt="${group.label}" />
          <span class="bld-card-level-badge">×${totalLevels}</span>
        </div>
        <div class="bld-card-info">
          <strong class="bld-card-name">${group.label}</strong>
          <span class="bld-card-meta">
            <span class="bld-card-stars">${renderStars(totalLevels)}</span>
            <span class="bld-card-hint">Levels ▾</span>
          </span>
        </div>
      `;
      const headIcon = head.querySelector<HTMLImageElement>('.build-icon');
      if (headIcon) {
        bindImageFallback(headIcon, [getBuildingIconSrc(group.variants[0])]);
      }
      attachPreview(
        head,
        getBuildingIconSrc(group.variants[0]),
        `${group.label} · ${group.variants.length} levels`,
      );
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
        const level = extractLevel(building.type);
        const tile = createBuildingTileButton(building, undefined, level);
        devBuildingButtons.set(building.type, tile);
        panel.appendChild(tile);
      }

      wrapper.append(head, panel);
      buildingGroupButtons.set(group.id, head);
      buildingGroupPanels.set(group.id, panel);
      grid.appendChild(wrapper);
    }
    section.appendChild(grid);
    devBuildingsGrid.appendChild(section);
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

  closeBuildingDetailsButton.addEventListener('click', () => {
    options.onCloseBuildingDetails();
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

  const terrainGrid = root.querySelector<HTMLElement>('[data-terrain-grid]');
  if (terrainGrid && options.terrainPreviewItems) {
    for (const terrain of options.terrainPreviewItems) {
      const card = document.createElement('div');
      card.className = 'dev-paint-tile dev-building-tile terrain-card';
      card.dataset.terrainKey = terrain.key;
      card.title = terrain.description;
      card.innerHTML = `
        <div class="bld-card-icon terrain-card-icon">
          <img class="terrain-thumb" alt="${terrain.label}" src="${terrain.thumbnailUrl}" />
        </div>
        <div class="bld-card-info">
          <strong class="bld-card-name">${terrain.label}</strong>
          <div class="bld-card-meta">
            <span class="bld-card-size">16×16</span>
            <span class="bld-card-hint">Tile</span>
          </div>
        </div>
      `;
      attachPreview(card, terrain.largePreviewUrl, `${terrain.label} — ${terrain.description}`);
      terrainGrid.appendChild(card);
    }
  }

  for (const road of options.devRoadItems) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'dev-paint-tile dev-road-tile dev-building-tile';
    button.title = road.name;
    button.dataset.roadId = road.id;
    button.innerHTML = `
      <div class="bld-card-icon road-card-icon">
        <span class="road-thumb"></span>
      </div>
      <div class="bld-card-info">
        <strong class="bld-card-name">${road.name}</strong>
        <div class="bld-card-meta">
          <span class="bld-card-size">1×1</span>
          <span class="bld-card-hint">Paint</span>
        </div>
      </div>
    `;
    const thumb = button.querySelector<HTMLElement>('.road-thumb');
    if (thumb) {
      thumb.style.backgroundImage = `url('${road.swatchImage}')`;
    }
    attachPreview(button, road.swatchImage, `${road.name} · tilesheet preview`);
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

  const setWorkerInfo = (assigned: number, totalSlots: number): void => {
    if (workersEl) {
      workersEl.textContent = `${assigned}/${totalSlots}`;
      workersEl.classList.toggle('is-shortage', assigned < totalSlots && totalSlots > 0);
    }
  };

  const setBuildingDetails = (payload: BuildingDetailsPayload | null): void => {
    if (!payload) {
      buildingDetailsEl.classList.add('is-hidden');
      return;
    }

    buildingDetailsEl.classList.remove('is-hidden');
    buildingDetailsEl.dataset.status = payload.status;

    buildingDetailsNameEl.textContent = `${payload.name} (Lv${payload.level})`;
    buildingDetailsTypeEl.textContent = payload.type;
    buildingDetailsStatusEl.textContent = payload.statusLabel;
    buildingDetailsWorkersEl.textContent =
      payload.workerSlots > 0 ? `${payload.workersAssigned}/${payload.workerSlots}` : 'N/A';
    buildingDetailsEfficiencyEl.textContent = `${payload.efficiency}%`;
    buildingDetailsSizeEl.textContent = `${payload.size.w}x${payload.size.h}`;
    buildingDetailsPositionEl.textContent = `${payload.position.x}, ${payload.position.y}`;
    buildingDetailsPurposeEl.textContent = payload.purpose;

    buildingDetailsProducesEl.innerHTML =
      payload.produces.length > 0
        ? payload.produces
            .map((line) => `<span class="flow-chip is-positive">+${line.amount} ${formatResourceName(line.resource)}</span>`)
            .join('')
        : '<span class="flow-empty">No production</span>';

    buildingDetailsConsumesEl.innerHTML =
      payload.consumes.length > 0
        ? payload.consumes
            .map((line) => {
              const available = line.available ?? 0;
              const ok = available >= line.amount;
              return `<span class="flow-chip ${ok ? '' : 'is-missing'}">-${line.amount} ${formatResourceName(line.resource)} <em>${available}</em></span>`;
            })
            .join('')
        : '<span class="flow-empty">No consumption</span>';

    buildingDetailsExtraEl.textContent =
      payload.moraleBonus !== 0
        ? `Morale bonus: +${payload.moraleBonus}`
        : payload.workerSlots > 0
          ? 'Production building'
          : 'Service / decorative building';
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
    setWorkerInfo,
    setBuildingAvailability,
    setSelectedBuilding,
    setDay,
    setDevPaintState,
    setBuildingDetails,
    showMessage,
    destroy,
  };

  function createBuildingTileButton(
    building: BuildingDefinition,
    captionOverride?: string,
    level?: number,
  ): HTMLButtonElement {
    const iconSrcList = [getBuildingIconSrc(building)];
    const devButton = document.createElement('button');
    devButton.type = 'button';
    devButton.className = 'dev-paint-tile dev-building-tile';
    devButton.dataset.type = building.type;
    const familyLabel = captionOverride ?? cleanBuildingName(building);
    const cost = building.cost ?? {};
    const costPills: string[] = [];
    if (cost.wood) {
      costPills.push(
        `<span class="cost-pill cost-wood" title="Wood"><span class="cost-icon">🪵</span>${cost.wood}</span>`,
      );
    }
    if (cost.stone) {
      costPills.push(
        `<span class="cost-pill cost-stone" title="Stone"><span class="cost-icon">🪨</span>${cost.stone}</span>`,
      );
    }
    const levelBadge = level
      ? `<span class="bld-card-level-badge">Lv${level}</span>`
      : '';
    devButton.innerHTML = `
      <div class="bld-card-icon">
        <img class="build-icon" alt="${building.name}" />
        ${levelBadge}
      </div>
      <div class="bld-card-info">
        <strong class="bld-card-name">${familyLabel}</strong>
        <div class="bld-card-meta">
          <span class="bld-card-size" title="Footprint">${building.size.w}×${building.size.h}</span>
          ${costPills.join('')}
        </div>
        <small class="dev-lock-reason" data-lock-reason></small>
      </div>
    `;
    const icon = devButton.querySelector<HTMLImageElement>('.build-icon');
    if (icon) {
      bindImageFallback(icon, iconSrcList);
    }
    devButton.title = building.purpose ?? building.name;
    attachPreview(
      devButton,
      getBuildingIconSrc(building),
      `${building.name} · ${building.size.w}×${building.size.h}${building.purpose ? ` — ${building.purpose}` : ''}`,
    );
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

type BuildingCategory =
  | 'housing'
  | 'production'
  | 'storage'
  | 'civic'
  | 'agriculture'
  | 'defense';

const CATEGORY_ORDER: BuildingCategory[] = [
  'housing',
  'storage',
  'production',
  'agriculture',
  'civic',
  'defense',
];

const CATEGORY_META: Record<BuildingCategory, { label: string; icon: string }> = {
  housing: { label: 'Housing', icon: '🏠' },
  storage: { label: 'Storage', icon: '📦' },
  production: { label: 'Production', icon: '⚒️' },
  agriculture: { label: 'Agriculture', icon: '🌾' },
  civic: { label: 'Civic', icon: '⛲' },
  defense: { label: 'Defense', icon: '🛡️' },
};

const CATEGORY_BY_FAMILY: Record<string, BuildingCategory> = {
  house: 'housing',
  tavern: 'housing',
  farmhouse: 'housing',
  storage: 'storage',
  barn: 'storage',
  lumber_mill: 'production',
  blacksmith: 'production',
  bakery: 'production',
  workshop: 'production',
  mason_yard: 'production',
  herb_hut: 'agriculture',
  fisher_hut: 'agriculture',
  stable: 'agriculture',
  town_hall: 'civic',
  market_stall: 'civic',
  well: 'civic',
  shrine: 'civic',
  watchtower: 'defense',
};

interface BuildingGroup {
  id: string;
  label: string;
  variants: BuildingDefinition[];
  category: BuildingCategory;
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
    const category = CATEGORY_BY_FAMILY[key] ?? 'civic';
    result.push({
      id: key,
      label: key === variants[0].type ? variants[0].name : formatFamilyLabel(key),
      variants,
      category,
    });
  }
  result.sort((a, b) => a.label.localeCompare(b.label));
  return result;
};

const groupByCategory = (groups: BuildingGroup[]): Map<BuildingCategory, BuildingGroup[]> => {
  const result = new Map<BuildingCategory, BuildingGroup[]>();
  for (const group of groups) {
    const list = result.get(group.category) ?? [];
    list.push(group);
    result.set(group.category, list);
  }
  return result;
};

const renderStars = (count: number): string => {
  const filled = '★'.repeat(count);
  return filled;
};

const cleanBuildingName = (building: BuildingDefinition): string => {
  const match = building.name.match(/^(.+?)\s+Lv\d+$/);
  return match ? match[1] : building.name;
};

const formatResourceName = (resource: ResourceType): string => {
  switch (resource) {
    case 'wood':
      return 'Wood';
    case 'stone':
      return 'Stone';
    case 'food':
      return 'Food';
    case 'tools':
      return 'Tools';
    case 'weapons':
      return 'Weapons';
    default:
      return resource;
  }
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
