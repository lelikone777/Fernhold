export interface DragVelocityConfig {
  smoothing: number;
  maxAbs: number;
}

export interface VelocityDecayConfig {
  frictionPerMs: number;
  minAbs: number;
}

export function hasExceededDragThreshold(
  startX: number,
  startY: number,
  currentX: number,
  currentY: number,
  thresholdPx: number,
): boolean {
  const dx = currentX - startX;
  const dy = currentY - startY;
  return dx * dx + dy * dy >= thresholdPx * thresholdPx;
}

export function toWorldDelta(deltaPixels: number, zoom: number): number {
  if (zoom <= 0) {
    return 0;
  }
  return deltaPixels / zoom;
}

export function blendVelocity(
  previous: number,
  deltaWorld: number,
  deltaMs: number,
  config: DragVelocityConfig,
): number {
  const safeDelta = Math.max(1, deltaMs);
  const instantaneous = deltaWorld / safeDelta;
  const smoothed = previous * (1 - config.smoothing) + instantaneous * config.smoothing;
  if (smoothed > config.maxAbs) {
    return config.maxAbs;
  }
  if (smoothed < -config.maxAbs) {
    return -config.maxAbs;
  }
  return smoothed;
}

export function decayVelocity(
  velocity: number,
  deltaMs: number,
  config: VelocityDecayConfig,
): number {
  const decay = Math.max(0, 1 - config.frictionPerMs * Math.max(0, deltaMs));
  const next = velocity * decay;
  if (Math.abs(next) < config.minAbs) {
    return 0;
  }
  return next;
}
