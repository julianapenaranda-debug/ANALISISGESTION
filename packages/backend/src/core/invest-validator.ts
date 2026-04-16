/**
 * INVEST Validator
 * 
 * Valida la calidad de historias de usuario según criterios INVEST:
 * - Independent: Independiente de otras historias
 * - Negotiable: Describe "qué" no "cómo"
 * - Valuable: Proporciona valor claro
 * - Estimable: Clara y sin términos vagos
 * - Small: Completable en un sprint
 * - Testable: Criterios verificables
 * 
 * Requerimientos: 8.1-8.7
 */

import {
  Story,
  ValidationResult,
  InvestScore,
  ValidationFailure,
  Suggestion,
} from '@po-ai/shared';
import {
  createValidationResult,
  createInvestScore,
  createValidationFailure,
  createSuggestion,
} from './models';

/**
 * Términos vagos que indican falta de estimabilidad
 */
const VAGUE_TERMS = [
  'rápidamente', 'rápido', 'veloz',
  'adecuado', 'apropiado',
  'user-friendly', 'fácil de usar', 'intuitivo',
  'eficiente', 'óptimo',
  'muchos', 'varios', 'algunos',
  'mejor', 'peor',
  'grande', 'pequeño',
];

/**
 * Términos que indican implementación específica (no negociable)
 */
const IMPLEMENTATION_TERMS = [
  'usando', 'mediante', 'a través de',
  'con tecnología', 'implementar',
  'base de datos', 'API', 'endpoint',
  'tabla', 'columna', 'campo',
];

/**
 * Palabras que indican dependencias explícitas
 */
const DEPENDENCY_INDICATORS = [
  'después de', 'antes de', 'requiere que',
  'depende de', 'necesita que', 'una vez que',
];

/**
 * Valida una historia según criterios INVEST
 */
export function validate(story: Story): ValidationResult {
  const scores = {
    independent: validateIndependent(story),
    negotiable: validateNegotiable(story),
    valuable: validateValuable(story),
    estimable: validateEstimable(story),
    small: validateSmall(story),
    testable: validateTestable(story),
  };

  const investScore = createInvestScore(scores);
  const failures: ValidationFailure[] = [];
  const suggestions: Suggestion[] = [];

  // Recopilar fallos y sugerencias
  if (scores.independent < 0.7) {
    failures.push(createValidationFailure({
      criterion: 'I',
      reason: 'La historia parece tener dependencias explícitas con otras historias',
      severity: 'warning',
    }));
    suggestions.push(...suggestIndependenceImprovements(story));
  }

  if (scores.negotiable < 0.7) {
    failures.push(createValidationFailure({
      criterion: 'N',
      reason: 'La historia describe detalles de implementación en lugar de objetivos',
      severity: 'warning',
    }));
    suggestions.push(...suggestNegotiabilityImprovements(story));
  }

  if (scores.valuable < 0.7) {
    failures.push(createValidationFailure({
      criterion: 'V',
      reason: 'El valor de negocio o usuario no está claro',
      severity: 'error',
    }));
    suggestions.push(...suggestValueImprovements(story));
  }

  if (scores.estimable < 0.7) {
    failures.push(createValidationFailure({
      criterion: 'E',
      reason: 'La historia contiene términos vagos o ambiguos',
      severity: 'warning',
    }));
    suggestions.push(...suggestEstimabilityImprovements(story));
  }

  if (scores.small < 0.7) {
    failures.push(createValidationFailure({
      criterion: 'S',
      reason: 'La historia parece demasiado grande para completarse en un sprint',
      severity: 'warning',
    }));
    suggestions.push(...suggestSizeImprovements(story));
  }

  if (scores.testable < 0.7) {
    failures.push(createValidationFailure({
      criterion: 'T',
      reason: 'Los criterios de aceptación no son suficientemente verificables',
      severity: 'error',
    }));
    suggestions.push(...suggestTestabilityImprovements(story));
  }

  const isValid = investScore.overall >= 0.7;

  return createValidationResult({
    isValid,
    score: investScore,
    failures,
    suggestions,
  });
}

/**
 * Valida independencia: sin dependencias explícitas
 */
function validateIndependent(story: Story): number {
  const text = `${story.description} ${story.acceptanceCriteria.map(c => `${c.given} ${c.when} ${c.then}`).join(' ')}`.toLowerCase();
  
  let score = 1.0;
  
  for (const indicator of DEPENDENCY_INDICATORS) {
    if (text.includes(indicator)) {
      score -= 0.2;
    }
  }
  
  return Math.max(0, score);
}

/**
 * Valida negociabilidad: describe "qué" no "cómo"
 */
function validateNegotiable(story: Story): number {
  const text = `${story.action} ${story.description}`.toLowerCase();
  
  let score = 1.0;
  
  for (const term of IMPLEMENTATION_TERMS) {
    if (text.includes(term)) {
      score -= 0.15;
    }
  }
  
  return Math.max(0, score);
}

/**
 * Valida valor: presencia de valor claro
 */
function validateValuable(story: Story): number {
  if (!story.value || story.value.trim().length < 10) {
    return 0.3;
  }
  
  // Verificar que el valor no sea genérico
  const genericPhrases = ['sea mejor', 'funcione bien', 'esté disponible'];
  const valueLower = story.value.toLowerCase();
  
  for (const phrase of genericPhrases) {
    if (valueLower.includes(phrase)) {
      return 0.6;
    }
  }
  
  return 1.0;
}

