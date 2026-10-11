import pytest
import uuid
from datetime import datetime, timezone
from fastapi import HTTPException
from app.database import get_connection, init_db
from app.security import (
    hash_password,
    create_access_token,
    get_current_user_and_business,
    require_role
)
from fastapi.security import HTTPAuthorizationCredentials

@pytest.fixture(autouse=True)
def setup_test_db(tmp_path, monkeypatch):
    test_db = str(tmp_path / "test_security.db")
    monkeypatch.setattr("app.database.get_db_path", lambda: test_db)
    init_db()
    
    conn = get_connection()
    now_str = datetime.now(timezone.utc).isoformat()
    
    # Create Business 1 and Business 2
    b1_id = "biz-1111"
    b2_id = "biz-2222"
    conn.execute("INSERT INTO businesses (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)", (b1_id, "Bakery One", now_str, now_str))
    conn.execute("INSERT INTO businesses (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)", (b2_id, "Tiffin Two", now_str, now_str))
    
    # Users
    u_owner_id = "usr-owner-1"
    u_bookkeeper_id = "usr-bookkeeper-1"
    u_viewer_id = "usr-viewer-1"
    u_other_id = "usr-other-2"
    
    pwd = hash_password("secret123")
    for uid, email in [(u_owner_id, "owner@b1.com"), (u_bookkeeper_id, "bk@b1.com"), (u_viewer_id, "view@b1.com"), (u_other_id, "owner@b2.com")]:
        conn.execute("INSERT INTO users (id, email, full_name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)", (uid, email, email, pwd, now_str))
        
    # Memberships
    conn.execute("INSERT INTO business_memberships (id, business_id, user_id, email, role, invited_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                 ("m1", b1_id, u_owner_id, "owner@b1.com", "owner", now_str, now_str))
    conn.execute("INSERT INTO business_memberships (id, business_id, user_id, email, role, invited_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                 ("m2", b1_id, u_bookkeeper_id, "bk@b1.com", "bookkeeper", now_str, now_str))
    conn.execute("INSERT INTO business_memberships (id, business_id, user_id, email, role, invited_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                 ("m3", b1_id, u_viewer_id, "view@b1.com", "viewer", now_str, now_str))
    conn.execute("INSERT INTO business_memberships (id, business_id, user_id, email, role, invited_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                 ("m4", b2_id, u_other_id, "owner@b2.com", "owner", now_str, now_str))
                 
    conn.commit()
    conn.close()

def test_tenant_isolation_unauthorized_business():
    # User 1 attempts to access Business 2
    token_cross_tenant = create_access_token({"sub": "usr-owner-1", "business_id": "biz-2222"})
    creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token_cross_tenant)
    
    with pytest.raises(HTTPException) as exc_info:
        get_current_user_and_business(creds)
    assert exc_info.value.status_code == 403
    assert "no membership" in exc_info.value.detail

def test_owner_access_granted():
    token_owner = create_access_token({"sub": "usr-owner-1", "business_id": "biz-1111"})
    creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token_owner)
    ctx = get_current_user_and_business(creds)
    assert ctx["business_id"] == "biz-1111"
    assert ctx["role"] == "owner"

def test_role_enforcement_viewer_cannot_write():
    token_viewer = create_access_token({"sub": "usr-viewer-1", "business_id": "biz-1111"})
    creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token_viewer)
    ctx = get_current_user_and_business(creds)
    
    # Endpoint requires owner or bookkeeper
    dep = require_role(["owner", "bookkeeper"])
    with pytest.raises(HTTPException) as exc_info:
        dep(ctx)
    assert exc_info.value.status_code == 403
    assert "viewer" in exc_info.value.detail

def test_bookkeeper_cannot_manage_memberships_or_licenses():
    token_bk = create_access_token({"sub": "usr-bookkeeper-1", "business_id": "biz-1111"})
    creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token_bk)
    ctx = get_current_user_and_business(creds)
    
    # Endpoint requires owner only
    dep = require_role(["owner"])
    with pytest.raises(HTTPException) as exc_info:
        dep(ctx)
    assert exc_info.value.status_code == 403
    assert "bookkeeper" in exc_info.value.detail

def test_bookkeeper_can_write_transactions():
    token_bk = create_access_token({"sub": "usr-bookkeeper-1", "business_id": "biz-1111"})
    creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token_bk)
    ctx = get_current_user_and_business(creds)
    
    dep = require_role(["owner", "bookkeeper"])
    allowed_ctx = dep(ctx)
    assert allowed_ctx["role"] == "bookkeeper"
