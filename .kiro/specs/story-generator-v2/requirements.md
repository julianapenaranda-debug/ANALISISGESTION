# Documento de Requerimientos — Story Generator V2

## Introducción

Este documento define los requerimientos para 4 mejoras al generador de Historias de Usuario (HU) de PO-Agile-Master:

1. Mejor manejo de errores en la integración con Figma
2. Edición completa de HUs generadas por la IA
3. Propuesta y gestión de épicas por el LLM
4. Creación directa de HUs en Jira con selección de proyecto y épica padre

El sistema existente ya cuenta con `GenerateView.tsx`, `StoriesView.tsx`, `story-generator.ts`, `figma-analyzer.ts`, `epic-assembler.ts`, `jira-connector.ts` y un store Zustand (`useAppStore.ts`).

## Glosario

- **Sistema_Generador**: Módulo backend que genera historias de usuario usando LLM o mock (`story-generator.ts`)
- **Analizador_Figma**: Módulo backend que analiza diseños de Figma y extrae componentes (`figma-analyzer.ts`)
- **Ensamblador_Epicas**: Módulo backend que agrupa historias en épicas (`epic-assembler.ts`)
- **Conector_Jira**: Módulo backend que sincroniza historias y épicas con Jira (`jira-connector.ts`)
- **Vista_Historias**: Componente frontend que muestra las historias generadas (`StoriesView.tsx`)
- **Vista_Generacion**: Componente frontend que contiene el formulario de generación (`GenerateView.tsx`)
- **Vista_Jira**: Componente frontend que gestiona la integración con Jira (`JiraView.tsx`)
- **Store**: Estado global de la aplicación gestionado con Zustand (`useAppStore.ts`)
- **PO**: Product Owner, usuario principal del sistema
- **HU**: Historia de Usuario
- **Criterio_Aceptacion**: Criterio de aceptación en formato Dado-Cuando-Entonces (Given-When-Then)
- **Epica**: Agrupación lógica de historias de usuario relacionadas
- **LLM**: Large Language Model utilizado para generar historias

---

## Requerimientos

### Requerimiento 1: Manejo de errores de Figma

**User Story:** Como PO, quiero recibir mensajes claros cuando la conexión con Figma falla, para que pueda resolver el problema sin confusión.

#### Criterios de Aceptación

1. WHEN el PO envía una URL de Figma y el token de Figma no está almacenado en el CredentialStore, THE Vista_Generacion SHALL mostrar un mensaje indicando "Figma no está conectado. Configura tu token en el Panel de Conexiones." con un enlace directo al Panel de Conexiones.
2. WHEN el Analizador_Figma recibe un error HTTP 403 de la API de Figma, THE Vista_Generacion SHALL mostrar el mensaje "El token de Figma no tiene permisos para acceder a este archivo. Verifica los permisos del token o solicita acceso al archivo."
3. WHEN el Analizador_Figma recibe un error HTTP 404 de la API de Figma, THE Vista_Generacion SHALL mostrar el mensaje "Archivo de Figma no encontrado. Verifica que la URL sea correcta y que el archivo exista."
4. WHEN el Analizador_Figma recibe un error de red (timeout, conexión rechazada), THE Vista_Generacion SHALL mostrar el mensaje "No se pudo conectar con Figma. Verifica tu conexión a internet e intenta de nuevo."
5. IF el Analizador_Figma falla al analizar el diseño, THEN THE Sistema_Generador SHALL continuar la generación de historias sin datos de Figma y THE Vista_Generacion SHALL mostrar una advertencia indicando que las historias se generaron sin análisis de diseño.
6. WHEN el endpoint `/api/stories/generate` recibe una URL de Figma y el token no tiene permisos, THE Sistema_Generador SHALL retornar un código HTTP 400 con un campo `figmaError` descriptivo en el cuerpo de la respuesta, además de las historias generadas sin datos de Figma.

---

### Requerimiento 2: Edición de Historias de Usuario

**User Story:** Como PO, quiero editar las historias generadas por la IA, para que pueda ajustarlas a las necesidades reales del negocio antes de aprobarlas.

#### Criterios de Aceptación

