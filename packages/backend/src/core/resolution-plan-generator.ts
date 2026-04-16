/**
 * ResolutionPlanGenerator
 *
 * Assembles the complete Resolution Plan and exports it to Markdown.
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 9.3
 */

import {
  PrioritizedBug,
  FailedBugAnalysis,
  ResolutionPlan,
  ResolutionPlanMetrics,
  PriorityCategory,
  Severity,
  ExtendedResolutionPlan,
  AnalyzedDatadogFinding,
  DatadogIssueProposal,
  SuggestedCriticality,
  DatadogFindingType,
} from './support-agent-models';
import { calculateTotalEffort } from './effort-estimator';

// ---------------------------------------------------------------------------
// Plan generation
// ---------------------------------------------------------------------------

/**
 * Generates a complete ResolutionPlan from prioritized bugs and failed analyses.
 */
export function generateResolutionPlan(
  projectKey: string,
  prioritized: PrioritizedBug[],
  failed: FailedBugAnalysis[]
): ResolutionPlan {
  const id = Date.now().toString(36);
  const generatedAt = new Date();
  const metrics = calculateMetrics(prioritized, failed);
  const executiveSummary = buildExecutiveSummary(projectKey, metrics, prioritized);

  return {
    id,
    projectKey,
    generatedAt,
    executiveSummary,
    prioritizedBugs: prioritized,
    failedBugs: failed,
    metrics,
  };
}

function calculateMetrics(
  prioritized: PrioritizedBug[],
  failed: FailedBugAnalysis[]
): ResolutionPlanMetrics {
  const totalAnalyzed = prioritized.length + failed.length;

  const validCount = prioritized.filter(b => b.validation.classification === 'valid').length;
  const duplicateCount = prioritized.filter(b => b.validation.classification === 'duplicate').length;
  const expectedBehaviorCount = prioritized.filter(b => b.validation.classification === 'expected_behavior').length;
  const needsMoreInfoCount = prioritized.filter(b => b.validation.classification === 'needs_more_info').length;

  const validPercentage = totalAnalyzed > 0 ? (validCount / totalAnalyzed) * 100 : 0;

  const totalEffortPoints = calculateTotalEffort(prioritized.map(b => b.estimate));

  const effortByCategory: Record<PriorityCategory, number> = {
    critical: 0,
    important: 0,
    planned: 0,
  };
  for (const bug of prioritized) {
    effortByCategory[bug.category] += bug.estimate.storyPoints;
  }

  const distributionBySeverity: Record<Severity, number> = {
    Critical: 0,
    High: 0,
    Medium: 0,
    Low: 0,
  };
  for (const bug of prioritized) {
    distributionBySeverity[bug.validation.severity]++;
  }

  return {
    totalAnalyzed,
    validCount,
    duplicateCount,
    expectedBehaviorCount,
    needsMoreInfoCount,
    validPercentage,
    totalEffortPoints,
    effortByCategory,
    distributionBySeverity,
  };
}

function buildExecutiveSummary(
  projectKey: string,
  metrics: ResolutionPlanMetrics,
  prioritized: PrioritizedBug[],
  extendedPlan?: ExtendedResolutionPlan
): string {
  const criticalCount = prioritized.filter(b => b.category === 'critical').length;
  const lines = [
    `Resolution Plan for project ${projectKey}.`,
    `Analyzed ${metrics.totalAnalyzed} bugs: ${metrics.validCount} valid (${metrics.validPercentage.toFixed(1)}%), ` +
      `${metrics.duplicateCount} duplicates, ${metrics.needsMoreInfoCount} needing more info.`,
    `Total estimated effort: ${metrics.totalEffortPoints} story points.`,
  ];
  if (criticalCount > 0) {
    lines.push(`${criticalCount} bug(s) require immediate attention (critical priority).`);
  }
  if (extendedPlan && extendedPlan.datadogFindings && extendedPlan.datadogFindings.length > 0) {
    const ddCount = extendedPlan.datadogFindings.length;
    const correlatedCount = extendedPlan.datadogMetrics?.correlatedCount ?? 0;
    const uncorrelatedCount = extendedPlan.datadogMetrics?.uncorrelatedCount ?? (ddCount - correlatedCount);
    lines.push(
      `Additionally, ${ddCount} Datadog finding(s) were analyzed: ${correlatedCount} correlated with Jira bugs, ${uncorrelatedCount} uncorrelated.`
    );
    lines.push('Sources: Jira and Datadog.');
  }
  return lines.join(' ');
}

