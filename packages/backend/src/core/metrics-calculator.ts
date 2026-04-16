/**
 * Metrics Calculator
 *
 * Pure functions for calculating developer workload and productivity metrics.
 * No side effects — all functions receive data and return computed results.
 *
 * Requerimientos: 1.2, 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3, 4.4, 4.5, 5.1, 5.2, 5.4, 8.3
 */

import {
  JiraStory,
  DeveloperMetrics,
  TeamAverages,
  WorkloadAlert,
  WorkloadSummary,
  HusByStatus,
  OVERLOADED_THRESHOLD,
  UNDERLOADED_THRESHOLD,
  HIGH_PRODUCTIVITY_THRESHOLD,
  LOW_PRODUCTIVITY_THRESHOLD,
  MULTITASKING_THRESHOLD,
} from './workload-models';

// ---------------------------------------------------------------------------
// Status mapping helpers
// ---------------------------------------------------------------------------

const DONE_STATUSES = new Set([
  'Done', 'Closed', 'Resolved',
  'PRODUCCIÓN', 'Producción', 'HECHO', 'Hecho', 'Cerrado', 'Resuelto',
]);
const IN_PROGRESS_STATUSES = new Set([
  'In Progress', 'In Review',
  'EN PROGRESO', 'En Progreso', 'En progreso', 'EN PRUEBAS UAT', 'En Pruebas UAT',
  'PENDIENTE PAP', 'Pendiente PAP', 'EN REVISIÓN', 'En Revisión',
]);
const TODO_STATUSES = new Set([
  'To Do', 'Backlog',
  'POR HACER', 'Por Hacer', 'Por hacer', 'PENDIENTE', 'Pendiente',
  'ABIERTO', 'Abierto', 'Open',
]);
const BLOCKED_STATUSES = new Set([
  'Blocked',
  'BLOQUEADO', 'Bloqueado',
]);

function isDone(status: string): boolean {
  return DONE_STATUSES.has(status);
}

function isActive(status: string): boolean {
  return IN_PROGRESS_STATUSES.has(status) || BLOCKED_STATUSES.has(status);
}

function mapStatusBucket(status: string): keyof HusByStatus {
  if (TODO_STATUSES.has(status)) return 'todo';
  if (IN_PROGRESS_STATUSES.has(status)) return 'inProgress';
  if (DONE_STATUSES.has(status)) return 'done';
  if (BLOCKED_STATUSES.has(status)) return 'blocked';
  return 'other';
}

// ---------------------------------------------------------------------------
// Cycle time calculation
// ---------------------------------------------------------------------------

/**
 * Calculates cycle time in days for a single completed story.
 * Returns null if the story has no changelog or no "In Progress" → "Done" transition.
 */
