# 04 · Modelo de simulación (el corazón de Polku)

> Objetivo: un modelo **simple, explicable y honesto** del tiempo síntoma→tratamiento en cáncer de pulmón por región. No es un modelo clínico. Cada parámetro vive en `data/seed/pathway_parameters.json` con `value`, `range`, `source_id`, `confidence` y `note`. La UI debe poder mostrarlos y editarlos ("Assumptions").

## 1. Fases del recorrido (5)

| ID | Fase (UI en inglés) | De → a | Media nacional (días) | Base de la cifra |
|---|---|---|---|---|
| P1 | Patient interval | primer síntoma → primer contacto sanitario | **55** | Yle/Kuittinen: ">50 días atribuidos al paciente" (preliminar) |
| P2 | Primary care interval | primer contacto → envío de la derivación | **41** | Yle/Kuittinen: 41 días en primaria (preliminar) |
| P3 | Specialist access | llegada de la derivación → primer contacto especialista | **12** | TYKS 2024–25: 9–13 días de media; encuesta nórdica: 2–4 semanas en FI |
| P4 | Diagnostic work-up | primer contacto especialista → diagnóstico | **22** | Oulu: derivación→diagnóstico 33 d (mediana); encuesta: ~4 semanas |
| P5 | Treatment start | diagnóstico → inicio del primer tratamiento | **24** | Oulu: 27 d (mediana); TYKS: derivación→quimio 33–35 d |
| — | **Total** | | **≈154** (ancla: 155) | Yle/Kuittinen: 155 d; P3+P4+P5 = 58 d "especializada" |

Comparadores (solo totales, preliminares, misma fuente): **Suecia 107 d · Dinamarca 67 d**.

**Objetivo de referencia (benchmark) para "% within target"**: días desde la llegada de la derivación a especializada hasta el inicio del tratamiento (P3+P4+P5) ≤ **42 días** (Noruega: ≤42 d cirugía/radioterapia desde la derivación; Suecia: 40 d fármaco / 44 d cirugía-RT desde sospecha fundada). Parámetro editable. Finlandia aún no tiene plazo oficial específico para pulmón publicado accesible (la hoja de ruta lo fija para 2026–2028, acción 3.1.2).

## 2. Distribución dentro de cada fase

Tiempos con cola larga (HYKS: 8–307 días). Para cada fase y región: **lognormal** con media `m` y coeficiente de variación `cv` (por defecto 0,8, supuesto):

```
sigma = sqrt(ln(1 + cv^2))
mu    = ln(m) - sigma^2 / 2
dias  ~ LogNormal(mu, sigma)
```

## 3. Variación regional (el "insight")

No existen datos públicos de tiempos por fase y región. Se estiman con **modificadores** construidos a partir de indicadores públicos regionales, **calibrados** para que la media ponderada por población de cada fase = media nacional.

```
m[r,p] = base[p] * M[r,p] * k[p]
M[r,p] = Π_d ( x[r,d] / x_nat[d] ) ^ e[p,d]        (d = driver)
k[p]   = base[p] / Σ_r (pop[r] * base[p] * M[r,p]) * Σ_r pop[r]   (calibración)
```

| Driver `d` | Indicador regional (fuente a descargar) | Fases a las que afecta (elasticidad por defecto, **supuesto**) |
|---|---|---|
| `pc_access` | % de adultos sin cita médica en primaria en ≤14 d (THL hoitoonpääsy, por región) → usar `1 - share_within_14d` | P2 (0,5) · P1 (0,1) |
| `spec_wait` | % esperando >3 o >6 meses en especializada (THL, por región) | P3 (0,4) · P4 (0,2) |
| `dist_central` | km medios ponderados por población hasta el hospital central (calculado con `regions.json`) | P1 (0,10) · P4 (0,15) |
| `dist_rt` | km medios hasta la unidad de radioterapia/universitario más cercano | P5 (0,20) |
| `ses` | índice socioeconómico (p. ej. % con estudios superiores o renta mediana, Sotkanet/StatFin) → usar inverso | P1 (0,15) |

Reglas:
- Si un indicador falta para una región → M = 1 para ese driver y la confianza de esa región baja un nivel.
- Mostrar en la UI qué drivers explican el exceso de días de cada región ("Lapland: +18 d mainly from distance and primary-care access") — esto alimenta al agente.
- Confianza por región: `media` si todos los drivers tienen dato, `baja` si falta alguno. Las fases P1–P2 siempre `baja/media` (anclaje preliminar).

## 3b. Segundo eje de equidad: vía de entrada (ver `10_insights_presentacion_astrazeneca.md`)

