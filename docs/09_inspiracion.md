# 09 · Inspiración: proyectos similares y qué copiar de cada uno

> Investigación del 13-nov-2026. No encontramos ganadores anteriores de un reto de AstraZeneca en Junction (parece que es la primera vez que lo plantean), así que no hay una plantilla de "lo que gana aquí".

## 1. Simulaciones del recorrido del cáncer de pulmón (validan nuestro enfoque)

**England et al., Gales, 2021 — [Examining the diagnostic pathway for lung cancer patients in Wales using discrete event simulation](https://tlcr.amegroups.org/article/view/50482/html)**
- Simulación del recorrido diagnóstico de pulmón en dos hospitales galeses, validada con datos reales.
- Resultado: **unos 20 días menos** si la primera consulta es en ≤7 días y se agilizan las pruebas. **Empezar el tratamiento ≤21 días después del diagnóstico** hace que casi todos cumplan el objetivo de 62 días.
- 👉 **Copiar:** citarlo como evidencia de `fast_track` (fuente S24) y en el pitch: "simulations like ours already guide lung cancer redesign in Wales".

**Aneurin Bevan (Gales) — [modelo de ~80 actividades](https://pmc.ncbi.nlm.nih.gov/articles/PMC9901409)**
- Recorrido de pulmón con unas 80 actividades con tiempos; **+21 % de pacientes dentro del objetivo de 62 días** con los cambios simulados.
- 👉 **Copiar:** confirma que "% dentro del objetivo" es la métrica correcta. Respuesta lista si el jurado dice "5 fases es demasiado simple": "Wales used 80 activities with patient-level data; with public aggregated data, 5 phases is the honest resolution."

**UCL — [Cancer Pathway Simulator](https://xip.uclb.com/product/cancer-pathway-simulator)**
- Herramienta de simulación con licencia para hospitales del NHS: uso de recursos y esperas por paso del recorrido, validada con datos históricos.
- 👉 **Copiar en el pitch:** "England's NHS trusts already use pathway simulators; Finnish counties have none."

**NHS Lothian / St Andrews — [simulación desde registros de pacientes](https://research-portal.st-andrews.ac.uk/en/publications/a-simulation-based-approach-for-the-behavioural-analysis-of-cance/)** y [revisión de 51 estudios de simulación en cáncer](https://informahealthcare.com/doi/full/10.1080/20476965.2024.2322451)
- La limitación más frecuente en estos estudios es **la falta de datos** → justifica nuestra recomendación cero (`min_dataset`).

## 2. Gemelos digitales en 3D

**Rutgers 2026 — [3D digital twin of a blood cancer clinic](https://www.news-medical.net/news/20260623/Computer-simulations-can-drastically-reduce-endless-wait-times-for-medical-care.aspx)** ([nota de Rutgers](https://newbrunswick.rutgers.edu/news/how-rutgers-reduced-cancer-treatment-times))
- Gemelo digital 3D de una clínica, validado con meses de datos reales; estimó **75–90 minutos menos** por visita con un laboratorio propio y una agenda equilibrada.
- 👉 **Copiar:** el término "digital twin" está de moda y es creíble. Nuestra versión es **a escala de país** (el recorrido entero, no una clínica).

## 3. Agentes de IA que manejan simuladores (lo mismo que hacemos con Gemini)

**[pythonhealthdatascience/des_agent](https://awesome.ecosyste.ms/projects/github.com%2Fpythonhealthdatascience%2Fdes_agent)**
- Agente LLM que descubre, ejecuta y compara una simulación sanitaria (un call centre) expuesta como servidor MCP.
- 👉 **Copiar:** el patrón "planificar → simular → reflexionar → informar". Diferencia nuestra: corpus de política nacional + mapa 3D + datos reales de Finlandia.

**[H-AdminSim (CHIL 2026)](https://ljm565.github.io/h_adminsim_project/)**
- Simulador multiagente de tareas administrativas hospitalarias: las tareas resueltas **con herramientas** superan el 99 % de éxito.
- 👉 **Argumento técnico para Google:** nuestra regla "el LLM nunca calcula cifras, las pide a herramientas" es la arquitectura robusta.

## 4. Paneles de variación regional (lo que el jurado ya ha visto: hay que superarlo)

- **CRUK** — [Cancer waiting times across the pathway](https://www.cancerresearchuk.org/health-professional/our-reports-and-publications/cancer-waiting-times-across-the-pathway-key-statistics) y [estadísticas de esperas de NHS England](https://www.england.nhs.uk/statistics/statistical-work-areas/cancer-waiting-times/).
- **Pfizer UK** — [heatmap of cancer services in England](https://pfizer.co.uk/news/news-and-featured-articles/heatmap-of-cancer-services-in-england): una farmacéutica publicando un mapa de calor regional → el jurado de AstraZeneca reconocerá el formato.
- **[Prioritising regions and pathways to improve](https://tecowling.quarto.pub/volume-alliance-pathway.html)**: análisis que ordena regiones y recorridos según dónde mejorar primero.
- 👉 **Idea nueva para Polku: "días-paciente perdidos al año".** `casos anuales de la región × días de exceso frente a la media (o frente a Dinamarca)`. Es una sola cifra que un directivo entiende ("Lapland loses ~X patient-days per year") y permite **ordenar las regiones para FICAN** en una vista nacional. Añadir a `04_modelo_simulacion.md` §5 y como métrica del mapa.

## 5. Mapas de acceso en hackathones

- **AmeriBurn HeatMap Hackathon** — [Equitable access to burn care](https://www.ameriburn.org/news/equitable-access-to-burn-care-in-the-united-states-reflections-on-the-heatmap-hackathon-finals): puntuación de acceso calculada por área pequeña (1 505 zonas censales, luego 3 144 condados).
- **Kuala Lumpur, AI Tinkerers** — [mapa de distancia de la población rural a los centros](https://kuala-lumpur.aitinkerers.org/hackathons/h_2YdqIPR1yZs/teams/ht_wfiPnSz1zKw).
- 👉 **Copiar (SHOULD si sobra tiempo):** una capa fina por **municipio** debajo de las regiones con los km (o minutos) hasta el hospital central y el de radioterapia. Hace visible que "Lapland" no es homogénea (Rovaniemi frente a Utsjoki).
- **Datos de viaje en Finlandia:** el [Helsinki Region Travel Time Matrix](https://www.helsinki.fi/en/researchgroups/digital-geography-lab/helsinki-region-travel-time-matrix-2013-2018) solo cubre la región de la capital. A escala nacional, usar distancia en línea recta × **factor de carretera ~1,3 (supuesto)**, o un servidor de rutas OSRM si da tiempo.

## 6. Casos finlandeses que dan credibilidad al piloto

**Kaiku Health (Helsinki)** — [piloto en North Karelia financiado por Sitra](https://sitra.fi/en/articles/patients-using-a-self-monitoring-app-are-more-open-and-can-better-remember-to-report-how-they-are-doing)
- App de seguimiento de pacientes con cáncer: unos 60 pacientes; más sensación de seguridad y menos carga para las enfermeras.
- Las enfermeras pidieron **integrarla con el sistema de historia clínica** para no trabajar con dos sistemas.
- 👉 **Copiar en la propuesta de piloto:** "Polku plugs into existing data flows (Hilmo/Kanta, county data lakes) — no new system for clinicians."

**Pfizer, Oncology CAUSE** — [Reuters Events, premio de equidad en salud](https://events.reutersevents.com/pharma/article/winner-health-equity)
- Una farmacéutica con una herramienta de IA sobre datos reales para reducir abandonos y retrasos en el cáncer.
- 👉 **Encaje con AstraZeneca:** una farmacéutica como facilitadora de la mejora regional, no solo vendedora de fármacos.

## Resumen: qué cambiar o añadir en Polku
1. **Métrica "patient-days lost per year"** por región y una vista nacional ordenada (para FICAN). → MUST ligero (es solo una cuenta).
2. **Evidencia de Gales (S24)** en la intervención `fast_track` y en el pitch.
3. **Frase de legitimidad:** "pathway simulators are standard in the NHS; Finland has none".
4. **Capa municipal de acceso** (SHOULD): km o minutos hasta el hospital central y el de radioterapia.
5. **Panel "How Polku reasoned"** (planificar → simular → comparar → recomendar) para que el jurado de Google vea al agente trabajar.
6. **Propuesta de piloto** apoyada en el precedente de Kaiku en North Karelia: integración con sistemas existentes, sin pantallas nuevas para los clínicos.
