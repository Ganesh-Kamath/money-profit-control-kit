from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List, Dict, Any

# Auth Models
class SignupRequest(BaseModel):
    email: EmailStr
    full_name: str
    password: str
    business_name: str
    business_type: str = "home_bakery" # home_bakery, service, retail, reseller, other

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class AuthResponse(BaseModel):
    token: str
    user_id: str
    email: str
    full_name: str
    business_id: str
    business_name: str
    role: str

# Onboarding
class OnboardingRequest(BaseModel):
    business_name: str
    business_type: str
    timezone: str = "Asia/Kolkata"
    fy_start_month: int = 4
    categories: List[str]
    accounts: List[Dict[str, Any]] # name, account_type, opening_balance_paise, opening_balance_date

# Transactions
class TransactionCreate(BaseModel):
    type: str # income, expense, transfer, adjustment
    amount_paise: int = Field(gt=0)
    occurred_at: str
    account_id: str
    to_account_id: Optional[str] = None # required for transfer
    category_id: Optional[str] = None
    contact_id: Optional[str] = None
    description: str
    reference_number: Optional[str] = None
    notes: Optional[str] = None
    receipt_id: Optional[str] = None
    idempotency_key: Optional[str] = None
    source: str = "manual"

class TransactionUpdate(BaseModel):
    description: Optional[str] = None
    category_id: Optional[str] = None
    occurred_at: Optional[str] = None
    reference_number: Optional[str] = None
    notes: Optional[str] = None

class TransactionVoid(BaseModel):
    void_reason: str

class BulkCategorizeRequest(BaseModel):
    transaction_ids: List[str]
    category_id: str

# Accounts & Transfers
class AccountCreate(BaseModel):
    name: str
    account_type: str # cash, bank, upi, petty_cash, custom
    account_number_last4: Optional[str] = None
    opening_balance_paise: int = 0
    opening_balance_date: Optional[str] = None
    is_default: bool = False

class AccountUpdate(BaseModel):
    name: Optional[str] = None
    is_default: Optional[bool] = None
    archived: Optional[bool] = None

class TransferRequest(BaseModel):
    from_account_id: str
    to_account_id: str
    amount_paise: int = Field(gt=0)
    occurred_at: str
    description: str = "Transfer between accounts"
    reference_number: Optional[str] = None
    notes: Optional[str] = None

class ReconcileRequest(BaseModel):
    account_id: str
    period_start: str
    period_end: str
    statement_balance_paise: int
    notes: Optional[str] = None

# Categories
class CategoryCreate(BaseModel):
    name: str
    type: str # income, expense
    icon: Optional[str] = None
    color: Optional[str] = None
    is_stock: bool = False
    is_equipment: bool = False

# Invoices & Receivables
class InvoiceCreate(BaseModel):
    contact_name: str
    contact_phone: Optional[str] = None
    invoice_number: str
    issue_date: str
    due_date: str
    total_amount_paise: int = Field(gt=0)
    category_id: Optional[str] = None
    notes: Optional[str] = None

class InvoiceCollectRequest(BaseModel):
    amount_paise: int = Field(gt=0)
    account_id: str
    occurred_at: str
    description: Optional[str] = None
    reference_number: Optional[str] = None

# Period Lock
class PeriodLockRequest(BaseModel):
    period_end_date: str
    notes: Optional[str] = None

# Assistant
class AssistantAskRequest(BaseModel):
    question: str
    period: str = "this_month"

# Payments & Billing
class OrderCreateRequest(BaseModel):
    tier: str # solo (299900) or business (399900)

class InviteMemberRequest(BaseModel):
    email: EmailStr
    role: str # bookkeeper or viewer

class SimulatePaymentRequest(BaseModel):
    tier: str = "business"
    customer_email: EmailStr
    customer_name: str
    business_name: str
