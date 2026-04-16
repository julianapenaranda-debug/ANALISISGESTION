/**
 * Support Agent V2 — Datadog-first analysis
 *
 * Orquesta la consulta a Datadog, análisis con LLM, y retorna
 * hallazgos priorizados por criticidad con causa raíz y sugerencia.
 *
 * Requerimientos: 3.1, 3.2, 3.3, 3.4, 3.5, 6.4
 */

import { DatadogCredentials, fetchDatadogFindings } from '../integration/datadog-connector';
import { analyzeDatadogFindings, CRITICALITY_ORDER } from './datadog-findings-analyzer';
import {
  AnalyzedDatadogFinding,
  DatadogFindingType,
  SuggestedCriticality,
} from './support-agent-models';

export interface AnalyzeServicesRequest {
  services: string[];
}

export interface AnalysisMetrics {
  totalFindings: number;
  distributionByType: Record<DatadogFindingType, number>;
  distributionByCriticality: Record<SuggestedCriticality, number>;
}

export interface AnalyzeServicesResponse {
  findings: AnalyzedDatadogFinding[];
  metrics: AnalysisMetrics;
}

/**
 * Analyzes Datadog findings for the given services.
 * Fetches findings for each service, deduplicates, analyzes with LLM,
 * sorts by criticality, and calculates metrics.
 */
export async function analyzeServicesV2(
  credentials: DatadogCredentials,
  request: AnalyzeServicesRequest
): Promise<AnalyzeServicesResponse> {
  // Fetch findings for all services in parallel
  const allFindings = await Promise.all(
    request.services.map(service => fetchDatadogFindings(credentials, service))
  );

  // Flatten and deduplicate by finding id
  const seen = new Set<string>();
  const unique = allFindings.flat().filter(f => {
    if (seen.has(f.id)) return false;
    seen.add(f.id);
    return true;
  });

  // Analyze with LLM (or heuristic fallback)
  const analyzed = await analyzeDatadogFindings(unique);

  // Sort by criticality: critical > high > medium > low
  const sorted = [...analyzed].sort(
    (a, b) => CRITICALITY_ORDER[a.suggestedCriticality] - CRITICALITY_ORDER[b.suggestedCriticality]
  );

  // Calculate metrics
  const metrics = calculateMetrics(sorted);

  return { findings: sorted, metrics };
}

function calculateMetrics(findings: AnalyzedDatadogFinding[]): AnalysisMetrics {
  const distributionByType: Record<DatadogFindingType, number> = { log: 0, monitor: 0, incident: 0 };
  const distributionByCriticality: Record<SuggestedCriticality, number> = { critical: 0, high: 0, medium: 0, low: 0 };

  for (const f of findings) {
    distributionByType[f.finding.type]++;
    distributionByCriticality[f.suggestedCriticality]++;
  }

  return { totalFindings: findings.length, distributionByType, distributionByCriticality };
}


import { fetchDashboardDetail, fetchSLOs } from '../integration/datadog-connector';
import { callLLM } from './llm-client';

export interface DashboardAnalysisResponse {
  dashboardTitle: string;
  services: string[];
  findings: AnalyzedDatadogFinding[];
  metrics: AnalysisMetrics;
  dashboardInsights: string;
  sloStatus: Array<{ name: string; score: number; target: number; status: string; errorBudget: number | null; service?: string }>;
}

/**
 * Analyzes a specific Datadog dashboard: fetches its widgets/queries,
 * identifies services, fetches findings for those services, and generates
 * an expert analysis with LLM.
 */
