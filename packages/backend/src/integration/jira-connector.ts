/**
 * Jira Connector
 *
 * Sincroniza historias y épicas con Jira.
 * Gestiona autenticación, creación de issues, vinculación y exportación.
 * Para MVP: usa HTTP directo a la API REST de Jira v3.
 *
 * Requerimientos: 5.1-5.6, 6.1-6.5, 9.1-9.5, 10.3, 10.5
 */

import https from 'https';
import http from 'http';
import { Story, Epic } from '../core/models';

export interface JiraCredentials {
  baseUrl: string;
  email: string;
  apiToken: string;
}

export interface AuthResult {
  success: boolean;
  accountId?: string;
  displayName?: string;
  error?: string;
}

export interface PermissionCheck {
  canCreate: boolean;
  canEdit: boolean;
  projectExists: boolean;
  error?: string;
}

export interface JiraIssuePayload {
  fields: {
    project: { key: string };
    issuetype: { name: string };
    summary: string;
    description?: any;
    components?: Array<{ name: string }>;
    [key: string]: any;
  };
}

export interface IssueReference {
  localId: string;
  jiraKey: string;
  jiraId: string;
  url: string;
}

export interface FailedIssue {
  localId: string;
  error: string;
}

export interface CreateResult {
  created: IssueReference[];
  failed: FailedIssue[];
}

export interface CsvRow {
  issueType: string;
  summary: string;
  description: string;
  acceptanceCriteria: string;
  components: string;
  epicLink: string;
}

/**
 * Realiza una petición HTTP/HTTPS a la API de Jira
 */
function jiraRequest(
  credentials: JiraCredentials,
  method: string,
  path: string,
  body?: any
): Promise<any> {
  return new Promise((resolve, reject) => {
    const auth = Buffer.from(`${credentials.email}:${credentials.apiToken}`).toString('base64');
    const bodyStr = body ? JSON.stringify(body) : '';

    const url = new URL(path, credentials.baseUrl);
    const isHttps = url.protocol === 'https:';
    const lib = isHttps ? https : http;

    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method,
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr).toString() } : {}),
      },
    };

    const req = lib.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          if (res.statusCode && res.statusCode >= 400) {
            reject(createJiraError(res.statusCode, parsed));
          } else {
            resolve(parsed);
          }
        } catch {
          resolve(data);
        }
      });
    });

    req.on('error', (err) => {
      reject({ code: 'NETWORK_ERROR', message: err.message });
    });

    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

/**
 * Crea un error descriptivo basado en el código HTTP de Jira
 */
function createJiraError(statusCode: number, body: any): Error {
  const message = body?.errorMessages?.[0] || body?.message || 'Unknown error';

  switch (statusCode) {
    case 401:
      return Object.assign(new Error(`JIRA_AUTH_FAILED: ${message}`), { code: 'JIRA_AUTH_FAILED', statusCode });
    case 403:
      return Object.assign(new Error(`JIRA_PERMISSION_DENIED: ${message}`), { code: 'JIRA_PERMISSION_DENIED', statusCode });
    case 404:
      return Object.assign(new Error(`JIRA_NOT_FOUND: ${message}`), { code: 'JIRA_NOT_FOUND', statusCode });
    case 429:
      return Object.assign(new Error(`JIRA_RATE_LIMITED: Too many requests`), { code: 'JIRA_RATE_LIMITED', statusCode });
    default:
      return Object.assign(new Error(`JIRA_ERROR_${statusCode}: ${message}`), { code: `JIRA_ERROR_${statusCode}`, statusCode });
  }
}

/**
 * Autentica con Jira y verifica credenciales
 */
export async function authenticate(credentials: JiraCredentials): Promise<AuthResult> {
  try {
    const result = await jiraRequest(credentials, 'GET', '/rest/api/3/myself');
    return {
      success: true,
      accountId: result.accountId,
      displayName: result.displayName,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Authentication failed',
    };
  }
}

/**
 * Valida permisos en un proyecto Jira
 */
