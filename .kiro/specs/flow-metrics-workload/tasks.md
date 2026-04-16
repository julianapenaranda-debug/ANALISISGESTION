# Implementation Plan: Flow Metrics Workload

## Overview

Implementación incremental de la vista Flow Metrics: primero los modelos e interfaces, luego las funciones puras de cálculo con property tests, después el orquestador y endpoint API, y finalmente el componente React con integración en la navegación.

## Tasks

- [x] 1. Crear modelos e interfaces del módulo Flow Metrics
  - [x] 1.1 Crear `packages/backend/src/core/flow-metrics-models.ts` con todas las interfaces y constantes
    - Definir `FlowMetricsRequest`, `FlowMetricsFilters`, `FlowMetricsReport`, `FlowMetricsSummary`
    - Definir `ThroughputByType`, `DeveloperWIP`, `TypologyBreakdown`, `Bottleneck`, `AgingIssue`, `FlowRecommendation`
    - Exportar constantes: `ACTIVE_STATUSES`, `PASSIVE_STATUSES`, `DONE_STATUSES`, `VALUE_WORK_TYPES`, `SUPPORT_WORK_TYPES`
    - Reutilizar `JiraStory` y `StatusChange` de `workload-models.ts` (import, no duplicar)
    - _Requirements: 1.1, 1.2, 2.1, 3.1, 4.1, 5.1, 5.2, 6.1, 7.1, 8.1, 9.1, 10.1_

- [x] 2. Implementar funciones puras del calculador de Flow Metrics
  - [x] 2.1 Crear `packages/backend/src/core/flow-metrics-calculator.ts` con funciones de cálculo de tiempos
    - Implementar `buildFlowMetricsJql(projectKey, filters?)` — JQL sin filtro de issuetype
    - Implementar `calculateLeadTime(issue)` — días desde created hasta resolución
    - Implementar `calculateCycleTime(issue)` — días desde primera transición Active hasta resolución
    - Implementar `calculateTouchTime(issue)` — suma de días en Active_Statuses
    - Implementar `calculateWaitTime(issue)` — suma de días en Passive_Statuses
    - Implementar `calculateFlowEfficiency(touchTime, waitTime)` — porcentaje o null
    - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 5.1, 5.2, 5.3, 5.6, 10.6_

  - [x] 2.2 Agregar funciones de agregación y clasificación al calculador
    - Implementar `calculateThroughput(issues, filters?)` — conteo de completados por tipo
    - Implementar `calculateWIPByDeveloper(issues)` — issues en Active_Statuses por assignee
    - Implementar `classifyWorkType(issueType)` — retorna 'value' o 'support'
    - Implementar `calculateTypology(issues)` — TypologyBreakdown con conteos y porcentajes
    - _Requirements: 3.1, 3.2, 3.4, 4.1, 4.3, 6.1, 6.2_

  - [x] 2.3 Agregar funciones de detección y recomendaciones al calculador
    - Implementar `detectBottlenecks(completedIssues)` — estados > 40% del cycle time
    - Implementar `detectAgingIssues(activeIssues, completedIssues)` — issues sobre promedio histórico
    - Implementar `generateRecommendations(report)` — recomendaciones por umbrales
    - Implementar `buildFlowMetricsReport(issues, projectKey, filters)` — orquesta todos los cálculos
    - _Requirements: 7.1, 7.2, 8.1, 8.2, 9.1, 9.2, 9.3, 10.2_

  - [ ]* 2.4 Write property test: JQL excludes issuetype filter
    - **Property 14: JQL excludes issuetype filter**
    - **Validates: Requirements 10.6**

  - [ ]* 2.5 Write property test: Lead Time calculation correctness
    - **Property 1: Lead Time calculation correctness**
    - **Validates: Requirements 1.1, 1.2**

  - [ ]* 2.6 Write property test: Incomplete issues excluded from time metrics
    - **Property 2: Incomplete issues excluded from time metrics**
    - **Validates: Requirements 1.3, 2.2**

  - [ ]* 2.7 Write property test: Cycle Time calculation correctness
    - **Property 3: Cycle Time calculation correctness**
    - **Validates: Requirements 2.1**

  - [ ]* 2.8 Write property test: Flow Efficiency formula
    - **Property 9: Flow Efficiency formula**
    - **Validates: Requirements 5.3, 5.6**

  - [ ]* 2.9 Write property test: Touch Time and Wait Time from changelog
    - **Property 8: Touch Time and Wait Time from changelog**
    - **Validates: Requirements 5.1, 5.2**

