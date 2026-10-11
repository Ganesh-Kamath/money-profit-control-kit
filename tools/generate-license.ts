import * as ed from '@noble/ed25519';
import { sha512 } from '@noble/hashes/sha512';

ed.etc.sha512Sync = (...m) => sha512(ed.etc.concatBytes(...m));

// Default dev key if not provided via environment variable
const DEV_PRIVATE_KEY =
  process.env.CONTROLKIT_LICENSE_PRIVATE_KEY ||
  '077be88f717349b5a156355f5064de62e4bda774371f7b4c3a56ad6ec14ef58f';

export async function createLicenseKey(params: {
  plan: 'solo' | 'business';
  licenseeName: string;
  licenseeEmail: string;
  issuedAt?: string;
  monthsUpdates?: number;
  privateKeyHex?: string;
}): Promise<string> {
  const privKey = Buffer.from(params.privateKeyHex || DEV_PRIVATE_KEY, 'hex');
  const now = new Date(params.issuedAt || new Date().toISOString());
  const updatesDate = new Date(now);
  updatesDate.setMonth(updatesDate.getMonth() + (params.monthsUpdates || 12));

  const payload = {
    plan: params.plan,
    licenseeName: params.licenseeName,
    licenseeEmail: params.licenseeEmail,
    issuedAt: now.toISOString(),
    updatesUntil: updatesDate.toISOString(),
  };

  const payloadStr = JSON.stringify(payload);
  const payloadBytes = Buffer.from(payloadStr, 'utf-8');
  const signatureBytes = await ed.signAsync(payloadBytes, privKey);

  const payloadB64 = Buffer.from(payloadBytes).toString('base64url');
  const sigB64 = Buffer.from(signatureBytes).toString('base64url');

  return `CK-${payloadB64}.${sigB64}`;
}

async function main() {
  const plan = (process.argv[2] as 'solo' | 'business') || 'business';
  const name = process.argv[3] || 'Sunita Sharma';
  const email = process.argv[4] || 'sunita.bakery@example.com';

  const licenseKey = await createLicenseKey({
    plan,
    licenseeName: name,
    licenseeEmail: email,
  });

  console.log('=== Generated Money & Profit Control Kit License ===');
  console.log(`Plan:          ${plan.toUpperCase()}`);
  console.log(`Licensee:      ${name} <${email}>`);
  console.log(`License Key:`);
  console.log(licenseKey);
}

main().catch(console.error);
