# Plan de Implementación: Story Generator V2

## Resumen

Implementar 4 mejoras al generador de HUs: degradación graceful de Figma, edición completa de HUs, épicas propuestas por LLM, y creación directa en Jira. El stack es TypeScript con Express (backend) y React + Zustand (frontend).

## Tareas

- [x] 1. Degradación graceful de Figma en el endpoint de generación
  - [x] 1.1 Actualizar el endpoint `POST /api/stories/generate` en `routes.ts` para capturar errores de Figma y continuar la generación sin datos de Figma
    - Cuando `analyzeDesign` falle, en lugar de retornar HTTP 400, llamar a `generateStories` sin `figmaData`
    - Incluir campo `figmaWarning` en la respuesta con el mensaje de error descriptivo (403 → permisos, 404 → no encontrado, red → conexión)
    - Cuando el token de Figma no exista en CredentialStore, incluir `figmaWarning` indicando que Figma no está conectado
    - _Requerimientos: 1.5, 1.6_

  - [x] 1.2 Actualizar `GenerateView.tsx` para mostrar advertencias de Figma
    - Leer `figmaWarning` de la respuesta del endpoint y mostrarlo como banner amarillo de advertencia (no como error bloqueante)
    - Mostrar mensajes específicos según el tipo de error: token no almacenado (con enlace a Conexiones), 403, 404, error de red
    - Las historias generadas sin Figma deben mostrarse normalmente junto con la advertencia
    - _Requerimientos: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [ ]* 1.3 Escribir tests unitarios para la degradación graceful de Figma
    - Test: endpoint retorna historias + `figmaWarning` cuando Figma falla con 403
    - Test: endpoint retorna historias + `figmaWarning` cuando Figma falla con 404
    - Test: endpoint retorna historias + `figmaWarning` cuando no hay token de Figma
    - Test: endpoint retorna historias sin `figmaWarning` cuando Figma funciona correctamente
    - _Requerimientos: 1.1, 1.2, 1.3, 1.5, 1.6_


- [x] 2. Checkpoint — Verificar degradación graceful de Figma
  - Asegurar que todos los tests pasan, preguntar al usuario si surgen dudas.

- [x] 3. Extender el Store de Zustand con acciones de edición
  - [x] 3.1 Agregar acciones al store en `useAppStore.ts`
    - `addStory(story: Story)`: agrega una HU nueva a la lista de stories
    - `removeStory(storyId: string)`: elimina una HU de stories y de la épica asociada
    - `updateEpic(epic: Epic)`: actualiza una épica existente por id
    - `addEpic(epic: Epic)`: agrega una nueva épica
    - `removeEpic(epicId: string)`: elimina una épica y desasocia sus HUs
    - `moveStoryToEpic(storyId: string, targetEpicId: string | null)`: mueve una HU de una épica a otra, actualizando epicId y las listas de stories de ambas épicas
    - _Requerimientos: 2.2, 2.8, 2.9, 3.5, 3.6, 3.7, 3.8_

  - [ ]* 3.2 Escribir tests unitarios para las acciones del store
    - Test: `addStory` agrega una HU y se refleja en `stories`
    - Test: `removeStory` elimina la HU y la quita de la épica asociada
    - Test: `moveStoryToEpic` actualiza epicId de la HU y las listas de stories de ambas épicas
    - Test: `addEpic` agrega una épica vacía
    - Test: `removeEpic` elimina la épica y limpia epicId de sus HUs
    - _Requerimientos: 2.2, 2.8, 2.9, 3.7_

- [ ] 4. Reescribir StoriesView con edición completa de HUs y épicas
  - [x] 4.1 Implementar edición inline de campos de HU en `StoriesView.tsx`
    - Expandir el modo edición del `StoryCard` para incluir campos: título, rol, acción, valor (actualmente solo edita título)
    - Al guardar, llamar a `updateStory` del store con todos los campos modificados
    - Mientras se edita una HU, deshabilitar la navegación a otras vistas (agregar flag `isEditing` al store o estado local)
    - _Requerimientos: 2.1, 2.2, 2.10_

  - [x] 4.2 Implementar edición de criterios de aceptación
    - Al hacer clic en un criterio existente, mostrar campos editables para given, when, then
    - Botón "Agregar criterio" que muestra formulario vacío con given, when, then y al confirmar agrega el criterio a la HU
    - Botón "Eliminar" en cada criterio con confirmación antes de eliminar
    - _Requerimientos: 2.3, 2.4, 2.5, 2.6_

  - [x] 4.3 Implementar creación y eliminación de HUs
    - Botón "Agregar Historia" fuera de las HUs existentes que muestra formulario vacío (título, rol, acción, valor, al menos 1 criterio)
    - Al confirmar, llamar a `addStory` del store con `source: 'manual'` en metadata
    - Botón "Eliminar" en cada HU con diálogo de confirmación, al confirmar llamar a `removeStory` del store
    - _Requerimientos: 2.7, 2.8, 2.9_

  - [x] 4.4 Implementar edición de épicas y movimiento de HUs entre épicas
    - Al hacer clic en el nombre de una épica, mostrar campos editables para nombre y descripción inline
    - Al confirmar, llamar a `updateEpic` del store
    - Botón "Crear épica" que muestra formulario para nombre y descripción, al confirmar llama a `addEpic`
    - Selector de épica en cada HU (dropdown) para mover la HU a otra épica, llamando a `moveStoryToEpic`
    - Mostrar contador de HUs junto al nombre de cada épica
    - _Requerimientos: 3.4, 3.5, 3.6, 3.7, 3.8, 3.9_

  - [ ]* 4.5 Escribir tests unitarios para StoriesView
    - Test: renderiza campos editables al hacer clic en "Editar" en una HU
    - Test: formulario de nueva HU se muestra al hacer clic en "Agregar Historia"
    - Test: confirmación de eliminación se muestra al hacer clic en "Eliminar" en una HU
    - Test: edición inline de épica funciona correctamente
    - _Requerimientos: 2.1, 2.7, 2.9, 3.5_


