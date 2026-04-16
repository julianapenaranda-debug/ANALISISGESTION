import { encrypt, decrypt, deriveMasterKey, generateMasterKey, generateSalt } from '../../../src/storage/encryption';

describe('Encryption Module', () => {
  describe('Master Key Generation', () => {
    it('should generate a 32-byte master key', () => {
      const key = generateMasterKey();
      expect(key).toBeInstanceOf(Buffer);
      expect(key.length).toBe(32);
    });

    it('should generate unique keys', () => {
      const key1 = generateMasterKey();
      const key2 = generateMasterKey();
      expect(key1.equals(key2)).toBe(false);
    });
  });

  describe('Key Derivation', () => {
    it('should derive a key from password and salt', () => {
      const password = 'test-password';
      const salt = generateSalt();
      const key = deriveMasterKey(password, salt);
      
      expect(key).toBeInstanceOf(Buffer);
      expect(key.length).toBe(32);
    });

    it('should derive the same key for same password and salt', () => {
      const password = 'test-password';
      const salt = generateSalt();
      
      const key1 = deriveMasterKey(password, salt);
      const key2 = deriveMasterKey(password, salt);
      
      expect(key1.equals(key2)).toBe(true);
    });

    it('should derive different keys for different salts', () => {
      const password = 'test-password';
      const salt1 = generateSalt();
      const salt2 = generateSalt();
      
      const key1 = deriveMasterKey(password, salt1);
      const key2 = deriveMasterKey(password, salt2);
      
      expect(key1.equals(key2)).toBe(false);
    });
  });

  describe('Encryption and Decryption', () => {
    it('should encrypt and decrypt data correctly', () => {
      const data = 'sensitive data';
      const masterKey = generateMasterKey();
      
      const encrypted = encrypt(data, masterKey);
      const decrypted = decrypt(encrypted, masterKey);
      
      expect(decrypted).toBe(data);
    });

    it('should produce different ciphertext for same data', () => {
      const data = 'sensitive data';
      const masterKey = generateMasterKey();
      
      const encrypted1 = encrypt(data, masterKey);
      const encrypted2 = encrypt(data, masterKey);
      
      expect(encrypted1.encrypted).not.toBe(encrypted2.encrypted);
      expect(encrypted1.iv).not.toBe(encrypted2.iv);
    });

    it('should encrypt JSON data', () => {
      const data = JSON.stringify({ user: 'test', token: 'secret' });
      const masterKey = generateMasterKey();
      
      const encrypted = encrypt(data, masterKey);
      const decrypted = decrypt(encrypted, masterKey);
      
      expect(JSON.parse(decrypted)).toEqual({ user: 'test', token: 'secret' });
    });

    it('should fail to decrypt with wrong key', () => {
      const data = 'sensitive data';
      const masterKey1 = generateMasterKey();
      const masterKey2 = generateMasterKey();
      
      const encrypted = encrypt(data, masterKey1);
      
      expect(() => decrypt(encrypted, masterKey2)).toThrow();
    });

    it('should include all required fields in encrypted data', () => {
      const data = 'test';
      const masterKey = generateMasterKey();
      
      const encrypted = encrypt(data, masterKey);
      
      expect(encrypted).toHaveProperty('encrypted');
      expect(encrypted).toHaveProperty('iv');
      expect(encrypted).toHaveProperty('authTag');
      expect(encrypted).toHaveProperty('salt');
    });
  });
});
