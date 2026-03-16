"""
Repository Layer: FormRepository

หน้าที่:
- คุยกับฐานข้อมูลโดยตรงผ่าน SQLAlchemy ORM
- ไม่ทำ business rule ซับซ้อน
- รับ/คืน ORM object เพื่อให้ service layer ตัดสินใจต่อ

Flow โดยรวม:
Router -> Service -> Repository -> MySQL
"""

from datetime import datetime
from sqlalchemy.orm import Session

from ..utils import models


def form_to_dict(db_form) -> dict:
    """
    แปลง ORM Form object เป็น dict (camelCase) ที่ frontend ใช้ได้โดยตรง
    อ่านจาก flat columns แล้ว map ชื่อ snake_case → camelCase
    """
    if not db_form:
        return None
    return {
        # ---- Metadata ----
        "id":              db_form.id,
        "token":           db_form.token,
        "status":          db_form.status,
        "revision":        db_form.revision or 1,
        "lastEditNote":    db_form.last_edit_note or "",
        "lastReturnNote":  db_form.last_return_note or "",
        "updatedBy":       db_form.updated_by or "",
        "adminCreatorEmpCode": db_form.createrd_by or "",
        "editHistory":     db_form.edit_history or [],
        "createdAt":       db_form.admin_created_at.isoformat() if db_form.admin_created_at else None,
        "updatedAt":       db_form.updated_at.isoformat() if db_form.updated_at else None,
        "completedAt":     db_form.completed_at.isoformat() if db_form.completed_at else None,
        # ---- พนักงาน ----
        "empName":         db_form.emp_name or "",
        "empCode":         db_form.emp_code or "",
        "empDept":         db_form.emp_dept or "",
        "empEmail":        db_form.emp_email or "",
        # ---- ครุภัณฑ์ ----
        "assetCode":       db_form.asset_code or "",
        "assetModel":      db_form.asset_model or "",
        "assetSerial":     db_form.asset_serial or "",
        "assetSpec":       db_form.asset_spec or "",
        "deliverDate":     db_form.deliver_date or "",
        "deliverType":     db_form.deliver_type or "new",
        "location":        db_form.location or "",
        # ---- Admin ----
        "adminNote":       db_form.admin_note or "",
        "adminSig":        db_form.admin_sig,
        "adminFinalSig":   db_form.admin_final_sig,
        # ---- Checklist ----
        "checklist":       db_form.checklist or [],
        # ---- User ----
        "userSig":         db_form.user_sig,
        "userFilledAt":    db_form.user_filled_at,
        "userIssues":      db_form.user_issues or "",
        "userTestItems":   db_form.user_test_items or [],
        "userReceiveDate": db_form.user_receive_date,
    }


def _apply_form_data(db_form, form_data: dict, partial: bool = False):
    """
    เขียนค่าจาก dict (camelCase) ลง ORM object
    partial=True → อัปเดตเฉพาะ key ที่มีใน form_data (PATCH mode)
    partial=False → เขียนทับทุก field (PUT mode)
    """
    def _set(camel_key, orm_attr, default=None):
        if partial and camel_key not in form_data:
            return   # ข้ามถ้าไม่ได้ส่งมา
        # map key จาก frontend (camelCase) ไปยัง ORM attribute
        setattr(db_form, orm_attr, form_data.get(camel_key, default))

    _set("status",          "status",           "sent")
    _set("revision",        "revision",         1)
    _set("lastEditNote",    "last_edit_note",    "")
    _set("lastReturnNote",  "last_return_note",  "")
    _set("updatedBy",       "updated_by",        "")
    _set("adminCreatorEmpCode", "createrd_by", "")
    _set("editHistory",     "edit_history",      [])

    _set("empName",         "emp_name",          "")
    _set("empCode",         "emp_code",          "")
    _set("empDept",         "emp_dept",          "")
    _set("empEmail",        "emp_email",         "")

    _set("assetCode",       "asset_code",        "")
    _set("assetModel",      "asset_model",       "")
    _set("assetSerial",     "asset_serial",      "")
    _set("assetSpec",       "asset_spec",        "")
    _set("deliverDate",     "deliver_date",      "")
    _set("deliverType",     "deliver_type",      "new")
    _set("location",        "location",          "")

    _set("adminNote",       "admin_note",        "")
    _set("adminSig",        "admin_sig",         None)
    _set("adminFinalSig",   "admin_final_sig",   None)
    _set("checklist",       "checklist",         [])

    _set("userSig",         "user_sig",          None)
    _set("userFilledAt",    "user_filled_at",    None)
    _set("userIssues",      "user_issues",       "")
    _set("userTestItems",   "user_test_items",   [])
    _set("userReceiveDate", "user_receive_date", None)

    # completedAt ต้องแปลงจาก ISO string → datetime
    if not partial or "completedAt" in form_data:
        raw = form_data.get("completedAt")
        db_form.completed_at = datetime.fromisoformat(raw) if raw else None


class FormRepository:
    """รวมคำสั่งอ่าน/เขียนตาราง forms แบบ low-level"""

    @staticmethod
    def list_all(db: Session):
        # ดึงฟอร์มทั้งหมดและเรียงใหม่ไปเก่า (admin_created_at DESC)
        return db.query(models.Form).order_by(models.Form.admin_created_at.desc()).all()

    @staticmethod
    def get_by_id(db: Session, form_id: str):
        # ใช้ lookup ด้วย primary key ของฟอร์ม
        return db.query(models.Form).filter(models.Form.id == form_id).first()

    @staticmethod
    def get_by_token(db: Session, token: str):
        # สำหรับลิงก์ user แบบเก่า (token อย่างเดียว)
        return db.query(models.Form).filter(models.Form.token == token).first()

    @staticmethod
    def get_by_token_and_id(db: Session, token: str, form_id: str):
        # สำหรับลิงก์ใหม่ที่ผูก token + id เพื่อกันเปิดผิดฉบับ
        # เงื่อนไขเป็น AND ทั้งสองค่า ต้องตรงพร้อมกันเท่านั้น
        return db.query(models.Form).filter(
            models.Form.token == token,
            models.Form.id == form_id,
        ).first()

    @staticmethod
    def create(db: Session, form_data: dict):
        # สร้าง record ขั้นต้นก่อน แล้วค่อย apply field ทั้งชุด
        db_form = models.Form(
            id=form_data["id"],
            token=form_data["token"],
        )
        _apply_form_data(db_form, form_data, partial=False)
        db.add(db_form)
        db.commit()
        db.refresh(db_form)
        return db_form

    @staticmethod
    def update(db: Session, form_data: dict):
        # PUT — เขียนทับทุก field
        db_form = FormRepository.get_by_id(db, form_data["id"])
        if not db_form:
            return None
        _apply_form_data(db_form, form_data, partial=False)
        db.commit()
        db.refresh(db_form)
        return db_form

    @staticmethod
    def patch(db: Session, form_id: str, patch_data: dict):
        # PATCH — อัปเดตเฉพาะ field ที่ส่งมา
        db_form = FormRepository.get_by_id(db, form_id)
        if not db_form:
            return None
        _apply_form_data(db_form, patch_data, partial=True)
        db.commit()
        db.refresh(db_form)
        return db_form

    @staticmethod
    def delete(db: Session, form_id: str):
        # hard delete: ลบแถวออกจากฐานข้อมูลจริง
        db_form = FormRepository.get_by_id(db, form_id)
        if not db_form:
            return False
        db.delete(db_form)
        db.commit()
        return True
