"""
Bank, UPI, and Sales statement parsers for Money & Profit Control Kit.
Includes pre-configured parsers for Indian banking & UPI exports and a flexible mapping wizard.
All amounts are converted to integer paise.
"""

import csv
import io
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
from ..calculation_engine import parse_inr_to_paise

# Standard preset column mappings
BANK_PRESETS = {
    "hdfc": {
        "name": "HDFC Bank Statement",
        "date_col": "Date",
        "desc_col": "Narration",
        "ref_col": "Chq/Ref No",
        "debit_col": "Withdrawal Amount",
        "credit_col": "Deposit Amount",
        "date_format": "%d/%m/%y",
    },
    "icici": {
        "name": "ICICI Bank Statement",
        "date_col": "Value Date",
        "desc_col": "Transaction Details",
        "ref_col": "Cheque No",
        "debit_col": "Dr Amount",
        "credit_col": "Cr Amount",
        "date_format": "%d/%m/%Y",
    },
    "sbi": {
        "name": "State Bank of India (SBI)",
        "date_col": "Txn Date",
        "desc_col": "Description",
        "ref_col": "Ref No",
        "debit_col": "Debit",
        "credit_col": "Credit",
        "date_format": "%d-%b-%Y",
    },
    "axis": {
        "name": "Axis Bank Statement",
        "date_col": "Tran Date",
        "desc_col": "Particulars",
        "ref_col": "CHQNO",
        "debit_col": "Debit",
        "credit_col": "Credit",
        "date_format": "%d-%m-%Y",
    },
    "kotak": {
        "name": "Kotak Mahindra Bank",
        "date_col": "Date",
        "desc_col": "Description",
        "ref_col": "Chq/Ref",
        "debit_col": "Debit",
        "credit_col": "Credit",
        "date_format": "%d/%m/%Y",
    },
    "phonepe": {
        "name": "PhonePe UPI Statement",
        "date_col": "Date",
        "desc_col": "Details",
        "ref_col": "Transaction ID",
        "type_col": "Type", # "DEBIT" or "CREDIT"
        "amount_col": "Amount",
        "date_format": "%Y-%m-%d %H:%M:%S",
    },
    "gpay": {
        "name": "Google Pay Statement",
        "date_col": "Date",
        "desc_col": "Description",
        "ref_col": "Transaction ID",
        "amount_col": "Amount", # Signed or positive with Paid To/By
        "status_col": "Status",
        "date_format": "%d %b %Y",
    },
    "paytm": {
        "name": "Paytm Statement",
        "date_col": "Date",
        "desc_col": "Activity",
        "ref_col": "Order ID",
        "debit_col": "Debit",
        "credit_col": "Credit",
        "date_format": "%d/%m/%Y %H:%M:%S",
    },
    "razorpay_sales": {
        "name": "Razorpay Payments Export",
        "date_col": "created_at",
        "desc_col": "description",
        "ref_col": "payment_id",
        "amount_col": "amount", # in INR or paise
        "status_col": "status",
        "date_format": "%Y-%m-%d %H:%M:%S",
    },
}

def parse_date_flexibly(date_str: str, preferred_format: Optional[str] = None) -> str:
    cleaned = date_str.strip().replace("'", "").replace('"', '')
    if preferred_format:
        try:
            return datetime.strptime(cleaned, preferred_format).isoformat()
        except Exception:
            pass

    formats = [
        "%d/%m/%Y", "%d/%m/%y", "%d-%m-%Y", "%d-%m-%y",
        "%Y-%m-%d", "%Y-%m-%d %H:%M:%S", "%d/%m/%Y %H:%M:%S",
        "%d %b %Y", "%d-%b-%Y", "%d %b, %Y",
    ]
    for fmt in formats:
        try:
            return datetime.strptime(cleaned, fmt).isoformat()
        except Exception:
            continue
            
    # Fallback to now
    return datetime.utcnow().isoformat()

