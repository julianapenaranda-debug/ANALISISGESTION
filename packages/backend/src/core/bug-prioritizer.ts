/**
 * BugPrioritizer
 *
 * Calculates weighted priority scores and sorts/categorizes bugs.
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4
 */

import {
  BugIssue,
  ValidationResult,
  PriorityScore,
  PriorityCategory,
  PrioritizedBug,
  AnalyzedBug,
} from './support-agent-models';

export const PRIORITY_WEIGHTS = {
  severity: 0.4,
  age: 0.3,
  usersAffected: 0.2,
  criticalImpact: 0.1,
} as const;

const SEVERITY_COMPONENT: Record<string, number> = {
  Critical: 100,
  High: 75,
  Medium: 50,
  Low: 25,
};

const CRITICAL_IMPACT_KEYWORDS = ['auth', 'payment', 'data loss', 'data-loss', 'dataloss'];

// ---------------------------------------------------------------------------
// Score calculation
// ---------------------------------------------------------------------------

/**
 * Calculates the weighted priority score for a bug.
 */
export function calculatePriorityScore(bug: BugIssue, validation: ValidationResult): PriorityScore {
  // Severity component
  const severityComponent = SEVERITY_COMPONENT[validation.severity] ?? 50;

  // Age component: days since createdDate, normalized 0-100, capped at 365 days
  const ageInDays = Math.max(
    0,
    (Date.now() - new Date(bug.createdDate).getTime()) / (1000 * 60 * 60 * 24)
  );
  const ageComponent = Math.min((ageInDays / 365) * 100, 100);

  // Users affected component: extract number from description + comments
  const allText = [
    bug.description,
    ...bug.comments.map(c => c.body),
  ].join(' ');
  const usersAffectedComponent = extractUsersAffectedScore(allText);

  // Critical impact component
  const descLower = (bug.description ?? '').toLowerCase();
  const criticalImpactComponent = CRITICAL_IMPACT_KEYWORDS.some(kw => descLower.includes(kw))
    ? 100
    : 0;

  const total =
    severityComponent * PRIORITY_WEIGHTS.severity +
    ageComponent * PRIORITY_WEIGHTS.age +
    usersAffectedComponent * PRIORITY_WEIGHTS.usersAffected +
    criticalImpactComponent * PRIORITY_WEIGHTS.criticalImpact;

  return {
    total: Math.min(Math.max(total, 0), 100),
    severityComponent,
    ageComponent,
    usersAffectedComponent,
    criticalImpactComponent,
  };
}

/**
 * Extracts a 0-100 score based on the number of users mentioned in text.
 */
function extractUsersAffectedScore(text: string): number {
  // Look for patterns like "100 users", "affects 50 customers", etc.
  const match = text.match(/(\d+)\s*(?:users?|customers?|clients?|people|accounts?)/i);
  if (!match) return 0;

  const count = parseInt(match[1], 10);
  // Normalize: 1000+ users → 100
  return Math.min((count / 1000) * 100, 100);
}

// ---------------------------------------------------------------------------
// Categorization
// ---------------------------------------------------------------------------

/**
 * Maps a priority score to a category.
 */
export function categorizeBug(score: number): PriorityCategory {
  if (score >= 70) return 'critical';
  if (score >= 40) return 'important';
  return 'planned';
}

// ---------------------------------------------------------------------------
// Prioritization
// ---------------------------------------------------------------------------

/**
 * Calculates scores, categorizes, and sorts bugs descending by total score.
 * Ties are broken by ascending createdDate.
 */
export function prioritizeBugs(bugs: AnalyzedBug[]): PrioritizedBug[] {
  const prioritized: PrioritizedBug[] = bugs.map(analyzed => {
    const priorityScore = calculatePriorityScore(analyzed.bug, analyzed.validation);
    const category = categorizeBug(priorityScore.total);
    return { ...analyzed, priorityScore, category };
  });

  return prioritized.sort((a, b) => {
    const scoreDiff = b.priorityScore.total - a.priorityScore.total;
    if (scoreDiff !== 0) return scoreDiff;
    // Tie-break: older bugs first (ascending createdDate)
    return new Date(a.bug.createdDate).getTime() - new Date(b.bug.createdDate).getTime();
  });
}
