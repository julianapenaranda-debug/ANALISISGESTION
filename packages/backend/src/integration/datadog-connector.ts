/**
 * Datadog Connector
 *
 * Módulo de integración con la API de Datadog.
 * Gestiona autenticación y peticiones genéricas a la API.
 * Usa HTTPS nativo, consistente con jira-connector.ts y service-validators.ts.
 *
 * Requerimientos: 9.1, 9.2, 9.3, 9.4
 */

import https from 'https';
import {
  DatadogLogEntry,
  DatadogMonitor,
  DatadogIncident,
  DatadogFinding,
} from '../core/support-agent-models';

export interface DatadogCredentials {
  apiKey: string;
  appKey: string;
  site: string; // e.g. "datadoghq.com", "datadoghq.eu"
}

export interface DatadogValidationResult {
  valid: boolean;
  error?: string;
}

const NETWORK_ERROR_MESSAGE = 'No se pudo conectar con el servicio. Verifica tu conexión de red.';

/**
 * Checks if an error is a network-level error (connection refused, DNS failure, timeout).
 */
function isNetworkError(error: any): boolean {
  const code = error?.code;
  return code === 'ECONNREFUSED' || code === 'ENOTFOUND' || code === 'ETIMEDOUT';
}

/**
 * Makes an authenticated HTTPS request to the Datadog API.
 *
 * Constructs the base URL as `https://api.{site}` and includes
 * DD-API-KEY and DD-APPLICATION-KEY headers.
 *
 * Requerimientos: 9.2, 9.3
 */
