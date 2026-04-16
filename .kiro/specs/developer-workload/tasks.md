# Plan de Implementación: Developer Workload

## Overview

Implementación incremental del módulo Developer Workload en TypeScript. Cada tarea construye sobre la anterior, comenzando por los modelos de datos y terminando con la integración completa en el frontend. El lenguaje de implementación es TypeScript, consistente con el resto del proyecto.

## Tasks

- [x] 1. Crear modelos de datos en workload-models.ts
  - Crear `packages/backend/src/core/workload-models.ts` con todas las interfaces y tipos del diseño
  - Definir: `WorkloadRequest`, `WorkloadFilters`, `WorkloadReport`, `WorkloadSummary`, `DeveloperMetrics`, `HusByStatus`, `WorkloadStatus`, `ProductivityStatus`, `WorkloadAlert`, `JiraStory`, `StatusChange`, `SprintInfo`, `TeamAverages`
  - Definir las constantes de umbrales: `OVERLOADED_THRESHOLD = 1.5`, `UNDERLOADED_THRESHOLD = 0.5`, `HIGH_PRODUCTIVITY_THRESHOLD = 1.3`, `LOW_PRODUCTIVITY_THRESHOLD = 0.7`, `MULTITASKING_THRESHOLD = 3`
  - _Requirements: 3.2, 4.4, 3.5, 8.1, 8.2, 8.3, 8.4, 8.5_

- [x] 2. Implementar JqlBuilder
  - [x] 2.1 Implementar `buildWorkloadJql` en `packages/backend/src/core/jql-builder.ts`
    - La función debe incluir siempre `project = <projectKey> AND issuetype = Story`
    - Agregar cláusula `sprint = "<sprintName>"` cuando `filters.sprint` esté presente
    - Agregar cláusulas `created >= "<startDate>"` y `created <= "<endDate>"` cuando estén presentes
    - Combinar todos los filtros activos con `AND`
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [ ]* 2.2 Escribir unit tests para JqlBuilder
    - Test: JQL base sin filtros contiene `issuetype = Story` y `project = <key>`
    - Test: con sprint agrega cláusula `sprint = "..."`
    - Test: con fechas agrega cláusulas `created >= ...` y `created <= ...`
    - Test: con múltiples filtros los combina con `AND`
    - Ubicación: `packages/backend/tests/unit/core/jql-builder.test.ts`
    - _Requirements: 2.1, 2.2, 2.4_

  - [ ]* 2.3 Escribir property test para JqlBuilder
    - **Property 2: Construcción de JQL incluye todos los filtros activos combinados con AND**
    - **Validates: Requirements 2.1, 2.2, 2.4**
    - Para cualquier combinación de filtros, el JQL resultante debe contener `issuetype = Story`, `project = <projectKey>`, y cada filtro activo como cláusula separada unida por `AND`
    - Ubicación: `packages/backend/tests/property/workload.property.test.ts`

