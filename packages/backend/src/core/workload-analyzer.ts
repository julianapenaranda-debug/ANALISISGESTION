/**
 * Workload Analyzer
 *
 * Orchestrates the developer workload analysis:
 * retrieves credentials, queries Jira, calculates metrics, and builds the report.
 *
 * Requerimientos: 1.1, 1.2, 1.4, 1.5, 5.3, 6.1, 6.2, 8.1, 8.4
 */

import { CredentialStore } from '../storage/credential-store';
import { JiraCredentials } from '../integration/jira-connector';
import { fetchStoryIssues, fetchProjectSprints } from '../integration/jira-connector';
import { buildWorkloadJql } from './jql-builder';
import {
  groupStoriesByAssignee,
  calculateTeamAverages,
  calculateDeveloperMetrics,
  buildAlerts,
  calculateSummary,
} from './metrics-calculator';
import {
  WorkloadRequest,
  WorkloadReport,
  SprintInfo,
} from './workload-models';

const credentialStore = new CredentialStore();

/**
 * Analyzes developer workload for a given project.
 * Throws an error with code CREDENTIALS_NOT_FOUND if the credentialKey is not found.
 */
export async function analyzeWorkload(request: WorkloadRequest): Promise<WorkloadReport> {
  const { projectKey, credentialKey, filters = {} } = request;

  // Retrieve credentials
  const credentials = await credentialStore.retrieve(credentialKey);
  if (!credentials) {
    const err = new Error(`Credentials not found: ${credentialKey}`);
    (err as any).code = 'CREDENTIALS_NOT_FOUND';
    throw err;
  }

  // Build JQL and fetch stories
  const jql = buildWorkloadJql(projectKey, filters);
  const stories = await fetchStoryIssues(credentials as unknown as JiraCredentials, jql);

  // Empty project — return empty report
  if (stories.length === 0) {
    return {
      projectKey,
      generatedAt: new Date().toISOString(),
      filters,
      summary: {
        totalDevelopers: 0,
        totalHUs: 0,
        averageStoryPointsPerDeveloper: 0,
        teamVelocityAverage: 0,
        teamCycleTimeAverage: null,
        teamLeadTimeAverage: null,
        teamThroughput: 0,
        teamWIP: 0,
        agingWIPAverage: null,
        reworkRatio: 0,
        predictabilityIndex: null,
        spDistributionEquity: null,
      },
      developers: [],
      alerts: [],
      hasAlerts: false,
    };
  }

  // Group by assignee
  const grouped = groupStoriesByAssignee(stories);
  const developerCount = grouped.size;

  // Team averages
  const teamAverages = calculateTeamAverages(stories, developerCount);

  // Per-developer metrics
  const developers = Array.from(grouped.entries()).map(([accountId, devStories]) =>
    calculateDeveloperMetrics(accountId, devStories, teamAverages)
  );

  // Alerts and summary
  const alerts = buildAlerts(developers);
  const summary = calculateSummary(developers, stories);

  return {
    projectKey,
    generatedAt: new Date().toISOString(),
    filters,
    summary,
    developers,
    alerts,
    hasAlerts: alerts.length > 0,
  };
}

/**
 * Returns the list of available sprints for a project.
 */
export async function getProjectSprints(
  projectKey: string,
  credentialKey: string
): Promise<SprintInfo[]> {
  const credentials = await credentialStore.retrieve(credentialKey);
  if (!credentials) {
    const err = new Error(`Credentials not found: ${credentialKey}`);
    (err as any).code = 'CREDENTIALS_NOT_FOUND';
    throw err;
  }

  return fetchProjectSprints(credentials as unknown as JiraCredentials, projectKey);
}
