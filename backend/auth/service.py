"""
Service Layer: AuthService

หน้าที่:
- จัดการ account directory จาก environment
- sync รายชื่อเข้าตาราง users ตอนเริ่มระบบ
- ค้นผู้ใช้ที่ active สำหรับ flow login

จุดสำคัญ:
- login ใช้ username ภาษาอังกฤษ
- full_name เก็บชื่อไทยเพื่อแสดงที่ UI
"""

import os
from dotenv import load_dotenv
from sqlalchemy.orm import Session

from ..utils.db import SessionLocal
from .repo import UserRepository

load_dotenv()


def build_account_directory() -> list[dict]:
    """อ่านค่า account จาก env แล้วประกอบเป็น list[dict]"""
    accounts = [
        {
            "username": "itadmin1",
            "full_name": "ธีรกฤษณ์ เนียมสวัสดิ์1",
            "emp_code": os.getenv("ADMIN_EMP_CODE_1", os.getenv("ADMIT_EMP_CODE_1", "ADM1001")),
            "password": os.getenv("ADMIN_PASSWORD_1", "0000"),
            "role": "admin",
        },
        {
            "username": "itadmin2",
            "full_name": "ธีรกฤษณ์ เนียมสวัสดิ์2",
            "emp_code": os.getenv("ADMIN_EMP_CODE_2", os.getenv("ADMIT_EMP_CODE_2", "ADM1002")),
            "password": os.getenv("ADMIN_PASSWORD_2", "1111"),
            "role": "admin",
        },
        {
            "username": "itadmin3",
            "full_name": "ธีรกฤษณ์ เนียมสวัสดิ์3",
            "emp_code": os.getenv("ADMIN_EMP_CODE_3", os.getenv("ADMIT_EMP_CODE_3", "ADM1003")),
            "password": os.getenv("ADMIN_PASSWORD_3", "2222"),
            "role": "admin",
        },
    ]

    legacy_username = (os.getenv("ADMIN_USERNAME", "") or "").strip()
    legacy_password = (os.getenv("ADMIN_PASSWORD", "") or "").strip()
    if legacy_username and legacy_password:
        # รองรับ account เก่าเพื่อไม่ให้คนที่ยังใช้ username เดิมเข้าไม่ได้
        accounts.append(
            {
                "username": legacy_username,
                "full_name": legacy_username,
                "emp_code": os.getenv("ADMIN_EMP_CODE", "ADM9999"),
                "password": legacy_password,
                "role": "admin",
            }
        )

    return accounts


def sync_accounts_to_db() -> None:
    """เอา account directory ไป sync ลงตาราง users"""
    db: Session = SessionLocal()
    try:
        # upsert ทุก record แล้ว commit รอบเดียวท้ายสุด
        for account in build_account_directory():
            UserRepository.upsert(db, account)
        db.commit()
    finally:
        db.close()


def find_account(username: str):
    """หา account ที่ active ตาม username สำหรับตรวจ login"""
    normalized = (username or "").strip()
    if not normalized:
        return None

    db: Session = SessionLocal()
    try:
        return UserRepository.get_active_by_username(db, normalized)
    finally:
        db.close()
