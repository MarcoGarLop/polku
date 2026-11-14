# 06 · Integración con Gemini (side challenge de Google DeepMind)

## Qué evalúa Google
"Ir más allá de añadir un LLM a una aplicación". La entrega debe explicar: el problema y por qué importa · cómo se integra la API de Gemini · qué tiene de innovador o técnicamente impresionante · por qué Gemini es imprescindible.

**Nuestra respuesta en una frase:** *Gemini lee la estrategia nacional del cáncer y su hoja de ruta completas (≈175 páginas en finés) y actúa como un agente que maneja un simulador de Monte Carlo: convierte la política nacional en un plan concreto y citado para cada región.*

## Modelos (verificar en AI Studio el día del evento; los nombres cambian)
Según la documentación consultada el 13-nov-2026 en [ai.google.dev](https://ai.google.dev/gemini-api/docs):
- **`gemini-4-argon`**: modelo insignia, ventana de **1 M de tokens**, admite function calling y niveles de razonamiento ajustables. **No admite la Live API.** → agente principal y plan.
- **Gemini 3.8 Flash**: más rápido y barato → respuestas cortas o de respaldo si hay límites de cuota.
- **`gemini-3.8-live`**: modelo para la Live API (voz de baja latencia, function calling no bloqueante por defecto) → solo para el modo voz (COULD).
- Poner el nombre del modelo en `.env` (`GEMINI_MODEL`), nunca fijo en el código.
- SDK: `@google/genai` (Node). Clave de API en `.env` (créditos de Junction: rellenar el formulario; todos los miembros deben ser mayores de 18).

### Cuenta temporal de Google DeepMind (guía oficial: goo.gle/hackathon-account)
- Proyecto de pago "Tier 3" con cuota alta. La guía menciona **Gemini 3.1 Pro (preview)** y **Gemini 3.8 Flash**. **Los nombres válidos son los que liste `npm run check:gemini`**: usar esos en `.env`.
- **La cuenta se borra el día después del hackathon** → subir el código a GitHub (sin la clave) y exportar todo antes de que acabe.
- **Si la clave aparece en GitHub, Google invalida todas las claves del proyecto.** Borrarla en un commit no basta (queda en el historial): habría que eliminarla en aistudio.google.com/api-keys y crear otra.
- **No abusar** (miles de peticiones = descalificación). El Monte Carlo corre en local; a Gemini solo van las preguntas del agente.
- **Error 429** = se alcanzó el tope de gasto del proyecto → subirlo un poco en aistudio.google.com/spend (no demasiado: protege si se filtra la clave).
- **Error 503** (modelo saturado, típico en modelos recién lanzados) → el servidor debe **reintentar con espera exponencial (2–3 intentos) y después pasar a un modelo de respaldo** (`GEMINI_FALLBACK_MODEL`) y, en última instancia, a la caché del modo demo.
- Se puede compartir la cuenta en el equipo, pero lo ideal es que cada miembro use la suya.

## ⭐ La IA en el centro (14-nov, noche) — manda sobre todo lo demás
Gemini es **la analista**; el simulador es su herramienta de cálculo. Nunca da días "de cabeza".
1. **Estima los efectos de las 9 acciones** (`apps/server/src/estimate-all.ts` → `data/seed/ai_effects.json`): lee la estrategia + hoja de ruta + el resumen de evidencia (`docs/05`), **sin ver nuestros porcentajes**, y devuelve por acción: fases afectadas, a quién, rango (pesimista/central/optimista), confianza, razonamiento y fuentes. Validado (fases válidas, ≤60 %). El simulador usa estas estimaciones; las nuestras quedan como `prior` para comparar. Ejemplos: fast-track −15/−25 % (rebajado por el 36 % de cumplimiento sueco); TAC directo −3 % (ECA danés sin efecto).
2. **Estima ideas nuevas en vivo** (`/api/design-action`, `design.ts`): el usuario describe una acción → Gemini (flash, ~15 s) estima mecanismo y rango + acción de la hoja de ruta → el simulador calcula días para la región, Matti B y toda Finlandia → se puede añadir al plan. Tres ejemplos grabados en `demo/designed-actions.json` (argon). Dice cuándo una idea no ayuda (TAC móvil mensual: −1,5 d).
3. **Recomienda** (mejor combinación por presupuesto con sus estimaciones) y **responde preguntas** (agente con herramientas, verificador de cifras).
4. Rastro de razonamiento visible en la UI (leyó → emparejó con la hoja de ruta → estimó → simuló).
Regenerar estimaciones: `cd apps/server && node --env-file=../../.env --import tsx src/estimate-all.ts`.

## ✅ Implementado (14-nov) — manda sobre lo de abajo
- **Contexto largo:** estrategia + hoja de ruta completas (~152k tokens, finés) en la instrucción de sistema de cada llamada. `gemini-4-argon` **no admite caché explícita** (error 400), así que usamos la **caché implícita** de prefijo: medido 26 s en frío → ~7 s en caliente con 146k tokens cacheados. El servidor "calienta" la caché al arrancar (`warmUp`). El prefijo (sistema + herramientas) no debe cambiar entre llamadas.
- **Modelos:** chat con `gemini-3.8-flash` (12–25 s para respuestas con 2–4 herramientas; argon tardaba ~55 s). `?speed=deep` o `AGENT_SPEED=deep` usa argon. El plan de una página usa argon (~19 s) con salida estructurada.
- **9 herramientas** en `apps/server/src/tools.ts` sobre `packages/sim`: list_regions, get_region_profile, compare_patients, find_left_behind, simulate_scenario, rank_interventions, best_plan, get_evidence, ui_command (mueve el mapa).
- **Verificador de cifras** (`verifyNumbers`): cada número de la respuesta debe aparecer en resultados/argumentos de herramientas, contexto UI, cifras publicadas conocidas o el texto de los documentos. La UI muestra "✓ N numbers traced" o "⚠ Not traced: …". Ya pilló a Gemini sumando dos factores (28,8) → se endureció la regla del prompt.
- **Plan:** `/api/plan` → Gemini redacta título, responsables, plazos e indicadores leyendo las páginas de la hoja de ruta; **las cifras se sobrescriben siempre con el simulador**. EN y FI. Si no hay red, plantilla local.
- **Modo demo:** cada respuesta en vivo se graba; con `DEMO_MODE=true` las preguntas ya grabadas se sirven al instante; si Gemini falla, también.

## Capacidad 1 · Contexto largo con citas a página (MUST)
- Cargar `docs/fuentes/` (estrategia y hoja de ruta) **una vez** en el contexto del sistema, con marcadores de página `[STRATEGY p.30]`, `[ROADMAP p.52]`.
- Usar caché de contexto si está disponible (ahorra coste y latencia en cada pregunta).
- Instrucción: toda recomendación debe citar al menos una acción de la hoja de ruta con su página; si no la encuentra, decirlo.
- Alternativa más precisa: subir los PDF originales con la API de archivos (lee tablas e imágenes). Probar cuál cita mejor las páginas.

## Capacidad 2 · Agente con function calling sobre el simulador (MUST)
Herramientas (declaraciones JSON Schema en `apps/server/src/tools.ts`, implementadas con `packages/sim`):

| Herramienta | Entrada | Salida |
|---|---|---|
| `list_regions` | — | ids, nombres, población, días totales base, confianza |
| `get_region_profile` | `regionId` | `RegionResult` + atribución de drivers + fuentes |
| `simulate_scenario` | `regionId`, `interventions[]`, `overrides?` | `Comparison` (días ahorrados, Δ % dentro de objetivo, P10–P90) |
| `rank_interventions` | `regionId`, `maxEffort?` | intervenciones ordenadas por días ganados (cada una sola y en combinación) con esfuerzo y confianza |
| `compare_regions` | `regionIds[]`, `phase?` | tabla comparativa |
| `get_parameter_sources` | `parameterIds[]` | valor, rango, fuente, confianza |
| `ui_command` | `{type:'flyTo'|'setPhase'|'toggleIntervention'|'highlight', ...}` | ok → el agente **mueve el mapa** |

Bucle: hasta 6 rondas de herramientas por pregunta; la UI muestra "Ran N simulations" con detalle desplegable (transparencia = puntos con AstraZeneca y con Google).

## Capacidad 3 · Salida estructurada para el plan (SHOULD)
`responseSchema` (JSON):
```json
{
  "region": "string",
  "headline": "string (≤ 20 words)",
  "bottleneck": { "phase": "P1|P2|P3|P4|P5", "extraDaysVsNational": "number", "drivers": ["string"] },
  "actions": [
    { "interventionId": "string", "title": "string", "roadmapAction": "string", "roadmapPage": "number",
      "owner": "string", "horizon": "30d|60d|90d", "expectedDaysSaved": "number", "confidence": "high|medium|low|assumption",
      "kpi": "string", "sourceIds": ["string"] }
  ],
  "dataGapsAndLimits": ["string"],
  "pilotProposal": "string"
}
```
Regla: `expectedDaysSaved` **debe** copiarse de la salida de `simulate_scenario` (validar en el servidor; si no coincide, se sobrescribe con el valor de la herramienta).

## Capacidad 4 · Voz (COULD)
Live API con `gemini-3.8-live` + las mismas herramientas (`ui_command` incluida): "Show me where the north loses most time" → flyTo Lapland + setPhase P2 + respuesta hablada. Solo si todo lo demás funciona.

## Prompt de sistema (borrador, en inglés)
```
You are Polku, an analyst for Finnish wellbeing services counties planning lung cancer care.
Rules:
- Never state a number unless it came from a tool result or from the provided documents. Quote the source id or page.
- Prefer concrete actions from the National Cancer Strategy roadmap 2026–2031; cite action id and page.
- Always mention confidence and the main assumption behind any estimate. Finnish symptom-to-treatment figures are preliminary.
- Outputs are days and % within target, never survival promises.
- Be brief: max 120 words unless asked for a plan. Audience: non-technical county director.
- When useful, call ui_command so the map shows what you are talking about.
```

## Modo demo y fiabilidad
- `demo/cached-responses.json` con las 3–4 preguntas del guion (respuesta + toolCalls + mapCommands). Si falla la red o la cuota, la demo sigue.
- Tiempo de espera de 20 s → respuesta de respaldo desde la caché.

## Texto para la entrega a Google (borrador)
- **Problem:** Finnish lung cancer patients wait ~155 days from symptom to treatment (Denmark ~67, preliminary data); counties must implement Nordic-style fast-track pathways by 2028 but don't know where to start.
- **Integration:** long-context reading of the full national strategy and roadmap (Finnish), function calling over a Monte-Carlo pathway simulator, structured output for county action plans, and the agent driving a 3D map.
- **Innovation:** the LLM never invents numbers — it plans, runs simulations, compares scenarios and grounds every recommendation in an official action with a page reference.
- **Why Gemini:** a 1M-token context lets it reason over the whole policy corpus at once; native function calling and structured output make it an agent, not a chatbot.
