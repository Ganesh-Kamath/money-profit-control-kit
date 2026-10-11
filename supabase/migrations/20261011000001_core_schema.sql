-- =============================================================================
-- Money & Profit Control Kit — Core Database Schema
-- Migration: 20261011000001_core_schema.sql
-- All monetary amounts stored as integer paise (1 INR = 100 paise).
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Businesses (Tenants)
CREATE TABLE IF NOT EXISTS businesses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    business_type TEXT NOT NULL DEFAULT 'other', -- home_bakery, service, retail, reseller, other
    currency TEXT NOT NULL DEFAULT 'INR',
    timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    fy_start_month INTEGER NOT NULL DEFAULT 4, -- 4 = April (Standard Indian Financial Year)
    is_demo BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Business Memberships (Owner, Bookkeeper, Viewer)
CREATE TABLE IF NOT EXISTS business_memberships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    user_id UUID NOT NULL, -- references auth.users(id)
    email TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('owner', 'bookkeeper', 'viewer')),
    invited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    accepted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (business_id, user_id),
    UNIQUE (business_id, email)
);

CREATE INDEX IF NOT EXISTS idx_memberships_user ON business_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_business ON business_memberships(business_id);

-- 3. Categories
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    icon TEXT,
    color TEXT,
    is_stock BOOLEAN NOT NULL DEFAULT FALSE,      -- inventory/stock purchase (vs consumed expense)
    is_equipment BOOLEAN NOT NULL DEFAULT FALSE,  -- capital asset / equipment (vs operational expense)
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (business_id, name, type)
);

CREATE INDEX IF NOT EXISTS idx_categories_business ON categories(business_id);

-- 4. Payment Accounts
CREATE TABLE IF NOT EXISTS accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    account_type TEXT NOT NULL CHECK (account_type IN ('cash', 'bank', 'upi', 'petty_cash', 'custom')),
    account_number_last4 TEXT,
    opening_balance_paise BIGINT NOT NULL DEFAULT 0,
    opening_balance_date DATE NOT NULL DEFAULT CURRENT_DATE,
    current_balance_paise BIGINT NOT NULL DEFAULT 0,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (business_id, name)
);

CREATE INDEX IF NOT EXISTS idx_accounts_business ON accounts(business_id);

-- 5. Contacts (Customers & Suppliers)
CREATE TABLE IF NOT EXISTS contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    contact_type TEXT NOT NULL CHECK (contact_type IN ('customer', 'supplier', 'both')),
    phone TEXT,
    email TEXT,
    upi_id TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contacts_business ON contacts(business_id);

-- 6. Canonical Transactions
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'transfer', 'adjustment')),
    amount_paise BIGINT NOT NULL CHECK (amount_paise > 0),
    occurred_at TIMESTAMPTZ NOT NULL,
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
    to_account_id UUID REFERENCES accounts(id) ON DELETE RESTRICT, -- Required for transfers
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL, -- Income/expense category
    contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    description TEXT NOT NULL,
    reference_number TEXT,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'voided')),
    void_reason TEXT,
    voided_at TIMESTAMPTZ,
    voided_by UUID,
    idempotency_key TEXT,
    source TEXT NOT NULL DEFAULT 'manual', -- manual, import, pos, recurring, offline_sync
    import_id UUID,
    is_reviewed BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_transfer_accounts CHECK (
        (type = 'transfer' AND to_account_id IS NOT NULL AND to_account_id <> account_id)
        OR (type <> 'transfer' AND to_account_id IS NULL)
    ),
    CONSTRAINT chk_category_for_income_expense CHECK (
        (type IN ('income', 'expense') AND category_id IS NOT NULL)
        OR (type IN ('transfer', 'adjustment'))
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_idempotency 
    ON transactions(business_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_business_date 
    ON transactions(business_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_account 
    ON transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_category 
    ON transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status 
    ON transactions(business_id, status);

-- 7. Transaction Splits (Optional multi-category breakdown)
CREATE TABLE IF NOT EXISTS transaction_splits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    amount_paise BIGINT NOT NULL CHECK (amount_paise > 0),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Receipts (Document metadata and linking)
CREATE TABLE IF NOT EXISTS receipts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
    file_name TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    file_size_bytes INTEGER NOT NULL,
    mime_type TEXT NOT NULL,
    sha256_hash TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'needs_details' CHECK (status IN ('needs_details', 'ready', 'reviewed')),
    ocr_extracted_data JSONB,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_receipts_business ON receipts(business_id);
CREATE INDEX IF NOT EXISTS idx_receipts_hash ON receipts(business_id, sha256_hash);
CREATE INDEX IF NOT EXISTS idx_receipts_transaction ON receipts(transaction_id);

-- 9. Invoices & Receivables
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    invoice_number TEXT NOT NULL,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE RESTRICT,
    issue_date DATE NOT NULL,
    due_date DATE NOT NULL,
    total_amount_paise BIGINT NOT NULL CHECK (total_amount_paise > 0),
    paid_amount_paise BIGINT NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'partially_paid', 'paid', 'cancelled')),
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    notes TEXT,
    revenue_recognised BOOLEAN NOT NULL DEFAULT TRUE, -- Flag indicating revenue recognized at invoice time
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (business_id, invoice_number)
);

