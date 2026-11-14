import { useCallback, useState } from 'react';
import { MapView, metricSpec, type MetricSpec } from './map/MapView';
import { SimProvider } from './state/sim';
import { useStore, type PanelTab } from './state/store';
import { Header, ExploreBar, Legend, Counter } from './components/Overlays';
import { Story } from './components/Story';
import { ComparePanel } from './components/ComparePanel';
import { RegionPanel } from './components/RegionPanel';
import { ActPanel } from './components/ActPanel';
import { AskPanel } from './components/AskPanel';
import { Assumptions } from './components/Assumptions';
import { SafeBoundary } from './components/SafeBoundary';

// Explore keeps three questions: where am I? what do I do? ask anything. (The two-patient story lives in story mode.)
const TABS: { id: PanelTab; label: string }[] = [
  { id: 'region', label: 'County' },
  { id: 'act', label: 'Plan' },
  { id: 'ask', label: 'Ask Polku' },
];

function SidePanel() {
  const tab = useStore((s) => s.tab);
  const set = useStore((s) => s.set);
  return (
    <aside className="side glass fade-in">
      <nav className="tabs">
        {TABS.map((t) => (
          <button key={t.id} className={`tab ${tab === t.id ? 'on' : ''}`} onClick={() => set({ tab: t.id })}>
            {t.label}
          </button>
        ))}
      </nav>
      <div className="side-body">
        <SafeBoundary label="This panel" key={tab}>
          {tab === 'compare' && <ComparePanel />}
          {tab === 'region' && <RegionPanel />}
          {tab === 'act' && <ActPanel />}
          {tab === 'ask' && <AskPanel />}
        </SafeBoundary>
      </div>
    </aside>
  );
}

export default function App() {
  const mode = useStore((s) => s.mode);
  const set = useStore((s) => s.set);
  const [legend, setLegend] = useState<{ domain: [number, number]; spec: MetricSpec }>({ domain: [130, 180], spec: metricSpec('days', 'ALL') });
  const onDomain = useCallback((d: { domain: [number, number]; spec: MetricSpec }) => setLegend(d), []);
  return (
    <SimProvider>
      <div className={`app mode-${mode}`}>
        <MapView onDomain={onDomain} />
        <Header />
        {mode === 'story' ? (
          <SafeBoundary label="The story">
            <Story />
          </SafeBoundary>
        ) : (
          <>
            <ExploreBar />
            <SidePanel />
            <div className="explore-bottom">
              <Counter />
            </div>
          </>
        )}
        <div className="legend-dock">
          <Legend domain={legend.domain} spec={legend.spec} />
        </div>
        <div className="footer">
          <span>Decision support for planners · Public aggregated data only · Not a medical device</span>
          <button className="linkish" onClick={() => set({ showAssumptions: true })}>
            Every number has a source →
          </button>
        </div>
        <Assumptions />
      </div>
    </SimProvider>
  );
}
