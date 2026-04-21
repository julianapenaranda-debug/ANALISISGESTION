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
 * Issue types that represent management/governance work (PO, QA leads, etc.)
 * These are excluded from the workload analysis to show only developer work.
 */
const EXCLUDED_ISSUE_TYPES = ['Epic', 'Iniciativa'];

/**
 * Builds a JQL query string for fetching developer work items with optional filters.
 *
 * Always includes:
 *   project = <projectKey> AND assignee is not EMPTY
 *   AND issuetype not in (Epic, Iniciativa)
 *
 * This excludes management-level issue types so only developer work
 * (Sub-tarea, Historia, Upstream, Spike, Requerimiento Caja, etc.) is analyzed.
 *
 * Optional clauses added when present in filters:
 *   AND sprint = "<filters.sprint>"
 *   AND created >= "<filters.startDate>"
 *   AND created <= "<filters.endDate>"
 */
export function buildWorkloadJql(projectKey: string, filters?: WorkloadFilters): string {
  const excludedTypes = EXCLUDED_ISSUE_TYPES.map(t => `"${t}"`).join(', ');
  const clauses: string[] = [
    `project = ${projectKey}`,
    `assignee is not EMPTY`,
    `issuetype not in (${excludedTypes})`,
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
