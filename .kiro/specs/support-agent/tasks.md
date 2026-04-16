# Plan de Implementación: Support Agent

## Descripción General

Este plan descompone la implementación del Support Agent en tareas accionables e incrementales. El módulo analiza bugs de Jira, valida cada incidencia, estima esfuerzo en story points Fibonacci, prioriza con un Priority Score ponderado, genera sugerencias técnicas de resolución y produce un Resolution Plan en Markdown. Los resultados se sincronizan de vuelta a Jira.

Stack tecnológico: TypeScript/Node.js, Express, React, Jest + fast-check.

## Tareas

- [x] 1. Definir modelos de dominio del Support Agent
  - [x] 1.1 Crear interfaces y tipos en `packages/backend/src/core/support-agent-models.ts`
    - Definir `BugIssue`, `JiraComment`, `BugFilters`
    - Definir `ValidationResult`, `BugClassification`, `Severity`
    - Definir `EffortEstimate`, `FibonacciPoint`, `ConfidenceLevel`, `EstimationFactors`
    - Definir `PriorityScore`, `PriorityCategory`, `PrioritizedBug`, `AnalyzedBug`
    - Definir `ResolutionSuggestion`, `AffectedLayer`
    - Definir `ResolutionPlan`, `ResolutionPlanMetrics`, `FailedBugAnalysis`
    - Definir `SyncReport`, `BugUpdatePayload`, `AnalysisRequest`
    - Exportar la constante `FIBONACCI: FibonacciPoint[] = [1, 2, 3, 5, 8, 13]`
    - _Requerimientos: 1.3, 2.1, 2.5, 3.1, 3.6, 4.1, 4.4, 5.1, 6.1, 6.2, 7.1, 7.5_

- [x] 2. Extender JiraConnector con soporte de bugs
  - [x] 2.1 Implementar `fetchBugIssues()` en `packages/backend/src/integration/jira-connector.ts`
    - Construir JQL query: `project = {key} AND issuetype = Bug AND status in (Open, "In Progress", Reopened)`
    - Aplicar filtros opcionales de `BugFilters` (severities, components, createdAfter, createdBefore)
    - Mapear respuesta de Jira a array de `BugIssue` con todos los campos requeridos
    - Reutilizar `jiraRequest()` y `createJiraError()` existentes
    - _Requerimientos: 1.1, 1.2, 1.3, 1.5_

  - [x] 2.2 Implementar `updateBugWithAnalysis()` en `packages/backend/src/integration/jira-connector.ts`
    - Para cada `BugUpdatePayload`: POST comentario en ADF a `/rest/api/3/issue/{key}/comment`
    - Actualizar campo priority con PUT a `/rest/api/3/issue/{key}`
    - Añadir label `support-agent-reviewed` al issue
    - Aplicar retry con exponential backoff (máximo 3 intentos) para errores de red
    - Retornar `SyncReport` con conteos de éxito y fallo
    - _Requerimientos: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [ ]* 2.3 Escribir property test para filtrado de bugs
    - **Property 1: Bug Query Filter Correctness**
    - **Valida: Requerimientos 1.2, 1.5**

  - [ ]* 2.4 Escribir property test para completitud de campos BugIssue
    - **Property 2: Bug Issue Field Completeness**
    - **Valida: Requerimiento 1.3**

  - [ ]* 2.5 Escribir unit tests para extensiones del JiraConnector
    - Test `fetchBugIssues()` con filtros de status, severity y componente
    - Test `fetchBugIssues()` cuando el proyecto no tiene bugs activos
    - Test `updateBugWithAnalysis()` con un bug fallido y los demás exitosos
    - Test `updateBugWithAnalysis()` retorna SyncReport con conteos correctos
    - _Requerimientos: 1.1, 1.2, 1.4, 7.1-7.5_

