/**
 * Developer Workload Domain Models
 *
 * Interfaces, tipos y constantes para el módulo Developer Workload.
 *
 * Requerimientos: 3.2, 4.4, 3.5, 8.1, 8.2, 8.3, 8.4, 8.5
 */

// ---------------------------------------------------------------------------
// Thresholds / Constants
// ---------------------------------------------------------------------------

/** Workload threshold: > 1.5x promedio del equipo → overloaded (Requirement 3.2) */
export const OVERLOADED_THRESHOLD = 1.5;

/** Workload threshold: < 0.5x promedio del equipo → underloaded (Requirement 3.2) */
export const UNDERLOADED_THRESHOLD = 0.5;

/** Productivity threshold: > 1.3x promedio del equipo → high (Requirement 4.4) */
export const HIGH_PRODUCTIVITY_THRESHOLD = 1.3;

/** Productivity threshold: < 0.7x promedio del equipo → low (Requirement 4.4) */
export const LOW_PRODUCTIVITY_THRESHOLD = 0.7;

/** Multitasking threshold: > 3 HUs en In Progress simultáneamente (Requirement 3.5) */
export const MULTITASKING_THRESHOLD = 3;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type WorkloadStatus = 'overloaded' | 'normal' | 'underloaded';

export type ProductivityStatus = 'high' | 'normal' | 'low';

// ---------------------------------------------------------------------------
// Request / Filter Models
// ---------------------------------------------------------------------------

export interface WorkloadRequest {
  projectKey: string;
  credentialKey: string;
  filters?: WorkloadFilters;
}

export interface WorkloadFilters {
  sprint?: string;      // Nombre exacto del sprint en Jira
  startDate?: string;   // ISO 8601 date string: "YYYY-MM-DD"
  endDate?: string;     // ISO 8601 date string: "YYYY-MM-DD"
}

// ---------------------------------------------------------------------------
// Report / Summary Models
// ---------------------------------------------------------------------------

export interface WorkloadReport {
  projectKey: string;
  generatedAt: string;          // ISO 8601 datetime
  filters: WorkloadFilters;
  summary: WorkloadSummary;
  developers: DeveloperMetrics[];
  alerts: WorkloadAlert[];
  hasAlerts: boolean;
}

export interface WorkloadSummary {
  totalDevelopers: number;
  totalHUs: number;
  averageStoryPointsPerDeveloper: number;
  teamVelocityAverage: number;
  teamCycleTimeAverage: number | null;
  // Advanced metrics
  teamLeadTimeAverage: number | null;     // días promedio desde creación hasta resolución
  teamThroughput: number;                 // HUs completadas en el período
  teamWIP: number;                        // HUs actualmente en progreso
  agingWIPAverage: number | null;         // días promedio que llevan las HUs en progreso
  reworkRatio: number;                    // % de HUs que volvieron de Done a In Progress
  predictabilityIndex: number | null;     // 0-1, donde 1 = velocidad muy consistente
  spDistributionEquity: number | null;    // 0-1, donde 1 = carga perfectamente distribuida
}

// ---------------------------------------------------------------------------
// Developer Metrics
// ---------------------------------------------------------------------------

export interface DeveloperMetrics {
  accountId: string;
  displayName: string;
  email?: string;
  assignedHUs: number;
  activeStoryPoints: number;        // SP de HUs no completadas
  completedHUs: number;
  completedStoryPoints: number;
  velocityIndividual: number;       // >= 0
  cycleTimeIndividual: number | null; // >= 0 o null si no hay HUs completadas
  workloadStatus: WorkloadStatus;
  productivityStatus: ProductivityStatus;
  husByStatus: HusByStatus;
  unestimatedHUs: number;
  inProgressCount: number;
  multitaskingAlert: boolean;       // true si inProgressCount > MULTITASKING_THRESHOLD
  // Advanced metrics
  leadTimeIndividual: number | null;      // días promedio creación → resolución
  throughputIndividual: number;           // HUs completadas
  wipCount: number;                       // HUs en progreso ahora
  agingWIPDays: number | null;            // días promedio de HUs en progreso
  reworkCount: number;                    // HUs que volvieron de Done a In Progress
  // Issue type breakdown per developer
  issueTypeBreakdown: Array<{ type: string; total: number; inProgress: number; done: number }>;
  storiesInProgress: number;              // Only HUs/Stories in progress (for real multitasking)
}

export interface HusByStatus {
  todo: number;
  inProgress: number;
  done: number;
  blocked: number;
  other: number;
}

// ---------------------------------------------------------------------------
// Alerts
// ---------------------------------------------------------------------------

export interface WorkloadAlert {
  accountId: string;
  displayName: string;
  type: 'overloaded' | 'low_productivity' | 'multitasking';
  description: string;
  severity: 'high' | 'medium';     // high = múltiples problemas, medium = uno solo
  activeStoryPoints?: number;
  excessPercentage?: number;        // % sobre el promedio del equipo
  velocityIndividual?: number;
  velocityDifference?: number;      // diferencia respecto al promedio
}

// ---------------------------------------------------------------------------
// Jira Story Model
// ---------------------------------------------------------------------------

export interface JiraStory {
  id: string;
  key: string;
  summary: string;
  status: string;                   // "To Do", "In Progress", "Done", "Blocked", etc.
  storyPoints: number | null;       // customfield_10016
  issueType: string;                // "Historia", "Sub-tarea", "Bug", etc.
  parentKey: string | null;          // key de la HU padre (para sub-tareas)
  assignee: {
    accountId: string;
    displayName: string;
    emailAddress?: string;
  } | null;
  sprint: string | null;            // nombre del sprint activo
  created: string;                  // ISO 8601
  resolutionDate: string | null;    // ISO 8601
  updated: string;                  // ISO 8601
  changelog?: StatusChange[];       // historial de cambios de estado
}

export interface StatusChange {
  field: string;
  fromStatus: string;
  toStatus: string;
  changedAt: string;                // ISO 8601
}

// ---------------------------------------------------------------------------
// Sprint Info
// ---------------------------------------------------------------------------

export interface SprintInfo {
  id: number;
  name: string;
  state: 'active' | 'closed' | 'future';
  startDate?: string;
  endDate?: string;
}

// ---------------------------------------------------------------------------
// Team Averages (intermediario para cálculo de métricas)
// ---------------------------------------------------------------------------

export interface TeamAverages {
  averageActivePoints: number;
  averageVelocity: number;
  averageCycleTime: number | null;
}
