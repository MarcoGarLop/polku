# docs/fuentes

`estrategia_y_hoja_de_ruta_texto_completo.md` contiene el texto extraído, página a página, de:
- §3.1 Estrategia nacional del cáncer 2026–2035 (64 págs., finés). Encabezados "### Página N" = página del PDF.
- §3.2 Hoja de ruta de implementación 2026–2031 (111 págs., finés). Encabezados "### Página N" = página del PDF (coincide con el número impreso).
- §3.3 Lista de enlaces de datos de AstraZeneca.

⚠️ **Ignorar las secciones 1 y 4 de ese archivo.** Las escribió otra herramienta que interpretó el reto como un análisis de inversión en bolsa de AstraZeneca (precio de la acción, riesgos comerciales). No tienen relación con este proyecto ni deben enviarse a Gemini.

Para el contexto largo de Gemini: usar solo §3.1 y §3.2, insertando marcadores `[STRATEGY p.N]` / `[ROADMAP p.N]` en cada página (script en `apps/server/src/context.ts`).
