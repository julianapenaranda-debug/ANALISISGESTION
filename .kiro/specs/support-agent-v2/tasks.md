# Plan de Implementación: Support Agent V2

## Resumen

Implementar el flujo Datadog-first del Support Agent V2: función orquestadora backend (`analyzeServicesV2`), endpoint `POST /api/support-v2/analyze`, y reescritura completa de `SupportView.tsx`. Se reutilizan `DatadogConnector`, `datadog-findings-analyzer`, `llm-client` y los modelos existentes.

## Tareas

- [x] 1. Crear función orquestadora `analyzeServicesV2` en el backend
  - [x] 1.1 Crear archivo `packages/backend/src/core/support-agent-v2.ts` con interfaces `AnalyzeServicesRequest`, `AnalysisMetrics`, `AnalyzeServicesResponse`
    - Definir los tipos nuevos según el diseño
    - Exportar la función `analyzeServicesV2(credentials, request)`
    - _Requerimientos: 6.4_

  - [x] 1.2 Implementar lógica de `analyzeServicesV2`
    - Para cada servicio, llamar a `fetchDatadogFindings(credentials, service)`
    - Deduplicar hallazgos por `id`
    - Pasar hallazgos a `analyzeDatadogFindings(findings)`
    - Ordenar resultados por criticidad (critical > high > medium > low) usando `CRITICALITY_ORDER`
    - Calcular métricas agregadas (totalFindings, distributionByType, distributionByCriticality)
    - _Requerimientos: 3.1, 3.2, 3.3, 3.4, 3.5, 6.4_

  - [ ]* 1.3 Escribir test de propiedad: ordenamiento por criticidad descendente
    - **Propiedad 4: Ordenamiento por criticidad descendente**
    - Generar listas aleatorias de `AnalyzedDatadogFinding` con criticidades aleatorias
    - Aplicar la función de ordenamiento y verificar que para todo par consecutivo `findings[i]`, `findings[i+1]`, el índice de criticidad de `findings[i]` ≤ `findings[i+1]`
    - **Valida: Requerimientos 3.4**

  - [ ]* 1.4 Escribir test de propiedad: consistencia de métricas con hallazgos
    - **Propiedad 5: Consistencia de métricas con hallazgos**
    - Generar listas aleatorias de `AnalyzedDatadogFinding`
    - Verificar que `metrics.totalFindings === findings.length`, suma de `distributionByType` === total, suma de `distributionByCriticality` === total
    - **Valida: Requerimientos 4.3, 6.4**

  - [ ]* 1.5 Escribir test de propiedad: invariante de hallazgo analizado completo
    - **Propiedad 3: Invariante de hallazgo analizado completo**
    - Generar `DatadogFinding` aleatorios, pasar por `heuristicAnalysis`
    - Verificar que cada resultado tiene `suggestedCriticality` válido, `resolutionSuggestion` no vacío, `resolutionSteps` con al menos 1 elemento, y `label === "Sugerencia del Agente IA Support"`
    - **Valida: Requerimientos 3.2, 3.5**

  - [ ]* 1.6 Escribir tests unitarios para `analyzeServicesV2`
    - Test: retorna findings vacíos cuando no hay hallazgos
    - Test: deduplica findings que aparecen en múltiples servicios
    - Test: ordena por criticidad correctamente
    - Test: calcula métricas correctamente
    - _Requerimientos: 3.1, 3.4, 6.4_

- [ ] 2. Crear endpoint `POST /api/support-v2/analyze` en routes.ts
  - [x] 2.1 Agregar el endpoint en `packages/backend/src/api/routes.ts`
    - Importar `analyzeServicesV2` desde `support-agent-v2.ts`
    - Validar que `services` sea un array no vacío → retornar 400 si no
    - Obtener credenciales de Datadog desde `CredentialStore.retrieve('datadog-main')` → retornar 404 si no existen
    - Llamar a `analyzeServicesV2(credentials, { services })` y retornar resultado JSON
    - Manejar errores de red (502), permisos (403) y errores genéricos (500)
    - _Requerimientos: 6.1, 6.2, 6.3, 6.4_

  - [ ]* 2.2 Escribir test de propiedad: validación de input rechaza servicios vacíos
    - **Propiedad 6: Validación de input rechaza servicios vacíos**
    - Generar variantes de inputs inválidos (undefined, null, [], string, number)
    - Verificar que todos producen status 400
    - **Valida: Requerimientos 6.2**

  - [ ]* 2.3 Escribir tests unitarios para el endpoint
    - Test: retorna 400 con body vacío
    - Test: retorna 400 con `services: []`
    - Test: retorna 404 sin credenciales Datadog
    - Test: retorna 200 con estructura correcta
    - _Requerimientos: 6.1, 6.2, 6.3, 6.4_

- [x] 3. Checkpoint — Verificar backend
  - Asegurar que todos los tests pasan, preguntar al usuario si surgen dudas.

