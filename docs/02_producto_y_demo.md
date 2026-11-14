# 02 · Producto, pantallas y guion de demo

## Usuario objetivo
**Director/a de servicios o de planificación de una región de bienestar (hyvinvointialue)** y los equipos de FICAN que coordinan el plan nacional. No técnicos. Tienen 2 minutos.

## Pregunta que responde Polku
1. ¿Cuántos días tarda un paciente con cáncer de pulmón de mi región, del síntoma al tratamiento, y cómo me comparo?
2. ¿En qué fase se pierden?
3. ¿Qué hago primero, cuánto cuesta aproximadamente y cuánto gano?

## Pantalla única (layout escritorio 16:9, pensado para proyector)

```
┌───────────────────────────────────────────────┬──────────────────────────┐
│  [Phase: All | Patient | Primary | Referral | │  REGION PANEL            │
│   Diagnostics | Treatment]                    │  Lapland · 176k people   │
│                                               │  ~XXX days (Estimate)    │
│        MAPA 3D DE FINLANDIA (deck.gl)         │  ███▓▓▒▒░ por fase        │
│   columnas/polígonos extruidos = días         │  vs Finland · Sweden · DK│
│   arcos/trayectos = pacientes viajando        │  Sources ⓘ  Confidence ● │
│   hospitales = puntos                         ├──────────────────────────┤
│                                               │  INTERVENTIONS (toggles) │
│                                               │  [x] Fast-track pathway  │
│                                               │  [ ] e-consultation      │
│  BIG COUNTER: −23 days · +18 pp within target │  [ ] Nurse navigator ... │
├───────────────────────────────────────────────┼──────────────────────────┤
│  AI AGENT (Gemini) · "What should Lapland do first?"  [Ask] [🎤]         │
│  → respuesta con citas: "Roadmap action 2.5.2, p. 52" · [Download plan]  │
└──────────────────────────────────────────────────────────────────────────┘
```

### Detalle de componentes
- **Mapa**: polígonos de las regiones extruidos por días (o columnas en el centroide si los polígonos dan guerra). Escala de color secuencial (verde → rojo). Hover = tooltip con días y confianza. Clic = selecciona región, la cámara vuela.
- **Selector de fase**: cambia la métrica del mapa a los días de esa fase. El "insight" visual: en el norte/este la fase de primaria y la de distancia pesan más.
- **Hospitales**: universitarios (5) y centrales como puntos; los que tienen radioterapia, marcados.
- **Pacientes animados (SHOULD)**: TripsLayer de municipios → centro de salud → hospital; la velocidad visual ∝ días reales simulados; con intervención activada se ve el flujo más rápido.
- **Panel de región**: barra apilada por fase (paciente, primaria, acceso a especialista, diagnóstico, inicio de tratamiento) con intervalo de incertidumbre (P10–P90); comparación con media de Finlandia, Suecia (107 d) y Dinamarca (67 d) — etiquetadas "preliminary national comparison".
- **Intervenciones**: interruptores; cada uno con ⓘ (evidencia, fuente, confianza, acción de la hoja de ruta y coste orientativo). El contador grande muestra días ahorrados y % dentro del objetivo de referencia.
- **Tabla impacto/esfuerzo (SHOULD)**: intervenciones ordenadas por días ganados; columna de coste/dificultad cualitativa. Es más honesto que un optimizador "al euro".
- **Agente IA**: caja de chat. Respuestas cortas (≤ 120 palabras) con citas en chips clicables. Muestra qué herramientas llamó ("Ran 4 simulations").
- **Download plan (SHOULD)**: una página: diagnóstico de la región, top 3 acciones (ID de acción de la hoja de ruta, responsable, plazo 30/60/90 días, indicador de seguimiento, fuente), supuestos y límites.
- **Badge "Estimate"** en toda cifra marcada como supuesto. **Botón "Assumptions"** que abre la tabla de parámetros con fuentes (y permite editar valores clave → el jurado ve que el modelo es transparente).
- **Pie**: "Decision-support for planners · Public aggregated data only · Not a medical device".

## MoSCoW
| Prioridad | Funcionalidad |
|---|---|
| MUST | Mapa 3D por región · selector de fase · panel de región con fuentes · interruptores de intervención + contador · agente Gemini con herramientas y citas |
| SHOULD | Pacientes animados · tabla impacto/esfuerzo · plan descargable · modo demo con caché |
| COULD | Alerta temprana con pacientes sintéticos · voz (Gemini Live) · Aiven |
| WON'T | Datos de pacientes reales · predicción clínica · login/usuarios · móvil |

## Guion de la demo (2 minutos, en inglés)
1. **(0:00–0:20) El problema: "Two Mattis".** "Two men, same cough, same lung cancer. Matti A, 58, Oulu, occupational healthcare. Matti B, 66, retired, rural Lapland, public care. *Do two patients with the same cancer have an equal chance?* (la pregunta de la ponente de AstraZeneca). Finland averages ~155 days from symptom to lung cancer treatment — Denmark ~67 — and the public route can be months slower." → mapa 3D, el norte en rojo, interruptor de vía de entrada.
2. **(0:20–0:45) Dónde se pierde.** Pulsar fase *Primary care* y luego *Referral* → las columnas cambian; panel de Laponia: "most days are lost before the specialist even sees him".
3. **(0:45–1:15) Qué hacer.** Activar *Standardised fast-track pathway* y *e-consultation* → columnas bajan, contador "−XX days". Pregunta al agente: "What should Lapland do first with a limited budget?" → respuesta citando "National roadmap action 2.5.2, p. 52".
4. **(1:15–1:40) Honestidad.** Abrir "Assumptions": "Every number has a source and a confidence level. Finland does not record symptom-to-treatment times — so our first recommendation is a 3-timestamp minimum dataset."
5. **(1:40–2:00) Siguiente paso.** "Download plan" → hoja de una página. "We propose a 3-month pilot with one wellbeing county: calibrate Polku with real data via Findata and track the new access-time targets due by 2028."

## Historia para el vídeo
- Protagonistas: **"Two Mattis"** (personas ficticias, decirlo): Matti A (58, Oulu, salud laboral) y Matti B (66, jubilado, Laponia rural, vía pública). Mismo síntoma y mismo cáncer.
- Arco: los dos recorridos en paralelo sobre los 8 pasos de la diapositiva 10 de AstraZeneca (síntoma → decide consultar → primer contacto → valoración → pruebas y derivación → diagnóstico → MDT → tratamiento). Se ve dónde se separan (antes del especialista) y cómo Polku cierra esa brecha.
- Cierre: "Right patient, right care setting, right treatment, timely care — for both Mattis."
- Grabar material de pantalla desde el sábado por la tarde. Vídeo final 2–3 min (confirmar duración máxima).
