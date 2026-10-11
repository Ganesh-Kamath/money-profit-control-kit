import uuid
import json
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Depends, Query, status
from ..database import get_connection, recalculate_account_balance, record_audit_event
from ..security import get_current_user_and_business, require_role
from ..models import (
    TransactionCreate,
    TransactionUpdate,
    TransactionVoid,
    BulkCategorizeRequest
)
from ..calculation_engine import FinancialCalculationEngine

router = APIRouter(prefix="/transactions", tags=["Transactions"])

@router.get("")
def list_transactions(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    type: Optional[str] = None,
    category_id: Optional[str] = None,
    account_id: Optional[str] = None,
    search: Optional[str] = None,
    status_filter: str = "active", # active, voided, all
    limit: int = 100,
    offset: int = 0,
    auth_ctx: dict = Depends(get_current_user_and_business)
):
    conn = get_connection()
    try:
        business_id = auth_ctx["business_id"]
        query = """
            SELECT t.*, 
                   c.name as category_name, c.is_stock, c.is_equipment, c.color as category_color,
                   a.name as account_name,
                   toa.name as to_account_name,
                   ct.name as contact_name,
                   r.id as receipt_id, r.file_name as receipt_file_name, r.status as receipt_status
            FROM transactions t
            LEFT JOIN categories c ON c.id = t.category_id
            LEFT JOIN accounts a ON a.id = t.account_id
            LEFT JOIN accounts toa ON toa.id = t.to_account_id
            LEFT JOIN contacts ct ON ct.id = t.contact_id
            LEFT JOIN receipts r ON r.transaction_id = t.id
            WHERE t.business_id = ?
        """
        params: List[Any] = [business_id]

        if status_filter != "all":
            query += " AND t.status = ?"
            params.append(status_filter)

        if start_date:
            query += " AND t.occurred_at >= ?"
            params.append(start_date)
        if end_date:
            query += " AND t.occurred_at <= ?"
            params.append(end_date)
        if type:
            query += " AND t.type = ?"
            params.append(type)
        if category_id:
            query += " AND t.category_id = ?"
            params.append(category_id)
        if account_id:
            query += " AND (t.account_id = ? OR t.to_account_id = ?)"
            params.extend([account_id, account_id])
        if search:
            query += " AND (t.description LIKE ? OR t.reference_number LIKE ?)"
            params.extend([f"%{search}%", f"%{search}%"])

        query += " ORDER BY t.occurred_at DESC LIMIT ? OFFSET ?"
        params.extend([limit, offset])

        rows = conn.execute(query, params).fetchall()
        
        # Total count
        count_query = "SELECT COUNT(*) as total FROM transactions t WHERE t.business_id = ?"
        total_count = conn.execute(count_query, (business_id,)).fetchone()["total"]

        return {
            "total": total_count,
            "items": [dict(r) for r in rows]
        }
    finally:
        conn.close()

