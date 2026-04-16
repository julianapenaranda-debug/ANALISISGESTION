/**
 * SupportAgent
 *
 * Orchestrates the full bug analysis flow: fetch → validate → estimate →
 * prioritize → suggest → plan → persist. Also handles Jira sync.
 *
 * Requirements: 1.1, 1.4, 2.1-2.6, 3.1-3.6, 4.1-4.5, 5.1-5.6,
 *               6.1-6.6, 7.1-7.5, 8.2, 8.3, 8.5, 9.1, 9.2, 9.3
 */

import { CredentialStore } from '../storage/credential-store';
import { WorkspaceStore } from '../storage/workspace-store';
import { fetchBugIssues, updateBugWithAnalysis, JiraCredentials } from '../integration/jira-connector';
import { fetchDatadogFindings, DatadogCredentials } from '../integration/datadog-connector';
import { analyzeDatadogFindings, CRITICALITY_ORDER } from './datadog-findings-analyzer';

import {
  AnalysisRequest,
  ResolutionPlan,
  ExtendedResolutionPlan,
  SyncReport,
  AnalyzedBug,
  FailedBugAnalysis,
  BugUpdatePayload,
  AnalyzedDatadogFinding,
  BugIssue,
  DatadogIssueProposal,
  DatadogMetrics,
  DatadogFindingType,
  SuggestedCriticality,
} from './support-agent-models';

import { validateBug } from './bug-validator';
import { estimateEffort } from './effort-estimator';
import { prioritizeBugs } from './bug-prioritizer';
import { generateSuggestion } from './resolution-suggestion-generator';
import { generateResolutionPlan } from './resolution-plan-generator';

// Singleton stores (can be overridden in tests)
const credentialStore = new CredentialStore();
const workspaceStore = new WorkspaceStore();

// ---------------------------------------------------------------------------
// Severity → Jira priority mapping
// ---------------------------------------------------------------------------

const SEVERITY_TO_JIRA_PRIORITY: Record<string, string> = {
  Critical: 'Highest',
  High: 'High',
  Medium: 'Medium',
  Low: 'Low',
};

// ---------------------------------------------------------------------------
// analyzeBugs
// ---------------------------------------------------------------------------

/**
 * Fetches bugs from Jira, analyzes each one, builds a prioritized Resolution
 * Plan, persists it, and returns it.
 *
 * If `includeDatadog` is true, also fetches Datadog findings in parallel,
 * analyzes them, correlates with Jira bugs, and returns an ExtendedResolutionPlan.
 *
 * Requerimientos: 1.1, 1.5, 1.6, 2.5, 4.1, 4.2, 4.3, 5.1, 5.2, 5.4, 7.1, 7.4
 */
