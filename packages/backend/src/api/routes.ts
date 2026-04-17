/**
 * API REST Routes
 *
 * Todos los endpoints del backend en un solo archivo.
 * Requerimientos: 1.1-1.5, 2.1-2.5, 5.1-5.6, 6.1-6.5, 7.1-7.6, 9.1-9.5, 11.1-11.5, 12.1-12.6
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { generateStories, detectAmbiguities, refineStory } from '../core/story-generator';
import { assembleEpics } from '../core/epic-assembler';
import { validate } from '../core/invest-validator';
import { analyzeDesign } from '../integration/figma-analyzer';
import {
  authenticate,
  validatePermissions,
  syncToJira,
  exportToJson,
  exportToCsv,
  exportSelected,
  fetchProjects,
  fetchProjectEpics,
  createIssues,
  JiraCredentials,
  filterProjects,
  computeFilterOptions,
  fetchInitiativeContext,
  DEFAULT_INITIATIVE_CONTEXT,
  InitiativeContext,
} from '../integration/jira-connector';
import { analyzeProject, analyzeProjectExtended } from '../integration/project-analyzer';
import { CredentialStore } from '../storage/credential-store';
import { WorkspaceStore } from '../storage/workspace-store';
import { ChangeHistory } from '../storage/change-history';
import { formatErrorResponse } from '../integration/error-handler';
import { analyzeBugs, syncPlanToJira } from '../core/support-agent';
import { exportToMarkdown } from '../core/resolution-plan-generator';
import { analyzeWorkload, getProjectSprints } from '../core/workload-analyzer';
import { analyzeFlowMetrics } from '../core/flow-metrics-analyzer';
import { analyzeJiraSupport } from '../core/jira-support-analyzer';
import { analyzeServicesV2 } from '../core/support-agent-v2';
import { analyzeDashboardV2 } from '../core/support-agent-v2';
import { fetchAvailableServices, DatadogCredentials } from '../integration/datadog-connector';
import { fetchDashboards } from '../integration/datadog-connector';

const router = Router();
const credentialStore = new CredentialStore();
const workspaceStore = new WorkspaceStore();

// ─── Input Validation Schemas ─────────────────────────────────────────────────

const storyGenerateSchema = z.object({
  description: z.string().min(1).max(10000),
  context: z.any().optional(),
  figmaData: z.any().optional(),
  productContext: z.string().max(5000).optional(),
  businessObjective: z.string().max(5000).optional(),
});

const supportV2AnalyzeSchema = z.object({
  services: z.array(z.string().min(1).max(200)).min(1).max(50),
});

const dashboardAnalyzeSchema = z.object({
  dashboardId: z.string().min(1).max(200),
});

const workloadAnalyzeSchema = z.object({
  projectKey: z.string().min(1).max(50),
  credentialKey: z.string().min(1).max(100),
  filters: z.any().optional(),
});

const flowMetricsAnalyzeSchema = z.object({
  projectKey: z.string().min(1).max(50),
  credentialKey: z.string().min(1).max(100),
  filters: z.object({
    sprint: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
  }).optional(),
});

/** Strips HTML tags to prevent stored XSS */
function sanitize(input: string): string {
  return input.replace(/<[^>]*>/g, '');
}

// ─── Story Generator ─────────────────────────────────────────────────────────

