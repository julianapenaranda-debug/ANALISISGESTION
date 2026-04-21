/**
 * Flow Metrics Calculator
 *
 * Funciones puras para el cálculo de métricas de flujo Lean Agile.
 * Sin side effects — reciben datos y retornan resultados calculados.
 *
 * Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 5.1, 5.2, 5.3, 5.6, 10.6
 */

import type {
  JiraStory,
  FlowMetricsFilters,
  ThroughputByType,
  DeveloperWIP,
  TypologyBreakdown,
  Bottleneck,
  AgingIssue,
  FlowRecommendation,
  FlowMetricsReport,
  DeveloperCognitiveLoad,
  CognitiveLoadSummary,
  CognitiveAlertLevel,
  CFDData,
  CFDDataPoint,
  ScopeCreepData,
} from './flow-metrics-models';
import {
  ACTIVE_STATUSES,
  PASSIVE_STATUSES,
  DONE_STATUSES,
  VALUE_WORK_TYPES,
  BACKLOG_STATUSES,
  HU_TYPES,
  SUBTASK_TYPES,
} from './flow-metrics-models';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Case-insensitive check if a status belongs to a status set */
function statusIn(status: string, statusSet: readonly string[]): boolean {
  const lower = status.toLowerCase();
  return statusSet.some((s) => s.toLowerCase() === lower);
}

/** Difference in calendar days between two ISO-8601 date strings */
function daysBetween(startISO: string, endISO: string): number {
  const ms = new Date(endISO).getTime() - new Date(startISO).getTime();
  return ms / (1000 * 60 * 60 * 24);
}

// ---------------------------------------------------------------------------
// JQL Builder
// ---------------------------------------------------------------------------

/**
 * Builds a JQL query for Flow Metrics — no issuetype filter so all issue
 * types are captured for typology analysis.
 *
 * Requirement 10.6
 */
