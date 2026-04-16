/**
 * Datadog Findings Analyzer
 *
 * Analiza hallazgos de Datadog usando el LLM para generar sugerencias
 * de resolución expertas. Incluye fallback heurístico si el LLM no
 * está disponible o falla.
 *
 * Requerimientos: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
 */

import { callLLM } from './llm-client';
import {
  DatadogFinding,
  AnalyzedDatadogFinding,
  SuggestedCriticality,
  DatadogMonitor,
  DatadogIncident,
} from './support-agent-models';

const AGENT_LABEL = 'Sugerencia del Agente IA Support';

/**
 * Criticality ordering for comparisons.
 */
export const CRITICALITY_ORDER: Record<SuggestedCriticality, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

// ---------------------------------------------------------------------------
// LLM System Prompt
// ---------------------------------------------------------------------------

function buildSystemPrompt(): string {
  return `Eres un ingeniero SRE/DevOps experto analizando hallazgos de observabilidad de Datadog.
Para cada hallazgo, analiza los datos y retorna un objeto JSON con los siguientes campos:
- suggestedCriticality: uno de "critical", "high", "medium", "low"
- affectedService: el nombre del servicio afectado
- affectedEndpoint: el endpoint o componente específico afectado (si es identificable, sino null)
- resolutionSuggestion: una descripción concisa en español de la causa raíz probable y el enfoque de resolución recomendado
- resolutionSteps: un array de pasos técnicos concretos en español para investigar y resolver el problema (mínimo 1 paso)

Guías de criticidad:
- Monitor en estado Alert → critical o high
- Monitor en estado Warn → medium
- Incidente SEV-1 o SEV-2 → critical
- Incidente SEV-3 o mayor → high o medium
- Log de error con alta frecuencia (>10 en 24h) → high
- Log de error con baja frecuencia → medium o low

IMPORTANTE: Todas las sugerencias y pasos deben estar en ESPAÑOL.
Retorna SOLO JSON válido, sin bloques de código markdown ni texto adicional.`;
}