// POST /api/stories/generate
router.post('/stories/generate', async (req: Request, res: Response) => {
  try {
    const parsed = storyGenerateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Datos inválidos', details: parsed.error.flatten().fieldErrors });
    }

    const { description, context, figmaData, productContext, businessObjective } = parsed.data;

    // Si viene una figmaUrl, analizarla primero y convertirla en FigmaAnalysisResult
    let resolvedFigmaData = figmaData;
    let figmaWarning: string | undefined;

    if (figmaData?.figmaUrl) {
      const figmaCreds = await credentialStore.retrieve('figma-main');
      if (!figmaCreds) {
        figmaWarning = 'Figma no está conectado. Configura tu token en el Panel de Conexiones.';
        resolvedFigmaData = undefined;
      } else {
        try {
          const accessToken = typeof figmaCreds.accessToken === 'string' ? figmaCreds.accessToken : undefined;
          resolvedFigmaData = await analyzeDesign(figmaData.figmaUrl, accessToken);
        } catch (figmaError: any) {
          if (figmaError.code === 'FIGMA_FORBIDDEN' || figmaError.statusCode === 403) {
            figmaWarning = 'El token de Figma no tiene permisos para acceder a este archivo. Verifica los permisos del token o solicita acceso al archivo.';
          } else if (figmaError.code === 'FIGMA_NOT_FOUND' || figmaError.statusCode === 404) {
            figmaWarning = 'Archivo de Figma no encontrado. Verifica que la URL sea correcta y que el archivo exista.';
          } else if (figmaError.code === 'ECONNREFUSED' || figmaError.code === 'ENOTFOUND' || figmaError.code === 'ETIMEDOUT') {
            figmaWarning = 'No se pudo conectar con Figma. Verifica tu conexión a internet e intenta de nuevo.';
          } else {
            figmaWarning = `Error analizando Figma: ${figmaError.message}`;
          }
          resolvedFigmaData = undefined;
        }
      }
    }

    const result = await generateStories({
      description, context, figmaData: resolvedFigmaData,
      productContext, businessObjective,
    });

    // Use LLM-proposed epics if available, otherwise fallback to assembleEpics
    if (result.stories.length > 0) {
      const epics = result.epics && result.epics.length > 0
        ? result.epics
        : assembleEpics(result.stories);
      return res.json({ ...result, epics, ...(figmaWarning ? { figmaWarning } : {}) });
    }

    return res.json({ ...result, ...(figmaWarning ? { figmaWarning } : {}) });
  } catch (error) {
    return res.status(500).json(formatErrorResponse(error));
  }
});

// PUT /api/stories/:id/refine
router.put('/stories/:id/refine', async (req: Request, res: Response) => {
  try {
    const { story, changes } = req.body;

    if (!story || !changes) {
      return res.status(400).json({ error: 'story and changes are required' });
    }

    const refined = await refineStory(story, changes);
    return res.json(refined);
  } catch (error) {
    return res.status(500).json(formatErrorResponse(error));
  }
});

// POST /api/stories/detect-ambiguities
router.post('/stories/detect-ambiguities', (req: Request, res: Response) => {
  try {
    const { description } = req.body;

    if (!description) {
      return res.status(400).json({ error: 'description is required' });
    }

    const ambiguities = detectAmbiguities(description);
    return res.json({ ambiguities });
  } catch (error) {
    return res.status(500).json(formatErrorResponse(error));
  }
});

// POST /api/stories/validate
router.post('/stories/validate', (req: Request, res: Response) => {
  try {
    const { story } = req.body;

    if (!story) {
      return res.status(400).json({ error: 'story is required' });
    }

    const result = validate(story);
    return res.json(result);
  } catch (error) {
    return res.status(500).json(formatErrorResponse(error));
  }
});

// ─── Figma ────────────────────────────────────────────────────────────────────

// POST /api/figma/analyze
router.post('/figma/analyze', async (req: Request, res: Response) => {
  try {
    const { figmaUrl } = req.body;

    if (!figmaUrl) {
      return res.status(400).json({ error: 'figmaUrl is required' });
    }

    // Retrieve Figma accessToken from CredentialStore if available (Req 8.1)
    let accessToken: string | undefined;
    const figmaCreds = await credentialStore.retrieve('figma-main');
    if (figmaCreds && typeof figmaCreds.accessToken === 'string') {
      accessToken = figmaCreds.accessToken;
    }

    const result = await analyzeDesign(figmaUrl, accessToken);
    return res.json(result);
  } catch (error: any) {
    if (error.message?.includes('Invalid Figma URL')) {
      return res.status(400).json(formatErrorResponse({ code: 'FIGMA_INVALID_URL', message: error.message }));
    }
    return res.status(500).json(formatErrorResponse(error));
  }
});

// ─── Jira ─────────────────────────────────────────────────────────────────────

// POST /api/jira/authenticate
router.post('/jira/authenticate', async (req: Request, res: Response) => {
  try {
    const { credentials, saveAs } = req.body;

    if (!credentials?.baseUrl || !credentials?.email || !credentials?.apiToken) {
      return res.status(400).json({ error: 'credentials.baseUrl, email, and apiToken are required' });
    }

    const result = await authenticate(credentials);

    if (result.success && saveAs) {
      await credentialStore.store(saveAs, credentials);
    }

    return res.json(result);
  } catch (error) {
    return res.status(500).json(formatErrorResponse(error));
  }
});

