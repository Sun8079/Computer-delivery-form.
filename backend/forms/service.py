"""
Service Layer: FormService

หน้าที่:
- เป็นชั้นกลางระหว่าง Router กับ Repository
- รวม business rule ที่เกี่ยวกับฟอร์ม
- ปัจจุบัน logic ยังไม่ซับซ้อน เลย mostly forward ไป repository

Flow:
HTTP Request -> Router(route.py) -> FormService -> FormRepository -> DB
"""

from sqlalchemy.orm import Session

from .repo import FormRepository


class FormService:
    """บริการฝั่งฟอร์มที่ router เรียกใช้"""

    @staticmethod
    def list_forms(db: Session):
        # ดึงรายการทั้งหมด (ใช้ใน dashboard/history)
        return FormRepository.list_all(db)

    @staticmethod
    def get_form_by_id(db: Session, form_id: str):
        # ดึงด้วย form id
        return FormRepository.get_by_id(db, form_id)

    @staticmethod
    def get_form_by_token(db: Session, token: str):
        # ดึงด้วย token สำหรับหน้า user
        return FormRepository.get_by_token(db, token)

    @staticmethod
    def create_form(db: Session, form_data: dict):
        # สร้างฟอร์มใหม่
        return FormRepository.create(db, form_data)

    @staticmethod
    def update_form(db: Session, form_data: dict):
        # อัปเดตทั้ง object (PUT)
        return FormRepository.update(db, form_data)

    @staticmethod
    def patch_form(db: Session, form_id: str, patch_data: dict):
        # อัปเดตเฉพาะบาง field (PATCH)
        return FormRepository.patch(db, form_id, patch_data)

    @staticmethod
    def delete_form(db: Session, form_id: str):
        # ลบฟอร์ม
        return FormRepository.delete(db, form_id)

    @staticmethod
    def get_stats(db: Session):
        # คำนวณสถิติจากรายการฟอร์มทั้งหมด
        # ถ้าอนาคตข้อมูลเยอะมาก ควรย้ายไป aggregate query ใน DB แทน
        forms = FormRepository.list_all(db)
        return {
            "total": len(forms),
            "draft": sum(1 for f in forms if f.status == "draft"),
            "sent": sum(1 for f in forms if f.status == "sent"),
            "pending": sum(1 for f in forms if f.status == "user_filled"),
            "completed": sum(1 for f in forms if f.status == "completed"),
        }
