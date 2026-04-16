# Plan de Implementación: Panel de Conexiones (Autenticación Unificada)

## Resumen

Implementación incremental del Panel de Conexiones que centraliza la gestión de credenciales para Jira, Figma y Datadog. Se comienza por el backend (CredentialStore genérico, validadores, rutas) y luego el frontend (ConnectionsView, AppStore, navegación, actualización de vistas existentes).

## Tareas

- [x] 1. Generalizar CredentialStore y tipos compartidos
  - [x] 1.1 Crear tipos compartidos de conexiones en `packages/shared/src/types/connections.ts`
    - Definir `ConnectionStatus`, `ConnectionStatusResponse`, `ConnectionResult`
    - Exportar desde `packages/shared/src/types/index.ts`
    - _Requerimientos: 2.4, 4.1, 5.2_

  - [x] 1.2 Generalizar `CredentialStore` para aceptar `Record<string, unknown>`
    - Cambiar tipos de `store()` y `retrieve()` de `JiraCredentials` a `Record<string, unknown>`
    - Añadir método `exists(key: string): Promise<boolean>`
    - Actualizar `packages/backend/src/storage/index.ts` si es necesario
    - _Requerimientos: 1.1, 1.2, 1.3, 1.4_

  - [ ]* 1.3 Escribir test de propiedad para round-trip con sobreescritura del CredentialStore
    - **Propiedad 1: Round-trip de almacenamiento con sobreescritura**
    - **Valida: Requerimientos 1.1, 1.3**

  - [ ]* 1.4 Escribir test de propiedad para invariante de encriptación
    - **Propiedad 2: Invariante de encriptación**
    - **Valida: Requerimiento 1.2**

  - [ ]* 1.5 Escribir test de propiedad para key inexistente retorna null
    - **Propiedad 3: Key inexistente retorna null**
    - **Valida: Requerimiento 1.4**

- [x] 2. Implementar validadores de servicio y Datadog Connector
  - [x] 2.1 Crear `packages/backend/src/integration/service-validators.ts`
    - Implementar `validateJiraCredentials()` reutilizando `authenticate()` de `jira-connector.ts`
    - Implementar `validateFigmaToken()` con llamada a `GET https://api.figma.com/v1/me`
    - Implementar `validateDatadogCredentials()` con llamada a `GET https://api.{site}/api/v1/validate`
    - _Requerimientos: 3.1, 3.2, 3.3, 3.4_

  - [x] 2.2 Crear `packages/backend/src/integration/datadog-connector.ts`
    - Implementar `datadogRequest()` con headers `DD-API-KEY` y `DD-APPLICATION-KEY`
    - Construir URL base como `https://api.{site}`
    - Implementar `validateDatadog()` usando el endpoint `/api/v1/validate`
    - Manejar errores 403 con mensaje específico
    - _Requerimientos: 9.1, 9.2, 9.3, 9.4_

  - [ ]* 2.3 Escribir test de propiedad para construcción de peticiones Datadog
    - **Propiedad 9: Construcción de peticiones Datadog**
    - **Valida: Requerimientos 9.2, 9.3**

  - [ ]* 2.4 Escribir tests unitarios para service-validators
    - Mockear respuestas HTTP para cada servicio (éxito, 401, 403, error de red)
    - _Requerimientos: 3.1, 3.2, 3.3, 3.4_

- [x] 3. Implementar rutas de conexión y actualizar Figma Analyzer
  - [x] 3.1 Crear `packages/backend/src/api/connection-routes.ts`
    - POST `/api/connections/jira` — validar y almacenar credenciales Jira
    - POST `/api/connections/figma` — validar y almacenar token Figma
    - POST `/api/connections/datadog` — validar y almacenar credenciales Datadog
    - GET `/api/connections/status` — retornar estado de cada servicio
    - DELETE `/api/connections/:service` — eliminar credenciales
    - Retornar 401 si credenciales inválidas, 502 si error de red
    - _Requerimientos: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 3.4_

  - [x] 3.2 Registrar connection-routes en `packages/backend/src/api/routes.ts` o en `packages/backend/src/index.ts`
    - Montar las rutas bajo `/api/connections`
    - _Requerimiento: 2.1_

  - [x] 3.3 Actualizar `packages/backend/src/integration/figma-analyzer.ts` con API real
    - Modificar `analyzeDesign()` para aceptar `accessToken` opcional
    - Si se proporciona accessToken, llamar a `GET https://api.figma.com/v1/files/:fileKey`
    - Parsear respuesta real de Figma para extraer componentes, pantallas e interacciones
    - Manejar errores 403 y 404 con mensajes específicos
    - Mantener comportamiento mock si no se proporciona accessToken
    - _Requerimientos: 8.1, 8.2, 8.3, 8.4_

  - [x] 3.4 Actualizar la ruta existente `POST /api/figma/analyze` para pasar accessToken desde CredentialStore
    - Si existe `figma-main` en el store, recuperar token y pasarlo a `analyzeDesign()`
    - _Requerimiento: 8.1_

  - [ ]* 3.5 Escribir test de propiedad para estado de conexión refleja el CredentialStore
    - **Propiedad 4: Estado de conexión refleja el CredentialStore**
    - **Valida: Requerimientos 2.4, 2.5**

  - [ ]* 3.6 Escribir test de propiedad para rechazo de credenciales inválidas
    - **Propiedad 5: Rechazo de credenciales inválidas**
    - **Valida: Requerimiento 2.6**

