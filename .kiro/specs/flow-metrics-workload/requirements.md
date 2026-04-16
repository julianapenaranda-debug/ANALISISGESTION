# Requirements Document

## Introduction

Vista paralela de Flow Metrics basada en Lean Agile Flow Analytics para el análisis de carga de trabajo del equipo. Esta vista es independiente de la vista WorkloadView existente y proporciona métricas de flujo (Lead Time, Cycle Time, Throughput, WIP), análisis de eficiencia, detección de cuellos de botella y recomendaciones accionables. Toda la interfaz y textos en español. Los datos provienen exclusivamente del historial de issues de Jira (transiciones de estado vía `expand=changelog`).

## Glossary

- **Flow_Metrics_View**: Nueva vista React que muestra métricas de flujo Lean Agile. Accesible desde el ítem de navegación "Flow Metrics" en la barra principal de la aplicación.
- **Flow_Metrics_Analyzer**: Módulo backend que orquesta el cálculo de métricas de flujo a partir de issues de Jira con changelog.
- **Flow_Metrics_Calculator**: Módulo backend con funciones puras que calculan Lead Time, Cycle Time, Throughput, WIP, Flow Efficiency, tipología y alertas.
- **Lead_Time**: Tiempo en días calendario desde la creación del issue (campo `created`) hasta su resolución (campo `resolutiondate` o última transición a estado Done).
- **Cycle_Time**: Tiempo en días calendario desde la primera transición a un estado activo (In Progress/En Progreso) hasta la resolución del issue.
- **Throughput**: Cantidad de issues completados por período de tiempo, desglosado por tipo de issue.
- **WIP**: Cantidad de issues simultáneamente en estados activos por desarrollador en un momento dado.
- **Flow_Efficiency**: Porcentaje de tiempo que un issue pasa en estados activos (Touch Time) respecto al tiempo total (Touch Time + Wait Time).
- **Touch_Time**: Tiempo acumulado que un issue pasa en estados activos: In Progress, En Progreso, En Pruebas UAT.
- **Wait_Time**: Tiempo acumulado que un issue pasa en estados pasivos: Blocked, Bloqueado, Pendiente PAP, Waiting for Review.
- **Active_Statuses**: Conjunto de estados Jira que representan trabajo activo: "In Progress", "En Progreso", "En Pruebas UAT".
- **Passive_Statuses**: Conjunto de estados Jira que representan espera: "Blocked", "Bloqueado", "Pendiente PAP", "En Revisión", "Waiting for Review".
- **Done_Statuses**: Conjunto de estados Jira que representan completitud: "Done", "Producción", "Hecho", "Cerrado", "Resuelto".
- **Value_Work**: Issues de tipo Historia (HU), Spike, Upstream, Epic.
- **Support_Work**: Issues de tipo Service Request N2, Bug, Error Productivo, PQR, Incidente de Seguridad y Monitoreo, Requerimiento Caja.
- **Bottleneck**: Estado donde los issues pasan más del 40% de su Cycle Time.
- **Aging_Issue**: Issue que ha permanecido en un estado más tiempo que el promedio histórico del equipo para ese estado.
- **Flow_Metrics_Report**: Estructura de datos que contiene todas las métricas de flujo, análisis de eficiencia, alertas y recomendaciones para un proyecto.

## Requirements

### Requirement 1: Cálculo de Lead Time

**User Story:** Como Product Owner, quiero ver el Lead Time de cada issue completado, para entender cuánto tarda el equipo desde que se crea un item hasta que se entrega.

#### Acceptance Criteria

1. WHEN un issue tiene estado Done y fecha de resolución, THE Flow_Metrics_Calculator SHALL calcular el Lead_Time como la diferencia en días calendario entre el campo `created` y el campo `resolutiondate`.
2. WHEN un issue tiene estado Done pero no tiene `resolutiondate`, THE Flow_Metrics_Calculator SHALL calcular el Lead_Time usando la fecha de la última transición a un Done_Status registrada en el changelog.
3. WHEN un issue no tiene estado Done, THE Flow_Metrics_Calculator SHALL excluir ese issue del cálculo de Lead_Time.
4. THE Flow_Metrics_Calculator SHALL calcular el Lead_Time promedio del equipo agrupando todos los issues completados en el período seleccionado.
5. THE Flow_Metrics_View SHALL mostrar el Lead_Time promedio del equipo en días con un decimal de precisión.

### Requirement 2: Cálculo de Cycle Time

**User Story:** Como Product Owner, quiero ver el Cycle Time de cada issue, para medir cuánto tarda el equipo desde que empieza a trabajar hasta que termina.

#### Acceptance Criteria

