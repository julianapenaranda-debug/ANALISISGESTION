/**
 * Metrics Models - Factory Functions and Helpers
 * 
 * Este módulo proporciona funciones factory y utilidades para trabajar con modelos de métricas
 * de proyectos. Trabaja con los tipos compartidos de @po-ai/shared y soporta análisis de proyectos.
 * 
 * Requerimientos: 7.1-7.6
 */

import {
  ProjectMetrics,
  VelocityData,
  SprintVelocity,
  CycleTimeData,
  StatusDistribution,
  BlockedIssue,
  Bottleneck,
} from '@po-ai/shared';

// ============================================================================
// ProjectMetrics Factory Functions
// ============================================================================

/**
 * Crea un objeto ProjectMetrics completo
 */
export function createProjectMetrics(params: {
  velocity: VelocityData;
  cycleTime: CycleTimeData;
  distribution: StatusDistribution;
  blockedIssues?: BlockedIssue[];
  bottlenecks?: Bottleneck[];
}): ProjectMetrics {
  return {
    velocity: params.velocity,
    cycleTime: params.cycleTime,
    distribution: params.distribution,
    blockedIssues: params.blockedIssues || [],
    bottlenecks: params.bottlenecks || [],
  };
}

/**
 * Crea un objeto ProjectMetrics vacío con valores por defecto
 */
export function createEmptyProjectMetrics(): ProjectMetrics {
  return {
    velocity: createEmptyVelocityData(),
    cycleTime: createEmptyCycleTimeData(),
    distribution: createEmptyStatusDistribution(),
    blockedIssues: [],
    bottlenecks: [],
  };
}

// ============================================================================
// VelocityData Factory Functions
// ============================================================================

/**
 * Crea datos de velocidad del equipo
 */
export function createVelocityData(params: {
  averageStoryPoints: number;
  sprintVelocities: SprintVelocity[];
  trend?: 'increasing' | 'stable' | 'decreasing';
}): VelocityData {
  return {
    averageStoryPoints: params.averageStoryPoints,
    sprintVelocities: params.sprintVelocities,
    trend: params.trend || calculateTrend(params.sprintVelocities),
  };
}

/**
 * Crea datos de velocidad vacíos
 */
export function createEmptyVelocityData(): VelocityData {
  return {
    averageStoryPoints: 0,
    sprintVelocities: [],
    trend: 'stable',
  };
}

/**
 * Crea un SprintVelocity individual
 */
export function createSprintVelocity(params: {
  sprintId: string;
  sprintName: string;
  storyPoints: number;
  completedIssues: number;
  startDate: Date;
  endDate: Date;
}): SprintVelocity {
  return {
    sprintId: params.sprintId,
    sprintName: params.sprintName,
    storyPoints: params.storyPoints,
    completedIssues: params.completedIssues,
    startDate: params.startDate,
    endDate: params.endDate,
  };
}

// ============================================================================
// CycleTimeData Factory Functions
// ============================================================================

/**
 * Crea datos de cycle time
 */
export function createCycleTimeData(params: {
  averageDays: number;
  median: number;
  percentile90: number;
}): CycleTimeData {
  return {
    averageDays: params.averageDays,
    median: params.median,
    percentile90: params.percentile90,
  };
}

/**
 * Crea datos de cycle time vacíos
 */
export function createEmptyCycleTimeData(): CycleTimeData {
  return {
    averageDays: 0,
    median: 0,
    percentile90: 0,
  };
}

// ============================================================================
// StatusDistribution Factory Functions
// ============================================================================

/**
 * Crea una distribución de estados
 */
export function createStatusDistribution(params: {
  todo: number;
  inProgress: number;
  done: number;
  blocked: number;
}): StatusDistribution {
  return {
    todo: params.todo,
    inProgress: params.inProgress,
    done: params.done,
    blocked: params.blocked,
  };
}

/**
 * Crea una distribución de estados vacía
 */
export function createEmptyStatusDistribution(): StatusDistribution {
  return {
    todo: 0,
    inProgress: 0,
    done: 0,
    blocked: 0,
  };
}

