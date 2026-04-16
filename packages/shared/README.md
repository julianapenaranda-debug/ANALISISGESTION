# @po-ai/shared

Tipos y utilidades compartidas para el sistema PO AI.

## Descripción

Este paquete contiene todas las interfaces TypeScript y tipos compartidos utilizados tanto en el frontend como en el backend del sistema PO AI. Proporciona una única fuente de verdad para los modelos de datos del dominio, integraciones, métricas y servicios.

## Estructura

```
src/
├── types/
│   ├── domain.ts       # Modelos de dominio core (Story, Epic, etc.)
│   ├── integration.ts  # Tipos de integración (Jira, Figma)
│   ├── metrics.ts      # Tipos de métricas y análisis
│   ├── export.ts       # Tipos para exportación de artefactos
│   ├── services.ts     # Interfaces de servicios
│   └── index.ts        # Exportaciones centralizadas
└── index.ts            # Punto de entrada principal
```

## Tipos Principales

### Dominio Core

- **Story**: Historia de usuario completa con criterios de aceptación
- **Epic**: Agrupación de historias relacionadas
- **AcceptanceCriterion**: Criterio de aceptación en formato Gherkin
- **InvestScore**: Puntuación de validación INVEST
- **Ambiguity**: Términos ambiguos que requieren aclaración
- **ProjectContext**: Contexto del proyecto para generación

### Integración

- **JiraCredentials**: Credenciales para autenticación con Jira
- **JiraIssue**: Representación de un issue de Jira
- **JiraIssuePayload**: Payload para API de Jira
- **FigmaFile**: Archivo de diseño de Figma
- **FigmaNode**: Nodo en el árbol de Figma
- **ErrorResponse**: Respuesta de error estándar

### Métricas

- **ProjectMetrics**: Métricas completas de un proyecto
- **VelocityData**: Datos de velocidad del equipo
- **CycleTimeData**: Datos de tiempo de ciclo
- **StatusDistribution**: Distribución de estados de issues
- **Bottleneck**: Cuello de botella identificado

### Servicios

Interfaces para todos los componentes del sistema:

- **StoryGenerator**: Generación de historias de usuario
- **FigmaAnalyzer**: Análisis de diseños Figma
- **INVESTValidator**: Validación de calidad INVEST
- **EpicAssembler**: Ensamblaje de épicas
- **JiraConnector**: Conexión con Jira
- **ProjectAnalyzer**: Análisis de métricas
- **CredentialStore**: Almacenamiento seguro de credenciales
- **WorkspaceStore**: Persistencia de workspaces
- **ChangeHistory**: Historial de cambios

### Exportación

- **ExportFormat**: Formatos de exportación soportados
- **ExportOptions**: Opciones para exportación
- **ExportResult**: Resultado de exportación

## Uso

### Instalación

Este paquete es parte del monorepo y se instala automáticamente con las dependencias del workspace.

### Importación

```typescript
// Importar tipos específicos
import { Story, Epic, AcceptanceCriterion } from '@po-ai/shared';

// Importar interfaces de servicios
import { StoryGenerator, JiraConnector } from '@po-ai/shared';

// Importar tipos de métricas
import { ProjectMetrics, VelocityData } from '@po-ai/shared';
```

### Ejemplo de Uso

```typescript
import { Story, AcceptanceCriterion, InvestScore } from '@po-ai/shared';

const story: Story = {
  id: 'story-1',
  title: 'Crear nueva tarea',
  role: 'usuario',
  action: 'crear una tarea',
  value: 'pueda organizar mi trabajo',
  description: 'Como usuario, quiero crear una tarea, para que pueda organizar mi trabajo',
  acceptanceCriteria: [
    {
      id: 'ac-1',
      given: 'el usuario está autenticado',
      when: 'hace clic en "Nueva Tarea"',
      then: 'se muestra el formulario de creación',
      type: 'positive'
    }
  ],
  components: ['TaskManager', 'UI'],
  investScore: {
    independent: 0.9,
    negotiable: 0.8,
    valuable: 1.0,
    estimable: 0.9,
    small: 0.8,
    testable: 1.0,
    overall: 0.9
  },
  metadata: {
    created: new Date(),
    modified: new Date(),
    source: 'generated'
  }
};
```

## Desarrollo

### Compilar

```bash
npm run build
```

### Modo Watch

```bash
npm run dev
```

### Limpiar

```bash
npm run clean
```

## Validación de Tipos

Todos los tipos están diseñados para cumplir con los requisitos del documento de diseño del sistema PO AI. Las interfaces de servicios reflejan exactamente las especificaciones del documento de arquitectura.

## Convenciones

- Todos los tipos usan PascalCase
- Las interfaces de servicios coinciden con los nombres de componentes del diseño
- Los campos opcionales están marcados con `?`
- Los tipos de unión usan `|` para alternativas
- Los enums se representan como tipos literales de string

## Compatibilidad

- TypeScript >= 4.5
- Node.js >= 18.0.0

## Licencia

MIT
