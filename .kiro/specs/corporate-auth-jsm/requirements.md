# Documento de Requerimientos

## Introducción

Este documento define los requerimientos para tres ajustes incrementales al sistema PO AI: (1) autenticación corporativa con Google Sign-In como mecanismo principal de acceso al frontend, con verificación de token en el backend; (2) extensión del Support Agent para incluir tickets de Jira Service Management (Incident y Problem) además de los bugs existentes; (3) filtro de proyectos por prefijo de clave "GD" y rango de fechas 2025-2026.

## Glosario

- **Sistema_Frontend**: Aplicación React (Vite + Zustand) que sirve como interfaz de usuario del sistema PO AI.
- **Sistema_Backend**: Servidor Express (puerto 3001) que expone la API REST del sistema PO AI.
- **Auth_Middleware**: Middleware Express que verifica tokens de Google en cada request protegido.
- **Auth_Store**: Estado de autenticación gestionado por Zustand en el frontend (googleUser, isAuthenticated).
- **AuthGuard**: Componente React que bloquea el acceso a la aplicación si el usuario no está autenticado.
- **Google_Identity_Services**: Servicio externo de Google para autenticación OAuth (ID tokens JWT).
- **JQL_Builder**: Función que construye la query JQL para buscar issues en Jira.
- **Jira_Connector**: Módulo `jira-connector.ts` que gestiona la comunicación con la API REST de Jira v3.
- **Support_Agent**: Módulo `support-agent.ts` que orquesta el flujo de análisis de bugs.
- **BugIssue**: Modelo de datos que representa un issue de tipo Bug, Incident o Problem obtenido de Jira.
- **JSM**: Jira Service Management, extensión de Jira que gestiona tickets de tipo Incident y Problem.
- **Prefijo_GD**: Prefijo de clave de proyecto Jira ("GD") usado para filtrar proyectos por tribu.
- **ID_Token**: Token JWT emitido por Google Identity Services que contiene la identidad del usuario.

## Requerimientos

### Requerimiento 1: Autenticación con Google Sign-In en el Frontend

**User Story:** Como usuario corporativo, quiero iniciar sesión con mi cuenta de Google, para que solo usuarios autenticados accedan al sistema PO AI.

#### Criterios de Aceptación

1. WHEN el usuario abre la aplicación sin sesión activa, THEN el Sistema_Frontend SHALL mostrar únicamente la pantalla de login con el botón de Google Sign-In.
2. WHEN el usuario hace click en "Iniciar sesión con Google" y Google retorna un credential válido, THEN el Sistema_Frontend SHALL enviar el ID_Token al Sistema_Backend para verificación.
3. WHEN el Sistema_Backend retorna los datos del usuario verificado, THEN el Auth_Store SHALL almacenar el googleUser y establecer isAuthenticated en true, persistiendo la sesión en localStorage.
4. WHEN el Auth_Store tiene isAuthenticated en true, THEN el AuthGuard SHALL permitir el acceso al App Shell con todas las vistas de la aplicación.
5. WHEN el Auth_Store tiene isAuthenticated en false, THEN el AuthGuard SHALL renderizar exclusivamente la pantalla de login, bloqueando el acceso a cualquier otra vista.
6. WHEN el usuario ejecuta la acción de logout, THEN el Auth_Store SHALL establecer googleUser en null, isAuthenticated en false, y eliminar los datos de sesión de localStorage.

### Requerimiento 2: Verificación de Token de Google en el Backend

**User Story:** Como administrador del sistema, quiero que el backend verifique los tokens de Google, para que ningún request no autenticado acceda a los endpoints protegidos.

#### Criterios de Aceptación

