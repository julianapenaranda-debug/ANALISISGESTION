/**
 * Project Analyzer
 *
 * Analiza métricas de gestión de proyectos desde Jira.
 * Calcula velocidad, cycle time, distribución por status y cuellos de botella.
 *
 * Requerimientos: 7.1-7.6
 */

import { JiraCredentials } from './jira-connector';
import https from 'https';
import http from 'http';

export interface SprintVelocity {
  sprintId: string;
  sprintName: string;
  completedPoints: number;
  committedPoints: number;
}

export interface VelocityData {
  averageStoryPoints: number;
  sprintVelocities: SprintVelocity[];
  trend: 'increasing' | 'stable' | 'decreasing';
}

export interface CycleTimeData {
  averageDays: number;
  median: number;
  percentile90: number;
}

export interface StatusDistribution {
  todo: number;
  inProgress: number;
  done: number;
  blocked: number;
}

export interface BlockedIssue {
  key: string;
  summary: string;
  blockedSince: Date;
  daysBlocked: number;
  issueType?: string;
  assignee?: string;
}

export interface Bottleneck {
  type: 'dependency' | 'resource' | 'blocker';
  affectedIssues: string[];
  description: string;
  severity: 'high' | 'medium' | 'low';
}

export interface ProjectMetrics {
  velocity: VelocityData;
  cycleTime: CycleTimeData;
  distribution: StatusDistribution;
  blockedIssues: BlockedIssue[];
  bottlenecks: Bottleneck[];
  deliveryCompliance: DeliveryCompliance;
  totalIssues: number;
  period: { startDate: string | null; endDate: string | null };
}

export interface DeliveryCompliance {
  totalWithDueDate: number;
  deliveredOnTime: number;
  deliveredLate: number;
  pendingOverdue: number;
  complianceRate: number; // 0-100%
}

/**
 * Realiza una petición a la API de Jira
 */
function jiraGet(credentials: JiraCredentials, path: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const auth = Buffer.from(`${credentials.email}:${credentials.apiToken}`).toString('base64');
    const url = new URL(path, credentials.baseUrl);
    const isHttps = url.protocol === 'https:';
    const lib = isHttps ? https : http;

    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json',
      },
    };

    const req = lib.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve({});
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

/**
 * Realiza una petición POST a la API de Jira
 */
function jiraPost(credentials: JiraCredentials, path: string, body: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const auth = Buffer.from(`${credentials.email}:${credentials.apiToken}`).toString('base64');
    const url = new URL(path, credentials.baseUrl);
    const isHttps = url.protocol === 'https:';
    const lib = isHttps ? https : http;
    const bodyStr = JSON.stringify(body);

    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr).toString(),
      },
    };

    const req = lib.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve({});
        }
      });
    });

    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

/**
 * Extrae issues de Jira usando JQL (nueva API /rest/api/3/search/jql)
 */
export async function extractIssues(
  credentials: JiraCredentials,
  projectKey: string,
  maxResults = 200,
  startDate?: string,
  endDate?: string
): Promise<any[]> {
  let jql = `project = ${projectKey}`;
  if (startDate) jql += ` AND created >= "${startDate}"`;
  if (endDate) jql += ` AND created <= "${endDate}"`;
  jql += ' ORDER BY created DESC';

  const result = await jiraPost(
    credentials,
    '/rest/api/3/search/jql',
    {
      jql,
      fields: ['summary', 'status', 'story_points', 'customfield_10016', 'created', 'resolutiondate', 'issuelinks', 'duedate', 'priority'],
      maxResults,
    }
  );
  return result.issues || [];
}

/**
 * Calcula la velocidad del equipo por sprint
 */
export function calculateVelocity(issues: any[]): VelocityData {
  // Agrupar issues completadas por sprint (simplificado: por semana)
  const weekMap = new Map<string, { completed: number; committed: number }>();

  for (const issue of issues) {
    const status = issue.fields?.status?.name?.toLowerCase() || '';
    const points = issue.fields?.story_points || issue.fields?.customfield_10016 || 1;
    const created = issue.fields?.created ? new Date(issue.fields.created) : new Date();
    const weekKey = getWeekKey(created);

    const week = weekMap.get(weekKey) || { completed: 0, committed: 0 };
    week.committed += points;
    if (status === 'done' || status === 'closed' || status === 'resolved' || status === 'producción' || status === 'hecho') {
      week.completed += points;
    }
    weekMap.set(weekKey, week);
  }

  const sprintVelocities: SprintVelocity[] = Array.from(weekMap.entries()).map(([key, data], i) => ({
    sprintId: `sprint-${i}`,
    sprintName: key,
    completedPoints: data.completed,
    committedPoints: data.committed,
  }));

  const completedPoints = sprintVelocities.map(s => s.completedPoints);
  const averageStoryPoints = completedPoints.length > 0
    ? completedPoints.reduce((a, b) => a + b, 0) / completedPoints.length
    : 0;

  const trend = calculateTrend(completedPoints);

  return { averageStoryPoints, sprintVelocities, trend };
}

