import Phaser from 'phaser';
import { ITEM_SPRITESHEET } from '../constants';
import { BUILDING_LIST } from '../data/buildings';
import { DEV_FOLIAGE_ITEMS } from '../data/devFoliage';
import {
  VILLAGER_FRAME_COUNT,
  VILLAGER_PALETTES,
  VILLAGER_SPRITE_HEIGHT,
  VILLAGER_SPRITE_KEY_PREFIX,
  VILLAGER_SPRITE_WIDTH,
  VILLAGER_WALK_FPS,
} from '../data/villagers';
import { createVillagerSpritesheetCanvas } from '../utils/villagerSprite';

export class PreloadScene extends Phaser.Scene {
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
    this.load.image('env_landscape_sheet', 'assets/visual/environment/landscape_sheet.png');
    this.load.image('env_environment_sheet', 'assets/visual/environment/environment_sheet.png');
    this.load.spritesheet('road_dirt_tiles', 'assets/visual/roads/dirt_path_tiles.png', {
      frameWidth: 256,
      frameHeight: 256,
    });
    this.load.spritesheet('road_stone_tiles', 'assets/visual/roads/stone_path_tiles.png', {
      frameWidth: 256,
      frameHeight: 256,
    });
    this.load.spritesheet('road_cobble_tiles', 'assets/visual/roads/cobble_path_tiles.png', {
      frameWidth: 256,
      frameHeight: 256,
    });