// POST /api/jira/sync
router.post('/jira/sync', async (req: Request, res: Response) => {
  try {
    const { credentialKey, projectKey, stories, epics } = req.body;

    if (!credentialKey || !projectKey || !stories) {
      return res.status(400).json({ error: 'credentialKey, projectKey, and stories are required' });
    }

    const credentials = await credentialStore.retrieve(credentialKey);
    if (!credentials) {
      return res.status(404).json({ error: `Credentials not found: ${credentialKey}` });
    }

    const result = await syncToJira(credentials as unknown as JiraCredentials, projectKey, stories, epics || []);
    return res.json(result);
  } catch (error) {
    return res.status(500).json(formatErrorResponse(error));
  }
});

// GET /api/jira/projects
// Query: credentialKey (required), startYear?, endYear?, prefix?, tribu?, squad?, anio?
router.get('/jira/projects', async (req: Request, res: Response) => {
  try {
    const credentialKey = req.query.credentialKey as string;
    const startYear = req.query.startYear ? parseInt(req.query.startYear as string) : undefined;
    const endYear = req.query.endYear ? parseInt(req.query.endYear as string) : undefined;
    const prefix = req.query.prefix as string | undefined;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    const tribu = req.query.tribu as string | undefined;
    const squad = req.query.squad as string | undefined;
    const anio = req.query.anio as string | undefined;

    if (!credentialKey) {
      return res.status(400).json({ error: 'credentialKey query param is required' });
    }

    const credentials = await credentialStore.retrieve(credentialKey);
    if (!credentials) {
      return res.status(404).json({ error: `Credentials not found: ${credentialKey}` });
    }

    const projects = await fetchProjects(credentials as unknown as JiraCredentials, startYear, endYear, prefix, startDate, endDate);

    // Compute filter options from the full (unfiltered) list
    const filters = computeFilterOptions(projects);

    // Apply active filters
    const filteredProjects = filterProjects(projects, { tribu, squad, anio });

    return res.json({ projects: filteredProjects, filters });
  } catch (error: any) {
    if (error.code === 'JIRA_AUTH_FAILED') {
      return res.status(401).json({ error: error.message });
    }
    return res.status(500).json(formatErrorResponse(error));
  }
});

// GET /api/jira/projects/:projectKey/epics
// Query: credentialKey (required)
router.get('/jira/projects/:projectKey/epics', async (req: Request, res: Response) => {
  try {
    const { projectKey } = req.params;
    const credentialKey = req.query.credentialKey as string;

    if (!credentialKey) {
      return res.status(400).json({ error: 'credentialKey query param is required' });
    }

    const credentials = await credentialStore.retrieve(credentialKey);
    if (!credentials) {
      return res.status(404).json({ error: `Credentials not found: ${credentialKey}` });
    }

    const epics = await fetchProjectEpics(credentials as unknown as JiraCredentials, projectKey);
    return res.json(epics);
  } catch (error: any) {
    if (error.code === 'JIRA_AUTH_FAILED') {
      return res.status(401).json({ error: error.message });
    }
    if (error.code === 'JIRA_NOT_FOUND') {
      return res.status(404).json({ error: error.message });
    }
    return res.status(500).json(formatErrorResponse(error));
  }
});

// GET /api/jira/validate-permissions/:projectKey
router.get('/jira/validate-permissions/:projectKey', async (req: Request, res: Response) => {
  try {
    const { projectKey } = req.params;
    const credentialKey = req.query.credentialKey as string;

    if (!credentialKey) {
      return res.status(400).json({ error: 'credentialKey query param is required' });
    }

    const credentials = await credentialStore.retrieve(credentialKey);
    if (!credentials) {
      return res.status(404).json({ error: `Credentials not found: ${credentialKey}` });
    }

    const result = await validatePermissions(credentials as unknown as JiraCredentials, projectKey);
    return res.json(result);
  } catch (error) {
    return res.status(500).json(formatErrorResponse(error));
  }
});

// ─── Project Metrics ──────────────────────────────────────────────────────────