- [x] 3. Implementar MetricsCalculator
  - [x] 3.1 Implementar `groupStoriesByAssignee` en `packages/backend/src/core/metrics-calculator.ts`
    - Agrupar `JiraStory[]` por `assignee.accountId`
    - Ignorar stories sin assignee (assignee === null)
    - Retornar `Map<string, JiraStory[]>`
    - _Requirements: 1.2_

  - [ ]* 3.2 Escribir property test para groupStoriesByAssignee
    - **Property 1: Agrupación por assignee produce exactamente un Developer_Metrics por assignee único**
    - **Validates: Requirements 1.2**
    - El número de grupos debe igualar el número de `accountId` únicos en la lista
    - Ubicación: `packages/backend/tests/property/workload.property.test.ts`

  - [x] 3.3 Implementar `calculateTeamAverages` en metrics-calculator.ts
    - Calcular `averageActivePoints`: promedio de SP activos (no completados) por desarrollador
    - Calcular `averageVelocity`: promedio de SP completados por sprint entre todos los desarrolladores
    - Calcular `averageCycleTime`: promedio de cycle time de todas las HUs completadas, o `null` si no hay
    - _Requirements: 3.2, 4.4_

  - [x] 3.4 Implementar `calculateDeveloperMetrics` en metrics-calculator.ts
    - Calcular `assignedHUs`, `activeStoryPoints`, `completedHUs`, `completedStoryPoints`
    - Calcular `husByStatus` mapeando estados de Jira a `todo/inProgress/done/blocked/other`
    - Calcular `inProgressCount` e `unestimatedHUs`
    - Calcular `multitaskingAlert`: `true` si `inProgressCount > 3`
    - Calcular `velocityIndividual` (>= 0) y `cycleTimeIndividual` (>= 0 o null)
    - Calcular `workloadStatus` usando umbrales contra `teamAverageActivePoints`
    - Calcular `productivityStatus` usando umbrales contra `teamAverageVelocity`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3, 4.4, 4.5_

  - [ ]* 3.5 Escribir property tests para calculateDeveloperMetrics
    - **Property 3: Agregación de métricas es consistente con los datos de entrada**
    - **Validates: Requirements 3.1, 4.3**
    - `assignedHUs` == longitud de la lista; `husByStatus.done` == `completedHUs`; suma de `husByStatus` == `assignedHUs`; `inProgressCount` == `husByStatus.inProgress`
    - **Property 4: Workload_Status sigue los umbrales definidos**
    - **Validates: Requirements 3.2**
    - **Property 5: Multitasking alert sigue el umbral de 3 HUs en progreso**
    - **Validates: Requirements 3.5**
    - **Property 6: Velocity_Individual y Cycle_Time_Individual son no negativos o null**
    - **Validates: Requirements 4.5, 8.5**
    - **Property 7: Productivity_Status sigue los umbrales definidos**
    - **Validates: Requirements 4.4**
    - Ubicación: `packages/backend/tests/property/workload.property.test.ts`

  - [x] 3.6 Implementar `buildAlerts` en metrics-calculator.ts
    - Generar alerta tipo `overloaded` para cada developer con `workloadStatus = "overloaded"` (incluir `activeStoryPoints` y `excessPercentage`)
    - Generar alerta tipo `low_productivity` para cada developer con `productivityStatus = "low"` (incluir `velocityIndividual` y `velocityDifference`)
    - Generar alerta tipo `multitasking` para cada developer con `multitaskingAlert = true`
    - Ordenar: primero developers con múltiples problemas simultáneos (`severity = "high"`), luego los de un solo problema (`severity = "medium"`)
    - _Requirements: 5.1, 5.2, 5.4_

  - [ ]* 3.7 Escribir property tests para buildAlerts
    - **Property 8: Alertas contienen exactamente los desarrolladores con problemas, ordenados por severidad**
    - **Validates: Requirements 5.1, 5.2, 5.4**
    - **Property 9: hasAlerts es el reflejo exacto del estado de la lista de alertas**
    - **Validates: Requirements 5.3, 5.5**
    - Ubicación: `packages/backend/tests/property/workload.property.test.ts`

  - [x] 3.8 Implementar `calculateSummary` en metrics-calculator.ts
    - Calcular `totalDevelopers`, `totalHUs`, `averageStoryPointsPerDeveloper`, `teamVelocityAverage`, `teamCycleTimeAverage`
    - _Requirements: 8.3_

  - [ ]* 3.9 Escribir unit tests para MetricsCalculator
    - Test: developer sin HUs completadas → `velocityIndividual = 0`, `cycleTimeIndividual = null`
    - Test: developer con más de 3 HUs en progreso → `multitaskingAlert = true`
    - Test: developer con SP activos > 1.5x promedio → `workloadStatus = "overloaded"`
    - Test: proyecto sin HUs asignadas → reporte vacío
    - Ubicación: `packages/backend/tests/unit/core/metrics-calculator.test.ts`
    - _Requirements: 4.5, 3.5, 3.2, 1.4_

- [ ] 4. Checkpoint — Verificar lógica de cálculo
  - Asegurarse de que todos los tests de MetricsCalculator y JqlBuilder pasen. Consultar al usuario si hay dudas.