- [x] 3. Implementar BugValidator
  - [x] 3.1 Crear `packages/backend/src/core/bug-validator.ts`
    - Implementar `inferSeverity(bug)`: mapear priority de Jira a `Severity`; si no determinable, retornar `{ severity: 'Medium', defaulted: true }`
    - Implementar `detectDuplicates(bug, candidates)`: comparar summary y description por similitud; retornar ID del original si se detecta duplicado
    - Implementar `validateBug(bug, allBugs)`: determinar `BugClassification`, asignar severity, generar justificación, identificar `affectedComponents`
    - Si descripción insuficiente → clasificar como `needs_more_info` con lista de `missingInfo`
    - Si duplicado detectado → clasificar como `duplicate` con `duplicateOfId`
    - _Requerimientos: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 9.4_

  - [ ]* 3.2 Escribir property test para invariante estructural de ValidationResult
    - **Property 3: Validation Result Structural Invariant**
    - **Valida: Requerimientos 2.1, 2.2, 2.3, 2.4, 2.5**

  - [ ]* 3.3 Escribir unit tests para BugValidator
    - Test bug con descripción mínima → clasificación `needs_more_info`
    - Test dos bugs con summary idéntico → detección de duplicado con referencia al original
    - Test bug con priority "Highest" en Jira → severity `Critical`
    - Test bug sin priority en Jira → severity `Medium` con `severityDefaulted: true`
    - Test bug válido con componentes en descripción → `affectedComponents` no vacío
    - _Requerimientos: 2.1-2.6, 9.4_

- [ ] 4. Checkpoint - Verificar modelos y validación
  - Asegurarse de que todas las pruebas pasen, preguntar al usuario si surgen dudas.

- [x] 5. Implementar EffortEstimator
  - [x] 5.1 Crear `packages/backend/src/core/effort-estimator.ts`
    - Implementar `nearestFibonacci(value)`: retornar el valor más cercano en `FIBONACCI`
    - Implementar `estimateEffort(bug, validation)`:
      - Calcular `severityScore` (Critical=4, High=3, Medium=2, Low=1)
      - Calcular `complexityScore` basado en longitud de descripción y presencia de stack trace
      - Calcular `componentCount` desde `validation.affectedComponents.length`
      - Determinar `hasReproductionSteps` desde descripción del bug
      - Mapear score total a Fibonacci con `nearestFibonacci()`
      - Si `validation.severity === 'Critical'` → garantizar `storyPoints >= 3`
      - Determinar `confidence` según completitud de información
    - Implementar `calculateTotalEffort(estimates)`: sumar todos los `storyPoints`
    - _Requerimientos: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [ ]* 5.2 Escribir property test para invariante Fibonacci
    - **Property 4: Effort Estimate Fibonacci Invariant**
    - **Valida: Requerimientos 3.1, 3.3, 3.5, 3.6**

  - [ ]* 5.3 Escribir property test para monotonicidad de estimación
    - **Property 5: Effort Estimation Monotonicity**
    - **Valida: Requerimiento 3.2**

  - [ ]* 5.4 Escribir unit tests para EffortEstimator
    - Test bug Critical → storyPoints >= 3
    - Test bug Low sin pasos de reproducción → storyPoints bajo (1 o 2)
    - Test `nearestFibonacci(4)` → 3 o 5
    - Test `calculateTotalEffort([])` → 0
    - Test confidence `High` cuando hay descripción completa y pasos de reproducción
    - _Requerimientos: 3.1-3.6_