// GET /api/projects/:projectKey/metrics
router.get('/projects/:projectKey/metrics', async (req: Request, res: Response) => {
  try {
    const { projectKey } = req.params;
    const credentialKey = req.query.credentialKey as string;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;

    if (!credentialKey) {
      return res.status(400).json({ error: 'credentialKey query param is required' });
    }

    const credentials = await credentialStore.retrieve(credentialKey);
    if (!credentials) {
      return res.status(404).json({ error: `Credentials not found: ${credentialKey}` });
    }

    const metrics = await analyzeProjectExtended(credentials as unknown as JiraCredentials, projectKey, startDate, endDate);
    // Add Jira base URL for deep linking
    const jiraBaseUrl = (credentials as any).baseUrl || '';

    // Fetch initiative context
    let initiativeContext: InitiativeContext;
    try {
      initiativeContext = await fetchInitiativeContext(credentials as unknown as JiraCredentials, projectKey);
    } catch {
      initiativeContext = { ...DEFAULT_INITIATIVE_CONTEXT };
    }

    return res.json({ ...metrics, jiraBaseUrl, initiativeContext });
  } catch (error) {
    return res.status(500).json(formatErrorResponse(error));
  }
});

// ─── Export ───────────────────────────────────────────────────────────────────

// POST /api/export/json
router.post('/export/json', (req: Request, res: Response) => {
  try {
    const { stories, epics, projectKey, storyIds } = req.body;

    if (!stories) {
      return res.status(400).json({ error: 'stories is required' });
    }

    const json = storyIds
      ? exportSelected(storyIds, stories, epics || [], 'json', projectKey)
      : exportToJson(stories, epics || [], projectKey || 'PROJECT');

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="stories.json"');
    return res.send(json);
  } catch (error) {
    return res.status(500).json(formatErrorResponse(error));
  }
});

// POST /api/export/csv
router.post('/export/csv', (req: Request, res: Response) => {
  try {
    const { stories, epics, storyIds } = req.body;

    if (!stories) {
      return res.status(400).json({ error: 'stories is required' });
    }

    const csv = storyIds
      ? exportSelected(storyIds, stories, epics || [], 'csv')
      : exportToCsv(stories, epics || []);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="stories.csv"');
    return res.send(csv);
  } catch (error) {
    return res.status(500).json(formatErrorResponse(error));
  }
});

// ─── Workspaces ───────────────────────────────────────────────────────────────

// GET /api/workspaces
router.get('/workspaces', async (_req: Request, res: Response) => {
  try {
    const workspaces = await workspaceStore.listWorkspaces();
    return res.json(workspaces);
  } catch (error) {
    return res.status(500).json(formatErrorResponse(error));
  }
});

