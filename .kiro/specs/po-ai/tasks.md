# Plan de Implementación: PO AI

## Descripción General

Este plan descompone la implementación del sistema PO AI en tareas accionables. El sistema automatiza la generación de historias de usuario, análisis de diseños Figma, sincronización con Jira, y análisis de métricas de proyectos.

La arquitectura consta de 3 capas:
- **Core Application Layer**: Story Generator, Figma Analyzer, INVEST Validator, Epic Assembler
- **Integration Layer**: Jira Connector, Project Analyzer, Figma Client
- **Storage Layer**: Credential Store, Workspace Store, Change History

Stack tecnológico: TypeScript/Node.js, Jest + fast-check, Jira REST API v3, Figma REST API, AES-256-GCM.

## Tareas

- [x] 1. Configuración inicial del proyecto
  - [x] 1.1 Configurar estructura monorepo
    - Crear estructura: packages/frontend, packages/backend, packages/shared
    - Configurar workspace con npm/yarn/pnpm
    - _Requerimientos: Todos (setup base)_
  
  - [x] 1.2 Configurar backend
    - Crear estructura de directorios (src/core, src/integration, src/storage, src/api, tests)
    - Configurar TypeScript con tsconfig.json
    - Configurar Jest para testing
    - Instalar dependencias: express, fast-check, zod, crypto, dotenv
    - _Requerimientos: Todos (setup backend)_
  
  - [x] 1.3 Configurar frontend
    - Crear proyecto React con Vite
    - Configurar TypeScript
    - Instalar dependencias: react-query, tailwindcss, react-hook-form, zustand
    - Configurar React Testing Library
    - _Requerimientos: Todos (setup frontend)_
  
  - [x] 1.4 Crear tipos compartidos
    - Crear interfaces y tipos base en packages/shared/src/types
    - Exportar tipos para uso en frontend y backend
    - _Requerimientos: Todos (tipos compartidos)_

- [x] 2. Implementar modelos de datos y tipos
  - [x] 2.1 Crear modelos de dominio core
    - Implementar interfaces Story, AcceptanceCriterion, Epic, Ambiguity
    - Implementar interfaces InvestScore, ValidationResult, Dependency
    - Implementar interfaces ProjectContext, StoryMetadata, EpicMetadata
    - _Requerimientos: 1.1, 1.3, 4.1, 8.1-8.6, 12.6_
  
  - [x] 2.2 Crear modelos de integración
    - Implementar interfaces JiraCredentials, JiraIssue, JiraIssuePayload
    - Implementar interfaces FigmaFile, FigmaNode, FigmaAnalysisResult
    - Implementar interfaces para exportación (JiraExport, CsvRow)
    - _Requerimientos: 5.1-5.6, 2.1-2.5, 9.1-9.5_
  
  - [x] 2.3 Crear modelos de métricas
    - Implementar interfaces ProjectMetrics, VelocityData, CycleTimeData
    - Implementar interfaces StatusDistribution, Bottleneck, BlockedIssue
    - _Requerimientos: 7.1-7.6_

- [x] 3. Implementar Credential Store (capa de almacenamiento)
  - [x] 3.1 Crear módulo de encriptación
    - Implementar funciones de encriptación/desencriptación con AES-256-GCM
    - Implementar derivación de clave maestra
    - _Requerimientos: 6.2_
  
  - [ ]* 3.2 Escribir property test para encriptación
    - **Property 16: Credential Encryption**
    - **Valida: Requerimiento 6.2**
  
  - [x] 3.3 Implementar CredentialStore
    - Implementar métodos store(), retrieve(), update(), delete()
    - Integrar con keychain del OS (macOS/Windows/Linux)
    - _Requerimientos: 6.2, 6.5_
  
  - [ ]* 3.4 Escribir unit tests para CredentialStore
    - Test almacenamiento y recuperación
    - Test actualización de credenciales
    - Test manejo de credenciales inexistentes
    - _Requerimientos: 6.2, 6.5_