- [x] 6. Implementar BugPrioritizer
  - [x] 6.1 Crear `packages/backend/src/core/bug-prioritizer.ts`
    - Definir `PRIORITY_WEIGHTS = { severity: 0.4, age: 0.3, usersAffected: 0.2, criticalImpact: 0.1 }`
    - Implementar `calculatePriorityScore(bug, validation)`:
      - `severityComponent`: Critical=100, High=75, Medium=50, Low=25
      - `ageComponent`: normalizar días desde `createdDate` (más antiguo = mayor score, cap en 365 días)
      - `usersAffectedComponent`: extraer número de usuarios mencionados en descripción/comments; 0 si no se menciona
      - `criticalImpactComponent`: 100 si afecta funcionalidades críticas (auth, payments, data loss), 0 si no
      - `total = 0.4*severity + 0.3*age + 0.2*usersAffected + 0.1*criticalImpact`
    - Implementar `categorizeBug(score)`: score >= 70 → `critical`; score >= 40 → `important`; else → `planned`
    - Implementar `prioritizeBugs(bugs)`: ordenar por `priorityScore.total` desc; empates por `createdDate` asc
    - _Requerimientos: 4.1, 4.2, 4.3, 4.4_

  - [ ]* 6.2 Escribir property test para Priority Score y ordenamiento
    - **Property 7: Priority Score and Ordering**
    - **Valida: Requerimientos 4.1, 4.2, 4.3**

  - [ ]* 6.3 Escribir property test para completitud y disjunción de categorías
    - **Property 8: Priority Category Completeness and Disjointness**
    - **Valida: Requerimiento 4.4**

  - [ ]* 6.4 Escribir unit tests para BugPrioritizer
    - Test bug Critical reciente vs bug Low antiguo → Critical tiene mayor score
    - Test dos bugs con mismo score → ordenados por fecha de creación (más antiguo primero)
    - Test `categorizeBug(75)` → `critical`
    - Test `categorizeBug(50)` → `important`
    - Test `categorizeBug(20)` → `planned`
    - Test lista de bugs → cada bug pertenece a exactamente una categoría
    - _Requerimientos: 4.1-4.4_

- [ ] 7. Checkpoint - Verificar estimación y priorización
  - Asegurarse de que todas las pruebas pasen, preguntar al usuario si surgen dudas.

- [x] 8. Implementar ResolutionSuggestionGenerator
  - [x] 8.1 Crear `packages/backend/src/core/resolution-suggestion-generator.ts`
    - Implementar `extractErrorInfo(description)`: detectar stack traces, códigos de error HTTP, mensajes de excepción
    - Implementar `inferAffectedLayers(components, description)`: mapear componentes y keywords a `AffectedLayer[]`
      - Keywords de backend: "API", "endpoint", "service", "database", "query"
      - Keywords de frontend: "UI", "component", "render", "display", "button"
      - Keywords de database: "migration", "schema", "index", "query", "constraint"
      - Keywords de configuration: "config", "env", "setting", "variable"
      - Si múltiples capas → incluir `'multiple'`
    - Implementar `generateSuggestion(bug, validation)`:
      - Generar al menos 1 paso técnico concreto en `steps`
      - Inferir `probableOrigin` desde `affectedComponents` y descripción
      - Generar `testingApproach` basado en tipo de bug y capas afectadas
      - Si descripción contiene pasos de reproducción → incluir `reproductionStepsUsage`
      - Si `extractErrorInfo()` retorna valor → incluir `errorInterpretation`
    - _Requerimientos: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

  - [ ]* 8.2 Escribir property test para invariante estructural de ResolutionSuggestion
    - **Property 9: Resolution Suggestion Structural Invariant**
    - **Valida: Requerimientos 5.1, 5.2, 5.3, 5.4, 5.5**

  - [ ]* 8.3 Escribir unit tests para ResolutionSuggestionGenerator
    - Test bug con stack trace → `errorInterpretation` no nulo
    - Test bug con pasos de reproducción → `reproductionStepsUsage` no nulo
    - Test bug con componente "AuthService" → `affectedLayers` incluye `'backend'`
    - Test bug con componente "LoginForm" → `affectedLayers` incluye `'frontend'`
    - Test bug sin información de error → `steps` tiene al menos 1 elemento
    - _Requerimientos: 5.1-5.6_

