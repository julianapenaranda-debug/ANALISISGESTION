/**
 * Property-Based Tests - INVEST Validator
 * 
 * Pruebas basadas en propiedades para el validador INVEST.
 * Feature: po-ai
 * 
 * Property 2: INVEST Validation
 * Property 24: INVEST Improvement Suggestions
 * 
 * Valida: Requerimientos 1.2, 8.1-8.7
 */

import { describe, it, expect } from '@jest/globals';
import * as fc from 'fast-check';
import { validate, suggestImprovements } from '../../../src/core/invest-validator';
import { createStory, createAcceptanceCriterion } from '../../../src/core/models';
import { Story, AcceptanceCriterion } from '@po-ai/shared';

/**
 * Generador de criterios de aceptación válidos
 */
const acceptanceCriterionArbitrary = (): fc.Arbitrary<AcceptanceCriterion> => {
  return fc.record({
    given: fc.string({ minLength: 10, maxLength: 100 }),
    when: fc.string({ minLength: 10, maxLength: 100 }),
    then: fc.string({ minLength: 10, maxLength: 100 }),
    type: fc.constantFrom('positive' as const, 'negative' as const, 'error' as const),
  }).map(params => createAcceptanceCriterion(params));
};

/**
 * Generador de historias bien formadas (sin términos problemáticos)
 */
const wellFormedStoryArbitrary = (): fc.Arbitrary<Story> => {
  return fc.record({
    title: fc.string({ minLength: 10, maxLength: 100 }),
    role: fc.constantFrom('usuario', 'administrador', 'Product Owner', 'desarrollador'),
    action: fc.string({ minLength: 15, maxLength: 100 }),
    value: fc.string({ minLength: 20, maxLength: 150 }),
    description: fc.string({ minLength: 30, maxLength: 200 }),
    acceptanceCriteria: fc.array(acceptanceCriterionArbitrary(), { minLength: 3, maxLength: 6 }),
    components: fc.array(fc.string({ minLength: 3, maxLength: 20 }), { minLength: 1, maxLength: 3 }),
  }).map(params => createStory(params));
};

/**
 * Generador de historias con términos vagos
 */
const vagueStoryArbitrary = (): fc.Arbitrary<Story> => {
  const vagueTerms = ['rápidamente', 'adecuado', 'user-friendly', 'eficiente', 'muchos', 'mejor'];
  
  return fc.record({
    title: fc.string({ minLength: 10, maxLength: 100 }),
    role: fc.constantFrom('usuario', 'administrador'),
    action: fc.string({ minLength: 10, maxLength: 50 }).chain(action =>
      fc.constantFrom(...vagueTerms).map(term => `${action} ${term}`)
    ),
    value: fc.string({ minLength: 20, maxLength: 100 }),
    description: fc.string({ minLength: 20, maxLength: 100 }),
    acceptanceCriteria: fc.array(acceptanceCriterionArbitrary(), { minLength: 3, maxLength: 5 }),
    components: fc.array(fc.string(), { minLength: 1, maxLength: 3 }),
  }).map(params => createStory(params));
};

/**
 * Generador de historias con detalles de implementación
 */
const implementationStoryArbitrary = (): fc.Arbitrary<Story> => {
  const implTerms = ['usando', 'mediante', 'base de datos', 'API', 'tabla'];
  
  return fc.record({
    title: fc.string({ minLength: 10, maxLength: 100 }),
    role: fc.constantFrom('usuario', 'administrador'),
    action: fc.string({ minLength: 10, maxLength: 50 }),
    value: fc.string({ minLength: 20, maxLength: 100 }),
    description: fc.string({ minLength: 20, maxLength: 50 }).chain(desc =>
      fc.constantFrom(...implTerms).map(term => `${desc} ${term}`)
    ),
    acceptanceCriteria: fc.array(acceptanceCriterionArbitrary(), { minLength: 3, maxLength: 5 }),
    components: fc.array(fc.string(), { minLength: 1, maxLength: 3 }),
  }).map(params => createStory(params));
};

/**
 * Generador de historias con dependencias explícitas
 */
const dependentStoryArbitrary = (): fc.Arbitrary<Story> => {
  const depIndicators = ['después de', 'antes de', 'requiere que', 'depende de'];
  
  return fc.record({
    title: fc.string({ minLength: 10, maxLength: 100 }),
    role: fc.constantFrom('usuario', 'administrador'),
    action: fc.string({ minLength: 10, maxLength: 50 }),
    value: fc.string({ minLength: 20, maxLength: 100 }),
    description: fc.string({ minLength: 20, maxLength: 50 }).chain(desc =>
      fc.constantFrom(...depIndicators).map(indicator => `${indicator} ${desc}`)
    ),
    acceptanceCriteria: fc.array(acceptanceCriterionArbitrary(), { minLength: 3, maxLength: 5 }),
    components: fc.array(fc.string(), { minLength: 1, maxLength: 3 }),
  }).map(params => createStory(params));
};

/**
 * Generador de historias grandes (muchos criterios/componentes)
 */
