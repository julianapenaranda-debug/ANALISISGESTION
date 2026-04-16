/**
 * Unit tests for Datadog Connector
 *
 * Tests datadogRequest() and validateDatadog() with mocked HTTPS responses.
 * Requerimientos: 9.1, 9.2, 9.3, 9.4
 */

import https from 'https';
import { EventEmitter } from 'events';
import { datadogRequest, validateDatadog, DatadogCredentials } from '../../../src/integration/datadog-connector';

// Mock https module
jest.mock('https');

const mockedHttps = https as jest.Mocked<typeof https>;

function createMockResponse(statusCode: number, body: any): EventEmitter {
  const res = new EventEmitter() as any;
  res.statusCode = statusCode;
  process.nextTick(() => {
    res.emit('data', JSON.stringify(body));
    res.emit('end');
  });
  return res;
}

function setupMockRequest(statusCode: number, body: any) {
  const mockReq = new EventEmitter() as any;
  mockReq.write = jest.fn();
  mockReq.end = jest.fn();

  mockedHttps.request = jest.fn((_options: any, callback: any) => {
    const res = createMockResponse(statusCode, body);
    callback(res);
    return mockReq;
  }) as any;

  return mockReq as EventEmitter & { write: jest.Mock; end: jest.Mock };
}

function setupMockRequestNetworkError(errorCode: string) {
  const mockReq = new EventEmitter() as any;
  mockReq.write = jest.fn();
  mockReq.end = jest.fn();

  mockedHttps.request = jest.fn((_options: any, _callback: any) => {
    process.nextTick(() => {
      const err = Object.assign(new Error('connect failed'), { code: errorCode });
      mockReq.emit('error', err);
    });
    return mockReq;
  }) as any;

  return mockReq;
}

const validCredentials: DatadogCredentials = {
  apiKey: 'test-api-key',
  appKey: 'test-app-key',
  site: 'datadoghq.com',
};

describe('datadogRequest', () => {
  it('should construct URL with api.{site} hostname', async () => {
    setupMockRequest(200, { valid: true });

    await datadogRequest(validCredentials, 'GET', '/api/v1/validate');

    expect(mockedHttps.request).toHaveBeenCalledWith(
      expect.objectContaining({
        hostname: 'api.datadoghq.com',
        path: '/api/v1/validate',
        method: 'GET',
      }),
      expect.any(Function)
    );
  });

  it('should use correct hostname for EU site', async () => {
    const euCredentials: DatadogCredentials = { ...validCredentials, site: 'datadoghq.eu' };
    setupMockRequest(200, { ok: true });

    await datadogRequest(euCredentials, 'GET', '/api/v1/metrics');

    expect(mockedHttps.request).toHaveBeenCalledWith(
      expect.objectContaining({ hostname: 'api.datadoghq.eu' }),
      expect.any(Function)
    );
  });

  it('should include DD-API-KEY and DD-APPLICATION-KEY headers', async () => {
    setupMockRequest(200, { valid: true });

    await datadogRequest(validCredentials, 'GET', '/api/v1/validate');

    expect(mockedHttps.request).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: expect.objectContaining({
          'DD-API-KEY': 'test-api-key',
          'DD-APPLICATION-KEY': 'test-app-key',
        }),
      }),
      expect.any(Function)
    );
  });

  it('should resolve with parsed JSON on success', async () => {
    setupMockRequest(200, { valid: true });

    const result = await datadogRequest(validCredentials, 'GET', '/api/v1/validate');

    expect(result).toEqual({ valid: true });
  });

  it('should reject with specific message on 403', async () => {
    setupMockRequest(403, { errors: ['Forbidden'] });

    await expect(datadogRequest(validCredentials, 'GET', '/api/v1/validate'))
      .rejects.toMatchObject({
        message: 'Credenciales de Datadog inválidas o sin permisos suficientes.',
        code: 'DATADOG_PERMISSION_DENIED',
        statusCode: 403,
      });
  });

  it('should reject with error message on other 4xx/5xx', async () => {
    setupMockRequest(401, { errors: ['Bad API key'] });

    await expect(datadogRequest(validCredentials, 'GET', '/api/v1/validate'))
      .rejects.toMatchObject({
        code: 'DATADOG_ERROR_401',
        statusCode: 401,
      });
  });

  it('should send body for POST requests', async () => {
    const mockReq = setupMockRequest(200, { status: 'ok' });

    await datadogRequest(validCredentials, 'POST', '/api/v1/some-endpoint', { query: 'test' });

    expect(mockReq.write).toHaveBeenCalledWith(JSON.stringify({ query: 'test' }));
  });

  it('should propagate network errors', async () => {
    setupMockRequestNetworkError('ECONNREFUSED');

    await expect(datadogRequest(validCredentials, 'GET', '/api/v1/validate'))
      .rejects.toMatchObject({ code: 'ECONNREFUSED' });
  });
});

describe('validateDatadog', () => {
  it('should return valid: true when API returns valid: true', async () => {
    setupMockRequest(200, { valid: true });

    const result = await validateDatadog(validCredentials);

    expect(result).toEqual({ valid: true });
  });

  it('should return valid: false when API returns valid: false', async () => {
    setupMockRequest(200, { valid: false });

    const result = await validateDatadog(validCredentials);

    expect(result).toEqual({ valid: false, error: 'Credenciales de Datadog inválidas.' });
  });

  it('should return specific error message on 403', async () => {
    setupMockRequest(403, { errors: ['Forbidden'] });

    const result = await validateDatadog(validCredentials);

    expect(result).toEqual({
      valid: false,
      error: 'Credenciales de Datadog inválidas o sin permisos suficientes.',
    });
  });

  it('should return network error message on ECONNREFUSED', async () => {
    setupMockRequestNetworkError('ECONNREFUSED');

    const result = await validateDatadog(validCredentials);

    expect(result).toEqual({
      valid: false,
      error: 'No se pudo conectar con el servicio. Verifica tu conexión de red.',
    });
  });

  it('should return network error message on ENOTFOUND', async () => {
    setupMockRequestNetworkError('ENOTFOUND');

    const result = await validateDatadog(validCredentials);

    expect(result).toEqual({
      valid: false,
      error: 'No se pudo conectar con el servicio. Verifica tu conexión de red.',
    });
  });

  it('should return network error message on ETIMEDOUT', async () => {
    setupMockRequestNetworkError('ETIMEDOUT');

    const result = await validateDatadog(validCredentials);

    expect(result).toEqual({
      valid: false,
      error: 'No se pudo conectar con el servicio. Verifica tu conexión de red.',
    });
  });
});
