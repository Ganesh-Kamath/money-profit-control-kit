# Decisions & Assumptions Log (Local-First Architecture)

This document records the architectural and design decisions made for the 100% local, privacy-first **Money & Profit Control Kit**.

## 1. Local Storage Choice: IndexedDB via Dexie.js
- **Evaluation:** Evaluated SQLite-WASM on OPFS vs IndexedDB (Dexie.js).
- **Decision:** Selected Dexie.js (IndexedDB).
  - *Reasons:*
    1. 100% native support across all mobile (iOS Safari, Android Chrome) and desktop browsers without requiring `SharedArrayBuffer` or Cross-Origin Isolation (`COOP`/`COEP`) headers that complicate static hosting or PWA service worker caching.
    2. Built-in ACID transactions ensure atomic balance updates across accounts and transactions.
    3. Native support for Blob storage for receipt images/PDFs.
    4. Easily testable in Vitest via `fake-indexeddb` and in real browser environments via Playwright.
    5. Exceptional query performance for 50,000+ records via composite indexes.

## 2. Zero-Network Security Model
- **Decision:** The application issues ZERO network requests with user financial data.
- **Enforcement:**
  - Strict Content-Security-Policy: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; font-src 'self' data:; frame-ancestors 'none';`
  - Self-hosted Inter font and all SVG icons bundled locally.
  - Automated test verifying that no outbound fetch/XHR calls to external origins are ever made.

## 3. Offline Ed25519 Licensing
- **Decision:**
  - Owner uses `tools/keygen.ts` to generate an Ed25519 keypair and `tools/generate-license.ts` to sign customer licenses.
  - The frontend embeds ONLY the public key and uses the Web Crypto API / `@noble/ed25519` to verify signatures offline.
  - License payload specifies tier (`solo` or `business`), licensee name, email, issue date, and update validity date.
  - Solo tier permits 1 active workspace. Business tier permits up to 5 workspaces, customer invoicing/receivables, month-end review, and period locking.
  - Expired update periods NEVER lock the user out of their installed app or data.

## 4. Encryption & Privacy
- **Decision:**
  - Full backup exports (`.cpk` files) and receipt blobs are encrypted using WebCrypto AES-256-GCM with a key derived from a user-provided passphrase via PBKDF2 (100,000 iterations, SHA-256).
  - Passcode/PIN App Lock protects the UI session with auto-lock timer and session storage hash.
  - Clear Privacy Centre showing local database size, persistence status, and zero-network guarantee.
