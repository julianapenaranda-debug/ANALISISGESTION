import { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { apiClient } from '../api/client';

// ---------------------------------------------------------------------------
// Types (mirrors backend FlowMetricsReport)
// ---------------------------------------------------------------------------

type ViewState = 'idle' | 'loading' | 'report';

interface FlowMetricsSummary {
  leadTimeAverage: number | null;
  cycleTimeAverage: number | null;
  throughputTotal: number;
  wipTotal: number;
  flowEfficiencyAverage: number | null;
}

interface ThroughputByType { issueType: string; count: number; }
interface DeveloperWIP { accountId: string; displayName: string; wipCount: number; }
interface TypologyBreakdown { valueWorkCount: number; supportWorkCount: number; valueWorkPercent: number; supportWorkPercent: number; }
interface Bottleneck { status: string; percentageOfCycleTime: number; message: string; }
interface AgingIssue { issueKey: string; summary: string; currentStatus: string; daysInStatus: number; averageDaysForStatus: number; }
interface FlowRecommendation { type: string; message: string; }

interface CFDDataPoint { date: string; statuses: Record<string, number>; }
interface CFDData { dataPoints: CFDDataPoint[]; statuses: string[]; }
interface ScopeCreepData { totalIssues: number; plannedIssues: number; unplannedIssues: number; scopeCreepPercent: number; unplannedByType: Array<{ issueType: string; count: number }>; }

type CognitiveAlertLevel = 'green' | 'yellow' | 'red';
interface DeveloperCognitiveLoad { accountId: string; displayName: string; activeSubtasks: number; activeHUs: number; focusFactor: number; alertLevel: CognitiveAlertLevel; alertMessage: string; oversizedHUs: string[]; }
interface CognitiveLoadSummary { developers: DeveloperCognitiveLoad[]; oversizedHUs: Array<{ key: string; summary: string; subtaskCount: number }>; teamFocusScore: number; }

interface FlowMetricsReport {
  projectKey: string;
  generatedAt: string;
  filters: { sprint?: string; startDate?: string; endDate?: string };
  summary: FlowMetricsSummary;
  throughputByType: ThroughputByType[];
  wipByDeveloper: DeveloperWIP[];
  typology: TypologyBreakdown;
  bottlenecks: Bottleneck[];
  agingIssues: AgingIssue[];
  recommendations: FlowRecommendation[];
  cognitiveLoad?: CognitiveLoadSummary;
  cfd?: CFDData;
  scopeCreep?: ScopeCreepData;
}

// ---------------------------------------------------------------------------
// Helper sub-components
// ---------------------------------------------------------------------------

function Spinner({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <div className="w-10 h-10 border-4 border-primary-light border-t-primary rounded-full animate-spin" />
      <p className="text-sm text-gray-600">{label}</p>
    </div>
  );
}


function TypologyBar({ typology }: { typology: TypologyBreakdown }) {
  const total = typology.valueWorkCount + typology.supportWorkCount;
  if (total === 0) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Tipología de Trabajo</h3>
      <div className="w-full h-6 rounded-full overflow-hidden flex">
        {typology.valueWorkPercent > 0 && (
          <div className="bg-green-500 h-full flex items-center justify-center text-xs text-white font-medium" style={{ width: typology.valueWorkPercent + '%' }}>
            {typology.valueWorkPercent.toFixed(0)}%
          </div>
        )}
        {typology.supportWorkPercent > 0 && (
          <div className="bg-red-500 h-full flex items-center justify-center text-xs text-white font-medium" style={{ width: typology.supportWorkPercent + '%' }}>
            {typology.supportWorkPercent.toFixed(0)}%
          </div>
        )}
      </div>
      <div className="flex justify-between mt-2 text-xs text-gray-600">
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" /> Trabajo de Valor: {typology.valueWorkCount} ({typology.valueWorkPercent.toFixed(0)}%)</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" /> Trabajo de Soporte: {typology.supportWorkCount} ({typology.supportWorkPercent.toFixed(0)}%)</span>
      </div>
    </div>
  );
}

