import { useEffect, useMemo, useState } from 'react';
import { DeckGL } from '@deck.gl/react';
import { GeoJsonLayer, PathLayer, ScatterplotLayer, TextLayer } from '@deck.gl/layers';
import { TripsLayer } from '@deck.gl/geo-layers';
import { AmbientLight, DirectionalLight, FlyToInterpolator, LightingEffect, type MapViewState, type PickingInfo } from '@deck.gl/core';
import { phaseMeans, resolveProfile, sumPhases, type PhaseId, type RegionResult } from '@polku/sim';
import { model, useSim } from '../state/sim';
import { useLensProfile, useStore, type MapMetric } from '../state/store';
import { DAYS_RAMP, GAP_RAMP, ramp, type RGB } from './colors';
import { buildTrips, LOOP } from './flows';
import { outerRings, useGeo, type Position } from './geo';

/* Calm overview: Finland centred, Sweden and Norway as quiet context. */
const OVERVIEW: MapViewState = { longitude: 23.2, latitude: 64.6, zoom: 4.55, pitch: 38, bearing: -8 };
const INTRO: MapViewState = { longitude: 20, latitude: 63.5, zoom: 3.4, pitch: 0, bearing: 0 };

// Tuned so flat tops keep their true ramp colour (~1.0 total) while the raised walls get readable shading.
const lighting = new LightingEffect({
  ambient: new AmbientLight({ color: [255, 255, 255], intensity: 1.0 }),
  key: new DirectionalLight({ color: [255, 248, 240], intensity: 0.85, direction: [-3, -6, -9] }),
  rim: new DirectionalLight({ color: [140, 170, 255], intensity: 0.35, direction: [4, 3, -2] }),
});
const MATERIAL = { ambient: 0.5, diffuse: 0.55, shininess: 24, specularColor: [25, 30, 40] as [number, number, number] };
/** Metres of height per day for the raised region: enough to read, not a wall. */
const RAISE_PER_DAY = 380;
const RAISE_PER_DAY_PHASE = 1000;
const RISE = { duration: 1100, easing: (t: number) => 1 - Math.pow(1 - t, 3) };

export interface MetricSpec {
  value: (r: RegionResult) => number;
  scale: number;
  ramp: RGB[];
  unit: string;
  label: string;
}

export function metricSpec(metric: MapMetric, phase: PhaseId | 'ALL'): MetricSpec {
  const phaseIdx = phase === 'ALL' ? -1 : ['P1', 'P2', 'P3', 'P4', 'P5'].indexOf(phase);
  switch (metric) {
    case 'gap':
      return { value: (r) => r.equityGapDays, scale: 900, ramp: GAP_RAMP, unit: 'days', label: 'Equity gap (days)' };
    default:
      return phaseIdx < 0
        ? { value: (r) => r.totalMeanDays, scale: RAISE_PER_DAY, ramp: DAYS_RAMP, unit: 'days', label: 'Days from first symptom to treatment' }
        : { value: (r) => r.phases[phaseIdx].meanDays, scale: RAISE_PER_DAY_PHASE, ramp: DAYS_RAMP, unit: 'days', label: `Days in phase ${phase}` };
  }
}

function domainOf(values: number[]): [number, number] {
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pad = (hi - lo) * 0.05 || 1;
  return [lo - pad, hi + pad];
}

const shortName = (n: string) => n.replace(/ wellbeing services county/i, '');