class StatementParser:
    """
    Parses CSV content using either preset bank formats or custom mapping wizard rules.
    """
    
    @staticmethod
    def parse_csv_stream(csv_text: str) -> Tuple[List[str], List[Dict[str, str]]]:
        """
        Extracts headers and normalized rows from CSV text.
        """
        reader = csv.reader(io.StringIO(csv_text.strip()))
        rows = list(reader)
        if not rows:
            return [], []
            
        # Find first row that looks like a header (has >= 3 non-empty values)
        header_idx = 0
        for idx, row in enumerate(rows):
            non_empty = [c for c in row if c.strip()]
            if len(non_empty) >= 3:
                header_idx = idx
                break
                
        headers = [h.strip() for h in rows[header_idx]]
        parsed_rows = []
        for row in rows[header_idx + 1:]:
            if not row or not any(row):
                continue
            row_dict = {}
            for col_idx, h in enumerate(headers):
                if col_idx < len(row):
                    row_dict[h] = row[col_idx].strip()
                else:
                    row_dict[h] = ""
            parsed_rows.append(row_dict)
            
        return headers, parsed_rows

    @classmethod
    def parse_with_preset(cls, csv_text: str, preset_key: str) -> List[Dict[str, Any]]:
        preset = BANK_PRESETS.get(preset_key)
        if not preset:
            raise ValueError(f"Unknown bank preset: {preset_key}")
            
        headers, rows = cls.parse_csv_stream(csv_text)
        results = []
        
        for r in rows:
            date_val = r.get(preset["date_col"], "")
            if not date_val:
                continue
                
            occurred_at = parse_date_flexibly(date_val, preset.get("date_format"))
            desc = r.get(preset["desc_col"], "Bank Entry")
            ref = r.get(preset.get("ref_col", ""), "")
            
            # Check debit / credit columns
            if "debit_col" in preset and "credit_col" in preset:
                debit_str = r.get(preset["debit_col"], "").strip()
                credit_str = r.get(preset["credit_col"], "").strip()
                
                debit_paise = parse_inr_to_paise(debit_str) if debit_str else 0
                credit_paise = parse_inr_to_paise(credit_str) if credit_str else 0
                
                if credit_paise > 0:
                    results.append({
                        "type": "income",
                        "amount_paise": credit_paise,
                        "occurred_at": occurred_at,
                        "description": desc,
                        "reference_number": ref,
                        "source": f"import_{preset_key}",
                    })
                elif debit_paise > 0:
                    results.append({
                        "type": "expense",
                        "amount_paise": debit_paise,
                        "occurred_at": occurred_at,
                        "description": desc,
                        "reference_number": ref,
                        "source": f"import_{preset_key}",
                    })
            elif "type_col" in preset and "amount_col" in preset:
                t_str = r.get(preset["type_col"], "").upper()
                amt_str = r.get(preset["amount_col"], "")
                amt_paise = parse_inr_to_paise(amt_str)
                tx_type = "income" if "CREDIT" in t_str else "expense"
                if amt_paise > 0:
                    results.append({
                        "type": tx_type,
                        "amount_paise": amt_paise,
                        "occurred_at": occurred_at,
                        "description": desc,
                        "reference_number": ref,
                        "source": f"import_{preset_key}",
                    })
            elif "amount_col" in preset:
                amt_str = r.get(preset["amount_col"], "")
                amt_paise = parse_inr_to_paise(amt_str)
                if amt_paise != 0:
                    results.append({
                        "type": "income" if amt_paise > 0 else "expense",
                        "amount_paise": abs(amt_paise),
                        "occurred_at": occurred_at,
                        "description": desc,
                        "reference_number": ref,
                        "source": f"import_{preset_key}",
                    })
                    
        return results

    @classmethod
    def parse_with_custom_mapping(
        cls, 
        csv_text: str, 
        mapping: Dict[str, str], 
        date_format: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        mapping dictionary keys:
        - date_col: header name for date
        - desc_col: header name for description
        - ref_col: optional header for reference
        - type_strategy: 'single_signed_column', 'separate_debit_credit', or 'type_and_amount'
        - debit_col, credit_col (if separate)
        - amount_col, type_col (if type_and_amount)
        - amount_col (if single_signed_column)
        """
        headers, rows = cls.parse_csv_stream(csv_text)
        results = []
        
        date_col = mapping.get("date_col")
        desc_col = mapping.get("desc_col")
        ref_col = mapping.get("ref_col")
        strategy = mapping.get("type_strategy", "separate_debit_credit")
        
        for r in rows:
            date_raw = r.get(date_col, "") if date_col else ""
            if not date_raw:
                continue
            occurred_at = parse_date_flexibly(date_raw, date_format)
            desc = r.get(desc_col, "Imported Entry") if desc_col else "Imported Entry"
            ref = r.get(ref_col, "") if ref_col else ""
            
            if strategy == "separate_debit_credit":
                dr_col = mapping.get("debit_col", "")
                cr_col = mapping.get("credit_col", "")
                dr_val = parse_inr_to_paise(r.get(dr_col, "")) if dr_col else 0
                cr_val = parse_inr_to_paise(r.get(cr_col, "")) if cr_col else 0
                
                if cr_val > 0:
                    results.append({
                        "type": "income",
                        "amount_paise": cr_val,
                        "occurred_at": occurred_at,
                        "description": desc,
                        "reference_number": ref,
                        "source": "import_custom",
                    })
                elif dr_val > 0:
                    results.append({
                        "type": "expense",
                        "amount_paise": dr_val,
                        "occurred_at": occurred_at,
                        "description": desc,
                        "reference_number": ref,
                        "source": "import_custom",
                    })
            elif strategy == "single_signed_column":
                amt_col = mapping.get("amount_col", "")
                amt_val = parse_inr_to_paise(r.get(amt_col, "")) if amt_col else 0
                if amt_val != 0:
                    results.append({
                        "type": "income" if amt_val > 0 else "expense",
                        "amount_paise": abs(amt_val),
                        "occurred_at": occurred_at,
                        "description": desc,
                        "reference_number": ref,
                        "source": "import_custom",
                    })
            elif strategy == "type_and_amount":
                t_col = mapping.get("type_col", "")
                amt_col = mapping.get("amount_col", "")
                t_str = (r.get(t_col, "") if t_col else "").lower()
                amt_val = abs(parse_inr_to_paise(r.get(amt_col, "")) if amt_col else 0)
                is_income = any(w in t_str for w in ["cr", "credit", "income", "received", "deposit"])
                if amt_val > 0:
                    results.append({
                        "type": "income" if is_income else "expense",
                        "amount_paise": amt_val,
                        "occurred_at": occurred_at,
                        "description": desc,
                        "reference_number": ref,
                        "source": "import_custom",
                    })
                    
        return results
