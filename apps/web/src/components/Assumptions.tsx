import { model } from '../state/sim';
import { useStore } from '../state/store';
import { Conf, SHORT, Src } from './ui';

export function Assumptions() {
  const show = useStore((s) => s.showAssumptions);
  const set = useStore((s) => s.set);
  if (!show) return null;
  const P = model.params;
  return (
    <div className="modal-back" onClick={() => set({ showAssumptions: false })}>
      <div className="modal glass" onClick={(e) => e.stopPropagation()}>
        <div className="row between">
          <h2 style={{ margin: 0 }}>Assumptions & sources</h2>
          <button className="btn" onClick={() => set({ showAssumptions: false })}>
            Close
          </button>
        </div>
        <p className="small muted">
          Every number has a source and a confidence level. Finland does not record symptom-to-treatment times, so phase durations are anchored to preliminary national
          figures and regional differences are modelled from public indicators (THL Sotkanet, Statistics Finland), calibrated so the national average matches. Parameter
          file: <code>data/seed/pathway_parameters.json</code> (v{P.version}).
        </p>

        <h3>Pathway phases (national means)</h3>
        <table>
          <thead>
            <tr><th>Phase</th><th>From → to</th><th>Days</th><th>Confidence</th><th>Source</th></tr>
          </thead>
          <tbody>
            {P.phases.map((p) => (
              <tr key={p.id}>
                <td><b>{p.id}</b> {p.label}</td>
                <td>{p.from} → {p.to}</td>
                <td>{p.meanDays}</td>
                <td><Conf c={p.confidence} /></td>
                <td><Src ids={[p.sourceId]} /></td>
              </tr>
            ))}
          </tbody>
        </table>

        <h3>Patient factors (equity)</h3>
        <table>
          <thead>
            <tr><th>Factor</th><th>Effect (multiplier on phase days)</th><th>Share of patients</th><th>Confidence</th><th>Source</th></tr>
          </thead>
          <tbody>
            <tr>
              <td>Occupational / private entry route</td>
              <td>P1–P2 ×0.52 · P3–P5 ×0.77 vs public (DLBCL Finland: 123 vs 207 d)</td>
              <td>{Math.round(P.shareOccupationalPrivate * 100)}% (lung patients mostly retired)</td>
              <td><Conf c="low" /></td>
              <td><Src ids={['S25']} /></td>
            </tr>
            {P.education.map((e) => (
              <tr key={e.id}>
                <td>{e.label}</td>
                <td>P1 ×{e.multipliers.P1} · P2 ×{e.multipliers.P2}</td>
                <td>{Math.round(e.share * 100)}%</td>
                <td><Conf c="assumption" /></td>
                <td><Src ids={['S26', 'S28']} /></td>
              </tr>
            ))}
            <tr>
              <td>{P.navigation.label}</td>
              <td>P1 ×{P.navigation.multipliers.P1} · P3 ×{P.navigation.multipliers.P3} · P5 ×{P.navigation.multipliers.P5} (hand-offs)</td>
              <td>{Math.round(P.navigation.share * 100)}% national, scaled by county age and language mix</td>
              <td><Conf c="assumption" /></td>
              <td><Src ids={['S27', 'S12']} /></td>
            </tr>
          </tbody>
        </table>

        <h3>Regional drivers (real public data, assumed elasticities)</h3>
        <table>
          <thead>
            <tr><th>Driver</th><th>Indicator</th><th>Elasticities</th><th>Source</th></tr>
          </thead>
          <tbody>
            {P.drivers.map((d) => (
              <tr key={d.id}>
                <td>{d.id}</td>
                <td>{d.indicator}</td>
                <td>{Object.entries(d.elasticities).map(([k, v]) => `${k} ${v}`).join(' · ')}</td>
                <td><Src ids={[d.sourceId]} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="tiny faint">Relative effect of non-distance indicators capped to ×0.5–×2. Distances are straight-line km from municipality centres, population-weighted.</p>

        <h3>Interventions</h3>
        <table>
          <thead>
            <tr><th>Action</th><th>Effect (range)</th><th>Effort</th><th>Confidence</th><th>Roadmap</th><th>Source</th></tr>
          </thead>
          <tbody>
            {P.interventions.map((iv) => (
              <tr key={iv.id}>
                <td>{SHORT[iv.id]}</td>
                <td>
                  {iv.effects
                    .map((e) =>
                      e.cvMultiplier
                        ? `uncertainty ×${e.cvMultiplier}`
                        : `${e.phase} −${Math.round((e.reduction ?? e.distanceReduction ?? 0) * 100)}%${e.distanceReduction ? ' of distance days' : ''}${e.range ? ` (${Math.round(e.range[0] * 100)}–${Math.round(e.range[1] * 100)})` : ''}${e.when ? ` if ${Object.entries(e.when).map(([k, v]) => `${k}=${v}`).join(',')}` : ''}`,
                    )
                    .join(' · ')}
                </td>
                <td>{iv.effort}</td>
                <td><Conf c={iv.confidence} /></td>
                <td>{iv.roadmapActions.map((a) => `${a.id} p.${a.page}`).join(', ')}</td>
                <td><Src ids={iv.sourceIds} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        <h3>What Polku does not do</h3>
        <p className="small muted">
          It does not predict survival or diagnose anyone, and it uses no patient records. It is decision support for planners, not a medical device. Benchmark: P3+P4+P5 ≤{' '}
          {P.benchmark.maxDays} days (Norway) <Src ids={['S06']} />.
        </p>
      </div>
    </div>
  );
}