export async function analyzeBugs(request: AnalysisRequest): Promise<ExtendedResolutionPlan> {
  const { projectKey, credentialKey, filters, includeDatadog, datadogService } = request;

  // 1. Get Jira credentials
  const credentials = await credentialStore.retrieve(credentialKey);
  if (!credentials) {
    throw Object.assign(
      new Error(`JIRA_AUTH_FAILED: No credentials found for key: ${credentialKey}`),
      { code: 'JIRA_AUTH_FAILED' }
    );
  }

  // 2. Fetch Jira bugs (and optionally Datadog findings in parallel)
  let bugs: BugIssue[];
  let datadogFindings: import('./support-agent-models').DatadogFinding[] = [];
  let datadogWarning: string | undefined;

  if (includeDatadog) {
    // Retrieve Datadog credentials
    let ddCredentials: DatadogCredentials | null = null;
    try {
      const rawDdCreds = await credentialStore.retrieve('datadog-main');
      if (rawDdCreds) {
        ddCredentials = rawDdCreds as unknown as DatadogCredentials;
      }
    } catch {
      // Credential retrieval failed
    }

    if (!ddCredentials) {
      // No Datadog credentials — continue with Jira only
      datadogWarning = 'Credenciales de Datadog no encontradas. Análisis continuó solo con Jira.';
      bugs = await fetchBugIssues(credentials as unknown as JiraCredentials, projectKey, filters);
    } else {
      // Fetch Jira and Datadog in parallel
      const [jiraResult, ddResult] = await Promise.allSettled([
        fetchBugIssues(credentials as unknown as JiraCredentials, projectKey, filters),
        fetchDatadogFindings(ddCredentials, datadogService),
      ]);

      // Handle Jira result
      if (jiraResult.status === 'fulfilled') {
        bugs = jiraResult.value;
      } else {
        throw Object.assign(
          new Error(`JIRA_FETCH_FAILED: ${jiraResult.reason?.message ?? 'Unknown error'}`),
          { code: 'JIRA_FETCH_FAILED' }
        );
      }

      // Handle Datadog result
      if (ddResult.status === 'fulfilled') {
        datadogFindings = ddResult.value;
      } else {
        datadogWarning = `Error al consultar Datadog: ${ddResult.reason?.message ?? 'Unknown error'}. Análisis continuó solo con Jira.`;
      }
    }
  } else {
    // No Datadog — standard Jira-only flow
    bugs = await fetchBugIssues(credentials as unknown as JiraCredentials, projectKey, filters);
  }

  // 3. Analyze Jira bugs (partial failure resilience)
  const analyzed: AnalyzedBug[] = [];
  const failedBugs: FailedBugAnalysis[] = [];

  for (const bug of bugs) {
    try {
      const validation = validateBug(bug, bugs);
      const estimate = estimateEffort(bug, validation);
      const suggestion = generateSuggestion(bug, validation);
      analyzed.push({ bug, validation, estimate, suggestion });
    } catch (err: any) {
      failedBugs.push({
        bugId: bug.id,
        summary: bug.summary,
        reason: err?.message ?? 'Unknown analysis error',
      });
    }
  }

  // 4. Prioritize Jira bugs
  const prioritized = prioritizeBugs(analyzed);

  // 5. Generate base resolution plan
  const basePlan = generateResolutionPlan(projectKey, prioritized, failedBugs);

  // 6. Process Datadog findings if available
  if (includeDatadog && datadogFindings.length > 0) {
    // Analyze findings
    const analyzedFindings = await analyzeDatadogFindings(datadogFindings);

    // Correlate with Jira bugs
    const correlated = correlateFindings(analyzedFindings, bugs);

    // Generate issue proposals for uncorrelated findings
    const proposals = generateIssueProposals(correlated);

    // Sort by criticality (critical > high > medium > low)
    const sorted = [...correlated].sort(
      (a, b) => CRITICALITY_ORDER[a.suggestedCriticality] - CRITICALITY_ORDER[b.suggestedCriticality]
    );

    // Calculate DatadogMetrics
    const ddMetrics = calculateDatadogMetrics(sorted);

    const extendedPlan: ExtendedResolutionPlan = {
      ...basePlan,
      datadogFindings: sorted,
      datadogMetrics: ddMetrics,
      datadogWarning,
      issueProposals: proposals,
    };

    await persistPlan(extendedPlan);
    return extendedPlan;
  }

  // 7. Return plan (with empty Datadog arrays for type compatibility)
  const extendedPlan: ExtendedResolutionPlan = {
    ...basePlan,
    datadogFindings: [],
    datadogWarning,
    issueProposals: [],
  };

  await persistPlan(extendedPlan);
  return extendedPlan;
}

// ---------------------------------------------------------------------------
// syncPlanToJira
// ---------------------------------------------------------------------------

/**
 * Loads a persisted plan, builds Jira update payloads, and syncs to Jira.
 */
export async function syncPlanToJira(planId: string, credentialKey: string): Promise<SyncReport> {
  // 1. Load plan
  const raw = await workspaceStore.loadWorkspace(`support-plan-${planId}`);
  // The plan is stored as a Workspace; the actual ResolutionPlan is in the
  // workspace's metadata-adjacent field we stored as JSON.
  const plan: ResolutionPlan = (raw as any).plan as ResolutionPlan;

  if (!plan) {
    throw Object.assign(
      new Error(`PLAN_NOT_FOUND: No plan found with id: ${planId}`),
      { code: 'PLAN_NOT_FOUND' }
    );
  }

  // 2. Get credentials
  const credentials = await credentialStore.retrieve(credentialKey);
  if (!credentials) {
    throw Object.assign(
      new Error(`JIRA_AUTH_FAILED: No credentials found for key: ${credentialKey}`),
      { code: 'JIRA_AUTH_FAILED' }
    );
  }

  // 3. Build update payloads
  const updates: BugUpdatePayload[] = plan.prioritizedBugs.map(pb => {
    const comment = buildSyncComment(pb);
    const priority = SEVERITY_TO_JIRA_PRIORITY[pb.validation.severity] ?? 'Medium';
    return {
      bugKey: pb.bug.key,
      comment,
      priority,
      labels: [...(pb.bug.labels ?? []), 'support-agent-reviewed'],
    };
  });

  // 4. Sync to Jira
  return updateBugWithAnalysis(credentials as unknown as JiraCredentials, updates);
}

// ---------------------------------------------------------------------------
// Datadog Metrics
// ---------------------------------------------------------------------------

/**
 * Calculates DatadogMetrics from analyzed findings.
 *
 * Requerimientos: 4.2, 7.4
 */
