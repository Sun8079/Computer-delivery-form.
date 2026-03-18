# ============================================================
#  backend/utils/models.py
#  SQLAlchemy ORM Models — ทุกตาราง
#
#  ใช้ทั่วระบบ — import จากที่นี่ที่เดียว
#    from backend.utils import models
# ============================================================
from sqlalchemy import Column, String, DateTime, JSON, Boolean, Integer, Text
from sqlalchemy.dialects.mysql import MEDIUMTEXT
from sqlalchemy.sql import func
from .db import Base


class FormTemplate(Base):
    """ตาราง form_templates"""
    __tablename__ = "form_templates"

    id              = Column(Integer, primary_key=True, autoincrement=True)
    name            = Column(String(200), nullable=False)
    sections        = Column(JSON, nullable=False, default=list)
    user_test_items = Column(JSON, nullable=True, default=list)
    is_default      = Column(Boolean, nullable=False, default=False)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())
    updated_at      = Column(DateTime(timezone=True), onupdate=func.now())


class UserAccount(Base):
    """ตาราง users"""
    __tablename__ = "users"

    username   = Column(String(60),  primary_key=True, index=True)
    full_name  = Column(String(120), nullable=False)
    emp_code   = Column(String(50),  index=True, nullable=True)
    role       = Column(String(20),  index=True, nullable=False, default="user")
    password   = Column(String(120), nullable=False)
    is_active  = Column(Boolean,     nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class Form(Base):
    """ตาราง forms"""
    __tablename__ = "forms"

    id    = Column(String(50), primary_key=True, index=True)
    token = Column(String(50), unique=True, index=True, nullable=False)

    status           = Column(String(30),  index=True, default="sent")
    revision         = Column(Integer,     default=1)
    # ระบุว่า record นี้ใช้ template ไหน (nullable เพื่อรองรับฟอร์มเก่า)
    template_id      = Column(Integer,     nullable=True)
    template_name    = Column(String(200), nullable=True)
    last_edit_note   = Column(Text,        nullable=True)
    last_return_note = Column(Text,        nullable=True)
    updated_by       = Column(String(120), nullable=True)
    createrd_by      = Column(String(50), nullable=True)
    edit_history     = Column(JSON,        nullable=True)

    emp_name  = Column(String(200), nullable=True)
    emp_code  = Column(String(50),  nullable=True)
    emp_dept  = Column(String(200), nullable=True)
    emp_email = Column(String(200), nullable=True)

    asset_code   = Column(String(50),  nullable=True)
    asset_model  = Column(String(200), nullable=True)
    asset_serial = Column(String(100), nullable=True)
    asset_spec   = Column(Text,        nullable=True)
    deliver_date = Column(String(20),  nullable=True)
    deliver_type = Column(String(30),  nullable=True)
    location     = Column(String(300), nullable=True)

    admin_note      = Column(Text,       nullable=True)
    admin_sig       = Column(MEDIUMTEXT, nullable=True)
    admin_final_sig = Column(MEDIUMTEXT, nullable=True)

    checklist = Column(JSON, nullable=True)

    user_sig          = Column(MEDIUMTEXT, nullable=True)
    user_filled_at    = Column(String(50), nullable=True)
    user_issues       = Column(Text,       nullable=True)
    user_test_items   = Column(JSON,       nullable=True)
    user_receive_date = Column(String(20), nullable=True)

    admin_created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at       = Column(DateTime(timezone=True), onupdate=func.now())
    completed_at     = Column(DateTime(timezone=True), nullable=True)
