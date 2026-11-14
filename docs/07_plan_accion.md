# 07 · Plan de acción definitivo

> Hoy es viernes 13-nov-2026 por la noche. Jurado: **domingo 15, 14:00**. Hora límite de entrega: **POR CONFIRMAR** (suele ser el domingo por la mañana) → ajustar este plan cuando se sepa.

## Roles (ajustar al número real de personas)
| Rol | Responsable | Tareas |
|---|---|---|
| **A · Datos y evidencia** (perfil sanitario) | ___ | Descargar datos regionales (THL, Sotkanet, StatFin, informe "Keuhkosyöpä Suomessa" a mano), mantener `pathway_parameters.json` y `05_fuentes_y_evidencia.md`, entrevista con Kaisa el sábado |
| **B · Simulación + Gemini** | ___ (+ agente Opus) | `packages/sim`, servidor, herramientas, contexto largo, plan estructurado, caché de la demo |
| **C · Mapa 3D y UI** | ___ (+ agente Opus) | `apps/web`: deck.gl, selector de fase, panel, interruptores, contador, animación |
| **D · Historia, vídeo y entrega** | ___ | Guion, persona de Matti, grabación, diapositivas (5–7), README para el jurado, texto para Gemini, formularios (créditos de Gemini y Aiven) |

## Calendario

### Viernes noche (hasta ~02:00)
- [ ] D: formulario de créditos de Gemini; preguntar a la organización la hora de entrega, la duración del vídeo y si el mismo proyecto puede presentarse a AstraZeneca + Gemini (+ Aiven).
- [ ] B/C: crear el repositorio, monorepo, `.env.example` y `.gitignore`; app web con un mapa de Finlandia y las regiones (aunque sea con polígonos provisionales).
- [x] B: `packages/sim` v0 con parámetros nacionales + Monte Carlo + tests básicos. (14-nov 00:45: también perfiles, comparador con Shapley, ranking Average vs Equity, cartera por presupuesto y `findLeftBehind`; 14 tests en verde)
- [x] A: `data/processed/indicators.json` con datos reales (THL Sotkanet + Tilastokeskus), generado por `node scripts/fetch-data.mjs && node scripts/build-data.mjs`.
- [x] C: app web v1 (`apps/web`): mapa 3D (regiones y municipios extruidos, recorridos animados, hospitales, arcos a radioterapia), comparador de dos pacientes, panel de región, Act (matriz + plan por presupuesto), Ask (respuestas deterministas offline), Assumptions. `npm run dev -w @polku/web` → http://localhost:5173
- [x] B: servidor Gemini (`apps/server`) conectado a "Ask Polku" + plan descargable (EN/FI). Arranque: `npm run dev:server` y `npm run dev:web` (dos terminales) → http://localhost:5173
- [x] Respuestas de las 4 preguntas sugeridas grabadas en `demo/cached-responses.json` (todas con cifras verificadas). Con `DEMO_MODE=true` se sirven al instante; con `?fresh=1` se fuerza Gemini en vivo.
- [ ] README en inglés + texto de entrega de Gemini + vídeo.
- [ ] A: descargar polígonos y población (StatFin), acceso a primaria y especializada por región (THL/Sotkanet), informe "Keuhkosyöpä Suomessa" a mano; anotar fuente y fecha de cada archivo en `data/raw/README.md`.
- [ ] D: guion v1 del vídeo y del pitch.

### Sábado mañana (09:00–14:00)
- [ ] A: **entrevista con Kaisa Kaitila** (preguntas abajo). Actualizar parámetros con sus respuestas, citándola: "AstraZeneca mentor interview, 14 Nov 2026".
- [ ] B: modificadores regionales + calibración; herramientas de Gemini (`get_region_profile`, `simulate_scenario`).
- [ ] C: mapa 3D extruido con datos del simulador; selector de fase; panel de región.
- **Hito 14:00:** mapa 3D + fases + panel con datos reales del motor. ✅/❌

### Sábado tarde (14:00–20:00)
- [ ] C: interruptores de intervención + contador; tooltips de fuentes; botón "Assumptions".
- [ ] B: agente Gemini de punta a punta (contexto largo + herramientas + citas + `ui_command`).
- [ ] D: empezar a grabar pantalla; diapositivas v1.
- **Hito 20:00:** las 5 MUST funcionando de punta a punta. ✅/❌

### Sábado noche (20:00–23:59)
- [ ] SHOULD: pacientes animados, tabla impacto/esfuerzo, plan descargable, modo demo con caché.
- [ ] Si sobra tiempo: COULD (alerta temprana sintética → voz → Aiven).
- **23:59: CONGELACIÓN DE FUNCIONALIDADES.** Desde aquí, solo arreglos y pulido.

### Domingo mañana
- [ ] 08:00 Ensayo completo de la demo con red y sin red (modo demo).
- [ ] 09:00 Grabar el vídeo final (2–3 min) y subirlo.
- [ ] README en inglés: problema, capturas, cómo ejecutar, fuentes, límites, "not a medical device", sección de Gemini.
- [ ] Entrega en la plataforma de Junction (repo + vídeo + demo) **antes de la hora límite**; entrega del side challenge de Gemini.
- [ ] Ensayar el pitch de 2 minutos al menos 3 veces; preparar respuestas a preguntas difíciles (abajo).
- [ ] **14:00 Jurado.**

## Preguntas para Kaisa Kaitila (sábado)
1. "In your experience, roughly how many days does each phase take for lung cancer in Finland: patient, primary care, referral to specialist, diagnostic work-up, diagnosis to treatment?" (enseñar nuestra tabla de 55/41/12/22/24).
2. "Which patient profiles get stuck most often? Distance, emergency route, vague symptoms, age?"
3. "Which of these interventions are realistic in a Finnish wellbeing county? Which have been tried?" (enseñar la lista).
4. "What are the THL target times for lung cancer?"
5. "Are there regional numbers from the Kuittinen study (Kuopio, Tampere, Turku, Rovaniemi) that we can cite?"
6. "Can we cite you as 'AstraZeneca mentor interview'?"

## Preguntas difíciles del jurado (preparar respuestas)
- *"Your regional numbers are estimates — why trust them?"* → Están calibradas con cifras nacionales publicadas, cada supuesto es visible y editable, y nuestra primera recomendación es medir (conjunto mínimo de datos). En el piloto se calibra con datos reales vía Findata.
- *"Isn't this a medical device?"* → No: es apoyo a la decisión para planificadores con datos agregados; no diagnostica ni trata a pacientes.
- *"Why lung cancer?"* → Es el indicador del Objetivo 3 más alejado del nivel nórdico (+14 pp), solo el 17 % se diagnostica en estadio I y el 27 % recibe tratamiento curativo.
- *"What does a county do on Monday?"* → Descargar el plan: 3 acciones con responsable, plazo, indicador y acción de la hoja de ruta.
- *"Sweden already has fast-track pathways and only ~36 % meet the target."* → Por eso Polku muestra la incertidumbre y combina el circuito con coordinación (enfermera gestora) y medición; el contador muestra un rango, no una promesa.

## Checklist de entrega
- [ ] Repo público (o acceso al jurado) sin secretos (`git log -p | grep -i key` limpio).
- [ ] Demo en vivo funciona offline (modo demo).
- [ ] Vídeo subido y enlazado.
- [ ] README con fuentes y límites.
- [ ] Formulario y descripción del side challenge de Gemini.
- [ ] (Opcional) Aiven usado y declarado.
