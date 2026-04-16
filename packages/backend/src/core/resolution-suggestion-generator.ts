/**
 * ResolutionSuggestionGenerator
 *
 * Generates technical resolution suggestions for bug issues.
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6
 */

import {
  BugIssue,
  ValidationResult,
  ResolutionSuggestion,
  AffectedLayer,
} from './support-agent-models';

// ---------------------------------------------------------------------------
// Error info extraction
// ---------------------------------------------------------------------------

/**
 * Detects stack traces, HTTP error codes, or exception messages in a description.
 * Returns a human-readable interpretation, or undefined if none found.
 */
export function extractErrorInfo(description: string): string | undefined {
  if (!description) return undefined;

  // Stack trace pattern: "at SomeClass.method (file.js:10:5)"
  const stackTraceMatch = description.match(/at\s+\S+[\s\S]{0,200}/);
  if (stackTraceMatch) {
    return `Stack trace detected: ${stackTraceMatch[0].trim().substring(0, 150)}`;
  }

  // HTTP error codes (4xx / 5xx)
  const httpErrorMatch = description.match(/\b([45]\d{2})\b/);
  if (httpErrorMatch) {
    return `HTTP error code ${httpErrorMatch[1]} detected in description.`;
  }

  // Exception messages: "Exception:", "Error:", "Caused by:"
  const exceptionMatch = description.match(/(Exception|Error|Caused by)[:\s]+([^\n]{1,100})/i);
  if (exceptionMatch) {
    return `Exception detected: ${exceptionMatch[0].trim()}`;
  }

  return undefined;
}

// ---------------------------------------------------------------------------
// Affected layers inference
// ---------------------------------------------------------------------------

const LAYER_KEYWORDS: Record<AffectedLayer, string[]> = {
  backend: ['api', 'endpoint', 'service', 'database', 'query', 'server', 'backend', 'rest', 'graphql'],
  frontend: ['ui', 'component', 'render', 'display', 'button', 'form', 'screen', 'frontend', 'react', 'vue'],
  database: ['migration', 'schema', 'index', 'constraint', 'sql', 'mongo', 'db', 'table', 'column'],
  configuration: ['config', 'env', 'setting', 'variable', 'environment', 'configuration'],
  multiple: [],
};

/**
 * Infers which architectural layers are affected based on components and description keywords.
 */
export function inferAffectedLayers(components: string[], description: string): AffectedLayer[] {
  const text = `${components.join(' ')} ${description}`.toLowerCase();
  const matched: AffectedLayer[] = [];

  for (const layer of ['backend', 'frontend', 'database', 'configuration'] as AffectedLayer[]) {
    const keywords = LAYER_KEYWORDS[layer];
    if (keywords.some(kw => text.includes(kw))) {
      matched.push(layer);
    }
  }

  if (matched.length > 1) {
    return [...matched, 'multiple'];
  }

  if (matched.length === 0) {
    return ['backend'];
  }

  return matched;
}

// ---------------------------------------------------------------------------
// Suggestion generation
// ---------------------------------------------------------------------------

/**
 * Generates a technical resolution suggestion for a bug.
 */
export function generateSuggestion(
  bug: BugIssue,
  validation: ValidationResult
): ResolutionSuggestion {
  const affectedLayers = inferAffectedLayers(
    validation.affectedComponents,
    bug.description ?? ''
  );

  const steps = buildResolutionSteps(bug, validation, affectedLayers);
  const probableOrigin = buildProbableOrigin(bug, validation, affectedLayers);
  const testingApproach = buildTestingApproach(bug, validation, affectedLayers);

  const suggestion: ResolutionSuggestion = {
    steps,
    probableOrigin,
    testingApproach,
    affectedLayers,
  };

  // Reproduction steps usage
  const hasReproSteps = /steps\s+to\s+reproduce/i.test(bug.description ?? '');
  if (hasReproSteps) {
    suggestion.reproductionStepsUsage =
      'Follow the documented reproduction steps to verify the fix resolves the issue end-to-end.';
  }

  // Error interpretation
  const errorInfo = extractErrorInfo(bug.description ?? '');
  if (errorInfo) {
    suggestion.errorInterpretation = errorInfo;
  }

  return suggestion;
}

function buildResolutionSteps(
  bug: BugIssue,
  validation: ValidationResult,
  layers: AffectedLayer[]
): string[] {
  const steps: string[] = [];

  // Common first step
  steps.push(`Review the bug report for "${bug.summary}" and reproduce the issue locally.`);

  // Severity-specific steps
  if (validation.severity === 'Critical') {
    steps.push('Escalate immediately and assign to a senior engineer for hotfix.');
    steps.push('Assess impact scope and notify affected stakeholders.');
  } else if (validation.severity === 'High') {
    steps.push('Prioritize in the current sprint and assign to an available engineer.');
  }

  // Layer-specific steps
  if (layers.includes('backend')) {
    steps.push('Inspect backend service logs and trace the request lifecycle.');
    steps.push('Review relevant API endpoints and service logic for the reported failure.');
  }
  if (layers.includes('frontend')) {
    steps.push('Reproduce the UI issue in the browser and inspect the console for errors.');
    steps.push('Review the relevant React/UI component and its state management.');
  }
  if (layers.includes('database')) {
    steps.push('Analyze database query plans and check for missing indexes or constraint violations.');
  }
  if (layers.includes('configuration')) {
    steps.push('Verify environment variables and configuration files are correctly set.');
  }

  // Common final steps
  steps.push('Write a regression test to prevent recurrence.');
  steps.push('Deploy the fix to a staging environment and validate before production release.');

  return steps;
}

function buildProbableOrigin(
  _bug: BugIssue,
  validation: ValidationResult,
  layers: AffectedLayer[]
): string {
  const components = validation.affectedComponents;
  if (components.length > 0) {
    return `Likely originates in the ${components[0]} component/module (${layers.filter(l => l !== 'multiple').join(', ')} layer).`;
  }
  const primaryLayer = layers.find(l => l !== 'multiple') ?? 'backend';
  return `Probable origin in the ${primaryLayer} layer based on description analysis.`;
}

function buildTestingApproach(
  _bug: BugIssue,
  _validation: ValidationResult,
  layers: AffectedLayer[]
): string {
  const approaches: string[] = [];

  approaches.push('Write a unit test that reproduces the failure condition.');

  if (layers.includes('backend')) {
    approaches.push('Add an integration test covering the affected API endpoint.');
  }
  if (layers.includes('frontend')) {
    approaches.push('Add a component test using a testing library (e.g., React Testing Library).');
  }
  if (layers.includes('database')) {
    approaches.push('Validate with a database migration test in a clean environment.');
  }

  approaches.push('Run the full regression suite before merging the fix.');

  return approaches.join(' ');
}
