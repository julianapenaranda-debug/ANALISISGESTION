// Tipos compartidos para el Panel de Conexiones (Autenticación Unificada)

/**
 * Estado de conexión de un servicio externo.
 */
export type ConnectionStatus = 'connected' | 'disconnected' | 'error';

/**
 * Respuesta del endpoint GET /api/connections/status.
 * Contiene el estado de conexión de cada servicio externo.
 */
export interface ConnectionStatusResponse {
  jira: ConnectionStatus;
  figma: ConnectionStatus;
  datadog: ConnectionStatus;
}

/**
 * Resultado de una operación de conexión (POST /api/connections/:service).
 */
export interface ConnectionResult {
  status: ConnectionStatus;
  displayName?: string;
  error?: string;
}
