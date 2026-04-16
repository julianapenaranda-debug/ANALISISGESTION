# Documento de Requerimientos — Integración Datadog con Support Agent

## Introducción

Esta funcionalidad extiende el Support Agent existente para que, además de analizar bugs de Jira, consulte la API de Datadog y obtenga hallazgos de observabilidad (logs de error, monitores con alertas, incidentes activos). El agente actúa como experto IA y para cada hallazgo sugiere dónde revisar, asigna un nivel de criticidad, y propone una posible solución. Los hallazgos de Datadog se integran en el plan de resolución junto con los bugs de Jira, permitiendo al PO y al equipo técnico priorizar esfuerzos con una visión unificada.

## Glosario

- **Support_Agent**: Módulo orquestador del backend (`support-agent.ts`) que coordina el flujo de análisis de bugs y generación de planes de resolución.
- **Datadog_Connector**: Módulo de integración (`datadog-connector.ts`) que gestiona autenticación y peticiones HTTPS a la API de Datadog.
- **Hallazgo_Datadog**: Un elemento de observabilidad obtenido de Datadog: log de error, monitor en alerta o incidente activo.
- **Plan_de_Resolución**: Estructura (`ResolutionPlan`) que agrupa bugs priorizados, métricas y sugerencias de resolución.
- **CredentialStore**: Almacén seguro de credenciales cifradas. Las credenciales de Datadog se almacenan con la clave `datadog-main`.
- **Criticidad_Sugerida**: Nivel de criticidad asignado por el agente IA a un hallazgo: `critical`, `high`, `medium` o `low`.
- **Servicio_Datadog**: Nombre de servicio o plataforma registrado en Datadog (tag `service`) que el usuario puede seleccionar para acotar el análisis.
- **SupportView**: Componente React del frontend que presenta el flujo de análisis del Support Agent.
- **Monitor_Datadog**: Regla de monitoreo configurada en Datadog que puede estar en estado de alerta (`Alert`, `Warn`).
- **Incidente_Datadog**: Incidente activo registrado en la API de incidentes de Datadog (v2).
- **Propuesta_de_Issue**: Issue de Jira pre-llenado que el agente sugiere crear a partir de un hallazgo de Datadog sin bug correlacionado. Requiere autorización explícita del PO para ser creado.

## Requerimientos

### Requerimiento 1: Obtención de hallazgos de observabilidad desde Datadog

**Historia de Usuario:** Como miembro del equipo técnico, quiero que el Support Agent consulte Datadog para obtener hallazgos de observabilidad, de modo que pueda identificar problemas que no están reportados como bugs en Jira.

#### Criterios de Aceptación

1. WHEN el usuario inicia un análisis con Datadog habilitado, THE Support_Agent SHALL recuperar las credenciales de Datadog desde el CredentialStore usando la clave `datadog-main`.
2. WHEN las credenciales de Datadog son válidas, THE Support_Agent SHALL consultar la API de logs de Datadog (`GET /api/v1/logs`) para obtener logs con nivel `error` del período de las últimas 24 horas.
3. WHEN las credenciales de Datadog son válidas, THE Support_Agent SHALL consultar la API de monitores de Datadog (`GET /api/v1/monitor`) para obtener monitores en estado `Alert` o `Warn`.
4. WHEN las credenciales de Datadog son válidas, THE Support_Agent SHALL consultar la API de incidentes de Datadog (`GET /api/v2/incidents`) para obtener incidentes con estado activo.
5. IF las credenciales de Datadog no existen o son inválidas, THEN THE Support_Agent SHALL omitir la consulta a Datadog y continuar el análisis solo con los bugs de Jira, registrando una advertencia en la respuesta.
6. IF una llamada a la API de Datadog falla por error de red o timeout, THEN THE Support_Agent SHALL registrar el error en la respuesta y continuar el análisis con los datos disponibles.

### Requerimiento 2: Listado de servicios disponibles en Datadog

**Historia de Usuario:** Como usuario del frontend, quiero ver una lista de los servicios (tags `service`) disponibles en Datadog, de modo que pueda seleccionar cuál analizar y acotar los resultados.

#### Criterios de Aceptación

