import * as ed from '@noble/ed25519';
import { sha512 } from '@noble/hashes/sha512';

ed.etc.sha512Sync = (...m) => sha512(ed.etc.concatBytes(...m));

// Embedded offline public key (verified against root private key)
export const ROOT_PUBLIC_KEY_HEX =
  '0d9b36210340b3aba5006d9789ddf39ace97b7f027b17310ea2c0ce955a8ae5a';

export interface LicenseVerificationResult {
  valid: boolean;
  plan?: 'solo' | 'business';
  licenseeName?: string;
  licenseeEmail?: string;
  issuedAt?: string;
  updatesUntil?: string;
  isUpdatesExpired?: boolean;
  error?: string;
}

function base64UrlToBytes(base64url: string): Uint8Array {
  // Convert base64url to standard base64
  let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  
  if (typeof atob === 'function') {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } else {
    // Node.js fallback
    return new Uint8Array(Buffer.from(base64, 'base64'));
  }
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

/**
 * Completely offline license key verification using Ed25519 digital signature.
 */
export async function verifyLicenseKey(
  keyString: string,
  publicKeyHex = ROOT_PUBLIC_KEY_HEX
): Promise<LicenseVerificationResult> {
  const trimmed = keyString.trim();
  if (!trimmed.startsWith('CK-') || !trimmed.includes('.')) {
    return { valid: false, error: 'Invalid license format. Must start with CK- followed by signature.' };
  }

  const tokenPart = trimmed.slice(3);
  const [payloadB64, sigB64] = tokenPart.split('.');
  if (!payloadB64 || !sigB64) {
    return { valid: false, error: 'Malformed license payload or missing signature.' };
  }

  try {
    const payloadBytes = base64UrlToBytes(payloadB64);
    const signatureBytes = base64UrlToBytes(sigB64);
    const pubKeyBytes = hexToBytes(publicKeyHex);

    // Verify cryptographic signature offline
    const isSignatureValid = await ed.verifyAsync(signatureBytes, payloadBytes, pubKeyBytes);
    if (!isSignatureValid) {
      return { valid: false, error: 'Cryptographic signature verification failed. License key is tampered or invalid.' };
    }

    // Decode and parse payload
    const decoder = new TextDecoder();
    const jsonStr = decoder.decode(payloadBytes);
    const payload = JSON.parse(jsonStr);

    if (!payload.plan || !['solo', 'business'].includes(payload.plan)) {
      return { valid: false, error: 'Unrecognized plan tier in license token.' };
    }

    const updatesUntilDate = new Date(payload.updatesUntil);
    const isUpdatesExpired = !isNaN(updatesUntilDate.getTime()) && updatesUntilDate.getTime() < Date.now();

    return {
      valid: true,
      plan: payload.plan,
      licenseeName: payload.licenseeName || 'Registered User',
      licenseeEmail: payload.licenseeEmail || '',
      issuedAt: payload.issuedAt,
      updatesUntil: payload.updatesUntil,
      isUpdatesExpired,
    };
  } catch (err: any) {
    return { valid: false, error: `License parsing error: ${err.message || 'Corrupt token'}` };
  }
}
