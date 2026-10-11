# Money & Profit Control Kit — Local-First Blueprint & Specification

## 0. Core Philosophy & Rules
- **100% Local, Zero Backend:** All calculations, storage, licensing, reports, and backups run entirely in the browser on the user's device.
- **Zero Network Exposure:** No server, no accounts, no telemetry, no analytics, no external CDN calls. Data never leaves the device.
- **Privacy-First:** Passcode/PIN App Lock, on-device AES-256-GCM encryption for backups and receipts, verifiable zero-network posture.
- **Financial Correctness:** Integer paise only, neutral transfers, atomic writes, separate cash vs profit concepts, period locking, audit trails.
- **Honest Positioning:** Complements an accountant; does NOT replace statutory bookkeeping, tax/GST filing, or audited statements.

---

## 1. Product & Commercial Model
- **Target Audience:** Small Indian businesses (home bakers, tiffin services, freelance designers/tutors, repair services, small shops) outgrowing notebooks, WhatsApp, and Excel.
- **The 5 Core Questions Answered in Seconds:**
  1. How much money came in today?
  2. How much did I spend, and on what?
  3. How much estimated net profit did the business actually make?
  4. How much money is available right now across accounts?
  5. What payments, bills or expenses need my attention next?
- **Licensing Model (Offline signed Ed25519 tokens):**
  - **Solo (₹2,999):** 1 business workspace.
  - **Business (₹3,999):** Up to 5 workspaces on device, customer invoices & receivables with printable PDF, month-end review, period locking.
  - Lifetime use of installed version + 12 months free updates. Never locks users out of their data.
  - Key generated offline via owner CLI `tools/generate-license.ts`.

---

## 2. Technical Architecture
- **Frontend Stack:** React 18, Vite, TypeScript, Tailwind CSS, Lucide icons.
- **Installable PWA:** Manifest, Service Worker precaching entire app for 100% offline usage after first load, install prompt with iOS guidance, update prompt.
- **Storage Layer:** Dexie.js (IndexedDB) with native ACID transactions, blob storage for receipts, persistent storage request (`navigator.storage.persist()`), persistence status indicator.
- **Security & CSP:** Strict Content Security Policy (`connect-src 'self' only`, `frame-ancestors 'none'`, no inline eval).
- **Calculation Engine:** Pure TypeScript calculation module without UI or storage dependencies (single source of truth for dashboard, drill-downs, reports, and exports).

---

## 3. Financial Model & Rules
1. **Paise Precision:** All currency in integer paise (1 INR = 100 paise). Indian format (`₹1,25,000.00`).
2. **Transaction Types:** Income, Expense, Transfer, Adjustment. Transfers are strictly neutral.
3. **Closing Balance:** `Closing = Opening + Inflows - Outflows`.
4. **Atomic Writes:** All balance mutations run in single IndexedDB transactions.
5. **Cash Flow vs Profit:**
   - `Net Cash Movement = Inflows - Outflows`
   - `Estimated Net Profit = Recognised Income - Recognised Expenses`
   - `Net Margin % = (Net Profit / Revenue) * 100`
   - `Gross Profit = Revenue - COGS (manual COGS)`
6. **Receivables (Business Tier):** Invoicing tracks unpaid balances. Collecting invoice increases cash but NEVER duplicates revenue.
7. **Soft Voids & Immutability:** No hard deletes of financial transactions. Soft void with reason, timestamp, and audit trail.
8. **Idempotent Imports:** Content hashing and idempotency keys prevent duplicates.
9. **Timezone & Boundaries:** Business timezone (default `Asia/Kolkata`) and Financial Year start (April 1).
10. **Category Flags:** Stock purchases (`is_stock`) and Capital equipment (`is_equipment`).
11. **Period Locking:** Month-end locks prevent historical edits without audited adjustments.

---

## 4. Key Modules & Features
- **4.1 Onboarding & Setup Checklist:** Business profile, FY start, business-type category presets, accounts opening balances with as-of dates, optional PIN setup.
- **4.2 Add Transaction:** Income, Expense, Transfer, Adjustment with live preview (`-₹450 · Packaging · UPI`), duplicate warning, keyboard shortcuts.
- **4.3 Transactions List:** Fast searchable, filterable, virtualized/paginated table, view/edit/void, bulk categorize, CSV export, audit logs.
- **4.4 Expenses & Receipts:** Local blob storage, SHA-256 duplicate detection, status (Needs details / Ready / Reviewed), missing receipt flags, category re-allocation.
- **4.5 Sales & Profit:** Time-series trends, category breakdown, comparison with previous period, clickable drill-down into records, "How this is calculated" panel.
- **4.6 Cash & Accounts:** Per-account balances, transfers, reconciliation flow comparing recorded balance vs statement balance.
- **4.7 Receivables (Business Tier):** Invoice generation, partial/full collections, printable invoice PDF.
- **4.8 Reports:** Daily/weekly/monthly in-app summaries, month-end review flow, period lock, on-device printable PDF & CSV export.
- **4.9 Attention Centre:** Unreviewed expenses, duplicate warnings, missing receipts, account discrepancies, statistical expense outliers, backup reminders.
- **4.10 "Ask about my numbers":** Deterministic on-device queries with exact figures and data sufficiency checks.
- **4.11 Import & Backup:** Bank/UPI statement import wizard with presets (HDFC, ICICI, SBI, Axis, Kotak, PhonePe, GPay, Paytm), sales CSV import, encrypted full backup (`.cpk` file) with AES-256-GCM, CSV+ZIP export, auto-backup reminder.
- **4.12 Settings & Privacy Centre:** Workspace switcher, license viewer, PIN lock config, verifiable zero-network proof, wipe data.
- **4.13 Marketing / Sales Page:** Static site (`/site`) with value proposition, 5 questions, pricing, FAQ, legal drafts, payment link integration.
