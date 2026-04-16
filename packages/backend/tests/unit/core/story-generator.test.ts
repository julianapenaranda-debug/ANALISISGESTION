/**
 * Unit Tests - Story Generator
 * 
 * Pruebas unitarias para el generador de historias.
 * Valida: Requerimientos 1.1-1.5, 3.1-3.5, 10.1, 11.1-11.5, 12.1-12.3
 */

import { describe, it, expect } from '@jest/globals';
import {
  generateStories,
  detectAmbiguities,
  refineStory,
  suggestComponents,
} from '../../../src/core/story-generator';
import { createStory, createProjectContext } from '../../../src/core/models';

describe('Story Generator', () => {
  describe('detectAmbiguities()', () => {
    it('should detect vague terms', () => {
      const description = 'El sistema debe procesar datos rápidamente de manera eficiente';
      
      const ambiguities = detectAmbiguities(description);

      expect(ambiguities.length).toBeGreaterThan(0);
      expect(ambiguities.some(a => a.type === 'vague_term')).toBe(true);
      expect(ambiguities.some(a => a.term === 'rápidamente')).toBe(true);
    });

    it('should detect missing role', () => {
      const description = 'Crear una nueva tarea en el sistema';
      
      const ambiguities = detectAmbiguities(description);

      expect(ambiguities.some(a => a.type === 'missing_role')).toBe(true);
      expect(ambiguities.some(a => a.question.toLowerCase().includes('quién'))).toBe(true);
    });

    it('should detect missing value', () => {
      const description = 'Como usuario, quiero crear tareas';
      
      const ambiguities = detectAmbiguities(description);

      expect(ambiguities.some(a => a.type === 'missing_value')).toBe(true);
      expect(ambiguities.some(a => a.question.toLowerCase().includes('valor'))).toBe(true);
    });

    it('should detect unclear scope with short description', () => {
      const description = 'Login';
      
      const ambiguities = detectAmbiguities(description);

      expect(ambiguities.some(a => a.type === 'unclear_scope')).toBe(true);
    });

    it('should provide suggestions for each ambiguity', () => {
      const description = 'Procesar rápidamente';
      
      const ambiguities = detectAmbiguities(description);

      for (const ambiguity of ambiguities) {
        expect(ambiguity.suggestions.length).toBeGreaterThan(0);
        expect(ambiguity.question).toBeTruthy();
      }
    });

    it('should not detect ambiguities in well-formed description', () => {
      const description = 'Como usuario, quiero crear nuevas tareas en el sistema, para que pueda organizar mi trabajo diario de manera efectiva';
      
      const ambiguities = detectAmbiguities(description);

      // Puede haber algunas ambigüedades menores, pero no críticas
      const criticalAmbiguities = ambiguities.filter(
        a => a.type === 'missing_role' || a.type === 'missing_value'
      );
      expect(criticalAmbiguities.length).toBe(0);
    });
  });

  describe('generateStories()', () => {
    it('should generate stories from description', async () => {
      const input = {
        description: 'Como usuario, quiero crear tareas, para que pueda organizar mi trabajo',
      };

      const result = await generateStories(input);

      expect(result.stories.length).toBeGreaterThan(0);
      const story = result.stories[0];
      expect(story.role).toBeTruthy();
      expect(story.action).toBeTruthy();
      expect(story.value).toBeTruthy();
    });

    it('should generate at least 3 acceptance criteria', async () => {
      const input = {
        description: 'Como usuario, quiero editar mis tareas, para que pueda actualizar la información',
      };

      const result = await generateStories(input);

      expect(result.stories.length).toBeGreaterThan(0);
      const story = result.stories[0];
      expect(story.acceptanceCriteria.length).toBeGreaterThanOrEqual(3);
    });

    it('should include positive, negative, and error criteria', async () => {
      const input = {
        description: 'Como usuario, quiero eliminar tareas, para que pueda mantener mi lista organizada',
      };

      const result = await generateStories(input);

      const story = result.stories[0];
      const types = story.acceptanceCriteria.map(c => c.type);
      
      expect(types).toContain('positive');
      expect(types.some(t => t === 'negative' || t === 'error')).toBe(true);
    });

    it('should validate stories with INVEST', async () => {
      const input = {
        description: 'Como administrador, quiero ver reportes, para que pueda analizar el desempeño',
      };

      const result = await generateStories(input);

      const story = result.stories[0];
      expect(story.investScore).toBeDefined();
      expect(story.investScore.overall).toBeGreaterThanOrEqual(0);
      expect(story.investScore.overall).toBeLessThanOrEqual(1);
    });

    it('should not generate stories when critical ambiguities exist', async () => {
      const input = {
        description: 'Crear algo', // Muy vago, sin rol ni valor
      };

      const result = await generateStories(input);

      expect(result.stories.length).toBe(0);
      expect(result.ambiguities.length).toBeGreaterThan(0);
    });

    it('should use project context for role extraction', async () => {
      const context = createProjectContext({
        projectKey: 'TEST',
        domain: 'e-commerce',
        userRoles: ['cliente', 'vendedor'],
      });

      const input = {
        description: 'Quiero ver productos disponibles',
        context,
      };

      const result = await generateStories(input);

      const story = result.stories[0];
      expect(['cliente', 'vendedor']).toContain(story.role);
    });
  });

  describe('suggestComponents()', () => {
    it('should suggest authentication component for login-related stories', () => {
      const description = 'Como usuario, quiero iniciar sesión en el sistema';
      
      const components = suggestComponents(description);

      expect(components).toContain('authentication');
    });

    it('should suggest forms component for create/edit actions', () => {
      const description = 'Como usuario, quiero crear un nuevo formulario';
      
      const components = suggestComponents(description);

      expect(components).toContain('forms');
    });

    it('should suggest data-display for viewing lists', () => {
      const description = 'Como usuario, quiero ver una lista de tareas';
      
      const components = suggestComponents(description);

      expect(components).toContain('data-display');
    });

    it('should suggest search component for search/filter actions', () => {
      const description = 'Como usuario, quiero buscar productos por nombre';
      
      const components = suggestComponents(description);

      expect(components).toContain('search');
    });

    it('should use existing components from context', () => {
      const context = createProjectContext({
        projectKey: 'TEST',
        domain: 'e-commerce',
        existingComponents: ['shopping-cart', 'checkout'],
      });

      const description = 'Como cliente, quiero agregar productos al shopping-cart';
      
      const components = suggestComponents(description, context);

      expect(components).toContain('shopping-cart');
    });

    it('should suggest at least one component', () => {
      const description = 'Algo genérico';
      
      const components = suggestComponents(description);

      expect(components.length).toBeGreaterThan(0);
    });

    it('should not have duplicate components', () => {
      const description = 'Como usuario, quiero crear y editar formularios';
      
      const components = suggestComponents(description);

      const uniqueComponents = new Set(components);
      expect(components.length).toBe(uniqueComponents.size);
    });
  });

  describe('refineStory()', () => {
    it('should update story with changes', async () => {
      const story = createStory({
        title: 'Original Title',
        role: 'usuario',
        action: 'hacer algo',
        value: 'obtener valor',
        description: 'Descripción original',
        components: ['core'],
      });

      const changes = {
        title: 'New Title',
        action: 'hacer algo diferente',
      };

      const refined = await refineStory(story, changes);

      expect(refined.title).toBe('New Title');
      expect(refined.action).toBe('hacer algo diferente');
      expect(refined.role).toBe('usuario'); // Sin cambios
    });

    it('should re-validate INVEST after changes', async () => {
      const story = createStory({
        title: 'Test Story',
        role: 'usuario',
        action: 'hacer algo',
        value: 'obtener valor',
        description: 'Descripción',
        components: ['core'],
      });

      const changes = {
        description: 'Nueva descripción con términos vagos: rápidamente y eficientemente',
      };

      const refined = await refineStory(story, changes);

      expect(refined.investScore).toBeDefined();
      // El score de estimabilidad debería ser menor debido a términos vagos
      expect(refined.investScore.estimable).toBeLessThan(1.0);
    });

    it('should update metadata modified date', async () => {
      const story = createStory({
        title: 'Test Story',
        role: 'usuario',
        action: 'hacer algo',
        value: 'obtener valor',
        description: 'Descripción',
        components: ['core'],
      });

      const originalModified = story.metadata.modified;
      
      // Esperar un poco para asegurar que la fecha cambie
      await new Promise(resolve => setTimeout(resolve, 10));

      const refined = await refineStory(story, { title: 'New Title' });

      expect(refined.metadata.modified.getTime()).toBeGreaterThan(
        originalModified.getTime()
      );
    });

    it('should allow updating acceptance criteria', async () => {
      const story = createStory({
        title: 'Test Story',
        role: 'usuario',
        action: 'hacer algo',
        value: 'obtener valor',
        description: 'Descripción',
        components: ['core'],
      });

      const newCriteria = [
        {
          id: 'ac-1',
          given: 'el usuario está en la página principal',
          when: 'el usuario hace clic en el botón',
          then: 'se muestra el resultado esperado',
          type: 'positive' as const,
        },
      ];

      const refined = await refineStory(story, {
        acceptanceCriteria: newCriteria,
      });

      expect(refined.acceptanceCriteria.length).toBe(1);
      expect(refined.acceptanceCriteria[0].given).toBe('el usuario está en la página principal');
    });

    it('should allow updating components', async () => {
      const story = createStory({
        title: 'Test Story',
        role: 'usuario',
        action: 'hacer algo',
        value: 'obtener valor',
        description: 'Descripción',
        components: ['core'],
      });

      const refined = await refineStory(story, {
        components: ['authentication', 'forms'],
      });

      expect(refined.components).toEqual(['authentication', 'forms']);
    });

    it('should preserve unchanged fields', async () => {
      const story = createStory({
        title: 'Test Story',
        role: 'usuario',
        action: 'hacer algo',
        value: 'obtener valor',
        description: 'Descripción original',
        components: ['core'],
      });

      const refined = await refineStory(story, {
        title: 'New Title',
      });

      expect(refined.title).toBe('New Title');
      expect(refined.role).toBe('usuario');
      expect(refined.action).toBe('hacer algo');
      expect(refined.value).toBe('obtener valor');
      expect(refined.description).toBe('Descripción original');
      expect(refined.components).toEqual(['core']);
    });
  });

  describe('generateStories() - Specific Descriptions', () => {
    it('should generate story for e-commerce product search', async () => {
      const input = {
        description: 'Como cliente, quiero buscar productos por categoría y precio, para que pueda encontrar lo que necesito rápidamente',
      };

      const result = await generateStories(input);

      expect(result.stories.length).toBeGreaterThan(0);
      const story = result.stories[0];
      expect(story.role).toBe('cliente');
      expect(story.action).toContain('buscar');
      expect(story.components).toContain('search');
    });

    it('should generate story for admin dashboard', async () => {
      const input = {
        description: 'Como administrador, quiero ver un dashboard con métricas del sistema, para que pueda monitorear el desempeño',
      };

      const result = await generateStories(input);

      expect(result.stories.length).toBeGreaterThan(0);
      const story = result.stories[0];
      expect(story.role).toBe('administrador');
      expect(story.action).toContain('ver');
      expect(story.components).toContain('reporting');
    });

    it('should generate story for data export', async () => {
      const input = {
        description: 'Como usuario, quiero exportar mis datos en formato CSV, para que pueda analizarlos en Excel',
      };

      const result = await generateStories(input);

      expect(result.stories.length).toBeGreaterThan(0);
      const story = result.stories[0];
      expect(story.role).toBe('usuario');
      expect(story.action).toContain('exportar');
      expect(story.components).toContain('data-import-export');
    });

    it('should generate story for notification system', async () => {
      const input = {
        description: 'Como usuario, quiero recibir notificaciones cuando alguien comenta en mis publicaciones, para que pueda responder rápidamente',
      };

      const result = await generateStories(input);

      expect(result.stories.length).toBeGreaterThan(0);
      const story = result.stories[0];
      expect(story.components).toContain('notifications');
    });
  });

  describe('detectAmbiguities() - Known Vague Terms', () => {
    it('should detect "rápidamente"', () => {
      const description = 'El sistema debe cargar rápidamente';
      const ambiguities = detectAmbiguities(description);
      
      expect(ambiguities.some(a => a.term === 'rápidamente')).toBe(true);
    });

    it('should detect "adecuado"', () => {
      const description = 'Debe tener un tamaño adecuado';
      const ambiguities = detectAmbiguities(description);
      
      expect(ambiguities.some(a => a.term === 'adecuado')).toBe(true);
    });

    it('should detect "user-friendly"', () => {
      const description = 'La interfaz debe ser user-friendly';
      const ambiguities = detectAmbiguities(description);
      
      expect(ambiguities.some(a => a.term === 'user-friendly')).toBe(true);
    });

    it('should detect "eficiente"', () => {
      const description = 'El proceso debe ser eficiente';
      const ambiguities = detectAmbiguities(description);
      
      expect(ambiguities.some(a => a.term === 'eficiente')).toBe(true);
    });

    it('should detect "intuitivo"', () => {
      const description = 'El diseño debe ser intuitivo';
      const ambiguities = detectAmbiguities(description);
      
      expect(ambiguities.some(a => a.term === 'intuitivo')).toBe(true);
    });

    it('should detect multiple vague terms', () => {
      const description = 'El sistema debe ser rápido, eficiente y fácil de usar';
      const ambiguities = detectAmbiguities(description);
      
      const vagueTerms = ambiguities.filter(a => a.type === 'vague_term');
      expect(vagueTerms.length).toBeGreaterThanOrEqual(2);
    });

    it('should detect "muchos", "varios", "algunos"', () => {
      const description = 'Debe soportar muchos usuarios simultáneos';
      const ambiguities = detectAmbiguities(description);
      
      expect(ambiguities.some(a => a.term === 'muchos')).toBe(true);
    });

    it('should detect "mejor"', () => {
      const description = 'Debe proporcionar una mejor experiencia';
      const ambiguities = detectAmbiguities(description);
      
      expect(ambiguities.some(a => a.term === 'mejor')).toBe(true);
    });
  });

  describe('generateStories() - Empty and Invalid Descriptions', () => {
    it('should handle empty description', async () => {
      const input = {
        description: '',
      };

      const result = await generateStories(input);

      // Debe detectar ambigüedades críticas
      expect(result.ambiguities.length).toBeGreaterThan(0);
      expect(result.stories.length).toBe(0);
    });

    it('should handle very short description', async () => {
      const input = {
        description: 'Login',
      };

      const result = await generateStories(input);

      // Debe detectar unclear_scope
      expect(result.ambiguities.some(a => a.type === 'unclear_scope')).toBe(true);
    });

    it('should handle description with only whitespace', async () => {
      const input = {
        description: '   ',
      };

      const result = await generateStories(input);

      expect(result.ambiguities.length).toBeGreaterThan(0);
      expect(result.stories.length).toBe(0);
    });

    it('should handle description without role or value', async () => {
      const input = {
        description: 'Crear tareas',
      };

      const result = await generateStories(input);

      // Debe detectar missing_role y missing_value
      expect(result.ambiguities.some(a => a.type === 'missing_role')).toBe(true);
      expect(result.ambiguities.some(a => a.type === 'missing_value')).toBe(true);
      expect(result.stories.length).toBe(0);
    });

    it('should handle description with role but no value', async () => {
      const input = {
        description: 'Como usuario, quiero crear tareas',
      };

      const result = await generateStories(input);

      expect(result.ambiguities.some(a => a.type === 'missing_value')).toBe(true);
      expect(result.stories.length).toBe(0);
    });

    it('should handle description with value but no role', async () => {
      const input = {
        description: 'Quiero crear tareas para que pueda organizar mi trabajo',
      };

      const result = await generateStories(input);

      expect(result.ambiguities.some(a => a.type === 'missing_role')).toBe(true);
      expect(result.stories.length).toBe(0);
    });
  });

  describe('Acceptance Criteria Format', () => {
    it('should generate criteria in Gherkin format', async () => {
      const input = {
        description: 'Como usuario, quiero crear tareas, para que pueda organizar mi trabajo',
      };

      const result = await generateStories(input);

      const story = result.stories[0];
      for (const criterion of story.acceptanceCriteria) {
        expect(criterion.given).toBeTruthy();
        expect(criterion.when).toBeTruthy();
        expect(criterion.then).toBeTruthy();
        expect(['positive', 'negative', 'error']).toContain(criterion.type);
      }
    });

    it('should not include vague terms in acceptance criteria', async () => {
      const input = {
        description: 'Como usuario, quiero buscar productos, para que pueda encontrar lo que necesito',
      };

      const result = await generateStories(input);

      const story = result.stories[0];
      const vagueTerm = ['rápidamente', 'adecuado', 'user-friendly', 'eficiente', 'intuitivo'];
      
      for (const criterion of story.acceptanceCriteria) {
        const criterionText = `${criterion.given} ${criterion.when} ${criterion.then}`.toLowerCase();
        for (const term of vagueTerm) {
          expect(criterionText).not.toContain(term);
        }
      }
    });

    it('should include at least one error handling criterion', async () => {
      const input = {
        description: 'Como usuario, quiero eliminar tareas, para que pueda mantener mi lista limpia',
      };

      const result = await generateStories(input);

      const story = result.stories[0];
      const errorCriteria = story.acceptanceCriteria.filter(c => c.type === 'error');
      
      expect(errorCriteria.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Component Suggestion Edge Cases', () => {
    it('should handle description with no matching keywords', () => {
      const description = 'Algo completamente genérico sin palabras clave';
      
      const components = suggestComponents(description);

      expect(components.length).toBeGreaterThan(0);
      expect(components).toContain('core');
    });

    it('should merge context components with suggested components', () => {
      const context = createProjectContext({
        projectKey: 'TEST',
        domain: 'e-commerce',
        existingComponents: ['payment', 'inventory'],
      });

      const description = 'Como usuario, quiero procesar un payment para completar mi compra';
      
      const components = suggestComponents(description, context);

      expect(components).toContain('payment');
    });

    it('should not duplicate components from context', () => {
      const context = createProjectContext({
        projectKey: 'TEST',
        domain: 'e-commerce',
        existingComponents: ['authentication', 'forms'],
      });

      const description = 'Como usuario, quiero crear un formulario de authentication';
      
      const components = suggestComponents(description, context);

      const authCount = components.filter(c => c === 'authentication').length;
      const formsCount = components.filter(c => c === 'forms').length;
      
      expect(authCount).toBe(1);
      expect(formsCount).toBe(1);
    });
  });

  describe('Story Title Generation', () => {
    it('should generate descriptive titles', async () => {
      const input = {
        description: 'Como administrador, quiero configurar permisos de usuario, para que pueda controlar el acceso',
      };

      const result = await generateStories(input);

      const story = result.stories[0];
      expect(story.title).toBeTruthy();
      expect(story.title.length).toBeGreaterThan(5);
      expect(story.title).toContain('administrador');
    });
  });
});
