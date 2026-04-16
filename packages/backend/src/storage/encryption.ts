import crypto from 'crypto';

/**
 * Encryption module for secure credential storage
 * Uses AES-256-GCM for encryption/decryption
 * Validates: Requirements 6.2
 */

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16; // 128 bits
const SALT_LENGTH = 32;
const ITERATIONS = 100000;

export interface EncryptedData {
  encrypted: string;
  iv: string;
  authTag: string;
  salt: string;
}

/**
 * Derives a master key from a password using PBKDF2
 */
export function deriveMasterKey(password: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, 'sha256');
}

/**
 * Encrypts data using AES-256-GCM
 */
export function encrypt(data: string, masterKey: Buffer): EncryptedData {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, masterKey, iv);
  
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  // Generate salt for key derivation (stored with encrypted data)
  const salt = crypto.randomBytes(SALT_LENGTH);
  
  return {
    encrypted,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
    salt: salt.toString('hex')
  };
}

/**
 * Decrypts data using AES-256-GCM
 */
export function decrypt(encryptedData: EncryptedData, masterKey: Buffer): string {
  const iv = Buffer.from(encryptedData.iv, 'hex');
  const authTag = Buffer.from(encryptedData.authTag, 'hex');
  
  const decipher = crypto.createDecipheriv(ALGORITHM, masterKey, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

/**
 * Generates a deterministic master key from environment variable.
 * IMPORTANT: Set PO_AI_MASTER_KEY in .env for production.
 */
export function generateMasterKey(): Buffer {
  const secret = process.env.PO_AI_MASTER_KEY;
  if (!secret) {
    console.warn('[SECURITY] PO_AI_MASTER_KEY no está configurada. Usando clave por defecto. Configúrala en .env para producción.');
  }
  const keySource = secret || 'po-ai-default-master-key-change-in-prod';
  const salt = Buffer.from('po-ai-credential-store-salt-v1');
  return crypto.pbkdf2Sync(keySource, salt, 100000, KEY_LENGTH, 'sha256');
}

/**
 * Generates a salt for key derivation
 */
export function generateSalt(): Buffer {
  return crypto.randomBytes(SALT_LENGTH);
}
