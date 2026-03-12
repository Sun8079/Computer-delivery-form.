# Legacy compatibility wrapper.
# โค้ดใหม่ควรใช้ backend/services/form_service.py โดยตรง
from sqlalchemy.orm import Session

from .forms.service import FormService


def get_all_forms(db: Session):
    # รองรับ import เก่า: crud.get_all_forms -> FormService.list_forms
    return FormService.list_forms(db)


def get_form_by_id(db: Session, form_id: str):
    # รองรับ import เก่า
    return FormService.get_form_by_id(db, form_id)


def get_form_by_token(db: Session, token: str):
    # รองรับ import เก่า
    return FormService.get_form_by_token(db, token)


def create_form(db: Session, form_data: dict):
    # รองรับ import เก่า
    return FormService.create_form(db, form_data)


def update_form(db: Session, form_data: dict):
    # รองรับ import เก่า
    return FormService.update_form(db, form_data)


def patch_form(db: Session, form_id: str, patch_data: dict):
    # รองรับ import เก่า
    return FormService.patch_form(db, form_id, patch_data)


def delete_form(db: Session, form_id: str):
    # รองรับ import เก่า
    return FormService.delete_form(db, form_id)


def get_stats(db: Session):
    # รองรับ import เก่า
    return FormService.get_stats(db)