export async function validatePermissions(
  credentials: JiraCredentials,
  projectKey: string
): Promise<PermissionCheck> {
  try {
    // Verificar que el proyecto existe
    await jiraRequest(credentials, 'GET', `/rest/api/3/project/${projectKey}`);

    // Verificar permisos
    const perms = await jiraRequest(
      credentials,
      'GET',
      `/rest/api/3/mypermissions?projectKey=${projectKey}&permissions=CREATE_ISSUES,EDIT_ISSUES`
    );

    const canCreate = perms?.permissions?.CREATE_ISSUES?.havePermission === true;
    const canEdit = perms?.permissions?.EDIT_ISSUES?.havePermission === true;

    return { canCreate, canEdit, projectExists: true };
  } catch (error: any) {
    if (error.code === 'JIRA_NOT_FOUND') {
      return { canCreate: false, canEdit: false, projectExists: false, error: `Project ${projectKey} not found` };
    }
    return { canCreate: false, canEdit: false, projectExists: false, error: error.message };
  }
}

/**
 * Convierte una historia al formato de payload de Jira
 */
export function storyToJiraPayload(story: Story, projectKey: string, epicKey?: string): JiraIssuePayload {
  const description = buildJiraDescription(story);

  const payload: JiraIssuePayload = {
    fields: {
      project: { key: projectKey },
      issuetype: { name: 'Story' },
      summary: story.title,
      description,
    },
  };

  if (story.components && story.components.length > 0) {
    payload.fields.components = story.components.map(c => ({ name: c }));
  }

  if (epicKey) {
    // Campo estándar para epic link (puede variar según configuración de Jira)
    payload.fields['customfield_10014'] = epicKey;
  }

  return payload;
}

/**
 * Convierte una épica al formato de payload de Jira
 */
export function epicToJiraPayload(epic: Epic, projectKey: string): JiraIssuePayload {
  return {
    fields: {
      project: { key: projectKey },
      issuetype: { name: 'Epic' },
      summary: epic.title,
      description: {
        type: 'doc',
        version: 1,
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: epic.description }],
          },
        ],
      },
      customfield_10011: epic.title, // Epic Name field
    },
  };
}

/**
 * Construye la descripción en formato Atlassian Document Format (ADF)
 */
function buildJiraDescription(story: Story): any {
  const content: any[] = [];

  // Formato de historia
  content.push({
    type: 'paragraph',
    content: [
      { type: 'text', text: `Como ${story.role}, quiero ${story.action}, para que ${story.value}`, marks: [{ type: 'strong' }] },
    ],
  });

  // Criterios de aceptación
  if (story.acceptanceCriteria && story.acceptanceCriteria.length > 0) {
    content.push({
      type: 'heading',
      attrs: { level: 3 },
      content: [{ type: 'text', text: 'Criterios de Aceptación' }],
    });

    for (const criterion of story.acceptanceCriteria) {
      content.push({
        type: 'bulletList',
        content: [
          {
            type: 'listItem',
            content: [
              {
                type: 'paragraph',
                content: [
                  { type: 'text', text: `Dado que ${criterion.given}, cuando ${criterion.when}, entonces ${criterion.then}` },
                ],
              },
            ],
          },
        ],
      });
    }
  }

  return { type: 'doc', version: 1, content };
}

/**
 * Crea issues en Jira con retry para errores de red
 */
export async function createIssues(
  credentials: JiraCredentials,
  payloads: Array<{ localId: string; payload: JiraIssuePayload }>,
  maxRetries = 3
): Promise<CreateResult> {
  const created: IssueReference[] = [];
  const failed: FailedIssue[] = [];

  for (const { localId, payload } of payloads) {
    let lastError: any;
    let success = false;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const result = await jiraRequest(credentials, 'POST', '/rest/api/3/issue', payload);
        created.push({
          localId,
          jiraKey: result.key,
          jiraId: result.id,
          url: `${credentials.baseUrl}/browse/${result.key}`,
        });
        success = true;
        break;
      } catch (error: any) {
        lastError = error;
        // No reintentar errores de autenticación/permisos
        if (error.code === 'JIRA_AUTH_FAILED' || error.code === 'JIRA_PERMISSION_DENIED') {
          break;
        }
        // Esperar antes de reintentar (exponential backoff)
        if (attempt < maxRetries - 1) {
          await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
        }
      }
    }

    if (!success) {
      failed.push({ localId, error: lastError?.message || 'Unknown error' });
    }
  }

  return { created, failed };
}