1. WHEN un issue completado tiene al menos una transición a un Active_Status en su changelog, THE Flow_Metrics_Calculator SHALL calcular el Cycle_Time como la diferencia en días calendario entre la primera transición a Active_Status y la fecha de resolución.
2. WHEN un issue completado no tiene ninguna transición a Active_Status en su changelog, THE Flow_Metrics_Calculator SHALL excluir ese issue del cálculo de Cycle_Time.
3. THE Flow_Metrics_Calculator SHALL calcular el Cycle_Time promedio del equipo agrupando todos los issues completados con Cycle_Time válido en el período seleccionado.
4. THE Flow_Metrics_View SHALL mostrar el Cycle_Time promedio del equipo en días con un decimal de precisión.

### Requirement 3: Cálculo de Throughput

**User Story:** Como Product Owner, quiero ver el volumen de issues completados por período y tipo, para entender la capacidad de entrega del equipo.

#### Acceptance Criteria

1. THE Flow_Metrics_Calculator SHALL contar el número de issues completados (en Done_Statuses) dentro del período de tiempo seleccionado.
2. THE Flow_Metrics_Calculator SHALL desglosar el Throughput por tipo de issue: Historia, Sub-tarea, Bug, Error Productivo, Spike, Service Request N2, y otros tipos presentes.
3. THE Flow_Metrics_View SHALL mostrar el Throughput total y el desglose por tipo de issue en una tabla o gráfico de barras.
4. WHEN el usuario selecciona un rango de fechas, THE Flow_Metrics_Calculator SHALL calcular el Throughput únicamente para issues resueltos dentro de ese rango.

### Requirement 4: Visualización de WIP

**User Story:** Como Product Owner, quiero ver cuántos issues tiene cada desarrollador en progreso simultáneamente, para detectar sobrecarga y multitasking.

#### Acceptance Criteria

1. THE Flow_Metrics_Calculator SHALL contar el número de issues en Active_Statuses asignados a cada desarrollador al momento de la consulta.
2. THE Flow_Metrics_View SHALL mostrar el WIP por desarrollador en una tabla que incluya nombre del desarrollador y cantidad de issues activos.
3. THE Flow_Metrics_Calculator SHALL calcular el WIP total del equipo como la suma de todos los issues en Active_Statuses.
4. THE Flow_Metrics_View SHALL mostrar el WIP total del equipo como métrica resumen.

### Requirement 5: Cálculo de Flow Efficiency

**User Story:** Como Product Owner, quiero ver la eficiencia de flujo del equipo, para entender qué porcentaje del tiempo se dedica a trabajo activo versus espera.

#### Acceptance Criteria

1. THE Flow_Metrics_Calculator SHALL calcular el Touch_Time de cada issue completado sumando el tiempo en días que el issue pasó en Active_Statuses según las transiciones del changelog.
2. THE Flow_Metrics_Calculator SHALL calcular el Wait_Time de cada issue completado sumando el tiempo en días que el issue pasó en Passive_Statuses según las transiciones del changelog.
3. THE Flow_Metrics_Calculator SHALL calcular la Flow_Efficiency de cada issue como: Touch_Time / (Touch_Time + Wait_Time) × 100.
4. THE Flow_Metrics_Calculator SHALL calcular la Flow_Efficiency promedio del equipo agrupando todos los issues completados con Touch_Time y Wait_Time válidos.
5. THE Flow_Metrics_View SHALL mostrar la Flow_Efficiency promedio del equipo como porcentaje con un decimal de precisión.
6. IF el Touch_Time y el Wait_Time de un issue son ambos cero, THEN THE Flow_Metrics_Calculator SHALL excluir ese issue del cálculo de Flow_Efficiency.

### Requirement 6: Análisis de Tipología de Trabajo

**User Story:** Como Product Owner, quiero ver la distribución entre trabajo de valor y trabajo de soporte, para entender cómo se asigna la capacidad del equipo.

#### Acceptance Criteria

1. THE Flow_Metrics_Calculator SHALL clasificar cada issue como Value_Work o Support_Work según su tipo de issue.
2. THE Flow_Metrics_Calculator SHALL calcular el porcentaje de issues de Value_Work y Support_Work respecto al total de issues en el período.
3. THE Flow_Metrics_View SHALL mostrar la distribución de tipología como porcentajes y cantidades absolutas.
4. THE Flow_Metrics_View SHALL mostrar la distribución de tipología en un gráfico visual que permita comparar Value_Work versus Support_Work.

### Requirement 7: Detección de Cuellos de Botella

**User Story:** Como Product Owner, quiero que el sistema identifique automáticamente los estados donde los issues se estancan, para tomar acciones correctivas.

#### Acceptance Criteria

1. THE Flow_Metrics_Calculator SHALL calcular el porcentaje de Cycle_Time que cada issue completado pasó en cada estado según las transiciones del changelog.
2. WHEN un estado acumula más del 40% del Cycle_Time promedio de los issues completados, THE Flow_Metrics_Calculator SHALL identificar ese estado como Bottleneck.
3. THE Flow_Metrics_View SHALL mostrar cada Bottleneck detectado con el nombre del estado y el porcentaje de Cycle_Time que representa.
4. THE Flow_Metrics_View SHALL mostrar un mensaje descriptivo para cada Bottleneck, por ejemplo: "Los issues pasan el 45% del cycle time en 'En Pruebas UAT' — posible cuello de botella en testing".

