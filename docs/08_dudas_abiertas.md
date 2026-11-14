# 08 · Dudas abiertas (actualizar a medida que se resuelvan)

| # | Duda | A quién preguntar | Estado |
|---|---|---|---|
| 1 | Hora límite exacta de entrega y formato (repo, vídeo, demo, duración máxima del vídeo) | Organización de Junction | abierta |
| 2 | ¿Se puede presentar el mismo proyecto a AstraZeneca + Gemini (+ Aiven)? | Organización / stands | abierta |
| 3 | Créditos de Gemini: formulario enviado, clave recibida, nombre de modelo disponible | Stand de Google DeepMind | ✅ resuelta: clave en .env, gemini-4-argon + gemini-3.8-flash |
| 4 | Condiciones del premio de Aiven (qué servicio cuenta, cómo se declara) | Stand de Aiven | abierta |
| 5 | Plazos objetivo de THL para pulmón (Ohjaus 21/2016) | Kaisa Kaitila / THL | abierta |
| 6 | Tiempos por fase en pulmón y datos por hospital del estudio Kuittinen | Kaisa Kaitila | abierta |
| 7 | Qué hospitales tienen radioterapia (los `null` en `regions.json`) | Mentoras / webs de las regiones | abierta |
| 8 | Acceso a primaria y esperas en especializada por región: ¿API de Sotkanet o CSV de THL? | Persona A | abierta |
| 9 | Tablas regionales del informe "Keuhkosyöpä Suomessa" (descarga manual) | Persona A | abierta |
| 10 | Número de miembros del equipo y su perfil → completar los roles en `07_plan_accion.md` | Equipo | abierta |
| 11 | Nombre final del producto ("Polku") y logo | Equipo | abierta |

| 12 | **Radioterapia en Rovaniemi (LKS), Joensuu, Jyväskylä, Pori, Seinäjoki, Lappeenranta, Mikkeli…**: en `regions.json` solo 8 hospitales tienen RT confirmada; el resto cuenta como "sin RT" → la distancia a RT de Laponia (193 km) puede estar sobrestimada | Kaisa / webs de las regiones | abierta |
| 13 | Esperas en especializada (Sotkanet 3336) no publicadas para las 4 regiones de Uusimaa (HUS) → confianza "low" en esas regiones | Persona A (¿dato HUS agregado?) | abierta |
| 14 | Proporción de pacientes de pulmón con salud laboral: bajada a 0,25 (supuesto) | Kaisa / NORDCAN edad | abierta |

## Datos reales ya integrados (14-nov, `scripts/fetch-data.mjs` + `build-data.mjs`)
- Polígonos oficiales de las 22 regiones y 292 municipios (Tilastokeskus 2026), población, % 65+ y % lengua extranjera (StatFin 2025).
- THL Sotkanet: 6411 (espera >7 d en primaria), 3336 (espera >6 meses en especializada), 3195 (% estudios superiores). Último año disponible (2025).
- Distancias: línea recta del centroide municipal al hospital central y al centro de RT confirmado más cercano, ponderadas por población.

## Supuestos activos (si se confirman o cambian, actualizar `pathway_parameters.json`)
- Medias por fase 55/41/12/22/24 días (ancla: 155 d preliminar).
- Elasticidades de los drivers regionales (todas `assumption`).
- Benchmark de 42 días derivación→tratamiento.
- Efectos de las intervenciones (rangos en el JSON).
- 1 ETC de enfermera gestora por ~100 casos/año.