- [ ] 4. Reescribir `SupportView.tsx` con flujo Datadog-first
  - [x] 4.1 Implementar estructura base y estados del componente
    - Reemplazar el contenido de `packages/frontend/src/components/SupportView.tsx`
    - Definir tipo `ViewState = 'loading-services' | 'select-services' | 'analyzing' | 'results' | 'error'`
    - Implementar estados: `services`, `selectedServices` (Set), `searchFilter`, `findings`, `metrics`, `error`, `createdIssues`
    - Verificar estado de conexión de Datadog al montar: si `disconnected`, mostrar mensaje con enlace a Conexiones
    - Si `connected`, cargar servicios vía `GET /api/support/datadog/services`
    - Mostrar "Cargando servicios..." durante la carga
    - _Requerimientos: 1.1, 2.1, 2.2, 8.1_

  - [x] 4.2 Implementar subcomponente `ServiceSelector`
    - Lista de servicios con checkboxes
    - Buscador predictivo que filtra en tiempo real (case-insensitive)
    - Botones "Seleccionar todos" (marca visibles filtrados) y "Deseleccionar todos"
    - Contador de servicios seleccionados junto al botón "Analizar"
    - Botón "Analizar" deshabilitado si no hay servicios seleccionados
    - Mostrar "No se encontraron servicios en Datadog" si la lista está vacía
    - Mostrar mensaje de error descriptivo si la consulta de servicios falla
    - _Requerimientos: 1.2, 1.3, 1.4, 1.5, 7.1, 7.2, 7.3, 7.4_

  - [x] 4.3 Implementar flujo de análisis y presentación de resultados
    - Click "Analizar" → `POST /api/support-v2/analyze` con `{ services: [...selectedServices] }`
    - Mostrar "Analizando hallazgos de Datadog..." durante el análisis
    - Presentar hallazgos agrupados y ordenados por criticidad (critical, high, medium, low)
    - Cada tarjeta muestra: título, tipo (log/monitor/incidente), servicio, criticidad con indicador visual (🔴🟠🟡🟢), causa raíz y sugerencia
    - Panel de métricas resumen: total hallazgos, distribución por tipo y por criticidad
    - Botón "Ver detalle" expande tarjeta con pasos de resolución, endpoint afectado y etiqueta "Sugerencia del Agente IA Support"
    - Mostrar "No se encontraron hallazgos para los servicios seleccionados" si no hay findings
    - Botón "Nuevo análisis" para regresar a selección de servicios
    - _Requerimientos: 3.6, 4.1, 4.2, 4.3, 4.4, 8.2, 8.3_

  - [x] 4.4 Implementar creación opcional de issues en Jira
    - Si Jira está conectado (`connections.jira === 'connected'`), mostrar botón "Crear Issue en Jira" en cada tarjeta
    - Si Jira está desconectado, ocultar el botón en todas las tarjetas
    - Click en "Crear Issue" abre modal con campos editables: título, descripción, severidad, componente (pre-rellenados)
    - Confirmar creación llama a `POST /api/support/datadog/create-issue` (endpoint existente)
    - Mostrar confirmación con clave del issue creado
    - Si falla, mostrar error en modal sin cerrarlo
    - Tras crear issue, mostrar indicador visual en tarjeta con clave y deshabilitar botón para ese hallazgo
    - _Requerimientos: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

  - [ ]* 4.5 Escribir test de propiedad: filtrado predictivo retorna subconjunto correcto
    - **Propiedad 1: Filtrado predictivo retorna subconjunto correcto**
    - Generar listas aleatorias de strings (servicios) y strings de búsqueda
    - Verificar que el resultado del filtro es subconjunto de la lista original y contiene exactamente los matches case-insensitive
    - **Valida: Requerimientos 1.2**

  - [ ]* 4.6 Escribir test de propiedad: seleccionar/deseleccionar todos son inversos
    - **Propiedad 7: Seleccionar todos y deseleccionar todos son inversos**
    - Generar listas aleatorias de servicios y filtros
    - Verificar que selectAll → todos los visibles seleccionados, deselectAll → set vacío
    - **Valida: Requerimientos 7.1, 7.2**

  - [ ]* 4.7 Escribir test de propiedad: contador de selección y estado del botón Analizar
    - **Propiedad 8: Contador de selección y estado del botón Analizar**
    - Generar sets aleatorios de servicios seleccionados
    - Verificar que contador === `selectedServices.size` y botón deshabilitado si y solo si `size === 0`
    - **Valida: Requerimientos 7.3, 7.4**

  - [ ]* 4.8 Escribir tests unitarios para `SupportView.tsx`
    - Test: muestra mensaje de conexión requerida cuando Datadog está desconectado
    - Test: muestra "Cargando servicios..." durante la carga
    - Test: muestra "No se encontraron servicios" con lista vacía
    - Test: muestra botón "Crear Issue" solo cuando Jira está conectado
    - Test: modal de creación muestra error sin cerrarse ante fallo
    - _Requerimientos: 2.1, 5.1, 5.2, 5.5, 8.1_

- [x] 5. Checkpoint — Verificar integración completa
  - Asegurar que todos los tests pasan, preguntar al usuario si surgen dudas.

## Notas

- Las tareas marcadas con `*` son opcionales y pueden omitirse para un MVP más rápido
- Cada tarea referencia requerimientos específicos para trazabilidad
- Los checkpoints aseguran validación incremental
- Los tests de propiedad validan propiedades universales de correctitud
- Los tests unitarios validan ejemplos específicos y edge cases
- Se reutilizan endpoints existentes: `GET /api/support/datadog/services` y `POST /api/support/datadog/create-issue`