export async function analyzeDashboardV2(
  credentials: DatadogCredentials,
  dashboardId: string
): Promise<DashboardAnalysisResponse> {
  // 1. Get dashboard details (widgets, queries, services)
  const detail = await fetchDashboardDetail(credentials, dashboardId);

  // 2. Fetch SLOs referenced in the dashboard
  let sloStatus: DashboardAnalysisResponse['sloStatus'] = [];
  try {
    const slos = detail.sloIds.length > 0
      ? await fetchSLOs(credentials, detail.sloIds)
      : await fetchSLOs(credentials);
    sloStatus = slos.map(s => ({
      name: s.name,
      score: s.overallStatus,
      target: s.targetSli,
      status: s.status,
      errorBudget: s.errorBudgetRemaining,
      service: s.service,
    }));
  } catch { /* SLO fetch failed, continue */ }

  // 3. Fetch findings for identified services (or all if none found)
  const servicesToAnalyze = detail.services.length > 0 ? detail.services : undefined;
  let allFindings: import('./support-agent-models').DatadogFinding[] = [];

  if (servicesToAnalyze) {
    const results = await Promise.all(
      servicesToAnalyze.map(svc => fetchDatadogFindings(credentials, svc))
    );
    const seen = new Set<string>();
    allFindings = results.flat().filter(f => {
      if (seen.has(f.id)) return false;
      seen.add(f.id);
      return true;
    });
  } else {
    allFindings = await fetchDatadogFindings(credentials);
  }

  // 3. Analyze findings
  const analyzed = await analyzeDatadogFindings(allFindings);
  const sorted = [...analyzed].sort(
    (a, b) => CRITICALITY_ORDER[a.suggestedCriticality] - CRITICALITY_ORDER[b.suggestedCriticality]
  );

  // 4. Generate dashboard insights with LLM
  let dashboardInsights = '';
  try {
    const widgetSummary = detail.widgets.slice(0, 20).map(w => `- ${w.title} (${w.type}): ${w.queries.join(', ')}`).join('\n');
    const findingSummary = sorted.slice(0, 10).map(f => `- [${f.suggestedCriticality}] ${f.finding.title}: ${f.resolutionSuggestion}`).join('\n');
    const sloSummary = sloStatus.map(s => `- ${s.name}: Score ${s.score}% (target ${s.target}%) - ${s.status.toUpperCase()}${s.errorBudget !== null ? ` - Error budget: ${s.errorBudget.toFixed(1)}%` : ''}${s.service ? ` [${s.service}]` : ''}`).join('\n');
    const breachedSLOs = sloStatus.filter(s => s.status === 'breached');

    const prompt = `Analiza el dashboard "${detail.title}" de Datadog.

SLOs del dashboard (${sloStatus.length} total, ${breachedSLOs.length} BREACHED):
${sloSummary || 'No se encontraron SLOs'}

Widgets del dashboard:
${widgetSummary || 'No se pudieron extraer widgets'}

Hallazgos de observabilidad (${sorted.length} total):
${findingSummary || 'Sin hallazgos de logs/monitores/incidentes'}

Servicios involucrados: ${detail.services.join(', ') || 'No identificados'}

Genera un resumen ejecutivo en español de máximo 300 palabras que incluya:
1. Estado general de salud del dashboard y los SLOs
2. SLOs en BREACHED: para cada uno, explica qué significa, cuál es el impacto y qué debería revisar el equipo técnico
3. Principales riesgos identificados
4. Recomendaciones prioritarias concretas para los desarrolladores (qué revisar, dónde buscar, qué corregir)
5. Priorización: qué resolver primero

Responde solo con el texto del resumen, sin formato JSON.`;

    dashboardInsights = await callLLM(
      'Eres un experto SRE/DevOps analizando dashboards de observabilidad. Responde en español.',
      prompt
    );
  } catch {
    dashboardInsights = `Dashboard "${detail.title}" con ${sorted.length} hallazgos detectados en ${detail.services.length} servicios.`;
  }

  const metrics = calculateMetricsInternal(sorted);

  return {
    dashboardTitle: detail.title,
    services: detail.services,
    findings: sorted,
    metrics,
    dashboardInsights,
    sloStatus,
  };
}

function calculateMetricsInternal(findings: AnalyzedDatadogFinding[]): AnalysisMetrics {
  const distributionByType: Record<import('./support-agent-models').DatadogFindingType, number> = { log: 0, monitor: 0, incident: 0 };
  const distributionByCriticality: Record<import('./support-agent-models').SuggestedCriticality, number> = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const f of findings) {
    distributionByType[f.finding.type]++;
    distributionByCriticality[f.suggestedCriticality]++;
  }
  return { totalFindings: findings.length, distributionByType, distributionByCriticality };
}
