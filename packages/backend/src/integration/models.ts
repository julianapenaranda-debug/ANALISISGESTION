/**
 * Integration Models - Factory Functions and Helpers
 * 
 * Este módulo proporciona funciones factory y utilidades para trabajar con modelos de integración
 * (Jira, Figma, Export). Trabaja con los tipos compartidos de @po-ai/shared.
 * 
 * Requerimientos: 5.1-5.6, 2.1-2.5, 9.1-9.5
 */

import {
  JiraCredentials,
  JiraIssue,
  JiraIssuePayload,
  JiraExport,
  JiraIssueUpdate,
  CsvRow,
  FigmaFile,
  FigmaNode,
  FigmaAnalysisResult,
  Story,
  Epic,
  AcceptanceCriterion,
} from '@po-ai/shared';

// ============================================================================
// Jira Integration Models
// ============================================================================

/**
 * Crea credenciales de Jira
 */
export function createJiraCredentials(params: {
  baseUrl: string;
  email: string;
  apiToken: string;
}): JiraCredentials {
  return {
    baseUrl: params.baseUrl,
    email: params.email,
    apiToken: params.apiToken,
  };
}

/**
 * Crea un JiraIssue desde una Story
 */
export function createJiraIssueFromStory(
  story: Story,
  projectKey: string
): JiraIssue {
  const description = formatStoryDescription(story);
  
  return {
    projectKey,
    issueType: 'Story',
    summary: story.title,
    description,
    components: story.components.length > 0 ? story.components : undefined,
    epicLink: story.epicId,
  };
}

/**
 * Crea un JiraIssue desde una Epic
 */
export function createJiraIssueFromEpic(
  epic: Epic,
  projectKey: string
): JiraIssue {
  return {
    projectKey,
    issueType: 'Epic',
    summary: epic.title,
    description: formatEpicDescription(epic),
    components: undefined,
    epicLink: undefined,
  };
}

/**
 * Formatea la descripción de una historia para Jira (Markdown)
 */
export function formatStoryDescription(story: Story): string {
  let description = `Como ${story.role}, quiero ${story.action}, para que ${story.value}\n\n`;
  
  if (story.description) {
    description += `${story.description}\n\n`;
  }
  
  description += '## Criterios de Aceptación\n\n';
  
  story.acceptanceCriteria.forEach((criterion, index) => {
    description += `### Criterio ${index + 1} (${criterion.type})\n\n`;
    description += `**Dado que** ${criterion.given}\n\n`;
    description += `**Cuando** ${criterion.when}\n\n`;
    description += `**Entonces** ${criterion.then}\n\n`;
  });
  
  if (story.components.length > 0) {
    description += `## Componentes\n\n${story.components.join(', ')}\n`;
  }
  
  return description;
}

/**
 * Formatea la descripción de una épica para Jira (Markdown)
 */
export function formatEpicDescription(epic: Epic): string {
  let description = `${epic.description}\n\n`;
  description += `## Valor de Negocio\n\n${epic.businessValue}\n\n`;
  
  if (epic.stories.length > 0) {
    description += `## Historias Incluidas\n\n`;
    description += `Esta épica contiene ${epic.stories.length} historias de usuario.\n`;
  }
  
  if (epic.dependencies.length > 0) {
    description += `\n## Dependencias\n\n`;
    epic.dependencies.forEach((dep) => {
      description += `- ${dep.type}: ${dep.reason}\n`;
    });
  }
  
  return description;
}

/**
 * Convierte un JiraIssue a JiraIssuePayload (formato API de Jira)
 */
export function convertToJiraPayload(issue: JiraIssue): JiraIssuePayload {
  const payload: JiraIssuePayload = {
    fields: {
      project: { key: issue.projectKey },
      issuetype: { name: issue.issueType },
      summary: issue.summary,
      description: convertMarkdownToADF(issue.description),
    },
  };
  
  if (issue.components && issue.components.length > 0) {
    payload.fields.components = issue.components.map((name) => ({ name }));
  }
  
  if (issue.epicLink) {
    payload.fields.customfield_10014 = issue.epicLink;
  }
  
  return payload;
}

/**
 * Convierte Markdown a Atlassian Document Format (ADF)
 * Implementación simplificada - en producción usar una librería como markdown-to-adf
 */
