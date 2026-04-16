# Plan de Implementación: Integración Datadog con Support Agent

## Resumen

Implementación incremental que extiende el Support Agent para consultar Datadog, analizar hallazgos con LLM, correlacionar con bugs de Jira, y presentar resultados unificados en el Plan de Resolución. Se sigue el orden: modelos → conector → LLM client → analizador → orquestador → plan → rutas → UI.

## Tareas

- [x] 1. Extender modelos de dominio en `support-agent-models.ts`
  - [x] 1.1 Agregar tipos de Datadog y plan extendido
    - Agregar `DatadogFindingType`, `SuggestedCriticality`, `DatadogLogEntry`, `DatadogMonitor`, `DatadogIncident`, `DatadogFinding`, `AnalyzedDatadogFinding`, `DatadogIssueProposal`, `DatadogMetrics`, `ExtendedResolutionPlan` según el diseño
    - Extender `AnalysisRequest` con campos `includeDatadog?: boolean` y `datadogService?: string`
    - _Requerimientos: 1.1, 3.1, 4.1, 4.2, 5.1, 7.2, 7.4, 8.1_

  - [ ]* 1.2 Escribir tests unitarios para los nuevos tipos
    - Verificar que los tipos se exportan correctamente y que `ExtendedResolutionPlan` extiende `ResolutionPlan`
    - _Requerimientos: 4.1, 5.1_

- [x] 2. Extender `datadog-connector.ts` con funciones de consulta
  - [x] 2.1 Implementar `fetchErrorLogs`, `fetchAlertingMonitors`, `fetchActiveIncidents`, `fetchAvailableServices`
    - `fetchErrorLogs`: GET `/api/v2/logs/events/search` con filtro `status:error` y rango de 24h, acepta filtro opcional de servicio
    - `fetchAlertingMonitors`: GET `/api/v1/monitor` con filtro de estado `Alert` o `Warn`, acepta filtro opcional de servicio por tags
    - `fetchActiveIncidents`: GET `/api/v2/incidents` con filtro de estado activo, acepta filtro opcional de servicio
    - `fetchAvailableServices`: Extrae valores únicos del tag `service` de monitores y logs
    - Agregar función `fetchDatadogFindings` que unifica logs, monitores e incidentes en `DatadogFinding[]`
    - _Requerimientos: 1.2, 1.3, 1.4, 2.2, 2.5_

  - [ ]* 2.2 Escribir test de propiedad para extracción de servicios únicos
    - **Propiedad 2: Extracción de servicios únicos**
    - **Valida: Requerimiento 2.2**

  - [ ]* 2.3 Escribir test de propiedad para filtrado por servicio
    - **Propiedad 3: Filtrado por servicio**
    - **Valida: Requerimientos 2.5, 5.2**

  - [ ]* 2.4 Escribir tests unitarios para `datadog-connector.ts`
    - Tests con mocks HTTP para cada función de fetch (logs, monitores, incidentes, servicios)
    - Edge cases: respuesta vacía, error de red, credenciales inválidas (403), rate limit (429)
    - _Requerimientos: 1.2, 1.3, 1.4, 1.5, 1.6_

- [x] 3. Checkpoint — Verificar que los modelos y el conector compilan correctamente
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Extraer `callGemini` a módulo compartido `llm-client.ts`
  - [x] 4.1 Crear `packages/backend/src/core/llm-client.ts`
    - Extraer `callOpenAI`, `callAnthropic`, `callGemini` de `story-generator.ts` a `llm-client.ts`
    - Exportar función unificada `callLLM(systemPrompt, userPrompt): Promise<string>` que selecciona provider según `LLM_PROVIDER`
    - Actualizar `story-generator.ts` para importar `callLLM` desde `llm-client.ts` en lugar de usar las funciones locales
    - Verificar que `story-generator.ts` sigue funcionando igual tras la extracción
    - _Requerimientos: 3.1, 3.3_

  - [ ]* 4.2 Escribir tests unitarios para `llm-client.ts`
    - Verificar selección de provider (openai, anthropic, gemini)
    - Mock de llamadas HTTP para cada provider
    - _Requerimientos: 3.1_

