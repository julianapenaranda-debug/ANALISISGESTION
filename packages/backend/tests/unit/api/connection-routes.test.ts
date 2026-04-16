/**
 * Unit tests for connection-routes.ts
 *
 * Tests the connection routes by creating a minimal Express app
 * and mocking the service validators and CredentialStore.
 *
 * Requerimientos: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 3.4
 */

import express, { Express } from 'express';
import { createConnectionRoutes } from '../../../src/api/connection-routes';
import { CredentialStore } from '../../../src/storage/credential-store';

// Mock service validators
jest.mock('../../../src/integration/service-validators', () => ({
  validateJiraCredentials: jest.fn(),
  validateFigmaToken: jest.fn(),
  validateDatadogCredentials: jest.fn(),
}));

import {
  validateJiraCredentials,
  validateFigmaToken,
  validateDatadogCredentials,
} from '../../../src/integration/service-validators';

const mockValidateJira = validateJiraCredentials as jest.MockedFunction<typeof validateJiraCredentials>;
const mockValidateFigma = validateFigmaToken as jest.MockedFunction<typeof validateFigmaToken>;
const mockValidateDatadog = validateDatadogCredentials as jest.MockedFunction<typeof validateDatadogCredentials>;

// Helper to make requests without supertest
async function makeRequest(app: Express, method: string, path: string, body?: any): Promise<{ status: number; body: any }> {
  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      const port = (server.address() as any).port;
      const url = `http://localhost:${port}${path}`;
      const options: RequestInit = {
        method,
        headers: { 'Content-Type': 'application/json' },
      };
      if (body) {
        options.body = JSON.stringify(body);
      }
      fetch(url, options)
        .then(async (res) => {
          const json = await res.json();
          server.close();
          resolve({ status: res.status, body: json });
        })
        .catch((err) => {
          server.close();
          resolve({ status: 500, body: { error: err.message } });
        });
    });
  });
}

