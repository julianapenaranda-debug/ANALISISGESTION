/**
 * Support Agent Domain Models
 *
 * Interfaces y tipos para el módulo Support Agent.
 *
 * Requerimientos: 1.3, 2.1, 2.5, 3.1, 3.6, 4.1, 4.4, 5.1, 6.1, 6.2, 7.1, 7.5
 */

// ---------------------------------------------------------------------------
// Jira / Bug Issue
// ---------------------------------------------------------------------------

export interface JiraComment {
  id: string;
  author: string;
  body: string;
  created: Date;
}

export interface BugIssue {
  id: string;
  key: string;           // ej: "PROJ-123"
  summary: string;
  description: string;
  priority: string;      // prioridad original de Jira
  status: string;        // "Open" | "In Progress" | "Reopened"
  reporter: string;
  assignee?: string;
  createdDate: Date;
  comments: JiraComment[];
  components: string[];
  labels: string[];
}

export interface BugFilters {
  statuses?: ('Open' | 'In Progress' | 'Reopened')[];
  severities?: Severity[];
  components?: string[];
  createdAfter?: Date;
  createdBefore?: Date;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export type BugClassification = 'valid' | 'duplicate' | 'expected_behavior' | 'needs_more_info';

export type Severity = 'Critical' | 'High' | 'Medium' | 'Low';

export interface ValidationResult {
  classification: BugClassification;
  severity: Severity;
  severityDefaulted: boolean;       // true si se asignó Medium por defecto
  justification: string;
  affectedComponents: string[];
  duplicateOfId?: string;           // presente si classification === 'duplicate'
  missingInfo?: string[];           // presente si classification === 'needs_more_info'
}

// ---------------------------------------------------------------------------
// Effort Estimation
// ---------------------------------------------------------------------------

export type FibonacciPoint = 1 | 2 | 3 | 5 | 8 | 13;

export type ConfidenceLevel = 'High' | 'Medium' | 'Low';

export interface EstimationFactors {
  severityScore: number;
  complexityScore: number;
  componentCount: number;
  hasReproductionSteps: boolean;
}

export interface EffortEstimate {
  storyPoints: FibonacciPoint;
  justification: string;
  confidence: ConfidenceLevel;
  factors: EstimationFactors;
}

export const FIBONACCI: FibonacciPoint[] = [1, 2, 3, 5, 8, 13];

// ---------------------------------------------------------------------------
// Priority
// ---------------------------------------------------------------------------

export interface PriorityScore {
  total: number;                    // 0-100
  severityComponent: number;        // peso 40%
  ageComponent: number;             // peso 30%
  usersAffectedComponent: number;   // peso 20%
  criticalImpactComponent: number;  // peso 10%
}

export type PriorityCategory = 'critical' | 'important' | 'planned';

// ---------------------------------------------------------------------------
// Resolution Suggestion
// ---------------------------------------------------------------------------

export type AffectedLayer = 'backend' | 'frontend' | 'database' | 'configuration' | 'multiple';

export interface ResolutionSuggestion {
  steps: string[];                  // pasos técnicos concretos (mínimo 1)
  probableOrigin: string;           // componente/área de código probable
  testingApproach: string;          // cómo verificar la corrección
  affectedLayers: AffectedLayer[];  // capas que requieren cambios
  reproductionStepsUsage?: string;  // cómo usar los pasos de reproducción (si existen)
  errorInterpretation?: string;     // interpretación del error/stack trace (si existe)
}

// ---------------------------------------------------------------------------
// Analyzed / Prioritized Bug
// ---------------------------------------------------------------------------

export interface AnalyzedBug {
  bug: BugIssue;
  validation: ValidationResult;
  estimate: EffortEstimate;
  suggestion: ResolutionSuggestion;
}

export interface PrioritizedBug extends AnalyzedBug {
  priorityScore: PriorityScore;
  category: PriorityCategory;
}

// ---------------------------------------------------------------------------
// Resolution Plan
// ---------------------------------------------------------------------------

export interface FailedBugAnalysis {
  bugId: string;
  summary: string;
  reason: string;
}

export interface ResolutionPlanMetrics {
  totalAnalyzed: number;
  validCount: number;
  duplicateCount: number;
  expectedBehaviorCount: number;
  needsMoreInfoCount: number;
  validPercentage: number;
  totalEffortPoints: number;
  effortByCategory: Record<PriorityCategory, number>;
  distributionBySeverity: Record<Severity, number>;
}

export interface ResolutionPlan {
  id: string;
  projectKey: string;
  generatedAt: Date;
  executiveSummary: string;
  prioritizedBugs: PrioritizedBug[];
  failedBugs: FailedBugAnalysis[];
  metrics: ResolutionPlanMetrics;
}

// ---------------------------------------------------------------------------
// Jira Sync
// ---------------------------------------------------------------------------

export interface BugUpdatePayload {
  bugKey: string;
  comment: string;    // Validation + Estimate + Suggestion en ADF
  priority: string;   // Jira priority name
  labels: string[];   // incluye 'support-agent-reviewed'
}

export interface SyncReport {
  totalAttempted: number;
  successCount: number;
  failedCount: number;
  updatedKeys: string[];
  failedUpdates: Array<{ key: string; error: string }>;
}

// ---------------------------------------------------------------------------
// Datadog Types
// ---------------------------------------------------------------------------

export type DatadogFindingType = 'log' | 'monitor' | 'incident';
export type SuggestedCriticality = 'critical' | 'high' | 'medium' | 'low';

export interface DatadogLogEntry {
  id: string;
  message: string;
  service: string;
  status: string;        // "error", "warn"
  timestamp: string;
  host?: string;
  tags: string[];
}

export interface DatadogMonitor {
  id: number;
  name: string;
  type: string;
  overallState: string;  // "Alert", "Warn", "OK"
  message: string;
  tags: string[];
  query: string;
}

export interface DatadogIncident {
  id: string;
  title: string;
  severity: string;      // "SEV-1", "SEV-2", "SEV-3", etc.
  status: string;        // "active", "stable", "resolved"
  createdAt: string;
  services: string[];
  commanderUser?: string;
}

export interface DatadogFinding {
  id: string;
  type: DatadogFindingType;
  title: string;
  message: string;
  service: string;
  tags: string[];
  timestamp: string;
  rawData: DatadogLogEntry | DatadogMonitor | DatadogIncident;
}

export interface AnalyzedDatadogFinding {
  finding: DatadogFinding;
  suggestedCriticality: SuggestedCriticality;
  affectedService: string;
  affectedEndpoint?: string;
  resolutionSuggestion: string;
  resolutionSteps: string[];
  label: string; // "Sugerencia del Agente IA Support"
  correlatedBugKey?: string;
}

export interface DatadogIssueProposal {
  findingId: string;
  title: string;
  description: string;
  suggestedSeverity: SuggestedCriticality;
  component: string;
  service: string;
}

export interface DatadogMetrics {
  totalFindings: number;
  correlatedCount: number;
  uncorrelatedCount: number;
  distributionByType: Record<DatadogFindingType, number>;
  distributionByCriticality: Record<SuggestedCriticality, number>;
}

export interface ExtendedResolutionPlan extends ResolutionPlan {
  datadogFindings: AnalyzedDatadogFinding[];
  datadogMetrics?: DatadogMetrics;
  datadogWarning?: string;
  issueProposals: DatadogIssueProposal[];
}

// ---------------------------------------------------------------------------
// Analysis Request
// ---------------------------------------------------------------------------

export interface AnalysisRequest {
  projectKey: string;
  credentialKey: string;
  filters?: BugFilters;
  includeDatadog?: boolean;
  datadogService?: string;
}
