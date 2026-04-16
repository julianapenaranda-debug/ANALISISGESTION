/**
 * Core Domain Models - Factory Functions
 * 
 * Este módulo proporciona funciones factory para crear instancias de los modelos de dominio core.
 * Trabaja con los tipos compartidos de @po-ai/shared.
 * 
 * Requerimientos: 1.1, 1.3, 4.1, 8.1-8.6, 12.6
 */

import {
  Story,
  AcceptanceCriterion,
  Epic,
  Ambiguity,
  InvestScore,
  ValidationResult,
  Dependency,
  ProjectContext,
  StoryMetadata,
  EpicMetadata,
  ValidationFailure,
  Suggestion,
  ProjectConventions,
  CustomField,
} from '@po-ai/shared';
import { randomUUID } from 'crypto';

// Re-export types for convenience
export type {
  Story,
  AcceptanceCriterion,
  Epic,
  Ambiguity,
  InvestScore,
  ValidationResult,
  Dependency,
  ProjectContext,
  StoryMetadata,
  EpicMetadata,
  ValidationFailure,
  Suggestion,
  ProjectConventions,
  CustomField,
};

/**
 * Crea una nueva historia de usuario con valores por defecto
 */
export function createStory(params: {
  title: string;
  role: string;
  action: string;
  value: string;
  description: string;
  acceptanceCriteria?: AcceptanceCriterion[];
  components?: string[];
  epicId?: string;
  investScore?: InvestScore;
  metadata?: Partial<StoryMetadata>;
}): Story {
  const now = new Date();
  
  return {
    id: randomUUID(),
    title: params.title,
    role: params.role,
    action: params.action,
    value: params.value,
    description: params.description,
    acceptanceCriteria: params.acceptanceCriteria || [],
    components: params.components || [],
    epicId: params.epicId,
    investScore: params.investScore || createDefaultInvestScore(),
    metadata: {
      created: now,
      modified: now,
      source: 'generated',
      ...params.metadata,
    },
  };
}

/**
 * Crea un nuevo criterio de aceptación en formato Gherkin
 */
export function createAcceptanceCriterion(params: {
  given: string;
  when: string;
  then: string;
  type: 'positive' | 'negative' | 'error';
}): AcceptanceCriterion {
  return {
    id: randomUUID(),
    given: params.given,
    when: params.when,
    then: params.then,
    type: params.type,
  };
}

/**
 * Crea una nueva épica
 */
export function createEpic(params: {
  title: string;
  description: string;
  businessValue: string;
  stories?: string[];
  dependencies?: Dependency[];
  metadata?: Partial<EpicMetadata>;
}): Epic {
  const now = new Date();
  
  return {
    id: randomUUID(),
    title: params.title,
    description: params.description,
    businessValue: params.businessValue,
    stories: params.stories || [],
    dependencies: params.dependencies || [],
    metadata: {
      created: now,
      modified: now,
      ...params.metadata,
    },
  };
}

/**
 * Crea una nueva ambigüedad detectada
 */
export function createAmbiguity(params: {
  type: 'vague_term' | 'missing_role' | 'missing_value' | 'unclear_scope';
  location: string;
  term: string;
  question: string;
  suggestions?: string[];
}): Ambiguity {
  return {
    id: randomUUID(),
    type: params.type,
    location: params.location,
    term: params.term,
    question: params.question,
    suggestions: params.suggestions || [],
  };
}

/**
 * Crea un score INVEST por defecto (todos en 0)
 */
export function createDefaultInvestScore(): InvestScore {
  return {
    independent: 0,
    negotiable: 0,
    valuable: 0,
    estimable: 0,
    small: 0,
    testable: 0,
    overall: 0,
  };
}

/**
 * Crea un score INVEST con valores específicos
 */
export function createInvestScore(scores: {
  independent: number;
  negotiable: number;
  valuable: number;
  estimable: number;
  small: number;
  testable: number;
}): InvestScore {
  const overall = (
    scores.independent +
    scores.negotiable +
    scores.valuable +
    scores.estimable +
    scores.small +
    scores.testable
  ) / 6;

  return {
    ...scores,
    overall,
  };
}

/**
 * Crea un resultado de validación
 */
export function createValidationResult(params: {
  isValid: boolean;
  score: InvestScore;
  failures?: ValidationFailure[];
  suggestions?: Suggestion[];
}): ValidationResult {
  return {
    isValid: params.isValid,
    score: params.score,
    failures: params.failures || [],
    suggestions: params.suggestions || [],
  };
}

/**
 * Crea un fallo de validación INVEST
 */
export function createValidationFailure(params: {
  criterion: 'I' | 'N' | 'V' | 'E' | 'S' | 'T';
  reason: string;
  severity: 'error' | 'warning';
}): ValidationFailure {
  return {
    criterion: params.criterion,
    reason: params.reason,
    severity: params.severity,
  };
}

/**
 * Crea una sugerencia de mejora
 */
export function createSuggestion(params: {
  criterion: string;
  improvement: string;
  example?: string;
}): Suggestion {
  return {
    criterion: params.criterion,
    improvement: params.improvement,
    example: params.example,
  };
}

/**
 * Crea una dependencia entre historias
 */
