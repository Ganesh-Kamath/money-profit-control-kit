# Money & Profit Control Kit — Product Blueprint & Specification

## 0. Workspace & Build Principles
- Dedicated standalone repository inside `money-profit-control-kit`.
- Modular monolith architecture (no microservices).
- Strict adherence to financial correctness: integer paise, deterministic calculation engine, explicit rounding rules, balance-affecting atomic writes, period locks, audit events.
- Never advertise or display as available any feature not implemented and verified.
- Honest positioning: complements an accountant, does NOT replace statutory bookkeeping, tax filing, or audited statements.

---

## 1. Product Overview & Market
- **Target Audience:** Small Indian businesses using notebooks, WhatsApp, calculator apps or Excel without needing Tally or full ERP.
  - *Primary focus:* Home businesses (bakers, tiffin sellers, craftspeople, online resellers) and solo service providers (designers, tutors, consultants, repair services).
  - *Secondary focus:* Small retail shops.
- **The 5 Core Questions Answered in Seconds:**
  1. How much money came in today?
  2. How much did I spend, and on what?
  3. How much profit did the business actually make?
  4. How much money do I have available right now?
  5. What payments, bills or expenses need my attention next?
- **Commercial Model:**
  - One-time purchase with 12 months hosted access included, optional annual renewal.
  - *Solo:* ₹2,999 (1 user)
  - *Business:* ₹3,999 (owner plus invited members with roles: owner, bookkeeper, viewer)
  - Zero developer involvement per customer: self-service purchase, provisioning, setup, operation, billing, exports.

---

## 2. System Architecture
- **Frontend:**
  - React + Vite + TypeScript + Tailwind CSS, Lucide icons.
  - Installable PWA: Web manifest, Service Worker, app icons, install prompt, offline queue for transaction entry with idempotent sync on reconnect, clear online/offline/syncing status badge.
- **Backend Data Layer:**
  - Supabase (PostgreSQL with Row Level Security on EVERY table, Auth, private Storage bucket for receipts).
  - Support for local dev and tests without cloud lock-in.
- **Python FastAPI Service:**
  - Shared calculation engine module for dashboard, exports, reports, and emails.
  - Report calculations, import parsing wizards, scheduled report emails, Razorpay payment webhooks, exports & backups.
- **Payments:**
  - Razorpay Checkout + signature-verified webhook auto-provisioning user, workspace, license, and welcome email.
  - Dev/test mode with local simulated payment exercising the exact same webhook verification logic.
- **Email:**
  - Resend / SMTP with local development sink (e.g., Mailpit or local test sink) for email verification.
- **Operational Artifacts:**
  - Docker Compose, run scripts (`make dev` or npm/python scripts), `.env.example`, README. No frontend secrets or service-role exposure.

---

## 3. Financial Model & Rules (Authoritative Engineering Requirements)
1. **Paise Precision:** All currency stored as integer paise (or fixed-precision numeric). Never floating point arithmetic for authoritative values. Explicit rounding rules.
2. **Transaction Types:** Income, Expense, Transfer, Adjustment. Transfers move money between accounts and are NEVER revenue or expense.
3. **Closing Balance Formula:** `Closing Balance = Opening Balance + Inflows - Outflows`. Transfers reduce source and increase destination.
4. **Atomic Balance Writes:** Balance-affecting writes must be atomic via DB transactions/RPCs.
5. **Separation of Concerns:** Cash movement != revenue recognition != expense recognition != receivables != account balances.
6. **Cash Flow != Profit:**
   - `Net Cash Movement = Cash Inflows - Cash Outflows`
   - `Operating Profit = Revenue - Operating Expenses`
   - `Net Profit = Recognised Income - Recognised Expenses`
   - `Net Margin = (Net Profit / Revenue) * 100`
   - `Gross Profit = Net Sales Revenue - COGS` (manually entered COGS in this release with visible assumptions).
   - Never label cash received minus cash paid as "net profit". Always label profit as "Estimated net profit" with clear assumptions.
7. **Cash Basis & Invoicing:** Cash-basis style tracking with clearly defined income/expense reporting PLUS optional unpaid invoices (receivables). Recording collection against an invoice already recognized as revenue increases cash but NEVER duplicates revenue.
8. **Soft Voids & Immutability:** Editing or voiding updates every affected balance and report. No hard deletes of financial records: soft void with reason, user, timestamp, and audit trail. Edits preserve before/after state.
9. **Idempotency Keys:** Mandatory on imports, offline queue sync, payments, and webhooks.
10. **Duplicate Detection:** Warn when amount, date, description, or receipt closely matches existing records. Content hashing for receipts.
11. **Receipt Linking:** Real-world expense never counted twice because it has both receipt and transaction.
12. **Timezones & FY:** Configured business timezone and financial year start (e.g., April 1 for India). Indian number formatting everywhere (`₹1,25,000.00`).
13. **Asset & Inventory Classification:** Distinguish inventory/stock purchases from consumed costs, and equipment from ordinary operating expenses via category flags.
14. **Period Locking:** After month-end review, periods can be locked; later changes require controlled adjustments with audit logs.