/**
 * Sincroniza historias y épicas con Jira
 * Crea épicas primero, luego historias con epic link
 */
export async function syncToJira(
  credentials: JiraCredentials,
  projectKey: string,
  stories: Story[],
  epics: Epic[]
): Promise<CreateResult> {
  const allCreated: IssueReference[] = [];
  const allFailed: FailedIssue[] = [];

  // 1. Crear épicas primero
  const epicPayloads = epics.map(epic => ({
    localId: epic.id,
    payload: epicToJiraPayload(epic, projectKey),
  }));

  const epicResult = await createIssues(credentials, epicPayloads);
  allCreated.push(...epicResult.created);
  allFailed.push(...epicResult.failed);

  // Mapear IDs locales a keys de Jira
  const epicKeyMap = new Map<string, string>();
  for (const ref of epicResult.created) {
    epicKeyMap.set(ref.localId, ref.jiraKey);
  }

  // 2. Crear historias con epic link
  const storyPayloads = stories.map(story => {
    const epicKey = story.epicId ? epicKeyMap.get(story.epicId) : undefined;
    return {
      localId: story.id,
      payload: storyToJiraPayload(story, projectKey, epicKey),
    };
  });

  const storyResult = await createIssues(credentials, storyPayloads);
  allCreated.push(...storyResult.created);
  allFailed.push(...storyResult.failed);

  return { created: allCreated, failed: allFailed };
}

/**
 * Exporta historias y épicas a JSON compatible con Jira
 */
export function exportToJson(stories: Story[], epics: Epic[], projectKey: string): string {
  const issues = [
    ...epics.map(epic => epicToJiraPayload(epic, projectKey)),
    ...stories.map(story => storyToJiraPayload(story, projectKey)),
  ];
  return JSON.stringify({ issues }, null, 2);
}

/**
 * Exporta historias y épicas a CSV
 */
export function exportToCsv(stories: Story[], epics: Epic[]): string {
  const headers = ['Issue Type', 'Summary', 'Description', 'Acceptance Criteria', 'Components', 'Epic Link'];
  const rows: string[][] = [headers];

  // Épicas
  for (const epic of epics) {
    rows.push([
      'Epic',
      escapeCsv(epic.title),
      escapeCsv(epic.description),
      '',
      '',
      '',
    ]);
  }

  // Historias
  for (const story of stories) {
    const description = `Como ${story.role}, quiero ${story.action}, para que ${story.value}`;
    const criteria = story.acceptanceCriteria
      .map(c => `Dado que ${c.given}, cuando ${c.when}, entonces ${c.then}`)
      .join(' | ');
    const components = story.components.join(', ');
    const epicLink = story.epicId || '';

    rows.push([
      'Story',
      escapeCsv(story.title),
      escapeCsv(description),
      escapeCsv(criteria),
      escapeCsv(components),
      escapeCsv(epicLink),
    ]);
  }

  return rows.map(row => row.join(',')).join('\n');
}

