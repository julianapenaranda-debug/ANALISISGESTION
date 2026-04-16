/**
 * Connection Routes
 *
 * Endpoints REST para gestionar el ciclo de vida de credenciales
 * de servicios externos (Jira, Figma, Datadog).
 *
 * Requerimientos: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 3.4
 */

import { Router, Request, Response } from 'express';
import {
  validateJiraCredentials,
  validateFigmaToken,
  validateDatadogCredentials,
} from '../integration/service-validators';
import { CredentialStore } from '../storage/credential-store';

const NETWORK_ERROR_MESSAGE = 'No se pudo conectar con el servicio. Verifica tu conexión de red.';

const SERVICE_KEY_MAP: Record<string, string> = {
  jira: 'jira-main',
  figma: 'figma-main',
  datadog: 'datadog-main',
};

const VALID_SERVICES = Object.keys(SERVICE_KEY_MAP);

export function createConnectionRoutes(credentialStore: CredentialStore): Router {
  const router = Router();

  // POST /connections/jira — Requerimiento 2.1
  router.post('/jira', async (req: Request, res: Response) => {
    try {
      const { baseUrl, email, apiToken } = req.body;

      if (!baseUrl || !email || !apiToken) {
        return res.status(400).json({ status: 'error', error: 'Campos requeridos: baseUrl, email, apiToken' });
      }

      const result = await validateJiraCredentials({ baseUrl, email, apiToken });

      if (!result.valid) {
        if (result.error === NETWORK_ERROR_MESSAGE) {
          return res.status(502).json({ status: 'error', error: result.error });
        }
        return res.status(401).json({ status: 'error', error: result.error });
      }

      await credentialStore.store('jira-main', { baseUrl, email, apiToken });
      return res.json({ status: 'connected', displayName: result.displayName });
    } catch (error: any) {
      return res.status(500).json({ status: 'error', error: error.message || 'Error interno' });
    }
  });

  // POST /connections/figma — Requerimiento 2.2
  router.post('/figma', async (req: Request, res: Response) => {
    try {
      const { accessToken } = req.body;

      if (!accessToken) {
        return res.status(400).json({ status: 'error', error: 'Campos requeridos: accessToken' });
      }

      const result = await validateFigmaToken(accessToken);

      if (!result.valid) {
        if (result.error === NETWORK_ERROR_MESSAGE) {
          return res.status(502).json({ status: 'error', error: result.error });
        }
        return res.status(401).json({ status: 'error', error: result.error });
      }

      await credentialStore.store('figma-main', { accessToken });
      return res.json({ status: 'connected', displayName: result.displayName });
    } catch (error: any) {
      return res.status(500).json({ status: 'error', error: error.message || 'Error interno' });
    }
  });

  // POST /connections/datadog — Requerimiento 2.3
  router.post('/datadog', async (req: Request, res: Response) => {
    try {
      const { apiKey, appKey, site } = req.body;

      if (!apiKey || !appKey || !site) {
        return res.status(400).json({ status: 'error', error: 'Campos requeridos: apiKey, appKey, site' });
      }

      const result = await validateDatadogCredentials(apiKey, appKey, site);

      if (!result.valid) {
        if (result.error === NETWORK_ERROR_MESSAGE) {
          return res.status(502).json({ status: 'error', error: result.error });
        }
        return res.status(401).json({ status: 'error', error: result.error });
      }

      await credentialStore.store('datadog-main', { apiKey, appKey, site });
      return res.json({ status: 'connected', displayName: result.displayName });
    } catch (error: any) {
      return res.status(500).json({ status: 'error', error: error.message || 'Error interno' });
    }
  });

  // GET /connections/status — Requerimiento 2.4
  router.get('/status', async (_req: Request, res: Response) => {
    try {
      const [jiraExists, figmaExists, datadogExists] = await Promise.all([
        credentialStore.exists('jira-main'),
        credentialStore.exists('figma-main'),
        credentialStore.exists('datadog-main'),
      ]);

      return res.json({
        jira: jiraExists ? 'connected' : 'disconnected',
        figma: figmaExists ? 'connected' : 'disconnected',
        datadog: datadogExists ? 'connected' : 'disconnected',
      });
    } catch (error: any) {
      return res.status(500).json({ status: 'error', error: error.message || 'Error interno' });
    }
  });

  // DELETE /connections/:service — Requerimiento 2.5
  router.delete('/:service', async (req: Request, res: Response) => {
    try {
      const { service } = req.params;

      if (!VALID_SERVICES.includes(service)) {
        return res.status(400).json({ status: 'error', error: `Servicio inválido: ${service}. Servicios válidos: ${VALID_SERVICES.join(', ')}` });
      }

      const key = SERVICE_KEY_MAP[service];

      try {
        await credentialStore.delete(key);
      } catch {
        // Key might not exist, that's fine — treat as already disconnected
      }

      return res.json({ status: 'disconnected' });
    } catch (error: any) {
      return res.status(500).json({ status: 'error', error: error.message || 'Error interno' });
    }
  });

  return router;
}
