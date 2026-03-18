# ============================================================
#  backend/utils/bootstrap/forms.py
#  DDL + Column Migrations สำหรับตาราง forms
#
#  ถ้าจะเพิ่ม/แก้คอลัมน์ → แก้ที่นี่ที่เดียว
# ============================================================
from __future__ import annotations

TABLE = "forms"

ENGINE_SUFFIX = (
    "ENGINE=InnoDB "
    "DEFAULT CHARSET=utf8mb4 "
    "COLLATE=utf8mb4_unicode_ci"
)

DDL = [
    f"""
    CREATE TABLE IF NOT EXISTS forms (
        id                VARCHAR(50)    NOT NULL,
        token             VARCHAR(50)    NOT NULL,

        status            VARCHAR(30)    NOT NULL DEFAULT 'sent',
        revision          INT            NOT NULL DEFAULT 1,
        -- เก็บ template ที่ใช้ตอนสร้างฟอร์ม เพื่อแสดงย้อนหลังใน dashboard/history
        template_id       INT            DEFAULT NULL,
        template_name     VARCHAR(200)   DEFAULT NULL,
        last_edit_note    TEXT           DEFAULT NULL,
        last_return_note  TEXT           DEFAULT NULL,
        updated_by        VARCHAR(120)   DEFAULT NULL,
        createrd_by       VARCHAR(50)    DEFAULT NULL,
        edit_history      JSON           DEFAULT NULL,

        emp_name          VARCHAR(200)   DEFAULT NULL,
        emp_code          VARCHAR(50)    DEFAULT NULL,
        emp_dept          VARCHAR(200)   DEFAULT NULL,
        emp_email         VARCHAR(200)   DEFAULT NULL,

        asset_code        VARCHAR(50)    DEFAULT NULL,
        asset_model       VARCHAR(200)   DEFAULT NULL,
        asset_serial      VARCHAR(100)   DEFAULT NULL,
        asset_spec        TEXT           DEFAULT NULL,
        deliver_date      VARCHAR(20)    DEFAULT NULL,
        deliver_type      VARCHAR(30)    DEFAULT NULL,
        location          VARCHAR(300)   DEFAULT NULL,

        admin_note        TEXT           DEFAULT NULL,
        admin_sig         MEDIUMTEXT     DEFAULT NULL,
        admin_final_sig   MEDIUMTEXT     DEFAULT NULL,

        checklist         JSON           DEFAULT NULL,

        user_sig          MEDIUMTEXT     DEFAULT NULL,
        user_filled_at    VARCHAR(50)    DEFAULT NULL,
        user_issues       TEXT           DEFAULT NULL,
        user_test_items   JSON           DEFAULT NULL,
        user_receive_date VARCHAR(20)    DEFAULT NULL,

        admin_created_at  DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at        DATETIME       DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
        completed_at      DATETIME       DEFAULT NULL,

        PRIMARY KEY (id),
        UNIQUE KEY uq_token (token),
        KEY idx_status (status),
        KEY idx_admin_created_at (admin_created_at),
        KEY idx_emp_code (emp_code),
        KEY idx_asset_code (asset_code)
    ) {ENGINE_SUFFIX}
    """,
]

# ⚠ ถ้าเพิ่มคอลัมน์ใหม่ → ต้องเพิ่มทั้งใน DDL (บนนั้น) และ COLUMN_MIGRATIONS (ที่นี่)
COLUMN_MIGRATIONS = [
    (
        "template_id",
        "ALTER TABLE forms ADD COLUMN template_id INT DEFAULT NULL AFTER revision",
    ),
    (
        "template_name",
        "ALTER TABLE forms ADD COLUMN template_name VARCHAR(200) DEFAULT NULL AFTER template_id",
    ),
    (
        "last_return_note",
        "ALTER TABLE forms ADD COLUMN last_return_note TEXT DEFAULT NULL AFTER last_edit_note",
    ),
    (
        "completed_at",
        "ALTER TABLE forms ADD COLUMN completed_at DATETIME DEFAULT NULL",
    ),
    (
        "createrd_by",
        "ALTER TABLE forms ADD COLUMN createrd_by VARCHAR(50) DEFAULT NULL AFTER updated_by",
    ),
]
