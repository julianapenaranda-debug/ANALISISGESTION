
import { useEffect } from 'react';
import { useAppStore } from './store/useAppStore';
import GenerateView from './components/GenerateView';
import StoriesView from './components/StoriesView';
import JiraView from './components/JiraView';
import ExportView from './components/ExportView';
import MetricsView from './components/MetricsView';
import WorkloadView from './components/WorkloadView';
import FlowMetricsView from './components/FlowMetricsView';
import ConnectionsView from './components/ConnectionsView';

const NAV_ITEMS = [
  { id: 'generate', label: 'Generar' },
  { id: 'stories', label: 'Historias' },
  { id: 'jira', label: 'Iniciativas en Jira' },
  { id: 'export', label: 'Exportar' },
  { id: 'metrics', label: 'Métricas de iniciativa' },
  { id: 'workload', label: 'Métricas del equipo' },
  { id: 'flow-metrics', label: 'Métricas de Flujo' },
  { id: 'connections', label: 'Conexiones' },
] as const;

function App() {
  const { currentView, setCurrentView, stories, isLoading, connections, fetchConnectionStatus } = useAppStore();

  useEffect(() => {
    fetchConnectionStatus();
  }, [fetchConnectionStatus]);

  const hasDisconnected = Object.values(connections).some((s) => s === 'disconnected');

  const renderView = () => {
    switch (currentView) {
      case 'generate': return <GenerateView />;
      case 'stories': return <StoriesView />;
      case 'jira': return <JiraView />;
      case 'export': return <ExportView />;
      case 'metrics': return <MetricsView />;
      case 'workload': return <WorkloadView />;
      case 'flow-metrics': return <FlowMetricsView />;
      case 'connections': return <ConnectionsView />;
      default: return <GenerateView />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-2">
              <img src="/logo.png" alt="Seguros Bolívar" className="h-6" /> <span className="text-sm font-bold text-primary">PO AI</span>
              {stories.length > 0 && (
                <span className="text-xs bg-primary-light/30 text-primary px-1.5 py-0.5 rounded-full font-medium">
                  {stories.length} historias
                </span>
              )}
            </div>

            <nav className="flex items-center gap-1">
              {NAV_ITEMS.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setCurrentView(item.id)}
                  className={`relative px-2 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                    currentView === item.id
                      ? 'bg-primary/10 text-primary'
                      : 'text-grey-600 hover:text-[#1B1B1B] hover:bg-grey-200'
                  }`}
                >
                  {item.label}
                  {item.id === 'connections' && hasDisconnected && (
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-warning rounded-full" />
                  )}
                </button>
              ))}
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {isLoading && (
          <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg px-6 py-4 shadow-lg text-sm text-gray-700">
              Procesando...
            </div>
          </div>
        )}
        {renderView()}
      </main>
    </div>
  );
}

export default App;
