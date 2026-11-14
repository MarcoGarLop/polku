import type { EducationId, PatientProfile, RouteId } from '@polku/sim';
import { model, useSim } from '../state/sim';
import { MATTI_A, MATTI_B, useStore, type Lens } from '../state/store';
import { StepTimeline } from './StepTimeline';
import { Bar, d0, Est, FACTOR_COLOR, pct, Real, Src } from './ui';

const regionsSorted = [...model.regions].sort((a, b) => a.nameEn.localeCompare(b.nameEn));

function ProfileCard({ which, profile, total }: { which: Lens; profile: PatientProfile; total: number }) {
  const setProfile = useStore((s) => s.setProfile);
  const color = which === 'A' ? 'var(--a)' : 'var(--b)';
  return (
    <div className={`profile ${which}`}>
      <div className="profile-head">
        <div className="profile-name">
          <span className="pill-letter" style={{ background: color }}>{which}</span>
          Matti {which}
        </div>
        <div className="profile-total" style={{ color }}>
          {d0(total)}
          <span className="tiny muted"> d</span>
        </div>
      </div>
      <div className="field">
        <label>Lives in</label>
        <select value={profile.regionId} onChange={(e) => setProfile(which, { regionId: e.target.value, distanceKm: model.byId.get(e.target.value)!.kmCentral })}>
          {regionsSorted.map((r) => (
            <option key={r.id} value={r.id}>
              {r.nameEn}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label>Distance to hospital · {d0(profile.distanceKm ?? 0)} km</label>
        <input type="range" min={5} max={400} step={5} value={profile.distanceKm ?? 40} onChange={(e) => setProfile(which, { distanceKm: +e.target.value })} />
      </div>
      <div className="field">
        <label>Enters care via</label>
        <select value={profile.route} onChange={(e) => setProfile(which, { route: e.target.value as RouteId })}>
          <option value="occupational_private">Occupational / private</option>
          <option value="public">Public health centre</option>
        </select>
      </div>
      <div className="field">
        <label>Education</label>
        <select value={profile.education} onChange={(e) => setProfile(which, { education: e.target.value as EducationId })}>
          <option value="basic">Basic</option>
          <option value="secondary">Secondary</option>
          <option value="tertiary">Higher</option>
        </select>
      </div>
      <label className="switch">
        <input type="checkbox" checked={profile.navigationBarrier} onChange={(e) => setProfile(which, { navigationBarrier: e.target.checked })} />
        Lives alone, other language or 75+
      </label>
    </div>
  );
}

export function ComparePanel() {
  const sim = useSim();
  const set = useStore((s) => s.set);
  const profileA = useStore((s) => s.profileA);
  const profileB = useStore((s) => s.profileB);
  const metric = useStore((s) => s.metric);
  const lens = useStore((s) => s.lens);
  const interventions = useStore((s) => s.interventions);
  const c = sim.comparison;
  const c0 = sim.comparisonBase;
  const gap = c.gapDays;
  const regionA = model.byId.get(profileA.regionId)!.nameEn;
  const regionB = model.byId.get(profileB.regionId)!.nameEn;
  const attribution = [...c.attribution].sort((x, y) => Math.abs(y.days) - Math.abs(x.days));
  const maxAttr = Math.max(1, ...attribution.map((f) => Math.abs(f.days)));
  const closed = c0.gapDays - c.gapDays;

  return (
    <div className="fade-in">
      <div className="row between">
        <span className="tiny muted" style={{ textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>
          Same cancer. Same chance?
        </span>
        <Est />
      </div>
      <div className="headline">
        {gap >= 0 ? (
          <>
            Matti B starts treatment <span className="num">{d0(gap)} days</span> later than Matti A
          </>
        ) : (
          <>Matti B starts treatment {d0(-gap)} days earlier</>
        )}
      </div>
      <div className="sub-headline">
        Same lung cancer, same symptoms. <b style={{ color: 'var(--text)' }}>{pct(Math.max(0, c.shareBeforeReferral))}</b> of the gap opens before the
        referral reaches a specialist.
        {interventions.length > 0 && closed > 0.5 && (
          <>
            {' '}
            Active actions close <b style={{ color: 'var(--good)' }}>{d0(closed)} days</b> of it.
          </>
        )}
      </div>

      <div className="profiles">
        <ProfileCard which="A" profile={profileA} total={c.a.totalMeanDays} />
        <ProfileCard which="B" profile={profileB} total={c.b.totalMeanDays} />
      </div>
      <div className="btn-row">
        <button className="btn" onClick={() => set({ profileA: MATTI_A, profileB: MATTI_B })}>
          Reset to the two Mattis
        </button>
        <button
          className={`btn ${metric === 'patient' && lens === 'B' ? 'primary' : 'lensB'}`}
          onClick={() => set({ metric: 'patient', lens: 'B', selectedRegion: null })}
          title="Recolours every municipality with the days Matti B would wait if he lived there"
        >
          See Finland through B's eyes
        </button>
      </div>

      <h3>
        Journey over the 8 steps <span className="faint" style={{ textTransform: 'none', letterSpacing: 0 }}>{regionA} vs {regionB}</span>
      </h3>
      <StepTimeline a={c.a} b={c.b} />

      <h3>Why the gap? (each factor's share)</h3>
      {attribution.map((f) => (
        <Bar
          key={f.factor}
          label={<span className="small">{f.label}</span>}
          value={Math.abs(f.days)}
          max={maxAttr}
          color={FACTOR_COLOR[f.factor]}
          right={<span>{f.days >= 0 ? '+' : '−'}{d0(Math.abs(f.days))} d</span>}
        />
      ))}
      <div className="tiny faint" style={{ marginTop: 4 }}>
        Exact Shapley decomposition over five factors. Entry route: Finnish DLBCL data <Src ids={['S25']} />, applied to lung cancer as an assumption. Education and
        navigation effects: stated assumptions <Src ids={['S26', 'S27']} />.
      </div>

      <h3>Treated within 42 days of referral</h3>
      <Bar label={<span className="small" style={{ color: 'var(--a)' }}>Matti A</span>} value={c.a.distribution.pctWithinTarget} max={1} color="var(--a)" right={pct(c.a.distribution.pctWithinTarget)} />
      <Bar label={<span className="small" style={{ color: 'var(--b)' }}>Matti B</span>} value={c.b.distribution.pctWithinTarget} max={1} color="var(--b)" right={pct(c.b.distribution.pctWithinTarget)} />
      <div className="tiny faint">Share of 4 000 simulated patients like each Matti. Nordic benchmark: Norway ≤42 d from referral <Src ids={['S06']} />.</div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="row between">
          <b style={{ fontSize: 13 }}>Why days matter</b>
          <Real />
        </div>
        <div className="small muted" style={{ marginTop: 4 }}>Finland, all cancers 2000–2019 (N = 469 522): higher vs lower education</div>
        <Bar label={<span className="small">Received surgery</span>} value={0.51} max={0.6} color="var(--good)" right="51% vs 36%" />
        <Bar label={<span className="small">Died of cancer</span>} value={0.47} max={0.6} color="var(--bad)" right="27% vs 47%" />
        <div className="tiny faint">
          Zai et al., BMJ Public Health 2025 <Src ids={['S26']} />. Living &gt;50 km from hospital: HR 1.47 for 12-month lung cancer mortality <Src ids={['S18']} />.
        </div>
      </div>
    </div>
  );
}