function escapeCsv(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Exporta un subset de historias seleccionadas
 */
export function exportSelected(
  storyIds: string[],
  allStories: Story[],
  allEpics: Epic[],
  format: 'json' | 'csv',
  projectKey = 'PROJECT'
): string {
  const selectedStories = allStories.filter(s => storyIds.includes(s.id));
  const epicIds = new Set(selectedStories.map(s => s.epicId).filter(Boolean));
  const selectedEpics = allEpics.filter(e => epicIds.has(e.id));

  return format === 'json'
    ? exportToJson(selectedStories, selectedEpics, projectKey)
    : exportToCsv(selectedStories, selectedEpics);
}

// ---------------------------------------------------------------------------
// Project Epics
// ---------------------------------------------------------------------------

/**
 * Fetches Epic issues from a Jira project that are not in a closed/done state.
 * Uses POST /rest/api/3/search/jql with JQL filtering by issuetype = Epic.
 * Requerimientos: 4.2, 4.10
 */
export async function fetchProjectEpics(
  credentials: JiraCredentials,
  projectKey: string
): Promise<Array<{ id: string; key: string; summary: string }>> {
  const jql = `project = ${projectKey} AND issuetype = Epic AND status not in (Done, Closed, Resolved, "Producción", Hecho)`;

  const response = await jiraRequest(credentials, 'POST', '/rest/api/3/search/jql', {
    jql,
    fields: ['summary'],
    maxResults: 200,
  });

  const issues: any[] = response?.issues ?? [];

  return issues.map((issue: any) => ({
    id: issue.id ?? '',
    key: issue.key ?? '',
    summary: issue.fields?.summary ?? '',
  }));
}

// ---------------------------------------------------------------------------
// Support Agent Extensions
// ---------------------------------------------------------------------------

import {
  BugIssue,
  BugFilters,
  JiraComment,
  BugUpdatePayload,
  SyncReport,
} from '../core/support-agent-models';

/** Severity → Jira priority name mapping */
const SEVERITY_TO_JIRA_PRIORITY: Record<string, string> = {
  Critical: 'Highest',
  High: 'High',
  Medium: 'Medium',
  Low: 'Low',
};

/**
 * Fetches Bug issues from a Jira project, applying optional filters.
 * Requerimientos: 1.1, 1.2, 1.3, 1.5
 */
export async function fetchBugIssues(
  credentials: JiraCredentials,
  projectKey: string,
  filters?: BugFilters
): Promise<BugIssue[]> {
  // Base JQL
  let jql = `project = ${projectKey} AND issuetype in (Bug, Incident, Problem) AND status in (Open, "In Progress", Reopened)`;

  // Apply optional severity filter (mapped to Jira priorities)
  if (filters?.severities && filters.severities.length > 0) {
    const priorities = filters.severities
      .map(s => SEVERITY_TO_JIRA_PRIORITY[s])
      .filter(Boolean)
      .map(p => `"${p}"`)
      .join(', ');
    if (priorities) {
      jql += ` AND priority in (${priorities})`;
    }
  }

  // Apply optional component filter
  if (filters?.components && filters.components.length > 0) {
    const comps = filters.components.map(c => `"${c}"`).join(', ');
    jql += ` AND component in (${comps})`;
  }

  // Apply optional date range filters
  if (filters?.createdAfter) {
    const dateStr = filters.createdAfter.toISOString().split('T')[0];
    jql += ` AND created >= "${dateStr}"`;
  }
  if (filters?.createdBefore) {
    const dateStr = filters.createdBefore.toISOString().split('T')[0];
    jql += ` AND created <= "${dateStr}"`;
  }

  const fields = 'summary,description,priority,status,reporter,assignee,created,comment,components,labels';

  const response = await jiraRequest(credentials, 'POST', '/rest/api/3/search/jql', {
    jql,
    fields: fields.split(','),
    maxResults: 100,
  });

  const issues: any[] = response?.issues ?? [];
  if (issues.length === 0) {
    return [];
  }

  return issues.map((issue: any): BugIssue => {
    const fields = issue.fields ?? {};

    // Map comments
    const commentList: JiraComment[] = (fields.comment?.comments ?? []).map((c: any) => ({
      id: c.id ?? '',
      author: c.author?.displayName ?? c.author?.emailAddress ?? '',
      body: typeof c.body === 'string' ? c.body : JSON.stringify(c.body ?? ''),
      created: new Date(c.created),
    }));

    // Map components
    const components: string[] = (fields.components ?? []).map((comp: any) => comp.name ?? '');

    // Map labels
    const labels: string[] = fields.labels ?? [];

    return {
      id: issue.id ?? '',
      key: issue.key ?? '',
      summary: fields.summary ?? '',
      description: typeof fields.description === 'string'
        ? fields.description
        : JSON.stringify(fields.description ?? ''),
      priority: fields.priority?.name ?? '',
      status: fields.status?.name ?? '',
      reporter: fields.reporter?.displayName ?? fields.reporter?.emailAddress ?? '',
      assignee: fields.assignee?.displayName ?? fields.assignee?.emailAddress ?? undefined,
      createdDate: new Date(fields.created),
      comments: commentList,
      components,
      labels,
    };
  });
}

/**
 * Updates each bug in Jira with analysis results: posts a comment and updates priority + labels.
 * Uses retry with exponential backoff (max 3 attempts) for NETWORK_ERROR only.
 * Requerimientos: 7.1, 7.2, 7.3, 7.4, 7.5
 */
export async function updateBugWithAnalysis(
  credentials: JiraCredentials,
  updates: BugUpdatePayload[]
): Promise<SyncReport> {
  const updatedKeys: string[] = [];
  const failedUpdates: Array<{ key: string; error: string }> = [];
  const MAX_ATTEMPTS = 3;

  for (const update of updates) {
    const { bugKey, comment, priority, labels } = update;
    let lastError: string | undefined;
    let success = false;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      try {
        // POST comment
        await jiraRequest(
          credentials,
          'POST',
          `/rest/api/3/issue/${bugKey}/comment`,
          {
            body: {
              type: 'doc',
              version: 1,
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: comment }],
                },
              ],
            },
          }
        );

        // PUT priority + labels
        await jiraRequest(
          credentials,
          'PUT',
          `/rest/api/3/issue/${bugKey}`,
          {
            fields: {
              priority: { name: priority },
              labels,
            },
          }
        );

        updatedKeys.push(bugKey);
        success = true;
        break;
      } catch (error: any) {
        lastError = error?.message ?? 'Unknown error';
        // Only retry on NETWORK_ERROR
        if (error?.code !== 'NETWORK_ERROR') {
          break;
        }
        if (attempt < MAX_ATTEMPTS - 1) {
          await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
        }
      }
    }

    if (!success) {
      failedUpdates.push({ key: bugKey, error: lastError ?? 'Unknown error' });
    }
  }

  return {
    totalAttempted: updates.length,
    successCount: updatedKeys.length,
    failedCount: failedUpdates.length,
    updatedKeys,
    failedUpdates,
  };
}