// GET /api/workspaces/:id
router.get('/workspaces/:id', async (req: Request, res: Response) => {
  try {
    const workspace = await workspaceStore.loadWorkspace(req.params.id);
    return res.json(workspace);
  } catch (error: any) {
    if (error.message?.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    return res.status(500).json(formatErrorResponse(error));
  }
});

// POST /api/workspaces
router.post('/workspaces', async (req: Request, res: Response) => {
  try {
    const { id, name, projectKey, stories, epics } = req.body;

    if (!id || !name || !projectKey) {
      return res.status(400).json({ error: 'id, name, and projectKey are required' });
    }

    const workspace = {
      id,
      name,
      projectKey,
      stories: stories || [],
      epics: epics || [],
      metadata: {
        created: new Date(),
        modified: new Date(),
        syncStatus: 'pending' as const,
      },
    };

    await workspaceStore.saveWorkspace(workspace);
    return res.status(201).json(workspace);
  } catch (error) {
    return res.status(500).json(formatErrorResponse(error));
  }
});

// PUT /api/workspaces/:id
router.put('/workspaces/:id', async (req: Request, res: Response) => {
  try {
    const existing = await workspaceStore.loadWorkspace(req.params.id);
    const updated = { ...existing, ...req.body, id: req.params.id };
    await workspaceStore.saveWorkspace(updated);
    return res.json(updated);
  } catch (error: any) {
    if (error.message?.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    return res.status(500).json(formatErrorResponse(error));
  }
});

// ─── Change History ───────────────────────────────────────────────────────────

// GET /api/workspaces/:workspaceId/stories/:storyId/history
router.get('/workspaces/:workspaceId/stories/:storyId/history', async (req: Request, res: Response) => {
  try {
    const history = new ChangeHistory(req.params.workspaceId);
    const changes = await history.getHistory(req.params.storyId);
    return res.json(changes);
  } catch (error) {
    return res.status(500).json(formatErrorResponse(error));
  }
});

// POST /api/workspaces/:workspaceId/stories/:storyId/revert/:changeId
router.post('/workspaces/:workspaceId/stories/:storyId/revert/:changeId', async (req: Request, res: Response) => {
  try {
    const { story } = req.body;
    if (!story) {
      return res.status(400).json({ error: 'story is required' });
    }

    const history = new ChangeHistory(req.params.workspaceId);
    const reverted = await history.revert(req.params.storyId, req.params.changeId, story);
    return res.json(reverted);
  } catch (error: any) {
    if (error.message?.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    return res.status(500).json(formatErrorResponse(error));
  }
});

// ─── Support Agent ────────────────────────────────────────────────────────────

// POST /api/support/analyze
// Body: { projectKey, credentialKey, filters?, includeDatadog?, datadogService? }
router.post('/support/analyze', async (req: Request, res: Response) => {
  try {
    const { projectKey, credentialKey, filters, includeDatadog, datadogService } = req.body;

    if (!projectKey || !credentialKey) {
      return res.status(400).json({ error: 'projectKey and credentialKey are required' });
    }

    const plan = await analyzeBugs({ projectKey, credentialKey, filters, includeDatadog, datadogService });
    return res.json(plan);
  } catch (error: any) {
    if (error.code === 'JIRA_AUTH_FAILED') {
      return res.status(404).json({ error: error.message });
    }
    return res.status(500).json(formatErrorResponse(error));
  }
});

// GET /api/support/plans
// Lists all support plans from WorkspaceStore (keys starting with 'support-plan-')
router.get('/support/plans', async (_req: Request, res: Response) => {
  try {
    const index = await (workspaceStore as any).loadIndex();
    const plans = (index.workspaces as Array<{ id: string; name: string; projectKey: string; created: string; modified: string; syncStatus: string }>)
      .filter((w) => w.id.startsWith('support-plan-'));
    return res.json(plans);
  } catch (error) {
    return res.status(500).json(formatErrorResponse(error));
  }
});

// GET /api/support/plans/:planId
router.get('/support/plans/:planId', async (req: Request, res: Response) => {
  try {
    const { planId } = req.params;
    const raw = await workspaceStore.loadWorkspace(`support-plan-${planId}`);
    const plan = (raw as any).plan;
    if (!plan) {
      return res.status(404).json({ error: `Plan not found: ${planId}` });
    }
    return res.json(plan);
  } catch (error: any) {
    if (error.message?.includes('not found') || error.message?.includes('Workspace not found')) {
      return res.status(404).json({ error: `Plan not found: ${req.params.planId}` });
    }
    return res.status(500).json(formatErrorResponse(error));
  }
});

// POST /api/support/sync
// Body: { planId, credentialKey }
router.post('/support/sync', async (req: Request, res: Response) => {
  try {
    const { planId, credentialKey } = req.body;

    if (!planId || !credentialKey) {
      return res.status(400).json({ error: 'planId and credentialKey are required' });
    }

    const report = await syncPlanToJira(planId, credentialKey);
    return res.json(report);
  } catch (error: any) {
    if (error.code === 'PLAN_NOT_FOUND') {
      return res.status(404).json({ error: error.message });
    }
    if (error.code === 'JIRA_AUTH_FAILED') {
      return res.status(404).json({ error: error.message });
    }
    return res.status(500).json(formatErrorResponse(error));
  }
});

// GET /api/support/plans/:planId/markdown
router.get('/support/plans/:planId/markdown', async (req: Request, res: Response) => {
  try {
    const { planId } = req.params;
    const raw = await workspaceStore.loadWorkspace(`support-plan-${planId}`);
    const plan = (raw as any).plan;
    if (!plan) {
      return res.status(404).json({ error: `Plan not found: ${planId}` });
    }
    const markdown = exportToMarkdown(plan);
    res.setHeader('Content-Type', 'text/markdown');
    res.setHeader('Content-Disposition', `attachment; filename="resolution-plan-${planId}.md"`);
    return res.send(markdown);
  } catch (error: any) {
    if (error.message?.includes('not found') || error.message?.includes('Workspace not found')) {
      return res.status(404).json({ error: `Plan not found: ${req.params.planId}` });
    }
    return res.status(500).json(formatErrorResponse(error));
  }
});

// GET /api/support/datadog/services
router.get('/support/datadog/services', async (_req: Request, res: Response) => {
  try {
    const rawCreds = await credentialStore.retrieve('datadog-main');
    if (!rawCreds) {
      return res.status(404).json({ error: 'Datadog credentials not found. Store credentials with key "datadog-main".' });
    }

    const ddCredentials = rawCreds as unknown as DatadogCredentials;
    const services = await fetchAvailableServices(ddCredentials);
    return res.json({ services });
  } catch (error: any) {
    if (error?.code === 'DATADOG_PERMISSION_DENIED') {
      return res.status(403).json({ error: error.message });
    }
    if (error?.code === 'ECONNREFUSED' || error?.code === 'ENOTFOUND' || error?.code === 'ETIMEDOUT') {
      return res.status(502).json({ error: 'Could not connect to Datadog. Check your network connection.' });
    }
    return res.status(500).json(formatErrorResponse(error));
  }
});

// GET /api/support/datadog/dashboards
router.get('/support/datadog/dashboards', async (_req: Request, res: Response) => {
  try {
    const rawCreds = await credentialStore.retrieve('datadog-main');
    if (!rawCreds) {
      return res.status(404).json({ error: 'Datadog credentials not found.' });
    }
    const ddCreds = rawCreds as unknown as DatadogCredentials;
    const dashboards = await fetchDashboards(ddCreds);
    return res.json({ dashboards });
  } catch (error: any) {
    if (error?.code === 'DATADOG_PERMISSION_DENIED') {
      return res.status(403).json({ error: error.message });
    }
    return res.status(500).json(formatErrorResponse(error));
  }
});

// POST /api/support/datadog/create-issue
// Body: { findingId, projectKey, credentialKey, title, description, severity, component }
router.post('/support/datadog/create-issue', async (req: Request, res: Response) => {
  try {
    const { findingId, projectKey, credentialKey, title, description, severity, component } = req.body;

    if (!findingId || !projectKey || !credentialKey || !title || !description) {
      return res.status(400).json({ error: 'findingId, projectKey, credentialKey, title, and description are required' });
    }

    const credentials = await credentialStore.retrieve(credentialKey);
    if (!credentials) {
      return res.status(404).json({ error: `Credentials not found: ${credentialKey}` });
    }

    const payload = {
      fields: {
        project: { key: projectKey },
        issuetype: { name: 'Bug' },
        summary: title,
        description: {
          type: 'doc',
          version: 1,
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: description }],
            },
          ],
        },
        ...(component ? { components: [{ name: component }] } : {}),
        ...(severity ? { priority: { name: severity } } : {}),
        labels: ['datadog-finding', `finding-${findingId}`],
      },
    };

    const result = await createIssues(
      credentials as unknown as JiraCredentials,
      [{ localId: findingId, payload }]
    );

    if (result.created.length > 0) {
      return res.status(201).json(result.created[0]);
    }

    return res.status(500).json({ error: result.failed[0]?.error || 'Failed to create issue' });
  } catch (error: any) {
    if (error.code === 'JIRA_AUTH_FAILED') {
      return res.status(401).json({ error: error.message });
    }
    if (error.code === 'JIRA_PERMISSION_DENIED') {
      return res.status(403).json({ error: error.message });
    }
    return res.status(500).json(formatErrorResponse(error));
  }
});

