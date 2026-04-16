# Requirements Document

## Introduction

La funcionalidad Developer Workload extiende el sistema PO AI para analizar la carga de trabajo y productividad de los desarrolladores asignados a Historias de Usuario (HU) en Jira. El módulo consulta Jira para obtener HUs asignadas por desarrollador, calcula métricas de carga (cantidad de HUs, story points, estados) y productividad (velocity individual, tiempo promedio de resolución, HUs completadas), identifica desarrolladores sobrecargados o con baja productividad, y presenta un reporte visual interactivo en el frontend con capacidad de filtrado por sprint, proyecto y rango de fechas.

## Glossary

- **Workload_Analyzer**: Componente backend que consulta Jira y calcula métricas de carga y productividad por desarrollador
- **Workload_Report**: Reporte consolidado con métricas de todos los desarrolladores de un proyecto
- **Developer_Metrics**: Conjunto de métricas calculadas para un desarrollador individual (carga, productividad, estado de HUs)
- **Developer**: Usuario de Jira asignado a una o más Historias de Usuario en el proyecto analizado
- **HU**: Historia de Usuario (issue de tipo Story en Jira) asignada a un desarrollador
- **Story_Points**: Estimación numérica del esfuerzo requerido para completar una HU
- **Velocity_Individual**: Promedio de Story_Points completados por un Developer por sprint
- **Cycle_Time_Individual**: Tiempo promedio en días desde que una HU pasa a "In Progress" hasta "Done" para un Developer específico
- **Workload_Status**: Clasificación del nivel de carga de un Developer: "overloaded" (sobrecargado), "normal" (carga normal), "underloaded" (baja carga)
- **Productivity_Status**: Clasificación del nivel de productividad de un Developer: "high" (alta), "normal" (normal), "low" (baja)
- **Sprint_Filter**: Parámetro de filtrado que limita el análisis a un sprint específico de Jira
- **WorkloadView**: Componente React del frontend que muestra el reporte visual de carga y productividad
- **Jira_Connector**: Componente existente que gestiona la integración y autenticación con la API REST de Jira
- **Credential_Store**: Componente existente que almacena credenciales de Jira de forma segura

## Requirements

### Requirement 1: Consulta de HUs por Desarrollador

**User Story:** Como Product Owner, quiero consultar las Historias de Usuario asignadas a cada desarrollador en Jira, para que pueda tener visibilidad sobre la distribución del trabajo en el equipo.

#### Acceptance Criteria

1. WHEN el Product_Owner solicita un análisis de carga para un proyecto, THE Workload_Analyzer SHALL consultar Jira mediante JQL para obtener todas las HUs de tipo Story asignadas a desarrolladores en ese proyecto
2. THE Workload_Analyzer SHALL agrupar las HUs obtenidas por el campo "assignee" de Jira, generando una entrada de Developer_Metrics por cada Developer único identificado
3. WHEN se obtienen HUs de Jira, THE Workload_Analyzer SHALL incluir los campos: assignee, summary, status, story points (customfield_10016 o equivalente), sprint, created, resolutiondate, y updated
4. IF un proyecto no tiene HUs asignadas a ningún Developer, THEN THE Workload_Analyzer SHALL retornar un Workload_Report vacío con un mensaje indicando que no se encontraron HUs asignadas
5. THE Workload_Analyzer SHALL utilizar el Jira_Connector existente y el Credential_Store para autenticar las consultas a Jira

### Requirement 2: Filtrado por Sprint, Proyecto y Rango de Fechas

**User Story:** Como Product Owner, quiero filtrar el análisis de carga por sprint, proyecto y rango de fechas, para que pueda analizar períodos específicos y comparar el rendimiento entre sprints.

#### Acceptance Criteria

1. WHEN el Product_Owner aplica un Sprint_Filter, THE Workload_Analyzer SHALL restringir la consulta JQL al sprint especificado usando la cláusula `sprint = "<sprintName>"`
2. WHEN el Product_Owner especifica un rango de fechas, THE Workload_Analyzer SHALL filtrar HUs cuya fecha de creación o actualización esté dentro del rango usando las cláusulas `created >= "<startDate>"` y `created <= "<endDate>"`
3. THE Workload_Analyzer SHALL aceptar el parámetro projectKey como filtro obligatorio en toda consulta
4. WHEN se aplican múltiples filtros simultáneamente, THE Workload_Analyzer SHALL combinarlos con el operador AND en la consulta JQL resultante
5. THE Workload_Analyzer SHALL exponer un endpoint GET /api/workload/:projectKey/sprints que retorne la lista de sprints disponibles del proyecto para poblar el selector de filtro en el frontend

### Requirement 3: Análisis de Carga de Trabajo por Desarrollador

