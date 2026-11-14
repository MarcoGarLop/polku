import { mulberry32 } from '@polku/sim';
import type { MunicipalityFeature, Position } from './geo';

export interface Trip {
  path: [number, number, number][];
  timestamps: number[];
  regionId: string;
  municipality: string;
  /** Mean days to treatment for this journey (drives speed and colour). */
  days: number;
}

export const LOOP = 3000;

/** Great-circle-ish arc lifted into the air: municipality → hospital. */
function arc(from: Position, to: Position, n = 28): [number, number, number][] {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const distKm = Math.hypot(dx * 55, dy * 111);
  const h = Math.min(90000, 12000 + distKm * 260);
  const pts: [number, number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push([from[0] + dx * t, from[1] + dy * t, Math.sin(Math.PI * t) * h]);
  }
  return pts;
}

/**
 * Synthetic patient journeys for the animation (illustrative, not data):
 * more particles from bigger municipalities; a journey takes longer where the modelled time to treatment is longer.
 */
export function buildTrips(
  munis: MunicipalityFeature[],
  hospitals: Map<string, Position>,
  daysFor: (m: MunicipalityFeature) => number,
): Trip[] {
  const rand = mulberry32(7);
  const trips: Trip[] = [];
  for (const m of munis) {
    const to = hospitals.get(m.properties.regionId);
    if (!to || !m.properties.population) continue;
    const from = m.properties.centroid;
    if (Math.hypot(from[0] - to[0], from[1] - to[1]) < 0.05) continue;
    const k = Math.max(1, Math.min(6, Math.round(Math.sqrt(m.properties.population) / 70)));
    const days = daysFor(m);
    const path = arc(from, to);
    const duration = days * 4.2; // 155 days ≈ 650 time units
    for (let j = 0; j < k; j++) {
      const t0 = rand() * LOOP;
      const ts = path.map((_, i) => t0 + (duration * i) / (path.length - 1));
      trips.push({ path, timestamps: ts, regionId: m.properties.regionId, municipality: m.properties.name, days });
      // wrap-around copy so the loop is seamless
      if (t0 + duration > LOOP) trips.push({ path, timestamps: ts.map((t) => t - LOOP), regionId: m.properties.regionId, municipality: m.properties.name, days });
    }
  }
  return trips;
}
