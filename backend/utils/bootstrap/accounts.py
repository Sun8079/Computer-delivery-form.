# ============================================================
#  backend/utils/bootstrap/accounts.py
#  Seed admin accounts ลง DB ตอน startup
#
#  ถ้าจะเพิ่ม/แก้ admin account → แก้ใน backend/auth/service.py
#  (ฟังก์ชัน build_account_directory) แล้ว restart server
# ============================================================
from __future__ import annotations


def ensure_schema(engine=None) -> None:
    """Sync admin accounts จาก environment ลง DB"""
    from ...auth.service import sync_accounts_to_db
    print("👤 Syncing admin accounts...")
    sync_accounts_to_db()
    print("✅ Accounts synced")