- [x] 4. Implementar Workspace Store y Change History
  - [x] 4.1 Implementar WorkspaceStore
    - Implementar saveWorkspace(), loadWorkspace(), listWorkspaces()
    - Crear sistema de persistencia en JSON
    - Implementar índice de workspaces
    - _Requerimientos: 12.1-12.4_
  
  - [x] 4.2 Implementar ChangeHistory
    - Implementar recordChange(), getHistory(), revert()
    - Crear estructura de almacenamiento de cambios
    - _Requerimientos: 12.6_
  
  - [ ]* 4.3 Escribir property test para Change History
    - **Property 34: Change History Recording**
    - **Valida: Requerimiento 12.6**
  
  - [ ]* 4.4 Escribir unit tests para WorkspaceStore
    - Test guardado y carga de workspace
    - Test listado de workspaces
    - Test manejo de workspace inexistente
    - _Requerimientos: 12.1-12.4_

- [x] 5. Checkpoint - Verificar capa de almacenamiento
  - Asegurarse de que todas las pruebas pasen, preguntar al usuario si surgen dudas.

- [x] 6. Implementar INVEST Validator
  - [x] 6.1 Crear validadores para cada criterio INVEST
    - Implementar validación de Independencia (detectar dependencias explícitas)
    - Implementar validación de Negociabilidad (detectar implementación específica)
    - Implementar validación de Valor (verificar presencia de valor de negocio)
    - Implementar validación de Estimabilidad (detectar términos vagos)
    - Implementar validación de Tamaño (evaluar complejidad por criterios/componentes)
    - Implementar validación de Testeabilidad (verificar criterios medibles)
    - _Requerimientos: 8.1-8.6_
  
  - [x] 6.2 Implementar cálculo de InvestScore
    - Calcular scores individuales (0-1) para cada criterio
    - Calcular score general
    - _Requerimientos: 8.1-8.6_
  
  - [x] 6.3 Implementar generación de sugerencias
    - Crear sugerencias específicas para cada criterio fallido
    - _Requerimientos: 8.7_
  
  - [ ]* 6.4 Escribir property test para INVEST Validator
    - **Property 2: INVEST Validation**
    - **Valida: Requerimientos 1.2, 8.1-8.6**
  
  - [ ]* 6.5 Escribir property test para sugerencias
    - **Property 24: INVEST Improvement Suggestions**
    - **Valida: Requerimiento 8.7**
  
  - [ ]* 6.6 Escribir unit tests para cada criterio INVEST
    - Test historias que pasan cada criterio
    - Test historias que fallan cada criterio
    - Test generación de sugerencias específicas
    - _Requerimientos: 8.1-8.7_

