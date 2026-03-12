# ============================================================
#  backend/utils/bootstrap/form_templates.py
#  DDL + Column Migrations สำหรับตาราง form_templates
#
#  ถ้าจะเพิ่ม/แก้คอลัมน์ → แก้ที่นี่ที่เดียว
# ============================================================
from __future__ import annotations

TABLE = "form_templates"

ENGINE_SUFFIX = (
    "ENGINE=InnoDB "
    "DEFAULT CHARSET=utf8mb4 "
    "COLLATE=utf8mb4_unicode_ci"
)

DDL = [
    f"""
    CREATE TABLE IF NOT EXISTS form_templates (
        id              INT           NOT NULL AUTO_INCREMENT,
        name            VARCHAR(200)  NOT NULL,
        sections        JSON          NOT NULL,
        user_test_items JSON          DEFAULT NULL,
        is_default      TINYINT(1)    NOT NULL DEFAULT 0,
        created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at      DATETIME      DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,

        PRIMARY KEY (id)
    ) {ENGINE_SUFFIX}
    """,
]

# ⚠ ถ้าเพิ่มคอลัมน์ใหม่ → ต้องเพิ่มทั้งใน DDL (บนนั้น) และ COLUMN_MIGRATIONS (ที่นี่)
COLUMN_MIGRATIONS = [
    (
        "user_test_items",
        "ALTER TABLE form_templates ADD COLUMN user_test_items JSON DEFAULT NULL AFTER sections",
    ),
    (
        "is_default",
        "ALTER TABLE form_templates ADD COLUMN is_default TINYINT(1) NOT NULL DEFAULT 0 AFTER user_test_items",
    ),
    (
        "created_at",
        "ALTER TABLE form_templates ADD COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP",
    ),
    (
        "updated_at",
        "ALTER TABLE form_templates ADD COLUMN updated_at DATETIME DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP",
    ),
]
