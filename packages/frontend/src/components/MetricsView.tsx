import { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { useAppStore } from '../store/useAppStore';

const CREDENTIAL_KEY = 'jira-main';

interface JiraProject { id: string; key: string; name: string; projectTypeKey: string; avatarUrl?: string; }

interface Metrics {
  velocity: { averageStoryPoints: number; trend: string; sprintVelocities: any[] };
  cycleTime: { averageDays: number; median: number; percentile90: number };
  distribution: { todo: number; inProgress: number; done: number; blocked: number };
  blockedIssues: Array<{ key: string; summary: string; daysBlocked: number; issueType?: string; assignee?: string }>;
  bottlenecks: Array<{ type: string; description: string; severity: string; affectedIssues: string[] }>;
  deliveryCompliance: { totalWithDueDate: number; deliveredOnTime: number; deliveredLate: number; pendingOverdue: number; complianceRate: number };
  totalIssues: number;
  jiraBaseUrl?: string;
  period: { startDate: string | null; endDate: string | null };
  quality?: { totalBugs: number; bugsBySeverity: { critical: number; high: number; medium: number; low: number }; openBugs: number; resolvedBugs: number; avgBugResolutionDays: number | null; defectRate: number; reopenedBugs: number; unassignedBugs: number };
  production?: { activeIncidents: number; incidentsBySeverity: { critical: number; high: number; medium: number; low: number }; openProblems: number; avgIncidentResolutionDays: number | null };
  issueTypeBreakdown?: Array<{ type: string; total: number; open: number; done: number }>;
  progress?: { totalStories: number; completedStories: number; inProgressStories: number; todoStories: number; completionRate: number; totalStoryPoints: number; completedStoryPoints: number; storyPointsCompletionRate: number };
}

export default function MetricsView() {
  const { jiraCredentialKey, selectedProjectKey, connections, setCurrentView } = useAppStore();
  const [projectKey, setProjectKey] = useState(selectedProjectKey || '');
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // Project search
  const [projects, setProjects] = useState<JiraProject[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showBlockedDetail, setShowBlockedDetail] = useState(false);

  const isConnected = connections.jira === 'connected';

  // Auto-load projects if no project is preselected
  useEffect(() => {
    if (isConnected && !selectedProjectKey && projects.length === 0) {
      loadProjects();
    }
  }, [isConnected]); // eslint-disable-line

  // Auto-analyze if project is preselected
  useEffect(() => {
    if (isConnected && selectedProjectKey && !metrics && !loading) {
      setProjectKey(selectedProjectKey);
      handleAnalyze(selectedProjectKey);
    }
  }, [isConnected, selectedProjectKey]); // eslint-disable-line

  const loadProjects = async () => {
    setLoadingProjects(true);
    try {
      const data: any = await apiClient.get(`/jira/projects?credentialKey=${CREDENTIAL_KEY}`);
      setProjects(data);
    } catch { /* ignore */ }
    finally { setLoadingProjects(false); }
  };

  const handleAnalyze = async (key?: string) => {
    const pk = key || projectKey;
    if (!pk) { setError('Selecciona un proyecto'); return; }
    setLoading(true);
    setError('');
    setProjectKey(pk);
    try {
      let url = `/projects/${pk}/metrics?credentialKey=${jiraCredentialKey}`;
      if (startDate) url += `&startDate=${startDate}`;
      if (endDate) url += `&endDate=${endDate}`;
      const result: any = await apiClient.get(url);
      setMetrics(result);
    } catch (err: any) {
      const msg = typeof err.message === 'string' ? err.message : 'Error al obtener métricas';
      setError(msg);
    } finally { setLoading(false); }
  };

  const handleReset = () => { setMetrics(null); setProjectKey(''); setError(''); };

  const severityColor = (s: string) => s === 'high' ? 'text-red-600 bg-red-50' : s === 'medium' ? 'text-yellow-600 bg-yellow-50' : 'text-green-600 bg-green-50';

  if (!isConnected) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-1">Métricas de Gestión</h2>
          <p className="text-sm text-gray-500">Se requiere conexión con Jira.</p>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-3">
          <p className="text-sm text-amber-800">Configura tus credenciales desde el Panel de Conexiones.</p>
          <button onClick={() => setCurrentView('connections')} className="text-sm font-medium text-primary hover:underline">Ir al Panel de Conexiones →</button>
        </div>
      </div>
    );
  }

  // No metrics yet — show project selector
  if (!metrics && !loading) {
    const q = searchQuery.toLowerCase().trim();
    const filtered = q ? projects.filter(p => p.name.toLowerCase().includes(q) || p.key.toLowerCase().includes(q)) : projects;

    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-1">Métricas de Gestión</h2>
          <p className="text-sm text-gray-500">Selecciona un proyecto para analizar velocidad, cycle time, distribución y cuellos de botella.</p>
        </div>

        {loadingProjects && (
          <div className="flex items-center gap-2 text-sm text-gray-500 py-4">
            <div className="w-4 h-4 border-2 border-primary-light border-t-primary rounded-full animate-spin" />
            Cargando proyectos...
          </div>
        )}

        {!loadingProjects && projects.length > 0 && (
          <>
            <div className="relative">
              <input
                type="text"
                className="w-full border border-gray-300 rounded-lg p-2.5 pl-9 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Buscar proyecto por nombre o clave..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <svg className="absolute left-3 top-3 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              {searchQuery && <button onClick={() => setSearchQuery('')} className="absolute right-3 top-3 text-gray-400 hover:text-gray-600">✕</button>}
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {q && filtered.length === 0 && <p className="text-sm text-gray-400 py-4 text-center">No se encontraron proyectos para "{searchQuery}"</p>}
              {filtered.map((project) => (
                <button key={project.key} onClick={() => handleAnalyze(project.key)}
                  className="w-full flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:border-primary hover:bg-primary/10 transition-colors text-left">
                  {project.avatarUrl && <img src={project.avatarUrl} alt="" className="w-8 h-8 rounded" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{project.name}</p>
                    <p className="text-xs text-gray-500">{project.key} · {project.projectTypeKey}</p>
                  </div>
                  <span className="text-xs text-primary">Analizar →</span>
                </button>
              ))}
            </div>
          </>
        )}

        {error && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{error}</div>}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="w-10 h-10 border-4 border-primary-light border-t-primary rounded-full animate-spin" />
        <p className="text-sm text-gray-600">Analizando métricas de {projectKey}...</p>
      </div>
    );
  }

  // Metrics loaded — show dashboard
  if (!metrics) return null;

  const d = metrics.distribution;
  const total = d.todo + d.inProgress + d.done + d.blocked;
  const completionRate = total > 0 ? ((d.done / total) * 100).toFixed(0) : '0';
  const blockRate = total > 0 ? ((d.blocked / total) * 100).toFixed(0) : '0';

  const hasSP = metrics.velocity.averageStoryPoints > 0 || (metrics.progress?.totalStoryPoints ?? 0) > 0;
  const hasCycleTime = metrics.cycleTime.averageDays > 0;

  // Observations
  const observations: { text: string; severity: 'high' | 'medium' | 'info' }[] = [];
  if (metrics.deliveryCompliance?.complianceRate < 50 && metrics.deliveryCompliance?.totalWithDueDate > 0) observations.push({ text: `🔴 Cumplimiento de entregables bajo (${metrics.deliveryCompliance.complianceRate.toFixed(0)}%). Menos de la mitad de las issues se entregan a tiempo.`, severity: 'high' });
  if (metrics.deliveryCompliance?.pendingOverdue > 0) observations.push({ text: `⚠️ ${metrics.deliveryCompliance.pendingOverdue} issue(s) vencida(s) sin entregar. Requieren re-planificación.`, severity: 'medium' });
  if (metrics.quality?.openBugs && metrics.quality.openBugs > 5) observations.push({ text: `🐛 ${metrics.quality.openBugs} bugs abiertos. Revisar priorización y asignación.`, severity: 'medium' });
  if (metrics.quality?.bugsBySeverity?.critical && metrics.quality.bugsBySeverity.critical > 0) observations.push({ text: `🔴 ${metrics.quality.bugsBySeverity.critical} bug(s) de severidad Critical abiertos. Requieren atención inmediata.`, severity: 'high' });
  if (metrics.quality?.defectRate && metrics.quality.defectRate > 20) observations.push({ text: `⚠️ Tasa de defectos alta (${metrics.quality.defectRate.toFixed(0)}%). Más del 20% de las entregas generan bugs.`, severity: 'high' });
  if (metrics.quality?.unassignedBugs && metrics.quality.unassignedBugs > 0) observations.push({ text: `📋 ${metrics.quality.unassignedBugs} bug(s) sin asignar. Necesitan responsable.`, severity: 'medium' });
  if (metrics.production?.activeIncidents && metrics.production.activeIncidents > 0) observations.push({ text: `🚨 ${metrics.production.activeIncidents} incidente(s) activo(s) en producción.`, severity: 'high' });
  if (metrics.production?.openProblems && metrics.production.openProblems > 0) observations.push({ text: `🔧 ${metrics.production.openProblems} problema(s) abierto(s) en producción.`, severity: 'medium' });
  if (hasCycleTime && metrics.cycleTime.averageDays > 10) observations.push({ text: `⚠️ Cycle Time elevado (${metrics.cycleTime.averageDays.toFixed(1)}d). Las HUs tardan más de 10 días en completarse.`, severity: 'high' });
  if (hasCycleTime && metrics.cycleTime.percentile90 > 20) observations.push({ text: `🟠 P90 Cycle Time alto (${metrics.cycleTime.percentile90.toFixed(1)}d). El 10% de las HUs tarda más de 20 días.`, severity: 'medium' });
  if (hasSP && metrics.velocity.trend === 'decreasing') observations.push({ text: '📉 Tendencia de velocidad decreciente. El equipo está completando menos que antes.', severity: 'medium' });
  if (d.blocked > 0) observations.push({ text: `🔴 ${d.blocked} issue(s) bloqueada(s). Requieren atención inmediata.`, severity: 'high' });
  if (d.inProgress > d.done && total > 5) observations.push({ text: `🟡 Más HUs en progreso (${d.inProgress}) que completadas (${d.done}). Posible WIP excesivo.`, severity: 'medium' });
  if (metrics.bottlenecks.length > 0) observations.push({ text: `🔧 ${metrics.bottlenecks.length} cuello(s) de botella detectado(s).`, severity: 'medium' });

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Métricas de Gestión — {projectKey}</h2>
          <p className="text-xs text-gray-500 mt-0.5">Análisis de rendimiento y salud del proyecto</p>
        </div>
        <button onClick={handleReset} className="text-xs text-gray-500 hover:text-gray-700 shrink-0">← Cambiar proyecto</button>
      </div>

      <div className="flex items-end gap-3 flex-wrap">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Desde</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
            className="border border-gray-300 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Hasta</label>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
            className="border border-gray-300 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>
        <button onClick={() => handleAnalyze(projectKey)} disabled={loading}
          className="bg-primary text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-primary-dark disabled:opacity-50 transition-colors">
          {loading ? 'Analizando...' : 'Aplicar filtro'}
        </button>
        {(startDate || endDate) && (
          <button onClick={() => { setStartDate(''); setEndDate(''); handleAnalyze(projectKey); }}
            className="text-xs text-gray-500 hover:text-gray-700">Limpiar fechas</button>
        )}
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {hasSP && (
          <Card value={metrics.velocity.averageStoryPoints.toFixed(1)} label="Velocidad Promedio" sub={`Tendencia: ${metrics.velocity.trend === 'increasing' ? '📈 Subiendo' : metrics.velocity.trend === 'decreasing' ? '📉 Bajando' : '➡️ Estable'}`} color="text-primary" tooltip="Issues completadas promedio por semana. Mide la capacidad de entrega." />
        )}
        {hasCycleTime && (
          <Card value={metrics.cycleTime.averageDays.toFixed(1) + 'd'} label="Cycle Time" sub={`Mediana: ${metrics.cycleTime.median.toFixed(1)}d · P90: ${metrics.cycleTime.percentile90.toFixed(1)}d`} color="text-purple-600" tooltip="Tiempo promedio desde creación hasta resolución. Mide eficiencia del desarrollo." />
        )}
        <Card value={completionRate + '%'} label="Tasa de Completitud" sub={`${d.done} de ${total} issues`} color="text-green-600" tooltip="Porcentaje de issues completadas vs total. Indica progreso general." />
        {d.blocked > 0 ? (
          <div
            onClick={() => setShowBlockedDetail(!showBlockedDetail)}
            className="bg-white border-2 border-red-200 rounded-lg p-3 text-center relative cursor-pointer hover:bg-red-50 transition-colors"
          >
            <p className="text-2xl font-bold text-red-600">{d.blocked}</p>
            <p className="text-xs text-gray-500 mt-0.5">Bloqueadas <span className="text-red-400">▼ Ver detalle</span></p>
            <p className="text-xs text-gray-400">{blockRate}% del total</p>
          </div>
        ) : (
          <Card value="0" label="Bloqueadas" sub={blockRate + '% del total'} color="text-green-600" tooltip="No hay issues bloqueadas." />
        )}
      </div>

      {/* Blocked issues detail (expandable from card click) */}
      {showBlockedDetail && d.blocked > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-red-800">Issues Bloqueadas ({metrics.blockedIssues.length || d.blocked})</h3>
            <button onClick={() => setShowBlockedDetail(false)} className="text-xs text-red-500 hover:text-red-700">Cerrar ✕</button>
          </div>
          {metrics.blockedIssues.length > 0 ? (
            <div className="space-y-2">
              {metrics.blockedIssues.map((issue) => (
                <div key={issue.key} className="bg-white rounded-lg p-3 border border-red-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <a href={`${metrics.jiraBaseUrl}/browse/${issue.key}`} target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline">{issue.key}</a>
                      {issue.issueType && <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{issue.issueType}</span>}
                    </div>
                    <span className="text-red-600 text-xs font-medium">{issue.daysBlocked}d bloqueada</span>
                  </div>
                  <p className="text-sm text-gray-700 mt-1">{issue.summary}</p>
                  {issue.assignee && <p className="text-xs text-gray-400 mt-1">Asignado a: {issue.assignee}</p>}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-red-700">Hay {d.blocked} issue(s) con estado bloqueado. Verifica el nombre del estado en Jira (debe ser "Blocked" o "Bloqueado").</p>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card value={String(d.todo)} label="Por Hacer" color="text-gray-600" tooltip="Issues pendientes en backlog o To Do." />
        <Card value={String(d.inProgress)} label="En Progreso" color="text-orange-600" tooltip="Issues actualmente en desarrollo." />
        <Card value={String(d.done)} label="Completadas" color="text-green-600" tooltip="Issues finalizadas (Done/Producción)." />
        <Card value={String(total)} label="Total Issues" color="text-gray-900" tooltip="Total de issues en el proyecto." />
      </div>

      {/* Delivery Compliance */}
      {metrics.deliveryCompliance && metrics.deliveryCompliance.totalWithDueDate > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Cumplimiento de Entregables</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
            <div className="text-center">
              <p className="text-xl font-bold text-green-600">{metrics.deliveryCompliance.complianceRate.toFixed(0)}%</p>
              <p className="text-xs text-gray-500">Tasa de cumplimiento</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-green-600">{metrics.deliveryCompliance.deliveredOnTime}</p>
              <p className="text-xs text-gray-500">A tiempo</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-amber-600">{metrics.deliveryCompliance.deliveredLate}</p>
              <p className="text-xs text-gray-500">Entregadas tarde</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-red-600">{metrics.deliveryCompliance.pendingOverdue}</p>
              <p className="text-xs text-gray-500">Vencidas sin entregar</p>
            </div>
          </div>
          <p className="text-xs text-gray-400">{metrics.deliveryCompliance.totalWithDueDate} issues con fecha de entrega definida</p>
        </div>
      )}

      {/* Period info */}
      {metrics.period && (metrics.period.startDate || metrics.period.endDate) && (
        <p className="text-xs text-gray-400">Período analizado: {metrics.period.startDate || 'inicio'} — {metrics.period.endDate || 'hoy'}</p>
      )}

      {/* Initiative Progress */}
      {metrics.progress && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Progreso de la Iniciativa</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
            <div className="text-center">
              <p className="text-xl font-bold text-primary">{metrics.progress.completionRate.toFixed(0)}%</p>
              <p className="text-xs text-gray-500">Completitud HUs</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-green-600">{metrics.progress.completedStories}</p>
              <p className="text-xs text-gray-500">Completadas</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-orange-600">{metrics.progress.inProgressStories}</p>
              <p className="text-xs text-gray-500">En Progreso</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-gray-600">{metrics.progress.todoStories}</p>
              <p className="text-xs text-gray-500">Pendientes</p>
            </div>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div className="bg-primary h-3 rounded-full transition-all" style={{width: metrics.progress.completionRate + '%'}} />
          </div>
          {metrics.progress.totalStoryPoints > 0 && (
            <p className="text-xs text-gray-400 mt-2">{metrics.progress.completedStoryPoints} de {metrics.progress.totalStoryPoints} SP completados ({metrics.progress.storyPointsCompletionRate.toFixed(0)}%)</p>
          )}
        </div>
      )}

      {/* Issue Type Breakdown */}
      {metrics.issueTypeBreakdown && metrics.issueTypeBreakdown.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Distribución por Tipo de Actividad</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                <tr>
                  <th className="px-3 py-2 text-left">Tipo</th>
                  <th className="px-3 py-2 text-center">Total</th>
                  <th className="px-3 py-2 text-center">Abiertos</th>
                  <th className="px-3 py-2 text-center">Cerrados</th>
                  <th className="px-3 py-2 text-center">% Completado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {metrics.issueTypeBreakdown.map((t) => (
                  <tr key={t.type}>
                    <td className="px-3 py-2 font-medium text-gray-900">{t.type}</td>
                    <td className="px-3 py-2 text-center text-gray-700">{t.total}</td>
                    <td className="px-3 py-2 text-center text-orange-600">{t.open}</td>
                    <td className="px-3 py-2 text-center text-green-600">{t.done}</td>
                    <td className="px-3 py-2 text-center text-gray-700">{t.total > 0 ? ((t.done / t.total) * 100).toFixed(0) : 0}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Quality */}
      {metrics.quality && metrics.quality.totalBugs > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Calidad del Producto</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
            <div className="text-center">
              <p className="text-xl font-bold text-red-600">{metrics.quality.openBugs}</p>
              <p className="text-xs text-gray-500">Bugs Abiertos</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-green-600">{metrics.quality.resolvedBugs}</p>
              <p className="text-xs text-gray-500">Bugs Resueltos</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-amber-600">{metrics.quality.defectRate.toFixed(0)}%</p>
              <p className="text-xs text-gray-500">Tasa de Defectos</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-purple-600">{metrics.quality.avgBugResolutionDays !== null ? metrics.quality.avgBugResolutionDays.toFixed(1) + 'd' : '—'}</p>
              <p className="text-xs text-gray-500">Resolución Prom.</p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {metrics.quality.bugsBySeverity.critical > 0 && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">Critical: {metrics.quality.bugsBySeverity.critical}</span>}
            {metrics.quality.bugsBySeverity.high > 0 && <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">High: {metrics.quality.bugsBySeverity.high}</span>}
            {metrics.quality.bugsBySeverity.medium > 0 && <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">Medium: {metrics.quality.bugsBySeverity.medium}</span>}
            {metrics.quality.bugsBySeverity.low > 0 && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Low: {metrics.quality.bugsBySeverity.low}</span>}
            {metrics.quality.unassignedBugs > 0 && <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">Sin asignar: {metrics.quality.unassignedBugs}</span>}
          </div>
        </div>
      )}

      {/* Production Health */}
      {metrics.production && (metrics.production.activeIncidents > 0 || metrics.production.openProblems > 0) && (
        <div className="bg-white border border-red-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Salud en Producción</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="text-center">
              <p className="text-xl font-bold text-red-600">{metrics.production.activeIncidents}</p>
              <p className="text-xs text-gray-500">Incidentes Activos</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-amber-600">{metrics.production.openProblems}</p>
              <p className="text-xs text-gray-500">Problemas Abiertos</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-purple-600">{metrics.production.avgIncidentResolutionDays !== null ? metrics.production.avgIncidentResolutionDays.toFixed(1) + 'd' : '—'}</p>
              <p className="text-xs text-gray-500">Resolución Incidentes</p>
            </div>
            <div className="text-center">
              <div className="flex justify-center gap-1 flex-wrap">
                {metrics.production.incidentsBySeverity.critical > 0 && <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded">C:{metrics.production.incidentsBySeverity.critical}</span>}
                {metrics.production.incidentsBySeverity.high > 0 && <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">H:{metrics.production.incidentsBySeverity.high}</span>}
                {metrics.production.incidentsBySeverity.medium > 0 && <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">M:{metrics.production.incidentsBySeverity.medium}</span>}
              </div>
              <p className="text-xs text-gray-500 mt-1">Por Severidad</p>
            </div>
          </div>
        </div>
      )}

      {/* Observations */}
      {observations.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-gray-700">Observaciones del análisis</p>
          {observations.map((obs, i) => (
            <div key={i} className={`rounded-lg p-3 text-sm ${obs.severity === 'high' ? 'bg-red-50 text-red-800 border border-red-200' : 'bg-amber-50 text-amber-800 border border-amber-200'}`}>
              {obs.text}
            </div>
          ))}
        </div>
      )}

      {/* Bottlenecks */}
      {metrics.bottlenecks.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Cuellos de Botella</h3>
          <div className="space-y-2">
            {metrics.bottlenecks.map((b, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${severityColor(b.severity)}`}>{b.severity}</span>
                <p className="text-sm text-gray-600">{b.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{error}</div>}
    </div>
  );
}

function Card({ value, label, sub, color, tooltip }: { value: string; label: string; sub?: string; color: string; tooltip: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 text-center relative cursor-help"
      onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label} <span className="text-gray-300">ⓘ</span></p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
      {show && (
        <div className="absolute z-10 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg">
          {tooltip}
          <div className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900 rotate-45 -mt-1" />
        </div>
      )}
    </div>
  );
}