1. WHEN el usuario accede a la vista de Support Agent con Datadog conectado, THE SupportView SHALL solicitar al backend la lista de servicios disponibles en Datadog.
2. WHEN el backend recibe una solicitud de listado de servicios, THE Support_Agent SHALL consultar los monitores y logs de Datadog para extraer los valores únicos del tag `service`.
3. THE SupportView SHALL presentar la lista de servicios como opciones seleccionables en la interfaz.
4. WHEN el usuario selecciona un servicio, THE SupportView SHALL enviar el nombre del servicio como filtro en la solicitud de análisis.
5. WHEN el usuario no selecciona ningún servicio, THE Support_Agent SHALL analizar hallazgos de todos los servicios disponibles.

### Requerimiento 3: Análisis experto de hallazgos de Datadog

**Historia de Usuario:** Como PO o miembro del equipo técnico, quiero que el agente IA analice cada hallazgo de Datadog y sugiera por dónde revisar, el nivel de criticidad y una posible solución, de modo que pueda enfocar mis esfuerzos de resolución.

#### Criterios de Aceptación

1. WHEN el Support_Agent obtiene un hallazgo de Datadog, THE Support_Agent SHALL asignar una Criticidad_Sugerida (`critical`, `high`, `medium` o `low`) basada en el tipo de hallazgo, la frecuencia de ocurrencia y el estado del monitor o incidente.
2. WHEN el Support_Agent analiza un hallazgo, THE Support_Agent SHALL identificar el servicio, endpoint o componente afectado a partir de los tags y metadatos del hallazgo.
3. WHEN el Support_Agent analiza un hallazgo, THE Support_Agent SHALL generar una sugerencia de resolución que incluya pasos técnicos concretos para investigar y resolver el problema.
4. THE Support_Agent SHALL etiquetar cada sugerencia generada a partir de hallazgos de Datadog con el texto "Sugerencia del Agente IA Support".
5. WHEN un monitor de Datadog está en estado `Alert`, THE Support_Agent SHALL asignar una Criticidad_Sugerida de `critical` o `high` según el tipo de monitor.
6. WHEN un incidente de Datadog tiene severidad `SEV-1` o `SEV-2`, THE Support_Agent SHALL asignar una Criticidad_Sugerida de `critical`.

### Requerimiento 4: Integración de hallazgos de Datadog en el Plan de Resolución

**Historia de Usuario:** Como PO, quiero que los hallazgos de Datadog se integren en el plan de resolución junto con los bugs de Jira, de modo que tenga una visión unificada de todos los problemas del proyecto.

#### Criterios de Aceptación

1. THE Plan_de_Resolución SHALL incluir una sección dedicada a los hallazgos de Datadog, separada de los bugs de Jira.
2. WHEN el plan de resolución contiene hallazgos de Datadog, THE Plan_de_Resolución SHALL incluir métricas específicas de Datadog: total de hallazgos, distribución por criticidad sugerida y distribución por tipo de hallazgo (log, monitor, incidente).
3. THE Plan_de_Resolución SHALL ordenar los hallazgos de Datadog por Criticidad_Sugerida de mayor a menor.
4. WHEN el plan de resolución se exporta a Markdown, THE Plan_de_Resolución SHALL incluir la sección de hallazgos de Datadog con el formato consistente al de los bugs de Jira.
5. THE Plan_de_Resolución SHALL incluir un resumen ejecutivo que combine la información de bugs de Jira y hallazgos de Datadog.

### Requerimiento 5: Endpoint de análisis con Datadog

**Historia de Usuario:** Como desarrollador del frontend, quiero un endpoint que permita solicitar un análisis combinado de Jira y Datadog, de modo que pueda integrar la funcionalidad en la interfaz.

#### Criterios de Aceptación

1. WHEN el frontend envía una solicitud POST a `/api/support/analyze` con el campo `includeDatadog` en `true`, THE Support_Agent SHALL ejecutar el análisis combinado de Jira y Datadog.
2. WHEN el frontend envía una solicitud POST a `/api/support/analyze` con el campo `datadogService` especificado, THE Support_Agent SHALL filtrar los hallazgos de Datadog al servicio indicado.
3. THE Support_Agent SHALL retornar el Plan_de_Resolución con la estructura extendida que incluye tanto bugs de Jira como hallazgos de Datadog.
4. IF el campo `includeDatadog` no está presente o es `false`, THEN THE Support_Agent SHALL ejecutar el análisis solo con bugs de Jira, manteniendo compatibilidad con el flujo existente.
5. WHEN el backend recibe una solicitud GET a `/api/support/datadog/services`, THE Support_Agent SHALL retornar la lista de servicios disponibles en Datadog.

