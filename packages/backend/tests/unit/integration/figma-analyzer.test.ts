/**
 * Unit tests for Figma Analyzer — real API integration
 *
 * Tests figmaRequest(), extractScreens/extractInteractions (via analyzeDesign),
 * and error handling for 403/404.
 * Requerimientos: 8.1, 8.2, 8.3, 8.4
 */

import https from 'https';
import { EventEmitter } from 'events';
import {
  analyzeDesign,
  figmaRequest,
  extractFileKey,
  extractComponents,
} from '../../../src/integration/figma-analyzer';

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

  return mockReq;
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

// A minimal Figma API file response for testing
const MOCK_FIGMA_FILE_RESPONSE = {
  name: 'Test Design',
  document: {
    children: [
      {
        id: 'page-1',
        name: 'Page 1',
        type: 'CANVAS',
        children: [
          {
            id: 'frame-1',
            name: 'Login Screen',
            type: 'FRAME',
            children: [
              {
                id: 'comp-1',
                name: 'Email Input',
                type: 'COMPONENT',
                absoluteBoundingBox: { width: 300, height: 40 },
              },
              {
                id: 'comp-2',
                name: 'Submit Button',
                type: 'INSTANCE',
                interactions: [
                  {
                    trigger: { type: 'ON_CLICK' },
                    actions: [{ type: 'NAVIGATE', destinationId: 'frame-2' }],
                  },
                ],
              },
            ],
          },
          {
            id: 'frame-2',
            name: 'Dashboard',
            type: 'FRAME',
            children: [
              {
                id: 'comp-3',
                name: 'Nav Menu',
                type: 'COMPONENT',
              },
            ],
          },
        ],
      },
    ],
  },
};

describe('figmaRequest', () => {
  it('should call api.figma.com with X-Figma-Token header', async () => {
    setupMockRequest(200, { name: 'Test' });

    await figmaRequest('my-token', '/v1/files/abc123');

    expect(mockedHttps.request).toHaveBeenCalledWith(
      expect.objectContaining({
        hostname: 'api.figma.com',
        path: '/v1/files/abc123',
        method: 'GET',
        headers: expect.objectContaining({
          'X-Figma-Token': 'my-token',
        }),
      }),
      expect.any(Function)
    );
  });

  it('should resolve with parsed JSON on 200', async () => {
    setupMockRequest(200, { name: 'My File' });

    const result = await figmaRequest('token', '/v1/files/key');

    expect(result).toEqual({ name: 'My File' });
  });

  it('should reject with specific message on 403', async () => {
    setupMockRequest(403, { status: 403, err: 'Forbidden' });

    await expect(figmaRequest('bad-token', '/v1/files/key'))
      .rejects.toMatchObject({
        message: 'Token de Figma sin permisos para acceder a este archivo.',
        code: 'FIGMA_FORBIDDEN',
        statusCode: 403,
      });
  });

  it('should reject with specific message on 404', async () => {
    setupMockRequest(404, { status: 404, err: 'Not found' });

    await expect(figmaRequest('token', '/v1/files/nonexistent'))
      .rejects.toMatchObject({
        message: 'Archivo de Figma no encontrado. Verifica la URL.',
        code: 'FIGMA_NOT_FOUND',
        statusCode: 404,
      });
  });

  it('should propagate network errors', async () => {
    setupMockRequestNetworkError('ECONNREFUSED');

    await expect(figmaRequest('token', '/v1/files/key'))
      .rejects.toMatchObject({ code: 'ECONNREFUSED' });
  });
});

describe('analyzeDesign with accessToken (real API)', () => {
  const figmaUrl = 'https://www.figma.com/file/abc123/MyDesign';

  it('should call Figma API and parse components from response', async () => {
    setupMockRequest(200, MOCK_FIGMA_FILE_RESPONSE);

    const result = await analyzeDesign(figmaUrl, 'valid-token');

    expect(result.fileKey).toBe('abc123');
    expect(result.components.length).toBeGreaterThan(0);
    // Should find the COMPONENT nodes
    const componentNames = result.components.map(c => c.name);
    expect(componentNames).toContain('Email Input');
    expect(componentNames).toContain('Nav Menu');
  });

  it('should extract screens from top-level frames', async () => {
    setupMockRequest(200, MOCK_FIGMA_FILE_RESPONSE);

    const result = await analyzeDesign(figmaUrl, 'valid-token');

    expect(result.screens.length).toBe(2);
    const screenNames = result.screens.map(s => s.name);
    expect(screenNames).toContain('Login Screen');
    expect(screenNames).toContain('Dashboard');
  });

  it('should extract interactions from prototype data', async () => {
    setupMockRequest(200, MOCK_FIGMA_FILE_RESPONSE);

    const result = await analyzeDesign(figmaUrl, 'valid-token');

    expect(result.interactions.length).toBeGreaterThan(0);
    const nav = result.interactions.find(i => i.sourceId === 'comp-2');
    expect(nav).toBeDefined();
    expect(nav!.targetId).toBe('frame-2');
    expect(nav!.trigger).toBe('ON_CLICK');
    expect(nav!.action).toBe('NAVIGATE');
  });

  it('should build flows from extracted interactions', async () => {
    setupMockRequest(200, MOCK_FIGMA_FILE_RESPONSE);

    const result = await analyzeDesign(figmaUrl, 'valid-token');

    expect(result.flows.length).toBeGreaterThan(0);
  });

  it('should propagate 403 error from Figma API', async () => {
    setupMockRequest(403, { status: 403 });

    await expect(analyzeDesign(figmaUrl, 'bad-token'))
      .rejects.toMatchObject({
        message: 'Token de Figma sin permisos para acceder a este archivo.',
      });
  });

  it('should propagate 404 error from Figma API', async () => {
    setupMockRequest(404, { status: 404 });

    await expect(analyzeDesign(figmaUrl, 'token'))
      .rejects.toMatchObject({
        message: 'Archivo de Figma no encontrado. Verifica la URL.',
      });
  });
});

describe('analyzeDesign without accessToken (mock behavior)', () => {
  const figmaUrl = 'https://www.figma.com/file/abc123/MyDesign';

  it('should return mock data when no accessToken is provided', async () => {
    const result = await analyzeDesign(figmaUrl);

    expect(result.fileKey).toBe('abc123');
    expect(result.components.length).toBe(5);
    expect(result.screens.length).toBe(3);
    expect(result.interactions.length).toBe(3);
    expect(result.flows.length).toBeGreaterThan(0);
  });

  it('should not call https.request when no accessToken', async () => {
    mockedHttps.request = jest.fn();

    await analyzeDesign(figmaUrl);

    expect(mockedHttps.request).not.toHaveBeenCalled();
  });
});
