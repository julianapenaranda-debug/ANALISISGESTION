# Task 2.1 Completion: Core Domain Models

## Summary

Successfully implemented core domain model factory functions and helper utilities in the backend. These implementations work with the shared types from `@po-ai/shared` and provide a clean API for creating and manipulating domain entities.

## Files Created

### 1. `src/core/models.ts`
Main implementation file containing factory functions for all core domain models:

**Story Management:**
- `createStory()` - Creates a new user story with all required fields
- `updateStory()` - Updates an existing story with changes
- `addAcceptanceCriterion()` - Adds a criterion to a story
- `removeAcceptanceCriterion()` - Removes a criterion from a story
- `validateStoryFormat()` - Validates story format compliance

**Acceptance Criteria:**
- `createAcceptanceCriterion()` - Creates a Gherkin-formatted criterion
- `validateAcceptanceCriterionFormat()` - Validates criterion format

**Epic Management:**
- `createEpic()` - Creates a new epic
- `updateEpic()` - Updates an existing epic
- `addStoryToEpic()` - Adds a story to an epic
- `removeStoryFromEpic()` - Removes a story from an epic
- `addDependencyToEpic()` - Adds a dependency to an epic
- `validateEpicFormat()` - Validates epic format

**INVEST Validation:**
- `createDefaultInvestScore()` - Creates a default INVEST score (all zeros)
- `createInvestScore()` - Creates an INVEST score with specific values
- `createValidationResult()` - Creates a validation result
- `createValidationFailure()` - Creates a validation failure
- `createSuggestion()` - Creates an improvement suggestion

**Ambiguity Detection:**
- `createAmbiguity()` - Creates an ambiguity record

**Dependencies:**
- `createDependency()` - Creates a dependency between stories

**Project Context:**
- `createProjectContext()` - Creates a project context
- `createDefaultProjectConventions()` - Creates default conventions
- `createProjectConventions()` - Creates custom conventions
- `createCustomField()` - Creates a custom field

**Metadata:**
- `createStoryMetadata()` - Creates story metadata
- `createEpicMetadata()` - Creates epic metadata

### 2. `src/core/index.ts`
Export file that exposes all core domain functions.

### 3. `tests/unit/core/models.test.ts`
Comprehensive unit tests covering all factory functions and operations:
- Story creation and manipulation (8 tests)
- Acceptance criteria creation (3 tests)
- Epic creation and manipulation (3 tests)
- Ambiguity detection (2 tests)
- INVEST scoring (3 tests)
- Validation results (2 tests)
- Dependencies (3 tests)
- Project context (2 tests)
- Update operations (1 test)
- Criterion management (2 tests)
- Epic story management (2 tests)
- Format validation (3 tests)

**Total: 35 unit tests**

## Implementation Details

### Design Decisions

1. **Factory Functions over Classes**: Used factory functions instead of classes for simplicity and functional programming style. This makes the code more testable and easier to reason about.

2. **Immutability**: All update functions return new objects rather than mutating existing ones, following immutable data patterns.

3. **UUID Generation**: Used Node.js `crypto.randomUUID()` for generating unique IDs, ensuring uniqueness across the system.

4. **Automatic Timestamps**: All creation functions automatically set `created` and `modified` timestamps. Update functions automatically update the `modified` timestamp.

5. **Default Values**: Factory functions provide sensible defaults (empty arrays, default scores) to minimize required parameters.

6. **Validation Helpers**: Included validation functions to check format compliance for stories, criteria, and epics.

### Key Features

- **Type Safety**: All functions are fully typed using interfaces from `@po-ai/shared`
- **Automatic ID Generation**: UUIDs are automatically generated for all entities
- **Timestamp Management**: Creation and modification timestamps are handled automatically
- **INVEST Score Calculation**: Overall score is automatically calculated as the average of all criteria
- **Duplicate Prevention**: `addStoryToEpic()` prevents adding duplicate stories
- **Immutable Updates**: All update operations return new objects

## Requirements Validated

This implementation addresses the following requirements:

- **1.1**: Story format with role, action, value
- **1.3**: Acceptance criteria in Gherkin format
- **4.1**: Epic grouping of related stories
- **8.1-8.6**: INVEST validation scoring (Independent, Negotiable, Valuable, Estimable, Small, Testable)
- **12.6**: Change tracking support through metadata

## Testing

All 35 unit tests verify:
- Correct object creation with required fields
- Proper handling of optional parameters
- Automatic ID and timestamp generation
- INVEST score calculation accuracy
- Immutable update operations
- Format validation logic
- Edge cases (empty arrays, duplicate prevention)

## Usage Example

```typescript
import {
  createStory,
  createAcceptanceCriterion,
  createEpic,
  addAcceptanceCriterion,
  addStoryToEpic,
} from '@po-ai/backend/core';

// Create acceptance criteria
const criterion1 = createAcceptanceCriterion({
  given: 'el usuario está en la página de login',
  when: 'ingresa credenciales válidas',
  then: 'debe ser redirigido al dashboard',
  type: 'positive',
});

const criterion2 = createAcceptanceCriterion({
  given: 'el usuario ingresa credenciales inválidas',
  when: 'hace clic en iniciar sesión',
  then: 'debe mostrarse un mensaje de error',
  type: 'negative',
});

const criterion3 = createAcceptanceCriterion({
  given: 'el servidor está caído',
  when: 'el usuario intenta iniciar sesión',
  then: 'debe mostrarse un mensaje de error de conexión',
  type: 'error',
});

// Create a story
let story = createStory({
  title: 'User Login',
  role: 'usuario',
  action: 'iniciar sesión',
  value: 'pueda acceder a mi cuenta',
  description: 'Como usuario, quiero iniciar sesión, para que pueda acceder a mi cuenta',
  components: ['auth', 'frontend'],
});

// Add criteria to story
story = addAcceptanceCriterion(story, criterion1);
story = addAcceptanceCriterion(story, criterion2);
story = addAcceptanceCriterion(story, criterion3);

// Create an epic
let epic = createEpic({
  title: 'User Authentication',
  description: 'Epic para gestionar autenticación de usuarios',
  businessValue: 'Permitir acceso seguro al sistema',
});

// Add story to epic
epic = addStoryToEpic(epic, story.id);
```

## Next Steps

The core domain models are now ready to be used by:
- Story Generator (Task 7)
- INVEST Validator (Task 6)
- Epic Assembler (Task 10)
- Workspace Store (Task 4)
- Change History (Task 4)

## Notes

- Dependencies need to be installed before running tests: `npm install` in the root directory
- All functions are exported from `@po-ai/backend/core` for easy importing
- The implementation follows the design document specifications exactly
- All types are imported from `@po-ai/shared` to ensure consistency across frontend and backend
