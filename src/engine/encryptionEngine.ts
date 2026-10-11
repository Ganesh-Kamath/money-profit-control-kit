/**
 * WebCrypto AES-256-GCM and PBKDF2 Encryption Engine for Money & Profit Control Kit.
 * 100% on-device cryptographic operations for backups and app security.
 */

export interface EncryptedPackage {
  format: 'CONTROLKIT_V1_AES_GCM';
  version: number;
  saltHex: string;
  ivHex: string;
  ciphertextB64: string;
  timestamp: string;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

/**
 * Derives an AES-256-GCM CryptoKey from a passphrase using PBKDF2 (100,000 rounds).
 */
async function deriveKeyFromPassphrase(
  passphrase: string,
  salt: Uint8Array,
  keyUsage: KeyUsage[] = ['encrypt', 'decrypt']
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passphraseBytes = encoder.encode(passphrase);

  // Import raw passphrase material
  const baseKey = await crypto.subtle.importKey(
    'raw',
    passphraseBytes,
    'PBKDF2',
    false,
    ['deriveKey']
  );

  // Derive AES-GCM 256-bit key
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    keyUsage
  );
}

/**
 * Encrypts arbitrary plaintext object (e.g. database backup) with AES-256-GCM.
 */
export async function encryptData(data: any, passphrase: string): Promise<EncryptedPackage> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for AES-GCM

  const key = await deriveKeyFromPassphrase(passphrase, salt, ['encrypt']);

  const jsonString = JSON.stringify(data);
  const encodedPlaintext = new TextEncoder().encode(jsonString);

  const ciphertextBuffer = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    key,
    encodedPlaintext
  );

  const ciphertextArray = new Uint8Array(ciphertextBuffer);
  let binary = '';
  for (let i = 0; i < ciphertextArray.length; i++) {
    binary += String.fromCharCode(ciphertextArray[i]);
  }
  const ciphertextB64 = btoa(binary);

  return {
    format: 'CONTROLKIT_V1_AES_GCM',
    version: 1,
    saltHex: bytesToHex(salt),
    ivHex: bytesToHex(iv),
    ciphertextB64,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Decrypts an EncryptedPackage back to plaintext JSON.
 * Throws an error if passphrase is wrong or ciphertext is tampered.
 */
export async function decryptData(pkg: EncryptedPackage, passphrase: string): Promise<any> {
  if (pkg.format !== 'CONTROLKIT_V1_AES_GCM') {
    throw new Error('Unsupported encrypted backup format');
  }

  const salt = hexToBytes(pkg.saltHex);
  const iv = hexToBytes(pkg.ivHex);

  const key = await deriveKeyFromPassphrase(passphrase, salt, ['decrypt']);

  const binary = atob(pkg.ciphertextB64);
  const ciphertextBytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    ciphertextBytes[i] = binary.charCodeAt(i);
  }

  try {
    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv,
      },
      key,
      ciphertextBytes
    );

    const decryptedStr = new TextDecoder().decode(decryptedBuffer);
    return JSON.parse(decryptedStr);
  } catch (err) {
    throw new Error('Decryption failed: Incorrect passphrase or corrupted backup file');
  }
}

/**
 * Computes SHA-256 hash of a Blob (used for receipt duplicate detection).
 */
export async function computeBlobSha256(blob: Blob): Promise<string> {
  const arrayBuffer = await blob.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
  return bytesToHex(new Uint8Array(hashBuffer));
}

/**
 * Hashes an App Lock PIN with salt using SHA-256.
 */
export async function hashPin(pin: string, saltHex?: string): Promise<{ hashHex: string; saltHex: string }> {
  const salt = saltHex ? hexToBytes(saltHex) : crypto.getRandomValues(new Uint8Array(16));
  const pinBytes = new TextEncoder().encode(pin);
  const combined = new Uint8Array(salt.length + pinBytes.length);
  combined.set(salt, 0);
  combined.set(pinBytes, salt.length);

  const hashBuffer = await crypto.subtle.digest('SHA-256', combined);
  return {
    hashHex: bytesToHex(new Uint8Array(hashBuffer)),
    saltHex: bytesToHex(salt),
  };
}
