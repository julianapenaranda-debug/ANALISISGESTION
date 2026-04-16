/**
 * Jira Support Analyzer
 *
 * Analiza tickets de error/soporte de un proyecto Jira,
 * los prioriza por severidad y genera análisis experto con LLM.
 *
 * Diseñado para proyectos como MDSB que centralizan tickets de errores.
 */

import { CredentialStore } from '../storage/credential-store';
import { JiraCredentials } from '../integration/jira-connector';
import { callLLM } from './llm-client';
import https from 'https';
import http from 'http';

const credentialStore = new CredentialStore();

export interface JiraSupportTicket {
  key: string;
  summary: string;
  status: string;
  priority: string;
  issueType: string;
  created: string;
  updated: string;
  assignee: string | null;
  reporter: string | null;
  labels: string[];
  description: string;
  components: string[];
  linkedProjects: string[];  // GD keys from issue links
}

export interface AnalyzedTicket {
  ticket: JiraSupportTicket;
  suggestedCriticality: 'critical' | 'high' | 'medium' | 'low';
  rootCauseSuggestion: string;
  resolutionSuggestion: string;
  affectedArea: string;
}

export interface JiraSupportAnalysis {
  projectKey: string;
  totalTickets: number;
  openTickets: number;
  analyzedTickets: AnalyzedTicket[];
  summary: string;
  distributionByPriority: Record<string, number>;
  distributionByStatus: Record<string, number>;
  distributionByType: Record<string, number>;
  distributionByComponent: Record<string, number>;
  distributionByLinkedProject: Record<string, number>;
}


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
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve({}); } });
    });
    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

async function fetchJiraTickets(credentials: JiraCredentials, projectKey: string): Promise<JiraSupportTicket[]> {
  const jql = `project = "${projectKey}" AND status != Done AND status != Cerrado AND status != Resuelto AND status != "Producción" ORDER BY priority ASC, created DESC`;
  const result = await jiraPost(credentials, '/rest/api/3/search/jql', {
    jql,
    fields: ['summary', 'status', 'priority', 'issuetype', 'created', 'updated', 'assignee', 'reporter', 'labels', 'description', 'components', 'issuelinks'],
    maxResults: 100,
  });

  return (result.issues || []).map((issue: any) => {
    const f = issue.fields ?? {};
    let desc = '';
    if (f.description?.content) {
      desc = f.description.content
        .map((block: any) => block.content?.map((c: any) => c.text || '').join('') || '')
        .join('\n')
        .slice(0, 500);
    }
    return {
      key: issue.key,
      summary: f.summary || '',
      status: f.status?.name || '',
      priority: f.priority?.name || 'Medium',
      issueType: f.issuetype?.name || '',
      created: f.created || '',
      updated: f.updated || '',
      assignee: f.assignee?.displayName || null,
      reporter: f.reporter?.displayName || null,
      labels: f.labels || [],
      description: desc,
      components: (f.components || []).map((c: any) => c.name || ''),
      linkedProjects: extractLinkedProjects(f.issuelinks || []),
    };
  });
}

/** Extracts linked project keys (GD-xxx) from issue links */
function extractLinkedProjects(links: any[]): string[] {
  const projects = new Set<string>();
  for (const link of links) {
    const inward = link.inwardIssue?.key;
    const outward = link.outwardIssue?.key;
    if (inward) projects.add(inward.split('-')[0]);
    if (outward) projects.add(outward.split('-')[0]);
  }
  return Array.from(projects);
}

function mapPriority(priority: string): 'critical' | 'high' | 'medium' | 'low' {
  const p = priority.toLowerCase();
  if (p.includes('highest') || p.includes('critical') || p.includes('blocker')) return 'critical';
  if (p.includes('high')) return 'high';
  if (p.includes('low') || p.includes('lowest') || p.includes('trivial')) return 'low';
  return 'medium';
}