function calcCycleTime(story: JiraStory): number | null {
  if (!story.changelog || story.changelog.length === 0) return null;

  // Find first transition TO "In Progress"
  const inProgressEntry = story.changelog.find(
    c => c.field === 'status' && IN_PROGRESS_STATUSES.has(c.toStatus)
  );
  if (!inProgressEntry) return null;

  // Find first transition TO a done status after the in-progress entry
  const inProgressTime = new Date(inProgressEntry.changedAt).getTime();
  const doneEntry = story.changelog.find(
    c =>
      c.field === 'status' &&
      DONE_STATUSES.has(c.toStatus) &&
      new Date(c.changedAt).getTime() >= inProgressTime
  );
  if (!doneEntry) return null;

  const doneTime = new Date(doneEntry.changedAt).getTime();
  const days = (doneTime - inProgressTime) / (1000 * 60 * 60 * 24);
  return Math.max(0, days);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Groups stories by assignee.accountId.
 * Stories with null assignee are skipped.
 */
export function groupStoriesByAssignee(stories: JiraStory[]): Map<string, JiraStory[]> {
  const map = new Map<string, JiraStory[]>();

  for (const story of stories) {
    if (!story.assignee) continue;
    const id = story.assignee.accountId;
    const group = map.get(id);
    if (group) {
      group.push(story);
    } else {
      map.set(id, [story]);
    }
  }

  return map;
}

/**
 * Calculates team-level averages across all stories and developers.
 */
export function calculateTeamAverages(
  allStories: JiraStory[],
  developerCount: number
): TeamAverages {
  if (developerCount === 0) {
    return { averageActivePoints: 0, averageVelocity: 0, averageCycleTime: null };
  }

  const activeCount = allStories.filter(s => isActive(s.status)).length;
  const doneStories = allStories.filter(s => isDone(s.status));
  const completedCount = doneStories.length;

  const cycleTimes = doneStories
    .map(calcCycleTime)
    .filter((ct): ct is number => ct !== null);

  const averageCycleTime =
    cycleTimes.length > 0
      ? cycleTimes.reduce((a, b) => a + b, 0) / cycleTimes.length
      : null;

  return {
    averageActivePoints: activeCount / developerCount,
    averageVelocity: completedCount / developerCount,
    averageCycleTime,
  };
}

/**
 * Calculates all metrics for a single developer.
 */
export function calculateDeveloperMetrics(
  accountId: string,
  stories: JiraStory[],
  teamAverages: TeamAverages
): DeveloperMetrics {
  // Status distribution
  const husByStatus: HusByStatus = { todo: 0, inProgress: 0, done: 0, blocked: 0, other: 0 };
  for (const story of stories) {
    husByStatus[mapStatusBucket(story.status)]++;
  }

  const inProgressCount = husByStatus.inProgress;

  // Issue type breakdown per developer
  const typeMap = new Map<string, { total: number; inProgress: number; done: number }>();
  const STORY_TYPES = ['historia', 'story', 'iniciativa', 'requerimiento caja', 'spike', 'upstream'];
  let storiesInProgress = 0;

  for (const story of stories) {
    const typeName = story.issueType || 'Desconocido';
    const entry = typeMap.get(typeName) || { total: 0, inProgress: 0, done: 0 };
    entry.total++;
    const bucket = mapStatusBucket(story.status);
    if (bucket === 'inProgress') {
      entry.inProgress++;
      // Count only real stories/HUs for multitasking (not sub-tasks)
      if (STORY_TYPES.some(st => typeName.toLowerCase().includes(st))) {
        storiesInProgress++;
      }
    }
    if (bucket === 'done') entry.done++;
    typeMap.set(typeName, entry);
  }

  const issueTypeBreakdown = Array.from(typeMap.entries())
    .map(([type, data]) => ({ type, ...data }))
    .sort((a, b) => b.total - a.total);

  // Multitasking: only alert if >2 real HUs/Stories in progress (not sub-tasks)
  const multitaskingAlert = storiesInProgress > 2;

  // Story points
  const activeStories = stories.filter(s => isActive(s.status));
  const doneStories = stories.filter(s => isDone(s.status));

  const activeStoryPoints = activeStories.reduce((sum, s) => sum + (s.storyPoints ?? 0), 0);
  const completedStoryPoints = doneStories.reduce((sum, s) => sum + (s.storyPoints ?? 0), 0);
  const unestimatedHUs = stories.filter(s => s.storyPoints === null).length;

  // Velocity = throughput (issues completed, not SP)
  const velocityIndividual = doneStories.length;

  // Cycle time: average days from first "In Progress" to "Done" for completed stories
  const cycleTimes = doneStories
    .map(calcCycleTime)
    .filter((ct): ct is number => ct !== null);

  const cycleTimeIndividual =
    cycleTimes.length > 0
      ? cycleTimes.reduce((a, b) => a + b, 0) / cycleTimes.length
      : null;

  // Workload status — based on active issue count vs team average
  const avgActive = teamAverages.averageActivePoints;
  let workloadStatus: DeveloperMetrics['workloadStatus'];
  if (avgActive === 0) {
    workloadStatus = activeStories.length > 0 ? 'overloaded' : 'normal';
  } else if (activeStories.length > avgActive * OVERLOADED_THRESHOLD) {
    workloadStatus = 'overloaded';
  } else if (activeStories.length < avgActive * UNDERLOADED_THRESHOLD) {
    workloadStatus = 'underloaded';
  } else {
    workloadStatus = 'normal';
  }

  // Productivity status — based on throughput (issues completed) vs team average
  const avgVelocity = teamAverages.averageVelocity;
  let productivityStatus: DeveloperMetrics['productivityStatus'];
  if (avgVelocity === 0) {
    productivityStatus = doneStories.length > 0 ? 'high' : 'normal';
  } else if (velocityIndividual > avgVelocity * HIGH_PRODUCTIVITY_THRESHOLD) {
    productivityStatus = 'high';
  } else if (velocityIndividual < avgVelocity * LOW_PRODUCTIVITY_THRESHOLD) {
    productivityStatus = 'low';
  } else {
    productivityStatus = 'normal';
  }

  // Display info from first story's assignee
  const firstAssignee = stories.find(s => s.assignee)?.assignee;
  const displayName = firstAssignee?.displayName ?? accountId;
  const email = firstAssignee?.emailAddress;

  return {
    accountId,
    displayName,
    email,
    assignedHUs: stories.length,
    activeStoryPoints,
    completedHUs: husByStatus.done,
    completedStoryPoints,
    velocityIndividual,
    cycleTimeIndividual,
    workloadStatus,
    productivityStatus,
    husByStatus,
    unestimatedHUs,
    inProgressCount,
    multitaskingAlert,
    // Advanced metrics
    leadTimeIndividual: calcAverageLeadTime(doneStories),
    throughputIndividual: husByStatus.done,
    wipCount: inProgressCount,
    agingWIPDays: calcAgingWIP(stories),
    reworkCount: calcReworkCount(stories),
    issueTypeBreakdown,
    storiesInProgress,
  };
}

/**
 * Builds the list of alerts from all developer metrics.
 * Severity "high" = developer has 2+ problems; "medium" = 1 problem.
 * Sorted: high severity first, then medium.
 */
export function buildAlerts(developers: DeveloperMetrics[]): WorkloadAlert[] {
  const alerts: WorkloadAlert[] = [];

  for (const dev of developers) {
    const isOverloaded = dev.workloadStatus === 'overloaded';
    const isLowProductivity = dev.productivityStatus === 'low';
    const isMultitasking = dev.multitaskingAlert;

    const problemCount = [isOverloaded, isLowProductivity, isMultitasking].filter(Boolean).length;
    if (problemCount === 0) continue;

    const severity: WorkloadAlert['severity'] = problemCount >= 2 ? 'high' : 'medium';

    if (isOverloaded) {
      alerts.push({
        accountId: dev.accountId,
        displayName: dev.displayName,
        type: 'overloaded',
        description: `${dev.displayName} tiene ${dev.assignedHUs} issues activas, superando el promedio del equipo.`,
        severity,
        activeStoryPoints: dev.activeStoryPoints,
      });
    }

    if (isLowProductivity) {
      alerts.push({
        accountId: dev.accountId,
        displayName: dev.displayName,
        type: 'low_productivity',
        description: `${dev.displayName} tiene baja productividad con ${dev.velocityIndividual} issues completadas (promedio del equipo más alto).`,
        severity,
        velocityIndividual: dev.velocityIndividual,
      });
    }

    if (isMultitasking) {
      alerts.push({
        accountId: dev.accountId,
        displayName: dev.displayName,
        type: 'multitasking',
        description: `${dev.displayName} tiene ${dev.storiesInProgress} HUs en progreso simultáneamente (sin contar sub-tareas).`,
        severity,
      });
    }
  }

  // Sort: high severity first
  alerts.sort((a, b) => {
    if (a.severity === b.severity) return 0;
    return a.severity === 'high' ? -1 : 1;
  });

  return alerts;
}

/**
 * Calculates the summary section of the workload report.
 */
export function calculateSummary(
  developers: DeveloperMetrics[],
  allStories: JiraStory[]
): WorkloadSummary {
  const totalDevelopers = developers.length;
  const totalHUs = allStories.length;

  const totalActivePoints = developers.reduce((sum, d) => sum + d.activeStoryPoints, 0);
  const averageStoryPointsPerDeveloper =
    totalDevelopers > 0 ? totalActivePoints / totalDevelopers : 0;

  const totalVelocity = developers.reduce((sum, d) => sum + d.velocityIndividual, 0);
  const teamVelocityAverage = totalDevelopers > 0 ? totalVelocity / totalDevelopers : 0;

  const cycleTimes = developers
    .map(d => d.cycleTimeIndividual)
    .filter((ct): ct is number => ct !== null);

  const teamCycleTimeAverage =
    cycleTimes.length > 0
      ? cycleTimes.reduce((a, b) => a + b, 0) / cycleTimes.length
      : null;

  // Advanced team metrics
  const leadTimes = developers.map(d => d.leadTimeIndividual).filter((lt): lt is number => lt !== null);
  const teamLeadTimeAverage = leadTimes.length > 0 ? leadTimes.reduce((a, b) => a + b, 0) / leadTimes.length : null;

  const teamThroughput = developers.reduce((sum, d) => sum + d.throughputIndividual, 0);
  const teamWIP = developers.reduce((sum, d) => sum + d.wipCount, 0);

  const agingValues = developers.map(d => d.agingWIPDays).filter((a): a is number => a !== null);
  const agingWIPAverage = agingValues.length > 0 ? agingValues.reduce((a, b) => a + b, 0) / agingValues.length : null;

  const totalRework = developers.reduce((sum, d) => sum + d.reworkCount, 0);
  const reworkRatio = teamThroughput > 0 ? totalRework / teamThroughput : 0;

  // Predictability: 1 - coefficient of variation of individual velocities
  const velocities = developers.map(d => d.velocityIndividual).filter(v => v > 0);
  let predictabilityIndex: number | null = null;
  if (velocities.length >= 2) {
    const mean = velocities.reduce((a, b) => a + b, 0) / velocities.length;
    const variance = velocities.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / velocities.length;
    const cv = mean > 0 ? Math.sqrt(variance) / mean : 0;
    predictabilityIndex = Math.max(0, Math.min(1, 1 - cv));
  }

  // SP distribution equity: 1 - Gini coefficient of active SP per dev
  const spValues = developers.map(d => d.activeStoryPoints).sort((a, b) => a - b);
  let spDistributionEquity: number | null = null;
  if (spValues.length >= 2) {
    const n = spValues.length;
    const totalSP = spValues.reduce((a, b) => a + b, 0);
    if (totalSP > 0) {
      let giniSum = 0;
      for (let i = 0; i < n; i++) {
        giniSum += (2 * (i + 1) - n - 1) * spValues[i];
      }
      const gini = giniSum / (n * totalSP);
      spDistributionEquity = Math.max(0, Math.min(1, 1 - gini));
    }
  }

  return {
    totalDevelopers,
    totalHUs,
    averageStoryPointsPerDeveloper,
    teamVelocityAverage,
    teamCycleTimeAverage,
    teamLeadTimeAverage,
    teamThroughput,
    teamWIP,
    agingWIPAverage,
    reworkRatio,
    predictabilityIndex,
    spDistributionEquity,
  };
}

// ---------------------------------------------------------------------------
// Advanced metric helpers
// ---------------------------------------------------------------------------

/**
 * Lead Time: days from creation to resolution for completed stories.
 */
function calcAverageLeadTime(doneStories: JiraStory[]): number | null {
  const leadTimes: number[] = [];
  for (const story of doneStories) {
    if (story.resolutionDate) {
      const created = new Date(story.created).getTime();
      const resolved = new Date(story.resolutionDate).getTime();
      const days = (resolved - created) / (1000 * 60 * 60 * 24);
      if (days >= 0) leadTimes.push(days);
    }
  }
  return leadTimes.length > 0 ? leadTimes.reduce((a, b) => a + b, 0) / leadTimes.length : null;
}

/**
 * Aging WIP: average days that in-progress stories have been open.
 */
function calcAgingWIP(stories: JiraStory[]): number | null {
  const now = Date.now();
  const inProgress = stories.filter(s => IN_PROGRESS_STATUSES.has(s.status));
  if (inProgress.length === 0) return null;

  const ages = inProgress.map(s => {
    // Find when it entered In Progress from changelog
    const entry = s.changelog?.find(c => c.field === 'status' && IN_PROGRESS_STATUSES.has(c.toStatus));
    const startTime = entry ? new Date(entry.changedAt).getTime() : new Date(s.created).getTime();
    return (now - startTime) / (1000 * 60 * 60 * 24);
  });

  return ages.reduce((a, b) => a + b, 0) / ages.length;
}

/**
 * Rework: count stories that transitioned from Done back to In Progress.
 */
function calcReworkCount(stories: JiraStory[]): number {
  let count = 0;
  for (const story of stories) {
    if (!story.changelog) continue;
    const hasRework = story.changelog.some(
      c => c.field === 'status' && DONE_STATUSES.has(c.fromStatus) && IN_PROGRESS_STATUSES.has(c.toStatus)
    );
    if (hasRework) count++;
  }
  return count;
}