- [x] 4. Extender ErrorHandler con nuevos códigos de error
  - [x] 4.1 Añadir códigos de error a `packages/backend/src/integration/error-handler.ts`
    - Agregar `FIGMA_AUTH_FAILED`, `DATADOG_AUTH_FAILED`, `DATADOG_PERMISSION_DENIED`, `SERVICE_UNREACHABLE` a `ErrorCode`
    - Actualizar `normalizeError()` para mapear errores de Figma y Datadog
    - _Requerimientos: 3.4, 8.3, 8.4, 9.4_

- [x] 5. Checkpoint — Verificar backend
  - Asegurar que todos los tests pasan, preguntar al usuario si surgen dudas.

- [x] 6. Extender AppStore con estado de conexiones
  - [x] 6.1 Añadir estado de conexiones al AppStore en `packages/frontend/src/store/useAppStore.ts`
    - Agregar `connections: ConnectionState` con estado por servicio
    - Implementar `setConnectionStatus(service, status)`
    - Implementar `fetchConnectionStatus()` que llame a `GET /api/connections/status`
    - Agregar tipo `connections` al View type para la nueva vista
    - _Requerimientos: 5.1, 5.2, 5.3, 5.4_

  - [ ]* 6.2 Escribir test de propiedad para mapeo de Credential_Key en AppStore
    - **Propiedad 6: Mapeo de Credential_Key en AppStore**
    - **Valida: Requerimiento 5.3**

  - [ ]* 6.3 Escribir test de propiedad para actualización inmediata del estado
    - **Propiedad 7: Actualización inmediata del estado en AppStore**
    - **Valida: Requerimiento 5.4**

- [x] 7. Implementar ConnectionsView
  - [x] 7.1 Crear `packages/frontend/src/components/ConnectionsView.tsx`
    - Renderizar una tarjeta por servicio (Jira, Figma, Datadog)
    - Mostrar formulario con campos específicos cuando `disconnected`
    - Mostrar indicador verde y botón "Desconectar" cuando `connected`
    - Mostrar indicador de carga durante validación
    - Mostrar mensajes de error retornados por la API
    - Usar `apiClient` para POST/DELETE a `/api/connections/*`
    - _Requerimientos: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

  - [ ]* 7.2 Escribir tests unitarios para ConnectionsView
    - Test de renderizado para cada estado (connected, disconnected, loading, error)
    - _Requerimientos: 4.1, 4.2, 4.3, 4.6_

- [x] 8. Actualizar navegación con indicador
  - [x] 8.1 Actualizar `packages/frontend/src/App.tsx`
    - Añadir "Conexiones" a `NAV_ITEMS` con id `connections`
    - Añadir caso `connections` al `renderView()` para mostrar `ConnectionsView`
    - Mostrar indicador visual (punto) cuando al menos un servicio está `disconnected`
    - Llamar a `fetchConnectionStatus()` en `useEffect` al montar la app
    - _Requerimientos: 7.1, 7.2, 7.3, 5.1_

  - [ ]* 8.2 Escribir test de propiedad para indicador de notificación en navegación
    - **Propiedad 8: Indicador de notificación en navegación**
    - **Valida: Requerimiento 7.3**

- [x] 9. Actualizar vistas existentes para consumo automático de credenciales
  - [x] 9.1 Actualizar `JiraView` para usar credenciales del AppStore
    - Si Jira está `connected`, omitir formulario de conexión y cargar proyectos directamente con `jira-main`
    - Si Jira está `disconnected`, mostrar mensaje con enlace al Panel de Conexiones
    - _Requerimientos: 6.1, 6.2_

  - [x] 9.2 Actualizar `MetricsView`, `SupportView` y `WorkloadView`
    - Usar `jira-main` automáticamente cuando Jira está `connected`
    - Mostrar mensaje de conexión requerida cuando está `disconnected`
    - _Requerimiento: 6.3_

  - [x] 9.3 Actualizar `GenerateView` para usar credenciales de Figma
    - Usar `figma-main` automáticamente cuando Figma está `connected`
    - _Requerimiento: 6.4_

- [x] 10. Checkpoint final — Verificar integración completa
  - Asegurar que todos los tests pasan, preguntar al usuario si surgen dudas.

## Notas

- Las tareas marcadas con `*` son opcionales y pueden omitirse para un MVP más rápido.
- Cada tarea referencia los requerimientos específicos para trazabilidad.
- Los checkpoints aseguran validación incremental.
- Los tests de propiedades validan propiedades universales de correctitud.
- Los tests unitarios validan ejemplos concretos y edge cases.