function getWeekKey(date: Date): string {
  const year = date.getFullYear();
  const week = Math.ceil(((date.getTime() - new Date(year, 0, 1).getTime()) / 86400000 + 1) / 7);
  return `${year}-W${week.toString().padStart(2, '0')}`;
}

function calculateTrend(values: number[]): 'increasing' | 'stable' | 'decreasing' {
  if (values.length < 2) return 'stable';
  const first = values.slice(0, Math.floor(values.length / 2));
  const second = values.slice(Math.floor(values.length / 2));
  const avgFirst = first.reduce((a, b) => a + b, 0) / first.length;
  const avgSecond = second.reduce((a, b) => a + b, 0) / second.length;
  const diff = avgSecond - avgFirst;
  if (diff > avgFirst * 0.1) return 'increasing';
  if (diff < -avgFirst * 0.1) return 'decreasing';
  return 'stable';
}

/**
 * Calcula el cycle time de issues completadas
 */
export function calculateCycleTime(issues: any[]): CycleTimeData {
  const cycleTimes: number[] = [];

  for (const issue of issues) {
    const status = issue.fields?.status?.name?.toLowerCase() || '';
    if (status !== 'done' && status !== 'closed' && status !== 'resolved' && status !== 'producción' && status !== 'hecho') continue;

    const created = issue.fields?.created ? new Date(issue.fields.created) : null;
    const resolved = issue.fields?.resolutiondate ? new Date(issue.fields.resolutiondate) : null;

    if (created && resolved) {
      const days = (resolved.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
      cycleTimes.push(days);
    }
  }

  if (cycleTimes.length === 0) {
    return { averageDays: 0, median: 0, percentile90: 0 };
  }

  cycleTimes.sort((a, b) => a - b);
  const avg = cycleTimes.reduce((a, b) => a + b, 0) / cycleTimes.length;
  const median = cycleTimes[Math.floor(cycleTimes.length / 2)];
  const p90 = cycleTimes[Math.floor(cycleTimes.length * 0.9)];

  return { averageDays: avg, median, percentile90: p90 };
}

/**
 * Calcula la distribución de issues por status
 */
export function calculateStatusDistribution(issues: any[]): StatusDistribution {
  const dist: StatusDistribution = { todo: 0, inProgress: 0, done: 0, blocked: 0 };

  for (const issue of issues) {
    const status = issue.fields?.status?.name?.toLowerCase() || '';
    if (status === 'to do' || status === 'open' || status === 'backlog' || status === 'por hacer' || status === 'pendiente' || status === 'abierto') {
      dist.todo++;
    } else if (status === 'in progress' || status === 'in review' || status === 'en progreso' || status === 'en pruebas uat' || status === 'pendiente pap' || status === 'en revisión') {
      dist.inProgress++;
    } else if (status === 'done' || status === 'closed' || status === 'resolved' || status === 'producción' || status === 'hecho') {
      dist.done++;
    } else if (status === 'blocked' || status === 'bloqueado') {
      dist.blocked++;
    }
  }

  return dist;
}

/**
 * Identifica issues bloqueadas
 */
export function identifyBlockedIssues(issues: any[]): BlockedIssue[] {
  const blocked: BlockedIssue[] = [];
  const now = new Date();

  for (const issue of issues) {
    const status = issue.fields?.status?.name?.toLowerCase() || '';
    if (status !== 'blocked' && status !== 'bloqueado') continue;

    const created = issue.fields?.created ? new Date(issue.fields.created) : now;
    const daysBlocked = (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);

    blocked.push({
      key: issue.key,
      summary: issue.fields?.summary || '',
      blockedSince: created,
      daysBlocked: Math.floor(daysBlocked),
      issueType: issue.fields?.issuetype?.name || undefined,
      assignee: issue.fields?.assignee?.displayName || undefined,
    });
  }

  return blocked;
}

/**
 * Detecta cuellos de botella en el proyecto
 */
export function detectBottlenecks(issues: any[]): Bottleneck[] {
  const bottlenecks: Bottleneck[] = [];

  // Detectar issues con muchas dependencias
  const dependencyCount = new Map<string, number>();
  for (const issue of issues) {
    const links = issue.fields?.issuelinks || [];
    if (links.length > 3) {
      dependencyCount.set(issue.key, links.length);
    }
  }

  if (dependencyCount.size > 0) {
    const highDep = Array.from(dependencyCount.entries())
      .filter(([, count]) => count > 5)
      .map(([key]) => key);

    if (highDep.length > 0) {
      bottlenecks.push({
        type: 'dependency',
        affectedIssues: highDep,
        description: `${highDep.length} issues tienen más de 5 dependencias`,
        severity: 'high',
      });
    }
  }

  // Detectar acumulación en "In Progress"
  const inProgress = issues.filter(i => {
    const status = i.fields?.status?.name?.toLowerCase() || '';
    return status === 'in progress' || status === 'in review' || status === 'en progreso' || status === 'en pruebas uat' || status === 'pendiente pap' || status === 'en revisión';
  });

  if (inProgress.length > issues.length * 0.4) {
    bottlenecks.push({
      type: 'resource',
      affectedIssues: inProgress.map(i => i.key),
      description: `${inProgress.length} issues están en progreso simultáneamente (${Math.round(inProgress.length / issues.length * 100)}% del total)`,
      severity: inProgress.length > issues.length * 0.6 ? 'high' : 'medium',
    });
  }

  // Detectar issues bloqueadas
  const blocked = issues.filter(i => i.fields?.status?.name?.toLowerCase() === 'blocked');
  if (blocked.length > 0) {
    bottlenecks.push({
      type: 'blocker',
      affectedIssues: blocked.map(i => i.key),
      description: `${blocked.length} issues están bloqueadas`,
      severity: blocked.length > 5 ? 'high' : 'medium',
    });
  }

  return bottlenecks;
}

/**
 * Calcula el cumplimiento de entregables basado en due dates
 */
export function calculateDeliveryCompliance(issues: any[]): DeliveryCompliance {
  const now = new Date();
  let totalWithDueDate = 0;
  let deliveredOnTime = 0;
  let deliveredLate = 0;
  let pendingOverdue = 0;

  for (const issue of issues) {
    const dueDate = issue.fields?.duedate;
    if (!dueDate) continue;

    totalWithDueDate++;
    const due = new Date(dueDate);
    const status = issue.fields?.status?.name?.toLowerCase() || '';
    const isDone = status === 'done' || status === 'closed' || status === 'resolved' || status === 'producción' || status === 'hecho';
    const resolutionDate = issue.fields?.resolutiondate ? new Date(issue.fields.resolutiondate) : null;

    if (isDone && resolutionDate) {
      if (resolutionDate <= due) {
        deliveredOnTime++;
      } else {
        deliveredLate++;
      }
    } else if (!isDone && due < now) {
      pendingOverdue++;
    }
  }

  const complianceRate = totalWithDueDate > 0 ? (deliveredOnTime / totalWithDueDate) * 100 : 0;

  return { totalWithDueDate, deliveredOnTime, deliveredLate, pendingOverdue, complianceRate };
}

/**
 * Analiza un proyecto completo y retorna todas las métricas
 */
export async function analyzeProject(
  credentials: JiraCredentials,
  projectKey: string,
  startDate?: string,
  endDate?: string
): Promise<ProjectMetrics> {
  const issues = await extractIssues(credentials, projectKey, 200, startDate, endDate);

  return {
    velocity: calculateVelocity(issues),
    cycleTime: calculateCycleTime(issues),
    distribution: calculateStatusDistribution(issues),
    blockedIssues: identifyBlockedIssues(issues),
    bottlenecks: detectBottlenecks(issues),
    deliveryCompliance: calculateDeliveryCompliance(issues),
    totalIssues: issues.length,
    period: { startDate: startDate || null, endDate: endDate || null },
  };
}


// ---------------------------------------------------------------------------
// Extended PO Metrics
// ---------------------------------------------------------------------------

export interface QualityMetrics {
  totalBugs: number;
  bugsBySeverity: { critical: number; high: number; medium: number; low: number };
  openBugs: number;
  resolvedBugs: number;
  avgBugResolutionDays: number | null;
  defectRate: number; // bugs / total stories delivered
  reopenedBugs: number;
  unassignedBugs: number;
}

export interface ProductionHealth {
  activeIncidents: number;
  incidentsBySeverity: { critical: number; high: number; medium: number; low: number };
  openProblems: number;
  avgIncidentResolutionDays: number | null;
}

export interface InitiativeProgress {
  totalStories: number;
  completedStories: number;
  inProgressStories: number;
  todoStories: number;
  completionRate: number; // 0-100
  totalStoryPoints: number;
  completedStoryPoints: number;
  storyPointsCompletionRate: number; // 0-100
}

export interface IssueTypeBreakdown {
  type: string;
  total: number;
  open: number;
  done: number;
}

export interface ExtendedProjectMetrics extends ProjectMetrics {
  quality: QualityMetrics;
  production: ProductionHealth;
  progress: InitiativeProgress;
  issueTypeBreakdown: IssueTypeBreakdown[];
}

/**
 * Fetches bugs, incidents and problems for a project.
 */
async function extractBugsAndIncidents(
  credentials: JiraCredentials,
  projectKey: string,
  startDate?: string,
  endDate?: string
): Promise<any[]> {
  // Traer TODOS los tipos de issue para capturar tipos personalizados
  let jql = `project = ${projectKey}`;
  if (startDate) jql += ` AND created >= "${startDate}"`;
  if (endDate) jql += ` AND created <= "${endDate}"`;
  jql += ' ORDER BY created DESC';

  const result = await jiraPost(credentials, '/rest/api/3/search/jql', {
    jql,
    fields: ['summary', 'status', 'priority', 'created', 'resolutiondate', 'issuetype', 'assignee', 'labels'],
    maxResults: 200,
  });
  return result.issues || [];
}

function calculateQualityMetrics(bugs: any[], totalDelivered: number): QualityMetrics {
  const totalBugs = bugs.length;
  const bugsBySeverity = { critical: 0, high: 0, medium: 0, low: 0 };
  let openBugs = 0;
  let resolvedBugs = 0;
  let reopenedBugs = 0;
  let unassignedBugs = 0;
  const resolutionDays: number[] = [];

  for (const bug of bugs) {
    const f = bug.fields ?? {};
    const priority = (f.priority?.name ?? '').toLowerCase();
    if (priority.includes('highest') || priority.includes('critical')) bugsBySeverity.critical++;
    else if (priority.includes('high')) bugsBySeverity.high++;
    else if (priority.includes('low') || priority.includes('lowest')) bugsBySeverity.low++;
    else bugsBySeverity.medium++;

    const status = (f.status?.name ?? '').toLowerCase();
    const isDone = status === 'done' || status === 'closed' || status === 'resolved' || status === 'producción' || status === 'hecho';
    if (isDone) {
      resolvedBugs++;
      if (f.created && f.resolutiondate) {
        const days = (new Date(f.resolutiondate).getTime() - new Date(f.created).getTime()) / (1000 * 60 * 60 * 24);
        if (days >= 0) resolutionDays.push(days);
      }
    } else {
      openBugs++;
    }

    if (!f.assignee) unassignedBugs++;
  }

  return {
    totalBugs,
    bugsBySeverity,
    openBugs,
    resolvedBugs,
    avgBugResolutionDays: resolutionDays.length > 0 ? resolutionDays.reduce((a, b) => a + b, 0) / resolutionDays.length : null,
    defectRate: totalDelivered > 0 ? (totalBugs / totalDelivered) * 100 : 0,
    reopenedBugs,
    unassignedBugs,
  };
}

function calculateProductionHealth(issues: any[]): ProductionHealth {
  const incidents = issues.filter(i => {
    const type = (i.fields?.issuetype?.name ?? '').toLowerCase();
    return type === 'incident' || type.includes('incidente');
  });
  const problems = issues.filter(i => {
    const type = (i.fields?.issuetype?.name ?? '').toLowerCase();
    return type === 'problem' || type.includes('problema');
  });

  const incidentsBySeverity = { critical: 0, high: 0, medium: 0, low: 0 };
  let activeIncidents = 0;
  const resolutionDays: number[] = [];

  for (const inc of incidents) {
    const f = inc.fields ?? {};
    const priority = (f.priority?.name ?? '').toLowerCase();
    if (priority.includes('highest') || priority.includes('critical')) incidentsBySeverity.critical++;
    else if (priority.includes('high')) incidentsBySeverity.high++;
    else if (priority.includes('low') || priority.includes('lowest')) incidentsBySeverity.low++;
    else incidentsBySeverity.medium++;

    const status = (f.status?.name ?? '').toLowerCase();
    const isDone = status === 'done' || status === 'closed' || status === 'resolved' || status === 'producción';
    if (!isDone) activeIncidents++;
    if (isDone && f.created && f.resolutiondate) {
      const days = (new Date(f.resolutiondate).getTime() - new Date(f.created).getTime()) / (1000 * 60 * 60 * 24);
      if (days >= 0) resolutionDays.push(days);
    }
  }

  const openProblems = problems.filter(p => {
    const status = (p.fields?.status?.name ?? '').toLowerCase();
    return status !== 'done' && status !== 'closed' && status !== 'resolved' && status !== 'producción';
  }).length;

  return {
    activeIncidents,
    incidentsBySeverity,
    openProblems,
    avgIncidentResolutionDays: resolutionDays.length > 0 ? resolutionDays.reduce((a, b) => a + b, 0) / resolutionDays.length : null,
  };
}

function calculateInitiativeProgress(stories: any[]): InitiativeProgress {
  let completed = 0, inProgress = 0, todo = 0;
  let totalSP = 0, completedSP = 0;

  for (const issue of stories) {
    const f = issue.fields ?? {};
    const status = (f.status?.name ?? '').toLowerCase();
    const sp = f.customfield_10016 ?? f.story_points ?? 0;
    totalSP += sp;

    if (status === 'done' || status === 'closed' || status === 'resolved' || status === 'producción' || status === 'hecho') {
      completed++;
      completedSP += sp;
    } else if (status === 'in progress' || status === 'en progreso' || status === 'en pruebas uat' || status === 'pendiente pap' || status === 'en revisión') {
      inProgress++;
    } else {
      todo++;
    }
  }

  const total = stories.length;
  return {
    totalStories: total,
    completedStories: completed,
    inProgressStories: inProgress,
    todoStories: todo,
    completionRate: total > 0 ? (completed / total) * 100 : 0,
    totalStoryPoints: totalSP,
    completedStoryPoints: completedSP,
    storyPointsCompletionRate: totalSP > 0 ? (completedSP / totalSP) * 100 : 0,
  };
}

/**
 * Extended project analysis with quality, production health, and initiative progress.
 */
export async function analyzeProjectExtended(
  credentials: JiraCredentials,
  projectKey: string,
  startDate?: string,
  endDate?: string
): Promise<ExtendedProjectMetrics> {
  const [stories, allIssues] = await Promise.all([
    extractIssues(credentials, projectKey, 200, startDate, endDate),
    extractBugsAndIncidents(credentials, projectKey, startDate, endDate),
  ]);

  // Classify by issue type
  const BUG_TYPES = ['bug', 'error productivo', 'defecto', 'defect', 'error'];
  const INCIDENT_TYPES = ['incident', 'incidente', 'incidente de seguridad y monitoreo'];
  const PROBLEM_TYPES = ['problem', 'problema', 'pqr'];
  const WORK_TYPES = ['historia', 'story', 'spike', 'upstream', 'requerimiento caja', 'task', 'tarea'];

  const bugs = allIssues.filter(i => {
    const type = (i.fields?.issuetype?.name ?? '').toLowerCase();
    return BUG_TYPES.some(bt => type.includes(bt));
  });

  const incidentsAndProblems = allIssues.filter(i => {
    const type = (i.fields?.issuetype?.name ?? '').toLowerCase();
    return INCIDENT_TYPES.some(it => type.includes(it)) || PROBLEM_TYPES.some(pt => type.includes(pt));
  });

  // Issue type breakdown
  const typeMap = new Map<string, { total: number; open: number; done: number }>();
  for (const issue of allIssues) {
    const typeName = issue.fields?.issuetype?.name ?? 'Desconocido';
    const entry = typeMap.get(typeName) || { total: 0, open: 0, done: 0 };
    entry.total++;
    const status = (issue.fields?.status?.name ?? '').toLowerCase();
    const isDone = status === 'done' || status === 'closed' || status === 'resolved' || status === 'producción' || status === 'hecho';
    if (isDone) entry.done++; else entry.open++;
    typeMap.set(typeName, entry);
  }
  const issueTypeBreakdown: IssueTypeBreakdown[] = Array.from(typeMap.entries())
    .map(([type, data]) => ({ type, ...data }))
    .sort((a, b) => b.total - a.total);

  const progress = calculateInitiativeProgress(stories);

  // Use allIssues for blocked/distribution so we catch all issue types (not just stories)
  const blockedFromAll = identifyBlockedIssues(allIssues);
  const distributionFromAll = calculateStatusDistribution(allIssues);

  return {
    velocity: calculateVelocity(stories),
    cycleTime: calculateCycleTime(stories),
    distribution: distributionFromAll,
    blockedIssues: blockedFromAll,
    bottlenecks: detectBottlenecks(allIssues),
    deliveryCompliance: calculateDeliveryCompliance(allIssues),
    totalIssues: allIssues.length,
    period: { startDate: startDate || null, endDate: endDate || null },
    quality: calculateQualityMetrics(bugs, progress.completedStories),
    production: calculateProductionHealth(incidentsAndProblems),
    progress,
    issueTypeBreakdown,
  };
}