@router.post("", status_code=status.HTTP_201_CREATED)
def create_transaction(
    req: TransactionCreate,
    auth_ctx: dict = Depends(require_role(["owner", "bookkeeper"]))
):
    conn = get_connection()
    try:
        business_id = auth_ctx["business_id"]
        user_id = auth_ctx["user_id"]

        # 1. Idempotency Check
        if req.idempotency_key:
            existing = conn.execute("""
                SELECT id FROM transactions WHERE business_id = ? AND idempotency_key = ?
            """, (business_id, req.idempotency_key)).fetchone()
            if existing:
                tx_row = conn.execute("SELECT * FROM transactions WHERE id = ?", (existing["id"],)).fetchone()
                return {"transaction": dict(tx_row), "idempotent_replay": True}

        # 2. Period Lock Check
        tx_date = req.occurred_at[:10]
        lock_row = conn.execute("""
            SELECT period_end_date FROM period_locks 
            WHERE business_id = ? AND period_end_date >= ?
        """, (business_id, tx_date)).fetchone()
        if lock_row:
            raise HTTPException(
                status_code=400,
                detail=f"Financial period ending {lock_row['period_end_date']} is locked. Changes must be recorded as an adjustment."
            )

        # 3. Duplicate Warning Check (against recent transactions)
        recent_txs = conn.execute("""
            SELECT id, amount_paise, occurred_at, description, status
            FROM transactions 
            WHERE business_id = ? AND status = 'active'
            ORDER BY occurred_at DESC LIMIT 200
        """, (business_id,)).fetchall()
        duplicates = FinancialCalculationEngine.detect_duplicates(
            {"id": None, "amount_paise": req.amount_paise, "occurred_at": req.occurred_at, "description": req.description},
            [dict(r) for r in recent_txs]
        )

        now_str = datetime.now(timezone.utc).isoformat()
        tx_id = str(uuid.uuid4())

        with conn:
            conn.execute("""
                INSERT INTO transactions (
                    id, business_id, type, amount_paise, occurred_at, account_id, to_account_id,
                    category_id, contact_id, description, reference_number, notes,
                    status, idempotency_key, source, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?)
            """, (
                tx_id, business_id, req.type, req.amount_paise, req.occurred_at,
                req.account_id, req.to_account_id, req.category_id, req.contact_id,
                req.description, req.reference_number, req.notes,
                req.idempotency_key, req.source, now_str, now_str
            ))

            # Atomic balance updates
            recalculate_account_balance(conn, req.account_id)
            if req.type == "transfer" and req.to_account_id:
                recalculate_account_balance(conn, req.to_account_id)

            # Link receipt if provided
            if req.receipt_id:
                conn.execute("""
                    UPDATE receipts 
                    SET transaction_id = ?, status = 'reviewed' 
                    WHERE id = ? AND business_id = ?
                """, (tx_id, req.receipt_id, business_id))

            # Record audit event
            record_audit_event(
                conn, business_id, "create", "transaction", tx_id, user_id=user_id,
                after_state=req.dict()
            )

        new_row = conn.execute("SELECT * FROM transactions WHERE id = ?", (tx_id,)).fetchone()
        return {
            "transaction": dict(new_row),
            "duplicate_warning": bool(duplicates),
            "matched_duplicates": duplicates
        }
    finally:
        conn.close()

@router.put("/{tx_id}")
def update_transaction(
    tx_id: str,
    req: TransactionUpdate,
    auth_ctx: dict = Depends(require_role(["owner", "bookkeeper"]))
):
    conn = get_connection()
    try:
        business_id = auth_ctx["business_id"]
        user_id = auth_ctx["user_id"]
        tx = conn.execute("SELECT * FROM transactions WHERE id = ? AND business_id = ?", (tx_id, business_id)).fetchone()
        if not tx:
            raise HTTPException(status_code=404, detail="Transaction not found")
        if tx["status"] == "voided":
            raise HTTPException(status_code=400, detail="Cannot edit a voided transaction")

        before_state = dict(tx)
        now_str = datetime.now(timezone.utc).isoformat()
        
        desc = req.description if req.description is not None else tx["description"]
        cat_id = req.category_id if req.category_id is not None else tx["category_id"]
        occ_at = req.occurred_at if req.occurred_at is not None else tx["occurred_at"]
        ref_no = req.reference_number if req.reference_number is not None else tx["reference_number"]
        notes = req.notes if req.notes is not None else tx["notes"]

        with conn:
            conn.execute("""
                UPDATE transactions
                SET description = ?, category_id = ?, occurred_at = ?, reference_number = ?, notes = ?, updated_at = ?
                WHERE id = ?
            """, (desc, cat_id, occ_at, ref_no, notes, now_str, tx_id))

            record_audit_event(
                conn, business_id, "update", "transaction", tx_id, user_id=user_id,
                before_state=before_state,
                after_state={"description": desc, "category_id": cat_id, "occurred_at": occ_at, "reference_number": ref_no}
            )

        updated_tx = conn.execute("SELECT * FROM transactions WHERE id = ?", (tx_id,)).fetchone()
        return {"transaction": dict(updated_tx)}
    finally:
        conn.close()

