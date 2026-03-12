# ============================================================
#  backend/auth/route.py
#  Authentication endpoints
# ============================================================
"""
Router Layer: auth

หน้าที่:
- รับ login request
- สร้างและตรวจ JWT
- เปิด endpoint verify ให้ frontend เช็ก session

Flow:
Client login -> /api/auth/login -> service.find_account -> create JWT -> return token
Client verify -> /api/auth/verify -> get_current_admin dependency -> return profile
"""

import os
from datetime import datetime, timedelta
from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from pydantic import BaseModel
from . import service as auth_service

load_dotenv()

router = APIRouter(prefix="/api/auth", tags=["auth"])

SECRET_KEY     = os.getenv("SECRET_KEY", "changeme")   # key สำหรับเซ็น JWT (ต้องเปลี่ยน!)
ALGORITHM      = "HS256"                               # algorithm สำหรับ JWT
EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "480"))  # หมดอายุ 8 ชั่วโมง

# oauth2_scheme — ดึง Bearer token จาก Authorization header
# auto_error=False — ไม่ throw error ถ้าไม่มี token (endpoint จัดการเอง)
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


# ---- Request/Response Schema ----
class LoginRequest(BaseModel):
    """Body ที่ frontend ส่งมาใน POST /login"""
    username: str
    password: str


class TokenResponse(BaseModel):
    """Response ที่ส่งกลับหลัง login สำเร็จ"""
    access_token: str
    token_type: str = "bearer"  # มาตรฐาน OAuth2
    role: str
    username: str
    full_name: str
    emp_code: str


def sync_accounts_to_db():
    # เรียกจาก app startup เพื่อเตรียมบัญชีใน DB ให้พร้อมก่อนรับ request
    auth_service.sync_accounts_to_db()


def create_token(data: dict, expires_delta: timedelta = None):
    """สร้าง JWT token จาก payload dict"""
    to_encode = data.copy()
    # กำหนดเวลาหมดอายุ — ใช้ timedelta ที่ส่งมา หรือ default EXPIRE_MINUTES
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=EXPIRE_MINUTES))
    to_encode["exp"] = expire  # เพิ่ม exp claim ลงใน payload
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def get_current_admin(token: str = Depends(oauth2_scheme)):
    """
    FastAPI Dependency — ใช้ใส่ใน endpoint ที่ต้องการ Admin เท่านั้น
    decode JWT → ตรวจ role → คืน payload หรือ raise 401/403
    """
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        # jwt.decode จะตรวจ signature + exp ให้โดยอัตโนมัติ
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])  # decode และตรวจ signature
        if payload.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Admin only")  # มี token แต่ไม่ใช่ admin
        return payload  # คืน payload (มี sub, role, exp)
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")  # token ผิด/หมดอายุ


@router.post("/login", response_model=TokenResponse)
def login(req: LoginRequest):
    """POST /api/auth/login — ตรวจ username/password แล้วออก JWT token"""
    account = auth_service.find_account(req.username)  # query ตาราง users ผ่าน service/repository
    if not account or req.password != account.password:
        raise HTTPException(status_code=401, detail="รหัสผู้ใช้หรือรหัสผ่านไม่ถูกต้อง")
    if account.role != "admin":
        raise HTTPException(status_code=403, detail="บัญชีนี้ไม่มีสิทธิ์ admin")

    # สร้าง token พร้อมข้อมูล profile เพื่อนำไปใช้บันทึกผู้สร้างฟอร์ม
    token = create_token(
        {
            "sub": account.username,
            "role": account.role,
            "full_name": account.full_name,
            "emp_code": account.emp_code,
        }
    )
    return TokenResponse(
        access_token=token,
        role=account.role,
        username=account.username,
        full_name=account.full_name,
        emp_code=account.emp_code,
    )


@router.get("/verify")
def verify(current=Depends(get_current_admin)):
    """GET /api/auth/verify — ตรวจสอบว่า token ยังใช้ได้ (frontend เรียกตอน page load)"""
    # current คือ payload ที่ dependency get_current_admin decode มาแล้ว
    return {
        "valid": True,
        "role": current["role"],
        "username": current.get("sub"),
        "full_name": current.get("full_name"),
        "emp_code": current.get("emp_code"),
    }