- Cada paciente simulado entra por la vía **pública** o la **laboral/privada** (probabilidad `share_occupational_private` por región; aproximar con la tasa de empleo de StatFin).
- Multiplicadores de `entry_routes` en el JSON: laboral/privada = 0,52 × en P1–P2 y 0,77 × en P3–P5 (de DLBCL, supuesto para pulmón).
- **Recalibrar** para que la media nacional ponderada por población y por vía siga dando 55/41/12/22/24.
- Salidas nuevas: días por vía, **"equity gap"** (pública − laboral/privada) por región y a nivel nacional, y la brecha entre la mejor y la peor región.
- La UI tiene un interruptor "Route: All / Public / Occupational-private" y la historia "Two Mattis".
- Los 8 pasos de la diapositiva 10 de AstraZeneca se agrupan en las 5 fases (P1 = pasos 1–3, P2 = 3–5, P3 = derivación→especialista, P4 = especialista→6, P5 = 6–8, incluido el MDT).

## 3c. Perfil de paciente (decisión del 14-nov, ver `11_planteamiento_final.md`)

Perfil = `{ regionId, route, education, navigationBarrier, distanceKm? }`. La media de cada fase:

```
m[profile,p] = base[p] · M_region[r,p] · k[p] · F_route[p] · F_edu[p] · F_nav[p] · F_dist[p]
```
- Cada `F` está **normalizado** para que su media ponderada por la mezcla de la población de pacientes sea 1 → la media nacional sigue reproduciendo 55/41/12/22/24.
- Multiplicadores y proporciones en `patient_factors` de `pathway_parameters.json` (educación y navegación = `assumption`).
- `F_dist` del perfil = `(distanceKm / dist_central_region)^e` (mín. 5 km) usando las elasticidades del driver de distancia.
- **Descomposición de la brecha** entre dos perfiles: valor de Shapley exacto sobre 5 factores (región-sistema, distancia, vía, educación, navegación), con medias analíticas (2^5 = 32 evaluaciones).
- **8 pasos de AZ**: P1 = 1→3; P2 = 3→4 (30 %) + 4→5 (70 %); P3+P4 = 5→6; P5 = 6→7 MDT (40 %) + 7→8 (60 %). Repartos = supuestos (DLBCL pública: 22/75 ≈ 0,3 en 3→4).

## 3d. Incertidumbre de las intervenciones

- P10/P50/P90 = variabilidad entre pacientes (Monte Carlo con números aleatorios comunes: los mismos `z` para base y escenario → comparaciones estables).
- Incertidumbre de la evidencia = **rango determinista**: días ahorrados con todos los efectos en el mínimo y en el máximo de su rango ("−12 d (7–17)").

## 4. Intervenciones

Cada intervención reduce los días de ciertas fases en un porcentaje con rango. Varias intervenciones sobre la misma fase se combinan con **rendimientos decrecientes**: `reducción_total = 1 - Π (1 - r_i)`. En Monte Carlo, cada `r_i` se muestrea uniforme dentro de su rango (incertidumbre de la evidencia).

