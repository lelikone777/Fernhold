import type { VillagerPalette } from '../types/game';
import { VILLAGER_FRAME_COUNT, VILLAGER_SPRITE_HEIGHT, VILLAGER_SPRITE_WIDTH } from '../data/villagers';

const toCss = (color: number): string => `#${color.toString(16).padStart(6, '0')}`;

interface DrawParams {
  ctx: CanvasRenderingContext2D;
  palette: VillagerPalette;
  offsetX: number;
}

const fillPixel = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width = 1,
  height = 1,
): void => {
  ctx.fillRect(x, y, width, height);
};

const drawShadow = (ctx: CanvasRenderingContext2D, offsetX: number): void => {
  ctx.fillStyle = 'rgba(0,0,0,0.32)';
  fillPixel(ctx, offsetX + 3, 15, 6, 1);
};

const drawHead = (
  { ctx, palette, offsetX }: DrawParams,
  bob: number,
  facing: 'down' | 'up' | 'side',
): void => {
  const top = 1 + bob;
  ctx.fillStyle = toCss(palette.hair);
  fillPixel(ctx, offsetX + 3, top, 6, 1);
  fillPixel(ctx, offsetX + 2, top + 1, 8, 1);
  fillPixel(ctx, offsetX + 2, top + 2, 8, 1);

  ctx.fillStyle = toCss(palette.skin);
  if (facing === 'up') {
    fillPixel(ctx, offsetX + 3, top + 3, 6, 1);
    fillPixel(ctx, offsetX + 3, top + 4, 6, 1);
    ctx.fillStyle = toCss(palette.hair);
    fillPixel(ctx, offsetX + 3, top + 3, 6, 1);
    fillPixel(ctx, offsetX + 3, top + 4, 6, 1);
    return;
  }

  fillPixel(ctx, offsetX + 3, top + 3, 6, 1);
  fillPixel(ctx, offsetX + 3, top + 4, 6, 1);

  ctx.fillStyle = '#1a1208';
  if (facing === 'down') {
    fillPixel(ctx, offsetX + 4, top + 3);
    fillPixel(ctx, offsetX + 7, top + 3);
  } else if (facing === 'side') {
    fillPixel(ctx, offsetX + 7, top + 3);
  }
};

const drawTorsoAndArms = (
  { ctx, palette, offsetX }: DrawParams,
  armSwing: number,
  facing: 'down' | 'up' | 'side',
): void => {
  ctx.fillStyle = toCss(palette.shirt);
  fillPixel(ctx, offsetX + 3, 7, 6, 4);

  ctx.fillStyle = toCss(palette.skin);
  if (facing === 'side') {
    fillPixel(ctx, offsetX + 6, 8 + armSwing, 1, 2);
  } else {
    fillPixel(ctx, offsetX + 2, 8 + armSwing, 1, 2);
    fillPixel(ctx, offsetX + 9, 8 - armSwing, 1, 2);
  }
};

const drawLegs = (
  { ctx, palette, offsetX }: DrawParams,
  step: number,
): void => {
  ctx.fillStyle = toCss(palette.pants);
  const leftLegY = 11 + (step > 0 ? 0 : 0);
  const rightLegY = 11;
  fillPixel(ctx, offsetX + 3 + step, leftLegY, 2, 3);
  fillPixel(ctx, offsetX + 7 - step, rightLegY, 2, 3);

  ctx.fillStyle = '#241710';
  fillPixel(ctx, offsetX + 3 + step, leftLegY + 3, 2, 1);
  fillPixel(ctx, offsetX + 7 - step, rightLegY + 3, 2, 1);
};

const drawFrame = (
  ctx: CanvasRenderingContext2D,
  palette: VillagerPalette,
  frameIndex: number,
): void => {
  const offsetX = frameIndex * VILLAGER_SPRITE_WIDTH;
  const facingMap: Array<'down' | 'up' | 'side'> = ['down', 'down', 'up', 'up', 'side', 'side', 'side', 'side'];
  const facing = facingMap[frameIndex];
  const isWalking = frameIndex % 2 === 1;
  const armSwing = isWalking ? 1 : 0;
  const step = isWalking ? 1 : 0;
  const bob = isWalking ? -1 : 0;

  drawShadow(ctx, offsetX);
  drawHead({ ctx, palette, offsetX }, bob, facing);
  drawTorsoAndArms({ ctx, palette, offsetX }, armSwing, facing);
  drawLegs({ ctx, palette, offsetX }, step);

  if (frameIndex >= 4 && frameIndex <= 5) {
    flipFrameHorizontally(ctx, offsetX);
  }
};

const flipFrameHorizontally = (ctx: CanvasRenderingContext2D, offsetX: number): void => {
  const imageData = ctx.getImageData(offsetX, 0, VILLAGER_SPRITE_WIDTH, VILLAGER_SPRITE_HEIGHT);
  const flipped = ctx.createImageData(VILLAGER_SPRITE_WIDTH, VILLAGER_SPRITE_HEIGHT);
  for (let y = 0; y < VILLAGER_SPRITE_HEIGHT; y += 1) {
    for (let x = 0; x < VILLAGER_SPRITE_WIDTH; x += 1) {
      const srcIndex = (y * VILLAGER_SPRITE_WIDTH + x) * 4;
      const dstIndex = (y * VILLAGER_SPRITE_WIDTH + (VILLAGER_SPRITE_WIDTH - 1 - x)) * 4;
      flipped.data[dstIndex] = imageData.data[srcIndex];
      flipped.data[dstIndex + 1] = imageData.data[srcIndex + 1];
      flipped.data[dstIndex + 2] = imageData.data[srcIndex + 2];
      flipped.data[dstIndex + 3] = imageData.data[srcIndex + 3];
    }
  }
  ctx.putImageData(flipped, offsetX, 0);
};

export const createVillagerSpritesheetCanvas = (palette: VillagerPalette): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  canvas.width = VILLAGER_SPRITE_WIDTH * VILLAGER_FRAME_COUNT;
  canvas.height = VILLAGER_SPRITE_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return canvas;
  }
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let frame = 0; frame < VILLAGER_FRAME_COUNT; frame += 1) {
    drawFrame(ctx, palette, frame);
  }

  return canvas;
};
