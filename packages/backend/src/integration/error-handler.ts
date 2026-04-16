/**
 * Global Error Handler
 *
 * Tipos, códigos y mecanismos de recuperación para errores del sistema.
 *
 * Requerimientos: 5.6, 6.3, 11.5
 */

export type ErrorCode =
  | 'JIRA_AUTH_FAILED'
  | 'JIRA_PERMISSION_DENIED'
  | 'JIRA_NOT_FOUND'
  | 'JIRA_RATE_LIMITED'
  | 'JIRA_COMPONENT_NOT_FOUND'
  | 'FIGMA_ACCESS_DENIED'
  | 'FIGMA_INVALID_URL'
  | 'FIGMA_AUTH_FAILED'
  | 'DATADOG_AUTH_FAILED'
  | 'DATADOG_PERMISSION_DENIED'
  | 'SERVICE_UNREACHABLE'
  | 'INVALID_STORY_FORMAT'
  | 'INVEST_VALIDATION_FAILED'
  | 'AMBIGUOUS_DESCRIPTION'
  | 'NETWORK_ERROR'
  | 'STORAGE_ERROR'
  | 'UNKNOWN_ERROR';

export interface AppError {
  code: ErrorCode;
  message: string;
  details?: any;
  retryable: boolean;
}

export interface ErrorResponse {
  error: AppError;
  timestamp: string;
  requestId?: string;
}

/**
 * Crea un AppError estandarizado
 */
export function createError(
  code: ErrorCode,
  message: string,
  details?: any
): AppError {
  const retryable = isRetryable(code);
  return { code, message, details, retryable };
}

/**
 * Determina si un error es reintentable
 */
function isRetryable(code: ErrorCode): boolean {
  return code === 'NETWORK_ERROR' || code === 'SERVICE_UNREACHABLE' || code === 'JIRA_RATE_LIMITED';
}

/**
 * Convierte un error genérico a AppError
 */
export function normalizeError(error: any): AppError {
  if (error?.code && isValidErrorCode(error.code)) {
    return createError(error.code as ErrorCode, error.message, error.details);
  }

  if (error?.message?.includes('JIRA_AUTH_FAILED')) {
    return createError('JIRA_AUTH_FAILED', 'Credenciales de Jira inválidas. Verifica tu email y API token.');
  }

  if (error?.message?.includes('JIRA_PERMISSION_DENIED')) {
    return createError('JIRA_PERMISSION_DENIED', 'No tienes permisos para realizar esta operación en Jira.');
  }

  // Figma errors (from figma-analyzer.ts figmaRequest)
  if (error?.code === 'FIGMA_FORBIDDEN') {
    return createError('FIGMA_AUTH_FAILED', 'Token de Figma sin permisos para acceder a este archivo.', { statusCode: error.statusCode });
  }

  if (error?.code === 'FIGMA_NOT_FOUND') {
    return createError('FIGMA_AUTH_FAILED', 'Archivo de Figma no encontrado. Verifica la URL.', { statusCode: error.statusCode });
  }

  // Datadog errors (from datadog-connector.ts datadogRequest)
  if (error?.code === 'DATADOG_PERMISSION_DENIED') {
    return createError('DATADOG_PERMISSION_DENIED', error.message || 'Credenciales de Datadog inválidas o sin permisos suficientes.', { statusCode: error.statusCode });
  }

  if (typeof error?.code === 'string' && error.code.startsWith('DATADOG_ERROR_')) {
    return createError('DATADOG_AUTH_FAILED', error.message || 'Credenciales de Datadog inválidas.', { statusCode: error.statusCode });
  }

  // Network errors → SERVICE_UNREACHABLE
  if (error?.code === 'ECONNREFUSED' || error?.code === 'ENOTFOUND' || error?.code === 'ETIMEDOUT') {
    return createError('SERVICE_UNREACHABLE', 'No se pudo conectar con el servicio. Verifica tu conexión de red.', { originalCode: error.code });
  }

  return createError('UNKNOWN_ERROR', error?.message || 'Error desconocido');
}

function isValidErrorCode(code: string): boolean {
  const validCodes: ErrorCode[] = [
    'JIRA_AUTH_FAILED', 'JIRA_PERMISSION_DENIED', 'JIRA_NOT_FOUND',
    'JIRA_RATE_LIMITED', 'JIRA_COMPONENT_NOT_FOUND', 'FIGMA_ACCESS_DENIED',
    'FIGMA_INVALID_URL', 'FIGMA_AUTH_FAILED', 'DATADOG_AUTH_FAILED',
    'DATADOG_PERMISSION_DENIED', 'SERVICE_UNREACHABLE',
    'INVALID_STORY_FORMAT', 'INVEST_VALIDATION_FAILED',
    'AMBIGUOUS_DESCRIPTION', 'NETWORK_ERROR', 'STORAGE_ERROR', 'UNKNOWN_ERROR',
  ];
  return validCodes.includes(code as ErrorCode);
}

/**
 * Ejecuta una función con retry y exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelayMs = 1000
): Promise<T> {
  let lastError: any;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      const appError = normalizeError(error);

      if (!appError.retryable) {
        throw error;
      }

      if (attempt < maxRetries - 1) {
        const delay = baseDelayMs * Math.pow(2, attempt);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }

  throw lastError;
}

/**
 * Formatea un error para respuesta HTTP
 */
export function formatErrorResponse(error: any, requestId?: string): ErrorResponse {
  const appError = normalizeError(error);
  return {
    error: appError,
    timestamp: new Date().toISOString(),
    requestId,
  };
}
