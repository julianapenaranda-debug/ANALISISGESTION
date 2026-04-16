/**
 * JQL Builder
 *
 * Construye consultas JQL para el módulo Developer Workload.
 * Función pura, sin side effects.
 *
 * Requerimientos: 2.1, 2.2, 2.3, 2.4
 */

import { WorkloadFilters } from './workload-models';

/**
 * Builds a JQL query string for fetching Story issues with optional filters.
 *
 * Always includes:
 *   project = <projectKey> AND issuetype = Story AND assignee is not EMPTY
 *
 * Optional clauses added when present in filters:
 *   AND sprint = "<filters.sprint>"
 *   AND created >= "<filters.startDate>"
 *   AND created <= "<filters.endDate>"
 */
export function buildWorkloadJql(projectKey: string, filters?: WorkloadFilters): string {
  const clauses: string[] = [
    `project = ${projectKey}`,
    `assignee is not EMPTY`,
  ];

  if (filters?.sprint) {
    clauses.push(`sprint = "${filters.sprint}"`);
  }

  if (filters?.startDate) {
    clauses.push(`created >= "${filters.startDate}"`);
  }

  if (filters?.endDate) {
    clauses.push(`created <= "${filters.endDate}"`);
  }

  return clauses.join(' AND ');
}
