import sqlite3
import os
import json
import uuid
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from .config import settings

def get_db_path() -> str:
    # Extracts path from sqlite:///./control_kit.db
    url = settings.DATABASE_URL
    if url.startswith("sqlite:///"):
        return url.replace("sqlite:///", "")
    return "control_kit.db"

def get_connection() -> sqlite3.Connection:
    db_path = get_db_path()
    os.makedirs(os.path.dirname(os.path.abspath(db_path)), exist_ok=True)
    conn = sqlite3.connect(db_path, timeout=30.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.execute("PRAGMA journal_mode = WAL;")
    return conn

def init_db():
    conn = get_connection()
    with conn:
        conn.executescript("""
        CREATE TABLE IF NOT EXISTS businesses (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            business_type TEXT NOT NULL DEFAULT 'other',
            currency TEXT NOT NULL DEFAULT 'INR',
            timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
            fy_start_month INTEGER NOT NULL DEFAULT 4,
            is_demo INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            full_name TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS business_memberships (
            id TEXT PRIMARY KEY,
            business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
            user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            email TEXT NOT NULL,
            role TEXT NOT NULL CHECK (role IN ('owner', 'bookkeeper', 'viewer')),
            invited_at TEXT NOT NULL,
            accepted_at TEXT,
            created_at TEXT NOT NULL,
            UNIQUE (business_id, user_id),
            UNIQUE (business_id, email)
        );

        CREATE TABLE IF NOT EXISTS categories (
            id TEXT PRIMARY KEY,
            business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
            icon TEXT,
            color TEXT,
            is_stock INTEGER NOT NULL DEFAULT 0,
            is_equipment INTEGER NOT NULL DEFAULT 0,
            is_default INTEGER NOT NULL DEFAULT 0,
            archived INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL,
            UNIQUE (business_id, name, type)
        );

        CREATE TABLE IF NOT EXISTS accounts (
            id TEXT PRIMARY KEY,
            business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            account_type TEXT NOT NULL CHECK (account_type IN ('cash', 'bank', 'upi', 'petty_cash', 'custom')),
            account_number_last4 TEXT,
            opening_balance_paise INTEGER NOT NULL DEFAULT 0,
            opening_balance_date TEXT NOT NULL,
            current_balance_paise INTEGER NOT NULL DEFAULT 0,
            is_default INTEGER NOT NULL DEFAULT 0,
            archived INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            UNIQUE (business_id, name)
        );

        CREATE TABLE IF NOT EXISTS contacts (
            id TEXT PRIMARY KEY,
            business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            contact_type TEXT NOT NULL CHECK (contact_type IN ('customer', 'supplier', 'both')),
            phone TEXT,
            email TEXT,
            upi_id TEXT,
            notes TEXT,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS transactions (
            id TEXT PRIMARY KEY,
            business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
            type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'transfer', 'adjustment')),
            amount_paise INTEGER NOT NULL CHECK (amount_paise > 0),
            occurred_at TEXT NOT NULL,
            account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
            to_account_id TEXT REFERENCES accounts(id) ON DELETE RESTRICT,
            category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
            contact_id TEXT REFERENCES contacts(id) ON DELETE SET NULL,
            description TEXT NOT NULL,
            reference_number TEXT,
            notes TEXT,
            status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'voided')),
            void_reason TEXT,
            voided_at TEXT,
            voided_by TEXT,
            idempotency_key TEXT,
            source TEXT NOT NULL DEFAULT 'manual',
            import_id TEXT,
            is_reviewed INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_idempotency 
            ON transactions(business_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
        CREATE INDEX IF NOT EXISTS idx_transactions_business_date 
            ON transactions(business_id, occurred_at);
        CREATE INDEX IF NOT EXISTS idx_transactions_account 
            ON transactions(account_id);
        CREATE INDEX IF NOT EXISTS idx_transactions_category 
            ON transactions(category_id);

        CREATE TABLE IF NOT EXISTS transaction_splits (
            id TEXT PRIMARY KEY,
            transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
            category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
            amount_paise INTEGER NOT NULL CHECK (amount_paise > 0),
            notes TEXT,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS receipts (
            id TEXT PRIMARY KEY,
            business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
            transaction_id TEXT REFERENCES transactions(id) ON DELETE SET NULL,
            file_name TEXT NOT NULL,
            storage_path TEXT NOT NULL,
            file_size_bytes INTEGER NOT NULL,
            mime_type TEXT NOT NULL,
            sha256_hash TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'needs_details' CHECK (status IN ('needs_details', 'ready', 'reviewed')),
            ocr_extracted_data TEXT,
            notes TEXT,
            created_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_receipts_business ON receipts(business_id);
        CREATE INDEX IF NOT EXISTS idx_receipts_hash ON receipts(business_id, sha256_hash);

        CREATE TABLE IF NOT EXISTS invoices (
            id TEXT PRIMARY KEY,
            business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
            invoice_number TEXT NOT NULL,
            contact_id TEXT NOT NULL REFERENCES contacts(id) ON DELETE RESTRICT,
            issue_date TEXT NOT NULL,
            due_date TEXT NOT NULL,
            total_amount_paise INTEGER NOT NULL CHECK (total_amount_paise > 0),
            paid_amount_paise INTEGER NOT NULL DEFAULT 0,
            status TEXT NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'partially_paid', 'paid', 'cancelled')),
            category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
            notes TEXT,
            revenue_recognised INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            UNIQUE (business_id, invoice_number)
        );

        CREATE TABLE IF NOT EXISTS invoice_collections (
            id TEXT PRIMARY KEY,
            business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
            invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
            transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE RESTRICT,
            amount_paise INTEGER NOT NULL CHECK (amount_paise > 0),
            collected_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS mapping_profiles (
            id TEXT PRIMARY KEY,
            business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            profile_type TEXT NOT NULL,
            column_mapping TEXT NOT NULL,
            date_format TEXT NOT NULL DEFAULT 'DD/MM/YYYY',
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS imports (
            id TEXT PRIMARY KEY,
            business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
            file_name TEXT NOT NULL,
            mapping_profile_id TEXT,
            total_rows INTEGER NOT NULL DEFAULT 0,
            imported_rows INTEGER NOT NULL DEFAULT 0,
            skipped_duplicates INTEGER NOT NULL DEFAULT 0,
            status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'undone', 'failed')),
            error_summary TEXT,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS reconciliations (
            id TEXT PRIMARY KEY,
            business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
            account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
            period_start TEXT NOT NULL,
            period_end TEXT NOT NULL,
            statement_balance_paise INTEGER NOT NULL,
            recorded_balance_paise INTEGER NOT NULL,
            difference_paise INTEGER NOT NULL,
            status TEXT NOT NULL CHECK (status IN ('matched', 'discrepancy')),
            notes TEXT,
            reconciled_by TEXT,
            reconciled_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS period_locks (
            id TEXT PRIMARY KEY,
            business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
            period_end_date TEXT NOT NULL,
            locked_by TEXT NOT NULL,
            locked_at TEXT NOT NULL,
            notes TEXT,
            UNIQUE (business_id, period_end_date)
        );

        CREATE TABLE IF NOT EXISTS audit_events (
            id TEXT PRIMARY KEY,
            business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
            user_id TEXT,
            action TEXT NOT NULL,
            entity_type TEXT NOT NULL,
            entity_id TEXT NOT NULL,
            before_state TEXT,
            after_state TEXT,
            ip_address TEXT,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS alert_preferences (
            id TEXT PRIMARY KEY,
            business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
            user_id TEXT NOT NULL,
            email_weekly_report INTEGER NOT NULL DEFAULT 1,
            email_unusual_expense INTEGER NOT NULL DEFAULT 1,
            unusual_expense_threshold_paise INTEGER NOT NULL DEFAULT 500000,
            created_at TEXT NOT NULL,
            UNIQUE (business_id, user_id)
        );

        CREATE TABLE IF NOT EXISTS alerts (
            id TEXT PRIMARY KEY,
            business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
            type TEXT NOT NULL,
            title TEXT NOT NULL,
            message TEXT NOT NULL,
            severity TEXT NOT NULL DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'critical')),
            entity_type TEXT,
            entity_id TEXT,
            is_dismissed INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS report_schedules (
            id TEXT PRIMARY KEY,
            business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
            frequency TEXT NOT NULL CHECK (frequency IN ('weekly', 'monthly')),
            recipient_emails TEXT NOT NULL,
            is_active INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS report_runs (
            id TEXT PRIMARY KEY,
            business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
            period_type TEXT NOT NULL,
            period_start TEXT NOT NULL,
            period_end TEXT NOT NULL,
            metrics TEXT NOT NULL,
            generated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS licenses (
            id TEXT PRIMARY KEY,
            business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
            tier TEXT NOT NULL CHECK (tier IN ('solo', 'business')),
            status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'grace_period')),
            max_users INTEGER NOT NULL DEFAULT 1,
            starts_at TEXT NOT NULL,
            expires_at TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS payments (
            id TEXT PRIMARY KEY,
            business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
            provider TEXT NOT NULL DEFAULT 'razorpay',
            order_id TEXT NOT NULL,
            payment_id TEXT,
            signature TEXT,
            amount_paise INTEGER NOT NULL,
            currency TEXT NOT NULL DEFAULT 'INR',
            tier TEXT NOT NULL,
            status TEXT NOT NULL CHECK (status IN ('created', 'captured', 'failed', 'refunded')),
            idempotency_key TEXT UNIQUE,
            payload TEXT,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS connection_status (
            id TEXT PRIMARY KEY,
            business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
            connector_type TEXT NOT NULL,
            status TEXT NOT NULL CHECK (status IN ('connected', 'not_connected', 'error', 'last_synced')),
            last_synced_at TEXT,
            details TEXT,
            UNIQUE (business_id, connector_type)
        );

        CREATE TABLE IF NOT EXISTS feature_flags (
            id TEXT PRIMARY KEY,
            business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
            flag_key TEXT NOT NULL,
            enabled INTEGER NOT NULL DEFAULT 0,
            metadata TEXT,
            UNIQUE (business_id, flag_key)
        );
        """)
    conn.close()

def recalculate_account_balance(conn: sqlite3.Connection, account_id: str) -> int:
    """
    Authoritative account closing balance calculation:
    Closing Balance = Opening Balance + Inflows - Outflows + Net Transfers + Adjustments
    """
    row = conn.execute("SELECT opening_balance_paise FROM accounts WHERE id = ?", (account_id,)).fetchone()
    if not row:
        raise ValueError(f"Account {account_id} not found")
    
    opening_balance = row["opening_balance_paise"]
    
    # Inflows (income)
    row_inc = conn.execute("""
        SELECT COALESCE(SUM(amount_paise), 0) as total
        FROM transactions
        WHERE account_id = ? AND type = 'income' AND status = 'active'
    """, (account_id,)).fetchone()
    inflows = row_inc["total"] if row_inc else 0
    
    # Outflows (expense)
    row_exp = conn.execute("""
        SELECT COALESCE(SUM(amount_paise), 0) as total
        FROM transactions
        WHERE account_id = ? AND type = 'expense' AND status = 'active'
    """, (account_id,)).fetchone()
    outflows = row_exp["total"] if row_exp else 0
    
    # Transfers in (destination = account_id)
    row_tin = conn.execute("""
        SELECT COALESCE(SUM(amount_paise), 0) as total
        FROM transactions
        WHERE to_account_id = ? AND type = 'transfer' AND status = 'active'
    """, (account_id,)).fetchone()
    transfers_in = row_tin["total"] if row_tin else 0
    
    # Transfers out (source = account_id)
    row_tout = conn.execute("""
        SELECT COALESCE(SUM(amount_paise), 0) as total
        FROM transactions
        WHERE account_id = ? AND type = 'transfer' AND status = 'active'
    """, (account_id,)).fetchone()
    transfers_out = row_tout["total"] if row_tout else 0
    
    # Adjustments
    row_adj = conn.execute("""
        SELECT COALESCE(SUM(amount_paise), 0) as total
        FROM transactions
        WHERE account_id = ? AND type = 'adjustment' AND status = 'active'
    """, (account_id,)).fetchone()
    adjustments = row_adj["total"] if row_adj else 0
    
    closing_balance = opening_balance + inflows - outflows + (transfers_in - transfers_out) + adjustments
    
    now_str = datetime.now(timezone.utc).isoformat()
    conn.execute("""
        UPDATE accounts
        SET current_balance_paise = ?, updated_at = ?
        WHERE id = ?
    """, (closing_balance, now_str, account_id))
    
    return closing_balance

def record_audit_event(
    conn: sqlite3.Connection,
    business_id: str,
    action: str,
    entity_type: str,
    entity_id: str,
    user_id: Optional[str] = None,
    before_state: Optional[Dict[str, Any]] = None,
    after_state: Optional[Dict[str, Any]] = None,
    ip_address: Optional[str] = None
):
    event_id = str(uuid.uuid4())
    now_str = datetime.now(timezone.utc).isoformat()
    conn.execute("""
        INSERT INTO audit_events (
            id, business_id, user_id, action, entity_type, entity_id,
            before_state, after_state, ip_address, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        event_id, business_id, user_id, action, entity_type, entity_id,
        json.dumps(before_state) if before_state else None,
        json.dumps(after_state) if after_state else None,
        ip_address, now_str
    ))