- [ ] 7. Implementar Story Generator (core)
  - [x] 7.1 Crear módulo de detección de ambigüedades
    - Implementar detectAmbiguities() para términos vagos
    - Detectar falta de rol de usuario
    - Detectar falta de valor de negocio
    - Generar preguntas de aclaración específicas
    - _Requerimientos: 1.5, 11.1-11.4_
  
  - [ ]* 7.2 Escribir property test para detección de ambigüedades
    - **Property 3: Ambiguity Detection**
    - **Valida: Requerimientos 1.5, 11.1-11.4**
  
  - [x] 7.3 Implementar generación de historias con LLM
    - Crear prompts estructurados para formato "Como [rol], quiero [acción], para que [valor]"
    - Implementar generateStories() con integración LLM API
    - Extraer rol, acción y valor de la respuesta LLM
    - _Requerimientos: 1.1, 1.4_
  
  - [x] 7.4 Implementar generación de criterios de aceptación
    - Generar mínimo 3 criterios en formato Gherkin (Dado que/Cuando/Entonces)
    - Incluir escenarios positivos, negativos y de error
    - Evitar términos vagos en criterios
    - _Requerimientos: 1.3, 3.1-3.5_
  
  - [ ]* 7.5 Escribir property test para formato de historias
    - **Property 1: Story Format Compliance**
    - **Valida: Requerimientos 1.1, 1.3, 3.1, 3.2**
  
  - [ ]* 7.6 Escribir property test para exclusión de términos vagos
    - **Property 7: Vague Terms Exclusion**
    - **Valida: Requerimiento 3.4**
  
  - [ ]* 7.7 Escribir property test para criterios de error
    - **Property 8: Error Criteria Inclusion**
    - **Valida: Requerimiento 3.5**
  
  - [x] 7.8 Implementar sugerencia de componentes
    - Sugerir componentes técnicos basados en contenido de historia
    - Mantener lista de componentes comunes por proyecto
    - _Requerimientos: 10.1, 10.4_
  
  - [ ]* 7.9 Escribir property test para sugerencia de componentes
    - **Property 28: Component Suggestion**
    - **Valida: Requerimiento 10.1**
  
  - [x] 7.10 Implementar refineStory()
    - Permitir edición de título, descripción, criterios
    - Re-validar INVEST después de cambios
    - _Requerimientos: 12.1-12.3, 12.5_
  
  - [ ]* 7.11 Escribir property test para re-validación
    - **Property 33: Re-validation After Changes**
    - **Valida: Requerimiento 12.5**
  
  - [ ]* 7.12 Escribir unit tests para Story Generator
    - Test generación con descripciones específicas
    - Test detección de términos vagos conocidos
    - Test manejo de descripciones vacías
    - Test refinamiento de historias
    - _Requerimientos: 1.1-1.5, 3.1-3.5, 10.1, 11.1-11.5, 12.1-12.3_

- [x] 8. Checkpoint - Verificar Story Generator
  - Asegurarse de que todas las pruebas pasen, preguntar al usuario si surgen dudas.

- [x] 9. Implementar Figma Analyzer
  - [x] 9.1 Configurar integración MCP con Figma
    - Configurar servidor MCP de Figma en mcp.json
    - Implementar wrapper para herramientas MCP de Figma
    - _Requerimientos: 2.1_
  
  - [x] 9.2 Implementar extracción de componentes
    - Extraer componentes interactivos (botones, formularios, inputs)
    - Identificar propiedades y tipos de componentes
    - _Requerimientos: 2.1, 2.2_
  
  - [x] 9.3 Implementar identificación de flujos
    - Parsear prototipos de Figma
    - Identificar interacciones y navegación
    - Construir secuencias de flujo
    - _Requerimientos: 2.2, 2.4, 2.5_
  
  - [x] 9.4 Implementar mapeo de componentes a historias
    - Mapear cada componente UI a historia correspondiente
    - Preservar secuencia lógica de navegación
    - _Requerimientos: 2.3, 2.5_
  
  - [ ]* 9.5 Escribir property test para extracción de componentes
    - **Property 4: Figma Component Extraction**
    - **Valida: Requerimientos 2.1-2.3**
  
  - [ ]* 9.6 Escribir property test para generación de flujos
    - **Property 5: Figma Flow Generation**
    - **Valida: Requerimiento 2.4**
  
  - [ ]* 9.7 Escribir property test para preservación de secuencia
    - **Property 6: Navigation Sequence Preservation**
    - **Valida: Requerimiento 2.5**
  
  - [ ]* 9.8 Escribir unit tests para Figma Analyzer
    - Test parsing de estructuras Figma conocidas
    - Test manejo de diseños sin prototipos
    - Test manejo de enlaces inválidos
    - _Requerimientos: 2.1-2.5_