// ─── Support Agent V2 (Datadog-first) ─────────────────────────────────────────

// POST /api/support-v2/analyze
router.post('/support-v2/analyze', async (req: Request, res: Response) => {
  try {
    const parsed = supportV2AnalyzeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Se requiere al menos un servicio para analizar.', details: parsed.error.flatten().fieldErrors });
    }

    const { services } = parsed.data;

    const rawCreds = await credentialStore.retrieve('datadog-main');
    if (!rawCreds) {
      return res.status(404).json({ error: 'Credenciales de Datadog no encontradas. Configura Datadog en Conexiones.' });
    }

    const ddCreds = rawCreds as unknown as DatadogCredentials;
    const result = await analyzeServicesV2(ddCreds, { services });
    return res.json(result);
  } catch (error: any) {
    if (error?.code === 'DATADOG_PERMISSION_DENIED') {
      return res.status(403).json({ error: error.message });
    }
    if (error?.code === 'ECONNREFUSED' || error?.code === 'ENOTFOUND' || error?.code === 'ETIMEDOUT') {
      return res.status(502).json({ error: 'No se pudo conectar con Datadog. Verifica tu conexión.' });
    }
    return res.status(500).json(formatErrorResponse(error));
  }
});

// POST /api/support-v2/analyze-dashboard
router.post('/support-v2/analyze-dashboard', async (req: Request, res: Response) => {
  try {
    const parsed = dashboardAnalyzeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'dashboardId es requerido' });
    }

    const { dashboardId } = parsed.data;
    const rawCreds = await credentialStore.retrieve('datadog-main');
    if (!rawCreds) {
      return res.status(404).json({ error: 'Credenciales de Datadog no encontradas.' });
    }
    const ddCreds = rawCreds as unknown as DatadogCredentials;
    const result = await analyzeDashboardV2(ddCreds, dashboardId);
    return res.json(result);
  } catch (error: any) {
    if (error?.code === 'DATADOG_PERMISSION_DENIED') {
      return res.status(403).json({ error: error.message });
    }
    return res.status(500).json(formatErrorResponse(error));
  }
});