### Requirement 8: Detección de Aging Issues

**User Story:** Como Product Owner, quiero ver qué issues llevan más tiempo del esperado en un estado, para intervenir antes de que se conviertan en bloqueos.

#### Acceptance Criteria

1. THE Flow_Metrics_Calculator SHALL calcular el tiempo promedio histórico que los issues del equipo pasan en cada estado, usando las transiciones del changelog de todos los issues completados.
2. WHEN un issue activo ha permanecido en su estado actual más tiempo que el promedio histórico del equipo para ese estado, THE Flow_Metrics_Calculator SHALL marcar ese issue como Aging_Issue.
3. THE Flow_Metrics_View SHALL mostrar la lista de Aging_Issues con la clave del issue, el estado actual, los días en ese estado y el promedio histórico del equipo para ese estado.

### Requirement 9: Recomendaciones Accionables

**User Story:** Como Product Owner, quiero recibir sugerencias automáticas basadas en las métricas de flujo, para saber qué acciones tomar para mejorar el rendimiento del equipo.

#### Acceptance Criteria

1. WHEN el porcentaje de Support_Work supera el 50% del total de issues, THE Flow_Metrics_Calculator SHALL generar una recomendación indicando el porcentaje y sugiriendo revisar la estabilidad del sistema.
2. WHEN el Wait_Time promedio en un estado específico supera 2 días, THE Flow_Metrics_Calculator SHALL generar una recomendación indicando el estado y el tiempo promedio de espera, sugiriendo acciones para reducirlo.
3. WHEN el WIP promedio por desarrollador supera 3 issues, THE Flow_Metrics_Calculator SHALL generar una recomendación sugiriendo limitar el WIP para mejorar el flujo.
4. THE Flow_Metrics_View SHALL mostrar las recomendaciones en una sección dedicada con texto descriptivo en español.
5. WHEN no se detectan problemas en las métricas, THE Flow_Metrics_View SHALL mostrar un mensaje indicando que no se encontraron observaciones relevantes.

### Requirement 10: API Backend para Flow Metrics

**User Story:** Como desarrollador frontend, quiero un endpoint API que devuelva todas las métricas de flujo calculadas, para consumirlas desde la vista Flow Metrics.

#### Acceptance Criteria

1. THE Flow_Metrics_Analyzer SHALL exponer un endpoint POST `/api/flow-metrics/analyze` que reciba `projectKey`, `credentialKey` y `filters` opcionales (sprint, startDate, endDate).
2. WHEN el endpoint recibe una solicitud válida, THE Flow_Metrics_Analyzer SHALL retornar un Flow_Metrics_Report con: Lead_Time promedio, Cycle_Time promedio, Throughput total y por tipo, WIP total y por desarrollador, Flow_Efficiency promedio, distribución de tipología, lista de Bottlenecks, lista de Aging_Issues y lista de recomendaciones.
3. IF las credenciales no se encuentran, THEN THE Flow_Metrics_Analyzer SHALL retornar un error HTTP 404 con mensaje descriptivo.
4. IF el proyecto no existe o no se tienen permisos, THEN THE Flow_Metrics_Analyzer SHALL retornar el código HTTP apropiado (404 o 403) con mensaje descriptivo.
5. THE Flow_Metrics_Analyzer SHALL reutilizar la función `fetchStoryIssues` existente del módulo `jira-connector` para obtener los issues con changelog.
6. THE Flow_Metrics_Analyzer SHALL construir una consulta JQL que incluya todos los tipos de issue (no solo Stories) para capturar la tipología completa del equipo.

### Requirement 11: Navegación e Integración en la Aplicación

**User Story:** Como usuario de PO AI, quiero acceder a la vista de Flow Metrics desde la barra de navegación principal, para analizar las métricas de flujo del equipo.

#### Acceptance Criteria

1. THE Flow_Metrics_View SHALL estar accesible como un nuevo ítem "Flow Metrics" en la barra de navegación principal de la aplicación, junto a los ítems existentes.
2. THE Flow_Metrics_View SHALL mantener el diseño visual de Seguros Bolívar: color primario #009056, fuente Roboto, y estilos consistentes con las vistas existentes.
3. THE Flow_Metrics_View SHALL incluir un formulario de filtros con campos para proyecto (projectKey), sprint opcional y rango de fechas opcional, consistente con el patrón de la vista WorkloadView existente.
4. THE Flow_Metrics_View SHALL mostrar un indicador de carga mientras se procesan las métricas.
5. THE Flow_Metrics_View SHALL mostrar todos los textos de la interfaz en español.
