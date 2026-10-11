import pytest
from datetime import date
from app.calculation_engine import (
    format_inr,
    parse_inr_to_paise,
    get_period_boundaries,
    FinancialCalculationEngine,
)

def test_paise_rounding_and_formatting():
    # Test Indian currency formatting
    assert format_inr(12500000) == "₹1,25,000.00"
    assert format_inr(25000) == "₹250.00"
    assert format_inr(0) == "₹0.00"
    assert format_inr(-45000) == "-₹450.00"
    assert format_inr(1000000000) == "₹1,00,00,000.00" # 1 Crore

def test_parse_inr_to_paise():
    assert parse_inr_to_paise("1,25,000.00") == 12500000
    assert parse_inr_to_paise("₹250") == 25000
    assert parse_inr_to_paise("450.50") == 45050
    assert parse_inr_to_paise("-₹500.00") == -50000
    assert parse_inr_to_paise("0") == 0

def test_transfers_excluded_from_revenue_and_expense():
    transactions = [
        {"id": "1", "type": "income", "amount_paise": 100000, "status": "active", "category_name": "Sales"},
        {"id": "2", "type": "expense", "amount_paise": 40000, "status": "active", "category_name": "Packaging"},
        # Transfer of ₹50,000 between Bank and Cash
        {"id": "3", "type": "transfer", "amount_paise": 5000000, "status": "active"},
    ]
    
    metrics = FinancialCalculationEngine.calculate_metrics(transactions)
    # Revenue should ONLY be ₹1,000 (100,000 paise)
    assert metrics["revenue_paise"] == 100000
    # Expense should ONLY be ₹400 (40,000 paise)
    assert metrics["total_expense_paise"] == 40000
    # Net profit = 100000 - 40000 = 60000
    assert metrics["estimated_net_profit_paise"] == 60000
    # Net margin = 60.0%
    assert metrics["net_margin_pct"] == 60.0
    # Transfer volume tracked separately, NEVER included in revenue or expenses
    assert metrics["transfers_volume_paise"] == 5000000

def test_voided_transactions_excluded():
    transactions = [
        {"id": "1", "type": "income", "amount_paise": 50000, "status": "active", "category_name": "Sales"},
        {"id": "2", "type": "income", "amount_paise": 30000, "status": "voided", "category_name": "Sales"},
        {"id": "3", "type": "expense", "amount_paise": 20000, "status": "active", "category_name": "Rent"},
        {"id": "4", "type": "expense", "amount_paise": 15000, "status": "voided", "category_name": "Rent"},
    ]
    metrics = FinancialCalculationEngine.calculate_metrics(transactions)
    assert metrics["revenue_paise"] == 50000
    assert metrics["total_expense_paise"] == 20000
    assert metrics["estimated_net_profit_paise"] == 30000

def test_invoicing_receivables_and_collections_no_double_counting():
    invoices = [
        {"id": "inv1", "invoice_number": "INV-001", "total_amount_paise": 200000, "paid_amount_paise": 50000, "status": "partially_paid"},
        {"id": "inv2", "invoice_number": "INV-002", "total_amount_paise": 100000, "paid_amount_paise": 0, "status": "unpaid"},
        {"id": "inv3", "invoice_number": "INV-003", "total_amount_paise": 80000, "paid_amount_paise": 80000, "status": "paid"},
    ]
    # Transactions reflect the ₹500 already collected on inv1 and ₹800 on inv3
    transactions = [
        {"id": "t1", "type": "income", "amount_paise": 50000, "status": "active", "category_name": "Invoiced Services"},
        {"id": "t2", "type": "income", "amount_paise": 80000, "status": "active", "category_name": "Invoiced Services"},
    ]
    metrics = FinancialCalculationEngine.calculate_metrics(transactions, invoices=invoices)
    # Outstanding receivables = (200,000 - 50,000) + 100,000 = 250,000 paise (₹2,500.00)
    assert metrics["total_receivables_paise"] == 250000
    assert metrics["unpaid_invoices_count"] == 2
    # Revenue is recognized from transactions without multiplying unpaid invoices
    assert metrics["revenue_paise"] == 130000

def test_gross_profit_and_cogs_formula():
    transactions = [
        {"id": "1", "type": "income", "amount_paise": 200000, "status": "active", "category_name": "Cakes"},
        {"id": "2", "type": "expense", "amount_paise": 50000, "status": "active", "category_name": "Packaging", "is_stock": False},
    ]
    # Manual COGS = ₹600 (60,000 paise)
    metrics = FinancialCalculationEngine.calculate_metrics(transactions, manual_cogs_paise=60000)
    # Gross profit = 200000 - 60000 = 140000 paise
    assert metrics["gross_profit_paise"] == 140000
    # Gross margin = (140000 / 200000) * 100 = 70.0%
    assert metrics["gross_margin_pct"] == 70.0
    # Net profit = 200000 - 50000 = 150000 paise
    assert metrics["estimated_net_profit_paise"] == 150000

def test_period_boundaries_and_fy():
    # Indian Financial Year starts April 1 (month 4)
    ref_june = date(2026, 6, 15)
    start_dt, end_dt = get_period_boundaries("this_fy", reference_date=ref_june, fy_start_month=4)
    assert start_dt.year == 2026 and start_dt.month == 4 and start_dt.day == 1
    assert end_dt.year == 2027 and end_dt.month == 3 and end_dt.day == 31

    # Date in January (before April) belongs to previous calendar year's FY
    ref_jan = date(2027, 1, 10)
    start_dt_jan, end_dt_jan = get_period_boundaries("this_fy", reference_date=ref_jan, fy_start_month=4)
    assert start_dt_jan.year == 2026 and start_dt_jan.month == 4 and start_dt_jan.day == 1
    assert end_dt_jan.year == 2027 and end_dt_jan.month == 3 and end_dt_jan.day == 31

def test_duplicate_detection():
    existing_txs = [
        {"id": "tx1", "amount_paise": 150000, "occurred_at": "2026-10-10T10:00:00Z", "description": "Wheat Flour purchase", "status": "active"},
        {"id": "tx2", "amount_paise": 20000, "occurred_at": "2026-10-09T14:00:00Z", "description": "Auto fare", "status": "active"},
    ]
    new_candidate = {
        "id": "tx_new",
        "amount_paise": 150000,
        "occurred_at": "2026-10-11T09:30:00Z", # within 2 days
        "description": "Wheat flour purchase",
    }
    dups = FinancialCalculationEngine.detect_duplicates(new_candidate, existing_txs, days_window=2)
    assert len(dups) == 1
    assert dups[0]["id"] == "tx1"

def test_unusual_expense_outlier():
    expenses = [
        {"id": "e1", "type": "expense", "amount_paise": 20000, "status": "active"},
        {"id": "e2", "type": "expense", "amount_paise": 25000, "status": "active"},
        {"id": "e3", "type": "expense", "amount_paise": 30000, "status": "active"},
        {"id": "e4", "type": "expense", "amount_paise": 22000, "status": "active"},
        # Outlier of ₹6,000 (600,000 paise)
        {"id": "e5", "type": "expense", "amount_paise": 600000, "status": "active"},
    ]
    outliers = FinancialCalculationEngine.detect_unusual_expenses(expenses, threshold_paise=500000)
    assert len(outliers) == 1
    assert outliers[0]["transaction"]["id"] == "e5"
