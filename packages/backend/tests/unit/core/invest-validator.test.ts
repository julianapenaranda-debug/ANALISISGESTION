/**
 * Unit Tests - INVEST Validator
 * 
 * Pruebas unitarias para el validador INVEST.
 * Valida: Requerimientos 8.1-8.7
 */

import { describe, it, expect } from '@jest/globals';
import { validate, suggestImprovements } from '../../../src/core/invest-validator';
import { createStory, createAcceptanceCriterion } from '../../../src/core/models';

describe('INVEST Validator', () => {
  describe('validate()', () => {
    it('should validate a well-formed story with high scores', () => {
      const story = createStory({
        title: 'Usuario - Ver dashboard',
        role: 'usuario',
        action: 'ver mi dashboard personalizado',
        value: 'pueda acceder rápidamente a la información más relevante',
        description: 'El usuario necesita ver un dashboard con información relevante',
        acceptanceCriteria: [
          createAcceptanceCriterion({
            given: 'el usuario está autenticado',
            when: 'el usuario accede al dashboard',
            then: 'el sistema muestra los widgets configurados',
            type: 'positive',
          }),
          createAcceptanceCriterion({
            given: 'el usuario tiene widgets configurados',
            when: 'el sistema carga el dashboard',
            then: 'los datos se muestran actualizados',
            type: 'positive',
          }),
          createAcceptanceCriterion({
            given: 'el usuario no tiene widgets configurados',
            when: 'el usuario accede al dashboard',
            then: 'el sistema muestra un mensaje de bienvenida',
            type: 'negative',
          }),
        ],
        components: ['dashboard', 'widgets'],
      });

      const result = validate(story);

      expect(result.score.overall).toBeGreaterThan(0.6);
      expect(result.score.testable).toBeGreaterThan(0.8);
    });

    it('should detect missing value and mark as invalid', () => {
      const story = createStory({
        title: 'Test Story',
        role: 'usuario',
        action: 'hacer algo',
        value: '', // Valor vacío
        description: 'Una descripción',
        acceptanceCriteria: [
          createAcceptanceCriterion({
            given: 'contexto',
            when: 'acción',
            then: 'resultado',
            type: 'positive',
          }),
        ],
        components: ['core'],
      });

      const result = validate(story);

      expect(result.score.valuable).toBeLessThan(0.7);
      expect(result.failures.some(f => f.criterion === 'V')).toBe(true);
    });

    it('should detect vague terms and reduce estimability score', () => {
      const story = createStory({
        title: 'Test Story',
        role: 'usuario',
        action: 'procesar datos rápidamente',
        value: 'pueda trabajar de manera eficiente',
        description: 'El sistema debe procesar los datos rápidamente y de forma adecuada',
        acceptanceCriteria: [
          createAcceptanceCriterion({
            given: 'hay datos disponibles',
            when: 'el usuario solicita procesamiento',
            then: 'el sistema procesa rápidamente',
            type: 'positive',
          }),
        ],
        components: ['processing'],
      });

      const result = validate(story);

      expect(result.score.estimable).toBeLessThan(0.7);
      expect(result.failures.some(f => f.criterion === 'E')).toBe(true);
    });

    it('should detect large stories with many criteria', () => {
      const manyCriteria = Array.from({ length: 10 }, (_, i) =>
        createAcceptanceCriterion({
          given: `contexto ${i}`,
          when: `acción ${i}`,
          then: `resultado ${i}`,
          type: 'positive',
        })
      );

      const story = createStory({
        title: 'Large Story',
        role: 'usuario',
        action: 'realizar múltiples operaciones',
        value: 'pueda completar todas mis tareas',
        description: 'Historia con muchos criterios',
        acceptanceCriteria: manyCriteria,
        components: ['comp1', 'comp2', 'comp3', 'comp4', 'comp5', 'comp6'],
      });

      const result = validate(story);

      expect(result.score.small).toBeLessThan(0.7);
      expect(result.failures.some(f => f.criterion === 'S')).toBe(true);
    });

    it('should detect insufficient acceptance criteria', () => {
      const story = createStory({
        title: 'Test Story',
        role: 'usuario',
        action: 'hacer algo',
        value: 'pueda lograr mi objetivo',
        description: 'Una descripción',
        acceptanceCriteria: [
          createAcceptanceCriterion({
            given: 'contexto',
            when: 'acción',
            then: 'resultado',
            type: 'positive',
          }),
        ], // Solo 1 criterio, se requieren al menos 3
        components: ['core'],
      });

      const result = validate(story);

      expect(result.score.testable).toBeLessThan(0.7);
      expect(result.failures.some(f => f.criterion === 'T')).toBe(true);
    });

    it('should detect implementation details in description', () => {
      const story = createStory({
        title: 'Test Story',
        role: 'usuario',
        action: 'guardar datos usando una API REST',
        value: 'pueda persistir información',
        description: 'Implementar mediante una base de datos PostgreSQL con tabla users',
        acceptanceCriteria: [
          createAcceptanceCriterion({
            given: 'el usuario tiene datos',
            when: 'el usuario guarda',
            then: 'los datos se almacenan en la base de datos',
            type: 'positive',
          }),
        ],
        components: ['database'],
      });

      const result = validate(story);

      expect(result.score.negotiable).toBeLessThan(0.7);
      expect(result.failures.some(f => f.criterion === 'N')).toBe(true);
    });

    it('should detect dependency indicators', () => {
      const story = createStory({
        title: 'Test Story',
        role: 'usuario',
        action: 'editar perfil',
        value: 'pueda actualizar mi información',
        description: 'Después de implementar el login, el usuario puede editar su perfil',
        acceptanceCriteria: [
          createAcceptanceCriterion({
            given: 'el login está implementado',
            when: 'el usuario edita su perfil',
            then: 'los cambios se guardan',
            type: 'positive',
          }),
        ],
        components: ['profile'],
      });

      const result = validate(story);

      expect(result.score.independent).toBeLessThan(0.7);
      expect(result.failures.some(f => f.criterion === 'I')).toBe(true);
    });
  });

  describe('suggestImprovements()', () => {
    it('should provide suggestions for failed criteria', () => {
      const story = createStory({
        title: 'Test Story',
        role: 'usuario',
        action: 'hacer algo rápidamente',
        value: 'funcione bien',
        description: 'Después de otra historia, usando una API',
        acceptanceCriteria: [
          createAcceptanceCriterion({
            given: 'contexto',
            when: 'acción',
            then: 'resultado',
            type: 'positive',
          }),
        ],
        components: ['core'],
      });

      const result = validate(story);
      const suggestions = suggestImprovements(story, result.failures);

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.some(s => s.criterion.includes('Independent'))).toBe(true);
      expect(suggestions.some(s => s.criterion.includes('Negotiable'))).toBe(true);
      expect(suggestions.some(s => s.criterion.includes('Valuable'))).toBe(true);
      expect(suggestions.some(s => s.criterion.includes('Estimable'))).toBe(true);
    });

    it('should provide specific improvement examples', () => {
      const story = createStory({
        title: 'Test Story',
        role: 'usuario',
        action: 'procesar rápidamente',
        value: 'sea mejor',
        description: 'Procesar datos rápidamente',
        acceptanceCriteria: [
          createAcceptanceCriterion({
            given: 'hay datos',
            when: 'se procesan',
            then: 'se procesan rápido',
            type: 'positive',
          }),
        ],
        components: ['processing'],
      });

      const result = validate(story);
      const suggestions = suggestImprovements(story, result.failures);

      const estimableSuggestion = suggestions.find(s => 
        s.criterion.includes('Estimable')
      );

      expect(estimableSuggestion).toBeDefined();
      expect(estimableSuggestion?.example).toBeDefined();
      expect(estimableSuggestion?.example).toContain('2 segundos');
    });
  });

  describe('Independent Criterion - Detailed Tests', () => {
    it('should pass when story has no dependency indicators', () => {
      const story = createStory({
        title: 'Usuario - Ver perfil',
        role: 'usuario',
        action: 'ver mi perfil',
        value: 'pueda revisar mi información personal',
        description: 'El usuario puede acceder a su perfil y ver su información',
        acceptanceCriteria: [
          createAcceptanceCriterion({
            given: 'el usuario está autenticado',
            when: 'accede a su perfil',
            then: 've su información personal',
            type: 'positive',
          }),
          createAcceptanceCriterion({
            given: 'el usuario no está autenticado',
            when: 'intenta acceder al perfil',
            then: 'es redirigido al login',
            type: 'negative',
          }),
          createAcceptanceCriterion({
            given: 'hay un error de red',
            when: 'se carga el perfil',
            then: 'se muestra un mensaje de error',
            type: 'error',
          }),
        ],
        components: ['profile'],
      });

      const result = validate(story);
      expect(result.score.independent).toBeGreaterThanOrEqual(0.8);
    });

    it('should fail when story mentions "después de"', () => {
      const story = createStory({
        title: 'Test Story',
        role: 'usuario',
        action: 'editar perfil',
        value: 'pueda actualizar mi información',
        description: 'Después de implementar el login, permitir edición de perfil',
        acceptanceCriteria: [
          createAcceptanceCriterion({
            given: 'el usuario está logueado',
            when: 'edita su perfil',
            then: 'los cambios se guardan',
            type: 'positive',
          }),
        ],
        components: ['profile'],
      });

      const result = validate(story);
      expect(result.score.independent).toBeLessThan(0.7);
    });

    it('should fail when story mentions "requiere que"', () => {
      const story = createStory({
        title: 'Test Story',
        role: 'usuario',
        action: 'exportar datos',
        value: 'pueda descargar mi información',
        description: 'Requiere que el módulo de reportes esté implementado',
        acceptanceCriteria: [
          createAcceptanceCriterion({
            given: 'el usuario tiene datos',
            when: 'solicita exportación',
            then: 'recibe un archivo',
            type: 'positive',
          }),
        ],
        components: ['export'],
      });

      const result = validate(story);
      expect(result.score.independent).toBeLessThan(0.7);
    });
  });

  describe('Negotiable Criterion - Detailed Tests', () => {
    it('should pass when story describes what, not how', () => {
      const story = createStory({
        title: 'Usuario - Guardar preferencias',
        role: 'usuario',
        action: 'guardar mis preferencias',
        value: 'pueda personalizar mi experiencia',
        description: 'El usuario puede configurar y guardar sus preferencias de la aplicación',
        acceptanceCriteria: [
          createAcceptanceCriterion({
            given: 'el usuario modifica sus preferencias',
            when: 'guarda los cambios',
            then: 'las preferencias se persisten',
            type: 'positive',
          }),
          createAcceptanceCriterion({
            given: 'el usuario cierra sesión',
            when: 'vuelve a iniciar sesión',
            then: 've sus preferencias guardadas',
            type: 'positive',
          }),
          createAcceptanceCriterion({
            given: 'hay un error al guardar',
            when: 'se intenta persistir',
            then: 'se muestra un mensaje de error',
            type: 'error',
          }),
        ],
        components: ['preferences'],
      });

      const result = validate(story);
      expect(result.score.negotiable).toBeGreaterThanOrEqual(0.8);
    });

    it('should fail when story mentions specific technology', () => {
      const story = createStory({
        title: 'Test Story',
        role: 'usuario',
        action: 'guardar datos usando PostgreSQL',
        value: 'pueda persistir información',
        description: 'Implementar mediante una base de datos PostgreSQL con tabla users',
        acceptanceCriteria: [
          createAcceptanceCriterion({
            given: 'el usuario tiene datos',
            when: 'guarda',
            then: 'se almacenan en la tabla',
            type: 'positive',
          }),
        ],
        components: ['database'],
      });

      const result = validate(story);
      expect(result.score.negotiable).toBeLessThan(0.7);
    });

    it('should fail when story mentions API implementation', () => {
      const story = createStory({
        title: 'Test Story',
        role: 'usuario',
        action: 'obtener datos mediante API REST',
        value: 'pueda acceder a información',
        description: 'Crear endpoint /api/users con método GET',
        acceptanceCriteria: [
          createAcceptanceCriterion({
            given: 'el endpoint está disponible',
            when: 'se hace una petición GET',
            then: 'retorna los datos',
            type: 'positive',
          }),
        ],
        components: ['api'],
      });

      const result = validate(story);
      expect(result.score.negotiable).toBeLessThan(0.7);
    });
  });

  describe('Valuable Criterion - Detailed Tests', () => {
    it('should pass when story has clear business value', () => {
      const story = createStory({
        title: 'Usuario - Filtrar resultados',
        role: 'usuario',
        action: 'filtrar los resultados de búsqueda',
        value: 'pueda encontrar rápidamente la información que necesito y ahorrar tiempo',
        description: 'El usuario puede aplicar filtros para refinar los resultados',
        acceptanceCriteria: [
          createAcceptanceCriterion({
            given: 'hay resultados de búsqueda',
            when: 'aplica un filtro',
            then: 'solo ve resultados que cumplen el criterio',
            type: 'positive',
          }),
          createAcceptanceCriterion({
            given: 'no hay resultados que cumplan el filtro',
            when: 'aplica el filtro',
            then: 've un mensaje indicando que no hay resultados',
            type: 'negative',
          }),
          createAcceptanceCriterion({
            given: 'hay un error al aplicar el filtro',
            when: 'se procesa la solicitud',
            then: 'se muestra un mensaje de error',
            type: 'error',
          }),
        ],
        components: ['search', 'filters'],
      });

      const result = validate(story);
      expect(result.score.valuable).toBeGreaterThanOrEqual(0.9);
    });

    it('should fail when value is empty', () => {
      const story = createStory({
        title: 'Test Story',
        role: 'usuario',
        action: 'hacer algo',
        value: '',
        description: 'Una descripción',
        acceptanceCriteria: [
          createAcceptanceCriterion({
            given: 'contexto',
            when: 'acción',
            then: 'resultado',
            type: 'positive',
          }),
        ],
        components: ['core'],
      });

      const result = validate(story);
      expect(result.score.valuable).toBeLessThan(0.7);
    });

    it('should fail when value is too short', () => {
      const story = createStory({
        title: 'Test Story',
        role: 'usuario',
        action: 'hacer algo',
        value: 'útil',
        description: 'Una descripción',
        acceptanceCriteria: [
          createAcceptanceCriterion({
            given: 'contexto',
            when: 'acción',
            then: 'resultado',
            type: 'positive',
          }),
        ],
        components: ['core'],
      });

      const result = validate(story);
      expect(result.score.valuable).toBeLessThan(0.7);
    });

    it('should fail when value is generic', () => {
      const story = createStory({
        title: 'Test Story',
        role: 'usuario',
        action: 'usar el sistema',
        value: 'para que funcione bien y sea mejor',
        description: 'Una descripción',
        acceptanceCriteria: [
          createAcceptanceCriterion({
            given: 'contexto',
            when: 'acción',
            then: 'resultado',
            type: 'positive',
          }),
        ],
        components: ['core'],
      });

      const result = validate(story);
      expect(result.score.valuable).toBeLessThan(0.9);
    });
  });

  describe('Estimable Criterion - Detailed Tests', () => {
    it('should pass when story has no vague terms', () => {
      const story = createStory({
        title: 'Usuario - Cargar dashboard',
        role: 'usuario',
        action: 'cargar mi dashboard en menos de 2 segundos',
        value: 'pueda acceder a mi información sin esperas prolongadas',
        description: 'El dashboard debe cargar en menos de 2 segundos con hasta 100 widgets',
        acceptanceCriteria: [
          createAcceptanceCriterion({
            given: 'el usuario tiene menos de 100 widgets',
            when: 'accede al dashboard',
            then: 'la página carga en menos de 2 segundos',
            type: 'positive',
          }),
          createAcceptanceCriterion({
            given: 'el usuario tiene más de 100 widgets',
            when: 'accede al dashboard',
            then: 'se muestra un mensaje de optimización',
            type: 'negative',
          }),
          createAcceptanceCriterion({
            given: 'hay un error de red',
            when: 'se carga el dashboard',
            then: 'se muestra un mensaje de error',
            type: 'error',
          }),
        ],
        components: ['dashboard'],
      });

      const result = validate(story);
      expect(result.score.estimable).toBeGreaterThanOrEqual(0.9);
    });

    it('should detect multiple vague terms', () => {
      const story = createStory({
        title: 'Test Story',
        role: 'usuario',
        action: 'procesar datos rápidamente de forma eficiente',
        value: 'pueda trabajar mejor con muchos registros',
        description: 'El sistema debe procesar adecuadamente y de forma user-friendly',
        acceptanceCriteria: [
          createAcceptanceCriterion({
            given: 'hay varios datos',
            when: 'se procesan rápidamente',
            then: 'el resultado es óptimo',
            type: 'positive',
          }),
        ],
        components: ['processing'],
      });

      const result = validate(story);
      expect(result.score.estimable).toBeLessThan(0.5);
    });
  });

  describe('Small Criterion - Detailed Tests', () => {
    it('should pass when story has reasonable size', () => {
      const story = createStory({
        title: 'Usuario - Cambiar contraseña',
        role: 'usuario',
        action: 'cambiar mi contraseña',
        value: 'pueda mantener mi cuenta segura',
        description: 'El usuario puede cambiar su contraseña desde su perfil',
        acceptanceCriteria: [
          createAcceptanceCriterion({
            given: 'el usuario está en su perfil',
            when: 'ingresa nueva contraseña válida',
            then: 'la contraseña se actualiza',
            type: 'positive',
          }),
          createAcceptanceCriterion({
            given: 'la nueva contraseña es inválida',
            when: 'intenta cambiarla',
            then: 've un mensaje de error',
            type: 'negative',
          }),
          createAcceptanceCriterion({
            given: 'hay un error al guardar',
            when: 'se intenta actualizar',
            then: 'se muestra un mensaje de error',
            type: 'error',
          }),
        ],
        components: ['auth', 'profile'],
      });

      const result = validate(story);
      expect(result.score.small).toBeGreaterThanOrEqual(0.9);
    });

    it('should fail when story has too many criteria', () => {
      const manyCriteria = Array.from({ length: 12 }, (_, i) =>
        createAcceptanceCriterion({
          given: `contexto ${i}`,
          when: `acción ${i}`,
          then: `resultado ${i}`,
          type: 'positive',
        })
      );

      const story = createStory({
        title: 'Large Story',
        role: 'usuario',
        action: 'realizar múltiples operaciones',
        value: 'pueda completar todas mis tareas',
        description: 'Historia con muchos criterios',
        acceptanceCriteria: manyCriteria,
        components: ['comp1', 'comp2'],
      });

      const result = validate(story);
      expect(result.score.small).toBeLessThan(0.7);
    });

    it('should fail when story has too many components', () => {
      const story = createStory({
        title: 'Large Story',
        role: 'usuario',
        action: 'integrar múltiples sistemas',
        value: 'pueda trabajar con todos los módulos',
        description: 'Historia que afecta muchos componentes',
        acceptanceCriteria: [
          createAcceptanceCriterion({
            given: 'contexto',
            when: 'acción',
            then: 'resultado',
            type: 'positive',
          }),
          createAcceptanceCriterion({
            given: 'contexto 2',
            when: 'acción 2',
            then: 'resultado 2',
            type: 'positive',
          }),
          createAcceptanceCriterion({
            given: 'contexto 3',
            when: 'acción 3',
            then: 'resultado 3',
            type: 'positive',
          }),
        ],
        components: ['comp1', 'comp2', 'comp3', 'comp4', 'comp5', 'comp6', 'comp7'],
      });

      const result = validate(story);
      expect(result.score.small).toBeLessThan(0.7);
    });
  });

  describe('Testable Criterion - Detailed Tests', () => {
    it('should pass when all criteria have complete Gherkin format', () => {
      const story = createStory({
        title: 'Usuario - Buscar productos',
        role: 'usuario',
        action: 'buscar productos por nombre',
        value: 'pueda encontrar rápidamente lo que necesito',
        description: 'El usuario puede buscar productos ingresando un término de búsqueda',
        acceptanceCriteria: [
          createAcceptanceCriterion({
            given: 'el usuario está en la página de productos',
            when: 'ingresa un término de búsqueda válido',
            then: 'se muestran los productos que coinciden',
            type: 'positive',
          }),
          createAcceptanceCriterion({
            given: 'no hay productos que coincidan',
            when: 'realiza una búsqueda',
            then: 've un mensaje indicando que no hay resultados',
            type: 'negative',
          }),
          createAcceptanceCriterion({
            given: 'hay un error en el servidor',
            when: 'se procesa la búsqueda',
            then: 'se muestra un mensaje de error',
            type: 'error',
          }),
        ],
        components: ['search', 'products'],
      });

      const result = validate(story);
      expect(result.score.testable).toBeGreaterThanOrEqual(0.9);
    });

    it('should fail when criteria have incomplete Gherkin format', () => {
      const story = createStory({
        title: 'Test Story',
        role: 'usuario',
        action: 'hacer algo',
        value: 'pueda lograr mi objetivo',
        description: 'Una descripción',
        acceptanceCriteria: [
          createAcceptanceCriterion({
            given: 'ok',
            when: 'x',
            then: 'y',
            type: 'positive',
          }),
          createAcceptanceCriterion({
            given: 'contexto',
            when: 'a',
            then: 'b',
            type: 'positive',
          }),
          createAcceptanceCriterion({
            given: 'c',
            when: 'd',
            then: 'resultado',
            type: 'positive',
          }),
        ],
        components: ['core'],
      });

      const result = validate(story);
      expect(result.score.testable).toBeLessThan(0.9);
    });

    it('should fail when story has only 1 criterion', () => {
      const story = createStory({
        title: 'Test Story',
        role: 'usuario',
        action: 'hacer algo',
        value: 'pueda lograr mi objetivo',
        description: 'Una descripción',
        acceptanceCriteria: [
          createAcceptanceCriterion({
            given: 'contexto completo',
            when: 'acción completa',
            then: 'resultado completo',
            type: 'positive',
          }),
        ],
        components: ['core'],
      });

      const result = validate(story);
      expect(result.score.testable).toBeLessThan(0.7);
    });

    it('should fail when story has only 2 criteria', () => {
      const story = createStory({
        title: 'Test Story',
        role: 'usuario',
        action: 'hacer algo',
        value: 'pueda lograr mi objetivo',
        description: 'Una descripción',
        acceptanceCriteria: [
          createAcceptanceCriterion({
            given: 'contexto completo',
            when: 'acción completa',
            then: 'resultado completo',
            type: 'positive',
          }),
          createAcceptanceCriterion({
            given: 'otro contexto',
            when: 'otra acción',
            then: 'otro resultado',
            type: 'negative',
          }),
        ],
        components: ['core'],
      });

      const result = validate(story);
      expect(result.score.testable).toBeLessThan(0.7);
    });
  });
});
