import { CredentialStore } from '../../../src/storage/credential-store';
import { generateMasterKey } from '../../../src/storage/encryption';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

describe('CredentialStore', () => {
  let store: CredentialStore;
  let testStorePath: string;
  let masterKey: Buffer;

  beforeEach(() => {
    // Use a temporary directory for tests
    testStorePath = path.join(os.tmpdir(), `po-ai-test-${Date.now()}`, 'credentials.json');
    masterKey = generateMasterKey();
    store = new CredentialStore(testStorePath, masterKey);
  });

  afterEach(async () => {
    // Clean up test files
    try {
      const dir = path.dirname(testStorePath);
      await fs.rm(dir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('store and retrieve', () => {
    it('should store and retrieve credentials', async () => {
      const credentials: Record<string, unknown> = {
        baseUrl: 'https://test.atlassian.net',
        email: 'test@example.com',
        apiToken: 'test-token-123'
      };

      await store.store('test-key', credentials);
      const retrieved = await store.retrieve('test-key');

      expect(retrieved).toEqual(credentials);
    });

    it('should return null for non-existent key', async () => {
      const retrieved = await store.retrieve('non-existent');
      expect(retrieved).toBeNull();
    });

    it('should store multiple credentials', async () => {
      const creds1: Record<string, unknown> = {
        baseUrl: 'https://test1.atlassian.net',
        email: 'test1@example.com',
        apiToken: 'token1'
      };

      const creds2: Record<string, unknown> = {
        baseUrl: 'https://test2.atlassian.net',
        email: 'test2@example.com',
        apiToken: 'token2'
      };

      await store.store('key1', creds1);
      await store.store('key2', creds2);

      const retrieved1 = await store.retrieve('key1');
      const retrieved2 = await store.retrieve('key2');

      expect(retrieved1).toEqual(creds1);
      expect(retrieved2).toEqual(creds2);
    });

    it('should overwrite existing credentials with same key', async () => {
      const creds1: Record<string, unknown> = {
        baseUrl: 'https://test1.atlassian.net',
        email: 'test1@example.com',
        apiToken: 'token1'
      };

      const creds2: Record<string, unknown> = {
        baseUrl: 'https://test2.atlassian.net',
        email: 'test2@example.com',
        apiToken: 'token2'
      };

      await store.store('test-key', creds1);
      await store.store('test-key', creds2);

      const retrieved = await store.retrieve('test-key');
      expect(retrieved).toEqual(creds2);
    });

    it('should store and retrieve non-Jira credentials', async () => {
      const figmaCreds: Record<string, unknown> = {
        accessToken: 'figma-token-abc'
      };

      const datadogCreds: Record<string, unknown> = {
        apiKey: 'dd-api-key',
        appKey: 'dd-app-key',
        site: 'datadoghq.com'
      };

      await store.store('figma-main', figmaCreds);
      await store.store('datadog-main', datadogCreds);

      expect(await store.retrieve('figma-main')).toEqual(figmaCreds);
      expect(await store.retrieve('datadog-main')).toEqual(datadogCreds);
    });
  });

  describe('update', () => {
    it('should update existing credentials', async () => {
      const original: Record<string, unknown> = {
        baseUrl: 'https://test.atlassian.net',
        email: 'test@example.com',
        apiToken: 'old-token'
      };

      const updated: Record<string, unknown> = {
        baseUrl: 'https://test.atlassian.net',
        email: 'test@example.com',
        apiToken: 'new-token'
      };

      await store.store('test-key', original);
      await store.update('test-key', updated);

      const retrieved = await store.retrieve('test-key');
      expect(retrieved).toEqual(updated);
    });

    it('should throw error when updating non-existent credentials', async () => {
      const credentials: Record<string, unknown> = {
        baseUrl: 'https://test.atlassian.net',
        email: 'test@example.com',
        apiToken: 'token'
      };

      await expect(store.update('non-existent', credentials)).rejects.toThrow(
        'Credentials not found for key: non-existent'
      );
    });
  });

  describe('delete', () => {
    it('should delete existing credentials', async () => {
      const credentials: Record<string, unknown> = {
        baseUrl: 'https://test.atlassian.net',
        email: 'test@example.com',
        apiToken: 'token'
      };

      await store.store('test-key', credentials);
      await store.delete('test-key');

      const retrieved = await store.retrieve('test-key');
      expect(retrieved).toBeNull();
    });

    it('should throw error when deleting non-existent credentials', async () => {
      await expect(store.delete('non-existent')).rejects.toThrow(
        'Credentials not found for key: non-existent'
      );
    });

    it('should not affect other credentials when deleting', async () => {
      const creds1: Record<string, unknown> = {
        baseUrl: 'https://test1.atlassian.net',
        email: 'test1@example.com',
        apiToken: 'token1'
      };

      const creds2: Record<string, unknown> = {
        baseUrl: 'https://test2.atlassian.net',
        email: 'test2@example.com',
        apiToken: 'token2'
      };

      await store.store('key1', creds1);
      await store.store('key2', creds2);
      await store.delete('key1');

      const retrieved1 = await store.retrieve('key1');
      const retrieved2 = await store.retrieve('key2');

      expect(retrieved1).toBeNull();
      expect(retrieved2).toEqual(creds2);
    });
  });

  describe('exists', () => {
    it('should return true for existing key', async () => {
      await store.store('test-key', { token: 'abc' });
      expect(await store.exists('test-key')).toBe(true);
    });

    it('should return false for non-existent key', async () => {
      expect(await store.exists('missing-key')).toBe(false);
    });

    it('should return false after deleting a key', async () => {
      await store.store('test-key', { token: 'abc' });
      await store.delete('test-key');
      expect(await store.exists('test-key')).toBe(false);
    });
  });

  describe('listKeys', () => {
    it('should return empty array when no credentials stored', async () => {
      const keys = await store.listKeys();
      expect(keys).toEqual([]);
    });

    it('should list all stored credential keys', async () => {
      const creds: Record<string, unknown> = {
        baseUrl: 'https://test.atlassian.net',
        email: 'test@example.com',
        apiToken: 'token'
      };

      await store.store('key1', creds);
      await store.store('key2', creds);
      await store.store('key3', creds);

      const keys = await store.listKeys();
      expect(keys).toHaveLength(3);
      expect(keys).toContain('key1');
      expect(keys).toContain('key2');
      expect(keys).toContain('key3');
    });
  });

  describe('encryption', () => {
    it('should store credentials in encrypted form', async () => {
      const credentials: Record<string, unknown> = {
        baseUrl: 'https://test.atlassian.net',
        email: 'test@example.com',
        apiToken: 'secret-token-123'
      };

      await store.store('test-key', credentials);

      // Read the raw file
      const rawData = await fs.readFile(testStorePath, 'utf8');
      
      // Verify that sensitive data is not in plain text
      expect(rawData).not.toContain('secret-token-123');
      expect(rawData).not.toContain('test@example.com');
    });

    it('should fail to decrypt with different master key', async () => {
      const credentials: Record<string, unknown> = {
        baseUrl: 'https://test.atlassian.net',
        email: 'test@example.com',
        apiToken: 'token'
      };

      await store.store('test-key', credentials);

      // Create a new store with different master key
      const differentKey = generateMasterKey();
      const store2 = new CredentialStore(testStorePath, differentKey);

      await expect(store2.retrieve('test-key')).rejects.toThrow();
    });
  });
});