export function buildFlowMetricsJql(
  projectKey: string,
  filters?: FlowMetricsFilters,
): string {
  const clauses: string[] = [
    `project = ${projectKey}`,
    `assignee is not EMPTY`,
    `issuetype not in ("Epic", "Iniciativa")`,
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


// ---------------------------------------------------------------------------
// Lead Time
// ---------------------------------------------------------------------------

/**
 * Calculates Lead Time in calendar days for a single issue.
 *
 * Lead Time = created → resolution.
 * - Uses `resolutionDate` when available.
 * - Falls back to the last changelog transition into a Done_Status.
 * - Returns null for issues not in a Done status.
 *
 * Requirements 1.1, 1.2, 1.3
 */
export function calculateLeadTime(issue: JiraStory): number | null {
  if (!statusIn(issue.status, DONE_STATUSES)) {
    return null;
  }

  let endDate: string | null = issue.resolutionDate;

  if (!endDate && issue.changelog) {
    // Find the last transition into a Done status
    for (let i = issue.changelog.length - 1; i >= 0; i--) {
      const change = issue.changelog[i];
      if (change.field === 'status' && statusIn(change.toStatus, DONE_STATUSES)) {
        endDate = change.changedAt;
        break;
      }
    }
  }

  if (!endDate) {
    return null;
  }

  const days = daysBetween(issue.created, endDate);
  return Math.max(0, days);
}

// ---------------------------------------------------------------------------
// Cycle Time
// ---------------------------------------------------------------------------

/**
 * Calculates Cycle Time in calendar days for a single issue.
 *
 * Cycle Time = first Active transition → resolution.
 * Returns null if the issue is not done or has no Active transition.
 *
 * Requirements 2.1, 2.2
 */
export function calculateCycleTime(issue: JiraStory): number | null {
  if (!statusIn(issue.status, DONE_STATUSES)) {
    return null;
  }

  // Find the first transition to an Active status
  const firstActive = issue.changelog?.find(
    (c) => c.field === 'status' && statusIn(c.toStatus, ACTIVE_STATUSES),
  );

  if (!firstActive) {
    return null;
  }

  let endDate: string | null = issue.resolutionDate;

  if (!endDate && issue.changelog) {
    for (let i = issue.changelog.length - 1; i >= 0; i--) {
      const change = issue.changelog[i];
      if (change.field === 'status' && statusIn(change.toStatus, DONE_STATUSES)) {
        endDate = change.changedAt;
        break;
      }
    }
  }

  if (!endDate) {
    return null;
  }

  const days = daysBetween(firstActive.changedAt, endDate);
  return Math.max(0, days);
}

// ---------------------------------------------------------------------------
// Touch Time
// ---------------------------------------------------------------------------

/**
 * Calculates Touch Time — total days spent in Active statuses.
 *
 * Iterates through changelog status transitions. For each transition INTO an
 * Active status, the duration is the time until the next status transition
 * (or resolutionDate / now for the last transition).
 *
 * Requirement 5.1
 */
export function calculateTouchTime(issue: JiraStory): number {
  return calculateTimeInStatuses(issue, ACTIVE_STATUSES);
}

// ---------------------------------------------------------------------------
// Wait Time
// ---------------------------------------------------------------------------

/**
 * Calculates Wait Time — total days spent in Passive statuses.
 *
 * Same logic as Touch Time but for Passive statuses.
 *
 * Requirement 5.2
 */
export function calculateWaitTime(issue: JiraStory): number {
  return calculateTimeInStatuses(issue, PASSIVE_STATUSES);
}

/**
 * Shared helper: sums time spent in a given set of statuses by walking the
 * changelog transitions.
 *
 * For each status transition, we know the issue entered `toStatus` at
 * `changedAt`. The issue stays in that status until the next transition's
 * `changedAt` (or resolutionDate / now for the last entry).
 */
function calculateTimeInStatuses(
  issue: JiraStory,
  statusSet: readonly string[],
): number {
  const statusChanges = (issue.changelog ?? []).filter(
    (c) => c.field === 'status',
  );

  if (statusChanges.length === 0) {
    return 0;
  }

  let totalDays = 0;
  const fallbackEnd =
    issue.resolutionDate ?? new Date().toISOString();

  for (let i = 0; i < statusChanges.length; i++) {
    const current = statusChanges[i];
    if (!statusIn(current.toStatus, statusSet)) {
      continue;
    }

    const nextChangeAt =
      i + 1 < statusChanges.length
        ? statusChanges[i + 1].changedAt
        : fallbackEnd;

    const days = daysBetween(current.changedAt, nextChangeAt);
    totalDays += Math.max(0, days);
  }

  return totalDays;
}

// ---------------------------------------------------------------------------
// Flow Efficiency
// ---------------------------------------------------------------------------

/**
 * Calculates Flow Efficiency as a percentage.
 *
 * Formula: touchTime / (touchTime + waitTime) × 100
 * Returns null when both values are 0 (no meaningful data).
 *
 * Requirements 5.3, 5.6
 */
export function calculateFlowEfficiency(
  touchTime: number,
  waitTime: number,
): number | null {
  const total = touchTime + waitTime;
  if (total === 0) {
    return null;
  }
  return (touchTime / total) * 100;
}


// ---------------------------------------------------------------------------
// Throughput
// ---------------------------------------------------------------------------

/**
 * Counts completed issues (status in Done_Statuses), broken down by issueType.
 *
 * When filters include startDate/endDate, only issues resolved within that
 * range are counted. Resolution date is determined from `resolutionDate` or
 * the last changelog transition into a Done_Status.
 *
 * Requirements 3.1, 3.2, 3.4
 */
export function calculateThroughput(
  issues: JiraStory[],
  filters?: FlowMetricsFilters,
): { total: number; byType: ThroughputByType[] } {
  let completed = issues.filter((i) => statusIn(i.status, DONE_STATUSES));

  if (filters?.startDate || filters?.endDate) {
    completed = completed.filter((issue) => {
      const resolved = getResolutionDate(issue);
      if (!resolved) return false;
      if (filters.startDate && resolved < filters.startDate) return false;
      if (filters.endDate && resolved > filters.endDate) return false;
      return true;
    });
  }

  const counts = new Map<string, number>();
  for (const issue of completed) {
    const t = issue.issueType;
    counts.set(t, (counts.get(t) ?? 0) + 1);
  }

  const byType: ThroughputByType[] = Array.from(counts.entries()).map(
    ([issueType, count]) => ({ issueType, count }),
  );

  return { total: completed.length, byType };
}

/**
 * Resolves the effective resolution date for an issue.
 * Uses `resolutionDate` when available, otherwise falls back to the last
 * changelog transition into a Done_Status.
 */
function getResolutionDate(issue: JiraStory): string | null {
  if (issue.resolutionDate) return issue.resolutionDate;
  if (issue.changelog) {
    for (let i = issue.changelog.length - 1; i >= 0; i--) {
      const c = issue.changelog[i];
      if (c.field === 'status' && statusIn(c.toStatus, DONE_STATUSES)) {
        return c.changedAt;
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// WIP by Developer
// ---------------------------------------------------------------------------

/**
 * Counts issues in Active_Statuses grouped by assignee.
 *
 * Issues without an assignee are excluded.
 *
 * Requirements 4.1, 4.3
 */
export function calculateWIPByDeveloper(issues: JiraStory[]): DeveloperWIP[] {
  const wipMap = new Map<string, { displayName: string; wipCount: number }>();

  for (const issue of issues) {
    if (!statusIn(issue.status, ACTIVE_STATUSES)) continue;
    if (!issue.assignee) continue;

    const { accountId, displayName } = issue.assignee;
    const entry = wipMap.get(accountId);
    if (entry) {
      entry.wipCount += 1;
    } else {
      wipMap.set(accountId, { displayName, wipCount: 1 });
    }
  }

  return Array.from(wipMap.entries()).map(([accountId, { displayName, wipCount }]) => ({
    accountId,
    displayName,
    wipCount,
  }));
}

// ---------------------------------------------------------------------------
// Work Type Classification
// ---------------------------------------------------------------------------

/**
 * Classifies an issue type as 'value' or 'support'.
 *
 * Uses case-insensitive partial matching against VALUE_WORK_TYPES.
 * If the issueType partially matches any entry in VALUE_WORK_TYPES,
 * it is classified as 'value'; otherwise 'support'.
 *
 * Requirements 6.1, 6.2
 */
export function classifyWorkType(issueType: string): 'value' | 'support' {
  const lower = issueType.toLowerCase();
  const isValue = VALUE_WORK_TYPES.some(
    (vt) => lower.includes(vt.toLowerCase()) || vt.toLowerCase().includes(lower),
  );
  return isValue ? 'value' : 'support';
}

// ---------------------------------------------------------------------------
// Typology
// ---------------------------------------------------------------------------

/**
 * Calculates the typology breakdown (Value vs Support work) for a set of issues.
 *
 * Sub-tasks are classified based on their parent issue type:
 * - If parent is a value work type → value
 * - If parent is a support work type → support
 * - If no parent found → excluded from typology (neutral)
 *
 * Returns counts and percentages. When there are no issues, all values are 0.
 *
 * Requirements 6.1, 6.2
 */
export function calculateTypology(issues: JiraStory[]): TypologyBreakdown {
  let valueWorkCount = 0;
  let supportWorkCount = 0;

  // Build a map of issue key → issueType for parent lookups
  const issueTypeMap = new Map<string, string>();
  for (const issue of issues) {
    issueTypeMap.set(issue.key, issue.issueType);
  }

  for (const issue of issues) {
    // For sub-tasks, classify based on parent
    if (isSubtask(issue.issueType)) {
      if (issue.parentKey) {
        const parentType = issueTypeMap.get(issue.parentKey);
        if (parentType) {
          if (classifyWorkType(parentType) === 'value') {
            valueWorkCount++;
          } else {
            supportWorkCount++;
          }
        }
        // If parent not in our dataset, skip this sub-task
      }
      // Sub-tasks without parentKey are skipped
      continue;
    }

    if (classifyWorkType(issue.issueType) === 'value') {
      valueWorkCount++;
    } else {
      supportWorkCount++;
    }
  }

  const total = valueWorkCount + supportWorkCount;
  return {
    valueWorkCount,
    supportWorkCount,
    valueWorkPercent: total > 0 ? (valueWorkCount / total) * 100 : 0,
    supportWorkPercent: total > 0 ? (supportWorkCount / total) * 100 : 0,
  };
}


// ---------------------------------------------------------------------------
// Bottleneck Detection
// ---------------------------------------------------------------------------

/**
 * Detects bottleneck statuses from completed issues.
 *
 * For each completed issue, calculates the percentage of cycle time spent in
 * each status using the changelog. Aggregates across all issues. If a status
 * accumulates > 40% of the average cycle time, it is flagged as a bottleneck.
 *
 * Messages are in Spanish.
 *
 * Requirements 7.1, 7.2
 */
export function detectBottlenecks(completedIssues: JiraStory[]): Bottleneck[] {
  const issuesWithCycleTime = completedIssues.filter(
    (i) => statusIn(i.status, DONE_STATUSES) && calculateCycleTime(i) !== null,
  );

  if (issuesWithCycleTime.length === 0) {
    return [];
  }

  // Accumulate total time per status across all issues
  const statusTimeAccum = new Map<string, number>();
  let totalCycleTime = 0;

  for (const issue of issuesWithCycleTime) {
    const cycleTime = calculateCycleTime(issue)!;
    totalCycleTime += cycleTime;

    const statusChanges = (issue.changelog ?? []).filter(
      (c) => c.field === 'status',
    );

    const fallbackEnd = issue.resolutionDate ?? new Date().toISOString();

    // Only count time within the cycle time window (from first Active transition onward)
    // and exclude backlog states
    const firstActiveIdx = statusChanges.findIndex(c => statusIn(c.toStatus, ACTIVE_STATUSES));
    if (firstActiveIdx < 0) continue; // no active transition, skip

    for (let i = firstActiveIdx; i < statusChanges.length; i++) {
      const current = statusChanges[i];
      // Skip backlog states — they're not part of cycle time
      if (statusIn(current.toStatus, BACKLOG_STATUSES)) continue;

      const nextChangeAt =
        i + 1 < statusChanges.length
          ? statusChanges[i + 1].changedAt
          : fallbackEnd;

      const days = Math.max(0, daysBetween(current.changedAt, nextChangeAt));
      const status = current.toStatus;
      statusTimeAccum.set(status, (statusTimeAccum.get(status) ?? 0) + days);
    }
  }

  const avgCycleTime = totalCycleTime / issuesWithCycleTime.length;
  if (avgCycleTime === 0) {
    return [];
  }

  const bottlenecks: Bottleneck[] = [];

  // Only detect bottlenecks if there are at least 2 different states in the flow.
  // If all cycle time is in a single state, that's the normal flow — not a bottleneck.
  const statesWithTime = Array.from(statusTimeAccum.entries()).filter(([, t]) => t > 0);
  if (statesWithTime.length < 2) {
    return [];
  }

  for (const [status, totalTime] of statusTimeAccum.entries()) {
    const avgTimeInStatus = totalTime / issuesWithCycleTime.length;
    const percentage = (avgTimeInStatus / avgCycleTime) * 100;

    if (percentage > 40) {
      bottlenecks.push({
        status,
        percentageOfCycleTime: Math.round(percentage * 10) / 10,
        message: `Los issues pasan el ${Math.round(percentage)}% del tiempo de ciclo en '${status}' — posible cuello de botella. Revisar si hay bloqueos o dependencias en esta etapa.`,
      });
    }
  }

  return bottlenecks;
}

// ---------------------------------------------------------------------------
// Aging Issues Detection
// ---------------------------------------------------------------------------

/**
 * Detects aging issues — active issues that have been in their current status
 * longer than the historical average for that status.
 *
 * Historical averages are computed from completed issues' changelogs.
 *
 * Requirements 8.1, 8.2
 */
export function detectAgingIssues(
  activeIssues: JiraStory[],
  completedIssues: JiraStory[],
): AgingIssue[] {
  // Build historical average time per status from completed issues
  const statusTimeMap = new Map<string, number[]>();

  for (const issue of completedIssues) {
    const statusChanges = (issue.changelog ?? []).filter(
      (c) => c.field === 'status',
    );

    const fallbackEnd = issue.resolutionDate ?? new Date().toISOString();

    for (let i = 0; i < statusChanges.length; i++) {
      const current = statusChanges[i];
      const nextChangeAt =
        i + 1 < statusChanges.length
          ? statusChanges[i + 1].changedAt
          : fallbackEnd;

      const days = Math.max(0, daysBetween(current.changedAt, nextChangeAt));
      const status = current.toStatus;

      if (!statusTimeMap.has(status)) {
        statusTimeMap.set(status, []);
      }
      statusTimeMap.get(status)!.push(days);
    }
  }

  // Calculate averages
  const statusAvgDays = new Map<string, number>();
  for (const [status, durations] of statusTimeMap.entries()) {
    const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
    statusAvgDays.set(status, avg);
  }

  // Check each active issue
  const agingIssues: AgingIssue[] = [];
  const now = new Date().toISOString();

  for (const issue of activeIssues) {
    if (statusIn(issue.status, DONE_STATUSES)) continue;
    if (statusIn(issue.status, BACKLOG_STATUSES)) continue;

    // Find when the issue entered its current status
    const statusChanges = (issue.changelog ?? []).filter(
      (c) => c.field === 'status',
    );

    let enteredCurrentStatusAt: string | null = null;
    for (let i = statusChanges.length - 1; i >= 0; i--) {
      if (statusChanges[i].toStatus === issue.status) {
        enteredCurrentStatusAt = statusChanges[i].changedAt;
        break;
      }
    }

    // If no changelog entry for current status, use issue created date
    if (!enteredCurrentStatusAt) {
      enteredCurrentStatusAt = issue.created;
    }

    const daysInStatus = Math.max(0, daysBetween(enteredCurrentStatusAt, now));
    const rawAvg = statusAvgDays.get(issue.status) ?? 0;
    // Minimum threshold: at least 3 days to be considered stale
    const avgDays = Math.max(rawAvg, 3);

    // Only flag if the issue has been in the state 1.5x longer than the adjusted average
    if (daysInStatus > avgDays * 1.5) {
      agingIssues.push({
        issueKey: issue.key,
        summary: issue.summary,
        currentStatus: issue.status,
        daysInStatus: Math.round(daysInStatus * 10) / 10,
        averageDaysForStatus: Math.round(avgDays * 10) / 10,
      });
    }
  }

  return agingIssues;
}


// ---------------------------------------------------------------------------
// Recommendations
// ---------------------------------------------------------------------------

/**
 * Generates actionable recommendations based on metric thresholds.
 *
 * Thresholds:
 * - Support work > 50% → support_work_high
 * - Average wait time in any status > 2 days → wait_time_high
 * - WIP total / number of developers > 3 → wip_high
 *
 * All messages in Spanish.
 *
 * Requirements 9.1, 9.2, 9.3
 */
export function generateRecommendations(
  report: Partial<FlowMetricsReport>,
): FlowRecommendation[] {
  const recommendations: FlowRecommendation[] = [];

  // Check support work percentage
  if (report.typology && report.typology.supportWorkPercent > 50) {
    recommendations.push({
      type: 'support_work_high',
      message: `El ${Math.round(report.typology.supportWorkPercent)}% de la capacidad del equipo está consumida por trabajo de soporte. Considere revisar la estabilidad del sistema y reducir incidentes recurrentes.`,
    });
  }

  // Check average wait time per status
  // The design says: "if average Wait_Time in any state exceeds 2 days"
  // _waitTimeByStatus is computed during report building and passed via the partial report
  if ((report as any)._waitTimeByStatus) {
    const waitTimeByStatus = (report as any)._waitTimeByStatus as Map<string, number>;
    for (const [status, avgDays] of waitTimeByStatus.entries()) {
      if (avgDays > 2) {
        recommendations.push({
          type: 'wait_time_high',
          message: `El tiempo promedio de espera en '${status}' es de ${Math.round(avgDays * 10) / 10} días. Considere revisar el proceso para reducir bloqueos en esta etapa.`,
        });
      }
    }
  }

  // Check WIP per developer
  if (report.summary && report.wipByDeveloper) {
    const devCount = report.wipByDeveloper.length;
    if (devCount > 0 && report.summary.wipTotal / devCount > 3) {
      recommendations.push({
        type: 'wip_high',
        message: `El WIP promedio por desarrollador es ${Math.round((report.summary.wipTotal / devCount) * 10) / 10}. Considere limitar el WIP a máximo 3 items por persona para mejorar el flujo.`,
      });
    }
  }

  return recommendations;
}

// ---------------------------------------------------------------------------
// Report Builder
// ---------------------------------------------------------------------------

/**
 * Orchestrates ALL flow metric calculations and returns a complete
 * FlowMetricsReport.
 *
 * Steps:
 * 1. Separate completed vs active issues
 * 2. Calculate lead times, cycle times, throughput, WIP, flow efficiency, typology
 * 3. Detect bottlenecks and aging issues
 * 4. Generate recommendations
 * 5. Return the full report
 *
 * Requirements 10.2
 */
export function buildFlowMetricsReport(
  issues: JiraStory[],
  projectKey: string,
  filters?: FlowMetricsFilters,
): FlowMetricsReport {
  const completedIssues = issues.filter((i) => statusIn(i.status, DONE_STATUSES));
  const activeIssues = issues.filter((i) => !statusIn(i.status, DONE_STATUSES));

  // --- Lead Time ---
  const leadTimes = completedIssues
    .map((i) => calculateLeadTime(i))
    .filter((lt): lt is number => lt !== null);
  const leadTimeAverage =
    leadTimes.length > 0
      ? Math.round((leadTimes.reduce((a, b) => a + b, 0) / leadTimes.length) * 10) / 10
      : null;

  // --- Cycle Time ---
  const cycleTimes = completedIssues
    .map((i) => calculateCycleTime(i))
    .filter((ct): ct is number => ct !== null);
  const cycleTimeAverage =
    cycleTimes.length > 0
      ? Math.round((cycleTimes.reduce((a, b) => a + b, 0) / cycleTimes.length) * 10) / 10
      : null;

  // --- Throughput ---
  const throughput = calculateThroughput(issues, filters);

  // --- WIP ---
  const wipByDeveloper = calculateWIPByDeveloper(issues);
  const wipTotal = wipByDeveloper.reduce((sum, d) => sum + d.wipCount, 0);

  // --- Flow Efficiency ---
  const efficiencies: number[] = [];
  for (const issue of completedIssues) {
    const touchTime = calculateTouchTime(issue);
    const waitTime = calculateWaitTime(issue);
    const eff = calculateFlowEfficiency(touchTime, waitTime);
    if (eff !== null) {
      efficiencies.push(eff);
    }
  }
  const flowEfficiencyAverage =
    efficiencies.length > 0
      ? Math.round((efficiencies.reduce((a, b) => a + b, 0) / efficiencies.length) * 10) / 10
      : null;

  // --- Typology ---
  const typology = calculateTypology(issues);

  // --- Bottlenecks ---
  const bottlenecks = detectBottlenecks(completedIssues);

  // --- Aging Issues ---
  const agingIssues = detectAgingIssues(activeIssues, completedIssues);

  // --- Wait time by status (for recommendations) ---
  const waitTimeByStatus = computeAvgWaitTimeByStatus(completedIssues);

  // --- Build partial report for recommendations ---
  const partialReport: Partial<FlowMetricsReport> & { _waitTimeByStatus: Map<string, number> } = {
    summary: {
      leadTimeAverage,
      cycleTimeAverage,
      throughputTotal: throughput.total,
      wipTotal,
      flowEfficiencyAverage,
    },
    typology,
    bottlenecks,
    wipByDeveloper,
    _waitTimeByStatus: waitTimeByStatus,
  };

  const recommendations = generateRecommendations(partialReport);

  // --- Cognitive Load ---
  const cognitiveLoad = calculateCognitiveLoad(issues);

  // Add cognitive load recommendations
  const redDevs = cognitiveLoad.developers.filter(d => d.alertLevel === 'red');
  if (redDevs.length > 0) {
    recommendations.push({
      type: 'cognitive_overload',
      message: `${redDevs.length} desarrollador(es) en sobrecarga cognitiva (rojo). Stop Starting, Start Finishing: deben cerrar tareas antes de abrir nuevas.`,
    });
  }

  const yellowDevs = cognitiveLoad.developers.filter(d => d.alertLevel === 'yellow' && d.activeHUs > 2);
  if (yellowDevs.length > 0) {
    recommendations.push({
      type: 'context_switching',
      message: `${yellowDevs.length} desarrollador(es) con context switching entre múltiples HUs. La penalización de productividad puede ser hasta del 40%.`,
    });
  }

  if (cognitiveLoad.oversizedHUs.length > 0) {
    recommendations.push({
      type: 'oversized_hu',
      message: `${cognitiveLoad.oversizedHUs.length} HU(s) con más de 8 sub-tareas. Considerar revisión de arquitectura y refinamiento.`,
    });
  }

  return {
    projectKey,
    generatedAt: new Date().toISOString(),
    filters: filters ?? {},
    summary: {
      leadTimeAverage,
      cycleTimeAverage,
      throughputTotal: throughput.total,
      wipTotal,
      flowEfficiencyAverage,
    },
    throughputByType: throughput.byType,
    wipByDeveloper,
    typology,
    bottlenecks,
    agingIssues,
    recommendations,
    cognitiveLoad,
    cfd: buildCFDData(issues, filters),
    scopeCreep: calculateScopeCreep(issues, filters),
  };
}

/**
 * Computes average wait time per passive status from completed issues.
 * Used internally by generateRecommendations.
 */
function computeAvgWaitTimeByStatus(
  completedIssues: JiraStory[],
): Map<string, number> {
  const statusTimeMap = new Map<string, number[]>();

  for (const issue of completedIssues) {
    const statusChanges = (issue.changelog ?? []).filter(
      (c) => c.field === 'status',
    );

    const fallbackEnd = issue.resolutionDate ?? new Date().toISOString();

    for (let i = 0; i < statusChanges.length; i++) {
      const current = statusChanges[i];
      if (!statusIn(current.toStatus, PASSIVE_STATUSES)) continue;

      const nextChangeAt =
        i + 1 < statusChanges.length
          ? statusChanges[i + 1].changedAt
          : fallbackEnd;

      const days = Math.max(0, daysBetween(current.changedAt, nextChangeAt));
      const status = current.toStatus;

      if (!statusTimeMap.has(status)) {
        statusTimeMap.set(status, []);
      }
      statusTimeMap.get(status)!.push(days);
    }
  }

  const avgMap = new Map<string, number>();
  for (const [status, durations] of statusTimeMap.entries()) {
    avgMap.set(status, durations.reduce((a, b) => a + b, 0) / durations.length);
  }

  return avgMap;
}


// ---------------------------------------------------------------------------
// Cognitive Load Analysis (TOC / Ley de Little)
// ---------------------------------------------------------------------------

/**
 * Determines if an issue is in an active (cognitive load) state.
 * Excludes backlog/To Do — those are "expectativa", not real capacity consumption.
 */
function isActiveLoad(status: string): boolean {
  return statusIn(status, ACTIVE_STATUSES) || statusIn(status, PASSIVE_STATUSES);
}

function isSubtask(issueType: string): boolean {
  return SUBTASK_TYPES.some(st => issueType.toLowerCase().includes(st.toLowerCase()));
}

function isHU(issueType: string): boolean {
  return HU_TYPES.some(ht => issueType.toLowerCase().includes(ht.toLowerCase()));
}

/**
 * Calculates cognitive load per developer based on TOC principles.
 *
 * Rules:
 * - Only count issues in active states (In Progress, Testing, Blocked, etc.)
 * - Exclude backlog/To Do (expectativa, no carga real)
 * - Focus Factor = activeSubtasks / activeHUs (lower = more context switching)
 * - Alert levels:
 *   - Verde: 1-2 sub-tareas de 1 sola HU
 *   - Amarillo: 3-5 sub-tareas o sub-tareas de >2 HUs diferentes
 *   - Rojo: >5 sub-tareas activas
 */
export function calculateCognitiveLoad(issues: JiraStory[]): CognitiveLoadSummary {
  // Group active issues by developer
  const devMap = new Map<string, { displayName: string; subtasks: JiraStory[]; hus: Set<string>; allActive: JiraStory[] }>();

  for (const issue of issues) {
    if (!issue.assignee) continue;
    if (!isActiveLoad(issue.status)) continue;
    if (statusIn(issue.status, DONE_STATUSES)) continue;

    const { accountId, displayName } = issue.assignee;
    if (!devMap.has(accountId)) {
      devMap.set(accountId, { displayName, subtasks: [], hus: new Set(), allActive: [] });
    }
    const entry = devMap.get(accountId)!;
    entry.allActive.push(issue);

    if (isSubtask(issue.issueType)) {
      entry.subtasks.push(issue);
      // Use parentKey to track which HU this subtask belongs to
      if (issue.parentKey) {
        entry.hus.add(issue.parentKey);
      }
    } else if (isHU(issue.issueType)) {
      entry.hus.add(issue.key);
    }
  }

  const developers: DeveloperCognitiveLoad[] = [];

  for (const [accountId, data] of devMap.entries()) {
    const activeSubtasks = data.subtasks.length;
    const activeHUs = data.hus.size || (activeSubtasks > 0 ? 1 : 0);
    const totalActive = data.allActive.length;

    const focusFactor = activeHUs > 0 ? activeSubtasks / activeHUs : 0;

    // Determine alert level
    let alertLevel: CognitiveAlertLevel;
    let alertMessage: string;

    if (totalActive > 5 || activeSubtasks > 5) {
      alertLevel = 'red';
      alertMessage = `Stop Starting, Start Finishing: ${data.displayName} tiene ${totalActive} tareas activas bloqueando su flujo. Cierra una antes de abrir otra.`;
    } else if (totalActive >= 3 || activeHUs > 2) {
      alertLevel = 'yellow';
      if (activeHUs > 2) {
        alertMessage = `Multitarea detectada: ${data.displayName} trabaja en ${activeHUs} HUs simultáneamente. El context switching puede reducir productividad hasta un 40%.`;
      } else {
        alertMessage = `${data.displayName} tiene ${totalActive} tareas activas. Considerar limitar a 2 para optimizar el flujo.`;
      }
    } else {
      alertLevel = 'green';
      alertMessage = `${data.displayName} está enfocado. Carga óptima.`;
    }

    developers.push({
      accountId,
      displayName: data.displayName,
      activeSubtasks,
      activeHUs,
      focusFactor: Math.round(focusFactor * 100) / 100,
      alertLevel,
      alertMessage,
      oversizedHUs: [],
    });
  }

  // Detect oversized HUs (>8 subtasks) using parentKey
  const huSubtaskCount = new Map<string, { summary: string; count: number }>();

  // Count subtasks per parent HU using the parentKey field
  for (const issue of issues) {
    if (isSubtask(issue.issueType) && issue.parentKey) {
      const entry = huSubtaskCount.get(issue.parentKey);
      if (entry) {
        entry.count++;
      } else {
        // Find the parent HU to get its summary
        const parent = issues.find(i => i.key === issue.parentKey);
        huSubtaskCount.set(issue.parentKey, {
          summary: parent?.summary ?? issue.parentKey,
          count: 1,
        });
      }
    }
  }

  const oversizedHUs = Array.from(huSubtaskCount.entries())
    .filter(([, data]) => data.count > 8)
    .map(([key, data]) => ({
      key,
      summary: data.summary,
      subtaskCount: data.count,
    }));

  // Also update developer oversizedHUs list
  for (const dev of developers) {
    const devSubtasks = issues.filter(i =>
      isSubtask(i.issueType) && i.assignee?.accountId === dev.accountId && i.parentKey
    );
    const devParentCounts = new Map<string, number>();
    for (const st of devSubtasks) {
      devParentCounts.set(st.parentKey!, (devParentCounts.get(st.parentKey!) ?? 0) + 1);
    }
    dev.oversizedHUs = Array.from(devParentCounts.entries())
      .filter(([, count]) => count > 8)
      .map(([key]) => key);
  }

  const greenCount = developers.filter(d => d.alertLevel === 'green').length;
  const teamFocusScore = developers.length > 0 ? Math.round((greenCount / developers.length) * 100) : 100;

  return { developers, oversizedHUs, teamFocusScore };
}


// ---------------------------------------------------------------------------
// Cumulative Flow Diagram (CFD)
// ---------------------------------------------------------------------------

/**
 * Builds CFD data from issue changelogs.
 *
 * For each day in the range, counts how many issues were in each status.
 * Uses changelog transitions to reconstruct the state of each issue on each day.
 *
 * If bandas se ensanchan → la carga supera la capacidad de salida.
 */
export function buildCFDData(issues: JiraStory[], filters?: FlowMetricsFilters): CFDData {
  if (issues.length === 0) return { dataPoints: [], statuses: [] };

  // Determine date range
  const dates = issues.map(i => new Date(i.created).getTime());
  const minDate = new Date(filters?.startDate || new Date(Math.min(...dates)).toISOString().slice(0, 10));
  const maxDate = new Date(filters?.endDate || new Date().toISOString().slice(0, 10));

  // Build timeline of status for each issue
  const issueTimelines: Array<{ key: string; transitions: Array<{ date: string; status: string }> }> = [];

  for (const issue of issues) {
    const transitions: Array<{ date: string; status: string }> = [];
    // Initial status: created date → first status (from first changelog entry's fromStatus, or current status)
    const firstChange = (issue.changelog ?? []).find(c => c.field === 'status');
    const initialStatus = firstChange?.fromStatus || issue.status;
    transitions.push({ date: issue.created.slice(0, 10), status: initialStatus });

    for (const change of (issue.changelog ?? []).filter(c => c.field === 'status')) {
      transitions.push({ date: change.changedAt.slice(0, 10), status: change.toStatus });
    }

    issueTimelines.push({ key: issue.key, transitions });
  }

  // Collect all unique statuses
  const allStatuses = new Set<string>();
  for (const tl of issueTimelines) {
    for (const t of tl.transitions) allStatuses.add(t.status);
  }

  // Define status order: backlog → active → passive → done
  const statusOrder = (s: string): number => {
    if (statusIn(s, DONE_STATUSES)) return 3;
    if (statusIn(s, PASSIVE_STATUSES)) return 2;
    if (statusIn(s, ACTIVE_STATUSES)) return 1;
    return 0; // backlog
  };
  const orderedStatuses = Array.from(allStatuses).sort((a, b) => statusOrder(a) - statusOrder(b));

  // Generate data points for each day
  const dataPoints: CFDDataPoint[] = [];
  const currentDate = new Date(minDate);
  const endDate = new Date(maxDate);
  endDate.setDate(endDate.getDate() + 1); // inclusive

  while (currentDate <= endDate) {
    const dateStr = currentDate.toISOString().slice(0, 10);
    const statusCounts: Record<string, number> = {};
    for (const s of orderedStatuses) statusCounts[s] = 0;

    for (const tl of issueTimelines) {
      // Find the status of this issue on this date
      let currentStatus: string | null = null;
      for (const t of tl.transitions) {
        if (t.date <= dateStr) {
          currentStatus = t.status;
        } else {
          break;
        }
      }
      if (currentStatus && statusCounts[currentStatus] !== undefined) {
        statusCounts[currentStatus]++;
      }
    }

    dataPoints.push({ date: dateStr, statuses: statusCounts });
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return { dataPoints, statuses: orderedStatuses };
}

// ---------------------------------------------------------------------------
// Scope Creep
// ---------------------------------------------------------------------------

/**
 * Calculates scope creep — issues added after the iteration/sprint started.
 *
 * Uses the startDate filter as the sprint start. Issues created after that date
 * are considered unplanned (scope creep).
 *
 * Sin story points, cada ticket nuevo resta capacidad lineal al equipo.
 */
export function calculateScopeCreep(
  issues: JiraStory[],
  filters?: FlowMetricsFilters,
): ScopeCreepData {
  const startDate = filters?.startDate;
  if (!startDate) {
    // Without a start date, we can't determine scope creep
    return {
      totalIssues: issues.length,
      plannedIssues: issues.length,
      unplannedIssues: 0,
      scopeCreepPercent: 0,
      unplannedByType: [],
    };
  }

  const planned: JiraStory[] = [];
  const unplanned: JiraStory[] = [];

  for (const issue of issues) {
    const createdDate = issue.created.slice(0, 10);
    if (createdDate <= startDate) {
      planned.push(issue);
    } else {
      unplanned.push(issue);
    }
  }

  // Group unplanned by type
  const typeCount = new Map<string, number>();
  for (const issue of unplanned) {
    typeCount.set(issue.issueType, (typeCount.get(issue.issueType) ?? 0) + 1);
  }
  const unplannedByType = Array.from(typeCount.entries())
    .map(([issueType, count]) => ({ issueType, count }))
    .sort((a, b) => b.count - a.count);

  const total = issues.length;
  return {
    totalIssues: total,
    plannedIssues: planned.length,
    unplannedIssues: unplanned.length,
    scopeCreepPercent: total > 0 ? (unplanned.length / total) * 100 : 0,
    unplannedByType,
  };
}
