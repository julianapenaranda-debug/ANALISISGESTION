/**
 * Flow Metrics Analyzer
 *
 * Orchestrates the flow metrics analysis:
 * retrieves credentials, queries Jira, and delegates calculation to pure functions.
 *
 * Follows the same pattern as workload-analyzer.ts.
 *
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6
 */

import { CredentialStore } from '../storage/credential-store';
import { JiraCredentials, fetchStoryIssues } from '../integration/jira-connector';
import { buildFlowMetricsJql, buildFlowMetricsReport } from './flow-metrics-calculator';
import { FlowMetricsRequest, FlowMetricsReport } from './flow-metrics-models';

const credentialStore = new CredentialStore();

/**
 * Analyzes flow metrics for a given project.
 * Throws an error with code CREDENTIALS_NOT_FOUND if the credentialKey is not found.
 */
export async function analyzeFlowMetrics(request: FlowMetricsRequest): Promise<FlowMetricsReport> {
  const { projectKey, credentialKey, filters } = request;

  // Retrieve credentials
  const credentials = await credentialStore.retrieve(credentialKey);
  if (!credentials) {
    const err = new Error(`Credentials not found: ${credentialKey}`);
    (err as any).code = 'CREDENTIALS_NOT_FOUND';
    throw err;
  }

  // Build JQL (no issuetype filter — captures all types for typology)
  const jql = buildFlowMetricsJql(projectKey, filters);

  // Fetch issues with changelog
  const issues = await fetchStoryIssues(credentials as unknown as JiraCredentials, jql);

  // Empty project — return empty report
  if (issues.length === 0) {
    return {
      projectKey,
      generatedAt: new Date().toISOString(),
      filters: filters ?? {},
      summary: {
        leadTimeAverage: null,
        cycleTimeAverage: null,
        throughputTotal: 0,
        wipTotal: 0,
        flowEfficiencyAverage: null,
      },
      throughputByType: [],
      wipByDeveloper: [],
      typology: {
        valueWorkCount: 0,
        supportWorkCount: 0,
        valueWorkPercent: 0,
        supportWorkPercent: 0,
      },
      bottlenecks: [],
      agingIssues: [],
      recommendations: [],
    };
  }

  // Delegate to pure calculator
  return buildFlowMetricsReport(issues, projectKey, filters);
}