- [x] 9. Implementar ResolutionPlanGenerator
  - [x] 9.1 Crear `packages/backend/src/core/resolution-plan-generator.ts`
    - Implementar `generateResolutionPlan(projectKey, prioritized, failed)`:
      - Generar `id` único (UUID o timestamp-based)
      - Calcular `metrics`: totalAnalyzed, validCount, duplicateCount, expectedBehaviorCount, needsMoreInfoCount, validPercentage, totalEffortPoints, effortByCategory, distributionBySeverity
      - Generar `executiveSummary` con resumen de hallazgos
      - Incluir `generatedAt: new Date()`
    - Implementar `exportToMarkdown(plan)`:
      - Sección de resumen ejecutivo con métricas
      - Lista priorizada con: ID Jira, severity, priority score, effort, suggestion steps
      - Sección de bugs fallidos
      - Tabla de distribución por severity y categoría
    - Implementar `filterPlan(plan, filter)`:
      - Filtrar `prioritizedBugs` por severity o category
      - Recalcular `metrics` para el subconjunto filtrado
    - _Requerimientos: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 9.3_

  - [ ]* 9.2 Escribir property test para invariante estructural del ResolutionPlan
    - **Property 10: Resolution Plan Structural Invariant**
    - **Valida: Requerimientos 6.1, 6.2, 6.3, 6.6, 9.3**

  - [ ]* 9.3 Escribir property test para aritmética de esfuerzo total
    - **Property 6: Total Effort Arithmetic**
    - **Valida: Requerimientos 3.4, 4.5**

  - [ ]* 9.4 Escribir property test para completitud del Markdown exportado
    - **Property 11: Markdown Export Completeness**
    - **Valida: Requerimiento 6.4**

  - [ ]* 9.5 Escribir property test para corrección del filtro de plan
    - **Property 12: Plan Filter Correctness**
    - **Valida: Requerimiento 6.5**

  - [ ]* 9.6 Escribir unit tests para ResolutionPlanGenerator
    - Test plan con 0 bugs válidos → `validPercentage === 0`, `prioritizedBugs` vacío
    - Test `metrics.totalAnalyzed === prioritizedBugs.length + failedBugs.length`
    - Test `exportToMarkdown()` contiene el ID Jira de cada bug priorizado
    - Test `filterPlan()` por severity `Critical` → solo bugs Critical en resultado
    - Test `filterPlan()` recalcula `totalEffortPoints` correctamente
    - _Requerimientos: 6.1-6.6, 9.3_

- [ ] 10. Checkpoint - Verificar generadores de plan y sugerencias
  - Asegurarse de que todas las pruebas pasen, preguntar al usuario si surgen dudas.

