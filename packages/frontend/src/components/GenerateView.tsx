import { useState } from 'react';
import { apiClient } from '../api/client';
import { useAppStore } from '../store/useAppStore';

export default function GenerateView() {
  const [description, setDescription] = useState('');
  const [productContext, setProductContext] = useState('');
  const [businessObjective, setBusinessObjective] = useState('');
  const [figmaUrl, setFigmaUrl] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [error, setError] = useState('');
  const [figmaWarning, setFigmaWarning] = useState('');
  const { setStories, setEpics, setAmbiguities, setIsLoading, isLoading, setCurrentView, connections } = useAppStore();
  const figmaConnected = connections.figma === 'connected';

  const handleGenerate = async () => {
    if (!description.trim()) {
      setError('Por favor ingresa una descripción de la funcionalidad.');
      return;
    }
    setError('');
    setIsLoading(true);

    try {
      const result: any = await apiClient.post('/stories/generate', {
        description,
        ...(productContext ? { productContext } : {}),
        ...(businessObjective ? { businessObjective } : {}),
        ...(figmaUrl ? { figmaData: { figmaUrl } } : {}),
      });

      // Capture figmaWarning from response (non-blocking)
      if (result.figmaWarning) {
        setFigmaWarning(result.figmaWarning);
      } else {
        setFigmaWarning('');
      }

      if (result.ambiguities?.length > 0 && result.stories?.length === 0) {
        setAmbiguities(result.ambiguities);
        setError('Se detectaron ambigüedades. Revisa las preguntas de aclaración.');
      } else {
        setStories(result.stories || []);
        setEpics(result.epics || []);
        setAmbiguities(result.ambiguities || []);
        setCurrentView('stories');
      }
    } catch (err: any) {
      setError(err.message || 'Error al generar historias');
    } finally {
      setIsLoading(false);
    }
  };

  const { ambiguities } = useAppStore();

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-1">Generar Historias de Usuario</h2>
        <p className="text-sm text-gray-500">
          PO-Agile-Master generará HUs con criterios INVEST, roles específicos y criterios de aceptación en formato Dado-Cuando-Entonces.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Descripción de la funcionalidad *
          </label>
          <textarea
            className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            rows={5}
            placeholder="Ej: Necesitamos que los usuarios puedan buscar productos por nombre o categoría y ver los resultados con filtros de precio..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-sm text-primary hover:text-primary-dark font-medium"
        >
          {showAdvanced ? '▾ Ocultar contexto adicional' : '▸ Agregar contexto del producto (recomendado)'}
        </button>

        {showAdvanced && (
          <div className="space-y-4 border border-gray-100 rounded-lg p-4 bg-gray-50">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Contexto del Producto
              </label>
              <textarea
                className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none bg-white"
                rows={3}
                placeholder="Ej: Aplicación móvil de e-commerce para venta de productos orgánicos a consumidores en Latinoamérica..."
                value={productContext}
                onChange={(e) => setProductContext(e.target.value)}
              />
              <p className="text-xs text-gray-400 mt-1">Describe el producto, su visión y usuarios principales.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Objetivo de Negocio Actual
              </label>
              <input
                type="text"
                className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white"
                placeholder="Ej: Incrementar la tasa de conversión en un 15% durante el próximo trimestre"
                value={businessObjective}
                onChange={(e) => setBusinessObjective(e.target.value)}
              />
              <p className="text-xs text-gray-400 mt-1">El objetivo que guía el desarrollo actual.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                URL de Figma (opcional)
                {figmaConnected && (
                  <span className="ml-2 text-xs text-green-600 font-normal">● Conectado</span>
                )}
              </label>
              <input
                type="text"
                className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white"
                placeholder="https://www.figma.com/file/..."
                value={figmaUrl}
                onChange={(e) => setFigmaUrl(e.target.value)}
              />
              {!figmaConnected && figmaUrl && (
                <p className="text-xs text-amber-600 mt-1">
                  Sin conexión a Figma se usarán datos de ejemplo.{' '}
                  <button onClick={() => setCurrentView('connections')} className="underline hover:no-underline">Conectar</button>
                </p>
              )}
            </div>
          </div>
        )}

        {figmaWarning && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-700">
            <span className="font-medium">⚠ Advertencia de Figma:</span> {figmaWarning}
            {figmaWarning.includes('no está conectado') && (
              <button
                onClick={() => setCurrentView('connections')}
                className="ml-2 underline hover:no-underline font-medium"
              >
                Ir a Conexiones
              </button>
            )}
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{error}</div>
        )}

        {ambiguities.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 space-y-3">
            <h3 className="text-sm font-semibold text-yellow-800">Preguntas de aclaración</h3>
            {ambiguities.map((a) => (
              <div key={a.id} className="text-sm text-yellow-700">
                <p className="font-medium">{a.question}</p>
                {a.suggestions.length > 0 && (
                  <ul className="mt-1 ml-4 list-disc text-yellow-600">
                    {a.suggestions.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}

        <button
          onClick={handleGenerate}
          disabled={isLoading}
          className="w-full bg-primary text-white py-2.5 px-4 rounded-lg text-sm font-medium hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? 'Generando con PO-Agile-Master...' : 'Generar Historias'}
        </button>
      </div>
    </div>
  );
}
