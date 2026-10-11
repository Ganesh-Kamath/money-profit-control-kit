-- =============================================================================
-- Money & Profit Control Kit — Row Level Security (RLS) & Role-Based Access
-- Migration: 20261011000002_rls_policies.sql
-- Strictly enforces tenant isolation and role permissions (owner, bookkeeper, viewer).
-- =============================================================================

-- Enable RLS on ALL tables
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE mapping_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE reconciliations ENABLE ROW LEVEL SECURITY;
ALTER TABLE period_locks ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE connection_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;

-- Helper function to check user role within a business
CREATE OR REPLACE FUNCTION get_user_business_role(bid UUID)
RETURNS TEXT AS $$
    SELECT role FROM business_memberships
    WHERE business_id = bid AND user_id = auth.uid()
    LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Helper function to verify if user has active membership in business
CREATE OR REPLACE FUNCTION has_business_access(bid UUID)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM business_memberships
        WHERE business_id = bid AND user_id = auth.uid()
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Helper function to verify if user has write access (owner or bookkeeper)
CREATE OR REPLACE FUNCTION has_business_write_access(bid UUID)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM business_memberships
        WHERE business_id = bid 
          AND user_id = auth.uid() 
          AND role IN ('owner', 'bookkeeper')
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Helper function to verify if user is owner
CREATE OR REPLACE FUNCTION is_business_owner(bid UUID)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM business_memberships
        WHERE business_id = bid 
          AND user_id = auth.uid() 
          AND role = 'owner'
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- =============================================================================
-- Businesses Table Policies
-- =============================================================================
CREATE POLICY businesses_select_policy ON businesses
    FOR SELECT USING (has_business_access(id));

CREATE POLICY businesses_update_policy ON businesses
    FOR UPDATE USING (is_business_owner(id));

-- =============================================================================
-- Business Memberships Policies
-- =============================================================================
CREATE POLICY memberships_select_policy ON business_memberships
    FOR SELECT USING (has_business_access(business_id));

CREATE POLICY memberships_modify_policy ON business_memberships
    FOR ALL USING (is_business_owner(business_id));

-- =============================================================================
-- Financial & Operational Tables Policies (Read by members, Write by owner/bookkeeper)
-- =============================================================================

-- Accounts
CREATE POLICY accounts_select_policy ON accounts
    FOR SELECT USING (has_business_access(business_id));
CREATE POLICY accounts_insert_policy ON accounts
    FOR INSERT WITH CHECK (has_business_write_access(business_id));
CREATE POLICY accounts_update_policy ON accounts
    FOR UPDATE USING (has_business_write_access(business_id));

-- Categories
CREATE POLICY categories_select_policy ON categories
    FOR SELECT USING (has_business_access(business_id));
CREATE POLICY categories_insert_policy ON categories
    FOR INSERT WITH CHECK (has_business_write_access(business_id));
CREATE POLICY categories_update_policy ON categories
    FOR UPDATE USING (has_business_write_access(business_id));

-- Contacts
CREATE POLICY contacts_select_policy ON contacts
    FOR SELECT USING (has_business_access(business_id));
CREATE POLICY contacts_insert_policy ON contacts
    FOR INSERT WITH CHECK (has_business_write_access(business_id));
CREATE POLICY contacts_update_policy ON contacts
    FOR UPDATE USING (has_business_write_access(business_id));

-- Transactions
CREATE POLICY transactions_select_policy ON transactions
    FOR SELECT USING (has_business_access(business_id));
CREATE POLICY transactions_insert_policy ON transactions
    FOR INSERT WITH CHECK (has_business_write_access(business_id));
CREATE POLICY transactions_update_policy ON transactions
    FOR UPDATE USING (has_business_write_access(business_id));

-- Transaction Splits
CREATE POLICY splits_select_policy ON transaction_splits
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM transactions t
            WHERE t.id = transaction_splits.transaction_id
              AND has_business_access(t.business_id)
        )
    );
CREATE POLICY splits_write_policy ON transaction_splits
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM transactions t
            WHERE t.id = transaction_splits.transaction_id
              AND has_business_write_access(t.business_id)
        )
    );

