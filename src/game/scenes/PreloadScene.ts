import Phaser from 'phaser';
import { ITEM_SPRITESHEET } from '../constants';
import { BUILDING_LIST } from '../data/buildings';
import { DEV_FOLIAGE_ITEMS } from '../data/devFoliage';
import { MAP_CONFIG } from '../data/map';
import {
  VILLAGER_FRAME_COUNT,
  VILLAGER_PALETTES,
  VILLAGER_SPRITE_HEIGHT,
  VILLAGER_SPRITE_KEY_PREFIX,
  VILLAGER_SPRITE_WIDTH,
  VILLAGER_WALK_FPS,
} from '../data/villagers';
import { registerTerrainTextures } from '../utils/terrainTextures';
import { createVillagerSpritesheetCanvas } from '../utils/villagerSprite';

export class PreloadScene extends Phaser.Scene {
  private static readonly BUILDING_FORMATS = ['.png', '.webp', '.jpg', '.jpeg', '.avif'];

  constructor() {
    super('PreloadScene');
  }

  public preload(): void {
    const { width, height } = this.scale;
    const progressText = this.add
      .text(width * 0.5, height * 0.5, 'Loading Fernhold... 0%', {
        fontFamily: '"Trebuchet MS", sans-serif',
        fontSize: '18px',
        color: '#f0e7cb',
      })
      .setOrigin(0.5);

    this.load.on('progress', (value: number) => {
      progressText.setText(`Loading Fernhold... ${Math.round(value * 100)}%`);
    });

    if (ITEM_SPRITESHEET.enabled) {
      // TODO: Replace with real pixel-art item atlas when production assets are ready.
      this.load.atlas(ITEM_SPRITESHEET.key, ITEM_SPRITESHEET.imagePath, ITEM_SPRITESHEET.atlasPath);
    }
    this.load.image('menu_background', 'tilesetOpenGameBackground.png');
    this.load.image('road_dirt_tiles', 'assets/visual/roads/road_single_tile.png');
    this.load.image('road_stone_tiles', 'assets/visual/roads/stone_road_single_tile.jpg');
    this.load.image('road_cobble_tiles', 'assets/visual/roads/cobble_road_single_tile.png');

    this.load.image('grass_source', 'assets/visual/environment/grass_1.png');

    // Building sprites are loaded in `create()` with format fallback (png/webp/jpg/jpeg/avif).
  }

  public create(): void {
    void this.bootstrapScene();
  }

  private async bootstrapScene(): Promise<void> {
    await this.ensureBuildingTextures();
    this.stripBuildingBackdrops();
    this.stripRoadBackdrops();
    this.createRoadRuntimeSheets();
    this.createGrassPlaceholderTexture();
    registerTerrainTextures(this);
    this.registerFullGround();
    this.createFoliagePlaceholderTextures();
    this.createVillagerSpritesheets();
    this.createSmokeParticleTexture();
    this.scene.start('WorldScene');
    this.scene.launch('UIScene');
  }

  private registerFullGround(): void {
    const key = 'terrain_ground_full';
    if (this.textures.exists(key)) {
      return;
    }

    const source = this.textures.get('grass_source').getSourceImage() as HTMLImageElement;
    const sw = source.width;
    const sh = source.height;

    const side = Math.min(sw, sh);
    const inset = side * 0.15;
    const cropSize = Math.floor(side - inset * 2);
    const cropX = Math.floor((sw - cropSize) / 2);
    const cropY = Math.floor((sh - cropSize) / 2);
    const cropW = cropSize;
    const cropH = cropSize;

    const patternSize = 64;
    const tileCanvas = document.createElement('canvas');
    tileCanvas.width = patternSize;
    tileCanvas.height = patternSize;
    const tileCtx = tileCanvas.getContext('2d')!;
    tileCtx.imageSmoothingEnabled = false;
    tileCtx.drawImage(source, cropX, cropY, cropW, cropH, 0, 0, patternSize, patternSize);

    const totalW = MAP_CONFIG.mapWidth * MAP_CONFIG.tileSize;
    const totalH = MAP_CONFIG.mapHeight * MAP_CONFIG.tileSize;
    const canvas = document.createElement('canvas');
    canvas.width = totalW;
    canvas.height = totalH;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;

    const pattern = ctx.createPattern(tileCanvas, 'repeat')!;
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, totalW, totalH);

