"""
Service Layer: TemplateService

หน้าที่:
- เป็นชั้นกลางระหว่าง Router กับ Repository
- รวม business rule เกี่ยวกับ template เช่น validate ก่อน create
- ปัจจุบัน mostly forward ไป repo แต่มีชั้นนี้ไว้รองรับ logic ที่ซับซ้อนขึ้นในอนาคต

Flow:
HTTP Request -> route.py -> TemplateService -> TemplateRepository -> DB
"""

from sqlalchemy.orm import Session
from .repo import TemplateRepository


class TemplateService:

    @staticmethod
    def list_templates(db: Session):
        return TemplateRepository.list_all(db)

    @staticmethod
    def get_by_id(db: Session, template_id: int):
        return TemplateRepository.get_by_id(db, template_id)

    @staticmethod
    def get_default(db: Session):
        return TemplateRepository.get_default(db)

    @staticmethod
    def create_template(db: Session, data: dict):
        return TemplateRepository.create(db, data)

    @staticmethod
    def update_template(db: Session, template_id: int, data: dict):
        return TemplateRepository.update(db, template_id, data)

    @staticmethod
    def delete_template(db: Session, template_id: int):
        return TemplateRepository.delete(db, template_id)