### Requerimiento 6: Interfaz de usuario para análisis con Datadog

**Historia de Usuario:** Como usuario del frontend, quiero controles en la vista de Support Agent para habilitar el análisis de Datadog y seleccionar un servicio, de modo que pueda obtener un análisis combinado.

#### Criterios de Aceptación

1. WHILE Datadog está conectado (estado `connected` en el store), THE SupportView SHALL mostrar un toggle para habilitar el análisis de Datadog.
2. WHILE el toggle de Datadog está habilitado, THE SupportView SHALL mostrar un selector desplegable con los servicios disponibles en Datadog.
3. WHEN el usuario hace clic en "Analizar Bugs" con el toggle de Datadog habilitado, THE SupportView SHALL enviar la solicitud con `includeDatadog: true` y el servicio seleccionado (si aplica).
4. WHILE el análisis combinado está en progreso, THE SupportView SHALL mostrar un indicador de carga que mencione "Analizando bugs en Jira y hallazgos en Datadog...".
5. WHEN el plan de resolución contiene hallazgos de Datadog, THE SupportView SHALL mostrar una sección separada con los hallazgos, cada uno con su criticidad sugerida, servicio afectado y sugerencia de resolución.
6. THE SupportView SHALL mostrar la etiqueta "Sugerencia del Agente IA Support" en cada hallazgo de Datadog analizado.

### Requerimiento 7: Correlación entre hallazgos de Datadog y bugs de Jira

**Historia de Usuario:** Como miembro del equipo técnico, quiero que el agente identifique posibles correlaciones entre hallazgos de Datadog y bugs de Jira, de modo que pueda entender si un error de observabilidad ya está reportado.

#### Criterios de Aceptación

1. WHEN el Support_Agent tiene tanto bugs de Jira como hallazgos de Datadog, THE Support_Agent SHALL comparar los mensajes de error de los logs de Datadog con los títulos y descripciones de los bugs de Jira para detectar coincidencias textuales.
2. WHEN el Support_Agent detecta una coincidencia entre un hallazgo de Datadog y un bug de Jira, THE Support_Agent SHALL vincular ambos elementos en el plan de resolución indicando el ID del bug correlacionado.
3. WHEN un hallazgo de Datadog no tiene correlación con ningún bug de Jira, THE Support_Agent SHALL marcarlo como "Hallazgo sin bug reportado" en el plan de resolución.
4. THE Plan_de_Resolución SHALL incluir un conteo de hallazgos correlacionados y no correlacionados en las métricas.

### Requerimiento 8: Propuesta de creación de issues en Jira desde hallazgos de Datadog

**Historia de Usuario:** Como PO, quiero que el agente me proponga crear un issue en Jira para cada hallazgo de Datadog que no tenga un bug correlacionado, de modo que pueda decidir si lo registro formalmente sin que se cree automáticamente.

#### Criterios de Aceptación

1. WHEN un hallazgo de Datadog está marcado como "Hallazgo sin bug reportado", THE Support_Agent SHALL generar una propuesta de issue de Jira con título, descripción, severidad sugerida y componente afectado, pre-llenados a partir del análisis del hallazgo.
2. THE SupportView SHALL mostrar un botón "Crear Issue en Jira" junto a cada hallazgo sin bug correlacionado, claramente diferenciado como acción opcional.
3. WHEN el PO hace clic en "Crear Issue en Jira", THE SupportView SHALL mostrar un diálogo de confirmación con los datos pre-llenados del issue propuesto, permitiendo al PO editar título, descripción y severidad antes de confirmar.
4. WHEN el PO confirma la creación del issue, THE Support_Agent SHALL crear el issue en Jira usando las credenciales almacenadas y el proyecto seleccionado, y retornar el enlace al issue creado.
5. IF el PO cancela el diálogo de confirmación, THEN THE Support_Agent SHALL NO crear ningún issue en Jira.
6. THE Support_Agent SHALL NUNCA crear issues en Jira de forma automática sin la autorización explícita del PO a través del diálogo de confirmación.
