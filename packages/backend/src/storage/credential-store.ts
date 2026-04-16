import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { encrypt, decrypt, generateMasterKey, EncryptedData } from './encryption';

/**
 * CredentialStore - Secure storage for service credentials
 * Uses file-based storage with AES-256-GCM encryption
 * Supports any service (Jira, Figma, Datadog, etc.)
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4
 */

interface StoredCredential {
  key: string;
  data: EncryptedData;
  timestamp: string;
}

export class CredentialStore {
  private storePath: string;
  private masterKey: Buffer;

  constructor(storePath?: string, masterKey?: Buffer) {
    // Default to user's home directory
    this.storePath = storePath || path.join(os.homedir(), '.po-ai', 'credentials.json');
    this.masterKey = masterKey || generateMasterKey();
  }

  /**
   * Ensures the storage directory exists
   */
  private async ensureStorageDir(): Promise<void> {
    const dir = path.dirname(this.storePath);
    await fs.mkdir(dir, { recursive: true });
  }

  /**
   * Loads all stored credentials from disk
   */
  private async loadStore(): Promise<StoredCredential[]> {
    try {
      const data = await fs.readFile(this.storePath, 'utf8');
      return JSON.parse(data);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  /**
   * Saves all credentials to disk with restrictive permissions (owner-only)
   */
  private async saveStore(credentials: StoredCredential[]): Promise<void> {
    await this.ensureStorageDir();
    await fs.writeFile(this.storePath, JSON.stringify(credentials, null, 2), { encoding: 'utf8', mode: 0o600 });
  }

  /**
   * Stores credentials securely
   */
  async store(key: string, credentials: Record<string, unknown>): Promise<void> {
    const store = await this.loadStore();
    
    // Remove existing credential with same key
    const filtered = store.filter(c => c.key !== key);
    
    // Encrypt credentials
    const serialized = JSON.stringify(credentials);
    const encrypted = encrypt(serialized, this.masterKey);
    
    // Add new credential
    filtered.push({
      key,
      data: encrypted,
      timestamp: new Date().toISOString()
    });
    
    await this.saveStore(filtered);
  }

  /**
   * Retrieves credentials by key
   */
  async retrieve(key: string): Promise<Record<string, unknown> | null> {
    const store = await this.loadStore();
    const credential = store.find(c => c.key === key);
    
    if (!credential) {
      return null;
    }
    
    try {
      const decrypted = decrypt(credential.data, this.masterKey);
      return JSON.parse(decrypted);
    } catch (error) {
      throw new Error(`Failed to decrypt credentials for key: ${key}`);
    }
  }

  /**
   * Updates existing credentials
   */
  async update(key: string, credentials: Record<string, unknown>): Promise<void> {
    const existing = await this.retrieve(key);
    if (!existing) {
      throw new Error(`Credentials not found for key: ${key}`);
    }
    
    // Store will replace existing
    await this.store(key, credentials);
  }

  /**
   * Deletes credentials by key
   */
  async delete(key: string): Promise<void> {
    const store = await this.loadStore();
    const filtered = store.filter(c => c.key !== key);
    
    if (filtered.length === store.length) {
      throw new Error(`Credentials not found for key: ${key}`);
    }
    
    await this.saveStore(filtered);
  }

  /**
   * Checks if credentials exist for a given key
   */
  async exists(key: string): Promise<boolean> {
    const store = await this.loadStore();
    return store.some(c => c.key === key);
  }

  /**
   * Lists all stored credential keys
   */
  async listKeys(): Promise<string[]> {
    const store = await this.loadStore();
    return store.map(c => c.key);
  }
}