- [x] 10. Implementar Epic Assembler
  - [x] 10.1 Implementar agrupación de historias
    - Agrupar historias por similitud semántica
    - Agrupar por componentes compartidos
    - Asignar títulos descriptivos a épicas
    - _Requerimientos: 4.1, 4.2_
  
  - [x] 10.2 Implementar identificación de dependencias
    - Analizar criterios de aceptación para detectar referencias
    - Clasificar dependencias (blocks, relates, requires)
    - _Requerimientos: 4.4_
  
  - [x] 10.3 Implementar descomposición de épicas grandes
    - Detectar épicas con más de 10 historias
    - Descomponer en múltiples épicas con valor incremental
    - _Requerimientos: 4.5_
  
  - [x] 10.4 Implementar reorganización de historias
    - Permitir mover historias entre épicas
    - Actualizar referencias de epicId
    - _Requerimientos: 12.4_
  
  - [ ]* 10.5 Escribir property test para agrupación
    - **Property 9: Epic Grouping**
    - **Valida: Requerimiento 4.1**
  
  - [ ]* 10.6 Escribir property test para identificación de dependencias
    - **Property 10: Dependency Identification**
    - **Valida: Requerimiento 4.4**
  
  - [ ]* 10.7 Escribir property test para descomposición
    - **Property 11: Epic Decomposition**
    - **Valida: Requerimiento 4.5**
  
  - [ ]* 10.8 Escribir property test para reorganización
    - **Property 31: Story Reorganization**
    - **Valida: Requerimiento 12.4**
  
  - [ ]* 10.9 Escribir unit tests para Epic Assembler
    - Test agrupación de 2-3 historias relacionadas
    - Test identificación de dependencia explícita
    - Test descomposición de épica con 15 historias
    - _Requerimientos: 4.1-4.5, 12.4_

- [x] 11. Checkpoint - Verificar componentes core
  - Asegurarse de que todas las pruebas pasen, preguntar al usuario si surgen dudas.

- [x] 12. Implementar Jira Connector
  - [x] 12.1 Configurar integración MCP con Jira
    - Configurar servidor MCP de Jira en mcp.json
    - Implementar wrapper para herramientas MCP de Jira
    - _Requerimientos: 6.1_
  
  - [x] 12.2 Implementar validación de credenciales y permisos
    - Validar credenciales con endpoint /myself
    - Validar permisos de escritura en proyecto
    - Generar mensajes de error descriptivos
    - _Requerimientos: 6.3, 6.4, 5.6_
  
  - [ ]* 12.3 Escribir property test para validación de permisos
    - **Property 17: Permission Validation**
    - **Valida: Requerimiento 6.4**
  
  - [x] 12.4 Implementar creación de issues
    - Convertir Story/Epic a JiraIssuePayload
    - Implementar createIssues() con bulk creation
    - Preservar formato Markdown en descripciones
    - Asignar project key e issue type correctos
    - _Requerimientos: 5.1-5.4_
  
  - [ ]* 12.5 Escribir property test para creación de tickets
    - **Property 12: Jira Ticket Creation**
    - **Valida: Requerimientos 5.1, 5.3, 5.4**
  
  - [ ]* 12.6 Escribir property test para preservación de Markdown
    - **Property 13: Markdown Preservation**
    - **Valida: Requerimiento 5.2**
  
  - [x] 12.7 Implementar vinculación de épicas e historias
    - Crear épicas primero
    - Vincular historias con epic link field
    - _Requerimientos: 5.5_
  
  - [ ]* 12.8 Escribir property test para vinculación
    - **Property 14: Epic-Story Linking**
    - **Valida: Requerimiento 5.5**
  
  - [x] 12.9 Implementar sincronización de componentes
    - Incluir componentes en payload de Jira
    - Validar existencia de componentes en proyecto
    - Notificar si componente no existe
    - _Requerimientos: 10.3, 10.5_
  
  - [ ]* 12.10 Escribir property test para sincronización de componentes
    - **Property 29: Component Synchronization**
    - **Valida: Requerimiento 10.3**
  
  - [x] 12.11 Implementar manejo de errores
    - Manejar errores de autenticación (401)
    - Manejar errores de permisos (403)
    - Manejar errores de red
    - Manejar componentes inexistentes
    - Proporcionar mensajes descriptivos con códigos de error
    - _Requerimientos: 5.6, 6.3_
  
  - [ ]* 12.12 Escribir property test para mensajes de error
    - **Property 15: Descriptive Error Messages**
    - **Valida: Requerimiento 5.6**
  
  - [ ]* 12.13 Escribir unit tests para Jira Connector
    - Test autenticación exitosa y fallida
    - Test creación de ticket individual
    - Test manejo de componentes inexistentes
    - Test preservación de Markdown específico
    - _Requerimientos: 5.1-5.6, 6.1-6.4, 10.3_

