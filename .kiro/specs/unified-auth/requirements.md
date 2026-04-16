# Documento de Requerimientos — Panel de Conexiones (Autenticación Unificada)

## Introducción

El Panel de Conexiones es una funcionalidad que centraliza la configuración de credenciales para los servicios externos integrados en PO AI (Jira, Figma, Datadog). Actualmente, el usuario debe ingresar credenciales de Jira cada vez que entra a la vista Jira. Este feature permite configurar cada servicio una sola vez, persistir las credenciales encriptadas en el backend (usando el CredentialStore existente con AES-256-GCM), y que todas las vistas del frontend consuman automáticamente las credenciales guardadas sin volver a pedirlas.

## Glosario

- **Panel_de_Conexiones**: Vista del frontend donde el usuario configura y gestiona las conexiones a servicios externos (Jira, Figma, Datadog).
- **CredentialStore**: Módulo del backend que persiste credenciales encriptadas con AES-256-GCM en disco (`~/.po-ai/credentials.json`).
- **Servicio_Externo**: Cualquiera de los tres servicios integrados: Jira, Figma o Datadog.
- **Estado_de_Conexión**: Indicador que refleja si un Servicio_Externo tiene credenciales válidas almacenadas. Valores posibles: `connected`, `disconnected`, `error`.
- **Credential_Key**: Identificador único usado por el CredentialStore para almacenar y recuperar credenciales de un Servicio_Externo específico (ej: `jira-main`, `figma-main`, `datadog-main`).
- **API_de_Conexiones**: Conjunto de endpoints REST del backend que gestionan el ciclo de vida de las credenciales (guardar, verificar, eliminar, listar estado).
- **AppStore**: Store global de Zustand en el frontend que mantiene el estado de la aplicación, incluyendo el estado de conexiones.

## Requerimientos

### Requerimiento 1: Almacenamiento Genérico de Credenciales

**User Story:** Como desarrollador del backend, quiero que el CredentialStore soporte credenciales de cualquier servicio externo (no solo Jira), para que se puedan persistir credenciales de Figma y Datadog con el mismo mecanismo de encriptación.

#### Criterios de Aceptación

1. THE CredentialStore SHALL almacenar credenciales como objetos JSON arbitrarios asociados a una Credential_Key.
2. THE CredentialStore SHALL encriptar todas las credenciales con AES-256-GCM independientemente del Servicio_Externo.
3. WHEN se almacenan credenciales con una Credential_Key que ya existe, THE CredentialStore SHALL reemplazar las credenciales anteriores con las nuevas.
4. WHEN se solicitan credenciales con una Credential_Key inexistente, THE CredentialStore SHALL retornar null.

### Requerimiento 2: API REST de Gestión de Conexiones

**User Story:** Como frontend, quiero endpoints REST para guardar, verificar, eliminar y consultar el estado de las conexiones, para que el Panel_de_Conexiones pueda gestionar las credenciales de cada servicio.

#### Criterios de Aceptación

1. WHEN el frontend envía credenciales de Jira al endpoint POST `/api/connections/jira`, THE API_de_Conexiones SHALL validar las credenciales contra la API de Jira, almacenarlas en el CredentialStore con la Credential_Key `jira-main` si son válidas, y retornar el Estado_de_Conexión resultante.
2. WHEN el frontend envía un accessToken de Figma al endpoint POST `/api/connections/figma`, THE API_de_Conexiones SHALL validar el token contra la API de Figma, almacenarlo en el CredentialStore con la Credential_Key `figma-main` si es válido, y retornar el Estado_de_Conexión resultante.
3. WHEN el frontend envía apiKey, appKey y site de Datadog al endpoint POST `/api/connections/datadog`, THE API_de_Conexiones SHALL validar las credenciales contra la API de Datadog, almacenarlas en el CredentialStore con la Credential_Key `datadog-main` si son válidas, y retornar el Estado_de_Conexión resultante.
4. WHEN el frontend solicita GET `/api/connections/status`, THE API_de_Conexiones SHALL retornar el Estado_de_Conexión de cada Servicio_Externo (`connected` o `disconnected`).
5. WHEN el frontend solicita DELETE `/api/connections/:service`, THE API_de_Conexiones SHALL eliminar las credenciales del Servicio_Externo indicado del CredentialStore y retornar el Estado_de_Conexión actualizado.
6. IF las credenciales enviadas son inválidas (autenticación fallida), THEN THE API_de_Conexiones SHALL retornar un código HTTP 401 con un mensaje descriptivo del error sin almacenar las credenciales.