    for (const building of BUILDING_LIST) {
      this.load.image(`building_sprite_${building.type}`, building.spritePath);
    }
  }

  public create(): void {
    this.stripBuildingBackdrops();
    this.stripRoadBackdrops();
    this.createRoadRuntimeSheets();
    this.createGrassPlaceholderTexture();
    this.createTerrainTexturesFromLandscape();
    this.createFoliagePlaceholderTextures();
    this.createVillagerSpritesheets();
    this.createSmokeParticleTexture();
    this.scene.start('WorldScene');
    this.scene.launch('UIScene');
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
      const texture = this.textures.get(key);
      if (!texture) {
        continue;
      }
      const source = texture.getSourceImage() as CanvasImageSource & {
        width?: number;
        height?: number;
      };
      const width = source?.width ?? 0;
      const height = source?.height ?? 0;
      if (!width || !height) {
        continue;
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        continue;
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
        return (r > 232 && g > 232 && b > 232) || (r > 212 && g > 212 && b > 212 && diff < 9);
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
        continue;
      }

      ctx.putImageData(imageData, 0, 0);
      this.textures.remove(key);
      this.textures.addCanvas(key, canvas);
    }
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

  private createTerrainTexturesFromLandscape(): void {
    const sourceTexture = this.textures.get('env_landscape_sheet');
    if (!sourceTexture) {
      return;
    }
    const source = sourceTexture.getSourceImage() as CanvasImageSource & {
      width?: number;
      height?: number;
    };
    const width = source?.width ?? 0;
    const height = source?.height ?? 0;
    if (!width || !height) {
      return;
    }

    const outSize = 16;
    const tileW = 80;
    const tileH = 80;
    const row1Y = 24;
    const row2Y = 128;
    const col = (index: number): number => 32 + index * 106;
    const definitions: Array<{ key: string; x: number; y: number; w: number; h: number }> = [
      { key: 'terrain_grass_dark', x: col(0), y: row1Y, w: tileW, h: tileH },
      { key: 'terrain_grass_light', x: col(1), y: row1Y, w: tileW, h: tileH },
      { key: 'terrain_forest_floor', x: col(2), y: row1Y, w: tileW, h: tileH },
      { key: 'terrain_dirt', x: col(3), y: row1Y, w: tileW, h: tileH },
      { key: 'terrain_sand', x: col(4), y: row1Y, w: tileW, h: tileH },
      { key: 'terrain_stone', x: col(6), y: row1Y, w: tileW, h: tileH },
      // This strip has no water tile, so use a darker grass/ground fallback.
      { key: 'terrain_water', x: col(0), y: row2Y, w: tileW, h: tileH },
      { key: 'terrain_grass_solid', x: col(1), y: row1Y, w: tileW, h: tileH },
      { key: 'env_grass_a', x: col(0), y: row1Y, w: tileW, h: tileH },
      { key: 'env_grass_b', x: col(1), y: row1Y, w: tileW, h: tileH },
      { key: 'env_grass_c', x: col(0), y: row2Y, w: tileW, h: tileH },
      { key: 'env_grass_d', x: col(1), y: row2Y, w: tileW, h: tileH },
      { key: 'env_dirt_a', x: col(3), y: row1Y, w: tileW, h: tileH },
      { key: 'env_dirt_b', x: col(4), y: row1Y, w: tileW, h: tileH },
      { key: 'env_stone_a', x: col(6), y: row1Y, w: tileW, h: tileH },
      { key: 'env_stone_b', x: col(7), y: row1Y, w: tileW, h: tileH },
    ];
    const fillByKey: Record<string, string> = {
      terrain_grass_dark: '#5b7f49',
      terrain_grass_light: '#7da55a',
      terrain_forest_floor: '#6f8f52',
      terrain_dirt: '#80664a',
      terrain_sand: '#9d8a62',
      terrain_stone: '#7a7a76',
      terrain_water: '#557a54',
      terrain_grass_solid: '#6f9f55',
      env_grass_a: '#6f9f55',
      env_grass_b: '#6f9f55',
      env_grass_c: '#6f9f55',
      env_grass_d: '#6f9f55',
      env_dirt_a: '#80664a',
      env_dirt_b: '#80664a',
      env_stone_a: '#7a7a76',
      env_stone_b: '#7a7a76',
    };

    const addCanvas = this.textures as unknown as {
      addCanvas: (key: string, sourceCanvas: HTMLCanvasElement) => unknown;
    };

    for (const def of definitions) {
      const canvas = document.createElement('canvas');
      canvas.width = outSize;
      canvas.height = outSize;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        continue;
      }
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = fillByKey[def.key] ?? '#6f9f55';
      ctx.fillRect(0, 0, outSize, outSize);
      const patch = this.findBestTerrainPatch(source, def.x, def.y, def.w, def.h);
      ctx.drawImage(
        source as CanvasImageSource,
        patch.x,
        patch.y,
        patch.size,
        patch.size,
        0,
        0,
        outSize,
        outSize,
      );

      if (this.textures.exists(def.key)) {
        this.textures.remove(def.key);
      }
      addCanvas.addCanvas(def.key, canvas);
    }
  }

  private findBestTerrainPatch(
    source: CanvasImageSource,
    x: number,
    y: number,
    w: number,
    h: number,
  ): { x: number; y: number; size: number } {
    const probeCanvas = document.createElement('canvas');
    probeCanvas.width = w;
    probeCanvas.height = h;
    const probeCtx = probeCanvas.getContext('2d');
    if (!probeCtx) {
      return { x: x + 10, y: y + 10, size: Math.max(16, Math.min(w, h) - 20) };
    }

    probeCtx.imageSmoothingEnabled = false;
    probeCtx.drawImage(source, x, y, w, h, 0, 0, w, h);
    const imageData = probeCtx.getImageData(0, 0, w, h).data;

    const checkerA = this.getPixel(imageData, w, 1, 1);
    const checkerB = this.getPixel(imageData, w, 3, 1);

    const patchSize = Math.min(44, w - 8, h - 8);
    let best = { x: x + 4, y: y + 4, score: Number.POSITIVE_INFINITY };

    for (let py = 4; py <= h - patchSize - 4; py += 2) {
      for (let px = 4; px <= w - patchSize - 4; px += 2) {
        let checkerHits = 0;
        let alphaHits = 0;
        for (let sy = py; sy < py + patchSize; sy += 2) {
          for (let sx = px; sx < px + patchSize; sx += 2) {
            const color = this.getPixel(imageData, w, sx, sy);
            const distA = this.colorDistance(color, checkerA);
            const distB = this.colorDistance(color, checkerB);
            if (Math.min(distA, distB) <= 16) {
              checkerHits += 1;
            }
            if (color[3] < 8) {
              alphaHits += 1;
            }
          }
        }
        const score = checkerHits * 5 + alphaHits * 10;
        if (score < best.score) {
          best = { x: x + px, y: y + py, score };
        }
      }
    }

    return { x: best.x, y: best.y, size: patchSize };
  }

  private getPixel(
    data: Uint8ClampedArray,
    width: number,
    x: number,
    y: number,
  ): [number, number, number, number] {
    const index = (y * width + x) * 4;
    return [data[index], data[index + 1], data[index + 2], data[index + 3]];
  }

  private colorDistance(
    a: [number, number, number, number],
    b: [number, number, number, number],
  ): number {
    return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
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
      return (r > 232 && g > 232 && b > 232) || (r > 212 && g > 212 && b > 212 && diff < 9);
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