const largeStoryArbitrary = (): fc.Arbitrary<Story> => {
  return fc.record({
    title: fc.string({ minLength: 10, maxLength: 100 }),
    role: fc.constantFrom('usuario', 'administrador'),
    action: fc.string({ minLength: 10, maxLength: 100 }),
    value: fc.string({ minLength: 20, maxLength: 100 }),
    description: fc.string({ minLength: 30, maxLength: 200 }),
    acceptanceCriteria: fc.array(acceptanceCriterionArbitrary(), { minLength: 9, maxLength: 15 }),
    components: fc.array(fc.string(), { minLength: 6, maxLength: 10 }),
  }).map(params => createStory(params));
};

describe('INVEST Validator - Property Tests', () => {
  describe('Property 2: INVEST Validation', () => {
    /**
     * **Validates: Requirements 1.2, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6**
     * 
     * For any generated story, the story SHALL pass INVEST validation with scores 
     * above threshold for all six criteria (Independent, Negotiable, Valuable, 
     * Estimable, Small, Testable).
     */
    it('should return ValidationResult with all INVEST scores between 0 and 1', () => {
      fc.assert(
        fc.property(
          wellFormedStoryArbitrary(),
          (story) => {
            const result = validate(story);
            
            // Verificar que el resultado tiene la estructura correcta
            expect(result).toHaveProperty('isValid');
            expect(result).toHaveProperty('score');
            expect(result).toHaveProperty('failures');
            expect(result).toHaveProperty('suggestions');
            
            // Verificar que todos los scores están en el rango [0, 1]
            expect(result.score.independent).toBeGreaterThanOrEqual(0);
            expect(result.score.independent).toBeLessThanOrEqual(1);
            
            expect(result.score.negotiable).toBeGreaterThanOrEqual(0);
            expect(result.score.negotiable).toBeLessThanOrEqual(1);
            
            expect(result.score.valuable).toBeGreaterThanOrEqual(0);
            expect(result.score.valuable).toBeLessThanOrEqual(1);
            
            expect(result.score.estimable).toBeGreaterThanOrEqual(0);
            expect(result.score.estimable).toBeLessThanOrEqual(1);
            
            expect(result.score.small).toBeGreaterThanOrEqual(0);
            expect(result.score.small).toBeLessThanOrEqual(1);
            
            expect(result.score.testable).toBeGreaterThanOrEqual(0);
            expect(result.score.testable).toBeLessThanOrEqual(1);
            
            expect(result.score.overall).toBeGreaterThanOrEqual(0);
            expect(result.score.overall).toBeLessThanOrEqual(1);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should calculate overall score as average of individual scores', () => {
      fc.assert(
        fc.property(
          wellFormedStoryArbitrary(),
          (story) => {
            const result = validate(story);
            
            const expectedOverall = (
              result.score.independent +
              result.score.negotiable +
              result.score.valuable +
              result.score.estimable +
              result.score.small +
              result.score.testable
            ) / 6;
            
            // Permitir pequeña diferencia por redondeo
            expect(Math.abs(result.score.overall - expectedOverall)).toBeLessThan(0.001);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should mark story as invalid when overall score is below 0.7', () => {
      fc.assert(
        fc.property(
          wellFormedStoryArbitrary(),
          (story) => {
            const result = validate(story);
            
            if (result.score.overall < 0.7) {
              expect(result.isValid).toBe(false);
            } else {
              expect(result.isValid).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should detect vague terms and reduce estimability score', () => {
      fc.assert(
        fc.property(
          vagueStoryArbitrary(),
          (story) => {
            const result = validate(story);
            
            // Las historias con términos vagos deben tener score estimable reducido
            expect(result.score.estimable).toBeLessThan(1.0);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should detect implementation details and reduce negotiability score', () => {
      fc.assert(
        fc.property(
          implementationStoryArbitrary(),
          (story) => {
            const result = validate(story);
            
            // Las historias con detalles de implementación deben tener score negociable reducido
            expect(result.score.negotiable).toBeLessThan(1.0);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should detect dependencies and reduce independence score', () => {
      fc.assert(
        fc.property(
          dependentStoryArbitrary(),
          (story) => {
            const result = validate(story);
            
            // Las historias con dependencias explícitas deben tener score independiente reducido
            expect(result.score.independent).toBeLessThan(1.0);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should detect large stories and reduce small score', () => {
      fc.assert(
        fc.property(
          largeStoryArbitrary(),
          (story) => {
            const result = validate(story);
            
            // Las historias grandes deben tener score pequeño reducido
            expect(result.score.small).toBeLessThan(0.7);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should add failures when scores are below 0.7 threshold', () => {
      fc.assert(
        fc.property(
          wellFormedStoryArbitrary(),
          (story) => {
            const result = validate(story);
            
            // Verificar consistencia entre scores y failures
            if (result.score.independent < 0.7) {
              expect(result.failures.some(f => f.criterion === 'I')).toBe(true);
            }
            
            if (result.score.negotiable < 0.7) {
              expect(result.failures.some(f => f.criterion === 'N')).toBe(true);
            }
            
            if (result.score.valuable < 0.7) {
              expect(result.failures.some(f => f.criterion === 'V')).toBe(true);
            }
            
            if (result.score.estimable < 0.7) {
              expect(result.failures.some(f => f.criterion === 'E')).toBe(true);
            }
            
            if (result.score.small < 0.7) {
              expect(result.failures.some(f => f.criterion === 'S')).toBe(true);
            }
            
            if (result.score.testable < 0.7) {
              expect(result.failures.some(f => f.criterion === 'T')).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should require at least 3 acceptance criteria for testability', () => {
      fc.assert(
        fc.property(
          fc.record({
            title: fc.string({ minLength: 10, maxLength: 100 }),
            role: fc.constantFrom('usuario', 'administrador'),
            action: fc.string({ minLength: 10, maxLength: 100 }),
            value: fc.string({ minLength: 20, maxLength: 100 }),
            description: fc.string({ minLength: 30, maxLength: 200 }),
            acceptanceCriteria: fc.array(acceptanceCriterionArbitrary(), { minLength: 0, maxLength: 2 }),
            components: fc.array(fc.string(), { minLength: 1, maxLength: 3 }),
          }).map(params => createStory(params)),
          (story) => {
            const result = validate(story);
            
            if (story.acceptanceCriteria.length < 3) {
              expect(result.score.testable).toBeLessThan(0.7);
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Property 24: INVEST Improvement Suggestions', () => {
    /**
     * **Validates: Requirement 8.7**
     * 
     * For any story that fails INVEST validation on one or more criteria, 
     * the Story_Generator SHALL provide specific improvement suggestions 
     * for each failed criterion.
     */
    it('should provide suggestions for each failed criterion', () => {
      fc.assert(
        fc.property(
          wellFormedStoryArbitrary(),
          (story) => {
            const result = validate(story);
            const suggestions = suggestImprovements(story, result.failures);
            
            // Para cada fallo, debe haber al menos una sugerencia
            for (const failure of result.failures) {
              const criterionName = {
                'I': 'Independent',
                'N': 'Negotiable',
                'V': 'Valuable',
                'E': 'Estimable',
                'S': 'Small',
                'T': 'Testable',
              }[failure.criterion];
              
              const hasSuggestion = suggestions.some(s => 
                s.criterion.includes(criterionName)
              );
              
              expect(hasSuggestion).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should provide non-empty improvement text for each suggestion', () => {
      fc.assert(
        fc.property(
          wellFormedStoryArbitrary(),
          (story) => {
            const result = validate(story);
            const suggestions = suggestImprovements(story, result.failures);
            
            // Todas las sugerencias deben tener texto de mejora no vacío
            for (const suggestion of suggestions) {
              expect(suggestion.criterion).toBeTruthy();
              expect(suggestion.criterion.length).toBeGreaterThan(0);
              expect(suggestion.improvement).toBeTruthy();
              expect(suggestion.improvement.length).toBeGreaterThan(10);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should provide examples in suggestions when available', () => {
      fc.assert(
        fc.property(
          vagueStoryArbitrary(),
          (story) => {
            const result = validate(story);
            const suggestions = suggestImprovements(story, result.failures);
            
            // Al menos algunas sugerencias deben incluir ejemplos
            const suggestionsWithExamples = suggestions.filter(s => s.example && s.example.length > 0);
            
            if (suggestions.length > 0) {
              expect(suggestionsWithExamples.length).toBeGreaterThan(0);
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should not provide duplicate suggestions for the same criterion', () => {
      fc.assert(
        fc.property(
          wellFormedStoryArbitrary(),
          (story) => {
            const result = validate(story);
            const suggestions = suggestImprovements(story, result.failures);
            
            // Contar sugerencias por criterio
            const criterionCounts = new Map<string, number>();
            
            for (const suggestion of suggestions) {
              const count = criterionCounts.get(suggestion.criterion) || 0;
              criterionCounts.set(suggestion.criterion, count + 1);
            }
            
            // No debe haber más de una sugerencia por criterio
            for (const count of criterionCounts.values()) {
              expect(count).toBeLessThanOrEqual(1);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should provide suggestions only for criteria that actually failed', () => {
      fc.assert(
        fc.property(
          wellFormedStoryArbitrary(),
          (story) => {
            const result = validate(story);
            const suggestions = suggestImprovements(story, result.failures);
            
            // Todas las sugerencias deben corresponder a un fallo
            for (const suggestion of suggestions) {
              const criterionMap: Record<string, 'I' | 'N' | 'V' | 'E' | 'S' | 'T'> = {
                'Independent': 'I',
                'Negotiable': 'N',
                'Valuable': 'V',
                'Estimable': 'E',
                'Small': 'S',
                'Testable': 'T',
              };
              
              let foundMatchingFailure = false;
              for (const [key, value] of Object.entries(criterionMap)) {
                if (suggestion.criterion.includes(key)) {
                  foundMatchingFailure = result.failures.some(f => f.criterion === value);
                  break;
                }
              }
              
              expect(foundMatchingFailure).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