function buildUserPrompt(finding: DatadogFinding): string {
  const lines: string[] = [
    `Finding Type: ${finding.type}`,
    `Title: ${finding.title}`,
    `Message: ${finding.message}`,
    `Service: ${finding.service || 'unknown'}`,
    `Tags: ${finding.tags.join(', ') || 'none'}`,
    `Timestamp: ${finding.timestamp}`,
  ];

  if (finding.type === 'monitor') {
    const monitor = finding.rawData as DatadogMonitor;
    lines.push(`Monitor State: ${monitor.overallState}`);
    lines.push(`Monitor Type: ${monitor.type}`);
    lines.push(`Query: ${monitor.query}`);
  } else if (finding.type === 'incident') {
    const incident = finding.rawData as DatadogIncident;
    lines.push(`Severity: ${incident.severity}`);
    lines.push(`Status: ${incident.status}`);
    lines.push(`Services: ${incident.services.join(', ')}`);
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// LLM Response Parsing
// ---------------------------------------------------------------------------

interface LLMAnalysisResponse {
  suggestedCriticality: SuggestedCriticality;
  affectedService: string;
  affectedEndpoint?: string | null;
  resolutionSuggestion: string;
  resolutionSteps: string[];
}

const VALID_CRITICALITIES: SuggestedCriticality[] = ['critical', 'high', 'medium', 'low'];

function parseLLMResponse(raw: string): LLMAnalysisResponse | null {
  try {
    // Strip markdown fences if present
    let cleaned = raw.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/```\s*$/, '').trim();
    }

    const parsed = JSON.parse(cleaned);

    // Validate required fields
    if (
      !parsed.suggestedCriticality ||
      !VALID_CRITICALITIES.includes(parsed.suggestedCriticality) ||
      !parsed.resolutionSuggestion ||
      !Array.isArray(parsed.resolutionSteps) ||
      parsed.resolutionSteps.length === 0
    ) {
      return null;
    }

    return {
      suggestedCriticality: parsed.suggestedCriticality,
      affectedService: parsed.affectedService || '',
      affectedEndpoint: parsed.affectedEndpoint || undefined,
      resolutionSuggestion: parsed.resolutionSuggestion,
      resolutionSteps: parsed.resolutionSteps,
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Heuristic Fallback
// ---------------------------------------------------------------------------

/**
 * Assigns criticality based on deterministic mapping rules when LLM is
 * unavailable or returns an unparseable response.
 */
export function heuristicAnalysis(finding: DatadogFinding): AnalyzedDatadogFinding {
  const criticality = heuristicCriticality(finding);
  const service = finding.service || 'unknown';

  let suggestion: string;
  let steps: string[];

  switch (finding.type) {
    case 'monitor': {
      const monitor = finding.rawData as DatadogMonitor;
      suggestion = `El monitor "${monitor.name}" está en estado ${monitor.overallState}. Revisar la query del monitor y las tendencias recientes de métricas.`;
      steps = [
        `Revisar el dashboard del monitor "${monitor.name}" en Datadog`,
        `Analizar la query: ${monitor.query || 'N/A'}`,
        `Investigar despliegues recientes o cambios de configuración en el servicio "${service}"`,
      ];
      break;
    }
    case 'incident': {
      const incident = finding.rawData as DatadogIncident;
      suggestion = `Incidente activo (${incident.severity}): "${incident.title}". Coordinar con el equipo de respuesta a incidentes.`;
      steps = [
        `Revisar la línea de tiempo del incidente en Datadog`,
        `Verificar servicios afectados: ${incident.services.join(', ') || service}`,
        `Coordinar con el comandante del incidente${incident.commanderUser ? ` (${incident.commanderUser})` : ''}`,
      ];
      break;
    }
    default: {
      suggestion = `Log de error detectado en el servicio "${service}". Investigar la causa raíz del error.`;
      steps = [
        `Buscar logs de error relacionados en Datadog con service:${service}`,
        `Revisar logs de aplicación y stack traces del patrón de error`,
        `Revisar cambios recientes en el servicio ${service}`,
      ];
      break;
    }
  }

  return {
    finding,
    suggestedCriticality: criticality,
    affectedService: service,
    resolutionSuggestion: suggestion,
    resolutionSteps: steps,
    label: AGENT_LABEL,
  };
}

/**
 * Determines criticality using the design's mapping rules.
 */
export function heuristicCriticality(finding: DatadogFinding): SuggestedCriticality {
  switch (finding.type) {
    case 'monitor': {
      const monitor = finding.rawData as DatadogMonitor;
      if (monitor.overallState === 'Alert') return 'high';
      if (monitor.overallState === 'Warn') return 'medium';
      return 'medium';
    }
    case 'incident': {
      const incident = finding.rawData as DatadogIncident;
      const sev = incident.severity?.toUpperCase() ?? '';
      if (sev === 'SEV-1' || sev === 'SEV-2') return 'critical';
      return 'high';
    }
    case 'log':
    default:
      return 'medium';
  }
}

// ---------------------------------------------------------------------------
// Main Analysis Function
// ---------------------------------------------------------------------------

/**
 * Analyzes an array of Datadog findings using the LLM for expert analysis.
 * Falls back to heuristic analysis if the LLM is unavailable or fails.
 *
 * Requerimientos: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
 */
export async function analyzeDatadogFindings(
  findings: DatadogFinding[]
): Promise<AnalyzedDatadogFinding[]> {
  const results: AnalyzedDatadogFinding[] = [];

  for (const finding of findings) {
    const analyzed = await analyzeSingleFinding(finding);
    results.push(analyzed);
  }

  return results;
}

async function analyzeSingleFinding(finding: DatadogFinding): Promise<AnalyzedDatadogFinding> {
  // Check if LLM is available (API key configured)
  if (!process.env.LLM_API_KEY) {
    return heuristicAnalysis(finding);
  }

  try {
    const systemPrompt = buildSystemPrompt();
    const userPrompt = buildUserPrompt(finding);
    const rawResponse = await callLLM(systemPrompt, userPrompt);
    const parsed = parseLLMResponse(rawResponse);

    if (!parsed) {
      // LLM returned unparseable response — fallback to heuristic
      return heuristicAnalysis(finding);
    }

    return {
      finding,
      suggestedCriticality: parsed.suggestedCriticality,
      affectedService: parsed.affectedService || finding.service || 'unknown',
      affectedEndpoint: parsed.affectedEndpoint || undefined,
      resolutionSuggestion: parsed.resolutionSuggestion,
      resolutionSteps: parsed.resolutionSteps,
      label: AGENT_LABEL,
    };
  } catch {
    // LLM call failed — fallback to heuristic
    return heuristicAnalysis(finding);
  }
}
