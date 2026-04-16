/**
 * Flow Metrics Domain Models
 *
 * Interfaces, tipos y constantes para el módulo Flow Metrics.
 * Basado en Lean Agile Flow Analytics.
 *
 * Reutiliza JiraStory y StatusChange de workload-models.ts.
 */

import type { JiraStory, StatusChange } from './workload-models';

// Re-export for convenience
export type { JiraStory, StatusChange };

// ---------------------------------------------------------------------------
// Status Classification Constants
// ---------------------------------------------------------------------------

export const ACTIVE_STATUSES = [
  'In Progress', 'En Progreso', 'En progreso', 'EN PROGRESO',
  'En Pruebas UAT', 'EN PRUEBAS UAT',
];

export const PASSIVE_STATUSES = [
  'Blocked', 'Bloqueado', 'BLOQUEADO',
  'Pendiente PAP', 'PENDIENTE PAP',
  'En Revisión', 'EN REVISIÓN', 'Waiting for Review',
];

export const DONE_STATUSES = [
  'Done', 'Producción', 'PRODUCCIÓN', 'Hecho', 'HECHO',
  'Cerrado', 'Resuelto', 'Closed', 'Resolved',
];

// ---------------------------------------------------------------------------
// Work Type Classification Constants
// ---------------------------------------------------------------------------

export const VALUE_WORK_TYPES = [
  'Historia', 'Story', 'Spike', 'Upstream', 'Epic',
  'Iniciativa', 'Requerimiento Caja',
];

export const SUPPORT_WORK_TYPES = [
  'Service Request N2', 'Bug', 'Error Productivo',
  'PQR', 'Incidente de Seguridad y Monitoreo',
];

// ---------------------------------------------------------------------------
// Request / Filter Models
// ---------------------------------------------------------------------------

export interface FlowMetricsRequest {
  projectKey: string;
  credentialKey: string;
  filters?: FlowMetricsFilters;
}

export interface FlowMetricsFilters {
  sprint?: string;
  startDate?: string;   // ISO 8601 date: "YYYY-MM-DD"
  endDate?: string;     // ISO 8601 date: "YYYY-MM-DD"
}

// ---------------------------------------------------------------------------
// Report / Summary Models
// ---------------------------------------------------------------------------

export interface FlowMetricsReport {
  projectKey: string;
  generatedAt: string;                    // ISO 8601
  filters: FlowMetricsFilters;
  summary: FlowMetricsSummary;
  throughputByType: ThroughputByType[];
  wipByDeveloper: DeveloperWIP[];
  typology: TypologyBreakdown;
  bottlenecks: Bottleneck[];
  agingIssues: AgingIssue[];
  recommendations: FlowRecommendation[];
  cognitiveLoad?: CognitiveLoadSummary;
  cfd?: CFDData;
  scopeCreep?: ScopeCreepData;
}

export interface FlowMetricsSummary {
  leadTimeAverage: number | null;         // días, 1 decimal
  cycleTimeAverage: number | null;        // días, 1 decimal
  throughputTotal: number;                // issues completados
  wipTotal: number;                       // issues en progreso
  flowEfficiencyAverage: number | null;   // porcentaje, 1 decimal
}

// ---------------------------------------------------------------------------
// Throughput & WIP Models
// ---------------------------------------------------------------------------

export interface ThroughputByType {
  issueType: string;
  count: number;
}

export interface DeveloperWIP {
  accountId: string;
  displayName: string;
  wipCount: number;
}

// ---------------------------------------------------------------------------
// Typology Model
// ---------------------------------------------------------------------------

export interface TypologyBreakdown {
  valueWorkCount: number;
  supportWorkCount: number;
  valueWorkPercent: number;               // 0-100
  supportWorkPercent: number;             // 0-100
}

// ---------------------------------------------------------------------------
// Bottleneck & Aging Models
// ---------------------------------------------------------------------------

export interface Bottleneck {
  status: string;
  percentageOfCycleTime: number;          // 0-100
  message: string;                        // Mensaje descriptivo en español
}

export interface AgingIssue {
  issueKey: string;
  summary: string;
  currentStatus: string;
  daysInStatus: number;
  averageDaysForStatus: number;
}

// ---------------------------------------------------------------------------
// Recommendation Model
// ---------------------------------------------------------------------------

export interface FlowRecommendation {
  type: 'support_work_high' | 'wait_time_high' | 'wip_high' | 'cognitive_overload' | 'context_switching' | 'oversized_hu';
  message: string;                        // Texto descriptivo en español
}

// ---------------------------------------------------------------------------
// Cognitive Load & Focus Analysis (TOC / Ley de Little)
// ---------------------------------------------------------------------------

/** Backlog statuses — expectativa, no consume capacidad cognitiva */
export const BACKLOG_STATUSES = [
  'To Do', 'Backlog', 'Selected for Development',
  'Por Hacer', 'POR HACER', 'Abierto', 'Open',
  'Pendiente', 'PENDIENTE',
];

/** HU types (parent stories, not sub-tasks) */
export const HU_TYPES = [
  'Historia', 'Story', 'Iniciativa', 'Spike', 'Upstream',
  'Requerimiento Caja', 'Epic',
];

export const SUBTASK_TYPES = ['Sub-tarea', 'Sub-task', 'Subtask'];

export type CognitiveAlertLevel = 'green' | 'yellow' | 'red';

export interface DeveloperCognitiveLoad {
  accountId: string;
  displayName: string;
  activeSubtasks: number;           // sub-tareas en estados activos
  activeHUs: number;                // HUs distintas a las que pertenecen las sub-tareas activas
  focusFactor: number;              // activeSubtasks / activeHUs (1.0 = enfocado)
  alertLevel: CognitiveAlertLevel;  // verde/amarillo/rojo
  alertMessage: string;             // mensaje descriptivo en español
  oversizedHUs: string[];           // keys de HUs con >8 sub-tareas
}

export interface CognitiveLoadSummary {
  developers: DeveloperCognitiveLoad[];
  oversizedHUs: Array<{ key: string; summary: string; subtaskCount: number }>;
  teamFocusScore: number;           // % de devs en verde
}

// ---------------------------------------------------------------------------
// Cumulative Flow Diagram (CFD)
// ---------------------------------------------------------------------------

export interface CFDDataPoint {
  date: string;                     // "YYYY-MM-DD"
  statuses: Record<string, number>; // status name → count of issues in that status on that date
}

export interface CFDData {
  dataPoints: CFDDataPoint[];
  statuses: string[];               // ordered list of status names (for stacking)
}

// ---------------------------------------------------------------------------
// Scope Creep
// ---------------------------------------------------------------------------

export interface ScopeCreepData {
  totalIssues: number;              // total issues in the period
  plannedIssues: number;            // created before or on the start date
  unplannedIssues: number;          // created after the start date
  scopeCreepPercent: number;        // unplanned / total * 100
  unplannedByType: Array<{ issueType: string; count: number }>;
}
