# CLAUDE.md — Proyecto POLKU (Junction 2026 · AstraZeneca "Equal Care Across Finland" + side challenge Gemini)

> Lee este archivo entero antes de escribir una sola línea de código. Después lee `docs/` en orden numérico.
> Idioma de trabajo con el equipo: **español**. Idioma de la interfaz de la app, README y vídeo: **inglés**.

## 1. Qué estamos construyendo (en una frase)

**Polku** (finés: "camino") es un **gemelo digital del recorrido del paciente con cáncer de pulmón en cada región de bienestar (hyvinvointialue) de Finlandia**: muestra en un **mapa 3D** dónde se pierden los días entre el primer síntoma y el inicio del tratamiento, **simula intervenciones** sacadas del plan nacional oficial y un **agente de IA (Gemini)** que maneja el simulador recomienda a cada región qué hacer primero, con fuente para cada cifra.

Pitch: *"Matti vive en Laponia. Desde su primer síntoma hasta el tratamiento pasan ~5 meses. En Dinamarca, ~2. Polku enseña dónde se pierde ese tiempo en cada región y qué hacer para recuperarlo."*

## 2. Contexto del hackathon (no negociable)

- Evento: Junction 2026, Helsinki, 13–15 nov 2026. **Juicio: domingo 15 nov, 14:00.** Confirmar hora límite de entrega con la organización (ver `docs/08_dudas_abiertas.md`).
- Entregables: **código (repo), demo funcional en vivo, vídeo y presentación**.
- Reto principal: AstraZeneca. Criterios: Accionabilidad 30 % · Insight 25 % · Calidad y transparencia de datos 20 % · Ejecución en vivo 15 % · Claridad (un directivo entiende el mensaje en < 2 min) 10 %. Detalle en `docs/01_reto_y_jurado.md`.
- Side challenge: **Gemini API** ("ir más allá de añadir un LLM"). Detalle en `docs/06_gemini.md`.
- Opcional: tech partner **Aiven** (premio por usarlo). Baja prioridad.

## 3. Reglas de oro (léelas dos veces)

1. **La IA nunca inventa cifras.** Todos los números salen del motor de simulación o de `data/`. Gemini razona, llama a herramientas, explica y cita. Si Gemini da un número que no viene de una herramienta, es un bug.
2. **Cada cifra mostrada tiene fuente y nivel de confianza** (`alta` / `media` / `baja` / `supuesto`). Los supuestos se etiquetan visiblemente como "Estimate" en la UI. Ver `docs/04_modelo_simulacion.md` y `data/seed/pathway_parameters.json`.
3. **No prometer supervivencia.** Las salidas del modelo son **días** por fase, **días totales** y **% de pacientes que empiezan tratamiento dentro de un objetivo de referencia** (benchmark nórdico). La supervivencia solo se menciona de forma cualitativa y citada.
4. **Solo datos públicos y agregados.** Nada de datos de pacientes reales. La "alerta temprana" (extra) usa **pacientes sintéticos etiquetados como tales**.
5. **Es una herramienta de apoyo a la decisión para planificadores**, no un producto sanitario clínico (no diagnostica ni trata). Decirlo en README y pitch.
6. **Lo simple que funciona gana a lo espectacular que falla.** Respetar el orden MoSCoW de `docs/02_producto_y_demo.md`. Congelación de funcionalidades: **sábado 23:59**.
7. **Secretos fuera del repo**: `GEMINI_API_KEY` y similares solo en `.env` (en `.gitignore`). Nunca en el código, capturas ni vídeo.
8. **La demo no puede depender de la wifi**: modo demo con respuestas de Gemini cacheadas y mapa que funciona sin teselas base (solo GeoJSON).

## 4. Stack (decidido; no cambiar sin motivo fuerte)

