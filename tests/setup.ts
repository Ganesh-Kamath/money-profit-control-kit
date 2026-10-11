import 'fake-indexeddb/auto';

// Ensure global web crypto is present
if (!globalThis.crypto) {
  const { webcrypto } = require('node:crypto');
  // @ts-ignore
  globalThis.crypto = webcrypto;
}
