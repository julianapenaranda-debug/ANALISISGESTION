import { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import InitiativeContextCard from './InitiativeContextCard';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

type ViewState = 'idle' | 'loading' | 'report';

type WorkloadStatus = 'overloaded' | 'normal' | 'underloaded';
type ProductivityStatus = 'high' | 'normal' | 'low';
type AlertType = 'overloaded' | 'low_productivity' | 'multitasking';

interface WorkloadSummary {
  totalDevelopers: number;
  totalHUs: number;
  averageStoryPointsPerDeveloper: number;
  teamVelocityAverage: number;
  teamCycleTimeAverage: number | null;
  teamLeadTimeAverage: number | null;
  teamThroughput: number;
  teamWIP: number;
  agingWIPAverage: number | null;
  reworkRatio: number;
  predictabilityIndex: number | null;
  spDistributionEquity: number | null;
}

interface DeveloperMetrics {
  accountId: string;
  displayName: string;
  assignedHUs: number;
  activeStoryPoints: number;
  completedHUs: number;
  velocityIndividual: number;
  cycleTimeIndividual: number | null;
  workloadStatus: WorkloadStatus;
  productivityStatus: ProductivityStatus;
  inProgressCount: number;
  multitaskingAlert: boolean;
  leadTimeIndividual: number | null;
  throughputIndividual: number;
  wipCount: number;
  agingWIPDays: number | null;
  reworkCount: number;
  issueTypeBreakdown: Array<{ type: string; total: number; inProgress: number; done: number }>;
  storiesInProgress: number;
}

interface WorkloadAlert {
  accountId: string;
  displayName: string;
  type: AlertType;
  description: string;
  severity: 'high' | 'medium';
}

interface WorkloadReport {
  projectKey: string;
  generatedAt: string;
  summary: WorkloadSummary;
  developers: DeveloperMetrics[];
  alerts: WorkloadAlert[];
  hasAlerts: boolean;
  initiativeContext?: { tribu: string; squad: string; tipoIniciativa: string; anioEjecucion: string; avanceEsperado: number | null; avanceReal: number | null };
}

const WORKLOAD_ROW_BG: Record<WorkloadStatus, string> = {
  overloaded: 'bg-red-50',
  underloaded: 'bg-yellow-50',
  normal: 'bg-green-50',
};

const WORKLOAD_BADGE: Record<WorkloadStatus, string> = {
  overloaded: 'bg-red-100 text-red-700',
  underloaded: 'bg-yellow-100 text-yellow-700',
  normal: 'bg-green-100 text-green-700',
};

const PRODUCTIVITY_BADGE: Record<ProductivityStatus, string> = {
  high: 'bg-green-100 text-green-700',
  normal: 'bg-gray-100 text-gray-700',
  low: 'bg-red-100 text-red-700',
};

const PRODUCTIVITY_LABEL: Record<ProductivityStatus, string> = {
  high: 'Flujo eficiente',
  normal: 'Flujo interrumpido',
  low: 'Flujo bloqueado',
};

const ALERT_TYPE_LABELS: Record<AlertType, string> = {
  overloaded: 'Sobrecarga',
  low_productivity: 'Baja productividad',
  multitasking: 'Multitasking',
};

const ALERT_TYPE_COLORS: Record<AlertType, string> = {
  overloaded: 'bg-red-100 text-red-700',
  low_productivity: 'bg-orange-100 text-orange-700',
  multitasking: 'bg-yellow-100 text-yellow-700',
};

function Spinner({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <div className="w-10 h-10 border-4 border-primary-light border-t-primary rounded-full animate-spin" />
      <p className="text-sm text-gray-600">{label}</p>
    </div>
  );
}

function SummaryCards({ summary }: { summary: WorkloadSummary }) {
  const fmt = (v: number | null, suffix = '') => v !== null && v !== undefined && v > 0 ? v.toFixed(1) + suffix : null;
  const pct = (v: number | null) => v !== null && v !== undefined ? (v * 100).toFixed(0) + '%' : null;

  // Risk observations
  const observations: { text: string; severity: 'high' | 'medium' | 'info' }[] = [];

  if (summary.teamCycleTimeAverage !== null && summary.teamCycleTimeAverage > 10) {
    observations.push({ text: `⚠️ Cycle Time elevado (${fmt(summary.teamCycleTimeAverage, 'd')}). El equipo tarda más de 10 días en completar HUs. Revisar bloqueos o dependencias.`, severity: 'high' });
  }
  if (summary.teamLeadTimeAverage !== null && summary.teamLeadTimeAverage > 15) {
    observations.push({ text: `⚠️ Lead Time alto (${fmt(summary.teamLeadTimeAverage, 'd')}). Las HUs tardan más de 15 días desde su creación hasta resolución. Posible cuello de botella en priorización.`, severity: 'high' });
  }
  if (summary.agingWIPAverage !== null && summary.agingWIPAverage > 7) {
    observations.push({ text: `🟠 Aging WIP elevado (${fmt(summary.agingWIPAverage, 'd')}). Hay HUs en progreso que llevan más de 7 días sin completarse. Considerar limitar el WIP.`, severity: 'medium' });
  }
  if (summary.reworkRatio > 0.1) {
    observations.push({ text: `🔴 Ratio de re-trabajo alto (${pct(summary.reworkRatio)}). Más del 10% de HUs completadas volvieron a In Progress.`, severity: 'high' });
  }
  if (summary.teamWIP > summary.totalDevelopers * 2) {
    observations.push({ text: `🟠 WIP excesivo (${summary.teamWIP} HUs para ${summary.totalDevelopers} devs). Se recomienda máximo 2 HUs en progreso por desarrollador.`, severity: 'medium' });
  }
  if (summary.predictabilityIndex !== null && summary.predictabilityIndex < 0.5) {
    observations.push({ text: `🟡 Predictibilidad baja (${pct(summary.predictabilityIndex)}). El equipo cumple menos del 50% de los compromisos planificados.`, severity: 'medium' });
  }
  if (summary.spDistributionEquity !== null && summary.spDistributionEquity < 0.5) {
    observations.push({ text: `🟡 Carga desbalanceada (equidad ${pct(summary.spDistributionEquity)}). Las issues no están distribuidas equitativamente.`, severity: 'medium' });
  }
  if (summary.teamThroughput === 0 && summary.totalHUs > 0) {
    observations.push({ text: `🔴 Sin throughput. Hay ${summary.totalHUs} HUs pero ninguna completada. Revisar impedimentos del equipo.`, severity: 'high' });
  }

  // Build detail cards dynamically — only show metrics with real data
  const detailCards: { value: string; label: string; color: string; tooltip: string }[] = [];
  if (fmt(summary.teamCycleTimeAverage, 'd')) detailCards.push({ value: fmt(summary.teamCycleTimeAverage, 'd')!, label: 'Tiempo de Ciclo', color: 'text-purple-600', tooltip: 'Tiempo promedio desde que una HU entra en progreso hasta que se completa.' });
  if (fmt(summary.teamLeadTimeAverage, 'd')) detailCards.push({ value: fmt(summary.teamLeadTimeAverage, 'd')!, label: 'Tiempo de Entrega', color: 'text-indigo-600', tooltip: 'Tiempo promedio desde la creación de la HU hasta su resolución.' });
  if (fmt(summary.agingWIPAverage, 'd')) detailCards.push({ value: fmt(summary.agingWIPAverage, 'd')!, label: 'WIP Envejecido', color: 'text-amber-600', tooltip: 'Días promedio que llevan las HUs en progreso sin completarse.' });
  if (summary.reworkRatio > 0) detailCards.push({ value: pct(summary.reworkRatio)!, label: 'Re-trabajo', color: 'text-red-600', tooltip: 'Porcentaje de HUs que volvieron de Done a In Progress.' });

  const advancedCards: { value: string; label: string; color: string; tooltip: string }[] = [];
  if (summary.averageStoryPointsPerDeveloper > 0) advancedCards.push({ value: fmt(summary.averageStoryPointsPerDeveloper)!, label: 'Issues Activas/Dev', color: 'text-gray-900', tooltip: 'Issues activas promedio por desarrollador.' });
  if (pct(summary.predictabilityIndex)) advancedCards.push({ value: pct(summary.predictabilityIndex)!, label: 'Predictibilidad', color: 'text-teal-600', tooltip: '% de compromisos cumplidos vs planificados. Mide qué tan predecible es la entrega del equipo.' });
  if (pct(summary.spDistributionEquity)) advancedCards.push({ value: pct(summary.spDistributionEquity)!, label: 'Equidad de Carga', color: 'text-cyan-600', tooltip: 'Distribución equitativa de issues entre desarrolladores (0-100%).' });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard value={String(summary.totalDevelopers)} label="Desarrolladores" color="text-gray-900" tooltip="Cantidad de desarrolladores con HUs asignadas en el proyecto." />
        <MetricCard value={String(summary.totalHUs)} label="Total HUs" color="text-primary" tooltip="Total de Historias de Usuario asignadas en el período seleccionado." />
        <MetricCard value={String(summary.teamThroughput)} label="Entregas" color="text-green-600" tooltip="HUs completadas (Done/Producción). Mide la capacidad de entrega." />
        <MetricCard value={String(summary.teamWIP)} label="WIP" color="text-orange-600" tooltip="HUs actualmente en progreso. Un WIP alto indica posible context-switching." />
      </div>

      {detailCards.length > 0 && (
        <div className={`grid grid-cols-2 sm:grid-cols-${Math.min(detailCards.length, 4)} gap-3`}>
          {detailCards.map((c) => <MetricCard key={c.label} {...c} />)}
        </div>
      )}

      {advancedCards.length > 0 && (
        <div className={`grid grid-cols-2 sm:grid-cols-${Math.min(advancedCards.length, 3)} gap-3`}>
          {advancedCards.map((c) => <MetricCard key={c.label} {...c} />)}
        </div>
      )}

      {observations.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-gray-700">Observaciones del análisis</p>
          {observations.map((obs, i) => (
            <div key={i} className={`rounded-lg p-3 text-sm ${obs.severity === 'high' ? 'bg-red-50 text-red-800 border border-red-200' : obs.severity === 'medium' ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-primary/10 text-blue-800 border border-primary-light'}`}>
              {obs.text}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MetricCard({ value, label, color, tooltip }: { value: string; label: string; color: string; tooltip: string }) {
  const [showTooltip, setShowTooltip] = useState(false);
  return (
    <div
      className="bg-white border border-gray-200 rounded-lg p-3 text-center relative cursor-help"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label} <span className="text-gray-300">ⓘ</span></p>
      {showTooltip && (
        <div className="absolute z-10 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg">
          {tooltip}
          <div className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900 rotate-45 -mt-1" />
        </div>
      )}
    </div>
  );
}

function AlertsBanner({ alerts }: { alerts: WorkloadAlert[] }) {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-2">
      <p className="text-sm font-semibold text-amber-800">⚠ Alertas del equipo</p>
      <ul className="space-y-1.5">
        {alerts.map((alert, i) => (
          <li key={i} className="flex items-start gap-2 text-sm">
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${ALERT_TYPE_COLORS[alert.type]}`}
            >
              {ALERT_TYPE_LABELS[alert.type]}
            </span>
            <span className="text-gray-700">
              <span className="font-medium">{alert.displayName}</span>: {alert.description}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DeveloperTable({ developers }: { developers: DeveloperMetrics[] }) {
  const fmt = (v: number | null) => v !== null && v !== undefined ? v.toFixed(1) : null;
  const [expandedDev, setExpandedDev] = useState<string | null>(null);

  // Determine which optional columns have any data
  const hasCycleTime = developers.some(d => d.cycleTimeIndividual !== null);
  const hasLeadTime = developers.some(d => d.leadTimeIndividual !== null);

  function getDevObservations(dev: DeveloperMetrics): string[] {
    const obs: string[] = [];
    if (dev.workloadStatus === 'overloaded') obs.push('🔴 Sobrecargado');
    if (dev.productivityStatus === 'low') obs.push('🟠 Flujo bloqueado');
    if (dev.multitaskingAlert) obs.push(`⚠️ Multitasking (${dev.storiesInProgress} HUs en progreso)`);
    if (dev.agingWIPDays !== null && dev.agingWIPDays > 10) obs.push(`🟡 HUs estancadas (${fmt(dev.agingWIPDays)}d en progreso)`);
    if (dev.reworkCount > 0) obs.push(`🔄 ${dev.reworkCount} HU(s) con re-trabajo`);
    if (dev.cycleTimeIndividual !== null && dev.cycleTimeIndividual > 15) obs.push(`⏱️ Cycle time alto (${fmt(dev.cycleTimeIndividual)}d)`);
    if (dev.leadTimeIndividual !== null && dev.leadTimeIndividual > 20) obs.push(`📅 Lead time alto (${fmt(dev.leadTimeIndividual)}d)`);
    return obs;
  }

  return (
    <div className="space-y-0">
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
            <tr>
              <th className="px-3 py-2 text-left">Desarrollador</th>
              <th className="px-3 py-2 text-center">Total</th>              <th className="px-3 py-2 text-center">HUs en Progreso</th>
              <th className="px-3 py-2 text-center">Carga</th>
              <th className="px-3 py-2 text-center">Completadas</th>
              {hasCycleTime && <th className="px-3 py-2 text-center">T. Ciclo</th>}
              {hasLeadTime && <th className="px-3 py-2 text-center">T. Entrega</th>}
              <th className="px-3 py-2 text-center">Productividad</th>
              <th className="px-3 py-2 text-left">Observaciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {developers.map((dev) => {
              const obs = getDevObservations(dev);
              const isExpanded = expandedDev === dev.accountId;
              return (
                <>
                  <tr key={dev.accountId} className={WORKLOAD_ROW_BG[dev.workloadStatus]}>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{dev.displayName}</span>
                        <button onClick={() => setExpandedDev(isExpanded ? null : dev.accountId)} className="text-xs text-primary hover:underline shrink-0">
                          {isExpanded ? '▲' : '▼ Tipos'}
                        </button>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-center text-gray-700">{dev.assignedHUs}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={dev.storiesInProgress > 2 ? 'text-red-600 font-bold' : 'text-gray-700'}>
                        {dev.storiesInProgress}
                      </span>
                      {dev.multitaskingAlert && <span className="ml-1">⚠️</span>}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${WORKLOAD_BADGE[dev.workloadStatus]}`}>
                        {dev.workloadStatus}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center text-gray-700">{dev.completedHUs}</td>
                    {hasCycleTime && <td className="px-3 py-2 text-center text-gray-700">{fmt(dev.cycleTimeIndividual) && dev.cycleTimeIndividual && dev.cycleTimeIndividual > 0 ? fmt(dev.cycleTimeIndividual) + 'd' : '—'}</td>}
                    {hasLeadTime && <td className="px-3 py-2 text-center text-gray-700">{fmt(dev.leadTimeIndividual) && dev.leadTimeIndividual && dev.leadTimeIndividual > 0 ? fmt(dev.leadTimeIndividual) + 'd' : '—'}</td>}
                    <td className="px-3 py-2 text-center">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${PRODUCTIVITY_BADGE[dev.productivityStatus]}`}>
                        {PRODUCTIVITY_LABEL[dev.productivityStatus]}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-left">
                      {obs.length > 0 ? (
                        <div className="space-y-0.5">
                          {obs.map((o, i) => (
                            <p key={i} className="text-xs text-gray-600 whitespace-nowrap">{o}</p>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-green-600">✅ Sin observaciones</span>
                      )}
                    </td>
                </tr>
                  {isExpanded && dev.issueTypeBreakdown && dev.issueTypeBreakdown.length > 0 && (
                    <tr key={dev.accountId + '-breakdown'}>
                      <td colSpan={99} className="px-4 py-3 bg-gray-50">
                        <p className="text-xs font-semibold text-gray-600 mb-2">Distribución por Tipo de Actividad — {dev.displayName}</p>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {dev.issueTypeBreakdown.map((t) => (
                            <div key={t.type} className="bg-white border border-gray-200 rounded p-2 text-center">
                              <p className="text-xs font-medium text-gray-900">{t.type}</p>
                              <p className="text-lg font-bold text-gray-700">{t.total}</p>
                              <div className="flex justify-center gap-2 text-xs">
                                <span className="text-orange-600">{t.inProgress} activas</span>
                                <span className="text-green-600">{t.done} cerradas</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function WorkloadView() {
  const { jiraCredentialKey, selectedProjectKey, connections, setCurrentView } = useAppStore();

  const [viewState, setViewState] = useState<ViewState>('idle');
  const [sprint, setSprint] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [report, setReport] = useState<WorkloadReport | null>(null);
  const [error, setError] = useState<string | null>(null);

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

      const res = await fetch(`${API_BASE_URL}/workload/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectKey: selectedProjectKey,
          credentialKey: jiraCredentialKey,
          ...(Object.keys(filters).length > 0 && { filters }),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        const msg = typeof err.error === 'string' ? err.error : err.error?.message || 'Error al analizar carga de trabajo';
        throw new Error(msg);
      }

      const result: WorkloadReport = await res.json();
      setReport(result);
      setViewState('report');
    } catch (err: any) {
      setError(err.message || 'Error al analizar carga de trabajo');
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

  // Jira not connected — show connection required message
  if (!isConnected) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-1">Carga del Equipo</h2>
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

  // No project selected — redirect to Jira
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

  // ── Idle ──────────────────────────────────────────────────────────────────
  if (viewState === 'idle') {
    return (
      <div className="max-w-xl mx-auto space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-1">Carga del Equipo</h2>
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
            Analizar Carga
          </button>
        </div>
      </div>
    );
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (viewState === 'loading') {
    return <Spinner label="Analizando carga de trabajo..." />;
  }

  // ── Report ────────────────────────────────────────────────────────────────
  if (viewState === 'report' && report) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Carga del Equipo — {report.projectKey}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Generado: {new Date(report.generatedAt).toLocaleString()}
            </p>
          </div>
          <button
            onClick={handleReset}
            className="text-xs text-gray-500 hover:text-gray-700 shrink-0"
          >
            ← Nuevo análisis
          </button>
        </div>

        <InitiativeContextCard
          tribu={report.initiativeContext?.tribu ?? ''}
          squad={report.initiativeContext?.squad ?? ''}
          tipoIniciativa={report.initiativeContext?.tipoIniciativa ?? ''}
          anioEjecucion={report.initiativeContext?.anioEjecucion ?? ''}
          avanceEsperado={report.initiativeContext?.avanceEsperado ?? null}
          avanceReal={report.initiativeContext?.avanceReal ?? null}
        />

        <SummaryCards summary={report.summary} />

        {report.hasAlerts && <AlertsBanner alerts={report.alerts} />}

        {report.developers.length > 0 ? (
          <DeveloperTable developers={report.developers} />
        ) : (
          <p className="text-sm text-gray-500 text-center py-8">
            No se encontraron desarrolladores con HUs asignadas.
          </p>
        )}
      </div>
    );
  }

  return null;
}
