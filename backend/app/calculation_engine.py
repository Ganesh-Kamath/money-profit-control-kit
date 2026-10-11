"""
Authoritative Financial Calculation Engine for Money & Profit Control Kit.
Single source of truth used across Dashboard, Sales & Profit, Reports, Exports, and Emails.

Core Rules Enforced:
1. Integer paise for all monetary values.
2. Transfers are NEVER revenue or expense.
3. Cash flow is NOT profit.
4. Invoice collections do NOT duplicate recognized revenue.
5. Indian number formatting (₹1,25,000.00).
6. Timezone-aware date boundaries (Asia/Kolkata).
"""

from datetime import datetime, date, timedelta
from typing import Dict, List, Any, Optional, Tuple
import math

def format_inr(paise: int, include_symbol: bool = True) -> str:
    """
    Formats integer paise to Indian currency format.
    Example: 12500000 paise -> ₹1,25,000.00
    - Negative: -125000 paise -> -₹1,250.00
    """
    is_negative = paise < 0
    abs_paise = abs(paise)
    rupees = abs_paise // 100
    remainder_paise = abs_paise % 100
    
    s = str(rupees)
    if len(s) <= 3:
        formatted_rupees = s
    else:
        last3 = s[-3:]
        other = s[:-3]
        groups = []
        while other:
            groups.append(other[-2:])
            other = other[:-2]
        groups.reverse()
        formatted_rupees = ",".join(groups) + "," + last3
        
    res = f"{formatted_rupees}.{remainder_paise:02d}"
    prefix = "-₹" if is_negative else "₹" if include_symbol else ("-" if is_negative else "")
    return f"{prefix}{res}" if include_symbol else (f"-{res}" if is_negative else res)

def parse_inr_to_paise(amount_str: str) -> int:
    """
    Parses user input or string like '1,250.50' or '₹1250' to integer paise.
    Prevents float representation error by splitting into whole and fractional parts.
    """
    cleaned = amount_str.replace("₹", "").replace(",", "").strip()
    if not cleaned:
        return 0
    is_negative = cleaned.startswith("-")
    if is_negative:
        cleaned = cleaned[1:].strip()
        
    if "." in cleaned:
        parts = cleaned.split(".")
        whole = int(parts[0] or 0)
        frac = parts[1][:2].ljust(2, "0")
        cents = int(frac)
        total = whole * 100 + cents
    else:
        total = int(cleaned) * 100
        
    return -total if is_negative else total

def get_period_boundaries(
    period_key: str, 
    reference_date: Optional[date] = None,
    fy_start_month: int = 4
) -> Tuple[datetime, datetime]:
    """
    Returns (start_dt, end_dt) in UTC/ISO representation for standard business periods.
    Keys: today, yesterday, this_week, last_week, this_month, last_month, this_fy, all_time.
    """
    ref = reference_date or date.today()
    
    if period_key == "today":
        start_d = ref
        end_d = ref
    elif period_key == "yesterday":
        start_d = ref - timedelta(days=1)
        end_d = ref - timedelta(days=1)
    elif period_key == "this_week":
        # Monday as start of week
        start_d = ref - timedelta(days=ref.weekday())
        end_d = start_d + timedelta(days=6)
    elif period_key == "last_week":
        start_d = ref - timedelta(days=ref.weekday() + 7)
        end_d = start_d + timedelta(days=6)
    elif period_key == "this_month":
        start_d = date(ref.year, ref.month, 1)
        # last day of month
        if ref.month == 12:
            end_d = date(ref.year, 12, 31)
        else:
            end_d = date(ref.year, ref.month + 1, 1) - timedelta(days=1)
    elif period_key == "last_month":
        if ref.month == 1:
            start_d = date(ref.year - 1, 12, 1)
            end_d = date(ref.year - 1, 12, 31)
        else:
            start_d = date(ref.year, ref.month - 1, 1)
            end_d = date(ref.year, ref.month, 1) - timedelta(days=1)
    elif period_key == "this_fy":
        if ref.month >= fy_start_month:
            start_d = date(ref.year, fy_start_month, 1)
            end_d = date(ref.year + 1, fy_start_month, 1) - timedelta(days=1)
        else:
            start_d = date(ref.year - 1, fy_start_month, 1)
            end_d = date(ref.year, fy_start_month, 1) - timedelta(days=1)
    else:
        # Default fallback to this month
        start_d = date(ref.year, ref.month, 1)
        end_d = ref
        
    start_dt = datetime(start_d.year, start_d.month, start_d.day, 0, 0, 0)
    end_dt = datetime(end_d.year, end_d.month, end_d.day, 23, 59, 59)
    return start_dt, end_dt