// ============================================================================
// BlockedIssue Factory Functions
// ============================================================================

/**
 * Crea un issue bloqueado
 */
export function createBlockedIssue(params: {
  issueKey: string;
  summary: string;
  blockedSince: Date;
  blocker?: string;
  reason?: string;
}): BlockedIssue {
  const blockedDays = calculateDaysSince(params.blockedSince);
  
  return {
    issueKey: params.issueKey,
    summary: params.summary,
    blockedSince: params.blockedSince,
    blockedDays,
    blocker: params.blocker,
    reason: params.reason,
  };
}

// ============================================================================
// Bottleneck Factory Functions
// ============================================================================

/**
 * Crea un cuello de botella
 */
export function createBottleneck(params: {
  type: 'dependency' | 'resource' | 'blocker';
  affectedIssues: string[];
  description: string;
  severity?: 'high' | 'medium' | 'low';
}): Bottleneck {
  return {
    type: params.type,
    affectedIssues: params.affectedIssues,
    description: params.description,
    severity: params.severity || calculateBottleneckSeverity(params.affectedIssues.length),
  };
}

// ============================================================================
// Helper Functions - Velocity Calculations
// ============================================================================

/**
 * Calcula el promedio de story points desde un array de sprints
 */
export function calculateAverageStoryPoints(sprints: SprintVelocity[]): number {
  if (sprints.length === 0) return 0;
  
  const total = sprints.reduce((sum, sprint) => sum + sprint.storyPoints, 0);
  return Math.round((total / sprints.length) * 100) / 100;
}

/**
 * Calcula la tendencia de velocidad basada en los últimos sprints
 */
export function calculateTrend(
  sprints: SprintVelocity[]
): 'increasing' | 'stable' | 'decreasing' {
  if (sprints.length < 2) return 'stable';
  
  // Comparar últimos 3 sprints con los 3 anteriores
  const recentCount = Math.min(3, Math.floor(sprints.length / 2));
  const recent = sprints.slice(-recentCount);
  const previous = sprints.slice(-recentCount * 2, -recentCount);
  
  if (previous.length === 0) return 'stable';
  
  const recentAvg = calculateAverageStoryPoints(recent);
  const previousAvg = calculateAverageStoryPoints(previous);
  
  const threshold = 0.1; // 10% threshold
  const change = (recentAvg - previousAvg) / previousAvg;
  
  if (change > threshold) return 'increasing';
  if (change < -threshold) return 'decreasing';
  return 'stable';
}

/**
 * Filtra sprints por rango de fechas
 */
export function filterSprintsByDateRange(
  sprints: SprintVelocity[],
  startDate: Date,
  endDate: Date
): SprintVelocity[] {
  return sprints.filter(
    (sprint) =>
      sprint.startDate >= startDate && sprint.endDate <= endDate
  );
}

/**
 * Obtiene los últimos N sprints
 */
export function getLastNSprints(
  sprints: SprintVelocity[],
  count: number
): SprintVelocity[] {
  return sprints.slice(-count);
}

// ============================================================================
// Helper Functions - Cycle Time Calculations
// ============================================================================

/**
 * Calcula cycle time desde un array de duraciones en días
 */
export function calculateCycleTimeFromDurations(durations: number[]): CycleTimeData {
  if (durations.length === 0) {
    return createEmptyCycleTimeData();
  }
  
  const sorted = [...durations].sort((a, b) => a - b);
  const average = durations.reduce((sum, d) => sum + d, 0) / durations.length;
  const median = calculateMedian(sorted);
  const percentile90 = calculatePercentile(sorted, 90);
  
  return {
    averageDays: Math.round(average * 100) / 100,
    median: Math.round(median * 100) / 100,
    percentile90: Math.round(percentile90 * 100) / 100,
  };
}

/**
 * Calcula la mediana de un array ordenado
 */
export function calculateMedian(sortedValues: number[]): number {
  if (sortedValues.length === 0) return 0;
  
  const mid = Math.floor(sortedValues.length / 2);
  
  if (sortedValues.length % 2 === 0) {
    return (sortedValues[mid - 1] + sortedValues[mid]) / 2;
  }
  
  return sortedValues[mid];
}

