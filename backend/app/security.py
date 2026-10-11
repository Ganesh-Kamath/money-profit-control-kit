import hmac
import hashlib
import sqlite3
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any, List
import bcrypt
from jose import jwt, JWTError
from fastapi import HTTPException, Security, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from .config import settings
from .database import get_connection

security_bearer = HTTPBearer(auto_error=False)

def hash_password(password: str) -> str:
    salt = bcrypt.gensalt(rounds=12)
    # Truncate to 72 bytes if needed per bcrypt spec
    pwd_bytes = password.encode('utf-8')[:72]
    return bcrypt.hashpw(pwd_bytes, salt).decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    pwd_bytes = plain_password.encode('utf-8')[:72]
    return bcrypt.checkpw(pwd_bytes, hashed_password.encode('utf-8'))

def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)

def decode_access_token(token: str) -> Dict[str, Any]:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token or token expired",
            headers={"WWW-Authenticate": "Bearer"},
        )

def get_current_user_and_business(
    credentials: Optional[HTTPAuthorizationCredentials] = Security(security_bearer)
) -> Dict[str, Any]:
    """
    Validates token and extracts user_id, email, and business context.
    """
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Bearer authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    payload = decode_access_token(credentials.credentials)
    user_id = payload.get("sub")
    business_id = payload.get("business_id")
    if not user_id or not business_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Malformed token: user or business context missing"
        )
    
    # Verify membership and fetch role
    conn = get_connection()
    try:
        row = conn.execute("""
            SELECT m.role, b.id as business_id, b.name as business_name, u.email, u.full_name
            FROM business_memberships m
            JOIN businesses b ON b.id = m.business_id
            JOIN users u ON u.id = m.user_id
            WHERE m.business_id = ? AND m.user_id = ?
        """, (business_id, user_id)).fetchone()
        
        if not row:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User has no membership in the requested business workspace"
            )
            
        return {
            "user_id": user_id,
            "business_id": business_id,
            "business_name": row["business_name"],
            "email": row["email"],
            "full_name": row["full_name"],
            "role": row["role"], # 'owner', 'bookkeeper', 'viewer'
        }
    finally:
        conn.close()

def require_role(allowed_roles: List[str]):
    """
    FastAPI dependency factory enforcing role permissions:
    e.g. require_role(['owner', 'bookkeeper'])
    """
    def dependency(auth_ctx: Dict[str, Any] = Depends(get_current_user_and_business)):
        role = auth_ctx.get("role")
        if role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Operation not permitted for role '{role}'. Required: {allowed_roles}"
            )
        return auth_ctx
    return dependency

def verify_razorpay_signature(payload_body: bytes, signature: str, secret: str) -> bool:
    """
    Verifies Razorpay HMAC-SHA256 signature.
    """
    if not signature or not secret:
        return False
    expected = hmac.new(secret.encode("utf-8"), payload_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)
