import { describe, it, expect } from 'vitest';
import {
  encryptData,
  decryptData,
  computeBlobSha256,
  hashPin,
} from '../src/engine/encryptionEngine';

describe('Encryption & App Security Engine', () => {
  it('encrypts and decrypts database backup with AES-256-GCM and PBKDF2', async () => {
    const sensitiveData = {
      workspace: 'Sunita Bakery',
      totalRevenuePaise: 12500000,
      accounts: [
        { name: 'HDFC', balancePaise: 5000000 },
        { name: 'Cash', balancePaise: 1200000 },
      ],
    };

    const passphrase = 'MySuperSecurePassphrase!2026';
    const encryptedPkg = await encryptData(sensitiveData, passphrase);

    expect(encryptedPkg.format).toBe('CONTROLKIT_V1_AES_GCM');
    expect(encryptedPkg.ciphertextB64).toBeDefined();
    expect(encryptedPkg.saltHex.length).toBe(32); // 16 bytes = 32 hex chars
    expect(encryptedPkg.ivHex.length).toBe(24);   // 12 bytes = 24 hex chars

    // Decrypt with correct passphrase
    const decrypted = await decryptData(encryptedPkg, passphrase);
    expect(decrypted).toEqual(sensitiveData);
  });

  it('fails decryption when provided with an incorrect passphrase', async () => {
    const data = { secret: 'Confidential Records' };
    const encryptedPkg = await encryptData(data, 'CorrectPassword123');

    await expect(decryptData(encryptedPkg, 'WrongPassword456')).rejects.toThrow(
      /Decryption failed/
    );
  });

  it('detects tampering in encrypted backup payload', async () => {
    const data = { amount: 50000 };
    const encryptedPkg = await encryptData(data, 'Passphrase');

    // Tamper ciphertext
    const tamperedPkg = {
      ...encryptedPkg,
      ciphertextB64: encryptedPkg.ciphertextB64.slice(0, -4) + 'AAAA',
    };

    await expect(decryptData(tamperedPkg, 'Passphrase')).rejects.toThrow();
  });

  it('computes identical SHA-256 hash for identical receipt blobs', async () => {
    const blob1 = new Blob(['Receipt Content Image Data #101'], { type: 'text/plain' });
    const blob2 = new Blob(['Receipt Content Image Data #101'], { type: 'text/plain' });
    const blob3 = new Blob(['Different Receipt Content'], { type: 'text/plain' });

    const hash1 = await computeBlobSha256(blob1);
    const hash2 = await computeBlobSha256(blob2);
    const hash3 = await computeBlobSha256(blob3);

    expect(hash1).toBe(hash2);
    expect(hash1).not.toBe(hash3);
    expect(hash1.length).toBe(64); // 32 bytes = 64 hex chars
  });

  it('hashes and validates App Lock PIN correctly', async () => {
    const pin = '4829';
    const { hashHex, saltHex } = await hashPin(pin);

    // Verify same PIN with same salt gives exact same hash
    const check = await hashPin(pin, saltHex);
    expect(check.hashHex).toBe(hashHex);

    // Different PIN gives different hash
    const wrongCheck = await hashPin('1234', saltHex);
    expect(wrongCheck.hashHex).not.toBe(hashHex);
  });
});