1. WHEN el PO hace clic en "Editar" en una HU, THE Vista_Historias SHALL mostrar campos editables para título, rol, acción y valor de la HU.
2. WHEN el PO modifica el título, rol, acción o valor de una HU y presiona "Guardar", THE Store SHALL actualizar la HU con los nuevos valores y THE Vista_Historias SHALL reflejar los cambios inmediatamente.
3. WHEN el PO hace clic en un criterio de aceptación existente, THE Vista_Historias SHALL mostrar campos editables para los campos given, when y then del Criterio_Aceptacion.
4. WHEN el PO modifica un Criterio_Aceptacion y confirma, THE Store SHALL actualizar el criterio dentro de la HU correspondiente.
5. WHEN el PO hace clic en "Agregar criterio" en una HU, THE Vista_Historias SHALL mostrar un formulario vacío con campos given, when y then, y al confirmar THE Store SHALL agregar el nuevo Criterio_Aceptacion a la HU.
6. WHEN el PO hace clic en "Eliminar" en un Criterio_Aceptacion, THE Vista_Historias SHALL solicitar confirmación y al confirmar THE Store SHALL eliminar el criterio de la HU.
7. WHEN el PO hace clic en "Agregar Historia" (fuera de cualquier HU existente), THE Vista_Historias SHALL mostrar un formulario vacío para crear una nueva HU con título, rol, acción, valor y al menos un Criterio_Aceptacion.
8. WHEN el PO crea una nueva HU manualmente y confirma, THE Store SHALL agregar la HU con source "manual" en sus metadatos.
9. WHEN el PO hace clic en "Eliminar" en una HU, THE Vista_Historias SHALL solicitar confirmación y al confirmar THE Store SHALL eliminar la HU de la lista de historias y de la épica asociada.
10. WHILE el PO edita una HU, THE Vista_Historias SHALL deshabilitar la navegación a otras vistas hasta que el PO guarde o cancele los cambios.

---

### Requerimiento 3: Propuesta y gestión de épicas por el LLM

**User Story:** Como PO, quiero que el LLM proponga épicas y asocie las HUs a ellas, para que pueda organizar el backlog de forma coherente desde el inicio.

#### Criterios de Aceptación

1. WHEN el Sistema_Generador genera historias usando el LLM, THE Sistema_Generador SHALL incluir en el prompt instrucciones para que el LLM proponga una o más épicas con nombre, descripción y la lista de HUs asociadas a cada una.
2. WHEN el LLM retorna épicas en su respuesta, THE Sistema_Generador SHALL parsear las épicas y asignar el epicId correspondiente a cada HU generada.
3. IF el LLM no retorna épicas en su respuesta, THEN THE Ensamblador_Epicas SHALL agrupar las historias por similitud como fallback.
4. WHEN las historias se muestran en la Vista_Historias, THE Vista_Historias SHALL agrupar las HUs bajo sus épicas correspondientes, mostrando el nombre de cada épica como encabezado de sección.
5. WHEN el PO hace clic en el nombre de una épica, THE Vista_Historias SHALL permitir editar el nombre y la descripción de la épica inline.
6. WHEN el PO confirma la edición de una épica, THE Store SHALL actualizar la épica con los nuevos valores.
7. WHEN el PO arrastra una HU de una épica a otra (o usa un selector de épica en la HU), THE Store SHALL mover la HU a la épica destino, actualizando el epicId de la HU y las listas de stories de ambas épicas.
8. WHEN el PO hace clic en "Crear épica", THE Vista_Historias SHALL mostrar un formulario para ingresar nombre y descripción, y al confirmar THE Store SHALL crear una nueva épica vacía.
9. THE Vista_Historias SHALL mostrar un contador de HUs por épica junto al nombre de cada épica.

---

### Requerimiento 4: Creación de HUs en Jira

**User Story:** Como PO, quiero crear las HUs aprobadas directamente en Jira seleccionando el proyecto y la épica padre, para que no tenga que copiar manualmente cada historia.

#### Criterios de Aceptación

1. WHEN el PO navega a la sección de creación en Jira desde la Vista_Historias, THE Vista_Historias SHALL mostrar un panel con un buscador predictivo de proyectos Jira que filtre por nombre o clave mientras el PO escribe.
2. WHEN el PO selecciona un proyecto Jira, THE Conector_Jira SHALL obtener las épicas existentes en ese proyecto y THE Vista_Historias SHALL mostrar un selector de épica padre con opción de "Crear nueva épica".
3. WHEN el PO selecciona "Crear nueva épica" como épica padre, THE Vista_Historias SHALL mostrar un campo para ingresar el nombre de la nueva épica que se creará en Jira.
4. WHEN el PO presiona "Crear en Jira", THE Vista_Historias SHALL mostrar un diálogo de confirmación con el resumen: número de HUs a crear, proyecto destino y épica padre seleccionada.
5. WHEN el PO confirma la creación, THE Conector_Jira SHALL crear la épica padre (si es nueva) y luego crear cada HU aprobada como Story en Jira vinculada a la épica padre.
6. WHEN la creación en Jira finaliza exitosamente, THE Vista_Historias SHALL mostrar una lista de resultados con el key de Jira y un enlace directo a cada issue creado.
7. IF alguna HU falla al crearse en Jira, THEN THE Vista_Historias SHALL mostrar el error específico para esa HU y permitir reintentar la creación de las HUs fallidas.
8. WHILE la creación en Jira está en progreso, THE Vista_Historias SHALL mostrar una barra de progreso indicando cuántas HUs se han creado de cuántas totales.
9. WHEN el PO escribe en el buscador de proyectos, THE Vista_Historias SHALL filtrar los resultados con un debounce de 300ms y mostrar máximo 10 resultados coincidentes.
10. THE Conector_Jira SHALL obtener las épicas de un proyecto Jira usando la API REST de Jira filtrando por issuetype "Epic" y estado no cerrado.