- [x] 5. Implementar `datadog-findings-analyzer.ts`
  - [x] 5.1 Crear `packages/backend/src/core/datadog-findings-analyzer.ts`
    - Implementar `analyzeDatadogFindings(findings: DatadogFinding[]): Promise<DatadogFindingAnalysis[]>`
    - Para cada hallazgo: construir prompt de sistema experto, llamar a `callLLM`, parsear respuesta JSON con criticidad, servicio afectado, pasos de resolución
    - Implementar fallback heurístico si LLM no está disponible o falla: asignar criticidad según reglas de mapeo del diseño (monitor Alert → critical/high, incidente SEV-1/SEV-2 → critical, etc.)
    - Cada análisis debe incluir `label: "Sugerencia del Agente IA Support"`
    - _Requerimientos: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [ ]* 5.2 Escribir test de propiedad para reglas de mapeo de criticidad
    - **Propiedad 4: Reglas de mapeo de criticidad**
    - **Valida: Requerimientos 3.1, 3.5, 3.6**

  - [ ]* 5.3 Escribir test de propiedad para completitud del análisis
    - **Propiedad 5: Completitud del análisis de hallazgos**
    - **Valida: Requerimientos 3.2, 3.3, 3.4**

  - [ ]* 5.4 Escribir tests unitarios para `datadog-findings-analyzer.ts`
    - Tests con LLM mock: hallazgo de log, monitor, incidente
    - Edge cases: hallazgo sin tags, LLM retorna JSON inválido (fallback heurístico), LLM no disponible
    - _Requerimientos: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [x] 6. Implementar correlación y propuestas de issue
  - [x] 6.1 Agregar función `correlateFindings` en `support-agent.ts`
    - Implementar correlación por similitud de Jaccard (tokenización + umbral >0.3) entre `title`/`message` de hallazgos y `summary`/`description` de bugs
    - Asignar `correlatedBugKey` a hallazgos que superen el umbral
    - Reutilizar patrón de `tokenize` de `bug-validator.ts`
    - _Requerimientos: 7.1, 7.2, 7.3_

  - [x] 6.2 Agregar función `generateIssueProposals` en `support-agent.ts`
    - Para cada hallazgo sin `correlatedBugKey`, generar `DatadogIssueProposal` con título, descripción, severidad sugerida y componente
    - _Requerimientos: 8.1, 8.6_

  - [ ]* 6.3 Escribir test de propiedad para correctitud de correlación
    - **Propiedad 11: Correctitud de correlación**
    - **Valida: Requerimientos 7.1, 7.2, 7.3**

  - [ ]* 6.4 Escribir test de propiedad para generación de propuestas de issue
    - **Propiedad 13: Generación de propuestas de issue**
    - **Valida: Requerimiento 8.1**

  - [ ]* 6.5 Escribir test de propiedad para invariante de conteo
    - **Propiedad 12: Invariante de conteo de correlaciones**
    - **Valida: Requerimiento 7.4**

- [x] 7. Checkpoint — Verificar que analizador, correlación y propuestas funcionan
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Extender `support-agent.ts` con flujo combinado Jira+Datadog
  - [x] 8.1 Extender `analyzeBugs` para soportar `includeDatadog` y `datadogService`
    - Si `includeDatadog: true`: recuperar credenciales Datadog (`datadog-main`) del CredentialStore
    - Ejecutar fetch de Jira y Datadog en paralelo (`Promise.allSettled`)
    - Si Datadog falla: continuar solo con Jira, agregar `datadogWarning` al plan
    - Llamar a `analyzeDatadogFindings`, `correlateFindings`, `generateIssueProposals`
    - Calcular `DatadogMetrics` (totalFindings, correlatedCount, uncorrelatedCount, distribuciones)
    - Ordenar hallazgos por criticidad (critical > high > medium > low)
    - Retornar `ExtendedResolutionPlan`
    - Si `includeDatadog` es `false` o ausente: flujo idéntico al actual (compatibilidad total)
    - _Requerimientos: 1.1, 1.5, 1.6, 2.5, 4.1, 4.2, 4.3, 5.1, 5.2, 5.4, 7.1, 7.4_

  - [ ]* 8.2 Escribir test de propiedad para resiliencia ante fallo de Datadog
    - **Propiedad 1: Resiliencia ante fallo de Datadog**
    - **Valida: Requerimientos 1.5, 1.6**

  - [ ]* 8.3 Escribir test de propiedad para compatibilidad retroactiva
    - **Propiedad 10: Compatibilidad retroactiva**
    - **Valida: Requerimiento 5.4**

  - [ ]* 8.4 Escribir test de propiedad para ordenamiento por criticidad
    - **Propiedad 7: Ordenamiento de hallazgos por criticidad**
    - **Valida: Requerimiento 4.3**

  - [ ]* 8.5 Escribir test de propiedad para estructura del plan con Datadog
    - **Propiedad 6: Estructura del plan con Datadog**
    - **Valida: Requerimientos 4.1, 4.2**

  - [ ]* 8.6 Escribir test de propiedad para no auto-creación de issues
    - **Propiedad 14: Nunca creación automática de issues**
    - **Valida: Requerimiento 8.6**

  - [ ]* 8.7 Escribir tests unitarios para flujo combinado
    - Flujo completo con mocks de Jira y Datadog
    - Edge cases: 0 bugs + hallazgos, hallazgos + 0 bugs, ambos vacíos, Datadog falla parcialmente
    - _Requerimientos: 1.1, 1.5, 1.6, 5.1, 5.4_