- [x] 13. Implementar funcionalidad de exportación
  - [x] 13.1 Implementar exportación a JSON
    - Convertir historias y épicas a formato Jira API
    - Validar estructura contra schema de Jira
    - _Requerimientos: 9.1, 9.4_
  
  - [ ]* 13.2 Escribir property test para exportación JSON
    - **Property 25: JSON Export Validation**
    - **Valida: Requerimientos 9.1, 9.4**
  
  - [x] 13.3 Implementar exportación a CSV
    - Incluir columnas requeridas (Issue Type, Summary, Description, etc.)
    - Formatear criterios de aceptación para CSV
    - _Requerimientos: 9.2, 9.3_
  
  - [ ]* 13.4 Escribir property test para exportación CSV
    - **Property 26: CSV Export Format**
    - **Valida: Requerimientos 9.2, 9.3**
  
  - [x] 13.5 Implementar selección de historias para exportación
    - Permitir exportar subset de historias
    - _Requerimientos: 9.5_
  
  - [ ]* 13.6 Escribir property test para exportación selectiva
    - **Property 27: Selective Export**
    - **Valida: Requerimiento 9.5**
  
  - [ ]* 13.7 Escribir unit tests para exportación
    - Test exportación JSON con historias específicas
    - Test exportación CSV con épicas
    - Test selección de subset
    - _Requerimientos: 9.1-9.5_

- [x] 14. Implementar Project Analyzer
  - [x] 14.1 Implementar extracción de datos de Jira
    - Crear JQL queries para obtener issues
    - Extraer status, timestamps, story points, relaciones
    - _Requerimientos: 7.1_
  
  - [ ]* 14.2 Escribir property test para extracción de datos
    - **Property 18: Jira Data Extraction**
    - **Valida: Requerimiento 7.1**
  
  - [x] 14.3 Implementar cálculo de velocidad
    - Calcular story points completados por sprint
    - Calcular promedio y tendencia
    - _Requerimientos: 7.2_
  
  - [ ]* 14.4 Escribir property test para cálculo de velocidad
    - **Property 19: Velocity Calculation**
    - **Valida: Requerimiento 7.2**
  
  - [x] 14.5 Implementar identificación de issues bloqueadas
    - Detectar status "Blocked"
    - Detectar issues estancadas por tiempo
    - _Requerimientos: 7.3_
  
  - [ ]* 14.6 Escribir property test para identificación de bloqueadas
    - **Property 20: Blocked Issue Identification**
    - **Valida: Requerimiento 7.3**
  
  - [x] 14.7 Implementar distribución por status
    - Contar issues por status (To Do, In Progress, Done, Blocked)
    - _Requerimientos: 7.4_
  
  - [ ]* 14.8 Escribir property test para distribución
    - **Property 21: Status Distribution**
    - **Valida: Requerimiento 7.4**
  
  - [x] 14.9 Implementar cálculo de cycle time
    - Calcular duración desde "In Progress" hasta "Done"
    - Calcular promedio, mediana, percentil 90
    - _Requerimientos: 7.5_
  
  - [ ]* 14.10 Escribir property test para cycle time
    - **Property 22: Cycle Time Calculation**
    - **Valida: Requerimiento 7.5**
  
  - [x] 14.11 Implementar detección de cuellos de botella
    - Analizar patrones de dependencias
    - Identificar issues con muchas dependencias
    - Clasificar severidad de bottlenecks
    - _Requerimientos: 7.6_
  
  - [ ]* 14.12 Escribir property test para detección de bottlenecks
    - **Property 23: Bottleneck Detection**
    - **Valida: Requerimiento 7.6**
  
  - [ ]* 14.13 Escribir unit tests para Project Analyzer
    - Test cálculo de velocidad con datos conocidos
    - Test identificación de issues bloqueadas específicas
    - Test cálculo de cycle time con timestamps conocidos
    - _Requerimientos: 7.1-7.6_

