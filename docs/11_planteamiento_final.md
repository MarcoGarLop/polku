# 11 · Planteamiento final (14-nov-2026) — manda sobre lo anterior si hay conflicto

## Frase
> **Polku answers AstraZeneca's own question: do two patients with the same lung cancer have an equal chance in Finland?** It simulates the journey for any patient profile (where they live, their entry route, education, age and ability to navigate the system) across the 8-step pathway, and shows where the gap opens. For each wellbeing county it ranks roadmap actions by both speed and equity, and an AI agent turns that into a cited plan in Finnish. Every number has a source; where Finland has no data, the first recommendation is to start measuring, including the entry route.

## Huecos detectados y cómo se cierran
| Hueco / oportunidad | Solución |
|---|---|
| 1. La pregunta de AZ nombra educación y "ability to navigate"; solo cubríamos región y vía | **Perfil de paciente**: región + distancia, vía de entrada, educación, barreras de navegación (vive solo/a, otra lengua o >75). Cada factor con fuente y confianza (educación y navegación = `assumption`). **Descomposición de la brecha** (Shapley exacto sobre 5 factores) → "qué palanca tocar". Tarjeta "Why days matter" con Zai 2025 (datos reales). |
| 2. Las mentoras quieren IA centrada en el paciente ("pacientes similares") | Demo: herramienta `find_left_behind(regionId)` → Gemini explora ~36 perfiles sintéticos y explica quién se queda atrás y qué palanca usar. Piloto: "patients like this one" con Findata (pantalla estática). |
| 3. "Not everything for everyone — consistent criteria" | Matriz Average (X) vs Equity (Y) vs esfuerzo (tamaño); selector de prioridad; selector de presupuesto por puntos de esfuerzo (low=1, medium=2, high=3; presupuesto 2/4/6) con búsqueda exhaustiva de la mejor combinación; vista nacional. |

## `min_dataset` ampliado
5 campos: fecha de síntoma, de derivación, de inicio de tratamiento, **vía de entrada** y **nivel educativo** (por cruce con Tilastokeskus). Convierte nuestros supuestos de equidad en medidas.

## Guion de demo (2 min)
1. Su pregunta, literal. 2. Comparador "Two Mattis" (dónde se abre la brecha y por qué). 3. Mapa: dónde pasa más. 4. Matriz + "Close the gap": qué hacer. 5. Agente: "Who is left behind in Lapland?" → perfiles + plan en finés. 6. Assumptions + "start measuring". 7. Piloto con Pohde (socio natural, sin afirmar que haya aceptado).

## Recortes
Sin TripsLayer, voz, Aiven ni capa municipal. Mapa con columnas en el centroide. 5 intervenciones visibles en la demo (`public_fast_lane`, `navigator`, `fast_track`, `travel_cost_support`, `min_dataset`); el resto en "More".