- [x] 5. Extender JiraConnector con fetchStoryIssues y fetchProjectSprints
  - [x] 5.1 Implementar `fetchStoryIssues` en `packages/backend/src/integration/jira-connector.ts`
    - Ejecutar la consulta JQL recibida contra `/rest/api/3/search` con los campos: `assignee,summary,status,customfield_10016,sprint,created,resolutiondate,updated,changelog`
    - Mapear la respuesta de Jira al tipo `JiraStory[]` definido en workload-models.ts
    - Extraer `storyPoints` de `customfield_10016` (puede ser null)
    - Extraer `changelog.histories` para construir `StatusChange[]`
    - Reutilizar `jiraRequest` y el patrón de retry existente para `NETWORK_ERROR`
    - _Requirements: 1.1, 1.3, 9.1, 9.4_

  - [x] 5.2 Implementar `fetchProjectSprints` en jira-connector.ts
    - Consultar la Agile API: `/rest/agile/1.0/board?projectKeyOrId=<projectKey>` para obtener el boardId
    - Consultar `/rest/agile/1.0/board/<boardId>/sprint?state=active,closed,future` para obtener sprints
    - Mapear la respuesta al tipo `SprintInfo[]`
    - _Requirements: 2.5_

  - [ ]* 5.3 Escribir unit tests para las nuevas funciones del JiraConnector
    - Test: `fetchStoryIssues` mapea correctamente los campos de Jira a `JiraStory`
    - Test: `fetchStoryIssues` retorna array vacío cuando no hay issues
    - Test: `fetchProjectSprints` retorna lista de sprints con estado correcto
    - Ubicación: `packages/backend/tests/unit/integration/jira-connector-workload.test.ts`
    - _Requirements: 1.1, 1.3, 2.5_

- [x] 6. Implementar WorkloadAnalyzer
  - [x] 6.1 Implementar `analyzeWorkload` en `packages/backend/src/core/workload-analyzer.ts`
    - Recuperar credenciales del `CredentialStore` usando `credentialKey`; lanzar `CREDENTIALS_NOT_FOUND` si no existen
    - Llamar a `buildWorkloadJql` con `projectKey` y `filters`
    - Llamar a `fetchStoryIssues` con las credenciales y el JQL construido
    - Si no hay stories, retornar `WorkloadReport` vacío con `hasAlerts: false`
    - Llamar a `groupStoriesByAssignee`, `calculateTeamAverages`, `calculateDeveloperMetrics` por cada developer
    - Llamar a `buildAlerts` y `calculateSummary`
    - Construir y retornar el `WorkloadReport` con `generatedAt` en ISO 8601
    - _Requirements: 1.1, 1.2, 1.4, 1.5, 5.3, 8.1, 8.4_

  - [x] 6.2 Implementar `getProjectSprints` en workload-analyzer.ts
    - Recuperar credenciales del `CredentialStore`
    - Llamar a `fetchProjectSprints` y retornar `SprintInfo[]`
    - _Requirements: 2.5_

  - [ ]* 6.3 Escribir unit tests para WorkloadAnalyzer
    - Test: retorna HTTP 400 cuando falta `projectKey` o `credentialKey`
    - Test: retorna error `CREDENTIALS_NOT_FOUND` cuando `credentialKey` no existe
    - Test: retorna `WorkloadReport` vacío cuando el proyecto no tiene HUs asignadas
    - Test: `hasAlerts: true` cuando hay al menos un developer con `workloadStatus = "overloaded"`
    - Test: `hasAlerts: false` cuando todos los developers tienen status normal
    - Ubicación: `packages/backend/tests/unit/core/workload-analyzer.test.ts`
    - _Requirements: 1.4, 7.2, 7.3, 5.3, 5.5_

  - [ ]* 6.4 Escribir property tests para WorkloadReport completo
    - **Property 10: Estructura completa del WorkloadReport**
    - **Validates: Requirements 8.1, 8.2, 8.3**
    - **Property 11: Fechas en formato ISO 8601**
    - **Validates: Requirements 8.4**
    - Ubicación: `packages/backend/tests/property/workload.property.test.ts`

- [x] 7. Agregar endpoints REST en routes.ts
  - [x] 7.1 Implementar `POST /api/workload/analyze` en `packages/backend/src/api/routes.ts`
    - Validar que `projectKey` y `credentialKey` estén presentes; retornar HTTP 400 si faltan
    - Llamar a `analyzeWorkload(request)`
    - Manejar errores: `CREDENTIALS_NOT_FOUND` → HTTP 404, `JIRA_AUTH_FAILED` → HTTP 401, `JIRA_NOT_FOUND` → HTTP 404, `JIRA_PERMISSION_DENIED` → HTTP 403, `NETWORK_ERROR` → HTTP 502
    - Retornar `WorkloadReport` con HTTP 200 y `Content-Type: application/json`
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [x] 7.2 Implementar `GET /api/workload/:projectKey/sprints` en routes.ts
    - Validar que `credentialKey` esté presente como query param; retornar HTTP 400 si falta
    - Llamar a `getProjectSprints` y retornar `SprintInfo[]`
    - _Requirements: 2.5_

  - [ ]* 7.3 Escribir property test para validación de endpoints
    - **Property 12: Endpoint rechaza requests sin campos obligatorios**
    - **Validates: Requirements 7.2**
    - Para cualquier request sin `projectKey` o `credentialKey`, la respuesta debe ser HTTP 400
    - Ubicación: `packages/backend/tests/property/workload.property.test.ts`

