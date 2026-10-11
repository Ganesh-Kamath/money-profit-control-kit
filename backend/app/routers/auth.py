import uuid
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Depends, status
from ..database import get_connection, recalculate_account_balance
from ..security import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user_and_business
)
from ..models import SignupRequest, LoginRequest, AuthResponse, OnboardingRequest
from ..email_service import EmailService

router = APIRouter(prefix="/auth", tags=["Authentication & Onboarding"])

DEFAULT_CATEGORIES = {
    "home_bakery": [
        ("Cakes & Pastries Sales", "income", False, False),
        ("Custom Order Sales", "income", False, False),
        ("Flour, Dairy & Baking Ingredients", "expense", True, False), # Stock/raw materials
        ("Cake Boxes & Packaging", "expense", False, False),
        ("Kitchen Rent", "expense", False, False),
        ("Electricity & Gas", "expense", False, False),
        ("Delivery & Porter", "expense", False, False),
        ("Instagram Ads & Marketing", "expense", False, False),
        ("Oven & Stand Mixer Equipment", "expense", False, True), # Capital Equipment
    ],
    "service": [
        ("Client Retainer Fees", "income", False, False),
        ("Project Milestone Sales", "income", False, False),
        ("Software Subscriptions & Tools", "expense", False, False),
        ("Coworking & Office Rent", "expense", False, False),
        ("Contractor & Freelancer Fees", "expense", False, False),
        ("Marketing & Lead Gen", "expense", False, False),
        ("Laptop & Electronics", "expense", False, True),
    ],
    "retail": [
        ("Store Counter Sales", "income", False, False),
        ("Online Orders Sales", "income", False, False),
        ("Inventory & Stock Purchases", "expense", True, False),
        ("Store Rent", "expense", False, False),
        ("Staff Wages", "expense", False, False),
        ("Packaging Bags & Materials", "expense", False, False),
        ("POS Machine & Furniture", "expense", False, True),
    ],
    "reseller": [
        ("Product Sales", "income", False, False),
        ("Wholesale Stock Inward", "expense", True, False),
        ("Courier & Shipping Charges", "expense", False, False),
        ("Packaging Materials", "expense", False, False),
        ("Marketplace & Platform Fees", "expense", False, False),
    ]
}