    (this.textures as unknown as {
      addCanvas: (key: string, source: HTMLCanvasElement) => unknown;
    }).addCanvas(key, canvas);
  }

  private createSmokeParticleTexture(): void {
    const key = 'smoke_particle';
    if (this.textures.exists(key)) {
      return;
    }
    const size = 16;
    const radius = size / 2;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }
    const gradient = ctx.createRadialGradient(radius, radius, 0, radius, radius, radius);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.55, 'rgba(255, 255, 255, 0.55)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    (this.textures as unknown as {
      addCanvas: (key: string, source: HTMLCanvasElement) => unknown;
    }).addCanvas(key, canvas);
  }

  private createVillagerSpritesheets(): void {
    const addSpriteSheet = (
      this.textures as unknown as {
        addSpriteSheet: (
          key: string,
          source: HTMLCanvasElement,
          config: { frameWidth: number; frameHeight: number },
        ) => unknown;
      }
    ).addSpriteSheet.bind(this.textures);

    for (let index = 0; index < VILLAGER_PALETTES.length; index += 1) {
      const palette = VILLAGER_PALETTES[index];
      const key = `${VILLAGER_SPRITE_KEY_PREFIX}${index}`;
      if (!this.textures.exists(key)) {
        const canvas = createVillagerSpritesheetCanvas(palette);
        addSpriteSheet(key, canvas, {
          frameWidth: VILLAGER_SPRITE_WIDTH,
          frameHeight: VILLAGER_SPRITE_HEIGHT,
        });
      }

      const walkKeys = {
        down: `${key}_walk_down`,
        up: `${key}_walk_up`,
        left: `${key}_walk_left`,
        right: `${key}_walk_right`,
      };
      const idleKeys = {
        down: `${key}_idle_down`,
        up: `${key}_idle_up`,
        left: `${key}_idle_left`,
        right: `${key}_idle_right`,
      };

      const ensureAnim = (animKey: string, frames: number[], frameRate: number, repeat: number): void => {
        if (this.anims.exists(animKey)) {
          return;
        }
        this.anims.create({
          key: animKey,
          frames: frames.map((frame) => ({ key, frame })),
          frameRate,
          repeat,
        });
      };

      ensureAnim(walkKeys.down, [0, 1], VILLAGER_WALK_FPS, -1);
      ensureAnim(walkKeys.up, [2, 3], VILLAGER_WALK_FPS, -1);
      ensureAnim(walkKeys.left, [4, 5], VILLAGER_WALK_FPS, -1);
      ensureAnim(walkKeys.right, [6, 7], VILLAGER_WALK_FPS, -1);
      ensureAnim(idleKeys.down, [0], 1, 0);
      ensureAnim(idleKeys.up, [2], 1, 0);
      ensureAnim(idleKeys.left, [4], 1, 0);
      ensureAnim(idleKeys.right, [6], 1, 0);
    }

    if (VILLAGER_FRAME_COUNT !== 8) {
      console.warn('Villager sprite frame count mismatch.');
    }
  }

  private stripBuildingBackdrops(): void {
    for (const building of BUILDING_LIST) {
      const key = `building_sprite_${building.type}`;
      this.stripBackdropTexture(key);
    }
  }

  private stripBackdropTexture(key: string): void {
    const texture = this.textures.get(key);
    if (!texture) {
      return;
    }
    const source = texture.getSourceImage() as CanvasImageSource & {
      width?: number;
      height?: number;
    };
    const width = source?.width ?? 0;
    const height = source?.height ?? 0;
    if (!width || !height) {
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(source, 0, 0, width, height);
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const visited = new Uint8Array(width * height);
    const queue: number[] = [];

    const edgeCells: number[] = [];
    const pushEdgeCell = (x: number, y: number): void => {
      const cell = y * width + x;
      const index = cell * 4;
      if (data[index + 3] < 8) {
        return;
      }
      edgeCells.push(cell);
    };

    for (let x = 0; x < width; x += 1) {
      pushEdgeCell(x, 0);
      pushEdgeCell(x, height - 1);
    }
    for (let y = 1; y < height - 1; y += 1) {
      pushEdgeCell(0, y);
      pushEdgeCell(width - 1, y);
    }

    if (edgeCells.length < 8) {
      return;
    }

    interface EdgeBin {
      count: number;
      sumR: number;
      sumG: number;
      sumB: number;
      cells: number[];
    }

    const bins = new Map<number, EdgeBin>();
    for (const cell of edgeCells) {
      const index = cell * 4;
      const r = data[index];
      const g = data[index + 1];
      const b = data[index + 2];
      const keyBin = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
      const current = bins.get(keyBin);
      if (current) {
        current.count += 1;
        current.sumR += r;
        current.sumG += g;
        current.sumB += b;
        current.cells.push(cell);
      } else {
        bins.set(keyBin, {
          count: 1,
          sumR: r,
          sumG: g,
          sumB: b,
          cells: [cell],
        });
      }
    }

    let dominant: EdgeBin | null = null;
    for (const bin of bins.values()) {
      if (!dominant || bin.count > dominant.count) {
        dominant = bin;
      }
    }
    if (!dominant) {
      return;
    }

    const dominanceRatio = dominant.count / edgeCells.length;
    if (dominanceRatio < 0.16) {
      return;
    }

    const seedR = dominant.sumR / dominant.count;
    const seedG = dominant.sumG / dominant.count;
    const seedB = dominant.sumB / dominant.count;

    const colorDistance = (index: number): number => {
      const dr = data[index] - seedR;
      const dg = data[index + 1] - seedG;
      const db = data[index + 2] - seedB;
      return Math.hypot(dr, dg, db);
    };

    const edgeDistances: number[] = [];
    for (const cell of dominant.cells) {
      const index = cell * 4;
      const r = data[index];
      const g = data[index + 1];
      const b = data[index + 2];
      edgeDistances.push(Math.hypot(r - seedR, g - seedG, b - seedB));
    }
    edgeDistances.sort((a, b) => a - b);
    const percentileIndex = Math.min(edgeDistances.length - 1, Math.floor(edgeDistances.length * 0.9));
    const adaptiveTolerance = Math.max(14, Math.min(70, edgeDistances[percentileIndex] + 10));

    const isBackdropPixel = (index: number): boolean => {
      const alpha = data[index + 3];
      if (alpha < 8) {
        return false;
      }
      return colorDistance(index) <= adaptiveTolerance;
    };

    const pushIfBackdrop = (x: number, y: number): void => {
      const cell = y * width + x;
      if (visited[cell] === 1) {
        return;
      }
      const index = cell * 4;
      if (!isBackdropPixel(index)) {
        return;
      }
      visited[cell] = 1;
      queue.push(cell);
    };

    for (let x = 0; x < width; x += 1) {
      pushIfBackdrop(x, 0);
      pushIfBackdrop(x, height - 1);
    }
    for (let y = 1; y < height - 1; y += 1) {
      pushIfBackdrop(0, y);
      pushIfBackdrop(width - 1, y);
    }

    while (queue.length > 0) {
      const cell = queue.pop();
      if (cell === undefined) {
        break;
      }
      const x = cell % width;
      const y = Math.floor(cell / width);
      if (x > 0) {
        pushIfBackdrop(x - 1, y);
      }
      if (x < width - 1) {
        pushIfBackdrop(x + 1, y);
      }
      if (y > 0) {
        pushIfBackdrop(x, y - 1);
      }
      if (y < height - 1) {
        pushIfBackdrop(x, y + 1);
      }
    }

    let changed = false;
    for (let cell = 0; cell < visited.length; cell += 1) {
      if (visited[cell] !== 1) {
        continue;
      }
      data[cell * 4 + 3] = 0;
      changed = true;
    }

    if (!changed) {
      return;
    }

    // Soften bright fringe pixels touching the removed backdrop.
    for (let cell = 0; cell < visited.length; cell += 1) {
      if (visited[cell] === 1) {
        continue;
      }
      const index = cell * 4;
      if (data[index + 3] < 8) {
        continue;
      }
      const x = cell % width;
      const y = Math.floor(cell / width);
      const touchesCleared =
        (x > 0 && visited[cell - 1] === 1) ||
        (x < width - 1 && visited[cell + 1] === 1) ||
        (y > 0 && visited[cell - width] === 1) ||
        (y < height - 1 && visited[cell + width] === 1);
      if (!touchesCleared) {
        continue;
      }
      const brightness = (data[index] + data[index + 1] + data[index + 2]) / 3;
      const colorDelta = colorDistance(index);
      if (brightness > 90 && colorDelta < adaptiveTolerance + 20) {
        const fade = Math.min(1, (adaptiveTolerance + 20 - colorDelta) / (adaptiveTolerance + 20));
        data[index + 3] = Math.round(data[index + 3] * (1 - fade));
      }
    }

    ctx.putImageData(imageData, 0, 0);
    this.textures.remove(key);
    this.textures.addCanvas(key, canvas);
  }

  private async ensureBuildingTextures(): Promise<void> {
    for (const building of BUILDING_LIST) {
      const key = `building_sprite_${building.type}`;
      const image = await this.loadBuildingImage(building.spritePath);
      if (!image) {
        continue;
      }

      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        continue;
      }
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(image, 0, 0);

      this.textures.remove(key);
      this.textures.addCanvas(key, canvas);
    }
  }

  private async loadBuildingImage(initialPath: string): Promise<HTMLImageElement | null> {
    const candidates = this.getBuildingPathCandidates(initialPath);
    for (const url of candidates) {
      const image = await this.tryLoadImage(url);
      if (image) {
        return image;
      }
    }
    return null;
  }

  private getBuildingPathCandidates(path: string): string[] {
    const normalized = path.replace(/\\/g, '/');
    const match = normalized.match(/^(.*?)(\.[^./?]+)(\?.*)?$/);
    const base = match ? match[1] : normalized;
    const suffix = match?.[3] ?? '';
    const candidates = [normalized];
    for (const ext of PreloadScene.BUILDING_FORMATS) {
      const candidate = `${base}${ext}${suffix}`;
      if (!candidates.includes(candidate)) {
        candidates.push(candidate);
      }
    }
    return candidates;
  }

  private tryLoadImage(url: string): Promise<HTMLImageElement | null> {
    return new Promise((resolve) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => resolve(null);
      image.src = url;
    });
  }

  private createGrassPlaceholderTexture(): void {
    if (this.textures.exists('terrain_grass_solid')) {
      return;
    }

    const graphics = this.make.graphics();
    graphics.fillStyle(0x6c9856, 1);
    graphics.fillRect(0, 0, 32, 32);
    graphics.fillStyle(0x7bab5f, 1);
    graphics.fillRect(4, 5, 3, 2);
    graphics.fillRect(18, 8, 2, 3);
    graphics.fillRect(11, 20, 3, 2);
    graphics.fillStyle(0x51753f, 1);
    graphics.fillRect(8, 11, 2, 2);
    graphics.fillRect(22, 19, 3, 2);
    graphics.fillRect(14, 27, 2, 2);
    graphics.generateTexture('terrain_grass_solid', 32, 32);
    graphics.destroy();
  }

  private createFoliagePlaceholderTextures(): void {
    for (const foliage of DEV_FOLIAGE_ITEMS) {
      if (this.textures.exists(foliage.textureKey)) {
        continue;
      }

      const graphics = this.make.graphics();
      if (foliage.shape === 'pine') {
        this.drawPine(graphics, foliage);
      } else {
        this.drawRoundTree(graphics, foliage);
      }
      graphics.generateTexture(foliage.textureKey, foliage.width, foliage.height);
      graphics.destroy();
    }
  }

  private stripRoadBackdrops(): void {
    this.stripRoadSheet('road_dirt_tiles');
    this.stripRoadSheet('road_stone_tiles');
    this.stripRoadSheet('road_cobble_tiles');
  }

  private createRoadRuntimeSheets(): void {
    this.createRoadRuntimeSheet('road_dirt_tiles', 'road_dirt_tiles_runtime');
    this.createRoadRuntimeSheet('road_stone_tiles', 'road_stone_tiles_runtime');
    this.createRoadRuntimeSheet('road_cobble_tiles', 'road_cobble_tiles_runtime');
  }

  private createRoadRuntimeSheet(sourceKey: string, targetKey: string): void {
    const sourceTexture = this.textures.get(sourceKey);
    if (!sourceTexture) {
      return;
    }
    const source = sourceTexture.getSourceImage() as CanvasImageSource & { width?: number; height?: number };
    const sourceWidth = source?.width ?? 0;
    const sourceHeight = source?.height ?? 0;
    if (!sourceWidth || !sourceHeight) {
      return;
    }

    const srcFrame = 256;
    const dstFrame = 32;
    const cols = Math.max(1, Math.floor(sourceWidth / srcFrame));
    const rows = Math.max(1, Math.floor(sourceHeight / srcFrame));
    const frameCount = cols * rows;
    const outCols = cols;
    const outRows = rows;
    const outCanvas = document.createElement('canvas');
    outCanvas.width = outCols * dstFrame;
    outCanvas.height = outRows * dstFrame;
    const outCtx = outCanvas.getContext('2d');
    if (!outCtx) {
      return;
    }
    outCtx.imageSmoothingEnabled = false;

    for (let frame = 0; frame < frameCount; frame += 1) {
      const sx = (frame % cols) * srcFrame;
      const sy = Math.floor(frame / cols) * srcFrame;
      const dx = (frame % outCols) * dstFrame;
      const dy = Math.floor(frame / outCols) * dstFrame;
      outCtx.drawImage(source, sx, sy, srcFrame, srcFrame, dx, dy, dstFrame, dstFrame);
    }

    this.textures.remove(targetKey);
    (
      this.textures as unknown as {
        addSpriteSheet: (
          key: string,
          source: HTMLCanvasElement,
          config: { frameWidth: number; frameHeight: number },
        ) => unknown;
      }
    ).addSpriteSheet(targetKey, outCanvas, { frameWidth: dstFrame, frameHeight: dstFrame });
  }

  private stripRoadSheet(key: string): void {
    const texture = this.textures.get(key);
    if (!texture) {
      return;
    }
    const source = texture.getSourceImage() as CanvasImageSource & { width?: number; height?: number };
    const width = source?.width ?? 0;
    const height = source?.height ?? 0;
    if (!width || !height) {
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }
    ctx.drawImage(source, 0, 0, width, height);
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const visited = new Uint8Array(width * height);
    const queue: number[] = [];

    const isBackdropPixel = (index: number): boolean => {
      const alpha = data[index + 3];
      if (alpha < 8) {
        return false;
      }
      const r = data[index];
      const g = data[index + 1];
      const b = data[index + 2];
      const diff = Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(r - b));
      return (r > 215 && g > 215 && b > 215) || (r > 195 && g > 195 && b > 195 && diff < 18);
    };

    const pushIfBackdrop = (x: number, y: number): void => {
      const cell = y * width + x;
      if (visited[cell] === 1) {
        return;
      }
      const i = cell * 4;
      if (!isBackdropPixel(i)) {
        return;
      }
      visited[cell] = 1;
      queue.push(cell);
    };

    for (let x = 0; x < width; x += 1) {
      pushIfBackdrop(x, 0);
      pushIfBackdrop(x, height - 1);
    }
    for (let y = 0; y < height; y += 1) {
      pushIfBackdrop(0, y);
      pushIfBackdrop(width - 1, y);
    }

    while (queue.length > 0) {
      const cell = queue.pop();
      if (cell === undefined) {
        break;
      }
      const x = cell % width;
      const y = Math.floor(cell / width);
      if (x > 0) {
        pushIfBackdrop(x - 1, y);
      }
      if (x < width - 1) {
        pushIfBackdrop(x + 1, y);
      }
      if (y > 0) {
        pushIfBackdrop(x, y - 1);
      }
      if (y < height - 1) {
        pushIfBackdrop(x, y + 1);
      }
    }

    let changed = false;
    for (let cell = 0; cell < visited.length; cell += 1) {
      if (visited[cell] !== 1) {
        continue;
      }
      data[cell * 4 + 3] = 0;
      changed = true;
    }
    if (!changed) {
      return;
    }

    ctx.putImageData(imageData, 0, 0);
    this.textures.remove(key);
    (this.textures as unknown as { addSpriteSheet: (k: string, s: HTMLCanvasElement, c: { frameWidth: number; frameHeight: number }) => unknown }).addSpriteSheet(
      key,
      canvas,
      { frameWidth: 256, frameHeight: 256 },
    );
  }

  private drawPine(graphics: Phaser.GameObjects.Graphics, foliage: (typeof DEV_FOLIAGE_ITEMS)[number]): void {
    const mid = foliage.width * 0.5;
    const baseY = foliage.height - 8;
    graphics.fillStyle(foliage.shadeColor, 1);
    graphics.fillTriangle(mid, 2, 4, baseY - 6, foliage.width - 4, baseY - 6);
    graphics.fillTriangle(mid, 10, 3, baseY, foliage.width - 3, baseY);
    graphics.fillStyle(foliage.canopyColor, 1);
    graphics.fillTriangle(mid, 0, 6, baseY - 10, foliage.width - 6, baseY - 10);
    graphics.fillTriangle(mid, 8, 5, baseY - 2, foliage.width - 5, baseY - 2);
    graphics.fillStyle(foliage.trunkColor, 1);
    graphics.fillRect(mid - 2, baseY - 2, 4, 10);
  }

  private drawRoundTree(graphics: Phaser.GameObjects.Graphics, foliage: (typeof DEV_FOLIAGE_ITEMS)[number]): void {
    const mid = foliage.width * 0.5;
    const canopyY = foliage.height * 0.42;
    graphics.fillStyle(foliage.shadeColor, 1);
    graphics.fillCircle(mid + 3, canopyY + 2, Math.max(10, foliage.width * 0.26));
    graphics.fillCircle(mid - 7, canopyY + 5, Math.max(8, foliage.width * 0.22));
    graphics.fillStyle(foliage.canopyColor, 1);
    graphics.fillCircle(mid, canopyY, Math.max(12, foliage.width * 0.3));
    graphics.fillCircle(mid - 8, canopyY + 4, Math.max(9, foliage.width * 0.24));
    graphics.fillCircle(mid + 9, canopyY + 5, Math.max(9, foliage.width * 0.24));
    graphics.fillStyle(foliage.trunkColor, 1);
    graphics.fillRect(mid - 3, foliage.height - 14, 6, 14);
  }
}
