# Decisions & Assumptions Log (ASSUMPTIONS.md)

This document records architectural, product, and implementation decisions made during the autonomous build of **Money & Profit Control Kit**.

## 1. Local Runtime & Database Dual-Mode Architecture
- **Situation:** Local workstation environment does not have Docker or native PostgreSQL installed. Production deployments will use managed Supabase (PostgreSQL with RLS + GoTrue Auth + Storage).
- **Decision:**
  1. We provide production-grade PostgreSQL SQL migrations in `supabase/migrations/` containing tables, constraints, functions, triggers, and Row Level Security policies for all tables.
  2. For the Python FastAPI backend and local development without Docker, we implement an SQLite/PostgreSQL-compatible abstraction with an in-process SQLite engine that executes exact RLS validation, role checking (Owner, Bookkeeper, Viewer), foreign keys, and atomic balance updates.
  3. The FastAPI service can connect either to local SQLite (zero-dependency instant run) or to Supabase via `SUPABASE_DATABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
  4. Docker Compose configuration is provided for teams who run Supabase/PostgreSQL locally via containers.

## 2. Shared Calculation Engine (Single Source of Truth)
- **Decision:** The calculation engine lives in `backend/app/calculation_engine.py` (and mirrored with deterministic TypeScript calculations for client-side offline previews). The backend calculation engine is authoritative for:
  - Dashboard overview numbers
  - Sales & Profit analytics
  - Cash flow breakdowns
  - Weekly and monthly reports
  - CSV and PDF export generation
  - Scheduled report emails
- **Rules Enforced:**
  - Money stored as integer paise (`amount_paise`). 1 INR = 100 paise.
  - Indian numbering formatting (`₹1,25,000.00`).
  - Transfers move money between accounts and NEVER count as revenue or expense.
  - Net Profit = Recognised Income − Recognised Expenses.
  - Cash Movement = Inflows − Outflows.
  - Unpaid invoices are receivables. Invoice collections increase cash but do not count as new revenue if invoice revenue was already recognised.
  - Period boundaries respect the business's timezone (default `Asia/Kolkata`) and Financial Year starting month (default April 1).

## 3. Payments & Provisioning (Razorpay + Simulated Mode)
- **Decision:**
  - Real mode validates `x-razorpay-signature` using HMAC-SHA256 with the webhook secret.
  - Test/Simulated mode: When running tests or local development without live Razorpay keys, setting `ENABLE_PAYMENT_SIMULATION=true` allows invoking a `/api/v1/payments/simulate` endpoint. This generates a synthetic payload, signs it with the local secret, and passes it through the exact same webhook verification and provisioning pipeline.
  - Automatic provisioning generates the user, workspace (business), license (Solo or Business tier, 12 months validity), default categories, accounts, and dispatches a welcome email.

## 4. Email Sink & Test Mode
- **Decision:**
  - Resend API key integration is supported for production.
  - When `RESEND_API_KEY` is not configured or in development mode, emails are routed to a local development memory/file sink (`backend/logs/sent_emails.jsonl`) with an API inspection endpoint `/api/v1/emails/recent` so test scripts and UI can verify generated emails without external network dependencies.

## 5. Storage & Receipts
- **Decision:**
  - Production uses Supabase Storage private bucket `receipts`.
  - Local mode stores receipts in `backend/storage/receipts` and issues time-limited signed access tokens via FastAPI.
  - Receipt duplicates are detected via SHA-256 hash.

## 6. AI & LLM Features
- **Decision:**
  - AI receipt parsing and natural-language "Ask about my numbers" assistant are feature-flagged OFF by default (`ENABLE_AI_RECEIPTS=false`, `ENABLE_AI_ASSISTANT=false`).
  - Deterministic assistant runs exact SQL/calculation aggregations for standard questions ("largest expense this month", "why did profit change") and surfaces verified calculations.
  - When flags are enabled without an external key, a mock provider returns deterministic structured extractions for end-to-end testing.
