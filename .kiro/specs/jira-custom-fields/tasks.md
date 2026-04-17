# Implementation Plan: Jira Custom Fields Integration

## Overview

Integrate seven Jira custom fields (Tribu, Squad, Tipo de Iniciativa, Año de Ejecución, Centro de Costos, Avance Esperado %, Avance Real %) into the PO-AI system across backend data fetching, API layer, and frontend views. Implementation proceeds bottom-up: backend types and extraction logic first, then API modifications, then frontend components and view integration.

## Tasks

- [x] 1. Add custom field constants, interfaces, and extraction utilities in jira-connector.ts
  - [x] 1.1 Define `CUSTOM_FIELDS` constant object with the 7 custom field IDs and add `InitiativeContext` interface and extend `JiraProject` interface with `tribu`, `squad`, `tipoIniciativa`, `anioEjecucion`, `centroCostos`, `avanceEsperado`, `avanceReal`
    - Add the constant map in `packages/backend/src/integration/jira-connector.ts`
    - Export `InitiativeContext` interface with text fields (string) and numeric fields (number | null)
    - Extend existing `JiraProject` interface with the 7 new fields
    - Define `DEFAULT_INITIATIVE_CONTEXT` with empty strings and nulls
    - _Requirements: 1.4_

  - [x] 1.2 Implement `extractTextField` and `extractNumericField` helper functions
    - `extractTextField`: handle null, undefined, plain string, `{ value: string }`, `{ name: string }` — return `''` for missing
    - `extractNumericField`: handle null, undefined, number, numeric string — return `null` for missing/NaN
    - These are pure functions used by `fetchInitiativeContext` and `fetchProjects`
    - _Requirements: 1.2_

  - [ ]* 1.3 Write property test for field extraction (Property 1)
    - **Property 1: Field extraction produces correct defaults for missing values**
    - Test `extractTextField` with arbitrary inputs: null → `''`, undefined → `''`, valid string → non-empty, `{ value: x }` → string, `{ name: x }` → string
    - Test `extractNumericField` with arbitrary inputs: null → `null`, undefined → `null`, number → number, numeric string → number, non-numeric string → `null`
    - Use fast-check with minimum 100 iterations
    - **Validates: Requirements 1.2**

  - [x] 1.4 Implement `fetchInitiativeContext(credentials, projectKey)` function
    - JQL: `project = {projectKey} AND issuetype = Iniciativa ORDER BY created DESC`
    - Request only the 7 custom field IDs in `fields` parameter
    - Take first result, extract fields using helper functions
    - Return `DEFAULT_INITIATIVE_CONTEXT` if no results or on error (log warning)
    - Export the function
    - _Requirements: 1.1, 1.2, 1.3_

  - [x] 1.5 Modify `fetchProjects` to enrich each project with custom fields
    - After fetching the project list, call `fetchInitiativeContext` for each project
    - Populate the new fields on each `JiraProject` object
    - On error for a single project, use default empty values and continue
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 2. Checkpoint — Verify backend data layer compiles
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Add server-side filtering and filters object in routes.ts
  - [x] 3.1 Implement `filterProjects` and `computeFilterOptions` pure functions
    - `filterProjects(projects, { tribu?, squad?, anio? })`: AND-logic filter, return matching subset
    - `computeFilterOptions(projects)`: compute distinct non-empty values for tribus (sorted asc), squads (sorted asc), anios (sorted desc)
    - Place these as exported pure functions in `jira-connector.ts` or a new utility for testability
    - _Requirements: 2.2, 2.3, 2.4, 2.5, 2.6_

  - [ ]* 3.2 Write property test for project filtering (Property 2)
    - **Property 2: Project filtering returns only matching projects**
    - Generate arbitrary project lists with random tribu/squad/anio values
    - For any combination of filter params, verify filtered result contains only and all matching projects
    - Use fast-check with minimum 100 iterations
    - **Validates: Requirements 2.2, 2.3, 2.4, 2.5**

  - [ ]* 3.3 Write property test for filter options computation (Property 3)
    - **Property 3: Filter options contain exactly the distinct non-empty values**
    - Generate arbitrary project lists, verify computed filters match expected distinct sets
    - Verify tribus/squads sorted alphabetically, anios sorted descending
    - Use fast-check with minimum 100 iterations
    - **Validates: Requirements 2.6**

  - [x] 3.4 Modify `GET /api/jira/projects` endpoint to accept `tribu`, `squad`, `anio` query params and return `{ projects, filters }` response shape
    - Read query params from `req.query`
    - Compute `filters` from full (unfiltered) project list
    - Apply `filterProjects` with active params
    - Return `{ projects: filteredProjects, filters }` instead of raw array
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [x] 3.5 Modify metrics endpoints to include `initiativeContext`
    - `GET /api/projects/:projectKey/metrics`: call `fetchInitiativeContext`, add to response
    - `POST /api/workload/analyze`: call `fetchInitiativeContext`, add to response
    - `POST /api/flow-metrics/analyze`: call `fetchInitiativeContext`, add to response
    - On error, return `DEFAULT_INITIATIVE_CONTEXT`
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [x] 4. Checkpoint — Verify all backend changes compile and tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Create InitiativeContextCard reusable component
  - [x] 5.1 Create `packages/frontend/src/components/InitiativeContextCard.tsx`
    - Accept props: `tribu`, `squad`, `tipoIniciativa`, `anioEjecucion`, `avanceEsperado`, `avanceReal`
    - Render metadata badges for Tribu, Squad, Tipo de Iniciativa, Año with labels in Spanish
    - Render dual progress bar: Avance Esperado vs Avance Real
    - Red bar (`#DC2626`) when `avanceEsperado - avanceReal > 10`, green (`#009056`) otherwise
    - Display "Sin datos" when avance values are null
    - Display "Contexto de iniciativa no disponible" when all props are empty/null
    - Use Tailwind CSS consistent with existing design system
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 5.4, 5.5, 5.6, 5.7, 5.8_

  - [ ]* 5.2 Write property test for progress bar color logic (Property 4)
    - **Property 4: Progress bar color is determined by avance difference threshold**
    - Extract `getProgressBarColor(avanceEsperado, avanceReal)` as a pure function
    - For any pair of non-null numbers: red when difference > 10, green when ≤ 10
    - Use fast-check with minimum 100 iterations
    - **Validates: Requirements 5.5, 5.6**