- [x] 15. Checkpoint - Verificar capa de integración
  - Asegurarse de que todas las pruebas pasen, preguntar al usuario si surgen dudas.

- [x] 16. Implementar manejo de errores global
  - [x] 16.1 Crear tipos y códigos de error
    - Definir ErrorResponse interface
    - Crear códigos de error para cada categoría
    - _Requerimientos: Todos (manejo de errores)_
  
  - [x] 16.2 Implementar error handlers específicos
    - JIRA_AUTH_FAILED, JIRA_PERMISSION_DENIED
    - FIGMA_ACCESS_DENIED
    - INVALID_STORY_FORMAT, INVEST_VALIDATION_FAILED
    - JIRA_COMPONENT_NOT_FOUND
    - NETWORK_ERROR, AMBIGUOUS_DESCRIPTION
    - _Requerimientos: 5.6, 6.3, 11.5_
  
  - [x] 16.3 Implementar mecanismos de recuperación
    - Retry con exponential backoff para errores de red
    - Rollback para fallos en creación de épicas
    - Partial success reporting para sincronización masiva
    - _Requerimientos: 5.6_
  
  - [ ]* 16.4 Escribir unit tests para manejo de errores
    - Test cada código de error
    - Test retry logic
    - Test rollback
    - _Requerimientos: 5.6, 6.3_

- [ ] 17. Integración de componentes y flujos end-to-end
  - [x] 17.1 Integrar Story Generator con INVEST Validator
    - Validar historias automáticamente después de generación
    - Incluir resultados de validación en GenerationResult
    - _Requerimientos: 1.2, 8.1-8.6_
  
  - [x] 17.2 Integrar Story Generator con Epic Assembler
    - Agrupar historias en épicas después de generación
    - _Requerimientos: 4.1-4.5_
  
  - [x] 17.3 Integrar Figma Analyzer con Story Generator
    - Pasar FigmaAnalysisResult como input a generateStories()
    - _Requerimientos: 2.1-2.5_
  
  - [x] 17.4 Integrar Jira Connector con Credential Store
    - Recuperar credenciales de forma segura
    - _Requerimientos: 6.1-6.5_
  
  - [x] 17.5 Integrar Story Generator con Workspace Store
    - Guardar historias generadas automáticamente
    - _Requerimientos: 12.1-12.6_
  
  - [x] 17.6 Integrar refineStory con Change History
    - Registrar cambios automáticamente
    - _Requerimientos: 12.6_
  
  - [ ]* 17.7 Escribir property test para modificación de criterios
    - **Property 32: Criteria Modification**
    - **Valida: Requerimiento 12.3**
  
  - [ ]* 17.8 Escribir property test para mantenimiento de lista de componentes
    - **Property 30: Component List Maintenance**
    - **Valida: Requerimiento 10.4**

