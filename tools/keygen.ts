import * as ed from '@noble/ed25519';
import { sha512 } from '@noble/hashes/sha512';

// Set sha512 for ed25519
ed.etc.sha512Sync = (...m) => sha512(ed.etc.concatBytes(...m));

async function main() {
  const privKey = ed.utils.randomPrivateKey();
  const pubKey = await ed.getPublicKeyAsync(privKey);

  const privHex = Buffer.from(privKey).toString('hex');
  const pubHex = Buffer.from(pubKey).toString('hex');

  console.log('=== Money & Profit Control Kit Keygen ===');
  console.log('PUBLIC KEY (Embed in app src/engine/licenseEngine.ts):');
  console.log(pubHex);
  console.log('\nPRIVATE KEY (Save securely; use in tools/generate-license.ts; NEVER commit to repo):');
  console.log(privHex);
}

main().catch(console.error);