describe('Connection Routes', () => {
  let app: Express;
  let mockStore: jest.Mocked<CredentialStore>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockStore = {
      store: jest.fn().mockResolvedValue(undefined),
      retrieve: jest.fn().mockResolvedValue(null),
      delete: jest.fn().mockResolvedValue(undefined),
      exists: jest.fn().mockResolvedValue(false),
      listKeys: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue(undefined),
    } as any;

    app = express();
    app.use(express.json());
    app.use('/api/connections', createConnectionRoutes(mockStore));
  });

  // ─── POST /api/connections/jira ───────────────────────────────────────

  describe('POST /api/connections/jira', () => {
    const validBody = { baseUrl: 'https://test.atlassian.net', email: 'user@test.com', apiToken: 'token123' };

    it('should return 200 and store credentials when validation succeeds', async () => {
      mockValidateJira.mockResolvedValue({ valid: true, displayName: 'Test User' });

      const res = await makeRequest(app, 'POST', '/api/connections/jira', validBody);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: 'connected', displayName: 'Test User' });
      expect(mockStore.store).toHaveBeenCalledWith('jira-main', validBody);
    });

    it('should return 401 when credentials are invalid', async () => {
      mockValidateJira.mockResolvedValue({ valid: false, error: 'Error de autenticación de Jira.' });

      const res = await makeRequest(app, 'POST', '/api/connections/jira', validBody);

      expect(res.status).toBe(401);
      expect(res.body).toEqual({ status: 'error', error: 'Error de autenticación de Jira.' });
      expect(mockStore.store).not.toHaveBeenCalled();
    });

    it('should return 502 on network error', async () => {
      mockValidateJira.mockResolvedValue({
        valid: false,
        error: 'No se pudo conectar con el servicio. Verifica tu conexión de red.',
      });

      const res = await makeRequest(app, 'POST', '/api/connections/jira', validBody);

      expect(res.status).toBe(502);
      expect(res.body.status).toBe('error');
      expect(mockStore.store).not.toHaveBeenCalled();
    });

    it('should return 400 when required fields are missing', async () => {
      const res = await makeRequest(app, 'POST', '/api/connections/jira', { baseUrl: 'https://test.atlassian.net' });

      expect(res.status).toBe(400);
      expect(res.body.status).toBe('error');
      expect(res.body.error).toContain('Campos requeridos');
    });
  });

  // ─── POST /api/connections/figma ──────────────────────────────────────

  describe('POST /api/connections/figma', () => {
    const validBody = { accessToken: 'figma-token-123' };

    it('should return 200 and store token when validation succeeds', async () => {
      mockValidateFigma.mockResolvedValue({ valid: true, displayName: 'figma_user' });

      const res = await makeRequest(app, 'POST', '/api/connections/figma', validBody);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: 'connected', displayName: 'figma_user' });
      expect(mockStore.store).toHaveBeenCalledWith('figma-main', validBody);
    });

    it('should return 401 when token is invalid', async () => {
      mockValidateFigma.mockResolvedValue({ valid: false, error: 'Token de Figma inválido o expirado.' });

      const res = await makeRequest(app, 'POST', '/api/connections/figma', validBody);

      expect(res.status).toBe(401);
      expect(res.body).toEqual({ status: 'error', error: 'Token de Figma inválido o expirado.' });
      expect(mockStore.store).not.toHaveBeenCalled();
    });

    it('should return 400 when accessToken is missing', async () => {
      const res = await makeRequest(app, 'POST', '/api/connections/figma', {});

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('accessToken');
    });
  });

  // ─── POST /api/connections/datadog ────────────────────────────────────

  describe('POST /api/connections/datadog', () => {
    const validBody = { apiKey: 'dd-api-key', appKey: 'dd-app-key', site: 'datadoghq.com' };

    it('should return 200 and store credentials when validation succeeds', async () => {
      mockValidateDatadog.mockResolvedValue({ valid: true });

      const res = await makeRequest(app, 'POST', '/api/connections/datadog', validBody);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: 'connected' });
      expect(mockStore.store).toHaveBeenCalledWith('datadog-main', validBody);
    });

    it('should return 401 when credentials are invalid', async () => {
      mockValidateDatadog.mockResolvedValue({ valid: false, error: 'Credenciales de Datadog inválidas.' });

      const res = await makeRequest(app, 'POST', '/api/connections/datadog', validBody);

      expect(res.status).toBe(401);
      expect(res.body).toEqual({ status: 'error', error: 'Credenciales de Datadog inválidas.' });
      expect(mockStore.store).not.toHaveBeenCalled();
    });

    it('should return 400 when required fields are missing', async () => {
      const res = await makeRequest(app, 'POST', '/api/connections/datadog', { apiKey: 'key' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Campos requeridos');
    });
  });

  // ─── GET /api/connections/status ──────────────────────────────────────

  describe('GET /api/connections/status', () => {
    it('should return disconnected for all services when no credentials exist', async () => {
      mockStore.exists.mockResolvedValue(false);

      const res = await makeRequest(app, 'GET', '/api/connections/status');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        jira: 'disconnected',
        figma: 'disconnected',
        datadog: 'disconnected',
      });
    });

    it('should return connected for services with stored credentials', async () => {
      mockStore.exists.mockImplementation(async (key: string) => {
        return key === 'jira-main' || key === 'figma-main';
      });

      const res = await makeRequest(app, 'GET', '/api/connections/status');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        jira: 'connected',
        figma: 'connected',
        datadog: 'disconnected',
      });
    });
  });

  // ─── DELETE /api/connections/:service ──────────────────────────────────

  describe('DELETE /api/connections/:service', () => {
    it('should delete jira credentials and return disconnected', async () => {
      const res = await makeRequest(app, 'DELETE', '/api/connections/jira');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: 'disconnected' });
      expect(mockStore.delete).toHaveBeenCalledWith('jira-main');
    });

    it('should delete figma credentials and return disconnected', async () => {
      const res = await makeRequest(app, 'DELETE', '/api/connections/figma');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: 'disconnected' });
      expect(mockStore.delete).toHaveBeenCalledWith('figma-main');
    });

    it('should delete datadog credentials and return disconnected', async () => {
      const res = await makeRequest(app, 'DELETE', '/api/connections/datadog');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: 'disconnected' });
      expect(mockStore.delete).toHaveBeenCalledWith('datadog-main');
    });

    it('should return 400 for invalid service name', async () => {
      const res = await makeRequest(app, 'DELETE', '/api/connections/invalid');

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Servicio inválido');
    });

    it('should return disconnected even if key does not exist', async () => {
      mockStore.delete.mockRejectedValue(new Error('Credentials not found'));

      const res = await makeRequest(app, 'DELETE', '/api/connections/jira');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: 'disconnected' });
    });
  });
});
