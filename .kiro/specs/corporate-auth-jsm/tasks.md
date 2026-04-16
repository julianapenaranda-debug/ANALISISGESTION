# Plan de Implementación: Corporate Auth + JSM + Filtro GD

## Resumen

Implementación incremental de tres funcionalidades: (1) autenticación con Google Sign-In en frontend y backend, (2) extensión del JQL del Support Agent para incluir tickets JSM (Incident, Problem), (3) filtro de proyectos por prefijo de clave "GD". Todos los cambios se realizan en TypeScript sobre la arquitectura existente de React + Express.

## Tareas

- [ ] 1. Configurar dependencias y variables de entorno
  - Instalar `@react-oauth/google` en `packages/frontend`
  - Instalar `google-auth-library` en `packages/backend`
  - Agregar `VITE_GOOGLE_CLIENT_ID` a `packages/frontend/.env.example`
  - Agregar `GOOGLE_CLIENT_ID` a `packages/backend/.env.example`
  - _Requerimientos: 5.1, 5.2_

- [ ] 2. Implementar autenticación Google en el backend
  - [ ] 2.1 Crear el endpoint POST /api/auth/google
    - Crear archivo `packages/backend/src/api/auth-routes.ts`
    - Verificar `idToken` con `google-auth-library` (OAuth2Client.verifyIdToken)
    - Retornar `{ user: { email, name, picture }, sessionToken }` si válido
    - Retornar 400 si `idToken` está vacío, 401 si token inválido o email no verificado
    - _Requerimientos: 2.1, 2.2, 2.3_

  - [ ] 2.2 Crear el Auth Middleware
    - Crear archivo `packages/backend/src/api/auth-middleware.ts`
    - Extraer Bearer token del header Authorization
    - Verificar token con `google-auth-library`
    - Inyectar `req.user` con `{ email, name, sub }` si válido
    - Retornar 401 si token ausente o inválido
    - Retornar 500 si `GOOGLE_CLIENT_ID` no está configurado
    - _Requerimientos: 2.4, 2.5, 5.4_

  - [ ] 2.3 Registrar auth routes y middleware en el servidor
    - Montar `auth-routes` en `/api/auth` en `packages/backend/src/index.ts`
    - Aplicar auth middleware a todas las rutas `/api/*` excepto `/api/auth/google` y `/health`
    - _Requerimientos: 2.4, 6.2_

  - [ ]* 2.4 Escribir tests unitarios para auth endpoint y middleware
    - Test: idToken vacío retorna 400
    - Test: idToken inválido retorna 401
    - Test: token válido retorna datos del usuario
    - Test: middleware rechaza request sin Authorization header (401)
    - Test: middleware inyecta req.user con token válido
    - _Requerimientos: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [ ]* 2.5 Escribir property test para Auth Middleware
    - **Propiedad 3: Auth Middleware valida tokens correctamente**
    - **Valida: Requerimientos 2.4, 2.5**

- [ ] 3. Implementar autenticación Google en el frontend
  - [ ] 3.1 Extender el Zustand store con estado de autenticación
    - Agregar `googleUser`, `isAuthenticated`, `loginWithGoogle()`, `logout()` a `useAppStore.ts`
    - `loginWithGoogle()` envía idToken a `POST /api/auth/google`, guarda respuesta en store y localStorage
    - `logout()` limpia `googleUser`, `isAuthenticated` y localStorage
    - Al inicializar, restaurar sesión desde localStorage si existe
    - _Requerimientos: 1.3, 1.6, 6.3_

  - [ ] 3.2 Crear componente LoginScreen
    - Crear `packages/frontend/src/components/LoginScreen.tsx`
    - Usar `GoogleOAuthProvider` con `VITE_GOOGLE_CLIENT_ID`
    - Renderizar botón `GoogleLogin` que llama a `loginWithGoogle()` en onSuccess
    - Mostrar error si `VITE_GOOGLE_CLIENT_ID` no está definido
    - _Requerimientos: 1.1, 5.1, 5.3_

  - [ ] 3.3 Crear AuthGuard y actualizar App.tsx
    - Crear `packages/frontend/src/components/AuthGuard.tsx`
    - Si `isAuthenticated === false`, renderizar `LoginScreen`
    - Si `isAuthenticated === true`, renderizar children (App Shell)
    - Envolver el contenido de `App.tsx` con `AuthGuard`
    - _Requerimientos: 1.4, 1.5_

  - [ ] 3.4 Agregar header Authorization al apiClient
    - Modificar `packages/frontend/src/api/client.ts` para incluir `Authorization: Bearer <idToken>` en todos los requests
    - Obtener el token del store o localStorage
    - _Requerimientos: 2.4_

  - [ ]* 3.5 Escribir property test para Login/Logout round-trip
    - **Propiedad 1: Login/Logout round-trip**
    - **Valida: Requerimientos 1.3, 1.6, 6.3**

  - [ ]* 3.6 Escribir property test para AuthGuard
    - **Propiedad 2: AuthGuard bloquea acceso no autenticado**
    - **Valida: Requerimientos 1.4, 1.5**

