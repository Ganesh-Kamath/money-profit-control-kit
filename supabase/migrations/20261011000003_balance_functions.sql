-- =============================================================================
-- Money & Profit Control Kit — Atomic Balance Calculations & Financial Triggers
-- Migration: 20261011000003_balance_functions.sql
-- All balance mutations are atomic. A partial save never leaves a wrong balance.
-- =============================================================================

-- 1. Function to recalculate account current balance from canonical ledger
CREATE OR REPLACE FUNCTION recalculate_account_balance(p_account_id UUID)
RETURNS BIGINT AS $$
DECLARE
    v_opening_balance BIGINT := 0;
    v_inflows BIGINT := 0;
    v_outflows BIGINT := 0;
    v_net_transfers BIGINT := 0;
    v_adjustments BIGINT := 0;
    v_new_balance BIGINT := 0;
BEGIN
    -- Fetch account opening balance
    SELECT opening_balance_paise INTO v_opening_balance
    FROM accounts WHERE id = p_account_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Account % not found', p_account_id;
    END IF;

    -- Inflows: Active Income to this account
    SELECT COALESCE(SUM(amount_paise), 0) INTO v_inflows
    FROM transactions
    WHERE account_id = p_account_id
      AND type = 'income'
      AND status = 'active';

    -- Outflows: Active Expense from this account
    SELECT COALESCE(SUM(amount_paise), 0) INTO v_outflows
    FROM transactions
    WHERE account_id = p_account_id
      AND type = 'expense'
      AND status = 'active';

    -- Transfers In (destination = this account)
    SELECT COALESCE(SUM(amount_paise), 0) INTO v_net_transfers
    FROM transactions
    WHERE to_account_id = p_account_id
      AND type = 'transfer'
      AND status = 'active';

    -- Transfers Out (source = this account)
    DECLARE
        v_transfers_out BIGINT := 0;
    BEGIN
        SELECT COALESCE(SUM(amount_paise), 0) INTO v_transfers_out
        FROM transactions
        WHERE account_id = p_account_id
          AND type = 'transfer'
          AND status = 'active';
        v_net_transfers := v_net_transfers - v_transfers_out;
    END;

    -- Adjustments (can be positive or negative; here adjustments with account_id)
    -- In this schema, positive adjustments can be recorded with income or adjustment type
    SELECT COALESCE(SUM(amount_paise), 0) INTO v_adjustments
    FROM transactions
    WHERE account_id = p_account_id
      AND type = 'adjustment'
      AND status = 'active';

    -- Authoritative Closing Balance formula:
    -- Closing = Opening + Inflows - Outflows + Net Transfers + Adjustments
    v_new_balance := v_opening_balance + v_inflows - v_outflows + v_net_transfers + v_adjustments;

    UPDATE accounts
    SET current_balance_paise = v_new_balance,
        updated_at = NOW()
    WHERE id = p_account_id;

    RETURN v_new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Trigger on transactions to maintain account balances automatically & atomically
CREATE OR REPLACE FUNCTION trg_sync_transaction_balances()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        PERFORM recalculate_account_balance(NEW.account_id);
        IF NEW.type = 'transfer' AND NEW.to_account_id IS NOT NULL THEN
            PERFORM recalculate_account_balance(NEW.to_account_id);
        END IF;
        RETURN NEW;
    ELSIF (TG_OP = 'UPDATE') THEN
        PERFORM recalculate_account_balance(NEW.account_id);
        IF NEW.account_id <> OLD.account_id THEN
            PERFORM recalculate_account_balance(OLD.account_id);
        END IF;
        IF NEW.to_account_id IS NOT NULL THEN
            PERFORM recalculate_account_balance(NEW.to_account_id);
        END IF;
        IF OLD.to_account_id IS NOT NULL AND OLD.to_account_id <> COALESCE(NEW.to_account_id, '00000000-0000-0000-0000-000000000000'::uuid) THEN
            PERFORM recalculate_account_balance(OLD.to_account_id);
        END IF;
        RETURN NEW;
    ELSIF (TG_OP = 'DELETE') THEN
        PERFORM recalculate_account_balance(OLD.account_id);
        IF OLD.type = 'transfer' AND OLD.to_account_id IS NOT NULL THEN
            PERFORM recalculate_account_balance(OLD.to_account_id);
        END IF;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_transactions_balance_sync ON transactions;
CREATE TRIGGER trg_transactions_balance_sync
AFTER INSERT OR UPDATE OR DELETE ON transactions
FOR EACH ROW EXECUTE FUNCTION trg_sync_transaction_balances();

-- 3. Period Lock Enforcement Trigger
CREATE OR REPLACE FUNCTION trg_check_period_lock()
RETURNS TRIGGER AS $$
DECLARE
    v_lock_exists BOOLEAN;
    v_tx_date DATE;
BEGIN
    v_tx_date := (NEW.occurred_at AT TIME ZONE 'Asia/Kolkata')::DATE;
    
    SELECT EXISTS (
        SELECT 1 FROM period_locks
        WHERE business_id = NEW.business_id
          AND period_end_date >= v_tx_date
    ) INTO v_lock_exists;

    IF v_lock_exists THEN
        RAISE EXCEPTION 'Cannot modify financial records on or before locked date %', v_tx_date;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_transactions_period_lock ON transactions;
CREATE TRIGGER trg_transactions_period_lock
BEFORE INSERT OR UPDATE ON transactions
FOR EACH ROW
WHEN (NEW.status = 'active')
EXECUTE FUNCTION trg_check_period_lock();

-- 4. RPC Function for Safe Transaction Voiding
CREATE OR REPLACE FUNCTION void_transaction(
    p_transaction_id UUID,
    p_void_reason TEXT,
    p_user_id UUID
)
RETURNS VOID AS $$
DECLARE
    v_tx transactions%ROWTYPE;
BEGIN
    SELECT * INTO v_tx FROM transactions WHERE id = p_transaction_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Transaction % not found', p_transaction_id;
    END IF;

    IF v_tx.status = 'voided' THEN
        RAISE EXCEPTION 'Transaction is already voided';
    END IF;

    -- Update transaction status to voided
    UPDATE transactions
    SET status = 'voided',
        void_reason = p_void_reason,
        voided_at = NOW(),
        voided_by = p_user_id,
        updated_at = NOW()
    WHERE id = p_transaction_id;

    -- Insert audit event
    INSERT INTO audit_events (
        business_id,
        user_id,
        action,
        entity_type,
        entity_id,
        before_state,
        after_state
    ) VALUES (
        v_tx.business_id,
        p_user_id,
        'void',
        'transaction',
        p_transaction_id,
        to_jsonb(v_tx),
        jsonb_build_object('status', 'voided', 'void_reason', p_void_reason, 'voided_at', NOW())
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