- [x] 6. Update JiraView with custom fields display and filter panel
  - [x] 6.1 Update `JiraProject` interface in JiraView.tsx and adapt `loadProjects` to handle new `{ projects, filters }` response shape
    - Extend local `JiraProject` interface with `tribu`, `squad`, `tipoIniciativa`, `anioEjecucion`, `centroCostos`, `avanceEsperado`, `avanceReal`
    - Update `loadProjects` to destructure `{ projects, filters }` from API response
    - Store filter options in component state
    - _Requirements: 2.1, 3.1_

  - [x] 6.2 Add FilterPanel section with three dropdown selectors (Tribu, Squad, Año) and "Limpiar filtros" button
    - Render dropdowns populated from `filters` state (tribus, squads, anios)
    - Labels in Spanish: "Tribu", "Squad", "Año"
    - On selection change, re-fetch projects with filter query params
    - On clear, remove filter params and reload
    - "Limpiar filtros" button resets all three dropdowns
    - Display filtered count: "Mostrando X de Y iniciativas"
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [x] 6.3 Display custom field badges per project card
    - Show tribu, squad, tipoIniciativa, anioEjecucion as badges using design system green `#009056`
    - Display "—" for missing/empty values
    - Labels in Spanish
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 7. Integrate InitiativeContextCard into MetricsView, WorkloadView, and FlowMetricsView
  - [x] 7.1 Update MetricsView to extract `initiativeContext` from API response and render `<InitiativeContextCard />` at the top of results
    - Parse `initiativeContext` from the metrics API response
    - Pass fields as props to `InitiativeContextCard`
    - _Requirements: 5.1, 5.8_

  - [x] 7.2 Update WorkloadView to extract `initiativeContext` from API response and render `<InitiativeContextCard />` at the top of results
    - Parse `initiativeContext` from the workload analyze response
    - Pass fields as props to `InitiativeContextCard`
    - _Requirements: 5.2, 5.8_

  - [x] 7.3 Update FlowMetricsView to extract `initiativeContext` from API response and render `<InitiativeContextCard />` at the top of results
    - Parse `initiativeContext` from the flow-metrics analyze response
    - Pass fields as props to `InitiativeContextCard`
    - _Requirements: 5.3, 5.8_

- [x] 8. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- The project uses TypeScript throughout (Express backend, React frontend with Tailwind CSS)
- Property-based tests use fast-check with Jest (existing setup in `packages/backend/tests/property/`)
- All UI text must be in Spanish; design system accent color is `#009056`
- Backend runs on port 3001, frontend on port 3000
- The `fetchProjects` response shape changes from array to `{ projects, filters }` — JiraView and MetricsView both call this endpoint and must be updated