// ---------------------------------------------------------------------------
// Workload Extensions
// ---------------------------------------------------------------------------

import {
  JiraStory,
  SprintInfo,
} from '../core/workload-models';

/**
 * Fetches Story issues from Jira using the provided JQL query.
 * Maps the response to JiraStory[], including changelog for cycle time calculation.
 * Requirements: 1.1, 1.3, 2.5, 9.1, 9.4
 */
export async function fetchStoryIssues(
  credentials: JiraCredentials,
  jql: string
): Promise<JiraStory[]> {
  const fields = 'assignee,summary,status,customfield_10016,sprint,created,resolutiondate,updated,issuetype,parent';

  const response = await jiraRequest(credentials, 'POST', '/rest/api/3/search/jql', {
    jql,
    fields: fields.split(','),
    expand: 'changelog',
    maxResults: 200,
  });
  const issues: any[] = response?.issues ?? [];

  if (issues.length === 0) return [];

  return issues.map((issue: any): JiraStory => {
    const f = issue.fields ?? {};

    // Extract sprint name from sprint field (can be array or object depending on Jira version)
    let sprintName: string | null = null;
    const sprintField = f.sprint ?? f['customfield_10020'];
    if (Array.isArray(sprintField) && sprintField.length > 0) {
      sprintName = sprintField[sprintField.length - 1]?.name ?? null;
    } else if (sprintField && typeof sprintField === 'object') {
      sprintName = sprintField.name ?? null;
    }

    // Extract changelog histories filtered to status field changes
    const histories: any[] = issue.changelog?.histories ?? [];
    const changelog = histories.flatMap((history: any) =>
      (history.items ?? [])
        .filter((item: any) => item.field === 'status')
        .map((item: any) => ({
          field: 'status',
          fromStatus: item.fromString ?? '',
          toStatus: item.toString ?? '',
          changedAt: history.created ?? new Date().toISOString(),
        }))
    );

    return {
      id: issue.id ?? '',
      key: issue.key ?? '',
      summary: f.summary ?? '',
      status: f.status?.name ?? '',
      storyPoints: f.customfield_10016 ?? null,
      issueType: f.issuetype?.name ?? 'Desconocido',
      parentKey: f.parent?.key ?? null,
      assignee: f.assignee
        ? {
            accountId: f.assignee.accountId ?? '',
            displayName: f.assignee.displayName ?? '',
            emailAddress: f.assignee.emailAddress,
          }
        : null,
      sprint: sprintName,
      created: f.created ?? new Date().toISOString(),
      resolutionDate: f.resolutiondate ?? null,
      updated: f.updated ?? new Date().toISOString(),
      changelog,
    };
  });
}