/**
 * Valida estimabilidad: claridad y ausencia de términos vagos
 */
function validateEstimable(story: Story): number {
  const text = `${story.description} ${story.acceptanceCriteria.map(c => `${c.given} ${c.when} ${c.then}`).join(' ')}`.toLowerCase();
  
  let score = 1.0;
  let vagueTermsFound = 0;
  
  for (const term of VAGUE_TERMS) {
    if (text.includes(term)) {
      vagueTermsFound++;
      score -= 0.1;
    }
  }
  
  return Math.max(0, score);
}

/**
 * Valida tamaño: estimación basada en criterios y componentes
 */
function validateSmall(story: Story): number {
  const criteriaCount = story.acceptanceCriteria.length;
  const componentCount = story.components.length;
  
  // Más de 8 criterios o 5 componentes indica historia grande
  if (criteriaCount > 8 || componentCount > 5) {
    return 0.4;
  }
  
  if (criteriaCount > 5 || componentCount > 3) {
    return 0.7;
  }
  
  return 1.0;
}

/**
 * Valida testeabilidad: criterios verificables y medibles
 */
function validateTestable(story: Story): number {
  if (story.acceptanceCriteria.length < 3) {
    return 0.5;
  }
  
  let score = 1.0;
  
  for (const criterion of story.acceptanceCriteria) {
    // Verificar que cada parte del criterio Gherkin esté presente y no vacía
    if (!criterion.given || criterion.given.trim().length < 5) {
      score -= 0.15;
    }
    if (!criterion.when || criterion.when.trim().length < 5) {
      score -= 0.15;
    }
    if (!criterion.then || criterion.then.trim().length < 5) {
      score -= 0.15;
    }
  }
  
  return Math.max(0, score);
}

/**
 * Genera sugerencias para mejorar independencia
 */
function suggestIndependenceImprovements(story: Story): Suggestion[] {
  return [
    createSuggestion({
      criterion: 'Independent',
      improvement: 'Elimina referencias a otras historias o funcionalidades que deben completarse primero',
      example: 'En lugar de "después de implementar el login", describe la funcionalidad de forma autónoma',
    }),
  ];
}

/**
 * Genera sugerencias para mejorar negociabilidad
 */
function suggestNegotiabilityImprovements(story: Story): Suggestion[] {
  return [
    createSuggestion({
      criterion: 'Negotiable',
      improvement: 'Enfócate en el objetivo del usuario, no en la implementación técnica',
      example: 'En lugar de "usando una API REST", describe "poder acceder a mis datos desde cualquier dispositivo"',
    }),
  ];
}

/**
 * Genera sugerencias para mejorar valor
 */
function suggestValueImprovements(story: Story): Suggestion[] {
  return [
    createSuggestion({
      criterion: 'Valuable',
      improvement: 'Clarifica el valor específico que obtiene el usuario o el negocio',
      example: 'En lugar de "para que funcione bien", usa "para que pueda completar mi trabajo en menos tiempo"',
    }),
  ];
}

/**
 * Genera sugerencias para mejorar estimabilidad
 */
function suggestEstimabilityImprovements(story: Story): Suggestion[] {
  return [
    createSuggestion({
      criterion: 'Estimable',
      improvement: 'Reemplaza términos vagos con criterios específicos y medibles',
      example: 'En lugar de "rápidamente", usa "en menos de 2 segundos"',
    }),
  ];
}

/**
 * Genera sugerencias para mejorar tamaño
 */
function suggestSizeImprovements(story: Story): Suggestion[] {
  return [
    createSuggestion({
      criterion: 'Small',
      improvement: 'Considera dividir esta historia en historias más pequeñas y enfocadas',
      example: 'Si tiene más de 5 criterios de aceptación, busca agrupar funcionalidades relacionadas en historias separadas',
    }),
  ];
}

/**
 * Genera sugerencias para mejorar testeabilidad
 */
function suggestTestabilityImprovements(story: Story): Suggestion[] {
  return [
    createSuggestion({
      criterion: 'Testable',
      improvement: 'Asegúrate de que cada criterio de aceptación sea verificable con un resultado claro',
      example: 'Cada criterio debe tener: Dado que (contexto), Cuando (acción), Entonces (resultado medible)',
    }),
  ];
}

/**
 * Genera sugerencias de mejora para fallos específicos
 */
export function suggestImprovements(
  story: Story,
  failures: ValidationFailure[]
): Suggestion[] {
  const suggestions: Suggestion[] = [];
  
  for (const failure of failures) {
    switch (failure.criterion) {
      case 'I':
        suggestions.push(...suggestIndependenceImprovements(story));
        break;
      case 'N':
        suggestions.push(...suggestNegotiabilityImprovements(story));
        break;
      case 'V':
        suggestions.push(...suggestValueImprovements(story));
        break;
      case 'E':
        suggestions.push(...suggestEstimabilityImprovements(story));
        break;
      case 'S':
        suggestions.push(...suggestSizeImprovements(story));
        break;
      case 'T':
        suggestions.push(...suggestTestabilityImprovements(story));
        break;
    }
  }
  
  return suggestions;
}
