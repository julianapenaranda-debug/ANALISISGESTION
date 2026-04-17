# Requirements Document

## Introduction

Integración de campos personalizados de Jira (Tribu, Squad, Tipo de Iniciativa, Año de Ejecución, Centro de Costos, Avance Esperado y Avance Real) en las vistas de listado de proyectos, métricas y análisis del sistema PO-AI. Esto permite a los usuarios filtrar iniciativas por Tribu, Squad y Año, y visualizar el contexto organizacional y el avance planificado vs. real de cada iniciativa.

## Glossary

- **Sistema**: La aplicación PO-AI (backend Express + frontend React)
- **Jira_Connector**: Módulo backend (`jira-connector.ts`) que realiza peticiones a la API REST de Jira
- **Project_Analyzer**: Módulo backend (`project-analyzer.ts`) que calcula métricas de gestión de proyectos
- **JiraView**: Componente React que muestra el listado de proyectos Jira
- **MetricsView**: Componente React que muestra métricas de gestión de un proyecto
- **WorkloadView**: Componente React que muestra análisis de carga de trabajo
- **FlowMetricsView**: Componente React que muestra métricas de flujo
- **Custom_Fields**: Los campos personalizados de Jira con IDs fijos: `customfield_28477` (Tribu/Chapter), `customfield_28478` (Squad), `customfield_27929` (Tipo de Iniciativa), `customfield_25441` (Año de Ejecución), `customfield_15601` (Centro de Costos), `customfield_25475` (Avance Esperado %), `customfield_25476` (Avance Real %)
- **Initiative_Context_Card**: Tarjeta de encabezado que muestra Tribu, Squad, Tipo de Iniciativa, Año de Ejecución y comparación Avance Esperado vs. Avance Real
- **Filter_Panel**: Panel de filtros dropdown en JiraView para Tribu, Squad y Año de Ejecución

## Requirements

### Requirement 1: Obtención de Campos Personalizados desde Jira

**User Story:** Como usuario del sistema, quiero que los campos personalizados de cada iniciativa se obtengan automáticamente de Jira, para poder ver la información organizacional y de avance sin consultar Jira manualmente.

#### Acceptance Criteria

1. WHEN the Jira_Connector fetches the project list, THE Jira_Connector SHALL request the custom fields `customfield_28477`, `customfield_28478`, `customfield_27929`, `customfield_25441`, `customfield_15601`, `customfield_25475`, and `customfield_25476` for each project's lead issue.
2. WHEN a custom field value is null or missing in the Jira response, THE Jira_Connector SHALL return an empty string for text fields and null for numeric fields (Avance Esperado, Avance Real).
3. WHEN the Jira API returns an error while fetching custom fields, THE Jira_Connector SHALL log the error and return the project data without custom fields rather than failing the entire request.
4. THE Jira_Connector SHALL include the custom field values in the `JiraProject` interface as `tribu`, `squad`, `tipoIniciativa`, `anioEjecucion`, `centroCostos`, `avanceEsperado`, and `avanceReal`.

### Requirement 2: API de Listado de Proyectos con Campos Personalizados

**User Story:** Como usuario del sistema, quiero que la API de listado de proyectos devuelva los campos personalizados, para que el frontend pueda mostrarlos y filtrarlos.

#### Acceptance Criteria

1. WHEN the `/api/jira/projects` endpoint is called, THE Sistema SHALL return each project with the fields `tribu`, `squad`, `tipoIniciativa`, `anioEjecucion`, `centroCostos`, `avanceEsperado`, and `avanceReal` in the response payload.
2. WHEN the `tribu` query parameter is provided, THE Sistema SHALL return only projects whose Tribu field matches the provided value.
3. WHEN the `squad` query parameter is provided, THE Sistema SHALL return only projects whose Squad field matches the provided value.
4. WHEN the `anio` query parameter is provided, THE Sistema SHALL return only projects whose Año de Ejecución field matches the provided value.
5. WHEN multiple filter parameters (`tribu`, `squad`, `anio`) are provided simultaneously, THE Sistema SHALL apply all filters using AND logic and return only projects matching all criteria.
6. THE Sistema SHALL return a `filters` object in the response containing the distinct values of `tribu`, `squad`, and `anioEjecucion` across all projects (before filtering), so the frontend can populate dropdown options.

### Requirement 3: Listado de Proyectos con Campos Personalizados en JiraView

**User Story:** Como usuario, quiero ver la Tribu, Squad, Tipo de Iniciativa y Año de Ejecución de cada proyecto en el listado, para identificar rápidamente a qué área pertenece cada iniciativa.

#### Acceptance Criteria

1. THE JiraView SHALL display the `tribu`, `squad`, `tipoIniciativa`, and `anioEjecucion` values for each project in the project list.
2. WHEN a custom field value is empty or missing, THE JiraView SHALL display a dash character ("—") in place of the missing value.
3. THE JiraView SHALL display all labels in Spanish: "Tribu", "Squad", "Tipo de Iniciativa", "Año".
4. THE JiraView SHALL use the design system color `#009056` for badges and highlighted metadata elements.

