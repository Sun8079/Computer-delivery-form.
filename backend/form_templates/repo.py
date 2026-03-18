"""
Repository Layer: TemplateRepository

หน้าที่:
- CRUD สำหรับตาราง form_templates
- จัดการ is_default ให้มีแค่ 1 record เป็น default เสมอ
"""

from sqlalchemy.orm import Session
from ..utils import models


def tmpl_to_dict(t) -> dict:
    """แปลง ORM FormTemplate → dict (camelCase) ที่ frontend ใช้ได้"""
    if not t:
        return None
    return {
        "id":            t.id,
        "name":          t.name,
        "sections":      t.sections or [],
        "userTestItems": t.user_test_items or [],
        # ส่ง config ส่วนหัวฟอร์มให้ frontend นำไป apply ในหน้า create-form
        "headerFields":  t.header_fields or {},
        "isDefault":     bool(t.is_default),
        "createdAt":     t.created_at.isoformat() if t.created_at else None,
        "updatedAt":     t.updated_at.isoformat() if t.updated_at else None,
    }


class TemplateRepository:

    @staticmethod
    def list_all(db: Session):
        return (db.query(models.FormTemplate)
                  .order_by(models.FormTemplate.is_default.desc(),
                            models.FormTemplate.created_at.desc())
                  .all())

    @staticmethod
    def get_by_id(db: Session, template_id: int):
        return db.query(models.FormTemplate).filter(
            models.FormTemplate.id == template_id
        ).first()

    @staticmethod
    def get_default(db: Session):
        return db.query(models.FormTemplate).filter(
            models.FormTemplate.is_default == True  # noqa: E712
        ).first()

    @staticmethod
    def create(db: Session, data: dict):
        if data.get("isDefault"):
            # ล้าง default เดิมก่อนเพื่อให้มีแค่ 1 default
            db.query(models.FormTemplate).update({"is_default": False})
            db.flush()

        tmpl = models.FormTemplate(
            name=data.get("name", "Template ใหม่"),
            sections=data.get("sections", []),
            user_test_items=data.get("userTestItems", []),
            # รับ headerFields จาก request แล้วเก็บลงคอลัมน์ header_fields
            header_fields=data.get("headerFields", {}),
            is_default=bool(data.get("isDefault", False)),
        )
        db.add(tmpl)
        db.commit()
        db.refresh(tmpl)
        return tmpl

    @staticmethod
    def update(db: Session, template_id: int, data: dict):
        tmpl = db.query(models.FormTemplate).filter(
            models.FormTemplate.id == template_id
        ).first()
        if not tmpl:
            return None

        if data.get("isDefault"):
            db.query(models.FormTemplate).filter(
                models.FormTemplate.id != template_id
            ).update({"is_default": False})
            db.flush()

        tmpl.name            = data.get("name", tmpl.name)
        tmpl.sections        = data.get("sections", tmpl.sections)
        tmpl.user_test_items = data.get("userTestItems", tmpl.user_test_items)
        # อัปเดตการตั้งค่าส่วนหัวฟอร์มถ้ามีส่งมา
        tmpl.header_fields   = data.get("headerFields", tmpl.header_fields)
        tmpl.is_default      = bool(data.get("isDefault", False))
        db.commit()
        db.refresh(tmpl)
        return tmpl

    @staticmethod
    def delete(db: Session, template_id: int):
        tmpl = db.query(models.FormTemplate).filter(
            models.FormTemplate.id == template_id
        ).first()
        if not tmpl:
            return False
        db.delete(tmpl)
        db.commit()
        return True
