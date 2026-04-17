import { useState, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

type ViewState = 'loading-services' | 'select-services' | 'analyzing' | 'results' | 'error';
type SuggestedCriticality = 'critical' | 'high' | 'medium' | 'low';
type DatadogFindingType = 'log' | 'monitor' | 'incident';

interface AnalyzedFinding {
  finding: { id: string; type: DatadogFindingType; title: string; message: string; service: string; tags: string[]; timestamp: string };
  suggestedCriticality: SuggestedCriticality;
  affectedService: string;
  affectedEndpoint?: string;
  resolutionSuggestion: string;
  resolutionSteps: string[];
  label: string;
}

interface AnalysisMetrics {
  totalFindings: number;
  distributionByType: Record<DatadogFindingType, number>;
  distributionByCriticality: Record<SuggestedCriticality, number>;
}

const CRIT_ICON: Record<SuggestedCriticality, string> = { critical: '🔴', high: '🟠', medium: '🟡', low: '🟢' };
const CRIT_COLOR: Record<SuggestedCriticality, string> = {
  critical: 'bg-red-100 text-red-700 border border-red-200',
  high: 'bg-orange-100 text-orange-700 border border-orange-200',
  medium: 'bg-yellow-100 text-yellow-700 border border-yellow-200',
  low: 'bg-green-100 text-green-700 border border-green-200',
};
const TYPE_LABEL: Record<DatadogFindingType, string> = { log: 'Log', monitor: 'Monitor', incident: 'Incidente' };

export default function SupportView() {
  const { connections, setCurrentView, jiraCredentialKey, selectedProjectKey } = useAppStore();
  const isDatadogConnected = connections.datadog === 'connected';
  const isJiraConnected = connections.jira === 'connected';

  const [viewState, setViewState] = useState<ViewState>('loading-services');
  const [services, setServices] = useState<string[]>([]);
  const [selectedServices, setSelectedServices] = useState<Set<string>>(new Set());
  const [searchFilter, setSearchFilter] = useState('');
  const [findings, setFindings] = useState<AnalyzedFinding[]>([]);
  const [metrics, setMetrics] = useState<AnalysisMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createdIssues, setCreatedIssues] = useState<Record<string, { key: string; url: string }>>({});
  const [issueModal, setIssueModal] = useState<AnalyzedFinding | null>(null);
  const [analyzingDashboard, setAnalyzingDashboard] = useState<string | null>(null);
  const [dashboardInsights, setDashboardInsights] = useState<string>('');
  const [sloStatus, setSloStatus] = useState<Array<{ name: string; score: number; target: number; status: string; errorBudget: number | null; service?: string }>>([]);
  const [mode, setMode] = useState<'services' | 'dashboards' | 'jira-tickets'>('services');
  const [dashboards, setDashboards] = useState<Array<{ id: string; title: string; description: string; author: string; url: string; modified: string }>>([]);
  const [jiraProjectKey, setJiraProjectKey] = useState('MDSB');
  const [jiraAnalysis, setJiraAnalysis] = useState<any>(null);
  const [jiraLoading, setJiraLoading] = useState(false);

  useEffect(() => {
    if (isDatadogConnected) loadServices();
  }, [isDatadogConnected]); // eslint-disable-line

  const loadServices = async () => {
    setViewState('loading-services');
    try {
      const [svcRes, dbRes] = await Promise.all([
        fetch(`${API_BASE_URL}/support/datadog/services`),
        fetch(`${API_BASE_URL}/support/datadog/dashboards`),
      ]);
      if (!svcRes.ok) throw new Error((await svcRes.json()).error || 'Error al cargar servicios');
      const svcData = await svcRes.json();
      setServices(svcData.services ?? svcData ?? []);
      if (dbRes.ok) {
        const dbData = await dbRes.json();
        setDashboards(dbData.dashboards ?? []);
      }
      setViewState('select-services');
    } catch (err: any) {
      setError(err.message);
      setViewState('error');
    }
  };

  const handleAnalyze = async () => {
    if (selectedServices.size === 0) return;
    setViewState('analyzing');
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/support-v2/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ services: [...selectedServices] }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(typeof err.error === 'string' ? err.error : err.error?.message || 'Error al analizar');
      }
      const data = await res.json();
      setFindings(data.findings || []);
      setMetrics(data.metrics || null);
      setViewState('results');
    } catch (err: any) {
      setError(err.message);
      setViewState('error');
    }
  };

  const handleReset = () => {
    setFindings([]);
    setMetrics(null);
    setCreatedIssues({});
    setIssueModal(null);
    setViewState('select-services');
  };

  const handleAnalyzeDashboard = async (dashboardId: string) => {
    setAnalyzingDashboard(dashboardId);
    setViewState('analyzing');
    setError(null);
    try {
      const res = await fetch(API_BASE_URL + '/support-v2/analyze-dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dashboardId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(typeof err.error === 'string' ? err.error : err.error?.message || 'Error al analizar dashboard');
      }
      const data = await res.json();
      setFindings(data.findings || []);
      setMetrics(data.metrics || null);
      setDashboardInsights(data.dashboardInsights || '');
      setSloStatus(data.sloStatus || []);
      setViewState('results');
    } catch (err: any) {
      setError(err.message);
      setViewState('error');
    }
    setAnalyzingDashboard(null);
  };

  const toggleService = (svc: string) => {
    setSelectedServices(prev => {
      const next = new Set(prev);
      if (next.has(svc)) next.delete(svc); else next.add(svc);
      return next;
    });
  };

  const filteredServices = searchFilter
    ? services.filter(s => s.toLowerCase().includes(searchFilter.toLowerCase()))
    : services;

  const selectAll = () => setSelectedServices(new Set(filteredServices));
  const deselectAll = () => setSelectedServices(new Set());

  // Datadog not connected
  if (!isDatadogConnected) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-1">Support Agent</h2>
          <p className="text-sm text-gray-500">Se requiere conexión con Datadog.</p>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-3">
          <p className="text-sm text-amber-800">Configura tus credenciales de Datadog desde el Panel de Conexiones.</p>
          <button onClick={() => setCurrentView('connections')} className="text-sm font-medium text-primary hover:underline">Ir al Panel de Conexiones →</button>
        </div>
      </div>
    );
  }

  // Loading services
  if (viewState === 'loading-services') {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="w-10 h-10 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin" />
        <p className="text-sm text-gray-600">Cargando servicios de Datadog...</p>
      </div>
    );
  }

  // Error state
  if (viewState === 'error') {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <h2 className="text-xl font-semibold text-gray-900">Support Agent</h2>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">{error}</div>
        <button onClick={loadServices} className="text-sm font-medium text-primary hover:underline">Reintentar</button>
      </div>
    );
  }

  // Analyzing
  if (viewState === 'analyzing') {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="w-10 h-10 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin" />
        <p className="text-sm text-gray-600">Analizando hallazgos de Datadog...</p>
        <p className="text-xs text-gray-400">{selectedServices.size} servicio(s) seleccionado(s)</p>
      </div>
    );
  }

  // Service selection
  if (viewState === 'select-services') {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-1">Support Agent</h2>
          <p className="text-sm text-gray-500">Selecciona los servicios de Datadog que quieres analizar.</p>
        </div>

        <div className="flex gap-2">
          <button onClick={() => setMode('services')}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${mode === 'services' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            Servicios ({services.length})
          </button>
          <button onClick={() => setMode('dashboards')}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${mode === 'dashboards' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            Dashboards ({dashboards.length})
          </button>
          {isJiraConnected && (
            <button onClick={() => setMode('jira-tickets')}
              className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${mode === 'jira-tickets' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              Tickets Jira
            </button>
          )}
        </div>

        {mode === 'jira-tickets' ? (
          <div className="space-y-4">
            <div className="flex gap-2">
              <input type="text" value={jiraProjectKey} onChange={(e) => setJiraProjectKey(e.target.value.toUpperCase())}
                className="flex-1 border border-gray-300 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Clave del proyecto (ej: MDSB)" />
              <button onClick={async () => {
                if (!jiraProjectKey || !jiraCredentialKey) return;
                setJiraLoading(true); setJiraAnalysis(null); setError(null);
                try {
                  const res = await fetch(`${API_BASE_URL}/support-jira/analyze`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ projectKey: jiraProjectKey, credentialKey: jiraCredentialKey }),
                  });
                  if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Error'); }
                  setJiraAnalysis(await res.json());
                } catch (err: any) { setError(err.message); }
                finally { setJiraLoading(false); }
              }} disabled={jiraLoading || !jiraProjectKey}
                className="bg-primary text-white py-2.5 px-6 rounded-lg text-sm font-medium hover:bg-primary-dark disabled:opacity-50 transition-colors">
                {jiraLoading ? 'Analizando...' : 'Analizar'}
              </button>
            </div>
            {jiraLoading && <div className="flex items-center justify-center py-12"><div className="w-8 h-8 border-4 border-primary-light border-t-primary rounded-full animate-spin" /></div>}
            {jiraAnalysis && (
              <div className="space-y-4">
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Resumen — {jiraAnalysis.projectKey}</h3>
                  <p className="text-sm text-gray-600">{jiraAnalysis.summary}</p>
                  <div className="grid grid-cols-3 gap-3 mt-3">
                    <div className="text-center"><p className="text-xl font-bold text-gray-900">{jiraAnalysis.totalTickets}</p><p className="text-xs text-gray-500">Total</p></div>
                    <div className="text-center"><p className="text-xl font-bold text-red-600">{jiraAnalysis.distributionByPriority?.Highest || jiraAnalysis.distributionByPriority?.Critical || 0}</p><p className="text-xs text-gray-500">Críticos</p></div>
                    <div className="text-center"><p className="text-xl font-bold text-orange-600">{jiraAnalysis.distributionByPriority?.High || 0}</p><p className="text-xs text-gray-500">Altos</p></div>
                  </div>
                </div>
                {/* Agrupación por Proyecto/Iniciativa vinculada */}
                {jiraAnalysis.distributionByLinkedProject && Object.keys(jiraAnalysis.distributionByLinkedProject).length > 0 && (
                  <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">Por Proyecto/Iniciativa</h3>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(jiraAnalysis.distributionByLinkedProject).sort(([,a]: any,[,b]: any) => b - a).map(([proj, count]: any) => (
                        <span key={proj} className="text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-full font-medium">{proj}: {count}</span>
                      ))}
                    </div>
                  </div>
                )}
                {/* Agrupación por Componente/Plataforma */}
                {jiraAnalysis.distributionByComponent && Object.keys(jiraAnalysis.distributionByComponent).length > 0 && (
                  <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">Por Componente/Plataforma</h3>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(jiraAnalysis.distributionByComponent).sort(([,a]: any,[,b]: any) => b - a).map(([comp, count]: any) => (
                        <span key={comp} className="text-xs bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full font-medium">{comp}: {count}</span>
                      ))}
                    </div>
                  </div>
                )}
                {jiraAnalysis.analyzedTickets?.map((item: any) => (
                  <div key={item.ticket.key} className={`bg-white border rounded-lg p-4 ${item.suggestedCriticality === 'critical' ? 'border-red-300' : item.suggestedCriticality === 'high' ? 'border-orange-300' : 'border-gray-200'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${item.suggestedCriticality === 'critical' ? 'bg-red-100 text-red-700' : item.suggestedCriticality === 'high' ? 'bg-orange-100 text-orange-700' : item.suggestedCriticality === 'medium' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>{item.suggestedCriticality}</span>
                        <a href={`https://jirasegurosbolivar.atlassian.net/browse/${item.ticket.key}`} target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline text-sm">{item.ticket.key}</a>
                        <span className="text-xs text-gray-400">{item.ticket.issueType}</span>
                      </div>
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{item.ticket.status}</span>
                    </div>
                    <p className="text-sm font-medium text-gray-900 mb-2">{item.ticket.summary}</p>
                    <div className="space-y-1">
                      <p className="text-xs text-gray-600"><span className="font-medium text-gray-700">Área:</span> {item.affectedArea}</p>
                      <p className="text-xs text-gray-600"><span className="font-medium text-gray-700">Causa raíz sugerida:</span> {item.rootCauseSuggestion}</p>
                      <p className="text-xs text-primary"><span className="font-medium">Sugerencia:</span> {item.resolutionSuggestion}</p>
                    </div>
                    {item.ticket.assignee && <p className="text-xs text-gray-400 mt-1">Asignado a: {item.ticket.assignee}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : mode === 'dashboards' ? (
          <>
            <div className="relative">
              <input type="text" className="w-full border border-gray-300 rounded-lg p-2.5 pl-9 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Buscar dashboard..." value={searchFilter} onChange={(e) => setSearchFilter(e.target.value)} />
              <svg className="absolute left-3 top-3 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <div className="space-y-2 max-h-72 overflow-y-auto border border-gray-200 rounded-lg p-2">
              {dashboards.filter(d => !searchFilter || d.title.toLowerCase().includes(searchFilter.toLowerCase())).map(db => (
                <div key={db.id} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                  <span className="text-xl">📊</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{db.title}</p>
                    <p className="text-xs text-gray-500">{db.author} · {db.modified ? new Date(db.modified).toLocaleDateString() : ''}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <a href={db.url} target="_blank" rel="noopener noreferrer" className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 border border-gray-200 rounded hover:bg-gray-100">Ver</a>
                    <button onClick={() => handleAnalyzeDashboard(db.id)} disabled={analyzingDashboard === db.id}
                      className="text-xs text-white bg-purple-600 hover:bg-purple-700 px-2 py-1 rounded disabled:opacity-50">
                      {analyzingDashboard === db.id ? '...' : 'Analizar'}
                    </button>
                  </div>
                </div>
              ))}
              {dashboards.length === 0 && <p className="text-sm text-gray-400 py-4 text-center">No se encontraron dashboards.</p>}
            </div>
          </>
        ) : services.length === 0 ? (
          <p className="text-sm text-gray-400 py-8 text-center">No se encontraron servicios en Datadog.</p>
        ) : (
          <>
            <div className="relative">
              <input type="text" className="w-full border border-gray-300 rounded-lg p-2.5 pl-9 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Buscar servicio..." value={searchFilter} onChange={(e) => setSearchFilter(e.target.value)} />
              <svg className="absolute left-3 top-3 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              {searchFilter && <button onClick={() => setSearchFilter('')} className="absolute right-3 top-3 text-gray-400 hover:text-gray-600">✕</button>}
            </div>

            <div className="flex items-center gap-3 text-xs">
              <button onClick={selectAll} className="text-primary hover:underline">Seleccionar todos</button>
              <button onClick={deselectAll} className="text-gray-500 hover:underline">Deseleccionar todos</button>
              <span className="text-gray-400">{selectedServices.size} seleccionado(s)</span>
            </div>

            <div className="space-y-1 max-h-72 overflow-y-auto border border-gray-200 rounded-lg p-2">
              {filteredServices.length === 0 && <p className="text-sm text-gray-400 py-2 text-center">Sin resultados para "{searchFilter}"</p>}
              {filteredServices.map(svc => (
                <label key={svc} className="flex items-center gap-2 p-2 rounded hover:bg-gray-50 cursor-pointer">
                  <input type="checkbox" checked={selectedServices.has(svc)} onChange={() => toggleService(svc)}
                    className="rounded border-gray-300 text-purple-600 focus:ring-purple-500" />
                  <span className="text-sm text-gray-700">{svc}</span>
                </label>
              ))}
            </div>

            <button onClick={handleAnalyze} disabled={selectedServices.size === 0}
              className="w-full bg-purple-600 text-white py-2.5 px-4 rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50 transition-colors">
              Analizar ({selectedServices.size} servicio{selectedServices.size !== 1 ? 's' : ''})
            </button>
          </>
        )}
      </div>
    );
  }

  // Results
  if (viewState === 'results') {
    const critGroups: SuggestedCriticality[] = ['critical', 'high', 'medium', 'low'];

    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Análisis de Hallazgos</h2>
            <p className="text-xs text-gray-500 mt-0.5">{[...selectedServices].join(', ')}</p>
          </div>
          <button onClick={handleReset} className="text-xs text-gray-500 hover:text-gray-700 shrink-0">← Nuevo análisis</button>
        </div>

        {/* Metrics */}
        {metrics && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white border border-gray-200 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-purple-700">{metrics.totalFindings}</p>
              <p className="text-xs text-gray-500">Total hallazgos</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-red-600">{metrics.distributionByCriticality.critical}</p>
              <p className="text-xs text-gray-500">🔴 Critical</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-orange-600">{metrics.distributionByCriticality.high}</p>
              <p className="text-xs text-gray-500">🟠 High</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-3 text-center">
              <div className="flex justify-center gap-3 text-sm">
                <span className="text-yellow-600">{metrics.distributionByCriticality.medium} med</span>
                <span className="text-green-600">{metrics.distributionByCriticality.low} low</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {metrics.distributionByType.log > 0 && `${metrics.distributionByType.log} logs `}
                {metrics.distributionByType.monitor > 0 && `${metrics.distributionByType.monitor} mon `}
                {metrics.distributionByType.incident > 0 && `${metrics.distributionByType.incident} inc`}
              </p>
            </div>
          </div>
        )}

        {dashboardInsights && (
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-purple-800 mb-2">Resumen del Agente IA Support</h3>
            <p className="text-sm text-purple-700 whitespace-pre-line">{dashboardInsights}</p>
          </div>
        )}

        {sloStatus.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-700">SLOs ({sloStatus.filter(s => s.status === 'breached').length} BREACHED de {sloStatus.length})</h3>
            <div className="space-y-2">
              {sloStatus.map((slo, i) => (
                <div key={i} className={`flex items-center justify-between p-3 rounded-lg border ${slo.status === 'breached' ? 'bg-red-50 border-red-200' : slo.status === 'warning' ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'}`}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{slo.name}</p>
                    <p className="text-xs text-gray-500">{slo.service ? `Servicio: ${slo.service} · ` : ''}Target: {slo.target}%{slo.errorBudget !== null ? ` · Error budget: ${slo.errorBudget.toFixed(1)}%` : ''}</p>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <p className={`text-lg font-bold ${slo.status === 'breached' ? 'text-red-600' : slo.status === 'warning' ? 'text-amber-600' : 'text-green-600'}`}>{slo.score.toFixed(1)}%</p>
                    <p className={`text-xs font-medium ${slo.status === 'breached' ? 'text-red-600' : slo.status === 'warning' ? 'text-amber-600' : 'text-green-600'}`}>{slo.status.toUpperCase()}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {findings.length === 0 && (
          <p className="text-sm text-gray-400 py-8 text-center">No se encontraron hallazgos para los servicios seleccionados.</p>
        )}

        {/* Findings by criticality */}
        {critGroups.map(crit => {
          const group = findings.filter(f => f.suggestedCriticality === crit);
          if (group.length === 0) return null;
          return (
            <div key={crit} className="space-y-3">
              <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold ${CRIT_COLOR[crit]}`}>
                {CRIT_ICON[crit]} {crit.toUpperCase()} ({group.length})
              </div>
              <div className="space-y-2">
                {group.map(f => (
                  <FindingCard key={f.finding.id} item={f} isJiraConnected={isJiraConnected}
                    createdIssue={createdIssues[f.finding.id]} onCreateIssue={() => setIssueModal(f)}
                    projectKey={selectedProjectKey} credentialKey={jiraCredentialKey} />
                ))}
              </div>
            </div>
          );
        })}

        {/* Create Issue Modal */}
        {issueModal && isJiraConnected && (
          <CreateIssueModal finding={issueModal} projectKey={selectedProjectKey || ''} credentialKey={jiraCredentialKey || 'jira-main'}
            onClose={() => setIssueModal(null)}
            onCreated={(key, url) => { setCreatedIssues(prev => ({ ...prev, [issueModal.finding.id]: { key, url } })); setIssueModal(null); }} />
        )}
      </div>
    );
  }

  return null;
}

function FindingCard({ item, isJiraConnected, createdIssue, onCreateIssue }: {
  item: AnalyzedFinding; isJiraConnected: boolean;
  createdIssue?: { key: string; url: string }; onCreateIssue: () => void;
  projectKey: string | null; credentialKey: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="border border-gray-200 rounded-lg p-4 space-y-2 bg-white">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-mono bg-purple-100 text-purple-700 px-2 py-0.5 rounded">{TYPE_LABEL[item.finding.type]}</span>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${CRIT_COLOR[item.suggestedCriticality]}`}>
            {CRIT_ICON[item.suggestedCriticality]} {item.suggestedCriticality}
          </span>
          <span className="text-xs text-gray-500">{item.affectedService}</span>
        </div>
        <button onClick={() => setExpanded(v => !v)} className="text-xs text-primary hover:underline shrink-0">
          {expanded ? 'Ocultar' : 'Ver detalle'}
        </button>
      </div>

      <p className="text-sm text-gray-800 font-medium">{item.finding.title}</p>
      <p className="text-xs text-gray-600">{item.resolutionSuggestion}</p>

      <span className="inline-block text-xs bg-indigo-50 text-indigo-600 border border-indigo-200 px-2 py-0.5 rounded-full font-medium">
        {item.label}
      </span>

      {expanded && (
        <div className="mt-3 space-y-3 border-t border-gray-100 pt-3">
          <div>
            <p className="text-xs font-semibold text-gray-600 mb-1">Causa raíz y pasos de resolución</p>
            <ol className="list-decimal list-inside space-y-1">
              {item.resolutionSteps.map((step, i) => <li key={i} className="text-xs text-gray-600">{step}</li>)}
            </ol>
          </div>
          {item.affectedEndpoint && <p className="text-xs text-gray-500">Endpoint: <span className="font-mono">{item.affectedEndpoint}</span></p>}
          <p className="text-xs text-gray-400">Timestamp: {item.finding.timestamp}</p>
        </div>
      )}

      {isJiraConnected && !createdIssue && (
        <div className="pt-2 border-t border-gray-100">
          <button onClick={onCreateIssue} className="text-xs font-medium text-primary hover:underline">Crear Issue en Jira</button>
        </div>
      )}
      {createdIssue && (
        <div className="pt-2 border-t border-gray-100 text-xs text-green-700">
          ✅ Issue creado: <a href={createdIssue.url} target="_blank" rel="noopener noreferrer" className="font-medium underline">{createdIssue.key}</a>
        </div>
      )}
    </div>
  );
}

function CreateIssueModal({ finding, projectKey, credentialKey, onClose, onCreated }: {
  finding: AnalyzedFinding; projectKey: string; credentialKey: string;
  onClose: () => void; onCreated: (key: string, url: string) => void;
}) {
  const [title, setTitle] = useState(`[Datadog] ${finding.finding.title}`);
  const [description, setDescription] = useState(`${finding.finding.message}\n\nCausa raíz: ${finding.resolutionSuggestion}\n\nPasos:\n${finding.resolutionSteps.map((s, i) => `${i + 1}. ${s}`).join('\n')}`);
  const [severity, setSeverity] = useState(finding.suggestedCriticality);
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleCreate = async () => {
    setCreating(true);
    setErr(null);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || '/api'}/support/datadog/create-issue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ findingId: finding.finding.id, projectKey, credentialKey, title, description, severity, component: finding.affectedService }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(typeof e.error === 'string' ? e.error : 'Error al crear issue'); }
      const result = await res.json();
      onCreated(result.issueKey || result.jiraKey || 'created', result.issueUrl || result.url || '#');
    } catch (e: any) { setErr(e.message); }
    finally { setCreating(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 p-6 space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">Crear Issue en Jira</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Título</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Descripción</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={5}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Severidad</label>
            <select value={severity} onChange={(e) => setSeverity(e.target.value as SuggestedCriticality)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
        </div>
        {err && <div className="rounded-lg p-3 text-sm bg-red-50 text-red-700 border border-red-200">{err}</div>}
        <div className="flex gap-3 justify-end">
          <button onClick={onClose} disabled={creating} className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50">Cancelar</button>
          <button onClick={handleCreate} disabled={creating || !title.trim()} className="px-4 py-2 text-sm text-white bg-primary rounded-lg hover:bg-primary-dark disabled:opacity-50">
            {creating ? 'Creando...' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
}