---

## 4. Data Model (PostgreSQL & RLS)
- Tables with `business_id` and RLS:
  - `businesses`
  - `business_memberships` (owner, bookkeeper, viewer)
  - `accounts` (cash, bank, UPI, petty cash, custom; opening balance + as_of date)
  - `transactions` (canonical: type, amount_paise, occurred_at, category_id, account_id, to_account_id, description, contact_id, reference, notes, status, void_reason, voided_at, voided_by, idempotency_key, source)
  - `transaction_splits`
  - `categories` (income/expense, is_stock, is_equipment)
  - `receipts` (metadata, sha256 hash, storage path, status: Needs details/Ready/Reviewed, linked transaction)
  - `contacts` (customers/suppliers)
  - `invoices` (receivables, items, due_date, status: unpaid/partially_paid/paid, paid_paise)
  - `imports` & `mapping_profiles` (file metadata, mapping, status, row results, undo support)
  - `reconciliations` (statement balance vs recorded, period, status)
  - `period_locks`
  - `audit_events`
  - `alerts` & `alert_preferences`
  - `report_schedules` & `report_runs`
  - `licenses` & `payments`
  - `connection_status`
  - `feature_flags`

---

## 5. Core Application Pages & Capabilities
- **5.1 Marketing & Purchase:** Value prop, 5 questions, screenshots, pricing tiers (Solo ₹2,999 / Business ₹3,999), FAQ, honest scope limits, Razorpay checkout flow, simulated payment mode, legal draft pages, "Try demo" mode.
- **5.2 Guided Onboarding:** Business details, timezone, FY start, business type presets (bakery/food, freelancer, retail, reseller), accounts setup with opening balances & as-of dates, import prompt, first transaction recorder, interactive checklist.
- **5.3 App Shell:** Sidebar / mobile bottom navigation, universal "+ Add transaction" accessible everywhere.
- **5.4 Overview:** Answers 5 questions in seconds; Cash flow chart, category breakdown, recent items, Attention Required panel, data completeness indicator.
- **5.5 Add Transaction Modal:** Income, expense, transfer, adjustment. Live preview, recent categories, default account, amount validation, double-submit lock, offline queue support, duplicate warning.
- **5.6 Transactions List:** Filter, search, sort, pagination, edit, void, bulk categorize, CSV export, audit trail viewer, mobile card layout.
- **5.7 Expenses & Receipts:** Receipt upload & camera capture, hash duplicate check, linking without double counting, status (Needs details, Ready, Reviewed), signed URLs, unreviewed queue, optional AI extraction (mocked/feature-flagged off).
- **5.8 Sales & Profit:** Revenue, recorded expenses, estimated net profit, net margin, manual COGS, gross profit. Time granularity (day/week/month), drill-down into every number, "How this is calculated" explanation panel.
- **5.9 Cash & Accounts:** Accounts management, opening balances, transfers, reconciliation flow against user-entered statement balances.
- **5.10 Receivables:** Light invoice tracking, customer receivables, partial/full collections without revenue double-counting.
- **5.11 Reports:** Weekly & monthly reports from shared calculation engine; month-end review flow, period locking, CSV & printable PDF export, test email sender.
- **5.12 Attention Centre & Alerts:** Unreviewed expenses, duplicates, missing receipts, reconciliation discrepancies, unusual expense alerts.
- **5.13 Assistant:** Deterministic queries over records ("Ask about my numbers"), feature-flagged LLM interface.
- **5.14 Connections:** Bank/UPI statement import wizard with column mapping, presets (HDFC, ICICI, SBI, Axis, Kotak, PhonePe, GPay, Paytm), sales CSV import, data export/backup (CSV + ZIP), honest "Coming soon" toggles.
- **5.15 Billing & Settings:** License status & renewal, team member roles & invite management, category/account editors, delete workspace with export-first flow.

---

## 6. Design System & Security
- Navy primary (`#0F172A`), emerald positive (`#059669`), muted red negative (`#DC2626`), amber warning (`#D97706`), neutral slate background (`#F8FAFC`).
- Inter typeface with tabular figures for currency.
- Strict RLS on all tables, role-based backend authorization, rate limiting, webhook signature verification, audit logging.