- [x] 5. Checkpoint — Verificar edición completa de HUs y épicas
  - Asegurar que todos los tests pasan, preguntar al usuario si surgen dudas.

- [x] 6. Épicas propuestas por el LLM
  - [x] 6.1 Actualizar el prompt del LLM en `story-generator.ts` para incluir épicas
    - Modificar `buildSystemPrompt()` para instruir al LLM a proponer épicas con nombre, descripción y lista de HUs asociadas
    - Extender la estructura JSON esperada del LLM para incluir un array `epics` con `{ title, description, storyIndices }` donde storyIndices referencia las posiciones en el array de stories
    - _Requerimientos: 3.1_

  - [x] 6.2 Actualizar `parseLLMResponse` para parsear épicas del LLM
    - Parsear el array `epics` de la respuesta del LLM
    - Crear objetos Epic usando `createEpic` de `models.ts` y asignar `epicId` a cada Story generada
    - Retornar las épicas junto con las stories en el resultado
    - _Requerimientos: 3.2_

  - [x] 6.3 Implementar fallback a `assembleEpics` cuando el LLM no retorna épicas
    - Si `parseLLMResponse` no encuentra épicas en la respuesta, llamar a `assembleEpics` como fallback
    - Actualizar el endpoint `POST /api/stories/generate` para usar las épicas del LLM cuando estén disponibles, o las de `assembleEpics` como fallback
    - _Requerimientos: 3.3_

  - [ ]* 6.4 Escribir tests unitarios para el parseo de épicas del LLM
    - Test: `parseLLMResponse` parsea correctamente épicas y asigna epicId a las stories
    - Test: `parseLLMResponse` retorna épicas vacías cuando el LLM no incluye épicas
    - Test: el endpoint usa `assembleEpics` como fallback cuando no hay épicas del LLM
    - _Requerimientos: 3.1, 3.2, 3.3_

- [x] 7. Checkpoint — Verificar épicas del LLM
  - Asegurar que todos los tests pasan, preguntar al usuario si surgen dudas.

- [x] 8. Creación de HUs en Jira
  - [x] 8.1 Implementar endpoint `GET /api/jira/projects/:projectKey/epics` en `routes.ts`
    - Crear función `fetchProjectEpics` en `jira-connector.ts` que consulte la API REST de Jira filtrando por `issuetype = "Epic"` y estado no cerrado
    - Registrar la ruta en `routes.ts` que reciba `credentialKey` como query param
    - Retornar array de `{ id, key, summary }` de las épicas encontradas
    - _Requerimientos: 4.2, 4.10_

  - [x] 8.2 Implementar panel de creación en Jira dentro de `StoriesView.tsx`
    - Agregar botón "Crear en Jira" en la vista de historias que abre un panel lateral o modal
    - Buscador predictivo de proyectos Jira con debounce de 300ms, máximo 10 resultados, usando el endpoint existente `GET /api/jira/projects`
    - Al seleccionar proyecto, cargar épicas existentes del proyecto usando el nuevo endpoint
    - Selector de épica padre con opción "Crear nueva épica" que muestra campo para nombre
    - _Requerimientos: 4.1, 4.2, 4.3, 4.9_

  - [x] 8.3 Implementar flujo de confirmación y creación en Jira
    - Diálogo de confirmación con resumen: número de HUs, proyecto destino, épica padre
    - Al confirmar, crear épica padre (si es nueva) usando `syncToJira` o `createIssues` existente, luego crear cada HU como Story vinculada
    - Barra de progreso durante la creación indicando HUs creadas / total
    - Al finalizar, mostrar lista de resultados con key de Jira y enlace directo a cada issue
    - Si alguna HU falla, mostrar error específico y botón para reintentar las fallidas
    - _Requerimientos: 4.4, 4.5, 4.6, 4.7, 4.8_

  - [ ]* 8.4 Escribir tests unitarios para la creación en Jira
    - Test: `fetchProjectEpics` retorna épicas filtradas por tipo y estado
    - Test: el panel muestra buscador de proyectos con debounce
    - Test: el diálogo de confirmación muestra resumen correcto
    - Test: errores parciales se muestran correctamente con opción de reintento
    - _Requerimientos: 4.2, 4.4, 4.7, 4.10_

- [x] 9. Checkpoint final — Verificar todas las funcionalidades
  - Asegurar que todos los tests pasan, preguntar al usuario si surgen dudas.

## Notas

- Las tareas marcadas con `*` son opcionales y pueden omitirse para un MVP más rápido
- Cada tarea referencia requerimientos específicos para trazabilidad
- Los checkpoints aseguran validación incremental
- El stack es TypeScript con Express (backend) y React + Zustand + Tailwind (frontend)
