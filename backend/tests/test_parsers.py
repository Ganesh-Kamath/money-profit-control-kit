import pytest
from app.parsers.statement_parsers import StatementParser, BANK_PRESETS

HDFC_SAMPLE_CSV = """
Date,Narration,Chq/Ref No,Value Dt,Withdrawal Amount,Deposit Amount,Closing Balance
10/10/26,UPI-SWIGGY-12345,REF001,10/10/26,450.00,,50000.00
11/10/26,UPI-CUSTOMER-PAID,REF002,11/10/26,,1200.00,51200.00
"""

SBI_SAMPLE_CSV = """
Txn Date,Value Date,Description,Ref No,Debit,Credit,Balance
10-Oct-2026,10-Oct-2026,ELECTRICITY BILL,SBI001,2340.00,,45000.00
11-Oct-2026,11-Oct-2026,NEFT FROM CLIENT,SBI002,,15000.00,60000.00
"""

PHONEPE_SAMPLE_CSV = """
Date,Transaction ID,Details,Type,Amount
2026-10-10 14:30:00,T261010001,Paid to Packaging Vendor,DEBIT,350.00
2026-10-10 16:45:00,T261010002,Received from Amit Cake Order,CREDIT,1500.00
"""

def test_hdfc_bank_parser():
    parsed = StatementParser.parse_with_preset(HDFC_SAMPLE_CSV, "hdfc")
    assert len(parsed) == 2
    # Row 1: Swiggy expense 450.00 -> 45000 paise
    assert parsed[0]["type"] == "expense"
    assert parsed[0]["amount_paise"] == 45000
    assert "SWIGGY" in parsed[0]["description"]
    assert parsed[0]["reference_number"] == "REF001"
    
    # Row 2: Customer deposit 1200.00 -> 120000 paise
    assert parsed[1]["type"] == "income"
    assert parsed[1]["amount_paise"] == 120000
    assert parsed[1]["reference_number"] == "REF002"

def test_sbi_bank_parser():
    parsed = StatementParser.parse_with_preset(SBI_SAMPLE_CSV, "sbi")
    assert len(parsed) == 2
    assert parsed[0]["type"] == "expense"
    assert parsed[0]["amount_paise"] == 234000
    assert parsed[1]["type"] == "income"
    assert parsed[1]["amount_paise"] == 1500000

def test_phonepe_parser():
    parsed = StatementParser.parse_with_preset(PHONEPE_SAMPLE_CSV, "phonepe")
    assert len(parsed) == 2
    assert parsed[0]["type"] == "expense"
    assert parsed[0]["amount_paise"] == 35000
    assert parsed[1]["type"] == "income"
    assert parsed[1]["amount_paise"] == 150000

def test_custom_mapping_wizard():
    custom_csv = """
    EntryDate|Remark|TxnRef|MoneyOut|MoneyIn
    2026-10-12|Rent Office|RNT99|12000.00|
    2026-10-12|Consulting Fee|CF01||25000.00
    """
    # Replace pipe with comma for standard csv
    custom_csv_clean = custom_csv.replace("|", ",")
    mapping = {
        "date_col": "EntryDate",
        "desc_col": "Remark",
        "ref_col": "TxnRef",
        "type_strategy": "separate_debit_credit",
        "debit_col": "MoneyOut",
        "credit_col": "MoneyIn",
    }
    parsed = StatementParser.parse_with_custom_mapping(custom_csv_clean, mapping)
    assert len(parsed) == 2
    assert parsed[0]["type"] == "expense"
    assert parsed[0]["amount_paise"] == 1200000
    assert parsed[1]["type"] == "income"
    assert parsed[1]["amount_paise"] == 2500000