- [x] 9. Extender `resolution-plan-generator.ts` con sección Datadog
  - [x] 9.1 Agregar sección de hallazgos Datadog en `exportToMarkdown`
    - Agregar sección "## Hallazgos de Datadog" con título, criticidad y sugerencia de cada hallazgo
    - Agregar métricas de Datadog en la sección de métricas
    - Extender `buildExecutiveSummary` para mencionar ambas fuentes (Jira y Datadog) cuando aplique
    - Incluir sección de propuestas de issue si existen hallazgos sin correlación
    - _Requerimientos: 4.4, 4.5_

  - [ ]* 9.2 Escribir test de propiedad para exportación Markdown con Datadog
    - **Propiedad 8: Exportación Markdown incluye Datadog**
    - **Valida: Requerimiento 4.4**

  - [ ]* 9.3 Escribir test de propiedad para resumen ejecutivo combinado
    - **Propiedad 9: Resumen ejecutivo combinado**
    - **Valida: Requerimiento 4.5**

  - [ ]* 9.4 Escribir tests unitarios para `resolution-plan-generator.ts` extendido
    - Markdown con sección Datadog, plan sin hallazgos, plan solo Datadog
    - _Requerimientos: 4.4, 4.5_

- [x] 10. Checkpoint — Verificar flujo completo backend
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Agregar nuevos endpoints en `routes.ts`
  - [x] 11.1 Extender endpoint `POST /api/support/analyze` para pasar `includeDatadog` y `datadogService`
    - Leer `includeDatadog` y `datadogService` del body y pasarlos a `analyzeBugs`
    - _Requerimientos: 5.1, 5.2, 5.3_

  - [x] 11.2 Agregar endpoint `GET /api/support/datadog/services`
    - Recuperar credenciales Datadog del CredentialStore
    - Llamar a `fetchAvailableServices` y retornar la lista
    - Manejar errores (credenciales no encontradas, error de red)
    - _Requerimiento: 5.5_

  - [x] 11.3 Agregar endpoint `POST /api/support/datadog/create-issue`
    - Recibir `findingId`, `projectKey`, `credentialKey`, `title`, `description`, `severity`, `component` del body
    - Crear issue en Jira usando `createIssues` de `jira-connector.ts`
    - Retornar enlace al issue creado
    - _Requerimientos: 8.4, 8.5, 8.6_

  - [ ]* 11.4 Escribir tests unitarios para los nuevos endpoints
    - Tests con supertest para cada endpoint nuevo
    - Edge cases: body incompleto, credenciales no encontradas, servicio inexistente
    - _Requerimientos: 5.1, 5.2, 5.5, 8.4_

- [x] 12. Extender `SupportView.tsx` con integración Datadog
  - [x] 12.1 Agregar toggle de Datadog y selector de servicio
    - Mostrar toggle solo cuando `connections.datadog === 'connected'`
    - Cuando toggle está habilitado, cargar servicios desde `GET /api/support/datadog/services` y mostrar selector desplegable
    - Enviar `includeDatadog: true` y `datadogService` en la solicitud de análisis
    - Actualizar mensaje de carga a "Analizando bugs en Jira y hallazgos en Datadog..." cuando Datadog está habilitado
    - _Requerimientos: 6.1, 6.2, 6.3, 6.4, 2.1, 2.3, 2.4_

  - [x] 12.2 Agregar sección de hallazgos de Datadog en la vista del plan
    - Mostrar sección separada con hallazgos de Datadog, cada uno con criticidad sugerida, servicio afectado y sugerencia de resolución
    - Mostrar etiqueta "Sugerencia del Agente IA Support" en cada hallazgo
    - Mostrar métricas de Datadog (total hallazgos, distribución por tipo y criticidad)
    - Mostrar advertencia si `datadogWarning` está presente
    - Indicar hallazgos correlacionados con su bug key de Jira
    - _Requerimientos: 6.5, 6.6, 7.2, 7.3_

  - [x] 12.3 Agregar botón "Crear Issue en Jira" con diálogo de confirmación
    - Mostrar botón junto a cada hallazgo sin bug correlacionado
    - Al hacer clic, mostrar diálogo modal con datos pre-llenados (título, descripción, severidad) editables
    - Al confirmar, llamar a `POST /api/support/datadog/create-issue` y mostrar enlace al issue creado
    - Al cancelar, cerrar diálogo sin crear issue
    - _Requerimientos: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

  - [ ]* 12.4 Escribir tests unitarios para `SupportView.tsx` extendido
    - Toggle Datadog visible/oculto según estado de conexión
    - Selector de servicio carga y muestra opciones
    - Sección de hallazgos renderiza correctamente
    - Diálogo de confirmación abre, edita y confirma/cancela
    - _Requerimientos: 6.1, 6.2, 6.5, 8.2, 8.3_

- [x] 13. Checkpoint final — Verificar integración completa
  - Ensure all tests pass, ask the user if questions arise.

## Notas

- Las tareas marcadas con `*` son opcionales y pueden omitirse para un MVP más rápido
- Cada tarea referencia requerimientos específicos para trazabilidad
- Los checkpoints aseguran validación incremental
- Los tests de propiedades validan las 14 propiedades de correctitud del diseño
- Los tests unitarios validan ejemplos específicos y edge cases