function calculateDatadogMetrics(findings: AnalyzedDatadogFinding[]): DatadogMetrics {
  const totalFindings = findings.length;
  const correlatedCount = findings.filter(f => f.correlatedBugKey).length;
  const uncorrelatedCount = totalFindings - correlatedCount;

  const distributionByType: Record<DatadogFindingType, number> = {
    log: 0,
    monitor: 0,
    incident: 0,
  };
  const distributionByCriticality: Record<SuggestedCriticality, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };

  for (const f of findings) {
    distributionByType[f.finding.type]++;
    distributionByCriticality[f.suggestedCriticality]++;
  }

  return {
    totalFindings,
    correlatedCount,
    uncorrelatedCount,
    distributionByType,
    distributionByCriticality,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function persistPlan(plan: ResolutionPlan): Promise<void> {
  // We store the plan as a "workspace" with a special key.
  // The WorkspaceStore expects a Workspace shape; we embed the plan in it.
  const workspaceId = `support-plan-${plan.id}`;
  await workspaceStore.saveWorkspace({
    id: workspaceId,
    name: `Support Plan ${plan.id}`,
    projectKey: plan.projectKey,
    stories: [],
    epics: [],
    metadata: {
      created: plan.generatedAt,
      modified: plan.generatedAt,
      syncStatus: 'pending',
      jiraProjectKey: plan.projectKey,
    },
    // Embed the full plan for retrieval
    ...(({ plan } as any)),
  } as any);
}

function buildSyncComment(pb: import('./support-agent-models').PrioritizedBug): string {
  const lines: string[] = [
    `[Support Agent Analysis]`,
    ``,
    `Validation: ${pb.validation.classification} | Severity: ${pb.validation.severity}`,
    `Justification: ${pb.validation.justification}`,
    ``,
    `Effort Estimate: ${pb.estimate.storyPoints} story points (${pb.estimate.confidence} confidence)`,
    `Estimation: ${pb.estimate.justification}`,
    ``,
    `Priority Score: ${pb.priorityScore.total.toFixed(1)} (${pb.category})`,
    ``,
    `Resolution Steps:`,
    ...pb.suggestion.steps.map((s, i) => `${i + 1}. ${s}`),
    ``,
    `Probable Origin: ${pb.suggestion.probableOrigin}`,
    `Testing Approach: ${pb.suggestion.testingApproach}`,
  ];

  if (pb.suggestion.errorInterpretation) {
    lines.push(``, `Error Interpretation: ${pb.suggestion.errorInterpretation}`);
  }
  if (pb.suggestion.reproductionStepsUsage) {
    lines.push(``, `Reproduction Steps Usage: ${pb.suggestion.reproductionStepsUsage}`);
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Tokenization (same pattern as bug-validator.ts)
// ---------------------------------------------------------------------------

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
// Jaccard similarity
// ---------------------------------------------------------------------------

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  const intersection = new Set([...a].filter(w => b.has(w)));
  const union = new Set([...a, ...b]);
  return intersection.size / union.size;
}

// ---------------------------------------------------------------------------
// correlateFindings
// ---------------------------------------------------------------------------

const CORRELATION_THRESHOLD = 0.3;

/**
 * Correlates analyzed Datadog findings with Jira bugs using Jaccard
 * similarity on tokenized text. Assigns `correlatedBugKey` to findings
 * that exceed the threshold (>0.3).
 *
 * Requerimientos: 7.1, 7.2, 7.3
 */
export function correlateFindings(
  findings: AnalyzedDatadogFinding[],
  bugs: BugIssue[]
): AnalyzedDatadogFinding[] {
  return findings.map(f => {
    const findingTokens = tokenize(`${f.finding.title} ${f.finding.message}`);

    let bestKey: string | undefined;
    let bestScore = 0;

    for (const bug of bugs) {
      const bugTokens = tokenize(`${bug.summary} ${bug.description}`);
      const score = jaccardSimilarity(findingTokens, bugTokens);
      if (score > CORRELATION_THRESHOLD && score > bestScore) {
        bestScore = score;
        bestKey = bug.key;
      }
    }

    return { ...f, correlatedBugKey: bestKey };
  });
}

// ---------------------------------------------------------------------------
// generateIssueProposals
// ---------------------------------------------------------------------------

/**
 * Generates a DatadogIssueProposal for each finding that has no
 * correlatedBugKey (i.e. no matching Jira bug was found).
 *
 * Requerimientos: 8.1, 8.6
 */
export function generateIssueProposals(
  findings: AnalyzedDatadogFinding[]
): DatadogIssueProposal[] {
  return findings
    .filter(f => !f.correlatedBugKey)
    .map(f => ({
      findingId: f.finding.id,
      title: `[Datadog] ${f.finding.title}`,
      description: `${f.finding.message}\n\nResolution suggestion: ${f.resolutionSuggestion}`,
      suggestedSeverity: f.suggestedCriticality,
      component: f.affectedService,
      service: f.finding.service,
    }));
}