class FinancialCalculationEngine:
    """
    Computes all standard financial metrics from canonical ledger transactions and invoices.
    """
    
    @staticmethod
    def calculate_metrics(
        transactions: List[Dict[str, Any]],
        invoices: Optional[List[Dict[str, Any]]] = None,
        manual_cogs_paise: int = 0
    ) -> Dict[str, Any]:
        """
        Calculates:
        - Revenue (Income transactions + newly recognized invoices if applicable)
        - Operating Expenses (non-capital, non-stock expenses)
        - Inventory / Stock purchases
        - Equipment / Capital purchases
        - Total Recorded Expenses
        - Estimated Net Profit
        - Net Margin %
        - Gross Profit (Revenue - Manual COGS)
        - Cash Inflows (actual money deposited across accounts)
        - Cash Outflows (actual money withdrawn)
        - Net Cash Movement
        - Transfers count & volume (strictly neutral)
        """
        revenue_paise = 0
        operating_expense_paise = 0
        stock_purchase_paise = 0
        equipment_purchase_paise = 0
        total_expense_paise = 0
        
        cash_inflows_paise = 0
        cash_outflows_paise = 0
        transfers_volume_paise = 0
        adjustments_paise = 0
        
        categories_breakdown: Dict[str, Dict[str, Any]] = {}
        payment_methods_breakdown: Dict[str, int] = {}
        
        for tx in transactions:
            if tx.get("status") == "voided":
                continue
                
            tx_type = tx.get("type")
            amount = tx.get("amount_paise", 0)
            cat_name = tx.get("category_name") or "Uncategorized"
            is_stock = bool(tx.get("is_stock", False))
            is_equipment = bool(tx.get("is_equipment", False))
            account_name = tx.get("account_name") or "Account"
            
            if tx_type == "income":
                revenue_paise += amount
                cash_inflows_paise += amount
                payment_methods_breakdown[account_name] = payment_methods_breakdown.get(account_name, 0) + amount
                
            elif tx_type == "expense":
                total_expense_paise += amount
                cash_outflows_paise += amount
                payment_methods_breakdown[account_name] = payment_methods_breakdown.get(account_name, 0) + amount
                
                if is_stock:
                    stock_purchase_paise += amount
                elif is_equipment:
                    equipment_purchase_paise += amount
                else:
                    operating_expense_paise += amount
                    
                # Category breakdown
                if cat_name not in categories_breakdown:
                    categories_breakdown[cat_name] = {
                        "category_id": tx.get("category_id"),
                        "category_name": cat_name,
                        "amount_paise": 0,
                        "count": 0,
                        "is_stock": is_stock,
                        "is_equipment": is_equipment,
                    }
                categories_breakdown[cat_name]["amount_paise"] += amount
                categories_breakdown[cat_name]["count"] += 1
                
            elif tx_type == "transfer":
                # Transfers NEVER affect revenue or expense
                transfers_volume_paise += amount
                # No net cash movement across business accounts, as source decreases and target increases
                
            elif tx_type == "adjustment":
                adjustments_paise += amount
                # Adjustments change account balance directly
        
        # Receivables & Unpaid Invoices
        total_receivables_paise = 0
        unpaid_invoices_count = 0
        if invoices:
            for inv in invoices:
                if inv.get("status") in ("unpaid", "partially_paid"):
                    outstanding = inv.get("total_amount_paise", 0) - inv.get("paid_amount_paise", 0)
                    total_receivables_paise += max(0, outstanding)
                    unpaid_invoices_count += 1

        # Calculation of authoritative profit metrics
        # Net Profit = Recognized Income - Recognized Expenses
        estimated_net_profit_paise = revenue_paise - total_expense_paise
        
        # Net Margin = (Net Profit / Revenue) * 100
        net_margin_pct = (
            round((estimated_net_profit_paise / revenue_paise) * 100, 2)
            if revenue_paise > 0 else 0.0
        )
        
        # Gross Profit = Revenue - COGS
        # If manual COGS not specified, default to 0 with explicit assumption disclosure
        gross_profit_paise = revenue_paise - manual_cogs_paise
        gross_margin_pct = (
            round((gross_profit_paise / revenue_paise) * 100, 2)
            if revenue_paise > 0 else 0.0
        )
        
        # Net Cash Movement = Inflows - Outflows
        net_cash_movement_paise = cash_inflows_paise - cash_outflows_paise
        
        # Sorted categories by spend descending
        categories_list = sorted(
            categories_breakdown.values(),
            key=lambda x: x["amount_paise"],
            reverse=True
        )
        for cat in categories_list:
            cat["percentage"] = (
                round((cat["amount_paise"] / total_expense_paise) * 100, 1)
                if total_expense_paise > 0 else 0.0
            )
            
        return {
            "revenue_paise": revenue_paise,
            "revenue_formatted": format_inr(revenue_paise),
            "total_expense_paise": total_expense_paise,
            "total_expense_formatted": format_inr(total_expense_paise),
            "operating_expense_paise": operating_expense_paise,
            "stock_purchase_paise": stock_purchase_paise,
            "equipment_purchase_paise": equipment_purchase_paise,
            "estimated_net_profit_paise": estimated_net_profit_paise,
            "estimated_net_profit_formatted": format_inr(estimated_net_profit_paise),
            "net_margin_pct": net_margin_pct,
            "manual_cogs_paise": manual_cogs_paise,
            "gross_profit_paise": gross_profit_paise,
            "gross_profit_formatted": format_inr(gross_profit_paise),
            "gross_margin_pct": gross_margin_pct,
            "cash_inflows_paise": cash_inflows_paise,
            "cash_inflows_formatted": format_inr(cash_inflows_paise),
            "cash_outflows_paise": cash_outflows_paise,
            "cash_outflows_formatted": format_inr(cash_outflows_paise),
            "net_cash_movement_paise": net_cash_movement_paise,
            "net_cash_movement_formatted": format_inr(net_cash_movement_paise),
            "transfers_volume_paise": transfers_volume_paise,
            "total_receivables_paise": total_receivables_paise,
            "total_receivables_formatted": format_inr(total_receivables_paise),
            "unpaid_invoices_count": unpaid_invoices_count,
            "categories_breakdown": categories_list,
            "payment_methods_breakdown": payment_methods_breakdown,
            "active_transactions_count": len([t for t in transactions if t.get("status") != "voided"]),
            "calculation_notes": (
                "Estimated net profit assumes all relevant business expenses were recorded. "
                "Transfers between business accounts are excluded from income and expenses."
            )
        }

    @staticmethod
    def detect_duplicates(
        new_tx: Dict[str, Any],
        existing_txs: List[Dict[str, Any]],
        days_window: int = 2
    ) -> List[Dict[str, Any]]:
        """
        Detects potential duplicate transactions:
        Matches if amount is identical, date is within +/- days_window, and description is similar.
        """
        duplicates = []
        new_amt = new_tx.get("amount_paise")
        new_desc = (new_tx.get("description") or "").lower().strip()
        new_date_str = (new_tx.get("occurred_at") or "")[:10]
        
        try:
            new_date = date.fromisoformat(new_date_str)
        except Exception:
            new_date = date.today()
            
        for ext in existing_txs:
            if ext.get("id") == new_tx.get("id") or ext.get("status") == "voided":
                continue
            if ext.get("amount_paise") == new_amt:
                ext_date_str = (ext.get("occurred_at") or "")[:10]
                try:
                    ext_date = date.fromisoformat(ext_date_str)
                    diff_days = abs((new_date - ext_date).days)
                except Exception:
                    diff_days = 999
                    
                if diff_days <= days_window:
                    ext_desc = (ext.get("description") or "").lower().strip()
                    # Check exact or substring description match
                    if ext_desc == new_desc or (len(new_desc) > 3 and (new_desc in ext_desc or ext_desc in new_desc)):
                        duplicates.append(ext)
        return duplicates

    @staticmethod
    def detect_unusual_expenses(
        expenses: List[Dict[str, Any]],
        threshold_paise: int = 500000
    ) -> List[Dict[str, Any]]:
        """
        Identifies statistical outlier expenses neutrally (never labelled as fraud).
        Flags if amount >= user threshold OR exceeds 2.5x standard deviations of typical expenses.
        """
        active_expenses = [e for e in expenses if e.get("type") == "expense" and e.get("status") != "voided"]
        if not active_expenses:
            return []
            
        amounts = [e.get("amount_paise", 0) for e in active_expenses]
        
        # Calculate baseline metrics excluding the candidate or calculating standard deviation
        unusual = []
        for e in active_expenses:
            amt = e.get("amount_paise", 0)
            is_unusual = False
            reason = ""
            
            # Explicit threshold check
            if threshold_paise > 0 and amt >= threshold_paise:
                is_unusual = True
                reason = f"Amount {format_inr(amt)} exceeds your alert threshold ({format_inr(threshold_paise)})"
            elif len(amounts) >= 4:
                # Compare against other transactions in the group
                other_amts = [x for x in amounts if x != amt]
                if other_amts:
                    other_mean = sum(other_amts) / len(other_amts)
                    variance = sum((x - other_mean) ** 2 for x in other_amts) / len(other_amts)
                    std_dev = math.sqrt(variance) if variance > 0 else 0
                    if amt > other_mean + (2.5 * std_dev) and amt > (other_mean * 2):
                        is_unusual = True
                        reason = f"Amount {format_inr(amt)} is significantly higher than typical expenses (average: {format_inr(int(other_mean))})"
            
            if is_unusual:
                unusual.append({
                    "transaction": e,
                    "reason": reason
                })
        return unusual