export function datadogRequest(
  credentials: DatadogCredentials,
  method: string,
  path: string,
  body?: any
): Promise<any> {
  return new Promise((resolve, reject) => {
    const hostname = `api.${credentials.site}`;
    const bodyStr = body ? JSON.stringify(body) : '';

    const options: https.RequestOptions = {
      hostname,
      port: 443,
      path,
      method,
      headers: {
        'DD-API-KEY': credentials.apiKey,
        'DD-APPLICATION-KEY': credentials.appKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr).toString() } : {}),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        const statusCode = res.statusCode || 0;
        try {
          const parsed = data ? JSON.parse(data) : {};
          if (statusCode === 403) {
            reject(Object.assign(
              new Error('Credenciales de Datadog inválidas o sin permisos suficientes.'),
              { code: 'DATADOG_PERMISSION_DENIED', statusCode }
            ));
          } else if (statusCode >= 400) {
            const message = parsed?.errors?.[0] || parsed?.message || 'Datadog API error';
            reject(Object.assign(
              new Error(message),
              { code: `DATADOG_ERROR_${statusCode}`, statusCode }
            ));
          } else {
            resolve(parsed);
          }
        } catch {
          if (statusCode >= 400) {
            reject(Object.assign(
              new Error(data || 'Datadog API error'),
              { code: `DATADOG_ERROR_${statusCode}`, statusCode }
            ));
          } else {
            resolve(data);
          }
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

/**
 * Validates Datadog credentials by calling GET /api/v1/validate.
 *
 * Requerimientos: 9.1, 9.4
 */
export async function validateDatadog(credentials: DatadogCredentials): Promise<DatadogValidationResult> {
  try {
    const result = await datadogRequest(credentials, 'GET', '/api/v1/validate');
    if (result?.valid === true) {
      return { valid: true };
    }
    return { valid: false, error: 'Credenciales de Datadog inválidas.' };
  } catch (error: any) {
    if (error?.code === 'DATADOG_PERMISSION_DENIED') {
      return { valid: false, error: error.message };
    }
    if (isNetworkError(error)) {
      return { valid: false, error: NETWORK_ERROR_MESSAGE };
    }
    return { valid: false, error: error?.message || 'Credenciales de Datadog inválidas.' };
  }
}


/**
 * Fetches error logs from Datadog for the last 24 hours.
 * Uses POST /api/v2/logs/events/search with status:error filter.
 *
 * Requerimientos: 1.2
 */
export async function fetchErrorLogs(
  credentials: DatadogCredentials,
  service?: string
): Promise<DatadogLogEntry[]> {
  let query = 'status:error';
  if (service) {
    query += ` service:${service}`;
  }

  const body = {
    filter: {
      query,
      from: 'now-24h',
      to: 'now',
    },
    page: { limit: 50 },
  };

  const response = await datadogRequest(credentials, 'POST', '/api/v2/logs/events/search', body);
  const logs: any[] = response?.data ?? [];

  return logs.map((log: any) => ({
    id: String(log.id ?? ''),
    message: log.attributes?.message ?? '',
    service: log.attributes?.service ?? '',
    status: log.attributes?.status ?? 'error',
    timestamp: log.attributes?.timestamp ?? '',
    host: log.attributes?.host,
    tags: Array.isArray(log.attributes?.tags) ? log.attributes.tags : [],
  }));
}

/**
 * Fetches monitors in Alert or Warn state from Datadog.
 * Uses GET /api/v1/monitor and filters client-side.
 *
 * Requerimientos: 1.3
 */
export async function fetchAlertingMonitors(
  credentials: DatadogCredentials,
  service?: string
): Promise<DatadogMonitor[]> {
  const response = await datadogRequest(credentials, 'GET', '/api/v1/monitor');
  const monitors: any[] = Array.isArray(response) ? response : [];

  const alerting = monitors.filter(
    (m: any) => m.overall_state === 'Alert' || m.overall_state === 'Warn'
  );

  const mapped = alerting.map((m: any): DatadogMonitor => ({
    id: Number(m.id),
    name: m.name ?? '',
    type: m.type ?? '',
    overallState: m.overall_state ?? '',
    message: m.message ?? '',
    tags: Array.isArray(m.tags) ? m.tags : [],
    query: m.query ?? '',
  }));

  if (service) {
    return mapped.filter((m) =>
      m.tags.some((t) => t === `service:${service}`)
    );
  }

  return mapped;
}

/**
 * Fetches active incidents from Datadog.
 * Uses GET /api/v2/incidents with active status filter.
 *
 * Requerimientos: 1.4
 */
export async function fetchActiveIncidents(
  credentials: DatadogCredentials,
  service?: string
): Promise<DatadogIncident[]> {
  const path = '/api/v2/incidents?filter[status]=active';
  const response = await datadogRequest(credentials, 'GET', path);
  const incidents: any[] = response?.data ?? [];

  const mapped = incidents.map((inc: any): DatadogIncident => {
    const attrs = inc.attributes ?? {};
    const services: string[] = [];

    // Extract services from fields or tags
    if (attrs.fields?.services) {
      const svcField = attrs.fields.services;
      if (Array.isArray(svcField.value)) {
        services.push(...svcField.value);
      } else if (typeof svcField.value === 'string') {
        services.push(svcField.value);
      }
    }

    return {
      id: String(inc.id ?? ''),
      title: attrs.title ?? '',
      severity: attrs.severity ?? '',
      status: attrs.status ?? '',
      createdAt: attrs.created ?? '',
      services,
      commanderUser: attrs.commander?.data?.attributes?.name,
    };
  });

  if (service) {
    return mapped.filter((inc) => inc.services.includes(service));
  }

  return mapped;
}

/**
 * Extracts unique service names from monitors and logs.
 *
 * Requerimientos: 2.2
 */
export async function fetchAvailableServices(
  credentials: DatadogCredentials
): Promise<string[]> {
  const [monitors, logs] = await Promise.all([
    fetchAlertingMonitors(credentials),
    fetchErrorLogs(credentials),
  ]);

  const serviceSet = new Set<string>();

  for (const monitor of monitors) {
    for (const tag of monitor.tags) {
      if (tag.startsWith('service:')) {
        const svc = tag.slice('service:'.length);
        if (svc) serviceSet.add(svc);
      }
    }
  }

  for (const log of logs) {
    if (log.service) {
      serviceSet.add(log.service);
    }
  }

  return Array.from(serviceSet).sort();
}

/**
 * Fetches and unifies logs, monitors, and incidents into DatadogFinding[].
 *
 * Requerimientos: 1.2, 1.3, 1.4, 2.5
 */
export async function fetchDatadogFindings(
  credentials: DatadogCredentials,
  service?: string
): Promise<DatadogFinding[]> {
  const [logs, monitors, incidents] = await Promise.all([
    fetchErrorLogs(credentials, service),
    fetchAlertingMonitors(credentials, service),
    fetchActiveIncidents(credentials, service),
  ]);

  const findings: DatadogFinding[] = [];

  for (const log of logs) {
    findings.push({
      id: `log-${log.id}`,
      type: 'log',
      title: log.message.slice(0, 120) || 'Error log',
      message: log.message,
      service: log.service,
      tags: log.tags,
      timestamp: log.timestamp,
      rawData: log,
    });
  }

  for (const monitor of monitors) {
    findings.push({
      id: `monitor-${monitor.id}`,
      type: 'monitor',
      title: monitor.name,
      message: monitor.message,
      service: extractServiceFromTags(monitor.tags),
      tags: monitor.tags,
      timestamp: new Date().toISOString(),
      rawData: monitor,
    });
  }

  for (const incident of incidents) {
    findings.push({
      id: `incident-${incident.id}`,
      type: 'incident',
      title: incident.title,
      message: `Incident ${incident.severity}: ${incident.title}`,
      service: incident.services[0] ?? '',
      tags: [],
      timestamp: incident.createdAt,
      rawData: incident,
    });
  }

  return findings;
}

/**
 * Extracts the service name from a tags array (e.g. "service:web-api" → "web-api").
 */
function extractServiceFromTags(tags: string[]): string {
  for (const tag of tags) {
    if (tag.startsWith('service:')) {
      return tag.slice('service:'.length);
    }
  }
  return '';
}


// ---------------------------------------------------------------------------
// Dashboards
// ---------------------------------------------------------------------------

export interface DatadogDashboard {
  id: string;
  title: string;
  description: string;
  author: string;
  url: string;
  modified: string;
}

/**
 * Fetches the list of dashboards from Datadog.
 * Uses GET /api/v1/dashboard/lists/manual
 * Falls back to GET /api/v1/dashboard if available
 */
export async function fetchDashboards(
  credentials: DatadogCredentials
): Promise<DatadogDashboard[]> {
  // Try the summary endpoint which has broader permissions
  try {
    const response = await datadogRequest(credentials, 'GET', '/api/v1/dashboard?count=300');
    const dashboards: any[] = response?.dashboards ?? [];
    return dashboards.map((d: any): DatadogDashboard => ({
      id: d.id ?? '',
      title: d.title ?? '',
      description: d.description ?? '',
      author: d.author_handle ?? '',
      url: `https://app.${credentials.site}/dashboard/${d.id}`,
      modified: d.modified_at ?? '',
    }));
  } catch {
    // If /api/v1/dashboard fails (permissions), try listing via dashboard lists
    try {
      const listsResponse = await datadogRequest(credentials, 'GET', '/api/v1/dashboard/lists/manual');
      const lists: any[] = listsResponse?.dashboard_lists ?? [];
      const allDashboards: DatadogDashboard[] = [];
      for (const list of lists) {
        if (list.dashboards) {
          for (const d of list.dashboards) {
            allDashboards.push({
              id: d.id ?? '',
              title: d.title ?? '',
              description: '',
              author: d.author?.handle ?? '',
              url: `https://app.${credentials.site}/dashboard/${d.id}`,
              modified: d.modified ?? '',
            });
          }
        }
      }
      return allDashboards;
    } catch {
      return [];
    }
  }
}


/**
 * Fetches dashboard details including widgets and their queries.
 * Uses GET /api/v1/dashboard/:id
 */
export async function fetchDashboardDetail(
  credentials: DatadogCredentials,
  dashboardId: string
): Promise<{ title: string; widgets: Array<{ title: string; type: string; queries: string[] }>; services: string[]; sloIds: string[] }> {
  const response = await datadogRequest(credentials, 'GET', `/api/v1/dashboard/${dashboardId}`);

  const widgets: Array<{ title: string; type: string; queries: string[] }> = [];
  const serviceSet = new Set<string>();
  const sloIdSet = new Set<string>();

  function extractWidgets(widgetList: any[]): void {
    for (const w of widgetList) {
      const def = w.definition ?? {};
      const title = def.title ?? w.id ?? '';
      const type = def.type ?? '';
      const queries: string[] = [];

      // Extract queries from requests
      const requests = def.requests ?? [];
      for (const req of (Array.isArray(requests) ? requests : [requests])) {
        if (req?.q) queries.push(req.q);
        if (req?.queries) {
          for (const q of req.queries) {
            if (q?.query) queries.push(q.query);
            if (q?.search?.query) queries.push(q.search.query);
          }
        }
        if (req?.log_query?.search?.query) queries.push(req.log_query.search.query);
        if (req?.apm_query?.search?.query) queries.push(req.apm_query.search.query);
        if (req?.rum_query?.search?.query) queries.push(req.rum_query.search.query);
      }

      // Extract services from queries
      for (const q of queries) {
        const svcMatch = q.match(/service:([a-zA-Z0-9_.-]+)/g);
        if (svcMatch) {
          for (const m of svcMatch) {
            serviceSet.add(m.replace('service:', ''));
          }
        }
      }

      if (queries.length > 0 || type) {
        widgets.push({ title, type, queries });
      }

      // Extract SLO IDs from slo widgets
      if (def.slo_id) sloIdSet.add(def.slo_id);
      if (type === 'slo') {
        if (def.slo_id) sloIdSet.add(def.slo_id);
      }

      // Recurse into group widgets
      if (def.widgets) extractWidgets(def.widgets);
    }
  }

  if (response?.widgets) extractWidgets(response.widgets);

  return {
    title: response?.title ?? '',
    widgets,
    services: Array.from(serviceSet),
    sloIds: Array.from(sloIdSet),
  };
}


// ---------------------------------------------------------------------------
// SLOs
// ---------------------------------------------------------------------------

export interface DatadogSLO {
  id: string;
  name: string;
  type: string;
  overallStatus: number; // 0-100
  targetSli: number;
  status: string; // 'breached' | 'warning' | 'ok' | 'no_data'
  tags: string[];
  service?: string;
  errorBudgetRemaining: number | null;
}

/**
 * Fetches SLOs from Datadog, optionally filtered by IDs.
 * Uses GET /api/v1/slo
 */
export async function fetchSLOs(
  credentials: DatadogCredentials,
  sloIds?: string[]
): Promise<DatadogSLO[]> {
  let path = '/api/v1/slo';
  if (sloIds && sloIds.length > 0) {
    path += `?ids=${sloIds.join(',')}`;
  }

  const response = await datadogRequest(credentials, 'GET', path);
  const slos: any[] = response?.data ?? [];

  return slos.map((s: any): DatadogSLO => {
    const overallStatus = s.overall_status?.[0]?.sli_value ?? s.overall_status ?? 0;
    const targetSli = s.thresholds?.[0]?.target ?? 99.9;
    const errorBudget = s.overall_status?.[0]?.error_budget_remaining ?? null;

    let status = 'ok';
    if (typeof overallStatus === 'number' && overallStatus < targetSli) {
      status = 'breached';
    } else if (typeof errorBudget === 'number' && errorBudget < 10) {
      status = 'warning';
    }

    // Extract service from tags
    let service: string | undefined;
    const tags: string[] = s.tags ?? [];
    for (const tag of tags) {
      if (tag.startsWith('service:')) {
        service = tag.slice('service:'.length);
        break;
      }
    }

    return {
      id: s.id ?? '',
      name: s.name ?? '',
      type: s.type ?? '',
      overallStatus: typeof overallStatus === 'number' ? overallStatus : 0,
      targetSli,
      status,
      tags,
      service,
      errorBudgetRemaining: typeof errorBudget === 'number' ? errorBudget : null,
    };
  });
}
