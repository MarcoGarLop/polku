export type RGB = [number, number, number];
export type RGBA = [number, number, number, number];

const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

/** Sequential "time" ramp: teal (fast) → amber → rose (slow). Tuned for a dark navy background. */
export const DAYS_RAMP = ['#0f766e', '#14b8a6', '#a3e635', '#facc15', '#fb923c', '#f43f5e', '#be123c'].map(hex);
/** Equity ramp: cool → violet → magenta. */
export const GAP_RAMP = ['#1e3a8a', '#3b82f6', '#818cf8', '#c084fc', '#e879f9', '#f472b6'].map(hex);

export function ramp(stops: RGB[], t: number): RGB {
  const x = Math.min(1, Math.max(0, t)) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(x));
  const f = x - i;
  const a = stops[i];
  const b = stops[i + 1];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}

export const rgbCss = (c: RGB | number[], a = 1) => `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${a})`;

export const COLORS = {
  a: hex('#22d3ee'),
  b: hex('#fb7185'),
  teal: hex('#2dd4bf'),
  amber: hex('#f59e0b'),
  patientDelay: hex('#f59e0b'),
  systemDelay: hex('#60a5fa'),
  land: hex('#0e1729'),
  landLine: hex('#1f2d47'),
  white: hex('#e6edf7'),
};
