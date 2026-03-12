# ============================================================
#  backend/utils/bootstrap/__init__.py
#  จุดเดียวที่ app.py เรียก — จัดการ startup ทั้งหมด
#
#  ลำดับการทำงาน:
#    1. สร้าง database ถ้ายังไม่มี    → database.py
#    2. สร้างตารางใหม่                → Base.metadata.create_all
#    3. One-time migration เก่า       → json_to_flat.py
#    4. เพิ่มคอลัมน์ที่ขาดใน DB เก่า → */COLUMN_MIGRATIONS
#    5. Seed ข้อมูลเริ่มต้น           → accounts.py
#
#  ถ้าจะเพิ่ม/ลบคอลัมน์ → แก้เฉพาะไฟล์ของตารางนั้น ไม่ต้องแตะไฟล์อื่น
# ============================================================
from __future__ import annotations
from sqlalchemy import text
from . import form_templates, forms, users, accounts, json_to_flat
from ..db import ensure_database_exists
# IMPORTANT: import models ให้ metadata รู้จักทุกตารางก่อนเรียก create_all
from .. import models  # noqa: F401 — ต้อง import ก่อน create_all จะได้เห็น ORM models ทั้งหมด

_TABLE_MODULES = (form_templates, forms, users)


def _safe_execute(conn, sql: str, label: str = "") -> None:
    try:
        conn.execute(text(sql))
    except Exception as e:
        print(f"⚠️ SQL Warning [{label}]: {e}")


def run_all(engine, Base) -> None:
    """เรียกครั้งเดียวตอน startup — ครอบคลุม setup ทั้งหมด"""

    # 1. สร้าง database ถ้ายังไม่มี
    ensure_database_exists()

    # 2. สร้างตารางใหม่ที่ยังไม่มีใน DB
    print("🗄️  Checking tables...")
    Base.metadata.create_all(engine)
    print("✅ Tables ready")

    with engine.connect() as conn:

        # 3. One-time migration: JSON blob → flat columns (สำหรับ DB เก่ามาก)
        json_to_flat.ensure_schema(conn)

        # 4. เพิ่มคอลัมน์ที่ขาดหายใน DB เก่า
        # วนเช็คจาก information_schema เพื่อให้ migration เป็นแบบ idempotent
        for mod in _TABLE_MODULES:
            for column, ddl in mod.COLUMN_MIGRATIONS:
                row = conn.execute(text(
                    "SELECT COUNT(*) FROM information_schema.COLUMNS "
                    "WHERE TABLE_SCHEMA = DATABASE() "
                    "AND TABLE_NAME = :t AND COLUMN_NAME = :c"
                ), {"t": mod.TABLE, "c": column})
                if row.scalar() == 0:
                    _safe_execute(conn, ddl, f"{mod.TABLE}.{column}")
                    conn.commit()
                    print(f"✅ เพิ่มคอลัมน์ {mod.TABLE}.{column}")

    # 5. Seed ข้อมูลเริ่มต้น
    accounts.ensure_schema()
