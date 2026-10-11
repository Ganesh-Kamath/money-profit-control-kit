# Security & Cryptography Design

ControlKit relies on browser-native cryptography standards ([Web Cryptography API](https://www.w3.org/TR/WebCryptoAPI/)) to deliver local security without cloud dependencies.

---

## 🎯 Threat Model & Assumptions

### Protected Against:
1. **Cloud Data Breaches & Subpoenas:** Since no server exists, our company never has custody of your financial records. A breach of our website or static host exposes zero customer data.
2. **Third-Party Snooping & Man-in-the-Middle:** All data manipulation occurs on your CPU. No credentials or transactions cross the wire.
3. **Casual Device Access:** Optional Passcode/PIN Lock protects the application window from unauthorized roommates, coworkers, or family members.
4. **Tampered Backup Files:** Backups are authenticated using AES-256-GCM authentication tags. Any byte alteration causes decryption to fail immediately.

### NOT Protected Against (Honest Limitations):
1. **Malware / Root Compromise on Host Device:** If an attacker has keylogger access or administrative control over your operating system, they can read memory or files from your browser sandbox.
2. **Forgotten Passphrases:** We do not maintain a backdoor, recovery phone number, or master decryption key. If you forget your backup passphrase, the backup cannot be decrypted.
3. **Reverse Engineering of Client-Side Licensing:** As with any local application without phone-home DRM, determined engineers could patch the client-side JavaScript. Offline Ed25519 licensing is designed as an honest fair-use commercial key for legitimate business owners, not impenetrable DRM.

---

## 🔐 Cryptography Architecture

### 1. Encrypted Backups (`.cpk` Format)
- **Algorithm:** AES-256-GCM (Galois/Counter Mode) authenticated symmetric encryption.
- **Key Derivation:** PBKDF2 with HMAC-SHA-256 and **100,000 iterations**.
- **Salt:** 16 bytes of cryptographically secure random bytes generated via `crypto.getRandomValues()`.
- **Initialization Vector (IV):** 12 bytes of unique random bytes per encryption.
- **Format:**
  ```json
  {
    "format": "CONTROLKIT_V1_AES_GCM",
    "version": 1,
    "saltHex": "<32-char hex>",
    "ivHex": "<24-char hex>",
    "ciphertextB64": "<base64 ciphertext with GCM auth tag>",
    "timestamp": "2026-10-11T11:53:22Z"
  }
  ```

### 2. Passcode / App Lock
- **Salt:** 16 random bytes.
- **Hash:** SHA-256 digest of `salt + PIN`.
- **Lockout Mechanism:** 5 consecutive incorrect attempts trigger a 30-second security cooldown.

### 3. Offline Ed25519 Licensing
- **Algorithm:** Ed25519 digital signature scheme (Edwards-curve Digital Signature Algorithm).
- **Public Key:** Hardcoded into `src/engine/licenseEngine.ts` (`0d9b36210340b3aba5006d9789ddf39ace97b7f027b17310ea2c0ce955a8ae5a`).
- **Private Key:** Maintained strictly offline by the software vendor in a secure password manager or HSM.
- **Verification:** Pure mathematical signature verification in browser memory using WebCrypto / `@noble/ed25519`.

---

## 🛡️ Content Security Policy (CSP)

Configured in `index.html`:
```http
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; font-src 'self' data:; frame-ancestors 'none'; object-src 'none'; base-uri 'self';
```

- `connect-src 'self'`: Disallows any outbound HTTP/WebSocket connection to external domains.
- `frame-ancestors 'none'`: Prevents clickjacking and framing inside unauthorized external iframes.
- `object-src 'none'`: Prevents embedding of unsafe Flash or Java plugins.

---

## 🧪 Test Results & Verification

All cryptographic components are rigorously tested in Vitest:
- `tests/encryption.test.ts`: 5 tests verifying AES-256-GCM round-tripping, incorrect passphrase rejection, tampering detection, and SHA-256 blob hashing.
- `tests/licensing.test.ts`: 4 tests verifying valid keys, expired-update retention, wrong plans, and tampered token rejection.
- `tests/privacy.test.ts`: 3 tests verifying zero-network enforcement and offline resilience.
- **Status:** 100% Passing (28/28 tests green).
