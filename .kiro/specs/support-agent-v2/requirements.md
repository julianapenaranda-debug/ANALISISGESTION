# Documento de Requerimientos — Support Agent V2

## Introducción

Support Agent V2 es una reescritura del módulo Support Agent existente para que funcione de forma independiente de Jira, usando Datadog como fuente principal de hallazgos. El flujo principal permite al usuario listar servicios disponibles en Datadog, seleccionar uno o varios para analizar, y obtener hallazgos priorizados por severidad con causa raíz probable y sugerencia de corrección generadas por LLM (Gemini). Opcionalmente, si Jira está conectado, el PO puede crear issues desde cualquier hallazgo con confirmación previa.

## Glosario

- **Support_Agent_V2**: Módulo backend que orquesta la consulta a Datadog, el análisis con LLM y la presentación de resultados priorizados.
- **DatadogConnector**: Módulo de integración existente que realiza peticiones autenticadas a la API de Datadog (fetchErrorLogs, fetchAlertingMonitors, fetchActiveIncidents, fetchAvailableServices, fetchDatadogFindings).
- **LLM_Client**: Módulo existente (llm-client.ts) que expone callLLM() para invocar al proveedor LLM configurado (Gemini por defecto).
- **Findings_Analyzer**: Módulo existente (datadog-findings-analyzer.ts) que analiza hallazgos de Datadog con LLM y fallback heurístico.
- **CredentialStore**: Almacén de credenciales existente. Las credenciales de Datadog se almacenan con la clave 'datadog-main'.
- **SupportView_V2**: Componente frontend (React) que presenta la interfaz del Support Agent V2.
- **Hallazgo**: Un error de log, monitor en alerta o incidente activo detectado en Datadog.
- **Hallazgo_Analizado**: Un Hallazgo enriquecido con criticidad sugerida, causa raíz probable, sugerencia de corrección y etiqueta del agente.
- **Buscador_Predictivo**: Campo de texto con filtrado en tiempo real sobre la lista de servicios de Datadog.
- **PO**: Product Owner, usuario principal del sistema.

## Requerimientos

### Requerimiento 1: Listado de servicios de Datadog

**User Story:** Como PO, quiero ver la lista de servicios/aplicaciones disponibles en Datadog, para poder seleccionar cuáles analizar.

#### Criterios de Aceptación

1. WHEN el PO accede a SupportView_V2, THE Support_Agent_V2 SHALL consultar los servicios disponibles mediante DatadogConnector.fetchAvailableServices y presentar la lista en SupportView_V2.
2. THE SupportView_V2 SHALL mostrar un Buscador_Predictivo que filtre la lista de servicios en tiempo real conforme el PO escribe.
3. THE SupportView_V2 SHALL permitir al PO seleccionar uno o varios servicios de la lista mediante checkboxes.
4. IF DatadogConnector.fetchAvailableServices retorna una lista vacía, THEN THE SupportView_V2 SHALL mostrar el mensaje "No se encontraron servicios en Datadog".
5. IF la consulta de servicios falla por error de red o permisos, THEN THE SupportView_V2 SHALL mostrar un mensaje de error descriptivo.

### Requerimiento 2: Verificación de conexión con Datadog

**User Story:** Como PO, quiero que el sistema me indique si Datadog no está conectado, para poder configurar la conexión antes de usar el agente.

#### Criterios de Aceptación

1. WHEN el PO accede a SupportView_V2 y el estado de conexión de Datadog es 'disconnected', THE SupportView_V2 SHALL mostrar un mensaje indicando que se requiere conexión con Datadog y un enlace para navegar a la vista de Conexiones.
2. WHILE el estado de conexión de Datadog es 'disconnected', THE SupportView_V2 SHALL ocultar el formulario de selección de servicios y el botón "Analizar".

### Requerimiento 3: Análisis de hallazgos por servicio

**User Story:** Como PO, quiero analizar los hallazgos de Datadog para los servicios seleccionados, para obtener un diagnóstico priorizado con causa raíz y sugerencia de corrección.

#### Criterios de Aceptación

1. WHEN el PO selecciona uno o varios servicios y presiona el botón "Analizar", THE Support_Agent_V2 SHALL consultar DatadogConnector para obtener logs de error, monitores en alerta e incidentes activos para cada servicio seleccionado.
2. WHEN los hallazgos son obtenidos, THE Findings_Analyzer SHALL analizar cada Hallazgo con el LLM_Client para determinar: criticidad sugerida (critical, high, medium, low), causa raíz probable, y sugerencia de corrección concreta.
3. IF el LLM_Client no está disponible o falla, THEN THE Findings_Analyzer SHALL aplicar el análisis heurístico de fallback existente.
4. THE Support_Agent_V2 SHALL ordenar los Hallazgos_Analizados por criticidad de mayor a menor (critical > high > medium > low).
5. THE Support_Agent_V2 SHALL etiquetar cada sugerencia con el texto "Sugerencia del Agente IA Support".
6. IF no se encuentran hallazgos para los servicios seleccionados, THEN THE SupportView_V2 SHALL mostrar el mensaje "No se encontraron hallazgos para los servicios seleccionados".

