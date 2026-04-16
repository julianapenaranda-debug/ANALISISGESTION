# Referencia Completa de Tipos - PO AI

Este documento proporciona una referencia rápida de todos los tipos disponibles en el paquete `@po-ai/shared`.

## Índice

1. [Tipos de Dominio Core](#tipos-de-dominio-core)
2. [Tipos de Integración](#tipos-de-integración)
3. [Tipos de Métricas](#tipos-de-métricas)
4. [Tipos de Exportación](#tipos-de-exportación)
5. [Interfaces de Servicios](#interfaces-de-servicios)

---

## Tipos de Dominio Core

### Story
Historia de usuario completa con todos sus atributos.

**Campos:**
- `id: string` - Identificador único
- `title: string` - Título de la historia
- `role: string` - Rol del usuario (ej: "usuario", "administrador")
- `action: string` - Acción que quiere realizar
- `value: string` - Valor que obtiene
- `description: string` - Descripción completa generada
- `acceptanceCriteria: AcceptanceCriterion[]` - Criterios de aceptación
- `components: string[]` - Componentes técnicos afectados
- `epicId?: string` - ID de la épica a la que pertenece
- `investScore: InvestScore` - Puntuación INVEST
- `metadata: StoryMetadata` - Metadatos

### AcceptanceCriterion
Criterio de aceptación en formato Gherkin.

**Campos:**
- `id: string` - Identificador único
- `given: string` - Precondición (Dado que...)
- `when: string` - Acción (Cuando...)
- `then: string` - Resultado esperado (Entonces...)
- `type: 'positive' | 'negative' | 'error'` - Tipo de escenario

### Epic
Agrupación de historias relacionadas.

**Campos:**
- `id: string` - Identificador único
- `title: string` - Título de la épica
- `description: string` - Descripción
- `businessValue: string` - Valor de negocio
- `stories: string[]` - IDs de historias incluidas
- `dependencies: Dependency[]` - Dependencias entre historias
- `metadata: EpicMetadata` - Metadatos

### InvestScore
Puntuación de validación según criterios INVEST.

**Campos:**
- `independent: number` - Independiente (0-1)
- `negotiable: number` - Negociable (0-1)
- `valuable: number` - Valiosa (0-1)
- `estimable: number` - Estimable (0-1)
- `small: number` - Pequeña (0-1)
- `testable: number` - Testeable (0-1)
- `overall: number` - Puntuación general (0-1)

### ValidationResult
Resultado de validación INVEST.

**Campos:**
- `isValid: boolean` - Si la historia es válida
- `score: InvestScore` - Puntuaciones
- `failures: ValidationFailure[]` - Fallos encontrados
- `suggestions: Suggestion[]` - Sugerencias de mejora

### Ambiguity
Término o concepto ambiguo que requiere aclaración.

**Campos:**
- `id: string` - Identificador único
- `type: 'vague_term' | 'missing_role' | 'missing_value' | 'unclear_scope'` - Tipo
- `location: string` - Dónde se encontró
- `term: string` - Término ambiguo
- `question: string` - Pregunta para aclarar
- `suggestions: string[]` - Sugerencias

### ProjectContext
Contexto del proyecto para generación de historias.

**Campos:**
- `projectKey: string` - Clave del proyecto
- `domain: string` - Dominio (ej: "e-commerce", "healthcare")
- `existingComponents: string[]` - Componentes existentes
- `userRoles: string[]` - Roles de usuario
- `conventions: ProjectConventions` - Convenciones del proyecto

### Workspace
Espacio de trabajo con historias y épicas.

**Campos:**
- `id: string` - Identificador único
- `name: string` - Nombre del workspace
- `projectKey: string` - Clave del proyecto Jira
- `stories: Story[]` - Historias en el workspace
- `epics: Epic[]` - Épicas en el workspace
- `metadata: WorkspaceMetadata` - Metadatos

### FigmaAnalysisResult
Resultado del análisis de un diseño Figma.

**Campos:**
- `components: UIComponent[]` - Componentes UI extraídos
- `flows: UserFlow[]` - Flujos de usuario identificados
- `screens: Screen[]` - Pantallas del diseño
- `interactions: Interaction[]` - Interacciones

---

## Tipos de Integración

### JiraCredentials
Credenciales para autenticación con Jira.

**Campos:**
- `baseUrl: string` - URL base de Jira
- `email: string` - Email del usuario
- `apiToken: string` - Token de API

### JiraIssue
Representación de un issue para crear en Jira.

**Campos:**
- `projectKey: string` - Clave del proyecto
- `issueType: 'Epic' | 'Story'` - Tipo de issue
- `summary: string` - Resumen
- `description: string` - Descripción
- `components?: string[]` - Componentes
- `epicLink?: string` - Enlace a épica padre

### JiraIssuePayload
Payload completo para la API de Jira.

**Campos:**
- `fields: object` - Campos del issue en formato Jira API

### CreateResult
Resultado de creación de issues en Jira.

**Campos:**
- `created: IssueReference[]` - Issues creados exitosamente
- `failed: FailedIssue[]` - Issues que fallaron

### IssueReference
Referencia a un issue creado en Jira.

**Campos:**
- `localId: string` - ID local
- `jiraKey: string` - Clave en Jira (ej: "PROJ-123")
- `jiraId: string` - ID interno de Jira
- `url: string` - URL del issue

### FigmaFile
Archivo de diseño de Figma.

**Campos:**
- `name: string` - Nombre del archivo
- `lastModified: string` - Fecha de última modificación
- `thumbnailUrl: string` - URL del thumbnail
- `version: string` - Versión
- `document: FigmaNode` - Nodo raíz del documento

### FigmaNode
Nodo en el árbol de Figma.

**Campos:**
- `id: string` - ID del nodo
- `name: string` - Nombre
- `type: string` - Tipo de nodo
- `children?: FigmaNode[]` - Nodos hijos
- `prototypeStartNodeID?: string` - ID del nodo inicial del prototipo

### ErrorResponse
Respuesta de error estándar del sistema.

**Campos:**
- `code: string` - Código de error
- `message: string` - Mensaje descriptivo
- `details?: any` - Detalles adicionales
- `recoverable: boolean` - Si el error es recuperable
- `suggestedAction?: string` - Acción sugerida

---

## Tipos de Métricas

### ProjectMetrics
Métricas completas de un proyecto.

**Campos:**
- `velocity: VelocityData` - Datos de velocidad
- `cycleTime: CycleTimeData` - Datos de tiempo de ciclo
- `distribution: StatusDistribution` - Distribución por estado
- `blockedIssues: BlockedIssue[]` - Issues bloqueadas
- `bottlenecks: Bottleneck[]` - Cuellos de botella

### VelocityData
Datos de velocidad del equipo.

**Campos:**
- `averageStoryPoints: number` - Promedio de story points
- `sprintVelocities: SprintVelocity[]` - Velocidad por sprint
- `trend: 'increasing' | 'stable' | 'decreasing'` - Tendencia

### SprintVelocity
Velocidad de un sprint específico.

**Campos:**
- `sprintId: string` - ID del sprint
- `sprintName: string` - Nombre del sprint
- `storyPoints: number` - Story points completados
- `completedIssues: number` - Issues completados
- `startDate: Date` - Fecha de inicio
- `endDate: Date` - Fecha de fin

### CycleTimeData
Datos de tiempo de ciclo.

**Campos:**
- `averageDays: number` - Promedio en días
- `median: number` - Mediana
- `percentile90: number` - Percentil 90

### StatusDistribution
Distribución de estados de issues.

**Campos:**
- `todo: number` - Cantidad en To Do
- `inProgress: number` - Cantidad en In Progress
- `done: number` - Cantidad en Done
- `blocked: number` - Cantidad bloqueadas

### BlockedIssue
Issue bloqueado.

**Campos:**
- `issueKey: string` - Clave del issue
- `summary: string` - Resumen
- `blockedSince: Date` - Bloqueado desde
- `blockedDays: number` - Días bloqueado
- `blocker?: string` - Qué lo bloquea
- `reason?: string` - Razón del bloqueo

### Bottleneck
Cuello de botella identificado.

**Campos:**
- `type: 'dependency' | 'resource' | 'blocker'` - Tipo
- `affectedIssues: string[]` - Issues afectados
- `description: string` - Descripción
- `severity: 'high' | 'medium' | 'low'` - Severidad

---

## Tipos de Exportación

### ExportFormat
Formato de exportación.

**Valores:** `'json' | 'csv'`

### ExportOptions
Opciones para exportación.

**Campos:**
- `format: ExportFormat` - Formato deseado
- `selectedStoryIds?: string[]` - IDs de historias a exportar
- `includeEpics?: boolean` - Si incluir épicas
- `projectKey: string` - Clave del proyecto

### ExportResult
Resultado de exportación.

**Campos:**
- `format: ExportFormat` - Formato usado
- `content: string` - Contenido exportado
- `filename: string` - Nombre del archivo
- `size: number` - Tamaño en bytes

### JiraExport
Modelo para exportación JSON compatible con Jira.

**Campos:**
- `issueUpdates: JiraIssueUpdate[]` - Actualizaciones de issues

### CsvRow
Modelo para exportación CSV.

**Campos:**
- `'Issue Type': string` - Tipo de issue
- `'Summary': string` - Resumen
- `'Description': string` - Descripción
- `'Acceptance Criteria': string` - Criterios de aceptación
- `'Components': string` - Componentes
- `'Epic Link': string` - Enlace a épica

---

## Interfaces de Servicios

### StoryGenerator
Servicio de generación de historias.

**Métodos:**
- `generateStories(input: GenerationInput): Promise<GenerationResult>`
- `refineStory(storyId: string, changes: StoryChanges): Promise<Story>`
- `detectAmbiguities(description: string): Ambiguity[]`

### FigmaAnalyzer
Servicio de análisis de Figma.

**Métodos:**
- `analyzeDesign(figmaUrl: string): Promise<FigmaAnalysisResult>`
- `extractComponents(fileKey: string): Promise<UIComponent[]>`
- `identifyFlows(fileKey: string): Promise<UserFlow[]>`

### INVESTValidator
Servicio de validación INVEST.

**Métodos:**
- `validate(story: Story): ValidationResult`
- `suggestImprovements(story: Story, failures: ValidationFailure[]): Suggestion[]`

### EpicAssembler
Servicio de ensamblaje de épicas.

**Métodos:**
- `assembleEpics(stories: Story[]): Epic[]`
- `identifyDependencies(stories: Story[]): Dependency[]`
- `reorganizeStories(storyId: string, targetEpicId: string): void`

### JiraConnector
Servicio de conexión con Jira.

**Métodos:**
- `authenticate(credentials: JiraCredentials): Promise<AuthResult>`
- `createIssues(issues: JiraIssue[]): Promise<CreateResult>`
- `linkIssues(parentId: string, childIds: string[]): Promise<void>`
- `validatePermissions(projectKey: string): Promise<PermissionCheck>`
- `exportToJson(stories: Story[], epics: Epic[]): string`
- `exportToCsv(stories: Story[], epics: Epic[]): string`

### ProjectAnalyzer
Servicio de análisis de proyectos.

**Métodos:**
- `analyzeProject(projectKey: string): Promise<ProjectMetrics>`
- `calculateVelocity(projectKey: string, sprints: number): Promise<VelocityData>`
- `identifyBottlenecks(projectKey: string): Promise<Bottleneck[]>`

### CredentialStore
Servicio de almacenamiento de credenciales.

**Métodos:**
- `store(key: string, credentials: JiraCredentials): Promise<void>`
- `retrieve(key: string): Promise<JiraCredentials | null>`
- `update(key: string, credentials: JiraCredentials): Promise<void>`
- `delete(key: string): Promise<void>`

### WorkspaceStore
Servicio de almacenamiento de workspaces.

**Métodos:**
- `saveWorkspace(workspace: Workspace): Promise<void>`
- `loadWorkspace(workspaceId: string): Promise<Workspace>`
- `listWorkspaces(): Promise<WorkspaceMetadata[]>`

### ChangeHistory
Servicio de historial de cambios.

**Métodos:**
- `recordChange(storyId: string, change: Change): void`
- `getHistory(storyId: string): Change[]`
- `revert(storyId: string, changeId: string): Promise<Story>`

---

## Notas de Uso

### Importación Recomendada

```typescript
// Importar solo lo que necesitas
import { Story, Epic, StoryGenerator } from '@po-ai/shared';

// O importar todo
import * as PoAiTypes from '@po-ai/shared';
```

### Validación de Tipos

Todos los tipos están diseñados para ser estrictos y seguros. TypeScript validará automáticamente que los objetos cumplan con las interfaces definidas.

### Extensibilidad

Las interfaces de servicios están diseñadas para ser implementadas por diferentes módulos del sistema, permitiendo múltiples implementaciones si es necesario.