**User Story:** Como Product Owner, quiero ver la carga de trabajo actual de cada desarrollador, para que pueda identificar desequilibrios en la distribución de tareas.

#### Acceptance Criteria

1. THE Workload_Analyzer SHALL calcular para cada Developer: el total de HUs asignadas, el total de Story_Points asignados, y la distribución de HUs por estado (To Do, In Progress, Done, Blocked)
2. THE Workload_Analyzer SHALL calcular el Workload_Status de cada Developer comparando sus Story_Points activos (no completados) contra el umbral de sobrecarga: "overloaded" si supera 1.5 veces el promedio del equipo, "underloaded" si está por debajo de 0.5 veces el promedio, y "normal" en caso contrario
3. WHEN un Developer tiene HUs sin Story_Points estimados, THE Workload_Analyzer SHALL contabilizar esas HUs en el total de HUs asignadas e indicar cuántas carecen de estimación
4. THE Workload_Analyzer SHALL incluir en Developer_Metrics el número de HUs en estado "In Progress" simultáneamente para identificar multitasking excesivo
5. IF un Developer tiene más de 3 HUs en estado "In Progress" al mismo tiempo, THEN THE Workload_Analyzer SHALL marcar ese Developer con una alerta de multitasking en el Developer_Metrics

### Requirement 4: Medición de Productividad Individual

**User Story:** Como Product Owner, quiero medir la productividad de cada desarrollador, para que pueda identificar quiénes necesitan apoyo y reconocer a los de alto rendimiento.

#### Acceptance Criteria

1. THE Workload_Analyzer SHALL calcular el Velocity_Individual de cada Developer como el promedio de Story_Points completados por sprint en el período analizado
2. THE Workload_Analyzer SHALL calcular el Cycle_Time_Individual de cada Developer como el promedio de días entre el primer cambio de estado a "In Progress" y el cambio a "Done" para sus HUs completadas
3. THE Workload_Analyzer SHALL calcular el total de HUs completadas por Developer en el período analizado
4. THE Workload_Analyzer SHALL calcular el Productivity_Status de cada Developer: "high" si su Velocity_Individual supera 1.3 veces el promedio del equipo, "low" si está por debajo de 0.7 veces el promedio, y "normal" en caso contrario
5. WHEN un Developer no tiene HUs completadas en el período analizado, THE Workload_Analyzer SHALL reportar Velocity_Individual = 0 y Cycle_Time_Individual = null para ese Developer

### Requirement 5: Identificación de Desarrolladores Sobrecargados o con Baja Productividad

**User Story:** Como Product Owner, quiero que el sistema identifique automáticamente desarrolladores con problemas de carga o productividad, para que pueda tomar acciones correctivas de forma proactiva.

#### Acceptance Criteria

1. THE Workload_Analyzer SHALL incluir en el Workload_Report una lista de alertas que identifique a cada Developer con Workload_Status = "overloaded" junto con su Story_Points activos y el porcentaje de exceso sobre el promedio del equipo
2. THE Workload_Analyzer SHALL incluir en el Workload_Report una lista de alertas que identifique a cada Developer con Productivity_Status = "low" junto con su Velocity_Individual y la diferencia respecto al promedio del equipo
3. WHEN el Workload_Report contiene al menos un Developer con Workload_Status = "overloaded" o Productivity_Status = "low", THE Workload_Analyzer SHALL incluir un campo "hasAlerts": true en el Workload_Report
4. THE Workload_Analyzer SHALL ordenar la lista de alertas por severidad: primero los Developer con Workload_Status = "overloaded" y Productivity_Status = "low" simultáneamente, luego los que tienen solo uno de los dos problemas
5. IF todos los Developers tienen Workload_Status = "normal" y Productivity_Status = "normal", THEN THE Workload_Analyzer SHALL retornar el Workload_Report con "hasAlerts": false y una lista de alertas vacía

### Requirement 6: Reporte Visual en el Frontend

**User Story:** Como Product Owner, quiero visualizar las métricas de carga y productividad en un reporte visual interactivo, para que pueda interpretar los datos de forma rápida y tomar decisiones informadas.

#### Acceptance Criteria

