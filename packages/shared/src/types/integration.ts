// Tipos de integración con servicios externos (Jira, Figma)

/**
 * JiraCredentials para autenticación con Jira
 */
export interface JiraCredentials {
  baseUrl: string;
  email: string;
  apiToken: string;
}

/**
 * AuthResult resultado de autenticación
 */
export interface AuthResult {
  success: boolean;
  message: string;
  userId?: string;
}

/**
 * JiraIssue representa un issue para crear en Jira
 */
export interface JiraIssue {
  projectKey: string;
  issueType: 'Epic' | 'Story';
  summary: string;
  description: string;
  components?: string[];
  epicLink?: string;
}

/**
 * CreateResult resultado de creación de issues
 */
export interface CreateResult {
  created: IssueReference[];
  failed: FailedIssue[];
}

/**
 * IssueReference referencia a un issue creado
 */
export interface IssueReference {
  localId: string;
  jiraKey: string;
  jiraId: string;
  url: string;
}

/**
 * FailedIssue representa un issue que falló al crearse
 */
export interface FailedIssue {
  localId: string;
  error: string;
  reason: string;
}

/**
 * PermissionCheck resultado de validación de permisos
 */
export interface PermissionCheck {
  hasPermission: boolean;
  permissions: string[];
  missingPermissions?: string[];
}

/**
 * JiraIssuePayload payload para crear issue en Jira
 */
export interface JiraIssuePayload {
  fields: {
    project: { key: string };
    issuetype: { name: string };
    summary: string;
    description: {
      type: 'doc';
      version: 1;
      content: any[];  // Formato Atlassian Document Format
    };
    components?: Array<{ name: string }>;
    customfield_10014?: string;  // Epic Link
  };
}

/**
 * JiraExport modelo para exportación JSON compatible con Jira
 */
export interface JiraExport {
  issueUpdates: JiraIssueUpdate[];
}

/**
 * JiraIssueUpdate actualización de issue para exportación
 */
export interface JiraIssueUpdate {
  fields: {
    project: { key: string };
    issuetype: { name: string };
    summary: string;
    description: string;
    components?: string[];
  };
}

/**
 * CsvRow modelo para exportación CSV
 */
export interface CsvRow {
  'Issue Type': string;
  'Summary': string;
  'Description': string;
  'Acceptance Criteria': string;
  'Components': string;
  'Epic Link': string;
}

/**
 * FigmaFile representa un archivo de Figma
 */
export interface FigmaFile {
  name: string;
  lastModified: string;
  thumbnailUrl: string;
  version: string;
  document: FigmaNode;
}

/**
 * FigmaNode representa un nodo en Figma
 */
export interface FigmaNode {
  id: string;
  name: string;
  type: string;
  children?: FigmaNode[];
  prototypeStartNodeID?: string;
  prototypeDevice?: any;
}

/**
 * FigmaPrototype representa un prototipo de Figma
 */
export interface FigmaPrototype {
  interactions: FigmaInteraction[];
}

/**
 * FigmaInteraction representa una interacción en Figma
 */
export interface FigmaInteraction {
  trigger: {
    type: string;  // "ON_CLICK", "ON_HOVER", etc.
  };
  action: {
    type: string;  // "NODE", "URL", "BACK"
    destinationId?: string;
    navigation?: string;
  };
}

/**
 * ErrorResponse respuesta de error estándar
 */
export interface ErrorResponse {
  code: string;
  message: string;
  details?: any;
  recoverable: boolean;
  suggestedAction?: string;
}
