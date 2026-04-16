import { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { useAppStore } from '../store/useAppStore';

const CREDENTIAL_KEY = 'jira-main';

interface JiraProject {
  id: string;
  key: string;
  name: string;
  projectTypeKey: string;
  avatarUrl?: string;
}

type Step = 'projects' | 'ready';

export default function JiraView() {
  const {
    stories, epics, connections, jiraCredentialKey,
    setCurrentView, setSelectedProjectKey,
  } = useAppStore();

  const [step, setStep] = useState<Step>('projects');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [projects, setProjects] = useState<JiraProject[]>([]);
  const [selectedProject, setSelectedProject] = useState<JiraProject | null>(null);
  const [syncResult, setSyncResult] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const isConnected = connections.jira === 'connected';

  useEffect(() => {
    if (isConnected && step === 'projects' && projects.length === 0 && !loading) {
      loadProjects();
    }
  }, [isConnected]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadProjects = async () => {
    setLoading(true);
    setError('');
    try {
      const data: any = await apiClient.get(
        `/jira/projects?credentialKey=${CREDENTIAL_KEY}&prefix=GD,PRY`,
      );
      setProjects(data);
      setStep('projects');
    } catch (err: any) {
      setError(err.message || 'Error al cargar proyectos.');
    } finally {
      setLoading(false);
    }
  };


  const handleSelectProject = (project: JiraProject) => {
    setSelectedProject(project);
    setSelectedProjectKey(project.key);
    setStep('ready');
    setSyncResult(null);
  };

  const handleSync = async () => {
    if (!selectedProject || !jiraCredentialKey) return;
    if (stories.length === 0) {
      setError('No hay historias para sincronizar. Genera historias primero.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result: any = await apiClient.post('/jira/sync', {
        credentialKey: jiraCredentialKey,
        projectKey: selectedProject.key,
        stories,
        epics,
      });
      setSyncResult(result);
    } catch (err: any) {
      setError(err.message || 'Error durante la sincronización.');
    } finally {
      setLoading(false);
    }
  };

  const goToAnalysis = (view: string) => {
    setCurrentView(view as any);
  };


  if (!isConnected) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-1">Jira</h2>
          <p className="text-sm text-gray-500">Se requiere conexión con Jira para acceder a esta vista.</p>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-3">
          <p className="text-sm text-amber-800">
            Configura tus credenciales de Jira desde el Panel de Conexiones para poder acceder a tus proyectos.
          </p>
          <button
            onClick={() => setCurrentView('connections')}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline"
          >
            Ir al Panel de Conexiones →
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="max-w-4xl mx-auto space-y-6">      {step === 'projects' && (
        <>
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-1">Iniciativas Jira</h2>
            <p className="text-sm text-gray-500">
              {projects.length} proyecto{projects.length !== 1 ? 's' : ''} encontrado{projects.length !== 1 ? 's' : ''}
            </p>
          </div>

          {!loading && projects.length > 0 && (
            <div className="relative">
              <input
                type="text"
                className="w-full border border-gray-300 rounded-lg p-2.5 pl-9 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Buscar proyecto por nombre o clave..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <svg className="absolute left-3 top-3 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              )}
            </div>
          )}

          {loading && (
            <div className="flex items-center gap-2 text-sm text-gray-500 py-4">
              <div className="w-4 h-4 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
              Cargando proyectos...
            </div>
          )}
          {error && (
            <div className="rounded-lg p-3 text-sm bg-red-50 text-red-700 border border-red-200">{error}</div>
          )}
          {!loading && projects.length === 0 && !error && (
            <p className="text-sm text-gray-500 py-4 text-center">No se encontraron proyectos con actividad desde septiembre 2025.</p>
          )}
          <div className="space-y-2">
            {(() => {
              const q = searchQuery.toLowerCase().trim();
              const filtered = q
                ? projects.filter(p =>
                    p.name.toLowerCase().includes(q) ||
                    p.key.toLowerCase().includes(q) ||
                    p.projectTypeKey.toLowerCase().includes(q)
                  )
                : projects;
              if (q && filtered.length === 0) {
                return (
                  <p className="text-sm text-gray-400 py-4 text-center">
                    No se encontraron proyectos que coincidan con "{searchQuery}"
                  </p>
                );
              }
              return filtered.map((project) => (
                <button
                  key={project.key}
                  onClick={() => handleSelectProject(project)}
                  className="w-full flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors text-left"
                >
                  {project.avatarUrl && (
                    <img src={project.avatarUrl} alt="" className="w-8 h-8 rounded" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{project.name}</p>
                    <p className="text-xs text-gray-500">{project.key} · {project.projectTypeKey}</p>
                  </div>
                  <span className="text-xs text-blue-600">Seleccionar →</span>
                </button>
              ));
            })()}
          </div>
        </>
      )}


      {step === 'ready' && selectedProject && (
        <>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-1">{selectedProject.name}</h2>
              <p className="text-sm text-gray-500">
                <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-xs">{selectedProject.key}</span>
                {' · '}Selecciona un análisis para ejecutar
              </p>
            </div>
            <button
              onClick={() => setStep('projects')}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              ← Cambiar proyecto
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <AnalysisCard title="Carga de Trabajo" description="Analiza la distribución de HUs y productividad por desarrollador" icon="👥" onClick={() => goToAnalysis('workload')} />
            <AnalysisCard title="Métricas del Proyecto" description="Velocidad, cycle time, distribución por estado y cuellos de botella" icon="📊" onClick={() => goToAnalysis('metrics')} />
            <AnalysisCard title="Sincronizar Historias" description="Envía las historias generadas a este proyecto en Jira" icon="🔄" onClick={handleSync} disabled={stories.length === 0} badge={stories.length > 0 ? `${stories.length} historias` : undefined} />
          </div>
          {error && (
            <div className="rounded-lg p-3 text-sm bg-red-50 text-red-700 border border-red-200">{error}</div>
          )}
          {loading && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <div className="w-4 h-4 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
              Procesando...
            </div>
          )}


          {syncResult && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-2">
              <p className="text-sm font-semibold text-gray-700">
                Sincronización completa: {syncResult.created?.length || 0} creados, {syncResult.failed?.length || 0} fallidos
              </p>
              {syncResult.created?.map((ref: any) => (
                <div key={ref.jiraKey} className="flex items-center justify-between text-sm">
                  <span className="font-mono text-xs text-gray-600">{ref.jiraKey}</span>
                  <a href={ref.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-xs">
                    Ver en Jira →
                  </a>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function AnalysisCard({ title, description, icon, onClick, disabled, badge }: {
  title: string; description: string; icon: string; onClick: () => void; disabled?: boolean; badge?: string;
}) {
  return (
    <button onClick={onClick} disabled={disabled} className="flex flex-col gap-2 p-4 border border-gray-200 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors text-left disabled:opacity-40 disabled:cursor-not-allowed">
      <div className="flex items-center justify-between">
        <span className="text-2xl">{icon}</span>
        {badge && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">{badge}</span>}
      </div>
      <p className="text-sm font-semibold text-gray-900">{title}</p>
      <p className="text-xs text-gray-500 leading-relaxed">{description}</p>
    </button>
  );
}