### Requerimiento 3: Validación de Credenciales por Servicio

**User Story:** Como usuario, quiero que el sistema verifique que mis credenciales son correctas antes de guardarlas, para no almacenar credenciales inválidas.

#### Criterios de Aceptación

1. WHEN se reciben credenciales de Jira, THE API_de_Conexiones SHALL invocar el endpoint `/rest/api/3/myself` de Jira para verificar la autenticación.
2. WHEN se recibe un accessToken de Figma, THE API_de_Conexiones SHALL invocar el endpoint `GET /v1/me` de la API de Figma para verificar la autenticación.
3. WHEN se reciben apiKey y appKey de Datadog, THE API_de_Conexiones SHALL invocar el endpoint `GET /api/v1/validate` de la API de Datadog para verificar la autenticación.
4. IF la validación de credenciales falla por un error de red, THEN THE API_de_Conexiones SHALL retornar un código HTTP 502 con el mensaje "No se pudo conectar con el servicio. Verifica tu conexión de red."

### Requerimiento 4: Panel de Conexiones en el Frontend

**User Story:** Como usuario de PO AI, quiero un panel visual donde pueda ver el estado de cada servicio y configurar mis credenciales una sola vez, para no tener que ingresarlas cada vez que uso una funcionalidad.

#### Criterios de Aceptación

1. THE Panel_de_Conexiones SHALL mostrar una tarjeta por cada Servicio_Externo (Jira, Figma, Datadog) con su Estado_de_Conexión actual.
2. WHEN el Estado_de_Conexión de un Servicio_Externo es `disconnected`, THE Panel_de_Conexiones SHALL mostrar un formulario con los campos requeridos para ese servicio (Jira: baseUrl, email, apiToken; Figma: accessToken; Datadog: apiKey, appKey, site).
3. WHEN el Estado_de_Conexión de un Servicio_Externo es `connected`, THE Panel_de_Conexiones SHALL mostrar un indicador visual verde y un botón "Desconectar".
4. WHEN el usuario envía el formulario de conexión, THE Panel_de_Conexiones SHALL mostrar un indicador de carga mientras se validan las credenciales.
5. WHEN la validación de credenciales es exitosa, THE Panel_de_Conexiones SHALL actualizar el Estado_de_Conexión a `connected` y ocultar el formulario.
6. IF la validación de credenciales falla, THEN THE Panel_de_Conexiones SHALL mostrar el mensaje de error retornado por la API_de_Conexiones junto al formulario.
7. WHEN el usuario presiona "Desconectar", THE Panel_de_Conexiones SHALL invocar DELETE `/api/connections/:service` y actualizar el Estado_de_Conexión a `disconnected`.

### Requerimiento 5: Persistencia del Estado de Conexión en el Frontend

**User Story:** Como usuario, quiero que al recargar la página el sistema recuerde qué servicios ya están conectados, para no tener que volver a configurarlos.

#### Criterios de Aceptación

1. WHEN la aplicación se carga por primera vez, THE AppStore SHALL consultar GET `/api/connections/status` para obtener el Estado_de_Conexión de cada Servicio_Externo.
2. THE AppStore SHALL almacenar el Estado_de_Conexión de cada Servicio_Externo en el store global de Zustand.
3. WHILE el Estado_de_Conexión de un Servicio_Externo es `connected`, THE AppStore SHALL proveer la Credential_Key correspondiente a cualquier vista que la necesite.
4. WHEN el Estado_de_Conexión cambia (conexión o desconexión), THE AppStore SHALL actualizar el estado inmediatamente sin requerir recarga de página.