-- Receipts
CREATE POLICY receipts_select_policy ON receipts
    FOR SELECT USING (has_business_access(business_id));
CREATE POLICY receipts_insert_policy ON receipts
    FOR INSERT WITH CHECK (has_business_write_access(business_id));
CREATE POLICY receipts_update_policy ON receipts
    FOR UPDATE USING (has_business_write_access(business_id));

-- Invoices & Collections
CREATE POLICY invoices_select_policy ON invoices
    FOR SELECT USING (has_business_access(business_id));
CREATE POLICY invoices_write_policy ON invoices
    FOR ALL USING (has_business_write_access(business_id));

CREATE POLICY collections_select_policy ON invoice_collections
    FOR SELECT USING (has_business_access(business_id));
CREATE POLICY collections_write_policy ON invoice_collections
    FOR ALL USING (has_business_write_access(business_id));

-- Reconciliations
CREATE POLICY reconciliations_select_policy ON reconciliations
    FOR SELECT USING (has_business_access(business_id));
CREATE POLICY reconciliations_write_policy ON reconciliations
    FOR ALL USING (has_business_write_access(business_id));

-- Period Locks
CREATE POLICY period_locks_select_policy ON period_locks
    FOR SELECT USING (has_business_access(business_id));
CREATE POLICY period_locks_write_policy ON period_locks
    FOR ALL USING (is_business_owner(business_id)); -- only owner locks periods

-- Audit Events
CREATE POLICY audit_events_select_policy ON audit_events
    FOR SELECT USING (has_business_access(business_id));
CREATE POLICY audit_events_insert_policy ON audit_events
    FOR INSERT WITH CHECK (has_business_write_access(business_id));

-- Alerts & Preferences
CREATE POLICY alerts_select_policy ON alerts
    FOR SELECT USING (has_business_access(business_id));
CREATE POLICY alerts_modify_policy ON alerts
    FOR ALL USING (has_business_write_access(business_id));

CREATE POLICY alert_preferences_policy ON alert_preferences
    FOR ALL USING (user_id = auth.uid() AND has_business_access(business_id));

-- Reports & Schedules
CREATE POLICY reports_select_policy ON report_runs
    FOR SELECT USING (has_business_access(business_id));
CREATE POLICY reports_insert_policy ON report_runs
    FOR INSERT WITH CHECK (has_business_write_access(business_id));

CREATE POLICY schedules_policy ON report_schedules
    FOR ALL USING (is_business_owner(business_id));

-- Licenses & Payments (Only Owner can view/manage)
CREATE POLICY licenses_select_policy ON licenses
    FOR SELECT USING (has_business_access(business_id));
CREATE POLICY licenses_write_policy ON licenses
    FOR ALL USING (is_business_owner(business_id));

CREATE POLICY payments_select_policy ON payments
    FOR SELECT USING (is_business_owner(business_id));

-- Connections & Feature Flags
CREATE POLICY connections_select_policy ON connection_status
    FOR SELECT USING (has_business_access(business_id));
CREATE POLICY connections_write_policy ON connection_status
    FOR ALL USING (is_business_owner(business_id));

CREATE POLICY feature_flags_select_policy ON feature_flags
    FOR SELECT USING (has_business_access(business_id));
CREATE POLICY feature_flags_write_policy ON feature_flags
    FOR ALL USING (is_business_owner(business_id));

-- =============================================================================
-- Storage Bucket Policies for Private Receipts
-- =============================================================================
-- Storage bucket 'receipts' is private. Files stored under `{business_id}/{receipt_id}.{ext}`
INSERT INTO storage.buckets (id, name, public) 
VALUES ('receipts', 'receipts', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY receipts_storage_select ON storage.objects
    FOR SELECT USING (
        bucket_id = 'receipts'
        AND has_business_access((storage.foldername(name))[1]::uuid)
    );

CREATE POLICY receipts_storage_insert ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'receipts'
        AND has_business_write_access((storage.foldername(name))[1]::uuid)
    );