export function MapView({ onDomain }: { onDomain?: (d: { domain: [number, number]; spec: MetricSpec }) => void }) {
  const geo = useGeo();
  const sim = useSim();
  const mode = useStore((s) => s.mode);
  const metric = useStore((s) => s.metric);
  const phase = useStore((s) => s.phase);
  const raised = useStore((s) => s.selectedRegion);
  const selectRegion = useStore((s) => s.selectRegion);
  const interventions = useStore((s) => s.interventions);
  const step = useStore((s) => s.step);
  const profileA = useStore((s) => s.profileA);
  const profileB = useStore((s) => s.profileB);
  const lensProfile = useLensProfile();
  const lensName = mode === 'sim' ? 'your patient' : 'Patient B';
  const reduceMotion = useMemo(() => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches, []);
  const showFlows = !reduceMotion;
  const dur = (ms: number) => (reduceMotion ? 0 : ms);

  const [viewState, setViewState] = useState<MapViewState>(reduceMotion ? OVERVIEW : INTRO);
  const [time, setTime] = useState(0);
  const [hover, setHover] = useState<string | null>(null);

  // the camera flies in once the intro animation has finished
  const introDone = useStore((s) => s.introDone);
  useEffect(() => {
    if (reduceMotion || !introDone) return;
    const t = setTimeout(
      () => setViewState({ ...OVERVIEW, transitionDuration: 2600, transitionInterpolator: new FlyToInterpolator({ speed: 0.9 }) } as MapViewState),
      150,
    );
    return () => clearTimeout(t);
  }, [reduceMotion, introDone]);

  // Camera follows the raised region
  useEffect(() => {
    if (!geo) return;
    if (!raised) {
      setViewState((v) => ({ ...v, ...OVERVIEW, transitionDuration: dur(1500), transitionInterpolator: new FlyToInterpolator() } as MapViewState));
      return;
    }
    const f = geo.regions.find((r) => r.properties.id === raised);
    if (!f) return;
    const [lon, lat] = f.properties.centroid;
    const zoom = raised === 'lappi' ? 4.95 : ['helsinki', 'vantaa-kerava'].includes(raised) ? 7.3 : 6.1;
    // keep the region slightly right of centre so the story card on the left never covers it
    setViewState((v) => ({
      ...v, longitude: lon - (zoom < 6 ? 3.4 : 1.2), latitude: lat - (zoom < 6 ? 0.2 : 0.3), zoom, pitch: 46, bearing: -10,
      transitionDuration: dur(1800), transitionInterpolator: new FlyToInterpolator({ speed: 1.1 }),
    } as MapViewState));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raised, geo]);

  // Animation clock (journeys + breathing halo)
  useEffect(() => {
    if (reduceMotion) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(64, now - last);
      last = now;
      setTime((t) => (t + dt * 0.12) % LOOP);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduceMotion]);

  const spec = useMemo(() => metricSpec(metric, phase), [metric, phase]);
  const patientMode = metric === 'patient';

  const regionDomain = useMemo(() => domainOf(sim.base.map(spec.value)), [sim.base, spec]);
  const regionValue = (id: string) => {
    const r = sim.byId.get(id);
    return r ? spec.value(r) : 0;
  };

  const muniValue = (m: { properties: { regionId: string; distCentralKm: number } }, ivs: string[]) => {
    const prof = resolveProfile(model, { ...lensProfile, regionId: m.properties.regionId, distanceKm: m.properties.distCentralKm });
    const pm = phaseMeans(model, prof, ivs);
    return phase === 'ALL' ? sumPhases(pm.mean) : pm.mean[phase];
  };
  const muniDays = useMemo(() => {
    const map = new Map<string, number>();
    geo?.municipalities.forEach((m) => map.set(m.properties.code, muniValue(m, interventions)));
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geo, lensProfile, interventions, phase]);
  /** Fixed colour scale from the best-placed (Patient A) to the worst-placed (Patient B) patient, so improvements visibly turn green. */
  const muniDomain = useMemo(() => {
    if (!geo) return [0, 1] as [number, number];
    const val = (p: typeof profileA) => (m: (typeof geo.municipalities)[number]) => {
      const pm = phaseMeans(model, resolveProfile(model, { ...p, regionId: m.properties.regionId, distanceKm: m.properties.distCentralKm }), []);
      return phase === 'ALL' ? sumPhases(pm.mean) : pm.mean[phase];
    };
    return domainOf([...geo.municipalities.map(val(profileA)), ...geo.municipalities.map(val(profileB))]);
  }, [geo, profileA, profileB, phase]);
  const muniScale = phase === 'ALL' ? RAISE_PER_DAY : RAISE_PER_DAY_PHASE;

  const domain = patientMode ? muniDomain : regionDomain;
  useEffect(
    () => onDomain?.({ domain, spec: patientMode ? { ...spec, label: `Days to treatment for ${lensName} if living in each municipality` } : { ...spec, label: 'Average days from first symptom to treatment, by region' } }),
    [domain, spec, patientMode, lensName, onDomain],
  );

  const colorFor = (v: number): RGB => ramp(spec.ramp, (v - domain[0]) / (domain[1] - domain[0]));
  /** Only the raised region has height; everything else lies flat. */
  const regionTop = (id: string) => (id === raised && !patientMode ? regionValue(id) * spec.scale : 0);
  const muniTop = (code: string, regionId: string) => (regionId === raised ? (muniDays.get(code) ?? 0) * muniScale : 0);

  const hospitals = useMemo(() => model.regions.map((r) => ({ ...r.hospital, regionId: r.id })), []);
  const hospitalPos = useMemo(() => new Map<string, Position>(hospitals.map((h) => [h.regionId, [h.lon, h.lat]])), [hospitals]);
  const raisedHospital = hospitals.find((h) => h.regionId === raised);
  const hospitalTop = raisedHospital ? (patientMode ? 0 : regionTop(raisedHospital.regionId)) : 0;

  /* Journeys only inside the raised region: a calm map with one story at a time. */
  const trips = useMemo(() => {
    if (!geo || !raised) return [];
    const munis = geo.municipalities.filter((m) => m.properties.regionId === raised);
    const top = patientMode ? 0 : regionValue(raised) * spec.scale;
    return buildTrips(munis, hospitalPos, (m) => (patientMode ? muniDays.get(m.properties.code) ?? 150 : sim.byId.get(raised)?.totalMeanDays ?? 150)).map((t) => {
      const m = munis.find((x) => x.properties.name === t.municipality);
      const fromTop = patientMode && m ? muniTop(m.properties.code, raised) : top;
      const n = t.path.length - 1;
      return { ...t, path: t.path.map(([x, y, z], i) => [x, y, z * 0.7 + fromTop + ((top - fromTop) * i) / n + 1500] as [number, number, number]) };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geo, raised, hospitalPos, patientMode, muniDays, sim.byId, spec]);

  const raisedFeature = useMemo(() => (geo && raised ? geo.regions.find((r) => r.properties.id === raised) : undefined), [geo, raised]);
  const raisedRings = useMemo(() => (raisedFeature ? outerRings(raisedFeature.geometry) : []), [raisedFeature]);

  if (!geo) return <div className="map-loading">Loading Finland…</div>;

  const dimFor = (id: string) => (raised && id !== raised ? 0.62 : 1);

  const layers = [
    new GeoJsonLayer({
      id: 'context',
      data: geo.context,
      filled: true,
      stroked: true,
      getFillColor: (f: any) => (f.properties.kind === 'aland' ? [22, 32, 52, 255] : [15, 23, 40, 255]),
      getLineColor: [40, 56, 86, 255],
      lineWidthMinPixels: 1,
    }),
    new TextLayer({
      id: 'country-labels',
      data: [
        { name: 'SWEDEN', pos: [15.6, 63.2] },
        { name: 'NORWAY', pos: [12.4, 66.6] },
      ],
      getPosition: (d: any) => d.pos,
      getText: (d: any) => d.name,
      getSize: 12,
      getColor: [90, 108, 138, 200],
      fontFamily: '"Inter Variable", Inter, system-ui, sans-serif',
      fontWeight: 700,
      fontSettings: { sdf: true },
      characterSet: 'auto',
    }),
    !patientMode &&
      new GeoJsonLayer({
        id: 'regions',
        data: geo.regions as any,
        extruded: true,
        filled: true,
        stroked: true,
        pickable: true,
        autoHighlight: true,
        highlightColor: [255, 255, 255, 60],
        material: MATERIAL,
        getElevation: (f: any) => regionTop(f.properties.id),
        getFillColor: (f: any) => {
          const c = colorFor(regionValue(f.properties.id));
          const k = dimFor(f.properties.id);
          return [c[0] * k, c[1] * k, c[2] * k, 255];
        },
        getLineColor: [5, 9, 18, 255],
        lineWidthMinPixels: 1,
        transitions: { getElevation: RISE, getFillColor: { duration: 700 } },
        updateTriggers: { getElevation: [raised, sim.current, spec], getFillColor: [sim.current, spec, raised, domain] },
        onClick: (info: PickingInfo) => info.object && selectRegion((info.object as any).properties.id),
        onHover: (info: PickingInfo) => setHover(info.object ? (info.object as any).properties.id : null),
      }),
    patientMode &&
      new GeoJsonLayer({
        id: 'municipalities',
        data: geo.municipalities as any,
        extruded: true,
        filled: true,
        stroked: true,
        pickable: true,
        autoHighlight: true,
        highlightColor: [255, 255, 255, 70],
        material: MATERIAL,
        getElevation: (f: any) => muniTop(f.properties.code, f.properties.regionId),
        getFillColor: (f: any) => {
          const c = colorFor(muniDays.get(f.properties.code) ?? 0);
          const k = dimFor(f.properties.regionId);
          return [c[0] * k, c[1] * k, c[2] * k, 255];
        },
        getLineColor: [5, 9, 18, 160],
        lineWidthMinPixels: 0.4,
        transitions: { getElevation: RISE, getFillColor: { duration: 700 } },
        updateTriggers: { getElevation: [muniDays, raised], getFillColor: [muniDays, raised, domain] },
        onClick: (info: PickingInfo) => info.object && selectRegion((info.object as any).properties.regionId),
        onHover: (info: PickingInfo) => setHover(info.object ? `m:${(info.object as any).properties.code}` : null),
      }),
    raisedFeature &&
      new PathLayer({
        id: 'raised-outline',
        data: raisedRings,
        getPath: (ring: any) => ring.map(([x, y]: Position) => [x, y, patientMode ? 300 : regionTop(raisedFeature.properties.id) + 300]),
        getColor: [255, 255, 255, 220],
        widthMinPixels: 2,
        updateTriggers: { getPath: [sim.current, spec, patientMode, raised] },
      }),
    showFlows &&
      trips.length > 0 &&
      new TripsLayer({
        id: 'journeys',
        data: trips,
        getPath: (d: any) => d.path,
        getTimestamps: (d: any) => d.timestamps,
        getColor: (d: any) => {
          const c = ramp(DAYS_RAMP, (d.days - domain[0]) / (domain[1] - domain[0]));
          return [Math.min(255, c[0] + 70), Math.min(255, c[1] + 70), Math.min(255, c[2] + 70)];
        },
        widthMinPixels: 2.4,
        capRounded: true,
        jointRounded: true,
        fadeTrail: true,
        trailLength: 140,
        currentTime: time,
        updateTriggers: { getColor: [domain] },
      }),
    raisedHospital &&
      new ScatterplotLayer({
        id: 'hospital-halo',
        data: [raisedHospital],
        getPosition: (h: any) => [h.lon, h.lat, hospitalTop + 800],
        getRadius: 14000 * (1 + 0.3 * Math.sin(time / 50)),
        radiusMinPixels: 9,
        getFillColor: [45, 212, 191, 70],
        updateTriggers: { getPosition: [hospitalTop], getRadius: [Math.round(time / 3)] },
      }),
    new ScatterplotLayer({
      id: 'hospitals',
      data: hospitals,
      pickable: true,
      getPosition: (h: any) => [h.lon, h.lat, h.regionId === raised ? hospitalTop + 900 : 200],
      getRadius: (h: any) => (h.type === 'university' ? 4200 : 2800),
      radiusMinPixels: 2.5,
      stroked: true,
      getFillColor: (h: any) => (h.regionId === raised ? [94, 234, 212, 255] : [226, 232, 240, raised ? 120 : 200]),
      getLineColor: [5, 9, 18, 255],
      lineWidthMinPixels: 1,
      updateTriggers: { getPosition: [hospitalTop, raised], getFillColor: [raised] },
      onHover: (info: PickingInfo) => setHover(info.object ? `h:${(info.object as any).id}` : null),
    }),
    raisedFeature &&
      new TextLayer({
        id: 'raised-label',
        data: [raisedFeature],
        getPosition: (f: any) => {
          const top = patientMode ? (Math.max(...geo.municipalities.filter((m) => m.properties.regionId === raised).map((m) => muniTop(m.properties.code, raised!)))) : regionTop(f.properties.id);
          return [f.properties.centroid[0], f.properties.centroid[1], top + 14000] as [number, number, number];
        },
        getText: (f: any) => {
          const name = shortName(sim.byId.get(f.properties.id)?.nameEn ?? f.properties.nameEn);
          return patientMode ? name : `${name} · ${Math.round(regionValue(f.properties.id))} ${spec.unit === 'days' ? 'days' : ''}`;
        },
        getSize: 16,
        getColor: [241, 245, 249, 255],
        fontFamily: '"Inter Variable", Inter, system-ui, sans-serif',
        fontWeight: 700,
        characterSet: 'auto',
        background: true,
        getBackgroundColor: [7, 11, 20, 200],
        backgroundPadding: [8, 5, 8, 5],
        billboard: true,
        updateTriggers: { getPosition: [sim.current, spec, muniDays], getText: [sim.current, spec, patientMode] },
      }),
  ].filter(Boolean);

  return (
    <div className="map-wrap">
      <DeckGL
        viewState={viewState}
        onViewStateChange={({ viewState: v }) => setViewState(v as MapViewState)}
        controller={{ dragRotate: true, touchRotate: true, inertia: 300 }}
        layers={layers as any}
        effects={[lighting]}
        getCursor={({ isHovering, isDragging }) => (isDragging ? 'grabbing' : isHovering ? 'pointer' : 'grab')}
        style={{ background: 'transparent' }}
        // first frame with the map drawn = heavy tessellation done; the intro can now animate smoothly
        onAfterRender={() => {
          if (geo && !useStore.getState().mapReady) setTimeout(() => useStore.getState().set({ mapReady: true }), 120);
        }}
      />
      {hover && <Tooltip id={hover} geo={geo} muniDays={muniDays} spec={spec} lens={lensName} />}
    </div>
  );
}

function Tooltip({ id, geo, muniDays, spec, lens }: { id: string; geo: NonNullable<ReturnType<typeof useGeo>>; muniDays: Map<string, number>; spec: MetricSpec; lens: string }) {
  const sim = useSim();
  if (id.startsWith('h:')) {
    const h = model.regions.find((r) => r.hospital.id === id.slice(2))?.hospital;
    if (!h) return null;
    return (
      <div className="map-tooltip">
        <div className="tt-title">{h.name}</div>
        <div className="tt-sub">{h.type === 'university' ? 'University hospital' : 'Central hospital'} · {h.city}</div>
      </div>
    );
  }
  if (id.startsWith('m:')) {
    const m = geo.municipalities.find((x) => x.properties.code === id.slice(2));
    if (!m) return null;
    return (
      <div className="map-tooltip">
        <div className="tt-title">{m.properties.name}</div>
        <div className="tt-sub">{m.properties.distCentralKm} km to hospital</div>
        <div className="tt-big">
          {Math.round(muniDays.get(m.properties.code) ?? 0)} <span>days for {lens}</span>
        </div>
        <div className="tt-est">Estimate</div>
      </div>
    );
  }
  const r = sim.byId.get(id);
  if (!r) return null;
  return (
    <div className="map-tooltip">
      <div className="tt-title">{r.nameEn}</div>
      <div className="tt-big">
        {Math.round(spec.value(r)).toLocaleString('en')} <span>{spec.unit}</span>
      </div>
      <div className="tt-est">Estimate · click to raise</div>
    </div>
  );
}
