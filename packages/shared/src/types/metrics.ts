// Tipos para análisis de métricas de proyectos

/**
 * ProjectMetrics contiene todas las métricas de un proyecto
 */
export interface ProjectMetrics {
  velocity: VelocityData;
  cycleTime: CycleTimeData;
  distribution: StatusDistribution;
  blockedIssues: BlockedIssue[];
  bottlenecks: Bottleneck[];
}

/**
 * VelocityData datos de velocidad del equipo
 */
export interface VelocityData {
  averageStoryPoints: number;
  sprintVelocities: SprintVelocity[];
  trend: 'increasing' | 'stable' | 'decreasing';
}

/**
 * SprintVelocity velocidad de un sprint específico
 */
export interface SprintVelocity {
  sprintId: string;
  sprintName: string;
  storyPoints: number;
  completedIssues: number;
  startDate: Date;
  endDate: Date;
}

/**
 * CycleTimeData datos de tiempo de ciclo
 */
export interface CycleTimeData {
  averageDays: number;
  median: number;
  percentile90: number;
}

/**
 * StatusDistribution distribución de estados de issues
 */
export interface StatusDistribution {
  todo: number;
  inProgress: number;
  done: number;
  blocked: number;
}

/**
 * BlockedIssue representa un issue bloqueado
 */
export interface BlockedIssue {
  issueKey: string;
  summary: string;
  blockedSince: Date;
  blockedDays: number;
  blocker?: string;
  reason?: string;
}

/**
 * Bottleneck representa un cuello de botella en el proyecto
 */
export interface Bottleneck {
  type: 'dependency' | 'resource' | 'blocker';
  affectedIssues: string[];
  description: string;
  severity: 'high' | 'medium' | 'low';
}