- [x] 3. Checkpoint - Verificar funciones de cálculo de tiempos
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Implementar funciones de agregación y property tests
  - [ ]* 4.1 Write property test: Throughput partition by issue type
    - **Property 5: Throughput partition by issue type**
    - **Validates: Requirements 3.1, 3.2**

  - [ ]* 4.2 Write property test: Throughput date range filtering
    - **Property 6: Throughput date range filtering**
    - **Validates: Requirements 3.4**

  - [ ]* 4.3 Write property test: WIP counting and summation invariant
    - **Property 7: WIP counting and summation invariant**
    - **Validates: Requirements 4.1, 4.3**

  - [ ]* 4.4 Write property test: Work type classification and typology partition
    - **Property 10: Work type classification and typology partition**
    - **Validates: Requirements 6.1, 6.2**

  - [ ]* 4.5 Write property test: Bottleneck detection threshold
    - **Property 11: Bottleneck detection threshold**
    - **Validates: Requirements 7.1, 7.2**

  - [ ]* 4.6 Write property test: Aging issue detection
    - **Property 12: Aging issue detection**
    - **Validates: Requirements 8.1, 8.2**

  - [ ]* 4.7 Write property test: Recommendation generation by thresholds
    - **Property 13: Recommendation generation by thresholds**
    - **Validates: Requirements 9.1, 9.2, 9.3**

  - [ ]* 4.8 Write property test: Averaging invariant
    - **Property 4: Averaging invariant**
    - **Validates: Requirements 1.4, 2.3, 5.4**

- [x] 5. Implementar orquestador y endpoint API
  - [x] 5.1 Crear `packages/backend/src/core/flow-metrics-analyzer.ts`
    - Implementar `analyzeFlowMetrics(request)` — recupera credenciales, construye JQL, llama fetchStoryIssues, delega a buildFlowMetricsReport
    - Manejar caso de proyecto vacío (retornar reporte con valores en 0/null)
    - Seguir patrón de `workload-analyzer.ts` para manejo de errores (CREDENTIALS_NOT_FOUND, etc.)
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_

  - [x] 5.2 Agregar endpoint `POST /api/flow-metrics/analyze` en `packages/backend/src/api/routes.ts`
    - Agregar schema de validación zod para `FlowMetricsRequest`
    - Implementar handler con manejo de errores consistente (404, 401, 403, 502, 400, 500)
    - Importar `analyzeFlowMetrics` del analyzer
    - _Requirements: 10.1, 10.3, 10.4_

  - [ ]* 5.3 Write unit tests for flow-metrics-calculator
    - Crear `packages/backend/tests/unit/core/flow-metrics-calculator.test.ts`
    - Tests con ejemplos concretos para cada función del calculator
    - Edge cases: issues sin changelog, changelogs vacíos, issues sin assignee, ambos Touch/Wait Time en 0
    - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 3.1, 4.1, 5.1, 5.3, 5.6, 6.1, 7.1, 8.1, 9.1_

- [x] 6. Checkpoint - Verificar backend completo
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Implementar vista frontend FlowMetricsView
  - [x] 7.1 Agregar `'flow-metrics'` al tipo `View` en `packages/frontend/src/store/useAppStore.ts`
    - Agregar `'flow-metrics'` a la unión de tipos `View`
    - _Requirements: 11.1_

  - [x] 7.2 Crear `packages/frontend/src/components/FlowMetricsView.tsx`
    - Formulario de filtros: proyecto, sprint opcional, rango de fechas opcional (mismo patrón que WorkloadView)
    - Tarjetas resumen: Lead Time, Cycle Time, Throughput, WIP, Flow Efficiency
    - Tabla de Throughput por tipo de issue
    - Gráfico visual de tipología (Value vs Support) con barras horizontales CSS
    - Tabla de WIP por desarrollador
    - Sección de cuellos de botella con mensajes descriptivos
    - Lista de aging issues
    - Sección de recomendaciones (o mensaje "sin observaciones" si vacía)
    - Spinner de carga, mensajes de error con opción de reintentar, estado vacío
    - Todos los textos en español, diseño visual Seguros Bolívar (#009056, Roboto)
    - Llamar a `POST /api/flow-metrics/analyze` vía apiClient
    - _Requirements: 1.5, 2.4, 3.3, 4.2, 4.4, 5.5, 6.3, 6.4, 7.3, 7.4, 8.3, 9.4, 9.5, 11.2, 11.3, 11.4, 11.5_

  - [x] 7.3 Integrar FlowMetricsView en `packages/frontend/src/App.tsx`
    - Agregar nav item `{ id: 'flow-metrics', label: 'Flow Metrics' }` a `NAV_ITEMS`
    - Agregar `case 'flow-metrics': return <FlowMetricsView />` en `renderView()`
    - Importar `FlowMetricsView`
    - _Requirements: 11.1_

- [x] 8. Final checkpoint - Verificar integración completa
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- All property tests go in `packages/backend/tests/property/flow-metrics-calculator.property.test.ts`
- All unit tests go in `packages/backend/tests/unit/core/flow-metrics-calculator.test.ts`
- The design uses TypeScript throughout — no language selection needed
