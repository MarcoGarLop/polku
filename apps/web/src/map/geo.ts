import { useEffect, useState } from 'react';

export type Position = [number, number];
export interface Geometry { type: 'MultiPolygon'; coordinates: Position[][][] }

export interface RegionFeature {
  type: 'Feature';
  geometry: Geometry;
  properties: { id: string; code: string; nameFi: string; nameEn: string; population: number; pct65: number; foreignPct: number; centroid: Position; distCentralKm: number; distRtKm: number };
}
export interface MunicipalityFeature {
  type: 'Feature';
  geometry: Geometry;
  properties: {
    code: string; name: string; nameSv: string; regionId: string; population: number; pct65: number; foreignPct: number;
    centroid: Position; distCentralKm: number; distRtKm: number; nearestRtHospital: string;
  };
}
export interface ContextFeature { type: 'Feature'; geometry: Geometry; properties: { kind: 'country' | 'aland'; id: string; name: string } }

export interface Geo {
  regions: RegionFeature[];
  municipalities: MunicipalityFeature[];
  context: ContextFeature[];
}

let cache: Promise<Geo> | null = null;

function loadGeo(): Promise<Geo> {
  if (!cache) {
    const get = (f: string) => fetch(`/data/${f}`).then((r) => r.json());
    cache = Promise.all([get('regions.geojson'), get('municipalities.geojson'), get('context.geojson')]).then(([r, m, c]) => ({
      regions: r.features,
      municipalities: m.features,
      context: c.features,
    }));
  }
  return cache;
}

export function useGeo(): Geo | null {
  const [geo, setGeo] = useState<Geo | null>(null);
  useEffect(() => {
    let alive = true;
    loadGeo().then((g) => alive && setGeo(g));
    return () => {
      alive = false;
    };
  }, []);
  return geo;
}

/** Outer rings of a multipolygon (for glowing outlines). */
export function outerRings(g: Geometry): Position[][] {
  return g.coordinates.map((poly) => poly[0]);
}