export function convertMarkdownToADF(markdown: string): {
  type: 'doc';
  version: 1;
  content: any[];
} {
  const lines = markdown.split('\n');
  const content: any[] = [];
  
  for (const line of lines) {
    if (line.trim() === '') {
      continue;
    }
    
    // Headers
    if (line.startsWith('## ')) {
      content.push({
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: line.substring(3) }],
      });
    } else if (line.startsWith('### ')) {
      content.push({
        type: 'heading',
        attrs: { level: 3 },
        content: [{ type: 'text', text: line.substring(4) }],
      });
    }
    // Bold text
    else if (line.includes('**')) {
      const parts = line.split('**');
      const textContent: any[] = [];
      
      parts.forEach((part, index) => {
        if (index % 2 === 0) {
          if (part) textContent.push({ type: 'text', text: part });
        } else {
          textContent.push({
            type: 'text',
            text: part,
            marks: [{ type: 'strong' }],
          });
        }
      });
      
      content.push({
        type: 'paragraph',
        content: textContent,
      });
    }
    // List items
    else if (line.startsWith('- ')) {
      content.push({
        type: 'bulletList',
        content: [
          {
            type: 'listItem',
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: line.substring(2) }],
              },
            ],
          },
        ],
      });
    }
    // Regular paragraph
    else {
      content.push({
        type: 'paragraph',
        content: [{ type: 'text', text: line }],
      });
    }
  }
  
  return {
    type: 'doc',
    version: 1,
    content,
  };
}

/**
 * Valida credenciales de Jira
 */