- [ ] 4. Checkpoint - Verificar autenticación completa
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Extender JQL para tickets JSM (Incident, Problem)
  - [x] 5.1 Modificar fetchBugIssues() en jira-connector.ts
    - Cambiar `issuetype = Bug` por `issuetype in (Bug, Incident, Problem)` en el JQL base
    - Verificar que los filtros opcionales (severities, components, dates) se aplican sobre los tres tipos
    - El mapeo de campos a BugIssue ya es compatible (summary, priority, status, reporter, assignee, comments, components, labels)
    - _Requerimientos: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [ ]* 5.2 Escribir property test para JQL con tipos JSM
    - **Propiedad 4: JQL siempre incluye los tres tipos de issue con filtros**
    - **Valida: Requerimientos 3.1, 3.5**

  - [ ]* 5.3 Escribir property test para mapeo de tickets JSM
    - **Propiedad 5: Mapeo de tickets JSM preserva campos**
    - **Valida: Requerimiento 3.3**

- [x] 6. Implementar filtro de proyectos por prefijo
  - [x] 6.1 Agregar parámetro keyPrefix a fetchProjects()
    - Modificar la firma de `fetchProjects()` en `jira-connector.ts` para aceptar `keyPrefix?: string`
    - Filtrar proyectos con `project.key.startsWith(keyPrefix)` antes de aplicar filtro de fechas
    - Si `keyPrefix` es undefined, mantener comportamiento actual (retornar todos)
    - _Requerimientos: 4.2, 4.3, 4.4, 4.5_

  - [x] 6.2 Actualizar endpoint GET /api/jira/projects
    - Leer query param `prefix` del request en `routes.ts`
    - Pasar `prefix` como `keyPrefix` a `fetchProjects()`
    - _Requerimientos: 4.1_

  - [x] 6.3 Actualizar JiraView para enviar prefix=GD
    - Modificar `loadProjects()` en `JiraView.tsx` para incluir `&prefix=GD` en la URL del request
    - _Requerimientos: 4.1, 4.2_

  - [ ]* 6.4 Escribir property test para filtro de prefijo
    - **Propiedad 6: Filtro de proyectos por prefijo**
    - **Valida: Requerimientos 4.2, 4.3, 4.5**

- [ ] 7. Manejo de errores de autenticación
  - [ ] 7.1 Manejar token expirado en el frontend
    - En `apiClient`, interceptar respuestas 401 y limpiar sesión automáticamente (llamar `logout()`)
    - Redirigir a pantalla de login cuando se detecta 401
    - _Requerimientos: 6.1_

  - [ ] 7.2 Manejar error de conexión con Google en el backend
    - En el endpoint `/api/auth/google`, capturar errores de red al contactar Google Identity Services
    - Retornar 502 con mensaje descriptivo si Google no responde
    - _Requerimientos: 6.2_

- [ ] 8. Checkpoint final - Verificar integración completa
  - Ensure all tests pass, ask the user if questions arise.

## Notas

- Las tareas marcadas con `*` son opcionales y pueden omitirse para un MVP más rápido
- Cada tarea referencia requerimientos específicos para trazabilidad
- Los checkpoints aseguran validación incremental
- Los property tests validan propiedades universales de correctitud
- Los unit tests validan ejemplos específicos y casos borde
