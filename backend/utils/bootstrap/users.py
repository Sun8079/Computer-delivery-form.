# ============================================================
#  backend/utils/bootstrap/users.py
#  DDL + Column Migrations สำหรับตาราง users
#
#  ถ้าจะเพิ่ม/แก้คอลัมน์ → แก้ที่นี่ที่เดียว
# ============================================================
from __future__ import annotations

TABLE = "users"

ENGINE_SUFFIX = (
    "ENGINE=InnoDB "
    "DEFAULT CHARSET=utf8mb4 "
    "COLLATE=utf8mb4_unicode_ci"
)

DDL = [
    f"""
    CREATE TABLE IF NOT EXISTS users (
        username    VARCHAR(60)   NOT NULL,
        full_name   VARCHAR(120)  NOT NULL,
        emp_code    VARCHAR(50)   DEFAULT NULL,
        role        VARCHAR(20)   NOT NULL DEFAULT 'user',
        password    VARCHAR(120)  NOT NULL,
        is_active   TINYINT(1)    NOT NULL DEFAULT 1,
        created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at  DATETIME      DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,

        PRIMARY KEY (username),
        KEY idx_users_role (role),
        KEY idx_users_emp_code (emp_code)
    ) {ENGINE_SUFFIX}
    """,
]

# ⚠ ถ้าเพิ่มคอลัมน์ใหม่ → ต้องเพิ่มทั้งใน DDL (บนนั้น) และ COLUMN_MIGRATIONS (ที่นี่)
COLUMN_MIGRATIONS = [
    # ตัวอย่าง:
    # (
    #     "phone",
    #     "ALTER TABLE users ADD COLUMN phone VARCHAR(20) DEFAULT NULL",
    # ),
]