- **Frontend**: Vite + React + TypeScript · **deck.gl** (ColumnLayer/PolygonLayer extruido, TripsLayer, ArcLayer) · MapLibre GL como mapa base **opcional** · Tailwind para estilos · Recharts (o similar) para gráficos pequeños.
- **Backend**: Node + TypeScript (Express o Fastify) · SDK oficial `@google/genai` · expone `/api/agent` (chat con herramientas) y `/api/plan` (plan estructurado).
- **Motor de simulación**: TypeScript **compartido** (`packages/sim`), lo usan el navegador (deslizadores en tiempo real) y el servidor (herramientas de Gemini). Monte Carlo en el navegador (~5 000 pacientes por región es suficiente).
- **Scripts de datos**: Node/TS (en algunas máquinas del equipo no hay Python). Salida a `data/processed/*.json`.
- **Opcional**: Aiven PostgreSQL para guardar escenarios y el registro de recomendaciones de la IA.

Estructura propuesta y contratos de datos: `docs/03_arquitectura_tecnica.md`.

## 5. Funcionalidades en orden de prioridad

> **Decisión 14-nov (ver `docs/11_planteamiento_final.md`)**: Polku responde a la pregunta de AstraZeneca *"Do two patients with the same cancer have an equal chance…?"*. Tres piezas nuevas: **(A) perfil de paciente** (región/distancia, vía de entrada, educación, barreras para moverse por el sistema) con comparador de dos pacientes sobre los 8 pasos y descomposición de la brecha por causa; **(B) `find_left_behind`**: la IA busca los perfiles más retrasados de cada región (perfiles sintéticos); **(C) matriz "Average vs. Equity"** con selector de prioridad y de presupuesto (esfuerzo), mismo criterio para toda Finlandia. Recortes: sin TripsLayer, voz, Aiven ni capa municipal; mapa con columnas en el centroide.

**MUST (sin esto no hay demo)**
0. **Comparador de dos pacientes** ("Same cancer, different chance") sobre los 8 pasos + descomposición de la brecha por factor + tarjeta "Why days matter" (Zai 2025, datos reales).
1. Mapa 3D de Finlandia con las 21 regiones de bienestar + Helsinki; altura/color = días totales estimados síntoma→tratamiento.
2. Selector de fase: Patient · Primary care · Referral/specialist access · Diagnostics · Treatment start → el mapa muestra los días de esa fase. Mostrar debajo los **8 pasos de la diapositiva de AstraZeneca** (retraso del paciente frente al del sistema) agrupados en estas 5 fases. Interruptor **Route: All / Public / Occupational-private** con la métrica **"equity gap" (días)** (ver `docs/10`).
3. Panel de región: barra apilada por fase vs. media nacional vs. Suecia/Dinamarca, con fuentes y etiquetas de confianza. Incluir la métrica **"patient-days lost per year"** (casos anuales × días de exceso vs. media nacional) y una vista nacional que ordena las regiones por esa métrica.
4. Interruptores de intervención (6–7, de `pathway_parameters.json`) → recalcula en vivo; contador "−X days · +Y % within target".
5. Agente Gemini con function calling sobre el simulador + estrategia y hoja de ruta en contexto largo → recomendación citada (acción del plan nacional + página). Incluye la herramienta `find_left_behind`.

**SHOULD**
6. Matriz "Average vs. Equity" + selector de prioridad (Speed for all / Balanced / Close the gap) + selector de presupuesto (Low/Medium/High effort) + vista nacional con la acción prioritaria de cada región.
7. "Download 1-page plan" (salida estructurada de Gemini → HTML imprimible), en inglés y **finés**.
8. Modo demo (escenario guionizado + caché de respuestas).
9. Pantalla estática "Pilot: patients like this one" (lo que desbloquea Findata).

**WON'T (recortado)**: TripsLayer, voz, Aiven, capa municipal.

## 6. Datos clave que el producto debe reflejar (detalle y fuentes en `docs/05_fuentes_y_evidencia.md`)