@router.post("/{tx_id}/void")
def void_transaction(
    tx_id: str,
    req: TransactionVoid,
    auth_ctx: dict = Depends(require_role(["owner", "bookkeeper"]))
):
    conn = get_connection()
    try:
        business_id = auth_ctx["business_id"]
        user_id = auth_ctx["user_id"]

        tx = conn.execute("SELECT * FROM transactions WHERE id = ? AND business_id = ?", (tx_id, business_id)).fetchone()
        if not tx:
            raise HTTPException(status_code=404, detail="Transaction not found")
        if tx["status"] == "voided":
            raise HTTPException(status_code=400, detail="Transaction is already voided")

        now_str = datetime.now(timezone.utc).isoformat()
        before_state = dict(tx)

        with conn:
            conn.execute("""
                UPDATE transactions
                SET status = 'voided', void_reason = ?, voided_at = ?, voided_by = ?, updated_at = ?
                WHERE id = ?
            """, (req.void_reason, now_str, user_id, now_str, tx_id))

            # Recalculate affected balances
            recalculate_account_balance(conn, tx["account_id"])
            if tx["type"] == "transfer" and tx["to_account_id"]:
                recalculate_account_balance(conn, tx["to_account_id"])

            record_audit_event(
                conn, business_id, "void", "transaction", tx_id, user_id=user_id,
                before_state=before_state,
                after_state={"status": "voided", "void_reason": req.void_reason, "voided_at": now_str}
            )

        updated_tx = conn.execute("SELECT * FROM transactions WHERE id = ?", (tx_id,)).fetchone()
        return {"status": "success", "transaction": dict(updated_tx)}
    finally:
        conn.close()

@router.post("/bulk-categorize")
def bulk_categorize(
    req: BulkCategorizeRequest,
    auth_ctx: dict = Depends(require_role(["owner", "bookkeeper"]))
):
    conn = get_connection()
    try:
        business_id = auth_ctx["business_id"]
        now_str = datetime.now(timezone.utc).isoformat()
        with conn:
            for tid in req.transaction_ids:
                conn.execute("""
                    UPDATE transactions
                    SET category_id = ?, updated_at = ?
                    WHERE id = ? AND business_id = ? AND status = 'active'
                """, (req.category_id, now_str, tid, business_id))
        return {"status": "success", "updated_count": len(req.transaction_ids)}
    finally:
        conn.close()

@router.post("/sync-offline")
def sync_offline(
    payload: List[TransactionCreate],
    auth_ctx: dict = Depends(require_role(["owner", "bookkeeper"]))
):
    """
    Idempotent sync for offline transaction queue.
    """
    conn = get_connection()
    try:
        business_id = auth_ctx["business_id"]
        user_id = auth_ctx["user_id"]
        synced_count = 0
        skipped_count = 0

        with conn:
            for item in payload:
                # Check idempotency key
                if item.idempotency_key:
                    existing = conn.execute("""
                        SELECT id FROM transactions WHERE business_id = ? AND idempotency_key = ?
                    """, (business_id, item.idempotency_key)).fetchone()
                    if existing:
                        skipped_count += 1
                        continue

                now_str = datetime.now(timezone.utc).isoformat()
                tx_id = str(uuid.uuid4())
                conn.execute("""
                    INSERT INTO transactions (
                        id, business_id, type, amount_paise, occurred_at, account_id, to_account_id,
                        category_id, contact_id, description, reference_number, notes,
                        status, idempotency_key, source, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, 'offline_sync', ?, ?)
                """, (
                    tx_id, business_id, item.type, item.amount_paise, item.occurred_at,
                    item.account_id, item.to_account_id, item.category_id, item.contact_id,
                    item.description, item.reference_number, item.notes,
                    item.idempotency_key, now_str, now_str
                ))

                recalculate_account_balance(conn, item.account_id)
                if item.type == "transfer" and item.to_account_id:
                    recalculate_account_balance(conn, item.to_account_id)

                synced_count += 1

        return {
            "status": "success",
            "synced_count": synced_count,
            "skipped_count": skipped_count
        }
    finally:
        conn.close()
