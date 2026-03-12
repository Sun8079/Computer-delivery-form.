"""
Repository Layer: UserRepository

หน้าที่:
- จัดการตาราง users โดยตรง
- ใช้กับงาน auth เช่น ค้น user ตาม username และ upsert จาก account directory
"""

from sqlalchemy.orm import Session

from ..utils import models


class UserRepository:
    """รวม query ที่เกี่ยวกับผู้ใช้ (users table)"""

    @staticmethod
    def get_active_by_username(db: Session, username: str):
        # คืนเฉพาะ user ที่ active เพื่อกันบัญชีถูกปิดใช้งาน
        return (
            db.query(models.UserAccount)
            .filter(models.UserAccount.username == username)
            .filter(models.UserAccount.is_active == True)
            .first()
        )

    @staticmethod
    def upsert(db: Session, account: dict):
        # upsert = มีอยู่แล้วก็ update, ไม่มีค่อย create
        row = db.query(models.UserAccount).filter(models.UserAccount.username == account["username"]).first()
        if not row:
            # insert user ใหม่จาก account directory
            row = models.UserAccount(
                username=account["username"],
                full_name=account["full_name"],
                emp_code=account["emp_code"],
                role=account["role"],
                password=account["password"],
                is_active=True,
            )
            db.add(row)
            return row

        # update profile ปัจจุบันให้ตรงค่าคอนฟิกล่าสุด
        row.full_name = account["full_name"]
        row.emp_code = account["emp_code"]
        row.role = account["role"]
        row.password = account["password"]
        row.is_active = True
        return row