function ThroughputTable({ data }: { data: ThroughputByType[] }) {
  if (data.length === 0) return null;
  const sorted = [...data].sort((a, b) => b.count - a.count);
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Entregas por Tipo</h3>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
            <tr>
              <th className="px-3 py-2 text-left">Tipo</th>
              <th className="px-3 py-2 text-center">Cantidad</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sorted.map((t) => (
              <tr key={t.issueType}>
                <td className="px-3 py-2 font-medium text-gray-900">{t.issueType}</td>
                <td className="px-3 py-2 text-center text-gray-700">{t.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function WIPTable({ data }: { data: DeveloperWIP[] }) {
  if (data.length === 0) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Trabajo en Curso por Desarrollador</h3>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
            <tr>
              <th className="px-3 py-2 text-left">Desarrollador</th>
              <th className="px-3 py-2 text-center">En Curso</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.map((d) => (
              <tr key={d.accountId} className={d.wipCount > 3 ? 'bg-red-50' : ''}>
                <td className="px-3 py-2 font-medium text-gray-900">{d.displayName}</td>
                <td className="px-3 py-2 text-center">
                  <span className={d.wipCount > 3 ? 'text-red-600 font-bold' : 'text-gray-700'}>{d.wipCount}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BottlenecksSection({ bottlenecks }: { bottlenecks: Bottleneck[] }) {
  if (bottlenecks.length === 0) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Cuellos de Botella</h3>
      <div className="space-y-2">
        {bottlenecks.map((b, i) => (
          <div key={i} className={`rounded-lg p-3 text-sm border ${b.percentageOfCycleTime > 60 ? 'bg-red-50 border-red-200 text-red-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold">{b.status}</span>
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-white/60">{b.percentageOfCycleTime.toFixed(0)}% del Tiempo de Ciclo</span>
            </div>
            <p>{b.message}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function AgingIssuesSection({ issues, jiraBaseUrl }: { issues: AgingIssue[]; jiraBaseUrl?: string }) {
  if (issues.length === 0) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Issues Estancados</h3>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
            <tr>
              <th className="px-3 py-2 text-left">Issue</th>
              <th className="px-3 py-2 text-left">Resumen</th>
              <th className="px-3 py-2 text-center">Estado Actual</th>
              <th className="px-3 py-2 text-center">Días en Estado</th>
              <th className="px-3 py-2 text-center">Promedio</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {issues.map((issue) => {
              const isHighlighted = issue.daysInStatus > issue.averageDaysForStatus * 1.5;
              return (
                <tr key={issue.issueKey} className={isHighlighted ? 'bg-red-50' : ''}>
                  <td className="px-3 py-2">
                    {jiraBaseUrl ? (
                      <a href={`${jiraBaseUrl}/browse/${issue.issueKey}`} target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline">{issue.issueKey}</a>
                    ) : (
                      <span className="font-medium text-gray-900">{issue.issueKey}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-gray-700 max-w-xs truncate">{issue.summary}</td>
                  <td className="px-3 py-2 text-center text-gray-700">{issue.currentStatus}</td>
                  <td className="px-3 py-2 text-center">
                    <span className={isHighlighted ? 'text-red-600 font-bold' : 'text-gray-700'}>{issue.daysInStatus.toFixed(1)}</span>
                  </td>
                  <td className="px-3 py-2 text-center text-gray-500">{issue.averageDaysForStatus.toFixed(1)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const RECOMMENDATION_ICONS: Record<string, string> = {
  support_work_high: '⚠️',
  wait_time_high: '⏳',
  wip_high: '🔴',
  cognitive_overload: '🧠',
  context_switching: '🔄',
  oversized_hu: '📐',
};

function RecommendationsSection({ recommendations }: { recommendations: FlowRecommendation[] }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Recomendaciones</h3>
      {recommendations.length === 0 ? (
        <p className="text-sm text-gray-500">Sin observaciones relevantes.</p>
      ) : (
        <div className="space-y-2">
          {recommendations.map((r, i) => (
            <div key={i} className="rounded-lg p-3 text-sm bg-primary/5 border border-primary/20 text-gray-800 flex items-start gap-2">
              <span className="text-base shrink-0">{RECOMMENDATION_ICONS[r.type] || '💡'}</span>
              <p>{r.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const STATUS_COLORS: Record<string, string> = {
  'Por Hacer': '#9CA3AF', 'To Do': '#9CA3AF', 'Backlog': '#9CA3AF', 'Abierto': '#9CA3AF',
  'En Progreso': '#F59E0B', 'In Progress': '#F59E0B',
  'En Pruebas UAT': '#8B5CF6', 'En Revisión': '#6366F1',
  'Bloqueado': '#EF4444', 'Blocked': '#EF4444', 'Pendiente PAP': '#F97316',
  'Done': '#10B981', 'Producción': '#10B981', 'Hecho': '#10B981', 'Cerrado': '#10B981',
};

function CFDChart({ data }: { data: CFDData }) {
  if (data.dataPoints.length === 0) return null;

  // Sample data points to max 30 for readability
  const points = data.dataPoints.length > 30
    ? data.dataPoints.filter((_, i) => i % Math.ceil(data.dataPoints.length / 30) === 0 || i === data.dataPoints.length - 1)
    : data.dataPoints;

  const maxTotal = Math.max(...points.map(p => Object.values(p.statuses).reduce((a, b) => a + b, 0)), 1);

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-1">Diagrama de Flujo Acumulado (CFD)</h3>
      <p className="text-xs text-gray-400 mb-3">Si las bandas se ensanchan, la carga supera la capacidad de salida del equipo.</p>
      <div className="overflow-x-auto">
        <div className="flex items-end gap-px" style={{ minWidth: points.length * 16, height: 180 }}>
          {points.map((point, i) => {
            const total = Object.values(point.statuses).reduce((a, b) => a + b, 0);
            return (
              <div key={i} className="flex flex-col-reverse flex-1 group relative" style={{ height: '100%' }}>
                {data.statuses.map((status) => {
                  const count = point.statuses[status] || 0;
                  const pct = total > 0 ? (count / maxTotal) * 100 : 0;
                  const color = STATUS_COLORS[status] || '#D1D5DB';
                  return (
                    <div key={status} style={{ height: pct + '%', backgroundColor: color, minHeight: count > 0 ? 2 : 0 }} />
                  );
                })}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-10 bg-gray-900 text-white text-xs rounded p-1.5 whitespace-nowrap">
                  {point.date.slice(5)}
                  {data.statuses.map(s => point.statuses[s] > 0 ? ` · ${s}: ${point.statuses[s]}` : '').join('')}
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>{points[0]?.date.slice(5)}</span>
          <span>{points[points.length - 1]?.date.slice(5)}</span>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 mt-3">
        {data.statuses.map(s => (
          <span key={s} className="flex items-center gap-1 text-xs text-gray-600">
            <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: STATUS_COLORS[s] || '#D1D5DB' }} />
            {s}
          </span>
        ))}
      </div>
    </div>
  );
}

function ScopeCreepSection({ data }: { data: ScopeCreepData }) {
  if (data.totalIssues === 0 || data.unplannedIssues === 0) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-1">Scope Creep (Trabajo No Planificado)</h3>
      <p className="text-xs text-gray-400 mb-3">Issues que entraron después del inicio de la iteración. Cada ticket nuevo resta capacidad lineal al equipo.</p>
      <div className="grid grid-cols-3 gap-3 mb-3">
        <div className="text-center">
          <p className="text-xl font-bold text-gray-900">{data.totalIssues}</p>
          <p className="text-xs text-gray-500">Total</p>
        </div>
        <div className="text-center">
          <p className="text-xl font-bold text-green-600">{data.plannedIssues}</p>
          <p className="text-xs text-gray-500">Planificados</p>
        </div>
        <div className="text-center">
          <p className="text-xl font-bold text-red-600">{data.unplannedIssues}</p>
          <p className="text-xs text-gray-500">No planificados ({data.scopeCreepPercent.toFixed(0)}%)</p>
        </div>
      </div>
      <div className="w-full h-4 rounded-full overflow-hidden flex bg-gray-100">
        <div className="bg-green-500 h-full" style={{ width: (100 - data.scopeCreepPercent) + '%' }} />
        <div className="bg-red-500 h-full" style={{ width: data.scopeCreepPercent + '%' }} />
      </div>
      {data.unplannedByType.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-medium text-gray-600 mb-1">No planificados por tipo:</p>
          <div className="flex flex-wrap gap-1">
            {data.unplannedByType.map(t => (
              <span key={t.issueType} className="text-xs bg-red-50 text-red-700 px-2 py-0.5 rounded-full">{t.issueType}: {t.count}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const ALERT_BG: Record<CognitiveAlertLevel, string> = {
  green: 'bg-green-50 border-green-200',
  yellow: 'bg-yellow-50 border-yellow-200',
  red: 'bg-red-50 border-red-200',
};
const ALERT_TEXT: Record<CognitiveAlertLevel, string> = {
  green: 'text-green-800',
  yellow: 'text-yellow-800',
  red: 'text-red-800',
};
const ALERT_BADGE: Record<CognitiveAlertLevel, string> = {
  green: 'bg-green-100 text-green-700',
  yellow: 'bg-yellow-100 text-yellow-700',
  red: 'bg-red-100 text-red-700',
};
const ALERT_LABEL: Record<CognitiveAlertLevel, string> = {
  green: 'En Foco',
  yellow: 'Multitarea',
  red: 'Sobrecarga',
};

function CognitiveLoadSection({ data }: { data: CognitiveLoadSummary }) {
  if (data.developers.length === 0) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">Carga Cognitiva por Desarrollador</h3>
        <span className="text-xs text-gray-500">Puntuación de Enfoque: <span className="font-bold text-primary">{data.teamFocusScore}%</span></span>
      </div>
      <p className="text-xs text-gray-400 mb-3">Ley de Little: Tiempo de Ciclo = Trabajo en Curso / Entregas. Más tareas activas = mayor tiempo de entrega.</p>
      <div className="space-y-2">
        {data.developers.map((dev) => (
          <div key={dev.accountId} className={`rounded-lg p-3 border ${ALERT_BG[dev.alertLevel]}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ALERT_BADGE[dev.alertLevel]}`}>{ALERT_LABEL[dev.alertLevel]}</span>
                <span className="text-sm font-medium text-gray-900">{dev.displayName}</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-600">
                <span>Sub-tareas: <span className="font-bold">{dev.activeSubtasks}</span></span>
                <span>HUs: <span className="font-bold">{dev.activeHUs}</span></span>
                <span className="relative group cursor-help">Focus: <span className="font-bold">{dev.focusFactor}</span> <span className="text-gray-300">ⓘ</span>
                  <span className="absolute z-10 bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 p-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg hidden group-hover:block">
                    Focus = Sub-tareas activas / HUs relacionadas. Un valor cercano a 1 indica enfoque en una sola HU. Valores altos indican context switching entre múltiples HUs, lo que puede reducir la productividad hasta un 40%.
                    <span className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900 rotate-45 -mt-1" />
                  </span>
                </span>
              </div>
            </div>
            <p className={`text-xs mt-1 ${ALERT_TEXT[dev.alertLevel]}`}>{dev.alertMessage}</p>
          </div>
        ))}
      </div>
      {data.oversizedHUs.length > 0 && (
        <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-xs font-semibold text-amber-800 mb-1">📐 HUs con refinamiento deficiente (&gt;8 sub-tareas)</p>
          {data.oversizedHUs.map((hu) => (
            <p key={hu.key} className="text-xs text-amber-700">{hu.key}: {hu.summary} ({hu.subtaskCount} sub-tareas)</p>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function FlowMetricsView() {
  const { jiraCredentialKey, selectedProjectKey, connections, setCurrentView } = useAppStore();

  const [viewState, setViewState] = useState<ViewState>('idle');
  const [sprint, setSprint] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [report, setReport] = useState<FlowMetricsReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [diagnosis, setDiagnosis] = useState<string | null>(null);
  const [diagnosisLoading, setDiagnosisLoading] = useState(false);

  const isConnected = connections.jira === 'connected';

  const handleAnalyze = async () => {
    if (!selectedProjectKey) return;
    setError(null);
    setViewState('loading');
    try {
      const filters: Record<string, string> = {};
      if (sprint.trim()) filters.sprint = sprint.trim();
      if (startDate) filters.startDate = startDate;
      if (endDate) filters.endDate = endDate;

      const result = await apiClient.post<FlowMetricsReport>('/flow-metrics/analyze', {
        projectKey: selectedProjectKey,
        credentialKey: jiraCredentialKey,
        ...(Object.keys(filters).length > 0 && { filters }),
      });

      setReport(result);
      setViewState('report');
    } catch (err: any) {
      const msg = typeof err.message === 'string' ? err.message : 'Error al analizar métricas de flujo';
      setError(msg);
      setViewState('idle');
    }
  };

  const handleReset = () => {
    setReport(null);
    setError(null);
    setSprint('');
    setStartDate('');
    setEndDate('');
    setViewState('idle');
  };

  // ── Jira not connected ──────────────────────────────────────────────────
  if (!isConnected) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-1">Métricas de Flujo</h2>
          <p className="text-sm text-gray-500">Se requiere conexión con Jira para acceder a esta vista.</p>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-3">
          <p className="text-sm text-amber-800">
            Se requiere conexión con Jira. Configura tus credenciales desde el Panel de Conexiones.
          </p>
          <button
            onClick={() => setCurrentView('connections')}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary-dark hover:underline"
          >
            Ir al Panel de Conexiones &rarr;
          </button>
        </div>
      </div>
    );
  }

  // ── No project selected ─────────────────────────────────────────────────
  if (!selectedProjectKey) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center space-y-4">
        <p className="text-4xl">🔗</p>
        <p className="text-gray-700 font-medium">Primero selecciona un proyecto en Jira</p>
        <p className="text-sm text-gray-500">Ve a la pestaña Jira, conecta tu cuenta y selecciona un proyecto.</p>
        <button
          onClick={() => setCurrentView('jira')}
          className="mt-2 bg-primary text-white py-2 px-6 rounded-lg text-sm font-medium hover:bg-primary-dark transition-colors"
        >
          Ir a Jira
        </button>
      </div>
    );
  }

  // ── Idle ─────────────────────────────────────────────────────────────────
  if (viewState === 'idle') {
    return (
      <div className="max-w-xl mx-auto space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-1">Métricas de Flujo</h2>
          <p className="text-sm text-gray-500">
            Proyecto: <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-xs">{selectedProjectKey}</span>
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sprint (opcional)</label>
            <input
              type="text"
              className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Sprint 42"
              value={sprint}
              onChange={(e) => setSprint(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha inicio (opcional)</label>
              <input
                type="date"
                className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha fin (opcional)</label>
              <input
                type="date"
                className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <div className="rounded-lg p-3 text-sm bg-red-50 text-red-700 border border-red-200">
              {error}
              <button onClick={() => setError(null)} className="ml-2 underline hover:no-underline">Reintentar</button>
            </div>
          )}

          <button
            onClick={handleAnalyze}
            className="w-full bg-primary text-white py-2.5 px-4 rounded-lg text-sm font-medium hover:bg-primary-dark transition-colors"
          >
            Analizar Flujo
          </button>
        </div>
      </div>
    );
  }

  // ── Loading ──────────────────────────────────────────────────────────────
  if (viewState === 'loading') {
    return <Spinner label="Analizando métricas de flujo..." />;
  }

  // ── Report ───────────────────────────────────────────────────────────────
  if (viewState === 'report' && report) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Métricas de Flujo — {report.projectKey}</h2>
            <p className="text-xs text-gray-500 mt-0.5">Generado: {new Date(report.generatedAt).toLocaleString()}</p>
          </div>
          <button onClick={handleReset} className="text-xs text-gray-500 hover:text-gray-700 shrink-0">← Nuevo análisis</button>
        </div>

        {report.cognitiveLoad && <CognitiveLoadSection data={report.cognitiveLoad} />}
        <TypologyBar typology={report.typology} />
        {report.cfd && <CFDChart data={report.cfd} />}
        {report.scopeCreep && <ScopeCreepSection data={report.scopeCreep} />}
        <ThroughputTable data={report.throughputByType} />
        <WIPTable data={report.wipByDeveloper} />
        <BottlenecksSection bottlenecks={report.bottlenecks} />
        <AgingIssuesSection issues={report.agingIssues} />
        <RecommendationsSection recommendations={report.recommendations} />

        {/* AI Diagnosis */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">🧠 Diagnóstico IA de la Iniciativa</h3>
            <button
              onClick={async () => {
                setDiagnosisLoading(true); setDiagnosis(null);
                try {
                  const res = await apiClient.post<{ diagnosis: string }>('/flow-metrics/diagnose', { metrics: report });
                  setDiagnosis(res.diagnosis);
                } catch (err: any) { setDiagnosis('Error generando diagnóstico: ' + (err.message || 'intenta de nuevo')); }
                finally { setDiagnosisLoading(false); }
              }}
              disabled={diagnosisLoading}
              className="bg-primary text-white py-1.5 px-4 rounded-lg text-xs font-medium hover:bg-primary-dark disabled:opacity-50 transition-colors"
            >
              {diagnosisLoading ? 'Analizando...' : diagnosis ? 'Regenerar' : 'Generar Diagnóstico'}
            </button>
          </div>
          {diagnosisLoading && (
            <div className="flex items-center gap-2 py-4">
              <div className="w-4 h-4 border-2 border-primary-light border-t-primary rounded-full animate-spin" />
              <span className="text-sm text-gray-500">Gemini está analizando la iniciativa...</span>
            </div>
          )}
          {diagnosis && !diagnosisLoading && (
            <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 whitespace-pre-line leading-relaxed">
              {diagnosis}
            </div>
          )}
          {!diagnosis && !diagnosisLoading && (
            <p className="text-xs text-gray-400">Haz clic en "Generar Diagnóstico" para obtener un análisis ejecutivo con recomendaciones accionables.</p>
          )}
        </div>

        {error && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{error}</div>}
      </div>
    );
  }

  return null;
}