### Requirement 4: Filtros de Proyectos en JiraView

**User Story:** Como usuario, quiero filtrar el listado de proyectos por Tribu, Squad y Año de Ejecución, para encontrar rápidamente las iniciativas que me interesan.

#### Acceptance Criteria

1. THE Filter_Panel SHALL render three dropdown selectors labeled "Tribu", "Squad", and "Año".
2. WHEN the project list loads, THE Filter_Panel SHALL populate each dropdown with the distinct values returned in the `filters` object from the API response.
3. WHEN the user selects a value in any dropdown filter, THE JiraView SHALL send a new request to the API with the selected filter parameters and display the filtered results.
4. WHEN the user clears a filter selection, THE JiraView SHALL remove that filter parameter from the API request and reload the project list.
5. THE Filter_Panel SHALL include a "Limpiar filtros" button that resets all three dropdowns to their default unselected state.
6. WHILE filters are active, THE JiraView SHALL display a count of filtered results (e.g., "Mostrando 12 de 45 iniciativas").

### Requirement 5: Tarjeta de Contexto de Iniciativa en Vistas de Métricas

**User Story:** Como usuario, quiero ver el contexto organizacional y el avance de la iniciativa al analizar sus métricas, para tener visibilidad completa sin cambiar de vista.

#### Acceptance Criteria

1. WHEN a project is selected for metrics analysis, THE MetricsView SHALL display an Initiative_Context_Card at the top showing Tribu, Squad, Tipo de Iniciativa, and Año de Ejecución.
2. WHEN a project is selected for workload analysis, THE WorkloadView SHALL display an Initiative_Context_Card at the top showing Tribu, Squad, Tipo de Iniciativa, and Año de Ejecución.
3. WHEN a project is selected for flow metrics analysis, THE FlowMetricsView SHALL display an Initiative_Context_Card at the top showing Tribu, Squad, Tipo de Iniciativa, and Año de Ejecución.
4. THE Initiative_Context_Card SHALL display a visual comparison of Avance Esperado (%) vs. Avance Real (%) using a dual progress bar.
5. WHEN Avance Real is lower than Avance Esperado by more than 10 percentage points, THE Initiative_Context_Card SHALL highlight the Avance Real bar in red (`#DC2626`) to indicate delay.
6. WHEN Avance Real is within 10 percentage points of Avance Esperado, THE Initiative_Context_Card SHALL display the Avance Real bar in the design system green (`#009056`).
7. WHEN Avance Esperado or Avance Real is null, THE Initiative_Context_Card SHALL display "Sin datos" in place of the progress bar for the missing value.
8. THE Initiative_Context_Card SHALL display all labels in Spanish: "Tribu", "Squad", "Tipo de Iniciativa", "Año", "Avance Esperado", "Avance Real".

### Requirement 6: Campos Personalizados en la API de Métricas

**User Story:** Como usuario, quiero que la API de métricas incluya los campos personalizados de la iniciativa, para que las vistas de métricas puedan mostrar el contexto sin hacer peticiones adicionales.

#### Acceptance Criteria

1. WHEN the `/api/projects/:projectKey/metrics` endpoint is called, THE Sistema SHALL include an `initiativeContext` object in the response containing `tribu`, `squad`, `tipoIniciativa`, `anioEjecucion`, `centroCostos`, `avanceEsperado`, and `avanceReal`.
2. WHEN the `/api/workload/analyze` endpoint is called, THE Sistema SHALL include an `initiativeContext` object in the response containing the same custom field values.
3. WHEN the `/api/flow-metrics/analyze` endpoint is called, THE Sistema SHALL include an `initiativeContext` object in the response containing the same custom field values.
4. IF the custom fields cannot be fetched for a project, THEN THE Sistema SHALL return the `initiativeContext` object with all fields set to their default empty values (empty string for text, null for numeric).

### Requirement 7: Componente Reutilizable Initiative_Context_Card

**User Story:** Como desarrollador, quiero un componente reutilizable para la tarjeta de contexto de iniciativa, para mantener consistencia visual y evitar duplicación de código.

#### Acceptance Criteria

1. THE Sistema SHALL provide a single React component `InitiativeContextCard` that accepts `tribu`, `squad`, `tipoIniciativa`, `anioEjecucion`, `avanceEsperado`, and `avanceReal` as props.
2. THE InitiativeContextCard SHALL render identically in MetricsView, WorkloadView, and FlowMetricsView.
3. WHEN the InitiativeContextCard receives all null or empty props, THE InitiativeContextCard SHALL render a minimal placeholder state with the text "Contexto de iniciativa no disponible".
4. THE InitiativeContextCard SHALL use Tailwind CSS classes consistent with the existing design system.
