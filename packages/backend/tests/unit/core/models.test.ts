/**
 * Unit Tests for Core Domain Models
 * 
 * Tests factory functions and model operations
 */

import {
  createStory,
  createAcceptanceCriterion,
  createEpic,
  createAmbiguity,
  createDefaultInvestScore,
  createInvestScore,
  createValidationResult,
  createValidationFailure,
  createSuggestion,
  createDependency,
  createProjectContext,
  createDefaultProjectConventions,
  createProjectConventions,
  createCustomField,
  createStoryMetadata,
  createEpicMetadata,
  updateStory,
  updateEpic,
  addAcceptanceCriterion,
  removeAcceptanceCriterion,
  addStoryToEpic,
  removeStoryFromEpic,
  addDependencyToEpic,
  validateStoryFormat,
  validateAcceptanceCriterionFormat,
  validateEpicFormat,
} from '../../../src/core/models';

describe('Core Domain Models', () => {
  describe('createStory', () => {
    it('should create a story with all required fields', () => {
      const story = createStory({
        title: 'User Login',
        role: 'usuario',
        action: 'iniciar sesión',
        value: 'pueda acceder a mi cuenta',
        description: 'Como usuario, quiero iniciar sesión, para que pueda acceder a mi cuenta',
      });

      expect(story.id).toBeDefined();
      expect(story.title).toBe('User Login');
      expect(story.role).toBe('usuario');
      expect(story.action).toBe('iniciar sesión');
      expect(story.value).toBe('pueda acceder a mi cuenta');
      expect(story.acceptanceCriteria).toEqual([]);
      expect(story.components).toEqual([]);
      expect(story.metadata.created).toBeInstanceOf(Date);
      expect(story.metadata.modified).toBeInstanceOf(Date);
      expect(story.metadata.source).toBe('generated');
    });

    it('should create a story with acceptance criteria', () => {
      const criterion = createAcceptanceCriterion({
        given: 'el usuario está en la página de login',
        when: 'ingresa credenciales válidas',
        then: 'debe ser redirigido al dashboard',
        type: 'positive',
      });

      const story = createStory({
        title: 'User Login',
        role: 'usuario',
        action: 'iniciar sesión',
        value: 'pueda acceder a mi cuenta',
        description: 'Como usuario, quiero iniciar sesión, para que pueda acceder a mi cuenta',
        acceptanceCriteria: [criterion],
      });

      expect(story.acceptanceCriteria).toHaveLength(1);
      expect(story.acceptanceCriteria[0]).toEqual(criterion);
    });

    it('should create a story with components', () => {
      const story = createStory({
        title: 'User Login',
        role: 'usuario',
        action: 'iniciar sesión',
        value: 'pueda acceder a mi cuenta',
        description: 'Como usuario, quiero iniciar sesión, para que pueda acceder a mi cuenta',
        components: ['auth', 'frontend'],
      });

      expect(story.components).toEqual(['auth', 'frontend']);
    });

    it('should create a story with epicId', () => {
      const story = createStory({
        title: 'User Login',
        role: 'usuario',
        action: 'iniciar sesión',
        value: 'pueda acceder a mi cuenta',
        description: 'Como usuario, quiero iniciar sesión, para que pueda acceder a mi cuenta',
        epicId: 'epic-123',
      });

      expect(story.epicId).toBe('epic-123');
    });
  });

  describe('createAcceptanceCriterion', () => {
    it('should create a positive acceptance criterion', () => {
      const criterion = createAcceptanceCriterion({
        given: 'el usuario está autenticado',
        when: 'hace clic en el botón de guardar',
        then: 'los datos deben guardarse correctamente',
        type: 'positive',
      });

      expect(criterion.id).toBeDefined();
      expect(criterion.given).toBe('el usuario está autenticado');
      expect(criterion.when).toBe('hace clic en el botón de guardar');
      expect(criterion.then).toBe('los datos deben guardarse correctamente');
      expect(criterion.type).toBe('positive');
    });

    it('should create a negative acceptance criterion', () => {
      const criterion = createAcceptanceCriterion({
        given: 'el usuario no está autenticado',
        when: 'intenta acceder a una página protegida',
        then: 'debe ser redirigido al login',
        type: 'negative',
      });

      expect(criterion.type).toBe('negative');
    });

    it('should create an error acceptance criterion', () => {
      const criterion = createAcceptanceCriterion({
        given: 'el servidor está caído',
        when: 'el usuario intenta guardar',
        then: 'debe mostrarse un mensaje de error',
        type: 'error',
      });

      expect(criterion.type).toBe('error');
    });
  });

  describe('createEpic', () => {
    it('should create an epic with required fields', () => {
      const epic = createEpic({
        title: 'User Authentication',
        description: 'Epic para gestionar autenticación de usuarios',
        businessValue: 'Permitir acceso seguro al sistema',
      });

      expect(epic.id).toBeDefined();
      expect(epic.title).toBe('User Authentication');
      expect(epic.description).toBe('Epic para gestionar autenticación de usuarios');
      expect(epic.businessValue).toBe('Permitir acceso seguro al sistema');
      expect(epic.stories).toEqual([]);
      expect(epic.dependencies).toEqual([]);
      expect(epic.metadata.created).toBeInstanceOf(Date);
      expect(epic.metadata.modified).toBeInstanceOf(Date);
    });

    it('should create an epic with stories', () => {
      const epic = createEpic({
        title: 'User Authentication',
        description: 'Epic para gestionar autenticación de usuarios',
        businessValue: 'Permitir acceso seguro al sistema',
        stories: ['story-1', 'story-2'],
      });

      expect(epic.stories).toEqual(['story-1', 'story-2']);
    });

    it('should create an epic with dependencies', () => {
      const dependency = createDependency({
        fromStoryId: 'story-1',
        toStoryId: 'story-2',
        type: 'blocks',
        reason: 'Story 1 debe completarse antes de Story 2',
      });

      const epic = createEpic({
        title: 'User Authentication',
        description: 'Epic para gestionar autenticación de usuarios',
        businessValue: 'Permitir acceso seguro al sistema',
        dependencies: [dependency],
      });

      expect(epic.dependencies).toHaveLength(1);
      expect(epic.dependencies[0]).toEqual(dependency);
    });
  });

  describe('createAmbiguity', () => {
    it('should create a vague term ambiguity', () => {
      const ambiguity = createAmbiguity({
        type: 'vague_term',
        location: 'descripción principal',
        term: 'rápidamente',
        question: '¿Qué tiempo de respuesta específico se requiere?',
        suggestions: ['menos de 2 segundos', 'menos de 5 segundos'],
      });

      expect(ambiguity.id).toBeDefined();
      expect(ambiguity.type).toBe('vague_term');
      expect(ambiguity.term).toBe('rápidamente');
      expect(ambiguity.suggestions).toHaveLength(2);
    });

    it('should create a missing role ambiguity', () => {
      const ambiguity = createAmbiguity({
        type: 'missing_role',
        location: 'historia de usuario',
        term: '',
        question: '¿Qué tipo de usuario realizará esta acción?',
      });

      expect(ambiguity.type).toBe('missing_role');
    });
  });

  describe('createInvestScore', () => {
    it('should create a default INVEST score with all zeros', () => {
      const score = createDefaultInvestScore();

      expect(score.independent).toBe(0);
      expect(score.negotiable).toBe(0);
      expect(score.valuable).toBe(0);
      expect(score.estimable).toBe(0);
      expect(score.small).toBe(0);
      expect(score.testable).toBe(0);
      expect(score.overall).toBe(0);
    });

    it('should create an INVEST score with specific values', () => {
      const score = createInvestScore({
        independent: 0.9,
        negotiable: 0.8,
        valuable: 1.0,
        estimable: 0.7,
        small: 0.6,
        testable: 0.9,
      });

      expect(score.independent).toBe(0.9);
      expect(score.negotiable).toBe(0.8);
      expect(score.valuable).toBe(1.0);
      expect(score.estimable).toBe(0.7);
      expect(score.small).toBe(0.6);
      expect(score.testable).toBe(0.9);
      expect(score.overall).toBeCloseTo(0.817, 2);
    });

    it('should calculate overall score as average of all criteria', () => {
      const score = createInvestScore({
        independent: 1.0,
        negotiable: 1.0,
        valuable: 1.0,
        estimable: 1.0,
        small: 1.0,
        testable: 1.0,
      });

      expect(score.overall).toBe(1.0);
    });
  });

  describe('createValidationResult', () => {
    it('should create a valid validation result', () => {
      const score = createInvestScore({
        independent: 0.9,
        negotiable: 0.8,
        valuable: 1.0,
        estimable: 0.7,
        small: 0.6,
        testable: 0.9,
      });

      const result = createValidationResult({
        isValid: true,
        score,
      });

      expect(result.isValid).toBe(true);
      expect(result.score).toEqual(score);
      expect(result.failures).toEqual([]);
      expect(result.suggestions).toEqual([]);
    });

    it('should create an invalid validation result with failures', () => {
      const score = createDefaultInvestScore();
      const failure = createValidationFailure({
        criterion: 'I',
        reason: 'La historia depende de otra historia',
        severity: 'error',
      });

      const result = createValidationResult({
        isValid: false,
        score,
        failures: [failure],
      });

      expect(result.isValid).toBe(false);
      expect(result.failures).toHaveLength(1);
      expect(result.failures[0]).toEqual(failure);
    });
  });

  describe('createDependency', () => {
    it('should create a blocks dependency', () => {
      const dependency = createDependency({
        fromStoryId: 'story-1',
        toStoryId: 'story-2',
        type: 'blocks',
        reason: 'Story 1 debe completarse antes',
      });

      expect(dependency.fromStoryId).toBe('story-1');
      expect(dependency.toStoryId).toBe('story-2');
      expect(dependency.type).toBe('blocks');
      expect(dependency.reason).toBe('Story 1 debe completarse antes');
    });

    it('should create a relates dependency', () => {
      const dependency = createDependency({
        fromStoryId: 'story-1',
        toStoryId: 'story-2',
        type: 'relates',
        reason: 'Ambas historias están relacionadas',
      });

      expect(dependency.type).toBe('relates');
    });

    it('should create a requires dependency', () => {
      const dependency = createDependency({
        fromStoryId: 'story-1',
        toStoryId: 'story-2',
        type: 'requires',
        reason: 'Story 1 requiere Story 2',
      });

      expect(dependency.type).toBe('requires');
    });
  });

  describe('createProjectContext', () => {
    it('should create a project context with defaults', () => {
      const context = createProjectContext({
        projectKey: 'PROJ',
        domain: 'e-commerce',
      });

      expect(context.projectKey).toBe('PROJ');
      expect(context.domain).toBe('e-commerce');
      expect(context.existingComponents).toEqual([]);
      expect(context.userRoles).toEqual(['usuario']);
      expect(context.conventions).toBeDefined();
    });

    it('should create a project context with custom values', () => {
      const context = createProjectContext({
        projectKey: 'PROJ',
        domain: 'healthcare',
        existingComponents: ['auth', 'api', 'frontend'],
        userRoles: ['paciente', 'doctor', 'administrador'],
      });

      expect(context.existingComponents).toEqual(['auth', 'api', 'frontend']);
      expect(context.userRoles).toEqual(['paciente', 'doctor', 'administrador']);
    });
  });

  describe('updateStory', () => {
    it('should update story fields', () => {
      const story = createStory({
        title: 'Original Title',
        role: 'usuario',
        action: 'hacer algo',
        value: 'obtener valor',
        description: 'Descripción original',
      });

      const updated = updateStory(story, {
        title: 'Updated Title',
        description: 'Descripción actualizada',
      });

      expect(updated.title).toBe('Updated Title');
      expect(updated.description).toBe('Descripción actualizada');
      expect(updated.role).toBe('usuario'); // unchanged
      expect(updated.metadata.modified.getTime()).toBeGreaterThan(
        story.metadata.modified.getTime()
      );
    });
  });

  describe('addAcceptanceCriterion', () => {
    it('should add a criterion to a story', () => {
      const story = createStory({
        title: 'Test Story',
        role: 'usuario',
        action: 'hacer algo',
        value: 'obtener valor',
        description: 'Descripción',
      });

      const criterion = createAcceptanceCriterion({
        given: 'precondición',
        when: 'acción',
        then: 'resultado',
        type: 'positive',
      });

      const updated = addAcceptanceCriterion(story, criterion);

      expect(updated.acceptanceCriteria).toHaveLength(1);
      expect(updated.acceptanceCriteria[0]).toEqual(criterion);
    });

    it('should preserve existing criteria when adding new one', () => {
      const criterion1 = createAcceptanceCriterion({
        given: 'precondición 1',
        when: 'acción 1',
        then: 'resultado 1',
        type: 'positive',
      });

      const story = createStory({
        title: 'Test Story',
        role: 'usuario',
        action: 'hacer algo',
        value: 'obtener valor',
        description: 'Descripción',
        acceptanceCriteria: [criterion1],
      });

      const criterion2 = createAcceptanceCriterion({
        given: 'precondición 2',
        when: 'acción 2',
        then: 'resultado 2',
        type: 'negative',
      });

      const updated = addAcceptanceCriterion(story, criterion2);

      expect(updated.acceptanceCriteria).toHaveLength(2);
      expect(updated.acceptanceCriteria[0]).toEqual(criterion1);
      expect(updated.acceptanceCriteria[1]).toEqual(criterion2);
    });
  });

  describe('removeAcceptanceCriterion', () => {
    it('should remove a criterion from a story', () => {
      const criterion1 = createAcceptanceCriterion({
        given: 'precondición 1',
        when: 'acción 1',
        then: 'resultado 1',
        type: 'positive',
      });

      const criterion2 = createAcceptanceCriterion({
        given: 'precondición 2',
        when: 'acción 2',
        then: 'resultado 2',
        type: 'negative',
      });

      const story = createStory({
        title: 'Test Story',
        role: 'usuario',
        action: 'hacer algo',
        value: 'obtener valor',
        description: 'Descripción',
        acceptanceCriteria: [criterion1, criterion2],
      });

      const updated = removeAcceptanceCriterion(story, criterion1.id);

      expect(updated.acceptanceCriteria).toHaveLength(1);
      expect(updated.acceptanceCriteria[0]).toEqual(criterion2);
    });
  });

  describe('addStoryToEpic', () => {
    it('should add a story to an epic', () => {
      const epic = createEpic({
        title: 'Test Epic',
        description: 'Descripción',
        businessValue: 'Valor',
      });

      const updated = addStoryToEpic(epic, 'story-1');

      expect(updated.stories).toHaveLength(1);
      expect(updated.stories[0]).toBe('story-1');
    });

    it('should not add duplicate story to epic', () => {
      const epic = createEpic({
        title: 'Test Epic',
        description: 'Descripción',
        businessValue: 'Valor',
        stories: ['story-1'],
      });

      const updated = addStoryToEpic(epic, 'story-1');

      expect(updated.stories).toHaveLength(1);
    });
  });

  describe('removeStoryFromEpic', () => {
    it('should remove a story from an epic', () => {
      const epic = createEpic({
        title: 'Test Epic',
        description: 'Descripción',
        businessValue: 'Valor',
        stories: ['story-1', 'story-2'],
      });

      const updated = removeStoryFromEpic(epic, 'story-1');

      expect(updated.stories).toHaveLength(1);
      expect(updated.stories[0]).toBe('story-2');
    });
  });

  describe('validateStoryFormat', () => {
    it('should validate a correctly formatted story', () => {
      const criterion1 = createAcceptanceCriterion({
        given: 'precondición 1',
        when: 'acción 1',
        then: 'resultado 1',
        type: 'positive',
      });

      const criterion2 = createAcceptanceCriterion({
        given: 'precondición 2',
        when: 'acción 2',
        then: 'resultado 2',
        type: 'negative',
      });

      const criterion3 = createAcceptanceCriterion({
        given: 'precondición 3',
        when: 'acción 3',
        then: 'resultado 3',
        type: 'error',
      });

      const story = createStory({
        title: 'Test Story',
        role: 'usuario',
        action: 'hacer algo',
        value: 'obtener valor',
        description: 'Como usuario, quiero hacer algo, para que pueda obtener valor',
        acceptanceCriteria: [criterion1, criterion2, criterion3],
      });

      expect(validateStoryFormat(story)).toBe(true);
    });

    it('should reject a story with less than 3 acceptance criteria', () => {
      const story = createStory({
        title: 'Test Story',
        role: 'usuario',
        action: 'hacer algo',
        value: 'obtener valor',
        description: 'Descripción',
        acceptanceCriteria: [],
      });

      expect(validateStoryFormat(story)).toBe(false);
    });
  });

  describe('validateAcceptanceCriterionFormat', () => {
    it('should validate a correctly formatted criterion', () => {
      const criterion = createAcceptanceCriterion({
        given: 'precondición',
        when: 'acción',
        then: 'resultado',
        type: 'positive',
      });

      expect(validateAcceptanceCriterionFormat(criterion)).toBe(true);
    });
  });

  describe('validateEpicFormat', () => {
    it('should validate a correctly formatted epic', () => {
      const epic = createEpic({
        title: 'Test Epic',
        description: 'Descripción',
        businessValue: 'Valor',
        stories: ['story-1'],
      });

      expect(validateEpicFormat(epic)).toBe(true);
    });

    it('should reject an epic with no stories', () => {
      const epic = createEpic({
        title: 'Test Epic',
        description: 'Descripción',
        businessValue: 'Valor',
        stories: [],
      });

      expect(validateEpicFormat(epic)).toBe(false);
    });
  });
});
