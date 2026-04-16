// Tipos de dominio core del sistema PO AI

/**
 * Story representa una historia de usuario completa
 */
export interface Story {
  id: string;
  title: string;
  role: string;              // "usuario", "administrador", etc.
  action: string;            // "crear una tarea", "ver el dashboard"
  value: string;             // "pueda organizar mi trabajo"
  description: string;       // Descripción completa generada
  acceptanceCriteria: AcceptanceCriterion[];
  components: string[];      // Componentes técnicos afectados
  epicId?: string;
  investScore: InvestScore;
  metadata: StoryMetadata;
}

/**
 * Metadatos de una historia
 */
export interface StoryMetadata {
  created: Date;
  modified: Date;
  source: 'manual' | 'figma' | 'generated';
  figmaUrl?: string;
  jiraKey?: string;
  jiraId?: string;
}

/**
 * AcceptanceCriterion en formato Gherkin
 */
export interface AcceptanceCriterion {
  id: string;
  given: string;             // Precondición
  when: string;              // Acción
  then: string;              // Resultado esperado
  type: 'positive' | 'negative' | 'error';
}

/**
 * Epic agrupa historias relacionadas
 */
export interface Epic {
  id: string;
  title: string;
  description: string;
  businessValue: string;
  stories: string[];         // IDs de historias
  dependencies: Dependency[];
  metadata: EpicMetadata;
}

/**
 * Metadatos de una épica
 */
export interface EpicMetadata {
  created: Date;
  modified: Date;
  jiraKey?: string;
  jiraId?: string;
}

/**
 * Dependency representa una relación entre historias
 */
export interface Dependency {
  fromStoryId: string;
  toStoryId: string;
  type: 'blocks' | 'relates' | 'requires';
  reason: string;
}

/**
 * InvestScore representa la puntuación de validación INVEST
 */
export interface InvestScore {
  independent: number;  // 0-1
  negotiable: number;   // 0-1
  valuable: number;     // 0-1
  estimable: number;    // 0-1
  small: number;        // 0-1
  testable: number;     // 0-1
  overall: number;      // 0-1
}

/**
 * ValidationResult contiene resultados de validación INVEST
 */
export interface ValidationResult {
  isValid: boolean;
  score: InvestScore;
  failures: ValidationFailure[];
  suggestions: Suggestion[];
}

/**
 * ValidationFailure representa un fallo en validación INVEST
 */
export interface ValidationFailure {
  criterion: 'I' | 'N' | 'V' | 'E' | 'S' | 'T';
  reason: string;
  severity: 'error' | 'warning';
}

/**
 * Suggestion proporciona mejoras para historias
 */
export interface Suggestion {
  criterion: string;
  improvement: string;
  example?: string;
}

/**
 * Ambiguity representa términos o conceptos que requieren aclaración
 */
export interface Ambiguity {
  id: string;
  type: 'vague_term' | 'missing_role' | 'missing_value' | 'unclear_scope';
  location: string;          // Dónde se encontró
  term: string;              // Término ambiguo
  question: string;          // Pregunta para aclarar
  suggestions: string[];     // Sugerencias de aclaración
}

/**
 * ProjectContext proporciona contexto del proyecto
 */
export interface ProjectContext {
  projectKey: string;
  domain: string;            // "e-commerce", "healthcare", etc.
  existingComponents: string[];
  userRoles: string[];
  conventions: ProjectConventions;
}

/**
 * ProjectConventions define convenciones del proyecto
 */
export interface ProjectConventions {
  storyPointScale: number[]; // [1, 2, 3, 5, 8, 13]
  componentNaming: string;   // Convención de nombres
  customFields: CustomField[];
}

/**
 * CustomField representa un campo personalizado
 */
export interface CustomField {
  name: string;
  type: string;
  required: boolean;
}

/**
 * GenerationInput para generar historias
 */
export interface GenerationInput {
  description: string;
  context?: ProjectContext;
  figmaData?: FigmaAnalysisResult;
}

/**
 * GenerationResult contiene historias generadas
 */
export interface GenerationResult {
  stories: Story[];
  epics: Epic[];
  ambiguities: Ambiguity[];
  validationResults: ValidationResult[];
}

/**
 * StoryChanges para refinamiento de historias
 */
export interface StoryChanges {
  title?: string;
  role?: string;
  action?: string;
  value?: string;
  description?: string;
  acceptanceCriteria?: AcceptanceCriterion[];
  components?: string[];
  epicId?: string;
}

/**
 * Workspace representa un espacio de trabajo
 */
export interface Workspace {
  id: string;
  name: string;
  projectKey: string;
  stories: Story[];
  epics: Epic[];
  metadata: WorkspaceMetadata;
}

/**
 * WorkspaceMetadata contiene metadatos del workspace
 */
export interface WorkspaceMetadata {
  created: Date;
  modified: Date;
  syncStatus: 'pending' | 'synced' | 'modified';
  jiraProjectKey?: string;
}

/**
 * Change representa un cambio en una historia
 */
export interface Change {
  id: string;
  timestamp: Date;
  field: string;
  oldValue: any;
  newValue: any;
  author: string;
}

/**
 * UIComponent representa un componente de UI extraído de Figma
 */
export interface UIComponent {
  id: string;
  name: string;
  type: string;
  properties: Record<string, any>;
  interactions: string[];
}

/**
 * UserFlow representa un flujo de usuario
 */
export interface UserFlow {
  id: string;
  name: string;
  screens: string[];
  sequence: FlowStep[];
}

/**
 * FlowStep representa un paso en un flujo
 */
export interface FlowStep {
  screenId: string;
  action: string;
  trigger: string;
  nextScreenId?: string;
}

/**
 * Screen representa una pantalla en Figma
 */
export interface Screen {
  id: string;
  name: string;
  components: UIComponent[];
}

/**
 * Interaction representa una interacción en Figma
 */
export interface Interaction {
  id: string;
  sourceId: string;
  targetId: string;
  trigger: string;
  action: string;
}

/**
 * FigmaAnalysisResult contiene resultados del análisis de Figma
 */
export interface FigmaAnalysisResult {
  components: UIComponent[];
  flows: UserFlow[];
  screens: Screen[];
  interactions: Interaction[];
}