- Finlandia, cáncer de pulmón: **~155 días** de media del síntoma al tratamiento (≈56 paciente · 41 atención primaria · 58 especializada); **Suecia 107**, **Dinamarca 67** (resultados preliminares, estudio de Outi Kuittinen, Yle MOT 2025). Es nuestra cifra ancla: citar siempre "preliminary".
- ~3 000 casos nuevos al año; solo **~17 % en estadio I** (vs >25 % DK/NO); solo **27 %** recibe tratamiento curativo; ~2 400 muertes/año.
- Finlandia: **menor acceso a TAC desde atención primaria** y las **esperas de primaria más largas** de los nórdicos; solo el **59 %** de los adultos vio a un médico en < 2 semanas en 2025; el máximo legal en adultos pasó de 14 días a 3 meses en 2025.
- Distancia: vivir **a >50 km** del hospital asociado a mayor mortalidad a 12 meses en cáncer de pulmón (HR 1,47; Vaasa).
- **Vía de entrada** (presentación de AstraZeneca, DLBCL en Finlandia): síntoma→tratamiento **123 días por la vía laboral/privada frente a 207 por la pública** (+84 d, casi todo antes del especialista). **Nivel socioeconómico**: mortalidad por cáncer 27 % (más educación) frente a 47 % (menos); cirugía 51 % vs 36 %. La pregunta del jurado: *"Do two patients with the same cancer have an equal chance, regardless of where they live, how much they earn, their education, or their ability to navigate the system?"*
- La hoja de ruta nacional obliga a definir **plazos de acceso por cáncer y circuitos estandarizados al estilo nórdico para 5 cánceres en 2026–2028** (acciones 2.5.2 y 3.1.2) → Polku ayuda a las regiones a decidir por dónde empezar.

## 7. Cómo trabajar con el equipo

- Antes de cada bloque grande, propón el plan en 3–5 viñetas y espera el OK si cambia la arquitectura.
- Commits pequeños y frecuentes con mensajes claros. Rama `main` siempre demostrable.
- Si un dato no está en `data/` ni en `docs/`, **no lo inventes**: añádelo a `docs/08_dudas_abiertas.md` y usa un supuesto marcado.
- Cuando termines una funcionalidad MUST, actualiza la casilla en `docs/07_plan_accion.md`.

## 8. Archivos de referencia

- `docs/01_reto_y_jurado.md` — enunciado, criterios, jurado, mentoras.
- `docs/02_producto_y_demo.md` — experiencia de usuario, pantallas y guion de demo de 2 min.
- `docs/03_arquitectura_tecnica.md` — estructura de carpetas, contratos y API.
- `docs/04_modelo_simulacion.md` — el modelo matemático (fases, variación regional, intervenciones, Monte Carlo).
- `docs/05_fuentes_y_evidencia.md` — todas las fuentes con URL y nivel de confianza.
- `docs/06_gemini.md` — integración con Gemini (modelos, herramientas, prompts, caché).
- `docs/07_plan_accion.md` — calendario, roles y checklist.
- `docs/08_dudas_abiertas.md` — lo que falta confirmar.
- `docs/10_insights_presentacion_astrazeneca.md` — ⭐ **lo que AstraZeneca enseñó a todos los equipos**: equidad por vía de entrada (pública frente a laboral/privada, +84 días), nivel socioeconómico, recorrido en 8 pasos. Cambia la historia de la demo ("Two Mattis") y añade un segundo eje de equidad al modelo.
- `docs/11_planteamiento_final.md` — ⭐⭐ **planteamiento final del 14-nov** (perfil de paciente, `find_left_behind`, matriz Average vs Equity, recortes). Manda sobre lo anterior.
- `docs/09_inspiracion.md` — proyectos similares y mejoras a aplicar (métrica "patient-days lost per year", evidencia de Gales, capa municipal de acceso).
- `docs/fuentes/` — texto íntegro de la estrategia nacional y la hoja de ruta (para el contexto largo de Gemini).
- `data/seed/pathway_parameters.json` — parámetros del modelo con fuente y confianza.
- `data/seed/regions.json` — regiones y hospitales (coordenadas aproximadas; ver notas).
