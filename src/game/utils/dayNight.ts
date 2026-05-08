export interface DayNightTint {
  color: number;
  alpha: number;
}

interface Stop {
  t: number;
  color: number;
  alpha: number;
}

const STOPS: Stop[] = [
  { t: 0.0, color: 0x2a3a78, alpha: 0.45 },
  { t: 0.18, color: 0xe8a070, alpha: 0.22 },
  { t: 0.32, color: 0xffffff, alpha: 0.0 },
  { t: 0.62, color: 0xffffff, alpha: 0.0 },
  { t: 0.78, color: 0xff8a55, alpha: 0.28 },
  { t: 0.92, color: 0x3a3a90, alpha: 0.5 },
  { t: 1.0, color: 0x2a3a78, alpha: 0.45 },
];

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

const lerpChannel = (a: number, b: number, t: number): number => Math.round(lerp(a, b, t));

const lerpColor = (a: number, b: number, t: number): number => {
  const ar = (a >> 16) & 0xff;
  const ag = (a >> 8) & 0xff;
  const ab = a & 0xff;
  const br = (b >> 16) & 0xff;
  const bg = (b >> 8) & 0xff;
  const bb = b & 0xff;
  return (lerpChannel(ar, br, t) << 16) | (lerpChannel(ag, bg, t) << 8) | lerpChannel(ab, bb, t);
};

export const computeDayNightTint = (timeOfDay: number): DayNightTint => {
  const t = ((timeOfDay % 1) + 1) % 1;
  for (let i = 0; i < STOPS.length - 1; i += 1) {
    const a = STOPS[i];
    const b = STOPS[i + 1];
    if (t >= a.t && t <= b.t) {
      const local = (t - a.t) / (b.t - a.t || 1);
      return {
        color: lerpColor(a.color, b.color, local),
        alpha: lerp(a.alpha, b.alpha, local),
      };
    }
  }
  return { color: STOPS[0].color, alpha: STOPS[0].alpha };
};
