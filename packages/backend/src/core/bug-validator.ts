/**
 * BugValidator
 *
 * Validates bug issues: infers severity, detects duplicates, identifies
 * affected components, and produces a ValidationResult.
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 9.4
 */

import {
  BugIssue,
  ValidationResult,
  Severity,
} from './support-agent-models';

// ---------------------------------------------------------------------------
// Severity inference
// ---------------------------------------------------------------------------

/**
 * Maps a Jira priority string to a Severity level.
 * Returns `defaulted: true` when the priority is not determinable.
 */
export function inferSeverity(bug: BugIssue): { severity: Severity; defaulted: boolean } {
  const priority = (bug.priority ?? '').trim().toLowerCase();

  switch (priority) {
    case 'highest':
    case 'critical':
      return { severity: 'Critical', defaulted: false };
    case 'high':
      return { severity: 'High', defaulted: false };
    case 'low':
    case 'lowest':
      return { severity: 'Low', defaulted: false };
    case 'medium':
      return { severity: 'Medium', defaulted: false };
    default:
      return { severity: 'Medium', defaulted: true };
  }
}

// ---------------------------------------------------------------------------
// Duplicate detection
// ---------------------------------------------------------------------------

/**
 * Returns the ID of the first candidate whose summary has >80% word overlap
 * with the given bug's summary (excluding the bug itself).
 */
export function detectDuplicates(bug: BugIssue, candidates: BugIssue[]): string | undefined {
  const bugWords = tokenize(bug.summary);
  if (bugWords.size === 0) return undefined;

  for (const candidate of candidates) {
    if (candidate.id === bug.id) continue;

    const candidateWords = tokenize(candidate.summary);
    if (candidateWords.size === 0) continue;

    const intersection = new Set([...bugWords].filter(w => candidateWords.has(w)));
    const union = new Set([...bugWords, ...candidateWords]);
    const overlap = intersection.size / union.size;

    if (overlap > 0.8) {
      return candidate.id;
    }
  }

  return undefined;
}

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 0)
  );
}

// ---------------------------------------------------------------------------
// Component identification
// ---------------------------------------------------------------------------

const COMPONENT_KEYWORDS: Record<string, string[]> = {
  backend: ['api', 'endpoint', 'service', 'server', 'backend', 'rest', 'graphql'],
  frontend: ['ui', 'component', 'render', 'display', 'button', 'form', 'screen', 'frontend', 'react', 'vue', 'angular'],
  database: ['database', 'db', 'query', 'migration', 'schema', 'index', 'constraint', 'sql', 'mongo'],
  authentication: ['auth', 'login', 'logout', 'token', 'session', 'oauth', 'jwt', 'password'],
  payment: ['payment', 'billing', 'invoice', 'checkout', 'stripe', 'paypal', 'transaction'],
  configuration: ['config', 'env', 'setting', 'variable', 'environment', 'configuration'],
};

function identifyAffectedComponents(bug: BugIssue): string[] {
  const components = new Set<string>(bug.components ?? []);
  const text = `${bug.summary} ${bug.description}`.toLowerCase();

  for (const [component, keywords] of Object.entries(COMPONENT_KEYWORDS)) {
    if (keywords.some(kw => text.includes(kw))) {
      components.add(component);
    }
  }

  return Array.from(components);
}

// ---------------------------------------------------------------------------
// Main validation
// ---------------------------------------------------------------------------

/**
 * Orchestrates full bug validation: duplicate check, description length check,
 * severity inference, component identification, and justification generation.
 */
export function validateBug(bug: BugIssue, allBugs: BugIssue[]): ValidationResult {
  // 1. Duplicate detection
  const duplicateOfId = detectDuplicates(bug, allBugs);
  if (duplicateOfId) {
    return {
      classification: 'duplicate',
      severity: inferSeverity(bug).severity,
      severityDefaulted: inferSeverity(bug).defaulted,
      justification: `Bug is a duplicate of ${duplicateOfId} based on summary similarity.`,
      affectedComponents: identifyAffectedComponents(bug),
      duplicateOfId,
    };
  }

  // 2. Description length check
  const descriptionLength = (bug.description ?? '').trim().length;
  if (descriptionLength < 20) {
    const { severity, defaulted } = inferSeverity(bug);
    return {
      classification: 'needs_more_info',
      severity,
      severityDefaulted: defaulted,
      justification: 'Bug description is too short to perform a proper analysis.',
      affectedComponents: identifyAffectedComponents(bug),
      missingInfo: ['Detailed description of the issue', 'Steps to reproduce', 'Expected vs actual behavior'],
    };
  }

  // 3. Severity inference
  const { severity, defaulted } = inferSeverity(bug);

  // 4. Component identification
  const affectedComponents = identifyAffectedComponents(bug);

  // 5. Build justification
  const justification = buildJustification(bug, severity, defaulted, affectedComponents);

  return {
    classification: 'valid',
    severity,
    severityDefaulted: defaulted,
    justification,
    affectedComponents,
  };
}

function buildJustification(
  bug: BugIssue,
  severity: Severity,
  defaulted: boolean,
  components: string[]
): string {
  const parts: string[] = [];

  parts.push(`Bug "${bug.summary}" classified as valid.`);
  parts.push(`Severity: ${severity}${defaulted ? ' (defaulted from unrecognized priority)' : ` (from Jira priority: ${bug.priority})`}.`);

  if (components.length > 0) {
    parts.push(`Affected components: ${components.join(', ')}.`);
  }

  return parts.join(' ');
}
