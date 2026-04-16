// Interfaces de servicios y componentes del sistema

import {
  Story,
  Epic,
  GenerationInput,
  GenerationResult,
  StoryChanges,
  Ambiguity,
  ValidationResult,
  Workspace,
  WorkspaceMetadata,
  Change,
  FigmaAnalysisResult,
  UIComponent,
  UserFlow,
  ProjectContext,
} from './domain';

import {
  JiraCredentials,
  AuthResult,
  JiraIssue,
  CreateResult,
  PermissionCheck,
} from './integration';

import {
  ProjectMetrics,
  VelocityData,
  Bottleneck,
} from './metrics';

/**
 * StoryGenerator - Interfaz para generación de historias
 */
export interface StoryGenerator {
  generateStories(input: GenerationInput): Promise<GenerationResult>;
  refineStory(storyId: string, changes: StoryChanges): Promise<Story>;
  detectAmbiguities(description: string): Ambiguity[];
}

/**
 * FigmaAnalyzer - Interfaz para análisis de diseños Figma
 */
export interface FigmaAnalyzer {
  analyzeDesign(figmaUrl: string): Promise<FigmaAnalysisResult>;
  extractComponents(fileKey: string): Promise<UIComponent[]>;
  identifyFlows(fileKey: string): Promise<UserFlow[]>;
}

/**
 * INVESTValidator - Interfaz para validación INVEST
 */
export interface INVESTValidator {
  validate(story: Story): ValidationResult;
  suggestImprovements(story: Story, failures: ValidationResult['failures']): ValidationResult['suggestions'];
}

/**
 * EpicAssembler - Interfaz para ensamblaje de épicas
 */
export interface EpicAssembler {
  assembleEpics(stories: Story[]): Epic[];
  identifyDependencies(stories: Story[]): Epic['dependencies'];
  reorganizeStories(storyId: string, targetEpicId: string): void;
}

/**
 * JiraConnector - Interfaz para conexión con Jira
 */
export interface JiraConnector {
  authenticate(credentials: JiraCredentials): Promise<AuthResult>;
  createIssues(issues: JiraIssue[]): Promise<CreateResult>;
  linkIssues(parentId: string, childIds: string[]): Promise<void>;
  validatePermissions(projectKey: string): Promise<PermissionCheck>;
  exportToJson(stories: Story[], epics: Epic[]): string;
  exportToCsv(stories: Story[], epics: Epic[]): string;
}

/**
 * ProjectAnalyzer - Interfaz para análisis de proyectos
 */
export interface ProjectAnalyzer {
  analyzeProject(projectKey: string): Promise<ProjectMetrics>;
  calculateVelocity(projectKey: string, sprints: number): Promise<VelocityData>;
  identifyBottlenecks(projectKey: string): Promise<Bottleneck[]>;
}

/**
 * CredentialStore - Interfaz para almacenamiento de credenciales
 */
export interface CredentialStore {
  store(key: string, credentials: JiraCredentials): Promise<void>;
  retrieve(key: string): Promise<JiraCredentials | null>;
  update(key: string, credentials: JiraCredentials): Promise<void>;
  delete(key: string): Promise<void>;
}

/**
 * WorkspaceStore - Interfaz para almacenamiento de workspaces
 */
export interface WorkspaceStore {
  saveWorkspace(workspace: Workspace): Promise<void>;
  loadWorkspace(workspaceId: string): Promise<Workspace>;
  listWorkspaces(): Promise<WorkspaceMetadata[]>;
}

/**
 * ChangeHistory - Interfaz para historial de cambios
 */
export interface ChangeHistory {
  recordChange(storyId: string, change: Change): void;
  getHistory(storyId: string): Change[];
  revert(storyId: string, changeId: string): Promise<Story>;
}