1. WHEN el Sistema_Backend recibe un POST en /api/auth/google con un idToken válido, THEN el Sistema_Backend SHALL verificar el token con google-auth-library y retornar los datos del usuario (email, name, picture) junto con un sessionToken.
2. WHEN el Sistema_Backend recibe un POST en /api/auth/google con un idToken vacío, THEN el Sistema_Backend SHALL retornar un error 400 con el mensaje "idToken is required".
3. WHEN el Sistema_Backend recibe un POST en /api/auth/google con un idToken inválido o expirado, THEN el Sistema_Backend SHALL retornar un error 401 con el mensaje "Token inválido o email no verificado".
4. WHEN un request llega a cualquier ruta /api/* (excepto /api/auth/google y /health) sin header Authorization válido, THEN el Auth_Middleware SHALL rechazar el request con respuesta 401.
5. WHEN un request llega con un header Authorization Bearer válido, THEN el Auth_Middleware SHALL inyectar los datos del usuario (email, name, sub) en req.user y llamar a next().

### Requerimiento 3: Extensión del JQL para Tickets JSM

**User Story:** Como analista de soporte, quiero que el Support Agent incluya tickets de tipo Incident y Problem de JSM, para que el análisis de bugs cubra también los incidentes y problemas reportados en Jira Service Management.

#### Criterios de Aceptación

1. WHEN el Jira_Connector ejecuta fetchBugIssues(), THEN el JQL_Builder SHALL construir una query que incluya `issuetype in (Bug, Incident, Problem)` en lugar de solo `issuetype = Bug`.
2. WHEN la instancia de Jira no tiene JSM habilitado, THEN el Jira_Connector SHALL continuar el flujo normalmente retornando solo los bugs disponibles, sin lanzar error.
3. WHEN el Jira_Connector recibe tickets de tipo Incident o Problem, THEN el Jira_Connector SHALL mapear los campos de esos tickets al modelo BugIssue existente (summary, priority, status, reporter, assignee, comments, components, labels).
4. WHEN el Support_Agent recibe BugIssues que incluyen Incidents y Problems, THEN el Support_Agent SHALL procesarlos con el mismo flujo de validación, estimación, priorización y sugerencia que aplica a los bugs.
5. WHEN se aplican filtros opcionales (severities, components, dates) a fetchBugIssues(), THEN el JQL_Builder SHALL aplicar esos filtros correctamente sobre los tres tipos de issue (Bug, Incident, Problem).

### Requerimiento 4: Filtro de Proyectos por Prefijo de Clave

**User Story:** Como usuario del sistema, quiero filtrar los proyectos Jira por el prefijo "GD", para que solo vea los proyectos de mi tribu con actividad en el rango 2025-2026.

#### Criterios de Aceptación

1. WHEN el endpoint GET /api/jira/projects recibe un query param `prefix`, THEN el Sistema_Backend SHALL pasar ese valor como parámetro keyPrefix a fetchProjects().
2. WHEN fetchProjects() recibe un keyPrefix, THEN el Jira_Connector SHALL filtrar los proyectos retornando solo aquellos cuya clave comience con el prefijo proporcionado.
3. WHEN fetchProjects() recibe un keyPrefix y parámetros de rango de años, THEN el Jira_Connector SHALL aplicar primero el filtro de prefijo y luego el filtro de actividad por rango de fechas.
4. WHEN fetchProjects() recibe un keyPrefix y ningún proyecto coincide, THEN el Jira_Connector SHALL retornar un array vacío sin lanzar error.
5. WHEN fetchProjects() no recibe keyPrefix, THEN el Jira_Connector SHALL retornar todos los proyectos sin aplicar filtro de prefijo, manteniendo el comportamiento actual.

### Requerimiento 5: Configuración de Variables de Entorno

**User Story:** Como desarrollador, quiero que las nuevas dependencias de autenticación estén configuradas mediante variables de entorno, para que el despliegue sea seguro y configurable.

#### Criterios de Aceptación

1. THE Sistema_Frontend SHALL requerir la variable de entorno VITE_GOOGLE_CLIENT_ID para inicializar el componente GoogleOAuthProvider.
2. THE Sistema_Backend SHALL requerir la variable de entorno GOOGLE_CLIENT_ID para verificar tokens de Google con google-auth-library.
3. IF la variable VITE_GOOGLE_CLIENT_ID no está definida, THEN el Sistema_Frontend SHALL mostrar un error claro indicando que la configuración de Google OAuth es necesaria.
4. IF la variable GOOGLE_CLIENT_ID no está definida, THEN el Auth_Middleware SHALL rechazar todos los requests con un error 500 indicando configuración faltante.

### Requerimiento 6: Manejo de Errores de Autenticación

**User Story:** Como usuario, quiero que los errores de autenticación se manejen de forma clara, para que pueda recuperarme fácilmente de problemas de sesión.

#### Criterios de Aceptación

1. WHEN el ID_Token de Google ha expirado, THEN el Sistema_Backend SHALL retornar 401 y el Sistema_Frontend SHALL limpiar la sesión y mostrar la pantalla de login.
2. WHEN el Sistema_Backend no puede contactar a Google Identity Services para verificar el token, THEN el Sistema_Backend SHALL retornar un error 502 con un mensaje descriptivo.
3. WHEN el usuario cierra sesión, THEN el Auth_Store SHALL limpiar completamente el estado de autenticación y redirigir a la pantalla de login.
