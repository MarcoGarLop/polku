import { useCallback, useState } from 'react';
import { MapView, metricSpec, type MetricSpec } from './map/MapView';
import { SimProvider } from './state/sim';
import { useStore } from './state/store';
import { Header, Legend, RegionTable, Welcome } from './components/Overlays';
import { Tour } from './components/Tour';
import { SimulatorPanel, SimulatorResult } from './components/Simulator';
import { AskDrawer } from './components/AskPanel';
import { Assumptions } from './components/Assumptions';
import { SafeBoundary } from './components/SafeBoundary';

export default function App() {
  const mode = useStore((s) => s.mode);
  const [legend, setLegend] = useState<{ domain: [number, number]; spec: MetricSpec }>({ domain: [130, 180], spec: metricSpec('days', 'ALL') });
  const onDomain = useCallback((d: { domain: [number, number]; spec: MetricSpec }) => setLegend(d), []);
  return (
    <SimProvider>
      <div className={`app mode-${mode}`}>
        <a className="skip" href="#main-content">
          Skip to content
        </a>
        <div className="map-region" aria-label="3D map of Finland's wellbeing services counties. Use the table view for an accessible list." role="region">
          <MapView onDomain={onDomain} />
        </div>
        <Header />
        <main id="main-content">
          <SafeBoundary label="This view" key={mode}>
            {mode === 'welcome' && <Welcome />}
            {mode === 'tour' && <Tour />}
            {mode === 'sim' && (
              <>
                <SimulatorPanel />
                <SimulatorResult />
              </>
            )}
          </SafeBoundary>
        </main>
        {mode !== 'welcome' && (
          <div className="legend-dock">
            <Legend domain={legend.domain} spec={legend.spec} />
          </div>
        )}
        <div className="footer">Decision support for planners · Public aggregated data only · Not a medical device</div>
        <SafeBoundary label="Ask Polku">
          <AskDrawer />
        </SafeBoundary>
        <Assumptions />
        <RegionTable />
      </div>
    </SimProvider>
  );
}