export async function analyzeJiraSupport(
  credentialKey: string,
  projectKey: string,
): Promise<JiraSupportAnalysis> {
  const credentials = await credentialStore.retrieve(credentialKey);
  if (!credentials) {
    const err = new Error(`Credentials not found: ${credentialKey}`);
    (err as any).code = 'CREDENTIALS_NOT_FOUND';
    throw err;
  }

  const tickets = await fetchJiraTickets(credentials as unknown as JiraCredentials, projectKey);

  if (tickets.length === 0) {
    return {
      projectKey,
      totalTickets: 0,
      openTickets: 0,
      analyzedTickets: [],
      summary: 'No se encontraron tickets abiertos en este proyecto.',
      distributionByPriority: {},
      distributionByStatus: {},
      distributionByType: {},
      distributionByComponent: {},
      distributionByLinkedProject: {},
    };
  }

  // Distributions
  const byPriority: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  const byType: Record<string, number> = {};
  const byComponent: Record<string, number> = {};
  const byLinkedProject: Record<string, number> = {};
  for (const t of tickets) {
    byPriority[t.priority] = (byPriority[t.priority] || 0) + 1;
    byStatus[t.status] = (byStatus[t.status] || 0) + 1;
    byType[t.issueType] = (byType[t.issueType] || 0) + 1;
    for (const c of t.components) byComponent[c] = (byComponent[c] || 0) + 1;
    for (const p of t.linkedProjects) byLinkedProject[p] = (byLinkedProject[p] || 0) + 1;
    if (t.components.length === 0 && t.linkedProjects.length === 0) {
      byComponent['Sin componente'] = (byComponent['Sin componente'] || 0) + 1;
    }
  }

  // Analyze top 20 tickets with LLM
  const topTickets = tickets.slice(0, 20);
  let analyzedTickets: AnalyzedTicket[] = [];

  try {
    const ticketSummaries = topTickets.map(t =>
      `[${t.key}] Prioridad: ${t.priority} | Tipo: ${t.issueType} | Estado: ${t.status} | Título: ${t.summary} | Descripción: ${t.description.slice(0, 200)}`
    ).join('\n');

    const prompt = `Analiza estos ${topTickets.length} tickets de soporte/errores del proyecto ${projectKey} en Jira:

${ticketSummaries}

Para cada ticket, responde en formato JSON array con esta estructura:
[
  {
    "key": "MDSB-123",
    "criticality": "critical|high|medium|low",
    "rootCause": "Posible causa raíz en español (1-2 oraciones)",
    "resolution": "Sugerencia de resolución en español (1-2 oraciones)",
    "area": "Área afectada (ej: Backend, Frontend, Base de datos, Integración, etc.)"
  }
]

Prioriza por impacto al usuario y urgencia. Responde SOLO con el JSON array, sin texto adicional.`;

    const llmResponse = await callLLM(
      'Eres un experto en soporte técnico y resolución de incidentes. Analiza tickets de Jira y sugiere causa raíz y resolución. Responde en español.',
      prompt
    );

    // Parse LLM response
    const jsonMatch = llmResponse.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      analyzedTickets = topTickets.map(ticket => {
        const analysis = parsed.find((a: any) => a.key === ticket.key);
        return {
          ticket,
          suggestedCriticality: analysis?.criticality || mapPriority(ticket.priority),
          rootCauseSuggestion: analysis?.rootCause || 'Análisis pendiente',
          resolutionSuggestion: analysis?.resolution || 'Revisar manualmente',
          affectedArea: analysis?.area || 'General',
        };
      });
    }
  } catch {
    // Fallback: use priority-based analysis without LLM
    analyzedTickets = topTickets.map(ticket => ({
      ticket,
      suggestedCriticality: mapPriority(ticket.priority),
      rootCauseSuggestion: 'Análisis automático no disponible. Revisar manualmente.',
      resolutionSuggestion: 'Revisar el ticket en Jira para más detalles.',
      affectedArea: 'General',
    }));
  }

  // Sort by criticality
  const order = { critical: 0, high: 1, medium: 2, low: 3 };
  analyzedTickets.sort((a, b) => order[a.suggestedCriticality] - order[b.suggestedCriticality]);

  // Generate summary with LLM
  let summary = '';
  try {
    const summaryPrompt = `Genera un resumen ejecutivo en español (máximo 150 palabras) del estado de soporte del proyecto ${projectKey}:
- ${tickets.length} tickets abiertos
- Distribución por prioridad: ${Object.entries(byPriority).map(([k, v]) => `${k}: ${v}`).join(', ')}
- Distribución por tipo: ${Object.entries(byType).map(([k, v]) => `${k}: ${v}`).join(', ')}
- Top issues: ${analyzedTickets.slice(0, 5).map(a => `[${a.suggestedCriticality}] ${a.ticket.summary}`).join('; ')}

Incluye: estado general, principales riesgos, y qué debería priorizar el equipo.`;

    summary = await callLLM(
      'Eres un Product Owner experto analizando el backlog de soporte. Responde en español.',
      summaryPrompt
    );
  } catch {
    summary = `Proyecto ${projectKey}: ${tickets.length} tickets abiertos. ${byPriority['Highest'] || 0} críticos, ${byPriority['High'] || 0} altos.`;
  }

  return {
    projectKey,
    totalTickets: tickets.length,
    openTickets: tickets.length,
    analyzedTickets,
    summary,
    distributionByPriority: byPriority,
    distributionByStatus: byStatus,
    distributionByType: byType,
    distributionByComponent: byComponent,
    distributionByLinkedProject: byLinkedProject,
  };
}