// ---------------------------------------------------------------------------
// Markdown export
// ---------------------------------------------------------------------------

/**
 * Exports a ResolutionPlan to a Markdown string.
 */
export function exportToMarkdown(plan: ResolutionPlan): string {
  const lines: string[] = [];

  // Check if this is an extended plan with Datadog findings
  const extendedPlan = isExtendedPlan(plan) ? plan : undefined;

  lines.push(`# Resolution Plan: ${plan.projectKey}`);
  lines.push(`**Generated:** ${plan.generatedAt.toISOString()}  `);
  lines.push(`**Plan ID:** ${plan.id}`);
  lines.push('');

  // Executive Summary — rebuild if extended plan to include Datadog info
  lines.push('## Executive Summary');
  lines.push('');
  if (extendedPlan) {
    lines.push(buildExecutiveSummary(plan.projectKey, plan.metrics, plan.prioritizedBugs, extendedPlan));
  } else {
    lines.push(plan.executiveSummary);
  }
  lines.push('');

  // Metrics table
  lines.push('## Metrics');
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('|--------|-------|');
  lines.push(`| Total Analyzed | ${plan.metrics.totalAnalyzed} |`);
  lines.push(`| Valid | ${plan.metrics.validCount} (${plan.metrics.validPercentage.toFixed(1)}%) |`);
  lines.push(`| Duplicates | ${plan.metrics.duplicateCount} |`);
  lines.push(`| Needs More Info | ${plan.metrics.needsMoreInfoCount} |`);
  lines.push(`| Expected Behavior | ${plan.metrics.expectedBehaviorCount} |`);
  lines.push(`| Total Effort (SP) | ${plan.metrics.totalEffortPoints} |`);
  lines.push(`| Critical Effort (SP) | ${plan.metrics.effortByCategory.critical} |`);
  lines.push(`| Important Effort (SP) | ${plan.metrics.effortByCategory.important} |`);
  lines.push(`| Planned Effort (SP) | ${plan.metrics.effortByCategory.planned} |`);
  lines.push('');

  // Severity distribution
  lines.push('### Severity Distribution');
  lines.push('');
  lines.push('| Severity | Count |');
  lines.push('|----------|-------|');
  for (const sev of ['Critical', 'High', 'Medium', 'Low'] as Severity[]) {
    lines.push(`| ${sev} | ${plan.metrics.distributionBySeverity[sev]} |`);
  }
  lines.push('');

  // Datadog metrics (if extended plan)
  if (extendedPlan?.datadogMetrics) {
    const ddm = extendedPlan.datadogMetrics;
    lines.push('### Datadog Metrics');
    lines.push('');
    lines.push('| Metric | Value |');
    lines.push('|--------|-------|');
    lines.push(`| Total Findings | ${ddm.totalFindings} |`);
    lines.push(`| Correlated | ${ddm.correlatedCount} |`);
    lines.push(`| Uncorrelated | ${ddm.uncorrelatedCount} |`);
    lines.push('');

    lines.push('#### By Type');
    lines.push('');
    lines.push('| Type | Count |');
    lines.push('|------|-------|');
    for (const type of ['log', 'monitor', 'incident'] as DatadogFindingType[]) {
      lines.push(`| ${type} | ${ddm.distributionByType[type] ?? 0} |`);
    }
    lines.push('');

    lines.push('#### By Criticality');
    lines.push('');
    lines.push('| Criticality | Count |');
    lines.push('|-------------|-------|');
    for (const crit of ['critical', 'high', 'medium', 'low'] as SuggestedCriticality[]) {
      lines.push(`| ${crit} | ${ddm.distributionByCriticality[crit] ?? 0} |`);
    }
    lines.push('');
  }

  // Prioritized bugs grouped by category
  lines.push('## Prioritized Bugs');
  lines.push('');

  const categories: PriorityCategory[] = ['critical', 'important', 'planned'];
  for (const category of categories) {
    const bugs = plan.prioritizedBugs.filter(b => b.category === category);
    if (bugs.length === 0) continue;

    lines.push(`### ${capitalize(category)}`);
    lines.push('');

    for (const pb of bugs) {
      lines.push(`#### ${pb.bug.key} — ${pb.bug.summary}`);
      lines.push('');
      lines.push(`- **Severity:** ${pb.validation.severity}`);
      lines.push(`- **Priority Score:** ${pb.priorityScore.total.toFixed(1)}`);
      lines.push(`- **Effort:** ${pb.estimate.storyPoints} story points (${pb.estimate.confidence} confidence)`);
      lines.push(`- **Classification:** ${pb.validation.classification}`);
      lines.push(`- **Justification:** ${pb.validation.justification}`);
      lines.push('');
      lines.push('**Resolution Steps:**');
      lines.push('');
      for (const step of pb.suggestion.steps) {
        lines.push(`1. ${step}`);
      }
      lines.push('');
      lines.push(`**Probable Origin:** ${pb.suggestion.probableOrigin}`);
      lines.push('');
      lines.push(`**Testing Approach:** ${pb.suggestion.testingApproach}`);
      lines.push('');
    }
  }

  // Failed bugs section
  if (plan.failedBugs.length > 0) {
    lines.push('## Failed Bug Analyses');
    lines.push('');
    lines.push('The following bugs could not be analyzed:');
    lines.push('');
    lines.push('| Bug ID | Summary | Reason |');
    lines.push('|--------|---------|--------|');
    for (const fb of plan.failedBugs) {
      lines.push(`| ${fb.bugId} | ${fb.summary} | ${fb.reason} |`);
    }
    lines.push('');
  }

  // Datadog findings section (if extended plan)
  if (extendedPlan && extendedPlan.datadogFindings.length > 0) {
    lines.push('## Hallazgos de Datadog');
    lines.push('');

    for (const af of extendedPlan.datadogFindings) {
      const badge = criticalityBadge(af.suggestedCriticality);
      lines.push(`### ${badge} ${af.finding.title}`);
      lines.push('');
      lines.push(`- **Criticality:** ${af.suggestedCriticality}`);
      lines.push(`- **Type:** ${af.finding.type}`);
      lines.push(`- **Service:** ${af.affectedService}`);
      if (af.affectedEndpoint) {
        lines.push(`- **Endpoint:** ${af.affectedEndpoint}`);
      }
      lines.push(`- **Label:** ${af.label}`);
      if (af.correlatedBugKey) {
        lines.push(`- **Correlated Bug:** ${af.correlatedBugKey}`);
      } else {
        lines.push('- **Correlation:** Hallazgo sin bug reportado');
      }
      lines.push('');
      lines.push(`**Suggestion:** ${af.resolutionSuggestion}`);
      lines.push('');
      if (af.resolutionSteps.length > 0) {
        lines.push('**Resolution Steps:**');
        lines.push('');
        for (const step of af.resolutionSteps) {
          lines.push(`1. ${step}`);
        }
        lines.push('');
      }
    }
  }

  // Issue proposals section (if extended plan has uncorrelated findings)
  if (extendedPlan && extendedPlan.issueProposals.length > 0) {
    lines.push('## Propuestas de Issues');
    lines.push('');
    lines.push('The following Datadog findings have no correlated Jira bug. Proposed issues:');
    lines.push('');
    lines.push('| Finding ID | Title | Severity | Component | Service |');
    lines.push('|------------|-------|----------|-----------|---------|');
    for (const proposal of extendedPlan.issueProposals) {
      lines.push(`| ${proposal.findingId} | ${proposal.title} | ${proposal.suggestedSeverity} | ${proposal.component} | ${proposal.service} |`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Plan filtering
// ---------------------------------------------------------------------------

/**
 * Filters a ResolutionPlan by severity and/or category, recalculating metrics.
 */
export function filterPlan(
  plan: ResolutionPlan,
  filter: { severity?: Severity; category?: PriorityCategory }
): ResolutionPlan {
  let filtered = plan.prioritizedBugs;

  if (filter.severity) {
    filtered = filtered.filter(b => b.validation.severity === filter.severity);
  }
  if (filter.category) {
    filtered = filtered.filter(b => b.category === filter.category);
  }

  const metrics = calculateMetrics(filtered, plan.failedBugs);

  return {
    ...plan,
    prioritizedBugs: filtered,
    metrics,
    executiveSummary: buildExecutiveSummary(plan.projectKey, metrics, filtered),
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function isExtendedPlan(plan: ResolutionPlan): plan is ExtendedResolutionPlan {
  return Array.isArray((plan as ExtendedResolutionPlan).datadogFindings);
}

function criticalityBadge(criticality: SuggestedCriticality): string {
  switch (criticality) {
    case 'critical': return '🔴';
    case 'high': return '🟠';
    case 'medium': return '🟡';
    case 'low': return '🟢';
    default: return '⚪';
  }
}