/**
 * Fetches available sprints for a project via the Jira Agile API.
 * Returns [] if no board is found for the project.
 * Requirements: 2.5
 */
export async function fetchProjectSprints(
  credentials: JiraCredentials,
  projectKey: string
): Promise<SprintInfo[]> {
  let boardId: number;

  try {
    const boardResponse = await jiraRequest(
      credentials,
      'GET',
      `/rest/agile/1.0/board?projectKeyOrId=${projectKey}`
    );
    const boards: any[] = boardResponse?.values ?? [];
    if (boards.length === 0) return [];
    boardId = boards[0].id;
  } catch (error: any) {
    if (error.code === 'JIRA_NOT_FOUND') return [];
    throw error;
  }

  const sprintResponse = await jiraRequest(
    credentials,
    'GET',
    `/rest/agile/1.0/board/${boardId}/sprint?state=active,closed,future`
  );

  const sprints: any[] = sprintResponse?.values ?? [];

  return sprints.map((s: any): SprintInfo => ({
    id: s.id,
    name: s.name ?? '',
    state: s.state ?? 'future',
    startDate: s.startDate,
    endDate: s.endDate,
  }));
}

// ---------------------------------------------------------------------------
// Project Listing Extension
// ---------------------------------------------------------------------------

export interface JiraProject {
  id: string;
  key: string;
  name: string;
  projectTypeKey: string;
  avatarUrl?: string;
}

/**
 * Finds a custom field ID by its name (e.g. "Tipo de Iniciativa").
 * Caches the result in memory for the process lifetime.
 */
const _fieldIdCache = new Map<string, string | null>();

async function findCustomFieldId(credentials: JiraCredentials, fieldName: string): Promise<string | null> {
  const cacheKey = `${credentials.baseUrl}:${fieldName}`;
  if (_fieldIdCache.has(cacheKey)) return _fieldIdCache.get(cacheKey)!;

  try {
    const fields: any[] = await jiraRequest(credentials, 'GET', '/rest/api/3/field');
    const match = fields.find((f: any) =>
      (f.name ?? '').toLowerCase() === fieldName.toLowerCase()
    );
    const id = match?.id ?? null;
    _fieldIdCache.set(cacheKey, id);
    return id;
  } catch {
    _fieldIdCache.set(cacheKey, null);
    return null;
  }
}

/**
 * Fetches all accessible Jira projects, optionally filtered by creation year range.
 * Uses /rest/api/3/project/search with pagination.
 */
export async function fetchProjects(
  credentials: JiraCredentials,
  startYear?: number,
  endYear?: number,
  keyPrefix?: string,
  startDate?: string,
  endDate?: string
): Promise<JiraProject[]> {
  const allProjects: JiraProject[] = [];
  let startAt = 0;
  const maxResults = 50;

  while (true) {
    const path = `/rest/api/3/project/search?startAt=${startAt}&maxResults=${maxResults}`;
    const response = await jiraRequest(credentials, 'GET', path);
    const values: any[] = response?.values ?? [];

    for (const p of values) {
      if (keyPrefix) {
        const prefixes = keyPrefix.split(',').map(p => p.trim());
        if (!prefixes.some(pfx => p.key.startsWith(pfx))) continue;
      }
      allProjects.push({
        id: p.id ?? '',
        key: p.key ?? '',
        name: p.name ?? '',
        projectTypeKey: p.projectTypeKey ?? '',
        avatarUrl: p.avatarUrls?.['48x48'],
      });
    }

    if (response?.isLast || values.length < maxResults) break;
    startAt += maxResults;
  }

  return allProjects;
}
