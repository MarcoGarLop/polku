# Polku — equal lung cancer care across Finland

**Junction 2026 · AstraZeneca challenge “Equal Care Across Finland” · Google DeepMind Gemini side challenge**

> *“Do two patients with the same cancer in Finland have an equal chance, regardless of where they live, how much they earn, their education, or their ability to navigate the healthcare system?”* — the question AstraZeneca asked every team.

Polku (Finnish for *path*) is an **AI analyst for wellbeing services counties**. It reads Finland's National Cancer Strategy and its implementation roadmap together with public health data, estimates what each action would change in the lung cancer pathway, simulates it for every region, and recommends what to do first. Every figure on screen can be traced to a source or to a simulation run.

In our model, a working patient near Oulu University Hospital starts lung cancer treatment after about **94 days**. A retired patient on the public route, living alone 180 km from hospital in Lapland, after about **225 days**. Around 70% of that difference opens **before a specialist ever sees the patient**.

*Decision support for planners. Public aggregated data only, no patient records. Not a medical device.*

---

## What you can do

| Mode | What it shows |
|---|---|
| **Guided tour** (7 steps) | The gap → two patients → where in the pathway → why (interactive “what if”) → the AI's recommended actions → your own idea, estimated live by the AI → how far you can trust it |
| **Simulator** | Build a patient (region, distance, entry route, education, living alone / 75+), switch actions on, design new actions with the AI, see the days and the comparison with Sweden and Denmark |
| **Ask the AI** | Free questions; the AI runs the simulator, cites the roadmap page, and every number in its answer is checked |
| **1-page plan** | A printable action plan for a county, in English or Finnish |

## How the AI works

Gemini is the analyst; Polku's pathway simulator is its calculator. The language model never produces the final days itself.

```
 public data + national strategy + roadmap + evidence notes
                         │
                         ▼
  ① Gemini reads everything (≈150k tokens, Finnish, long context)
  ② Gemini ESTIMATES each action: which phases, for whom, how much
     (pessimistic / best / optimistic), confidence, reasoning, sources
                         │  structured output, validated (valid phases, ≤ 60 %)
                         ▼
  ③ Simulator COMPUTES the days: 22 regions × patient profiles, Monte Carlo
                         │  function calling (9 tools)
                         ▼
  ④ Gemini RECOMMENDS: searches combinations, writes the plan, cites roadmap pages
  ⑤ Polku VERIFIES: every number in an answer must come from a tool result,
     the documents or a published figure, otherwise the UI flags it
```

- **Effect sizes estimated by Gemini** for the 9 actions are stored in [`data/seed/ai_effects.json`](data/seed/ai_effects.json) with their reasoning (for example: a Nordic fast-track pathway is scaled down because Sweden meets its targets for only ~36% of patients; direct CT access from primary care gets ~3% because a Danish trial found no effect). Gemini did not see the team's own estimates; those are kept as a prior for comparison.
- **New actions designed live**: a planner types an idea, Gemini estimates its mechanism and range from the evidence and matches it to a roadmap action, and the simulator computes the effect for the region, for Patient B and for all of Finland. The AI also says when an idea is unlikely to help.
- **Agent with function calling** over the simulator (`list_regions`, `get_region_profile`, `compare_patients`, `find_left_behind`, `simulate_scenario`, `rank_interventions`, `best_plan`, `get_evidence`, `ui_command` to move the map).
- **Models**: `gemini-4-argon` for estimation and plans; `gemini-3.8-flash` for interactive chat and live ideas (≈15 s). Gemini's implicit prefix caching serves ~98% of the long context from cache (measured: 26 s cold → ~7 s warm).

## The model

- **Five pathway phases** (first symptom → first contact → referral → specialist → diagnosis → treatment), grouped from AstraZeneca's 8-step pathway, with national means anchored to published Finnish figures (≈155 days; Sweden 107, Denmark 67; preliminary).
- **Regional differences** from real public data: primary-care waiting times, specialist waiting lists and tertiary education (THL Sotkanet), distances from each of 292 municipalities to its hospital and to radiotherapy, population and age (Statistics Finland). Calibrated so the national average is preserved.
- **Patient factors**: entry route (public vs occupational/private, from Finnish lymphoma data, applied to lung cancer as an assumption), education and barriers to navigating care (stated assumptions).
- **Uncertainty**: lognormal phase durations (Monte Carlo), evidence ranges for every action, and a cautious scenario (Patient B's gap is ~131 days with our assumptions, ~63 days with very cautious ones).
- Full parameters with source and confidence: [`data/seed/pathway_parameters.json`](data/seed/pathway_parameters.json) · sources: [`docs/05_fuentes_y_evidencia.md`](docs/05_fuentes_y_evidencia.md).

## Limits (said plainly)

- Finland does not record symptom-to-treatment times. National phase means are preliminary; regional values are estimates. That is why Polku's first recommendation is to **start measuring** (symptom, referral and treatment dates, entry route, education).
- The entry-route effect comes from lymphoma, not lung cancer.
- No survival predictions, no individual predictions, no patient data.
- Proposed next step: a 3-month pilot with one wellbeing county, calibrating Polku with real pathway data through Findata.

## Run it

Requirements: Node 20+.

```bash
npm install
cp .env.example .env          # add GEMINI_API_KEY (never commit it)
npm run dev:server            # API on :8787 (warms the Gemini context on start)
npm run dev:web               # app on http://localhost:5173
```

- Without a Gemini key the app still works: the tour, simulator and map run fully in the browser, and recorded AI answers ([`demo/`](demo/)) are served when `DEMO_MODE=true`.
- Rebuild the public data: `npm run data` (downloads from Statistics Finland and THL Sotkanet).
- Re-run the AI estimation of action effects: `cd apps/server && node --env-file=../../.env --import tsx src/estimate-all.ts`
- Tests: `npm test` (simulation engine: calibration, Shapley attribution, interventions, AI effects).

## Repository

```
apps/web        Vite + React + deck.gl: 3D map, guided tour, simulator
apps/server     Node + @google/genai: agent, effect estimation, design-an-action, plan
packages/sim    Pathway simulator (TypeScript, shared by browser and server) + tests
data/           seed parameters, AI effect estimates, processed public data
scripts/        fetch and build public data
docs/           challenge, model, sources, decisions (Spanish, team notes)
demo/           recorded AI answers for offline demos
```

## Data sources

Statistics Finland (municipal and wellbeing-county boundaries 2026, population 2025) · THL Sotkanet (indicators 6411, 3336, 3195) · National Cancer Strategy 2026–2035 and Implementation Roadmap 2026–2031 · Kuittinen study via Yle MOT 2025 · Khalife et al. 2025 · Kuitunen et al. 2026 · Zai et al. 2025 · Nordic pathway evidence (Denmark, Sweden, Norway, Wales) · Natural Earth. Full list with links and confidence in [`docs/05_fuentes_y_evidencia.md`](docs/05_fuentes_y_evidencia.md).

## Demo video

[`demo/polku-demo.mp4`](demo/polku-demo.mp4) (1:57) is generated by the app itself: see [`scripts/video/`](scripts/video/). Voiceover: ElevenLabs. Music: synthesised.