/**
 * Calcula un percentil de un array ordenado
 */
export function calculatePercentile(sortedValues: number[], percentile: number): number {
  if (sortedValues.length === 0) return 0;
  if (percentile < 0 || percentile > 100) {
    throw new Error('Percentile must be between 0 and 100');
  }
  
  const index = (percentile / 100) * (sortedValues.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;
  
  if (lower === upper) {
    return sortedValues[lower];
  }
  
  return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
}

/**
 * Calcula la duración en días entre dos fechas
 */
export function calculateDaysBetween(startDate: Date, endDate: Date): number {
  const diffMs = endDate.getTime() - startDate.getTime();
  return Math.round((diffMs / (1000 * 60 * 60 * 24)) * 100) / 100;
}

// ============================================================================
// Helper Functions - Status Distribution
// ============================================================================

/**
 * Calcula el total de issues en una distribución
 */
export function getTotalIssues(distribution: StatusDistribution): number {
  return (
    distribution.todo +
    distribution.inProgress +
    distribution.done +
    distribution.blocked
  );
}

/**
 * Calcula el porcentaje de cada estado
 */
export function calculateStatusPercentages(distribution: StatusDistribution): {
  todo: number;
  inProgress: number;
  done: number;
  blocked: number;
} {
  const total = getTotalIssues(distribution);
  
  if (total === 0) {
    return { todo: 0, inProgress: 0, done: 0, blocked: 0 };
  }
  
  return {
    todo: Math.round((distribution.todo / total) * 10000) / 100,
    inProgress: Math.round((distribution.inProgress / total) * 10000) / 100,
    done: Math.round((distribution.done / total) * 10000) / 100,
    blocked: Math.round((distribution.blocked / total) * 10000) / 100,
  };
}

/**
 * Combina múltiples distribuciones de estado
 */
export function mergeStatusDistributions(
  distributions: StatusDistribution[]
): StatusDistribution {
  return distributions.reduce(
    (merged, dist) => ({
      todo: merged.todo + dist.todo,
      inProgress: merged.inProgress + dist.inProgress,
      done: merged.done + dist.done,
      blocked: merged.blocked + dist.blocked,
    }),
    createEmptyStatusDistribution()
  );
}

// ============================================================================
// Helper Functions - Blocked Issues
// ============================================================================

/**
 * Calcula días desde una fecha hasta ahora
 */
export function calculateDaysSince(date: Date): number {
  return calculateDaysBetween(date, new Date());
}

/**
 * Filtra issues bloqueados por severidad (días bloqueados)
 */
export function filterBlockedIssuesBySeverity(
  issues: BlockedIssue[],
  minDays: number
): BlockedIssue[] {
  return issues.filter((issue) => issue.blockedDays >= minDays);
}

/**
 * Ordena issues bloqueados por días bloqueados (descendente)
 */
export function sortBlockedIssuesByDays(issues: BlockedIssue[]): BlockedIssue[] {
  return [...issues].sort((a, b) => b.blockedDays - a.blockedDays);
}

/**
 * Agrupa issues bloqueados por blocker
 */
export function groupBlockedIssuesByBlocker(
  issues: BlockedIssue[]
): Map<string, BlockedIssue[]> {
  const grouped = new Map<string, BlockedIssue[]>();
  
  for (const issue of issues) {
    const blocker = issue.blocker || 'Unknown';
    const existing = grouped.get(blocker) || [];
    grouped.set(blocker, [...existing, issue]);
  }
  
  return grouped;
}

// ============================================================================
// Helper Functions - Bottlenecks
// ============================================================================

/**
 * Calcula la severidad de un bottleneck basado en el número de issues afectados
 */
export function calculateBottleneckSeverity(
  affectedIssuesCount: number
): 'high' | 'medium' | 'low' {
  if (affectedIssuesCount >= 10) return 'high';
  if (affectedIssuesCount >= 5) return 'medium';
  return 'low';
}

/**
 * Filtra bottlenecks por severidad
 */
export function filterBottlenecksBySeverity(
  bottlenecks: Bottleneck[],
  severity: 'high' | 'medium' | 'low'
): Bottleneck[] {
  return bottlenecks.filter((b) => b.severity === severity);
}

/**
 * Filtra bottlenecks por tipo
 */
export function filterBottlenecksByType(
  bottlenecks: Bottleneck[],
  type: 'dependency' | 'resource' | 'blocker'
): Bottleneck[] {
  return bottlenecks.filter((b) => b.type === type);
}

/**
 * Ordena bottlenecks por severidad (high > medium > low)
 */
export function sortBottlenecksBySeverity(bottlenecks: Bottleneck[]): Bottleneck[] {
  const severityOrder = { high: 0, medium: 1, low: 2 };
  
  return [...bottlenecks].sort(
    (a, b) => severityOrder[a.severity] - severityOrder[b.severity]
  );
}

/**
 * Obtiene el total de issues afectados por bottlenecks
 */
export function getTotalAffectedIssues(bottlenecks: Bottleneck[]): number {
  const uniqueIssues = new Set<string>();
  
  for (const bottleneck of bottlenecks) {
    for (const issue of bottleneck.affectedIssues) {
      uniqueIssues.add(issue);
    }
  }
  
  return uniqueIssues.size;
}

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Valida que un ProjectMetrics sea válido
 */
export function validateProjectMetrics(metrics: ProjectMetrics): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  // Validar velocity
  if (metrics.velocity.averageStoryPoints < 0) {
    errors.push('Average story points no puede ser negativo');
  }
  
  // Validar cycle time
  if (metrics.cycleTime.averageDays < 0) {
    errors.push('Average cycle time no puede ser negativo');
  }
  
  if (metrics.cycleTime.median < 0) {
    errors.push('Median cycle time no puede ser negativo');
  }
  
  if (metrics.cycleTime.percentile90 < 0) {
    errors.push('Percentile 90 cycle time no puede ser negativo');
  }
  
  // Validar distribution
  if (metrics.distribution.todo < 0) {
    errors.push('Todo count no puede ser negativo');
  }
  
  if (metrics.distribution.inProgress < 0) {
    errors.push('In Progress count no puede ser negativo');
  }
  
  if (metrics.distribution.done < 0) {
    errors.push('Done count no puede ser negativo');
  }
  
  if (metrics.distribution.blocked < 0) {
    errors.push('Blocked count no puede ser negativo');
  }
  
  // Validar blocked issues
  for (const issue of metrics.blockedIssues) {
    if (issue.blockedDays < 0) {
      errors.push(`Blocked issue ${issue.issueKey}: blockedDays no puede ser negativo`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Valida que un VelocityData sea válido
 */
export function validateVelocityData(velocity: VelocityData): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  if (velocity.averageStoryPoints < 0) {
    errors.push('Average story points no puede ser negativo');
  }
  
  for (let i = 0; i < velocity.sprintVelocities.length; i++) {
    const sprint = velocity.sprintVelocities[i];
    
    if (sprint.storyPoints < 0) {
      errors.push(`Sprint ${sprint.sprintName}: story points no puede ser negativo`);
    }
    
    if (sprint.completedIssues < 0) {
      errors.push(`Sprint ${sprint.sprintName}: completed issues no puede ser negativo`);
    }
    
    if (sprint.startDate > sprint.endDate) {
      errors.push(`Sprint ${sprint.sprintName}: start date debe ser antes de end date`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Valida que un CycleTimeData sea válido
 */
export function validateCycleTimeData(cycleTime: CycleTimeData): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  if (cycleTime.averageDays < 0) {
    errors.push('Average days no puede ser negativo');
  }
  
  if (cycleTime.median < 0) {
    errors.push('Median no puede ser negativo');
  }
  
  if (cycleTime.percentile90 < 0) {
    errors.push('Percentile 90 no puede ser negativo');
  }
  
  // Validar relaciones lógicas
  if (cycleTime.percentile90 < cycleTime.median) {
    errors.push('Percentile 90 debe ser mayor o igual que median');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}