def seed_defaults_for_business(conn, business_id: str, business_type: str):
    now_str = datetime.now(timezone.utc).isoformat()
    # 1. Default accounts
    default_accounts = [
        ("Cash in Hand", "cash", 0, True),
        ("Current Bank Account", "bank", 0, True),
        ("UPI / QR Account", "upi", 0, False),
    ]
    for acc_name, acc_type, bal, is_def in default_accounts:
        acc_id = str(uuid.uuid4())
        conn.execute("""
            INSERT INTO accounts (id, business_id, name, account_type, opening_balance_paise, opening_balance_date, current_balance_paise, is_default, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (acc_id, business_id, acc_name, acc_type, bal, datetime.now(timezone.utc).strftime("%Y-%m-%d"), bal, 1 if is_def else 0, now_str, now_str))

    # 2. Default categories based on business type
    cats = DEFAULT_CATEGORIES.get(business_type, DEFAULT_CATEGORIES["home_bakery"])
    for name, cat_type, is_stock, is_eq in cats:
        conn.execute("""
            INSERT INTO categories (id, business_id, name, type, is_stock, is_equipment, is_default, created_at)
            VALUES (?, ?, ?, ?, ?, ?, 1, ?)
        """, (str(uuid.uuid4()), business_id, name, cat_type, 1 if is_stock else 0, 1 if is_eq else 0, now_str))

@router.post("/signup", response_model=AuthResponse)
def signup(req: SignupRequest):
    conn = get_connection()
    try:
        existing = conn.execute("SELECT id FROM users WHERE email = ?", (req.email,)).fetchone()
        if existing:
            raise HTTPException(status_code=400, detail="An account with this email already exists")

        now = datetime.now(timezone.utc)
        now_str = now.isoformat()
        user_id = str(uuid.uuid4())
        business_id = str(uuid.uuid4())
        hashed_pwd = hash_password(req.password)

        with conn:
            # Create user
            conn.execute("""
                INSERT INTO users (id, email, full_name, password_hash, created_at)
                VALUES (?, ?, ?, ?, ?)
            """, (user_id, req.email, req.full_name, hashed_pwd, now_str))

            # Create business
            conn.execute("""
                INSERT INTO businesses (id, name, business_type, currency, timezone, fy_start_month, created_at, updated_at)
                VALUES (?, ?, ?, 'INR', 'Asia/Kolkata', 4, ?, ?)
            """, (business_id, req.business_name, req.business_type, now_str, now_str))

            # Create owner membership
            conn.execute("""
                INSERT INTO business_memberships (id, business_id, user_id, email, role, invited_at, accepted_at, created_at)
                VALUES (?, ?, ?, ?, 'owner', ?, ?, ?)
            """, (str(uuid.uuid4()), business_id, user_id, req.email, now_str, now_str, now_str))

            # Create default 12-month license
            expires_at = (now + timedelta(days=365)).isoformat()
            conn.execute("""
                INSERT INTO licenses (id, business_id, tier, status, max_users, starts_at, expires_at, created_at, updated_at)
                VALUES (?, ?, 'business', 'active', 5, ?, ?, ?, ?)
            """, (str(uuid.uuid4()), business_id, now_str, expires_at, now_str, now_str))

            # Seed default categories & accounts
            seed_defaults_for_business(conn, business_id, req.business_type)

        # Dispatch welcome email
        EmailService.send_email(
            to_email=req.email,
            subject=f"Welcome to Money & Profit Control Kit — {req.business_name}",
            html_content=f"""
            <h2>Welcome {req.full_name}!</h2>
            <p>Your workspace for <strong>{req.business_name}</strong> is ready.</p>
            <p>You can now answer the 5 critical financial questions for your business in seconds:</p>
            <ol>
                <li>How much money came in today?</li>
                <li>How much did you spend, and on what?</li>
                <li>How much estimated net profit did you actually make?</li>
                <li>How much money is available right now across cash, bank and UPI?</li>
                <li>What bills or receivables need your attention next?</li>
            </ol>
            <p>Log in anytime to manage your transactions and download reports.</p>
            """
        )

        token = create_access_token({"sub": user_id, "business_id": business_id})
        return AuthResponse(
            token=token,
            user_id=user_id,
            email=req.email,
            full_name=req.full_name,
            business_id=business_id,
            business_name=req.business_name,
            role="owner"
        )
    finally:
        conn.close()

@router.post("/login", response_model=AuthResponse)
def login(req: LoginRequest):
    conn = get_connection()
    try:
        user_row = conn.execute("SELECT id, email, full_name, password_hash FROM users WHERE email = ?", (req.email,)).fetchone()
        if not user_row or not verify_password(req.password, user_row["password_hash"]):
            raise HTTPException(status_code=401, detail="Invalid email or password")

        # Fetch first business membership
        membership = conn.execute("""
            SELECT m.business_id, m.role, b.name as business_name
            FROM business_memberships m
            JOIN businesses b ON b.id = m.business_id
            WHERE m.user_id = ?
            ORDER BY m.created_at ASC LIMIT 1
        """, (user_row["id"],)).fetchone()

        if not membership:
            raise HTTPException(status_code=403, detail="No active business workspace found for user")

        token = create_access_token({"sub": user_row["id"], "business_id": membership["business_id"]})
        return AuthResponse(
            token=token,
            user_id=user_row["id"],
            email=user_row["email"],
            full_name=user_row["full_name"],
            business_id=membership["business_id"],
            business_name=membership["business_name"],
            role=membership["role"]
        )
    finally:
        conn.close()

@router.get("/me")
def get_me(auth_ctx: dict = Depends(get_current_user_and_business)):
    conn = get_connection()
    try:
        biz = conn.execute("SELECT * FROM businesses WHERE id = ?", (auth_ctx["business_id"],)).fetchone()
        license_row = conn.execute("SELECT * FROM licenses WHERE business_id = ?", (auth_ctx["business_id"],)).fetchone()
        return {
            "user": {
                "id": auth_ctx["user_id"],
                "email": auth_ctx["email"],
                "full_name": auth_ctx["full_name"],
                "role": auth_ctx["role"]
            },
            "business": dict(biz) if biz else None,
            "license": dict(license_row) if license_row else None
        }
    finally:
        conn.close()

@router.post("/onboarding/complete")
def complete_onboarding(
    req: OnboardingRequest,
    auth_ctx: dict = Depends(get_current_user_and_business)
):
    conn = get_connection()
    try:
        business_id = auth_ctx["business_id"]
        now_str = datetime.now(timezone.utc).isoformat()
        with conn:
            conn.execute("""
                UPDATE businesses
                SET name = ?, business_type = ?, timezone = ?, fy_start_month = ?, updated_at = ?
                WHERE id = ?
            """, (req.business_name, req.business_type, req.timezone, req.fy_start_month, now_str, business_id))

            # Update or create accounts with opening balances
            for acc in req.accounts:
                acc_name = acc.get("name")
                acc_type = acc.get("account_type", "custom")
                opening_paise = acc.get("opening_balance_paise", 0)
                opening_date = acc.get("opening_balance_date", datetime.now(timezone.utc).strftime("%Y-%m-%d"))

                existing_acc = conn.execute("SELECT id FROM accounts WHERE business_id = ? AND name = ?", (business_id, acc_name)).fetchone()
                if existing_acc:
                    conn.execute("""
                        UPDATE accounts
                        SET opening_balance_paise = ?, opening_balance_date = ?, current_balance_paise = ?, updated_at = ?
                        WHERE id = ?
                    """, (opening_paise, opening_date, opening_paise, now_str, existing_acc["id"]))
                    recalculate_account_balance(conn, existing_acc["id"])
                else:
                    new_id = str(uuid.uuid4())
                    conn.execute("""
                        INSERT INTO accounts (id, business_id, name, account_type, opening_balance_paise, opening_balance_date, current_balance_paise, created_at, updated_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, (new_id, business_id, acc_name, acc_type, opening_paise, opening_date, opening_paise, now_str, now_str))

        return {"status": "success", "message": "Onboarding completed successfully"}
    finally:
        conn.close()