- [ ] 18. Pruebas de integración end-to-end
  - [ ]* 18.1 Escribir test de flujo completo: Descripción → Jira
    - Test: descripción → generación → validación → refinamiento → sincronización Jira
    - Verificar creación de tickets en Jira
    - _Requerimientos: 1.1-1.5, 5.1-5.6, 8.1-8.7_
  
  - [ ]* 18.2 Escribir test de flujo Figma → CSV
    - Test: Figma URL → análisis → generación → exportación CSV
    - Verificar formato CSV correcto
    - _Requerimientos: 2.1-2.5, 9.1-9.5_
  
  - [ ]* 18.3 Escribir test de análisis de proyecto
    - Test: proyecto Jira → análisis → reporte de métricas
    - Verificar cálculos de velocidad y cycle time
    - _Requerimientos: 7.1-7.6_
  
  - [ ]* 18.4 Escribir test de sincronización masiva
    - Test sincronización de 50+ historias
    - Verificar manejo de rate limiting
    - _Requerimientos: 5.1-5.6_

- [x] 19. Implementar API REST del backend
  - [x] 19.1 Crear endpoints para Story Generator
    - POST /api/stories/generate - Generar historias desde descripción
    - PUT /api/stories/:id/refine - Refinar historia existente
    - POST /api/stories/detect-ambiguities - Detectar ambigüedades
    - _Requerimientos: 1.1-1.5, 11.1-11.5_
  
  - [x] 19.2 Crear endpoints para Figma
    - POST /api/figma/analyze - Analizar diseño de Figma
    - GET /api/figma/components/:fileKey - Obtener componentes
    - GET /api/figma/flows/:fileKey - Obtener flujos
    - _Requerimientos: 2.1-2.5_
  
  - [x] 19.3 Crear endpoints para Jira
    - POST /api/jira/authenticate - Autenticar con Jira
    - POST /api/jira/sync - Sincronizar historias con Jira
    - GET /api/jira/validate-permissions/:projectKey - Validar permisos
    - _Requerimientos: 5.1-5.6, 6.1-6.5_
  
  - [x] 19.4 Crear endpoints para análisis de proyectos
    - GET /api/projects/:projectKey/metrics - Obtener métricas
    - GET /api/projects/:projectKey/velocity - Calcular velocidad
    - GET /api/projects/:projectKey/bottlenecks - Identificar cuellos de botella
    - _Requerimientos: 7.1-7.6_
  
  - [x] 19.5 Crear endpoints para exportación
    - GET /api/export/json - Exportar a JSON
    - GET /api/export/csv - Exportar a CSV
    - _Requerimientos: 9.1-9.5_
  
  - [x] 19.6 Crear endpoints para workspaces
    - GET /api/workspaces - Listar workspaces
    - GET /api/workspaces/:id - Obtener workspace
    - POST /api/workspaces - Crear workspace
    - PUT /api/workspaces/:id - Actualizar workspace
    - _Requerimientos: 12.1-12.6_