- [ ] 8. Checkpoint — Verificar backend completo
  - Asegurarse de que todos los tests del backend pasen. Consultar al usuario si hay dudas.

- [x] 9. Implementar WorkloadView en el frontend
  - [x] 9.1 Crear `packages/frontend/src/components/WorkloadView.tsx` con el estado `idle`
    - Implementar el `FilterPanel` con inputs para `projectKey` (obligatorio), selector de sprint (poblado desde `GET /api/workload/:projectKey/sprints`), y campos de fecha `startDate`/`endDate`
    - Mostrar botón "Analizar Carga" deshabilitado si `projectKey` está vacío
    - Mostrar errores en componente de alerta con botón de reintento
    - _Requirements: 6.4, 6.5, 9.5_

  - [x] 9.2 Agregar estado `loading` y llamada al endpoint en WorkloadView
    - Al ejecutar el análisis, hacer `POST /api/workload/analyze` con `{ projectKey, credentialKey: jiraCredentialKey, filters }`
    - Mostrar spinner con label "Analizando carga de trabajo..." durante la espera
    - Manejar errores y volver al estado `idle` con mensaje de error visible
    - _Requirements: 6.5, 9.5_

  - [x] 9.3 Implementar estado `report` con SummaryCards y AlertsBanner en WorkloadView
    - `SummaryCards`: mostrar `totalDevelopers`, `totalHUs`, `averageStoryPointsPerDeveloper` como tarjetas de métricas
    - `AlertsBanner`: mostrar sección de alertas en la parte superior cuando `hasAlerts = true`, listando cada alerta con nombre del developer y descripción
    - _Requirements: 6.3, 6.6_

  - [x] 9.4 Implementar DeveloperTable con DeveloperRow en WorkloadView
    - Tabla con columnas: nombre, HUs asignadas, SP activos, Workload Status, HUs completadas, Velocity, Cycle Time, Productivity Status
    - `DeveloperRow`: fila con color rojo para `overloaded`, amarillo para `underloaded`, verde para `normal`
    - _Requirements: 6.1, 6.2_

  - [ ]* 9.5 Escribir unit tests para WorkloadView
    - Test: muestra `AlertsBanner` cuando `hasAlerts = true`
    - Test: muestra spinner durante el fetch
    - Test: muestra mensaje de error cuando el backend retorna error
    - Test: filas de la tabla tienen el color correcto según `workloadStatus`
    - Ubicación: `packages/frontend/src/components/WorkloadView.test.tsx`
    - _Requirements: 6.2, 6.3, 6.5, 9.5_

- [x] 10. Integrar WorkloadView en App.tsx y useAppStore
  - [x] 10.1 Agregar `'workload'` al tipo `View` en `packages/frontend/src/store/useAppStore.ts`
    - Extender el tipo `View` para incluir `'workload'`
    - _Requirements: 6.4_

  - [x] 10.2 Registrar WorkloadView en `packages/frontend/src/App.tsx`
    - Importar `WorkloadView` y agregar el case `'workload'` en `renderView()`
    - Agregar ítem `{ id: 'workload', label: 'Workload' }` al array `NAV_ITEMS`
    - _Requirements: 6.4_

- [ ] 11. Checkpoint final — Verificar integración completa
  - Asegurarse de que todos los tests del backend y frontend pasen. Consultar al usuario si hay dudas.

## Notes

- Las tareas marcadas con `*` son opcionales y pueden omitirse para un MVP más rápido
- Cada tarea referencia los requerimientos específicos para trazabilidad
- Los property tests usan `fast-check` (ya disponible en el proyecto)
- Los umbrales de clasificación están definidos en `workload-models.ts` como constantes exportadas
- `WorkloadView` sigue el mismo patrón de estados `idle → loading → report` que `SupportView`
- `fetchStoryIssues` y `fetchProjectSprints` reutilizan `jiraRequest` y el patrón de retry existente en `jira-connector.ts`