export function validateJiraCredentials(credentials: JiraCredentials): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  if (!credentials.baseUrl || credentials.baseUrl.trim() === '') {
    errors.push('Base URL es requerida');
  } else if (!credentials.baseUrl.startsWith('http')) {
    errors.push('Base URL debe comenzar con http:// o https://');
  }
  
  if (!credentials.email || credentials.email.trim() === '') {
    errors.push('Email es requerido');
  } else if (!credentials.email.includes('@')) {
    errors.push('Email debe ser válido');
  }
  
  if (!credentials.apiToken || credentials.apiToken.trim() === '') {
    errors.push('API Token es requerido');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============================================================================
// Figma Integration Models
// ============================================================================

/**
 * Crea un FigmaFile
 */
export function createFigmaFile(params: {
  name: string;
  lastModified: string;
  thumbnailUrl: string;
  version: string;
  document: FigmaNode;
}): FigmaFile {
  return {
    name: params.name,
    lastModified: params.lastModified,
    thumbnailUrl: params.thumbnailUrl,
    version: params.version,
    document: params.document,
  };
}

/**
 * Crea un FigmaNode
 */
export function createFigmaNode(params: {
  id: string;
  name: string;
  type: string;
  children?: FigmaNode[];
  prototypeStartNodeID?: string;
}): FigmaNode {
  return {
    id: params.id,
    name: params.name,
    type: params.type,
    children: params.children,
    prototypeStartNodeID: params.prototypeStartNodeID,
  };
}

/**
 * Extrae todos los nodos de un tipo específico de un árbol Figma
 */
export function extractNodesByType(
  node: FigmaNode,
  type: string
): FigmaNode[] {
  const results: FigmaNode[] = [];
  
  if (node.type === type) {
    results.push(node);
  }
  
  if (node.children) {
    for (const child of node.children) {
      results.push(...extractNodesByType(child, type));
    }
  }
  
  return results;
}

/**
 * Extrae componentes interactivos de un diseño Figma
 */
export function extractInteractiveComponents(file: FigmaFile): FigmaNode[] {
  const interactiveTypes = ['BUTTON', 'INPUT', 'TEXT_INPUT', 'CHECKBOX', 'RADIO'];
  const components: FigmaNode[] = [];
  
  for (const type of interactiveTypes) {
    components.push(...extractNodesByType(file.document, type));
  }
  
  return components;
}

/**
 * Encuentra el nodo raíz de un prototipo
 */
export function findPrototypeStartNode(file: FigmaFile): FigmaNode | null {
  if (file.document.prototypeStartNodeID) {
    return findNodeById(file.document, file.document.prototypeStartNodeID);
  }
  return null;
}

/**
 * Busca un nodo por ID en el árbol
 */
export function findNodeById(node: FigmaNode, id: string): FigmaNode | null {
  if (node.id === id) {
    return node;
  }
  
  if (node.children) {
    for (const child of node.children) {
      const found = findNodeById(child, id);
      if (found) return found;
    }
  }
  
  return null;
}

/**
 * Cuenta el número total de nodos en un árbol
 */
export function countNodes(node: FigmaNode): number {
  let count = 1;
  
  if (node.children) {
    for (const child of node.children) {
      count += countNodes(child);
    }
  }
  
  return count;
}

// ============================================================================
// Export Models
// ============================================================================

/**
 * Crea un JiraExport desde historias y épicas
 */
export function createJiraExport(
  stories: Story[],
  epics: Epic[],
  projectKey: string
): JiraExport {
  const issueUpdates: JiraIssueUpdate[] = [];
  
  // Agregar épicas primero
  for (const epic of epics) {
    issueUpdates.push({
      fields: {
        project: { key: projectKey },
        issuetype: { name: 'Epic' },
        summary: epic.title,
        description: formatEpicDescription(epic),
      },
    });
  }
  
  // Agregar historias
  for (const story of stories) {
    issueUpdates.push({
      fields: {
        project: { key: projectKey },
        issuetype: { name: 'Story' },
        summary: story.title,
        description: formatStoryDescription(story),
        components: story.components.length > 0 ? story.components : undefined,
      },
    });
  }
  
  return { issueUpdates };
}

/**
 * Convierte historias y épicas a formato CSV
 */
export function convertToCsvRows(
  stories: Story[],
  epics: Epic[]
): CsvRow[] {
  const rows: CsvRow[] = [];
  
  // Agregar épicas
  for (const epic of epics) {
    rows.push({
      'Issue Type': 'Epic',
      'Summary': epic.title,
      'Description': epic.description,
      'Acceptance Criteria': '',
      'Components': '',
      'Epic Link': '',
    });
  }
  
  // Agregar historias
  for (const story of stories) {
    const acceptanceCriteria = formatAcceptanceCriteriaForCsv(
      story.acceptanceCriteria
    );
    
    rows.push({
      'Issue Type': 'Story',
      'Summary': story.title,
      'Description': `Como ${story.role}, quiero ${story.action}, para que ${story.value}`,
      'Acceptance Criteria': acceptanceCriteria,
      'Components': story.components.join(', '),
      'Epic Link': story.epicId || '',
    });
  }
  
  return rows;
}

/**
 * Formatea criterios de aceptación para CSV
 */
export function formatAcceptanceCriteriaForCsv(
  criteria: AcceptanceCriterion[]
): string {
  return criteria
    .map((c, i) => {
      return `[${i + 1}] Dado que ${c.given}, Cuando ${c.when}, Entonces ${c.then}`;
    })
    .join(' | ');
}

/**
 * Convierte filas CSV a string CSV
 */
export function convertCsvRowsToString(rows: CsvRow[]): string {
  if (rows.length === 0) return '';
  
  // Header
  const headers = Object.keys(rows[0]);
  let csv = headers.join(',') + '\n';
  
  // Rows
  for (const row of rows) {
    const values = headers.map((header) => {
      const value = row[header as keyof CsvRow];
      // Escape commas and quotes
      if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    });
    csv += values.join(',') + '\n';
  }
  
  return csv;
}

/**
 * Filtra historias por IDs seleccionados
 */
export function filterStoriesByIds(
  stories: Story[],
  selectedIds: string[]
): Story[] {
  return stories.filter((story) => selectedIds.includes(story.id));
}

/**
 * Filtra épicas que contienen las historias seleccionadas
 */
export function filterEpicsByStories(
  epics: Epic[],
  selectedStoryIds: string[]
): Epic[] {
  return epics.filter((epic) =>
    epic.stories.some((storyId) => selectedStoryIds.includes(storyId))
  );
}

/**
 * Valida que un JiraExport sea válido
 */
export function validateJiraExport(jiraExport: JiraExport): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  if (!jiraExport.issueUpdates || jiraExport.issueUpdates.length === 0) {
    errors.push('JiraExport debe contener al menos un issue');
  }
  
  for (let i = 0; i < jiraExport.issueUpdates.length; i++) {
    const issue = jiraExport.issueUpdates[i];
    
    if (!issue.fields.project?.key) {
      errors.push(`Issue ${i}: project key es requerido`);
    }
    
    if (!issue.fields.issuetype?.name) {
      errors.push(`Issue ${i}: issuetype es requerido`);
    }
    
    if (!issue.fields.summary || issue.fields.summary.trim() === '') {
      errors.push(`Issue ${i}: summary es requerido`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Valida que las filas CSV sean válidas
 */
export function validateCsvRows(rows: CsvRow[]): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  if (rows.length === 0) {
    errors.push('CSV debe contener al menos una fila');
  }
  
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    
    if (!row['Issue Type'] || row['Issue Type'].trim() === '') {
      errors.push(`Fila ${i + 1}: Issue Type es requerido`);
    }
    
    if (!row['Summary'] || row['Summary'].trim() === '') {
      errors.push(`Fila ${i + 1}: Summary es requerido`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}