// ─── Workload ─────────────────────────────────────────────────────────────────

// POST /api/workload/analyze
// Body: { projectKey, credentialKey, filters? }
router.post('/workload/analyze', async (req: Request, res: Response) => {
  try {
    const parsed = workloadAnalyzeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'projectKey y credentialKey son requeridos', details: parsed.error.flatten().fieldErrors });
    }

    const { projectKey, credentialKey, filters } = parsed.data;

    const report = await analyzeWorkload({ projectKey, credentialKey, filters });

    // Fetch initiative context
    let initiativeContext: InitiativeContext;
    try {
      const credentials = await credentialStore.retrieve(credentialKey);
      if (credentials) {
        initiativeContext = await fetchInitiativeContext(credentials as unknown as JiraCredentials, projectKey);
      } else {
        initiativeContext = { ...DEFAULT_INITIATIVE_CONTEXT };
      }
    } catch {
      initiativeContext = { ...DEFAULT_INITIATIVE_CONTEXT };
    }

    return res.json({ ...report, initiativeContext });
  } catch (error: any) {
    if (error.code === 'CREDENTIALS_NOT_FOUND') {
      return res.status(404).json({ error: error.message });
    }
    if (error.code === 'JIRA_AUTH_FAILED') {
      return res.status(401).json({ error: error.message });
    }
    if (error.code === 'JIRA_NOT_FOUND') {
      return res.status(404).json({ error: error.message });
    }
    if (error.code === 'JIRA_PERMISSION_DENIED') {
      return res.status(403).json({ error: error.message });
    }
    if (error.code === 'NETWORK_ERROR') {
      return res.status(502).json({ error: error.message });
    }
    return res.status(500).json(formatErrorResponse(error));
  }
});

// GET /api/workload/:projectKey/sprints
// Query: credentialKey (required)
router.get('/workload/:projectKey/sprints', async (req: Request, res: Response) => {
  try {
    const { projectKey } = req.params;
    const credentialKey = req.query.credentialKey as string;

    if (!credentialKey) {
      return res.status(400).json({ error: 'credentialKey query param is required' });
    }

    const sprints = await getProjectSprints(projectKey, credentialKey);
    return res.json(sprints);
  } catch (error: any) {
    if (error.code === 'CREDENTIALS_NOT_FOUND') {
      return res.status(404).json({ error: error.message });
    }
    if (error.code === 'JIRA_AUTH_FAILED') {
      return res.status(401).json({ error: error.message });
    }
    if (error.code === 'JIRA_NOT_FOUND') {
      return res.status(404).json({ error: error.message });
    }
    if (error.code === 'JIRA_PERMISSION_DENIED') {
      return res.status(403).json({ error: error.message });
    }
    if (error.code === 'NETWORK_ERROR') {
      return res.status(502).json({ error: error.message });
    }
    return res.status(500).json(formatErrorResponse(error));
  }
});

// ─── Jira Support Analysis ────────────────────────────────────────────────────

// POST /api/support-jira/analyze
// Body: { projectKey, credentialKey }
router.post('/support-jira/analyze', async (req: Request, res: Response) => {
  try {
    const { projectKey, credentialKey } = req.body;
    if (!projectKey || !credentialKey) {
      return res.status(400).json({ error: 'projectKey y credentialKey son requeridos' });
    }
    const result = await analyzeJiraSupport(credentialKey, projectKey);
    return res.json(result);
  } catch (error: any) {
    if (error.code === 'CREDENTIALS_NOT_FOUND') return res.status(404).json({ error: error.message });
    if (error.code === 'JIRA_AUTH_FAILED') return res.status(401).json({ error: error.message });
    return res.status(500).json(formatErrorResponse(error));
  }
});

// ─── Flow Metrics ─────────────────────────────────────────────────────────────