| ID | Intervención | Fases (reducción por defecto; rango) | Evidencia y confianza | Acción del plan nacional | Coste/esfuerzo |
|---|---|---|---|---|---|
| `fast_track` | Circuito estandarizado de diagnóstico rápido (modelo SVF/CPP/pakkeforløp) con criterios de derivación estandarizados | P3 −25 % (15–35), P4 −25 % (15–35), P5 −20 % (10–30) | Dinamarca: espera hasta diagnóstico 49→35 d tras CPP (secundaria); Noruega: con estudio óptimo el % en plazo pasaría de 40 % a 80 %; **Suecia: solo 36 % cumple** (riesgo de implantación). **Media** | 2.5.2 (pág. 52–53), 3.1.2 (pág. 56–57) | Dentro de 3.1.1: 25 M€/5 años nacional · esfuerzo alto |
| `econsult` | e-consulta primaria↔neumología (consulta asíncrona antes/en vez de derivación) | P3 −40 % (20–60), P2 −10 % (0–20) | Revisión sistemática: respuesta del especialista 4,6 h–3,9 d; LA County 63→52 d; ECA cardiología 5 vs 24 d. No específico de cáncer. **Media-baja** | 3.5.3 (pág. 73–74) | Parte de 1,14 M€ nacional · esfuerzo medio-bajo |
| `navigator` | Enfermera gestora de caso / coordinador nombrado para cada sospecha | P4 −15 % (5–25), P5 −20 % (10–30) | Observacional: BC Cancer 48→38 d hasta tratamiento sistémico; Akron 64→45 d sospecha→tratamiento. **Baja-media** | Estrategia 1.2 (coordinador nombrado), hoja de ruta 1.2 | Personal (supuesto: 1 ETC por ~100 casos/año) · esfuerzo medio |
| `direct_ct` | Acceso directo a TAC (baja dosis) desde atención primaria | P2 −10 % (0–20) | **ECA danés (Aarhus): sin reducción significativa del tiempo ni del estadio** (ITT). Finlandia tiene la menor densidad de TAC nórdica y TAC solo tras derivación. **Baja** → ejemplo de honestidad: intuitivo pero la evidencia es débil | 2.5.2 ("suorat tutkimusreitit"), 2.5 | Capacidad de imagen · esfuerzo alto |
| `gp_continuity` | Médico de cabecera fijo (omalääkäri) | P2 −10 % (0–20), P1 −5 % (0–10) | Lógica de continuidad asistencial; sin efecto cuantificado en pulmón. **Baja** | 2.5.1 (pág. 51–52) | Programa nacional · esfuerzo alto |
| `awareness` | Campaña de síntomas + reducción del estigma del cáncer de pulmón | P1 −10 % (0–15) | Estrategia 1.3 acción 2; hoja de ruta pág. 23 (estigma retrasa la consulta). **Baja** | 1.3 acc. 2, 2.5 | Bajo · esfuerzo bajo |
| `remote_care` | Teleconsulta oncológica + coordinación de viajes para zonas remotas | reduce un 50 % (25–70) el **componente de distancia** de P4 y P5 | Hoja de ruta pág. 13 (descentralizar lo posible, etäpalvelut); Paakkola 2024 (>50 km, HR 1,47). **Baja** | 3.5.3 | Medio |
| `min_dataset` | Conjunto mínimo de 3 fechas (síntoma, derivación, inicio de tratamiento) registrado en Hilmo/Kanta | **no reduce días**: reduce la incertidumbre (cv × 0,6) y sube la confianza un nivel tras el piloto | Estrategia pág. 30 (no se recoge síntoma→diagnóstico; estadio solo en ~40 % de casos); 3.1.4, 3.2 | 3.1.4, 3.2.1 | Bajo · esfuerzo bajo — **recomendación "cero"** |

El componente de distancia de una fase = `m[r,p] - m[r,p]` recalculado con `dist_* = x_nat` (es decir, los días extra atribuibles a la distancia).

## 5. Salidas del modelo (por región y nacional)

- Días medios por fase y total, con **P10 / P50 / P90** (Monte Carlo, `n = 5000` por región, semilla fija para reproducibilidad en la demo).
- **% within target**: proporción de pacientes simulados con P3+P4+P5 ≤ benchmark (42 d por defecto).
- **Días ahorrados** y **Δ % within target** respecto al escenario base.
- **Atribución**: qué drivers explican la diferencia de la región con la media nacional (para el agente).
- **Pacientes/año afectados**: casos anuales estimados por región = 3 000 × pop_r / pop_nacional (supuesto; sustituir por incidencia regional si se obtiene).

## 6. Calibración y validación (para el pitch)

- La media ponderada nacional por fase reproduce 55/41/12/22/24 (≈155) por construcción.
- Comprobación cruzada: P3+P4+P5 (58 d) vs Oulu derivación→tratamiento 65 d (mediana) y HYKS 61 d → coherente.
- Comprobación de las 4 regiones del estudio Kuittinen (Kuopio, Tampere, Turku, Rovaniemi): si las mentoras dan cifras por hospital, usarlas para ajustar las elasticidades.
- **Validar con Kaisa Kaitila (sábado)**: duración de cada fase en pulmón, qué intervenciones son realistas y qué perfiles se atascan.

## 7. Alerta temprana (COULD) — pacientes sintéticos

- Generar 2 000 pacientes sintéticos por región con atributos: edad, distancia al hospital, vía de entrada (primaria / urgencias), síntomas inespecíficos, vive solo/a.
- Riesgo de retraso = logística con pesos **supuestos y declarados** (p. ej. distancia >50 km, urgencias, síntomas vagos, >75 años).
- Mostrar "profiles at risk" y "who to flag to the named coordinator". Etiqueta grande: **"Synthetic data — real model requires Findata permit in the pilot"**.

## 8. Lo que el modelo NO hace (decirlo en la demo)

- No predice supervivencia ni estadio individual.
- No usa datos de pacientes.
- No sustituye la medición real: precisamente recomienda empezar a medir (`min_dataset`).