CREATE INDEX IF NOT EXISTS idx_invoices_business ON invoices(business_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(business_id, status);

-- 10. Invoice Collections (Link collections to invoices without duplicate revenue)
CREATE TABLE IF NOT EXISTS invoice_collections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE RESTRICT,
    amount_paise BIGINT NOT NULL CHECK (amount_paise > 0),
    collected_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoice_collections_invoice ON invoice_collections(invoice_id);

-- 11. Imports & Mapping Profiles
CREATE TABLE IF NOT EXISTS mapping_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    profile_type TEXT NOT NULL, -- hdfc, icici, sbi, axis, phonepe, gpay, paytm, custom
    column_mapping JSONB NOT NULL,
    date_format TEXT NOT NULL DEFAULT 'DD/MM/YYYY',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS imports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    mapping_profile_id UUID REFERENCES mapping_profiles(id),
    total_rows INTEGER NOT NULL DEFAULT 0,
    imported_rows INTEGER NOT NULL DEFAULT 0,
    skipped_duplicates INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'undone', 'failed')),
    error_summary TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12. Account Reconciliations
CREATE TABLE IF NOT EXISTS reconciliations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    statement_balance_paise BIGINT NOT NULL,
    recorded_balance_paise BIGINT NOT NULL,
    difference_paise BIGINT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('matched', 'discrepancy')),
    notes TEXT,
    reconciled_by UUID,
    reconciled_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reconciliations_account ON reconciliations(account_id);

-- 13. Period Locks (Month-end control)
CREATE TABLE IF NOT EXISTS period_locks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    period_end_date DATE NOT NULL,
    locked_by UUID NOT NULL,
    locked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notes TEXT,
    UNIQUE (business_id, period_end_date)
);

-- 14. Audit Events
CREATE TABLE IF NOT EXISTS audit_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    user_id UUID,
    action TEXT NOT NULL, -- create, update, void, reconcile, lock_period, import, undo_import
    entity_type TEXT NOT NULL, -- transaction, account, receipt, period_lock, category
    entity_id UUID NOT NULL,
    before_state JSONB,
    after_state JSONB,
    ip_address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_business_date ON audit_events(business_id, created_at DESC);

-- 15. Alerts & Preferences
CREATE TABLE IF NOT EXISTS alert_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    email_weekly_report BOOLEAN NOT NULL DEFAULT TRUE,
    email_unusual_expense BOOLEAN NOT NULL DEFAULT TRUE,
    unusual_expense_threshold_paise BIGINT NOT NULL DEFAULT 500000, -- ₹5,000 threshold default
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (business_id, user_id)
);

CREATE TABLE IF NOT EXISTS alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- unreviewed_expense, possible_duplicate, missing_receipt, reconciliation_discrepancy, unusual_expense, weekly_report_ready
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'critical')),
    entity_type TEXT,
    entity_id UUID,
    is_dismissed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alerts_business ON alerts(business_id, is_dismissed);

-- 16. Report Schedules & Runs
CREATE TABLE IF NOT EXISTS report_schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    frequency TEXT NOT NULL CHECK (frequency IN ('weekly', 'monthly')),
    recipient_emails TEXT[] NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS report_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    period_type TEXT NOT NULL, -- daily, weekly, monthly
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    metrics JSONB NOT NULL,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 17. Licenses & Payments
CREATE TABLE IF NOT EXISTS licenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    tier TEXT NOT NULL CHECK (tier IN ('solo', 'business')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'grace_period')),
    max_users INTEGER NOT NULL DEFAULT 1,
    starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_licenses_business ON licenses(business_id);

CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    provider TEXT NOT NULL DEFAULT 'razorpay',
    order_id TEXT NOT NULL,
    payment_id TEXT,
    signature TEXT,
    amount_paise BIGINT NOT NULL,
    currency TEXT NOT NULL DEFAULT 'INR',
    tier TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('created', 'captured', 'failed', 'refunded')),
    idempotency_key TEXT UNIQUE,
    payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_business ON payments(business_id);
CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);

-- 18. Connection Status & Feature Flags
CREATE TABLE IF NOT EXISTS connection_status (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    connector_type TEXT NOT NULL, -- statement_import, sales_import, email_reports, data_backup
    status TEXT NOT NULL CHECK (status IN ('connected', 'not_connected', 'error', 'last_synced')),
    last_synced_at TIMESTAMPTZ,
    details JSONB,
    UNIQUE (business_id, connector_type)
);

CREATE TABLE IF NOT EXISTS feature_flags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    flag_key TEXT NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT FALSE,
    metadata JSONB,
    UNIQUE (business_id, flag_key)
);