### Requerimiento 6: Consumo Automático de Credenciales en Vistas Existentes

**User Story:** Como usuario, quiero que las vistas de Jira, Métricas, Support Agent y Workload usen automáticamente las credenciales guardadas, para no tener que ingresarlas en cada vista.

#### Criterios de Aceptación

1. WHILE el Estado_de_Conexión de Jira es `connected`, THE JiraView SHALL omitir el formulario de conexión y cargar directamente la lista de proyectos usando la Credential_Key `jira-main`.
2. WHILE el Estado_de_Conexión de Jira es `disconnected`, THE JiraView SHALL mostrar un mensaje indicando que se debe configurar Jira desde el Panel_de_Conexiones, con un enlace para navegar a dicho panel.
3. WHILE el Estado_de_Conexión de Jira es `connected`, THE MetricsView, SupportView y WorkloadView SHALL usar la Credential_Key `jira-main` automáticamente para sus operaciones sin solicitar credenciales al usuario.
4. WHILE el Estado_de_Conexión de Figma es `connected`, THE GenerateView SHALL usar la Credential_Key `figma-main` para análisis de diseños de Figma sin solicitar credenciales al usuario.

### Requerimiento 7: Navegación al Panel de Conexiones

**User Story:** Como usuario, quiero acceder al Panel de Conexiones desde la barra de navegación principal, para poder gestionar mis conexiones en cualquier momento.

#### Criterios de Aceptación

1. THE App SHALL incluir un elemento "Conexiones" en la barra de navegación principal junto a los elementos existentes (Generar, Historias, Jira, etc.).
2. WHEN el usuario hace clic en "Conexiones", THE App SHALL mostrar el Panel_de_Conexiones.
3. WHEN al menos un Servicio_Externo tiene Estado_de_Conexión `disconnected`, THE App SHALL mostrar un indicador visual (punto de notificación) en el elemento "Conexiones" de la barra de navegación.

### Requerimiento 8: Integración con API de Figma

**User Story:** Como usuario, quiero que la conexión con Figma use la API real en lugar de datos mock, para poder analizar mis diseños reales.

#### Criterios de Aceptación

1. WHEN se proporciona una URL de Figma y el Estado_de_Conexión de Figma es `connected`, THE figma-analyzer SHALL usar el accessToken almacenado para invocar la API real de Figma (`GET /v1/files/:fileKey`).
2. THE figma-analyzer SHALL parsear la respuesta de la API de Figma y extraer componentes, pantallas e interacciones del documento.
3. IF la API de Figma retorna un error 403, THEN THE figma-analyzer SHALL retornar un error con el mensaje "Token de Figma sin permisos para acceder a este archivo."
4. IF la API de Figma retorna un error 404, THEN THE figma-analyzer SHALL retornar un error con el mensaje "Archivo de Figma no encontrado. Verifica la URL."

### Requerimiento 9: Integración con API de Datadog

**User Story:** Como usuario, quiero conectar Datadog para poder visualizar métricas de infraestructura y aplicación en PO AI.

#### Criterios de Aceptación

1. WHEN el Estado_de_Conexión de Datadog es `connected`, THE API_de_Conexiones SHALL permitir consultar métricas de Datadog usando las credenciales almacenadas.
2. THE Datadog_Connector SHALL enviar las cabeceras `DD-API-KEY` y `DD-APPLICATION-KEY` en cada petición a la API de Datadog.
3. THE Datadog_Connector SHALL construir la URL base usando el campo `site` proporcionado por el usuario (ej: `https://api.datadoghq.com` o `https://api.datadoghq.eu`).
4. IF la API de Datadog retorna un error 403, THEN THE Datadog_Connector SHALL retornar un error con el mensaje "Credenciales de Datadog inválidas o sin permisos suficientes."