- [x] 11. Implementar SupportAgent (orquestador)
  - [x] 11.1 Crear `packages/backend/src/core/support-agent.ts`
    - Implementar `analyzeBugs(request: AnalysisRequest): Promise<ResolutionPlan>`:
      - Recuperar credenciales desde `CredentialStore` usando `request.credentialKey`
      - Llamar `fetchBugIssues(credentials, projectKey, filters)`
      - Si no hay bugs → retornar plan vacío con mensaje informativo
      - Para cada bug: ejecutar `validateBug()`, `estimateEffort()`, `calculatePriorityScore()`, `generateSuggestion()` en try/catch
      - Si falla el análisis de un bug → añadir a `failedBugs` con razón del error, continuar con los demás
      - Llamar `prioritizeBugs()` con los bugs analizados exitosamente
      - Llamar `generateResolutionPlan()` con bugs priorizados y fallidos
      - Persistir plan en `WorkspaceStore` con clave `support-plan-{id}`
      - Retornar `ResolutionPlan`
    - Implementar `syncPlanToJira(planId, credentialKey): Promise<SyncReport>`:
      - Cargar plan desde `WorkspaceStore`
      - Construir `BugUpdatePayload[]` para cada `PrioritizedBug`
      - Llamar `updateBugWithAnalysis(credentials, payloads)`
      - Retornar `SyncReport`
    - _Requerimientos: 1.1, 1.4, 2.1-2.6, 3.1-3.6, 4.1-4.5, 5.1-5.6, 6.1-6.6, 7.1-7.5, 8.2, 8.3, 8.5, 9.1, 9.2, 9.3_

  - [ ]* 11.2 Escribir property test para resiliencia ante fallos parciales
    - **Property 14: Partial Failure Resilience**
    - **Valida: Requerimientos 7.4, 7.5, 9.2**

  - [ ]* 11.3 Escribir property test para notificación de errores Jira
    - **Property 15: Jira Error Notification**
    - **Valida: Requerimientos 9.1, 9.5**

  - [ ]* 11.4 Escribir property test para round-trip de persistencia
    - **Property 16: Resolution Plan Persistence Round Trip**
    - **Valida: Requerimiento 8.5**

  - [ ]* 11.5 Escribir unit tests para SupportAgent
    - Test proyecto sin bugs activos → plan con `totalAnalyzed === 0` y mensaje informativo
    - Test análisis donde 1 de 3 bugs falla → plan incluye 2 priorizados y 1 en `failedBugs`
    - Test `analyzeBugs()` con credentialKey inexistente → error descriptivo
    - Test `syncPlanToJira()` con planId inexistente → error `PLAN_NOT_FOUND`
    - Test `syncPlanToJira()` con fallo de Jira en 1 bug → `SyncReport.failedCount === 1`
    - _Requerimientos: 1.4, 7.4, 7.5, 8.5, 9.1, 9.2, 9.3, 9.5_

- [ ] 12. Implementar property tests consolidados del Support Agent
  - [ ]* 12.1 Crear `packages/backend/tests/property/support-agent.property.test.ts`
    - Definir arbitrarios: `bugIssueArbitrary()`, `validationResultArbitrary()`, `analyzedBugArbitrary()`, `syncReportArbitrary()`
    - Implementar Property 1: Bug Query Filter Correctness (100 runs)
    - Implementar Property 3: Validation Result Structural Invariant (100 runs)
    - Implementar Property 4: Effort Estimate Fibonacci Invariant (100 runs)
    - Implementar Property 5: Effort Estimation Monotonicity (100 runs)
    - Implementar Property 6: Total Effort Arithmetic (100 runs)
    - Implementar Property 7: Priority Score and Ordering (100 runs)
    - Implementar Property 8: Priority Category Completeness and Disjointness (100 runs)
    - Implementar Property 9: Resolution Suggestion Structural Invariant (100 runs)
    - Implementar Property 10: Resolution Plan Structural Invariant (100 runs)
    - Implementar Property 14: Partial Failure Resilience (100 runs)
    - Usar tag format: `Feature: support-agent, Property {N}: {property_text}`
    - _Requerimientos: 2.1-2.5, 3.1-3.6, 4.1-4.4, 5.1-5.5, 6.1-6.3, 6.6, 7.4, 7.5, 9.2, 9.3_

- [ ] 13. Checkpoint - Verificar SupportAgent y property tests
  - Asegurarse de que todas las pruebas pasen, preguntar al usuario si surgen dudas.

