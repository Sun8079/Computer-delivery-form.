# ============================================================
#  backend/utils/bootstrap/json_to_flat.py
#  One-time migration: แปลง forms.data (JSON blob) → flat columns
#
#  จะรันก็ต่อเมื่อพบคอลัมน์ `data` ยังอยู่ใน DB (DB เก่า)
#  ถ้าแปลงแล้วจะไม่รันซ้ำ (idempotent)
# ============================================================
from __future__ import annotations

TABLE = "forms"

_CHECK_SQL = (
    "SELECT COUNT(*) FROM information_schema.COLUMNS "
    "WHERE TABLE_SCHEMA = DATABASE() "
    "AND TABLE_NAME = 'forms' AND COLUMN_NAME = 'data'"
)

_ADD_COLUMNS = """
ALTER TABLE forms
  ADD COLUMN revision          INT           NOT NULL DEFAULT 1       AFTER status,
  ADD COLUMN last_edit_note    TEXT          DEFAULT NULL              AFTER revision,
  ADD COLUMN last_return_note  TEXT          DEFAULT NULL              AFTER last_edit_note,
  ADD COLUMN updated_by        VARCHAR(120)  DEFAULT NULL              AFTER last_return_note,
  ADD COLUMN edit_history      JSON          DEFAULT NULL              AFTER updated_by,
  ADD COLUMN emp_name          VARCHAR(200)  DEFAULT NULL              AFTER edit_history,
  ADD COLUMN emp_code          VARCHAR(50)   DEFAULT NULL              AFTER emp_name,
  ADD COLUMN emp_dept          VARCHAR(200)  DEFAULT NULL              AFTER emp_code,
  ADD COLUMN emp_email         VARCHAR(200)  DEFAULT NULL              AFTER emp_dept,
  ADD COLUMN asset_code        VARCHAR(50)   DEFAULT NULL              AFTER emp_email,
  ADD COLUMN asset_model       VARCHAR(200)  DEFAULT NULL              AFTER asset_code,
  ADD COLUMN asset_serial      VARCHAR(100)  DEFAULT NULL              AFTER asset_model,
  ADD COLUMN asset_spec        TEXT          DEFAULT NULL              AFTER asset_serial,
  ADD COLUMN deliver_date      VARCHAR(20)   DEFAULT NULL              AFTER asset_spec,
  ADD COLUMN deliver_type      VARCHAR(30)   DEFAULT NULL              AFTER deliver_date,
  ADD COLUMN location          VARCHAR(300)  DEFAULT NULL              AFTER deliver_type,
  ADD COLUMN admin_note        TEXT          DEFAULT NULL              AFTER location,
  ADD COLUMN admin_sig         MEDIUMTEXT    DEFAULT NULL              AFTER admin_note,
  ADD COLUMN admin_final_sig   MEDIUMTEXT    DEFAULT NULL              AFTER admin_sig,
  ADD COLUMN checklist         JSON          DEFAULT NULL              AFTER admin_final_sig,
  ADD COLUMN user_sig          MEDIUMTEXT    DEFAULT NULL              AFTER checklist,
  ADD COLUMN user_filled_at    VARCHAR(50)   DEFAULT NULL              AFTER user_sig,
  ADD COLUMN user_issues       TEXT          DEFAULT NULL              AFTER user_filled_at,
  ADD COLUMN user_test_items   JSON          DEFAULT NULL              AFTER user_issues,
  ADD COLUMN user_receive_date VARCHAR(20)   DEFAULT NULL              AFTER user_test_items,
  ADD KEY idx_emp_code (emp_code),
  ADD KEY idx_asset_code (asset_code)
"""

_COPY_DATA = """
UPDATE forms SET
  revision          = COALESCE(JSON_EXTRACT(data, '$.revision'), 1),
  last_edit_note    = JSON_UNQUOTE(JSON_EXTRACT(data, '$.lastEditNote')),
  last_return_note  = JSON_UNQUOTE(JSON_EXTRACT(data, '$.lastReturnNote')),
  updated_by        = JSON_UNQUOTE(JSON_EXTRACT(data, '$.updatedBy')),
  edit_history      = JSON_EXTRACT(data, '$.editHistory'),
  emp_name          = JSON_UNQUOTE(JSON_EXTRACT(data, '$.empName')),
  emp_code          = JSON_UNQUOTE(JSON_EXTRACT(data, '$.empCode')),
  emp_dept          = JSON_UNQUOTE(JSON_EXTRACT(data, '$.empDept')),
  emp_email         = JSON_UNQUOTE(JSON_EXTRACT(data, '$.empEmail')),
  asset_code        = JSON_UNQUOTE(JSON_EXTRACT(data, '$.assetCode')),
  asset_model       = JSON_UNQUOTE(JSON_EXTRACT(data, '$.assetModel')),
  asset_serial      = JSON_UNQUOTE(JSON_EXTRACT(data, '$.assetSerial')),
  asset_spec        = JSON_UNQUOTE(JSON_EXTRACT(data, '$.assetSpec')),
  deliver_date      = JSON_UNQUOTE(JSON_EXTRACT(data, '$.deliverDate')),
  deliver_type      = JSON_UNQUOTE(JSON_EXTRACT(data, '$.deliverType')),
  location          = JSON_UNQUOTE(JSON_EXTRACT(data, '$.location')),
  admin_note        = JSON_UNQUOTE(JSON_EXTRACT(data, '$.adminNote')),
  admin_sig         = JSON_UNQUOTE(JSON_EXTRACT(data, '$.adminSig')),
  admin_final_sig   = JSON_UNQUOTE(JSON_EXTRACT(data, '$.adminFinalSig')),
  checklist         = JSON_EXTRACT(data, '$.checklist'),
  user_sig          = JSON_UNQUOTE(JSON_EXTRACT(data, '$.userSig')),
  user_filled_at    = JSON_UNQUOTE(JSON_EXTRACT(data, '$.userFilledAt')),
  user_issues       = JSON_UNQUOTE(JSON_EXTRACT(data, '$.userIssues')),
  user_test_items   = JSON_EXTRACT(data, '$.userTestItems'),
  user_receive_date = JSON_UNQUOTE(JSON_EXTRACT(data, '$.userReceiveDate'))
"""

_CLEANUP = [
    "ALTER TABLE forms DROP COLUMN data",
    "ALTER TABLE forms CHANGE COLUMN created_at admin_created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP",
    "ALTER TABLE forms DROP INDEX idx_created_at",
    "ALTER TABLE forms ADD KEY idx_admin_created_at (admin_created_at)",
]

COLUMN_MIGRATIONS = []


def ensure_schema(conn) -> None:
    from sqlalchemy import text

    if conn.execute(text(_CHECK_SQL)).scalar() == 0:
        return

    print("🔄 พบ column data เก่า — กำลังแปลงเป็น flat columns...")
    conn.execute(text(_ADD_COLUMNS))
    conn.execute(text(_COPY_DATA))
    for stmt in _CLEANUP:
        try:
            conn.execute(text(stmt))
        except Exception:
            pass
    conn.commit()
    print("✅ แปลง JSON → flat columns เรียบร้อย")
