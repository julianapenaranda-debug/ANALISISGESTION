/**
 * EffortEstimator
 *
 * Calculates effort in Fibonacci story points for bug issues.
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
 */

import {
  BugIssue,
  ValidationResult,
  EffortEstimate,
  FibonacciPoint,
  ConfidenceLevel,
  FIBONACCI,
} from './support-agent-models';

export { FIBONACCI };

// ---------------------------------------------------------------------------
// Fibonacci helpers
// ---------------------------------------------------------------------------

/**
 * Returns the Fibonacci number closest to the given value.
 */
export function nearestFibonacci(value: number): FibonacciPoint {
  let closest = FIBONACCI[0];
  let minDiff = Math.abs(value - closest);

  for (const fib of FIBONACCI) {
    const diff = Math.abs(value - fib);
    if (diff < minDiff) {
      minDiff = diff;
      closest = fib;
    }
  }

  return closest;
}

// ---------------------------------------------------------------------------
// Effort estimation
// ---------------------------------------------------------------------------

const SEVERITY_SCORE: Record<string, number> = {
  Critical: 4,
  High: 3,
  Medium: 2,
  Low: 1,
};

/**
 * Estimates effort in Fibonacci story points for a bug.
 */
export function estimateEffort(bug: BugIssue, validation: ValidationResult): EffortEstimate {
  const severityScore = SEVERITY_SCORE[validation.severity] ?? 2;

  // Complexity: description length (normalized) + stack trace presence
  const descLength = (bug.description ?? '').length;
  const hasStackTrace = /at\s+\S+\s*\(/.test(bug.description ?? '');
  const complexityScore = Math.min(Math.floor(descLength / 100), 5) + (hasStackTrace ? 2 : 0);

  const componentCount = (validation.affectedComponents ?? []).length;

  const hasReproductionSteps = /steps\s+to\s+reproduce/i.test(
    `${bug.description} ${bug.comments.map(c => c.body).join(' ')}`
  );

  // Raw score: weighted combination
  const rawScore = severityScore * 2 + complexityScore + componentCount * 0.5 + (hasReproductionSteps ? 0 : 1);

  let storyPoints = nearestFibonacci(rawScore);

  // Enforce: Critical bugs must have >= 3 story points
  if (validation.severity === 'Critical' && storyPoints < 3) {
    storyPoints = 3;
  }

  // Confidence based on available information
  const confidence = determineConfidence(bug, hasReproductionSteps, hasStackTrace);

  const justification = buildJustification(
    validation.severity,
    severityScore,
    complexityScore,
    componentCount,
    hasReproductionSteps,
    storyPoints
  );

  return {
    storyPoints,
    justification,
    confidence,
    factors: {
      severityScore,
      complexityScore,
      componentCount,
      hasReproductionSteps,
    },
  };
}

function determineConfidence(
  bug: BugIssue,
  hasReproductionSteps: boolean,
  hasStackTrace: boolean
): ConfidenceLevel {
  let score = 0;
  if (hasReproductionSteps) score++;
  if (hasStackTrace) score++;
  if ((bug.description ?? '').length > 200) score++;
  if ((bug.components ?? []).length > 0) score++;

  if (score >= 3) return 'High';
  if (score >= 1) return 'Medium';
  return 'Low';
}

function buildJustification(
  severity: string,
  severityScore: number,
  complexityScore: number,
  componentCount: number,
  hasReproductionSteps: boolean,
  storyPoints: FibonacciPoint
): string {
  const parts = [
    `Severity: ${severity} (score: ${severityScore}).`,
    `Complexity score: ${complexityScore}.`,
    `Components affected: ${componentCount}.`,
    hasReproductionSteps ? 'Reproduction steps provided.' : 'No reproduction steps.',
    `Estimated effort: ${storyPoints} story points.`,
  ];
  return parts.join(' ');
}

// ---------------------------------------------------------------------------
// Total effort
// ---------------------------------------------------------------------------

/**
 * Sums story points across all estimates.
 */
export function calculateTotalEffort(estimates: EffortEstimate[]): number {
  return estimates.reduce((sum, e) => sum + e.storyPoints, 0);
}