- [x] 14. Implementar endpoints REST del Support Agent
  - [x] 14.1 Añadir rutas `/api/support/*` en `packages/backend/src/api/routes.ts`
    - `POST /api/support/analyze` → body: `{ projectKey, credentialKey, filters? }` → llama `analyzeBugs()` → retorna `ResolutionPlan`
    - `GET /api/support/plans` → query: `credentialKey` → lista planes desde `WorkspaceStore` con prefijo `support-plan-`
    - `GET /api/support/plans/:planId` → carga plan desde `WorkspaceStore` → retorna `ResolutionPlan`
    - `POST /api/support/sync` → body: `{ planId, credentialKey }` → llama `syncPlanToJira()` → retorna `SyncReport`
    - `GET /api/support/plans/:planId/markdown` → carga plan, llama `exportToMarkdown()` → retorna `text/markdown`
    - Manejar errores: 400 para parámetros faltantes, 404 para plan/credencial no encontrado, 500 para errores internos
    - _Requerimientos: 8.1, 8.3, 8.5, 6.4_

  - [ ]* 14.2 Escribir unit tests para endpoints REST del Support Agent
    - Test `POST /api/support/analyze` con body válido → 200 con ResolutionPlan
    - Test `POST /api/support/analyze` sin `projectKey` → 400
    - Test `POST /api/support/sync` con planId inexistente → 404
    - Test `GET /api/support/plans/:planId/markdown` → Content-Type `text/markdown`
    - _Requerimientos: 8.1, 8.3, 8.5_

- [x] 15. Implementar SupportView (Frontend)
  - [x] 15.1 Crear `packages/frontend/src/components/SupportView.tsx`
    - Estado `idle`: formulario con input `projectKey` (requerido), selector de filtros opcionales (statuses, severities)
    - Estado `loading`: spinner con mensaje "Analizando bugs..."
    - Estado `plan`: mostrar métricas (totalAnalyzed, validCount, totalEffortPoints, validPercentage), lista de `prioritizedBugs` agrupada por categoría (critical/important/planned), para cada bug: ID Jira, severity badge, priority score, effort estimate, suggestion steps
    - Estado `syncing`: spinner con mensaje "Sincronizando con Jira..."
    - Estado `syncDone`: mostrar `SyncReport` con conteos de éxito/fallo y lista de keys actualizados
    - Botón "Analizar Bugs" en estado idle → llama `POST /api/support/analyze`
    - Botón "Aprobar y Sincronizar" en estado plan → llama `POST /api/support/sync`
    - Botón "Exportar Markdown" en estado plan → llama `GET /api/support/plans/:id/markdown` y descarga el archivo
    - Usar `jiraCredentialKey` del `useAppStore` para las llamadas a la API
    - _Requerimientos: 8.4, 6.4, 7.1-7.5_

  - [x] 15.2 Integrar SupportView en `packages/frontend/src/App.tsx`
    - Importar `SupportView`
    - Añadir `{ id: 'support', label: 'Support' }` al array `NAV_ITEMS`
    - Añadir `type View` el valor `'support'`
    - Añadir case `'support': return <SupportView />` en `renderView()`
    - _Requerimientos: 8.4_

  - [ ]* 15.3 Escribir tests de componente para SupportView
    - Test render inicial muestra formulario con input projectKey
    - Test click "Analizar Bugs" sin projectKey → no llama a la API
    - Test estado `plan` muestra métricas y lista de bugs priorizados
    - Test botón "Aprobar y Sincronizar" llama al endpoint correcto
    - _Requerimientos: 8.4_

- [ ] 16. Checkpoint final - Verificación completa del Support Agent
  - Ejecutar todas las pruebas (unit, property)
  - Verificar que los 5 endpoints responden correctamente
  - Verificar que SupportView renderiza sin errores
  - Asegurarse de que todas las pruebas pasen, preguntar al usuario si surgen dudas.

## Notas

- Las tareas marcadas con `*` son opcionales y pueden omitirse para un MVP más rápido
- Cada tarea referencia los requerimientos específicos para trazabilidad
- Los checkpoints aseguran validación incremental del progreso
- Las property tests validan las 16 propiedades de corrección del diseño
- Los unit tests validan ejemplos concretos y casos borde
- El SupportAgent reutiliza `CredentialStore` y `WorkspaceStore` existentes sin modificarlos
- Los planes se persisten con clave `support-plan-{id}` en el WorkspaceStore
- El JiraConnector existente se extiende (no se reemplaza) con las nuevas funciones
