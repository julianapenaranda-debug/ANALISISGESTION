import { useState } from 'react';
import { apiClient } from '../api/client';
import { useAppStore } from '../store/useAppStore';
import type { ConnectionResult } from '@po-ai/shared';

interface ServiceConfig {
  id: 'jira' | 'figma' | 'datadog';
  name: string;
  icon: string;
  fields: { key: string; label: string; type: string; placeholder: string }[];
}

const SERVICES: ServiceConfig[] = [
  {
    id: 'jira',
    name: 'Jira',
    icon: '🔷',
    fields: [
      { key: 'baseUrl', label: 'URL de Jira', type: 'text', placeholder: 'https://tu-empresa.atlassian.net' },
      { key: 'email', label: 'Email', type: 'email', placeholder: 'tu@empresa.com' },
      { key: 'apiToken', label: 'API Token', type: 'password', placeholder: 'Tu API token de Jira' },
    ],
  },
  {
    id: 'figma',
    name: 'Figma',
    icon: '🎨',
    fields: [
      { key: 'accessToken', label: 'Access Token', type: 'password', placeholder: 'Tu token de acceso de Figma' },
    ],
  },
  {
    id: 'datadog',
    name: 'Datadog',
    icon: '🐶',
    fields: [
      { key: 'apiKey', label: 'API Key', type: 'password', placeholder: 'Tu API key de Datadog' },
      { key: 'appKey', label: 'Application Key', type: 'password', placeholder: 'Tu Application key de Datadog' },
      { key: 'site', label: 'Site', type: 'text', placeholder: 'datadoghq.com' },
    ],
  },
];

export default function ConnectionsView() {
  const { connections, setConnectionStatus } = useAppStore();

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-1">Conexiones</h2>
        <p className="text-sm text-gray-500">Configura tus credenciales para cada servicio externo.</p>
      </div>

      <div className="space-y-4">
        {SERVICES.map((service) => (
          <ServiceCard
            key={service.id}
            service={service}
            status={connections[service.id]}
            onStatusChange={(status) => setConnectionStatus(service.id, status)}
          />
        ))}
      </div>
    </div>
  );
}

function ServiceCard({
  service,
  status,
  onStatusChange,
}: {
  service: ServiceConfig;
  status: string;
  onStatusChange: (status: 'connected' | 'disconnected') => void;
}) {
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isConnected = status === 'connected';

  const handleConnect = async () => {
    const missing = service.fields.filter((f) => !formData[f.key]?.trim());
    if (missing.length > 0) {
      setError(`Completa todos los campos.`);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const result = await apiClient.post<ConnectionResult>(
        `/connections/${service.id}`,
        formData
      );
      if (result.status === 'connected') {
        onStatusChange('connected');
        setFormData({});
      } else {
        setError(result.error || 'Error al conectar.');
      }
    } catch (err: any) {
      setError(err.message || 'No se pudo conectar con el servicio.');
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setLoading(true);
    setError('');
    try {
      await apiClient.delete(`/connections/${service.id}`);
      onStatusChange('disconnected');
    } catch (err: any) {
      setError(err.message || 'Error al desconectar.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">{service.icon}</span>
          <span className="text-sm font-semibold text-gray-900">{service.name}</span>
        </div>
        <span
          className={`inline-block w-2.5 h-2.5 rounded-full ${
            isConnected ? 'bg-green-500' : 'bg-gray-300'
          }`}
        />
      </div>

      {isConnected ? (
        <div className="flex items-center justify-between">
          <span className="text-sm text-green-700">Conectado</span>
          <button
            onClick={handleDisconnect}
            disabled={loading}
            className="text-sm text-red-600 hover:text-red-700 font-medium disabled:opacity-50"
          >
            {loading ? 'Desconectando...' : 'Desconectar'}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {service.fields.map((field) => (
            <div key={field.key}>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {field.label}
              </label>
              <input
                type={field.type}
                className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder={field.placeholder}
                value={formData[field.key] || ''}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, [field.key]: e.target.value }))
                }
              />
            </div>
          ))}

          <button
            onClick={handleConnect}
            disabled={loading}
            className="w-full bg-primary text-white py-2.5 px-4 rounded-lg text-sm font-medium hover:bg-primary-dark disabled:opacity-50 transition-colors"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Validando...
              </span>
            ) : (
              'Conectar'
            )}
          </button>
        </div>
      )}

      {error && (
        <div className="rounded-lg p-3 text-sm bg-red-50 text-red-700 border border-red-200">
          {error}
        </div>
      )}
    </div>
  );
}