1. THE WorkloadView SHALL mostrar una tabla resumen con una fila por Developer que incluya: nombre, total de HUs asignadas, Story_Points activos, Workload_Status, HUs completadas, Velocity_Individual, Cycle_Time_Individual, y Productivity_Status
2. THE WorkloadView SHALL resaltar visualmente con color rojo las filas de Developers con Workload_Status = "overloaded", con color amarillo los de Workload_Status = "underloaded", y con color verde los de Workload_Status = "normal"
3. THE WorkloadView SHALL mostrar una sección de alertas en la parte superior del reporte cuando el Workload_Report tenga "hasAlerts": true, listando cada alerta con el nombre del Developer y la descripción del problema
4. THE WorkloadView SHALL mostrar un panel de filtros que permita al Product_Owner seleccionar el proyecto (projectKey), el sprint (Sprint_Filter), y el rango de fechas antes de ejecutar el análisis
5. WHEN el Product_Owner aplica filtros y ejecuta el análisis, THE WorkloadView SHALL mostrar un indicador de carga mientras espera la respuesta del Workload_Analyzer y actualizar la tabla al recibir los datos
6. THE WorkloadView SHALL mostrar el total de Developers analizados, el total de HUs en el período, y el promedio de Story_Points por Developer como métricas de resumen en la parte superior del reporte

### Requirement 7: API REST para Análisis de Carga

**User Story:** Como desarrollador del sistema, quiero exponer endpoints REST para el análisis de carga de desarrolladores, para que el frontend pueda consumir los datos de forma estructurada.

#### Acceptance Criteria

1. THE Workload_Analyzer SHALL exponer un endpoint POST /api/workload/analyze que acepte { projectKey, credentialKey, filters?: { sprint?, startDate?, endDate? } } y retorne un Workload_Report
2. WHEN la solicitud al endpoint POST /api/workload/analyze no incluye projectKey o credentialKey, THE Workload_Analyzer SHALL retornar HTTP 400 con un mensaje de error descriptivo
3. IF las credenciales referenciadas por credentialKey no existen en el Credential_Store, THEN THE Workload_Analyzer SHALL retornar HTTP 404 con el mensaje "Credentials not found: {credentialKey}"
4. IF la autenticación con Jira falla al ejecutar el análisis, THEN THE Workload_Analyzer SHALL retornar HTTP 401 con el código de error JIRA_AUTH_FAILED
5. THE Workload_Analyzer SHALL retornar el Workload_Report con Content-Type application/json y código HTTP 200 cuando el análisis se complete exitosamente

### Requirement 8: Modelo de Datos del Reporte

**User Story:** Como desarrollador del sistema, quiero un modelo de datos bien definido para el reporte de carga, para que el frontend y el backend compartan una estructura consistente.

#### Acceptance Criteria

1. THE Workload_Analyzer SHALL retornar un Workload_Report con la estructura: { projectKey, generatedAt, filters, summary, developers: Developer_Metrics[], alerts, hasAlerts }
2. THE Workload_Analyzer SHALL incluir en cada Developer_Metrics: { accountId, displayName, email, assignedHUs, activeStoryPoints, completedHUs, completedStoryPoints, velocityIndividual, cycleTimeIndividual, workloadStatus, productivityStatus, husByStatus, unestimatedHUs, inProgressCount, multitaskingAlert }
3. THE Workload_Analyzer SHALL incluir en el campo summary del Workload_Report: { totalDevelopers, totalHUs, averageStoryPointsPerDeveloper, teamVelocityAverage, teamCycleTimeAverage }
4. WHEN se serializa el Workload_Report a JSON, THE Workload_Analyzer SHALL representar las fechas en formato ISO 8601 (YYYY-MM-DDTHH:mm:ssZ)
5. THE Workload_Analyzer SHALL garantizar que el campo velocityIndividual sea un número no negativo y que cycleTimeIndividual sea un número no negativo o null para cada Developer_Metrics en el Workload_Report

### Requirement 9: Manejo de Errores de Integración

**User Story:** Como Product Owner, quiero recibir mensajes de error claros cuando el análisis falla, para que pueda entender qué salió mal y cómo corregirlo.

#### Acceptance Criteria

1. IF la conexión con Jira falla durante el análisis, THEN THE Workload_Analyzer SHALL retornar un error con código NETWORK_ERROR y el mensaje "Error de red al conectar con Jira. Verifica tu conexión e intenta de nuevo"
2. IF el proyecto especificado no existe en Jira, THEN THE Workload_Analyzer SHALL retornar un error con código JIRA_NOT_FOUND y el mensaje "El proyecto {projectKey} no fue encontrado en Jira"
3. IF el Developer autenticado no tiene permisos de lectura en el proyecto, THEN THE Workload_Analyzer SHALL retornar un error con código JIRA_PERMISSION_DENIED y el mensaje "No tienes permisos para leer el proyecto {projectKey}"
4. WHEN ocurre un error de red durante la consulta a Jira, THE Workload_Analyzer SHALL reintentar la consulta hasta 3 veces con espera exponencial (1s, 2s, 4s) antes de retornar el error NETWORK_ERROR
5. THE WorkloadView SHALL mostrar el mensaje de error recibido del Workload_Analyzer en un componente de alerta visible, con una opción para reintentar el análisis