### Requerimiento 4: Presentación de resultados

**User Story:** Como PO, quiero ver los resultados del análisis priorizados por severidad, para poder tomar decisiones informadas sobre qué resolver primero.

#### Criterios de Aceptación

1. THE SupportView_V2 SHALL presentar los Hallazgos_Analizados agrupados y ordenados por criticidad (critical, high, medium, low).
2. THE SupportView_V2 SHALL mostrar para cada Hallazgo_Analizado: título, tipo de hallazgo (log, monitor, incidente), servicio afectado, criticidad con indicador visual (🔴 critical, 🟠 high, 🟡 medium, 🟢 low), causa raíz probable y sugerencia de corrección.
3. THE SupportView_V2 SHALL mostrar un panel de métricas resumen con: total de hallazgos, distribución por tipo (logs, monitores, incidentes) y distribución por criticidad.
4. WHEN el PO presiona "Ver detalle" en un Hallazgo_Analizado, THE SupportView_V2 SHALL expandir la tarjeta mostrando los pasos de resolución, endpoint afectado (si aplica) y la etiqueta "Sugerencia del Agente IA Support".

### Requerimiento 5: Creación opcional de issues en Jira

**User Story:** Como PO, quiero poder crear un issue en Jira desde cualquier hallazgo analizado, para registrar formalmente los problemas detectados.

#### Criterios de Aceptación

1. WHILE el estado de conexión de Jira es 'connected', THE SupportView_V2 SHALL mostrar un botón "Crear Issue en Jira" en cada tarjeta de Hallazgo_Analizado.
2. WHILE el estado de conexión de Jira es 'disconnected', THE SupportView_V2 SHALL ocultar el botón "Crear Issue en Jira" en todas las tarjetas.
3. WHEN el PO presiona "Crear Issue en Jira", THE SupportView_V2 SHALL mostrar un modal de confirmación con los campos editables: título, descripción, severidad y componente, pre-rellenados con los datos del Hallazgo_Analizado.
4. WHEN el PO confirma la creación en el modal, THE Support_Agent_V2 SHALL crear el issue en Jira mediante el endpoint existente y mostrar confirmación con la clave del issue creado.
5. IF la creación del issue falla, THEN THE SupportView_V2 SHALL mostrar un mensaje de error descriptivo en el modal sin cerrarlo.
6. WHEN un issue ha sido creado exitosamente para un hallazgo, THE SupportView_V2 SHALL mostrar un indicador visual en la tarjeta del hallazgo con la clave del issue creado y deshabilitar el botón "Crear Issue en Jira" para ese hallazgo.

### Requerimiento 6: Endpoint backend para análisis V2

**User Story:** Como desarrollador, quiero un endpoint dedicado para el flujo de análisis V2 basado en Datadog, para separar la lógica del flujo anterior basado en Jira.

#### Criterios de Aceptación

1. THE Support_Agent_V2 SHALL exponer un endpoint POST /api/support-v2/analyze que reciba un array de nombres de servicio y retorne los Hallazgos_Analizados priorizados.
2. IF el array de servicios está vacío o no se proporciona, THEN THE Support_Agent_V2 SHALL retornar un error 400 con mensaje descriptivo.
3. IF las credenciales de Datadog no se encuentran en CredentialStore con clave 'datadog-main', THEN THE Support_Agent_V2 SHALL retornar un error 404 con mensaje "Credenciales de Datadog no encontradas".
4. THE Support_Agent_V2 SHALL retornar la respuesta en formato JSON con la estructura: { findings: Hallazgo_Analizado[], metrics: { totalFindings, distributionByType, distributionByCriticality } }.

### Requerimiento 7: Selección múltiple de servicios

**User Story:** Como PO, quiero poder seleccionar y deseleccionar servicios fácilmente, para analizar exactamente los que necesito.

#### Criterios de Aceptación

1. THE SupportView_V2 SHALL mostrar un botón "Seleccionar todos" que marque todos los servicios visibles (filtrados por el Buscador_Predictivo).
2. THE SupportView_V2 SHALL mostrar un botón "Deseleccionar todos" que desmarque todos los servicios seleccionados.
3. THE SupportView_V2 SHALL mostrar un contador con el número de servicios seleccionados junto al botón "Analizar".
4. WHILE no hay servicios seleccionados, THE SupportView_V2 SHALL deshabilitar el botón "Analizar".

### Requerimiento 8: Estado de carga y feedback visual

**User Story:** Como PO, quiero ver indicadores de progreso durante el análisis, para saber que el sistema está trabajando.

#### Criterios de Aceptación

1. WHILE el Support_Agent_V2 está consultando servicios de Datadog, THE SupportView_V2 SHALL mostrar un indicador de carga con el texto "Cargando servicios...".
2. WHILE el Support_Agent_V2 está analizando hallazgos, THE SupportView_V2 SHALL mostrar un indicador de carga con el texto "Analizando hallazgos de Datadog...".
3. WHEN el análisis finaliza exitosamente, THE SupportView_V2 SHALL mostrar un botón "Nuevo análisis" que permita al PO regresar a la pantalla de selección de servicios.