- [x] 20. Implementar interfaz web (Frontend React)
  - [x] 20.1 Crear layout principal y navegación
    - Implementar header con navegación
    - Implementar sidebar con menú
    - Crear estructura de rutas
    - _Requerimientos: Todos (UI base)_
  
  - [x] 20.2 Crear vista de generación de historias
    - Formulario para ingresar descripción de funcionalidad
    - Input para URL de Figma (opcional)
    - Botón "Generar Historias"
    - Área de visualización de ambigüedades detectadas
    - Formulario para responder preguntas de aclaración
    - _Requerimientos: 1.1-1.5, 2.1-2.5, 11.1-11.5_
  
  - [x] 20.3 Crear vista de revisión de historias
    - Lista de historias generadas con cards
    - Visualización de formato "Como [rol], quiero [acción], para que [valor]"
    - Visualización de criterios de aceptación en formato Gherkin
    - Indicadores de score INVEST por historia
    - Agrupación visual por épicas
    - _Requerimientos: 1.1-1.3, 3.1-3.5, 4.1-4.5, 8.1-8.7_
  
  - [x] 20.4 Crear funcionalidad de edición de historias
    - Editor inline para título de historia
    - Editor para descripción y criterios de aceptación
    - Botones para agregar/eliminar criterios
    - Selector de componentes técnicos
    - Drag & drop para reorganizar historias entre épicas
    - Visualización de sugerencias INVEST
    - _Requerimientos: 10.1-10.5, 12.1-12.6_
  
  - [x] 20.5 Crear vista de configuración de Jira
    - Formulario para credenciales (base URL, email, API token)
    - Botón "Probar Conexión"
    - Selector de proyecto Jira
    - Indicador de permisos validados
    - _Requerimientos: 6.1-6.5_
  
  - [x] 20.6 Crear vista de sincronización
    - Botón "Aprobar y Sincronizar"
    - Barra de progreso durante sincronización
    - Lista de tickets creados con enlaces a Jira
    - Manejo de errores con mensajes descriptivos
    - Opción de partial success (continuar con éxitos)
    - _Requerimientos: 5.1-5.6_
  
  - [x] 20.7 Crear vista de análisis de proyectos
    - Dashboard con métricas principales
    - Gráfico de velocidad por sprint
    - Tabla de issues bloqueadas
    - Distribución por status (gráfico de dona)
    - Métricas de cycle time
    - Lista de cuellos de botella identificados
    - _Requerimientos: 7.1-7.6_
  
  - [x] 20.8 Crear vista de exportación
    - Selector de historias para exportar
    - Botones "Exportar JSON" y "Exportar CSV"
    - Preview del archivo antes de descargar
    - _Requerimientos: 9.1-9.5_
  
  - [x] 20.9 Implementar gestión de workspaces
    - Lista de workspaces existentes
    - Botón "Nuevo Workspace"
    - Selector de workspace activo
    - Indicador de estado de sincronización
    - _Requerimientos: 12.1-12.6_
  
  - [x] 20.10 Implementar historial de cambios
    - Vista de historial por historia
    - Visualización de cambios (diff)
    - Botón "Revertir" para cada cambio
    - _Requerimientos: 12.6_
  
  - [ ]* 20.11 Escribir tests de componentes React
    - Test formulario de generación
    - Test edición de historias
    - Test sincronización con Jira
    - Test visualización de métricas
    - _Requerimientos: Todos (UI testing)_

- [x] 21. Documentación y configuración final
  - [x] 21.1 Crear archivo de configuración de ejemplo
    - Crear .env.example con variables requeridas (backend y frontend)
    - Documentar configuración de LLM API
    - Documentar configuración de servidores MCP (Jira y Figma)
    - _Requerimientos: Todos (configuración)_
  
  - [x] 21.2 Crear README con instrucciones de uso
    - Documentar instalación y setup (frontend + backend)
    - Documentar flujos principales de uso
    - Documentar troubleshooting común
    - _Requerimientos: Todos (documentación)_
  
  - [x] 21.3 Configurar scripts de npm
    - Agregar scripts: build, test, test:unit, test:property, test:integration
    - Agregar scripts: dev (frontend + backend), start
    - _Requerimientos: Todos (testing)_

- [x] 22. Checkpoint final - Verificación completa del sistema
  - Ejecutar todas las pruebas (unit, property, integration, UI)
  - Verificar cobertura de código (objetivo: 80%)
  - Verificar que todas las 34 propiedades tienen tests
  - Probar flujo end-to-end en navegador
  - Asegurarse de que todas las pruebas pasen, preguntar al usuario si surgen dudas.

## Notas

- Las tareas marcadas con `*` son opcionales y pueden omitirse para un MVP más rápido
- Cada tarea referencia los requerimientos específicos para trazabilidad
- Los checkpoints aseguran validación incremental del progreso
- Las property tests validan las 34 propiedades de corrección del diseño
- Los unit tests validan ejemplos específicos y casos borde
- La arquitectura de 3 capas permite desarrollo paralelo de componentes independientes
- El sistema requiere credenciales de Jira y Figma para pruebas de integración
- Tiempo estimado de ejecución de property tests: < 5 minutos
- Objetivo de cobertura: 80% de líneas de código