export function createDependency(params: {
  fromStoryId: string;
  toStoryId: string;
  type: 'blocks' | 'relates' | 'requires';
  reason: string;
}): Dependency {
  return {
    fromStoryId: params.fromStoryId,
    toStoryId: params.toStoryId,
    type: params.type,
    reason: params.reason,
  };
}

/**
 * Crea un contexto de proyecto
 */
export function createProjectContext(params: {
  projectKey: string;
  domain: string;
  existingComponents?: string[];
  userRoles?: string[];
  conventions?: ProjectConventions;
}): ProjectContext {
  return {
    projectKey: params.projectKey,
    domain: params.domain,
    existingComponents: params.existingComponents || [],
    userRoles: params.userRoles || ['usuario'],
    conventions: params.conventions || createDefaultProjectConventions(),
  };
}

/**
 * Crea convenciones de proyecto por defecto
 */
export function createDefaultProjectConventions(): ProjectConventions {
  return {
    storyPointScale: [1, 2, 3, 5, 8, 13],
    componentNaming: 'kebab-case',
    customFields: [],
  };
}

/**
 * Crea convenciones de proyecto personalizadas
 */
export function createProjectConventions(params: {
  storyPointScale?: number[];
  componentNaming?: string;
  customFields?: CustomField[];
}): ProjectConventions {
  return {
    storyPointScale: params.storyPointScale || [1, 2, 3, 5, 8, 13],
    componentNaming: params.componentNaming || 'kebab-case',
    customFields: params.customFields || [],
  };
}

/**
 * Crea un campo personalizado
 */
export function createCustomField(params: {
  name: string;
  type: string;
  required: boolean;
}): CustomField {
  return {
    name: params.name,
    type: params.type,
    required: params.required,
  };
}

/**
 * Crea metadatos de historia
 */
export function createStoryMetadata(params?: {
  source?: 'manual' | 'figma' | 'generated';
  figmaUrl?: string;
  jiraKey?: string;
  jiraId?: string;
}): StoryMetadata {
  const now = new Date();
  
  return {
    created: now,
    modified: now,
    source: params?.source || 'generated',
    figmaUrl: params?.figmaUrl,
    jiraKey: params?.jiraKey,
    jiraId: params?.jiraId,
  };
}

/**
 * Crea metadatos de épica
 */
export function createEpicMetadata(params?: {
  jiraKey?: string;
  jiraId?: string;
}): EpicMetadata {
  const now = new Date();
  
  return {
    created: now,
    modified: now,
    jiraKey: params?.jiraKey,
    jiraId: params?.jiraId,
  };
}

/**
 * Actualiza una historia existente con cambios
 */
export function updateStory(story: Story, changes: Partial<Story>): Story {
  return {
    ...story,
    ...changes,
    metadata: {
      ...story.metadata,
      modified: new Date(),
    },
  };
}

/**
 * Actualiza una épica existente con cambios
 */
export function updateEpic(epic: Epic, changes: Partial<Epic>): Epic {
  return {
    ...epic,
    ...changes,
    metadata: {
      ...epic.metadata,
      modified: new Date(),
    },
  };
}

/**
 * Agrega un criterio de aceptación a una historia
 */
export function addAcceptanceCriterion(
  story: Story,
  criterion: AcceptanceCriterion
): Story {
  return updateStory(story, {
    acceptanceCriteria: [...story.acceptanceCriteria, criterion],
  });
}

/**
 * Elimina un criterio de aceptación de una historia
 */
export function removeAcceptanceCriterion(
  story: Story,
  criterionId: string
): Story {
  return updateStory(story, {
    acceptanceCriteria: story.acceptanceCriteria.filter(
      (c) => c.id !== criterionId
    ),
  });
}

/**
 * Agrega una historia a una épica
 */
export function addStoryToEpic(epic: Epic, storyId: string): Epic {
  if (epic.stories.includes(storyId)) {
    return epic;
  }
  
  return updateEpic(epic, {
    stories: [...epic.stories, storyId],
  });
}

/**
 * Elimina una historia de una épica
 */
export function removeStoryFromEpic(epic: Epic, storyId: string): Epic {
  return updateEpic(epic, {
    stories: epic.stories.filter((id) => id !== storyId),
  });
}

/**
 * Agrega una dependencia a una épica
 */
export function addDependencyToEpic(epic: Epic, dependency: Dependency): Epic {
  return updateEpic(epic, {
    dependencies: [...epic.dependencies, dependency],
  });
}

/**
 * Valida que una historia tenga el formato correcto
 */
export function validateStoryFormat(story: Story): boolean {
  return !!(
    story.id &&
    story.title &&
    story.role &&
    story.action &&
    story.value &&
    story.description &&
    story.acceptanceCriteria.length >= 3
  );
}

/**
 * Valida que un criterio de aceptación tenga formato Gherkin correcto
 */
export function validateAcceptanceCriterionFormat(
  criterion: AcceptanceCriterion
): boolean {
  return !!(
    criterion.id &&
    criterion.given &&
    criterion.when &&
    criterion.then &&
    criterion.type
  );
}

/**
 * Valida que una épica tenga el formato correcto
 */
export function validateEpicFormat(epic: Epic): boolean {
  return !!(
    epic.id &&
    epic.title &&
    epic.description &&
    epic.businessValue &&
    epic.stories.length > 0
  );
}