// POST /api/flow-metrics/diagnose
// Body: { metrics (the flow metrics report data) }
router.post('/flow-metrics/diagnose', async (req: Request, res: Response) => {
  try {
    const { metrics } = req.body;
    if (!metrics) return res.status(400).json({ error: 'metrics es requerido' });

    const { callLLM } = await import('../core/llm-client');

    const prompt = `Analiza esta iniciativa "${metrics.projectKey}" con estas métricas:

- Entregas completadas: ${metrics.summary?.throughputTotal || 0}
- Trabajo en curso (WIP): ${metrics.summary?.wipTotal || 0}
- Eficiencia de flujo: ${metrics.summary?.flowEfficiencyAverage ? metrics.summary.flowEfficiencyAverage.toFixed(1) + '%' : 'Sin datos'}
- Tipología: ${metrics.typology?.valueWorkPercent?.toFixed(0) || 0}% trabajo de valor, ${metrics.typology?.supportWorkPercent?.toFixed(0) || 0}% soporte
- Issues estancados: ${metrics.agingIssues?.length || 0}
- Cuellos de botella: ${metrics.bottlenecks?.length || 0}
- Carga cognitiva: ${metrics.cognitiveLoad?.teamFocusScore || 0}% del equipo enfocado
- Desarrolladores en rojo: ${metrics.cognitiveLoad?.developers?.filter((d: any) => d.alertLevel === 'red').length || 0}
- Desarrolladores en amarillo: ${metrics.cognitiveLoad?.developers?.filter((d: any) => d.alertLevel === 'yellow').length || 0}
- Recomendaciones activas: ${metrics.recommendations?.length || 0}

Responde en español con este formato exacto (sin markdown, texto plano):

DIAGNÓSTICO: [máx 2 líneas resumiendo el estado real]

CLASIFICACIÓN: [elegir SOLO una]
🟢 Fluye y genera valor
🟡 Fluye pero con riesgos
🟠 Lenta / con fricciones
🔴 Crítica / bloqueada

DECISIÓN RECOMENDADA: [elegir SOLO una acción principal de esta lista: Continuar igual, Acelerar, Rebalancear equipo, Reducir WIP, Desbloquear dependencias, Dividir iniciativa, Pausar iniciativa, Escalar, Revisar prioridad]

ACCIONES CONCRETAS:
1. [acción específica y ejecutable]
2. [acción específica y ejecutable]
3. [acción específica y ejecutable]

IMPACTO ESPERADO: [1-2 líneas sobre qué mejorará]

URGENCIA: [Alta / Media / Baja]`;

    const systemPrompt = 'Eres un experto en gestión de portafolio de productos digitales y eficiencia de equipos ágiles. NO evalúes personas individuales. Analiza el sistema. Prioriza decisiones sobre explicaciones. Sé directo, claro y accionable. Responde en español.';

    const diagnosis = await callLLM(systemPrompt, prompt);
    return res.json({ diagnosis });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Error generando diagnóstico' });
  }
});

// POST /api/flow-metrics/analyze
// Body: { projectKey, credentialKey, filters? }
router.post('/flow-metrics/analyze', async (req: Request, res: Response) => {
  try {
    const parsed = flowMetricsAnalyzeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'projectKey y credentialKey son requeridos', details: parsed.error.flatten().fieldErrors });
    }

    const { projectKey, credentialKey, filters } = parsed.data;

    const report = await analyzeFlowMetrics({ projectKey, credentialKey, filters });

    // Fetch initiative context
    let initiativeContext: InitiativeContext;
    try {
      const credentials = await credentialStore.retrieve(credentialKey);
      if (credentials) {
        initiativeContext = await fetchInitiativeContext(credentials as unknown as JiraCredentials, projectKey);
      } else {
        initiativeContext = { ...DEFAULT_INITIATIVE_CONTEXT };
      }
    } catch {
      initiativeContext = { ...DEFAULT_INITIATIVE_CONTEXT };
    }

    return res.json({ ...report, initiativeContext });
  } catch (error: any) {
    if (error.code === 'CREDENTIALS_NOT_FOUND') {
      return res.status(404).json({ error: error.message });
    }
    if (error.code === 'JIRA_AUTH_FAILED') {
      return res.status(401).json({ error: error.message });
    }
    if (error.code === 'JIRA_NOT_FOUND') {
      return res.status(404).json({ error: error.message });
    }
    if (error.code === 'JIRA_PERMISSION_DENIED') {
      return res.status(403).json({ error: error.message });
    }
    if (error.code === 'NETWORK_ERROR') {
      return res.status(502).json({ error: error.message });
    }
    return res.status(500).json(formatErrorResponse(error));
  }
});

export default router;
