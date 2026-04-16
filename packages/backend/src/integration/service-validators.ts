/**
 * Service Validators
 *
 * Funciones de validación de credenciales para cada servicio externo.
 * Verifica credenciales contra las APIs reales antes de almacenarlas.
 *
 * Requerimientos: 3.1, 3.2, 3.3, 3.4
 */

import https from 'https';
import { authenticate, JiraCredentials } from './jira-connector';

export interface ValidationResult {
  valid: boolean;
  displayName?: string;
  error?: string;
}

const NETWORK_ERROR_MESSAGE = 'No se pudo conectar con el servicio. Verifica tu conexión de red.';

/**
 * Checks if an error is a network-level error (connection refused, DNS failure, timeout).
 */
function isNetworkError(error: any): boolean {
  const code = error?.code;
  return code === 'ECONNREFUSED' || code === 'ENOTFOUND' || code === 'ETIMEDOUT';
}

/**
 * Validates Jira credentials by reusing the existing authenticate() function
 * which calls /rest/api/3/myself.
 *
 * Requerimiento 3.1
 */
export async function validateJiraCredentials(credentials: JiraCredentials): Promise<ValidationResult> {
  try {
    const result = await authenticate(credentials);
    if (result.success) {
      return { valid: true, displayName: result.displayName };
    }
    return { valid: false, error: result.error || 'Error de autenticación de Jira.' };
  } catch (error: any) {
    if (isNetworkError(error)) {
      return { valid: false, error: NETWORK_ERROR_MESSAGE };
    }
    return { valid: false, error: error?.message || 'Error de autenticación de Jira.' };
  }
}


/**
 * Makes an HTTPS GET request and returns a promise with the parsed response.
 */
function httpsGet(
  hostname: string,
  path: string,
  headers: Record<string, string>
): Promise<{ statusCode: number; body: any }> {
  return new Promise((resolve, reject) => {
    const options = {
      hostname,
      port: 443,
      path,
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        ...headers,
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const body = data ? JSON.parse(data) : {};
          resolve({ statusCode: res.statusCode || 0, body });
        } catch {
          resolve({ statusCode: res.statusCode || 0, body: data });
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.end();
  });
}

/**
 * Validates a Figma access token by calling GET https://api.figma.com/v1/me
 * with the X-Figma-Token header.
 *
 * Requerimiento 3.2
 */
export async function validateFigmaToken(accessToken: string): Promise<ValidationResult> {
  try {
    const { statusCode, body } = await httpsGet(
      'api.figma.com',
      '/v1/me',
      { 'X-Figma-Token': accessToken }
    );

    if (statusCode === 200 && body?.handle) {
      return { valid: true, displayName: body.handle };
    }

    if (statusCode === 403) {
      return { valid: false, error: 'Token de Figma inválido o expirado.' };
    }

    return { valid: false, error: 'Token de Figma inválido o expirado.' };
  } catch (error: any) {
    if (isNetworkError(error)) {
      return { valid: false, error: NETWORK_ERROR_MESSAGE };
    }
    return { valid: false, error: error?.message || 'Token de Figma inválido o expirado.' };
  }
}

/**
 * Validates Datadog credentials by calling GET https://api.{site}/api/v1/validate
 * with DD-API-KEY and DD-APPLICATION-KEY headers.
 *
 * Requerimiento 3.3
 */
export async function validateDatadogCredentials(
  apiKey: string,
  appKey: string,
  site: string
): Promise<ValidationResult> {
  try {
    const hostname = `api.${site}`;
    const { statusCode, body } = await httpsGet(
      hostname,
      '/api/v1/validate',
      {
        'DD-API-KEY': apiKey,
        'DD-APPLICATION-KEY': appKey,
      }
    );

    if (statusCode === 200 && body?.valid === true) {
      return { valid: true };
    }

    if (statusCode === 403) {
      return { valid: false, error: 'Credenciales de Datadog inválidas o sin permisos suficientes.' };
    }

    return { valid: false, error: 'Credenciales de Datadog inválidas.' };
  } catch (error: any) {
    if (isNetworkError(error)) {
      return { valid: false, error: NETWORK_ERROR_MESSAGE };
    }
    return { valid: false, error: error?.message || 'Credenciales de Datadog inválidas.' };
  }
}
