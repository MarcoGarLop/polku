# 03 · Arquitectura técnica

## Estructura del repositorio (monorepo con npm workspaces)

```
polku/
├─ CLAUDE.md
├─ README.md                 # en inglés: problema, demo, cómo ejecutar, fuentes, límites, uso de Gemini
├─ .env.example              # GEMINI_API_KEY=, GEMINI_MODEL=, DEMO_MODE=
├─ docs/                     # este contexto
├─ data/
│  ├─ seed/                  # parámetros y regiones curados a mano (fuente de verdad)
│  ├─ raw/                   # descargas originales (CSV/JSON/GeoJSON), sin tocar
│  └─ processed/             # salidas de scripts: regions.geojson, indicators.json, distances.json
├─ scripts/                  # Node/TS: fetch-statfin.ts, fetch-sotkanet.ts, build-geo.ts, build-distances.ts
├─ packages/
│  └─ sim/                   # motor de simulación TS puro (sin dependencias de UI), con tests (vitest)
│     ├─ src/model.ts        # medias regionales, modificadores, calibración
│     ├─ src/montecarlo.ts   # lognormal, muestreo, percentiles, PRNG con semilla
│     ├─ src/interventions.ts
│     └─ src/index.ts        # API pública: simulateRegion, simulateAll, compareScenarios, explainRegion
├─ apps/
│  ├─ web/                   # Vite + React + TS + deck.gl + Tailwind
│  │  └─ src/{components,layers,state,api}/
│  └─ server/                # Node + TS (Fastify o Express) + @google/genai
│     ├─ src/agent.ts        # bucle de function calling
│     ├─ src/tools.ts        # declaraciones de herramientas → packages/sim
│     ├─ src/context.ts      # carga y cachea la estrategia y la hoja de ruta (contexto largo)
│     ├─ src/cache.ts        # caché de respuestas para el modo demo
│     └─ src/routes.ts       # /api/agent, /api/plan, /api/health
└─ demo/
   └─ cached-responses.json  # respuestas de Gemini grabadas para el guion de la demo
```

## Contratos de datos (TypeScript)

```ts
type PhaseId = 'P1' | 'P2' | 'P3' | 'P4' | 'P5';
type Confidence = 'high' | 'medium' | 'low' | 'assumption';

interface RegionInputs {
  id: string; nameEn: string; population: number;
  indicators: Partial<Record<'pc_access'|'spec_wait'|'dist_central'|'dist_rt'|'ses', number>>;
  confidence: Confidence;
}

interface Scenario { regionId: string | 'ALL'; interventions: string[]; overrides?: Record<string, number>; seed?: number; }

interface PhaseResult { phase: PhaseId; meanDays: number; p10: number; p50: number; p90: number; distanceComponentDays: number; confidence: Confidence; sourceIds: string[]; }

interface RegionResult {
  regionId: string; totalMeanDays: number; totalP10: number; totalP90: number;
  pctWithinTarget: number;               // P3+P4+P5 <= benchmark.max_days
  phases: PhaseResult[];
  drivers: { driver: string; extraDays: number }[];   // atribución vs media nacional
  annualCases: number;
}

interface Comparison { base: RegionResult; scenario: RegionResult; daysSaved: number; deltaPctWithinTarget: number; }
```

## Motor de simulación: requisitos
- Puro, determinista con semilla (PRNG tipo mulberry32), sin `Math.random`.
- `simulateAll` para 22 regiones × 5 000 pacientes en < 150 ms en el navegador (si no, usar Web Worker o bajar a 2 000).
- Tests: la media ponderada nacional reproduce las medias de fase (±1 d); quitar todos los modificadores → todas las regiones iguales; intervenciones con rendimientos decrecientes (nunca reducción > 100 %).
- Cálculo exacto descrito en `04_modelo_simulacion.md`.

## Frontend: capas deck.gl
| Capa | Datos | Uso |
|---|---|---|
| `GeoJsonLayer` (extruded) o `PolygonLayer` | polígonos de las regiones | altura = días (fase seleccionada), color secuencial; `onClick` → región |
| `ColumnLayer` (alternativa) | centroides | si la extrusión de polígonos queda rara |
| `ScatterplotLayer` + `TextLayer` | hospitales | universitario vs central; anillo = radioterapia |
| `TripsLayer` (SHOULD) | trayectos sintéticos municipio→hospital | animación de pacientes; velocidad ∝ días simulados |
| `ArcLayer` (opcional) | flujos región→hospital universitario | centralización |

- Cámara inicial: Finlandia completa inclinada (pitch ~45°, bearing ~-10°). `FlyToInterpolator` al seleccionar región.
- Mapa base MapLibre opcional; **fallback sin teselas** (fondo oscuro + polígonos) para trabajar offline.
- Estado global con Zustand (región seleccionada, fase, intervenciones activas, overrides de supuestos).

## Servidor y API
- `POST /api/agent` `{ messages, regionId?, scenario? }` → `{ text, citations[], toolCalls[], mapCommands[] }`. `mapCommands` (p. ej. `{type:'flyTo', regionId}`, `{type:'setPhase', phase}`, `{type:'toggleIntervention', id}`) permite que el agente **mueva la UI**.
- `POST /api/plan` `{ regionId, interventions[] }` → JSON estructurado del plan (esquema en `06_gemini.md`) → la UI lo renderiza como página imprimible (`window.print()` con CSS de impresión basta; PDF real solo si sobra tiempo).
- `GET /api/health`.
- `DEMO_MODE=true` → responde desde `demo/cached-responses.json` si la pregunta coincide (normalizada); si no, llama a Gemini.

## Opcional: Aiven
- Aiven for PostgreSQL (plan gratuito): tablas `scenarios`, `agent_runs` (pregunta, herramientas llamadas, respuesta, citas) → "audit trail" de las recomendaciones de la IA. Solo si las MUST y SHOULD están terminadas.

## Despliegue
- Local para la demo (más fiable). Opcional: frontend en Vercel/Netlify y servidor en Render/Fly. La URL pública vale para el README.
