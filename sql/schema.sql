-- ============================================================
--  schema.sql — MySQL Database Schema
--  รัน: mysql -u root -p < sql/schema.sql
-- ============================================================

-- สร้างฐานข้อมูลถ้ายังไม่มี (ป้องกัน error เมื่อรันซ้ำ)
-- utf8mb4 รองรับภาษาไทยและ emoji ครบถ้วน
CREATE DATABASE IF NOT EXISTS it_asset
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE it_asset;

-- ตาราง users — เก็บรายชื่อผู้ใช้, role และชื่อแสดงผล
CREATE TABLE IF NOT EXISTS users (
  username      VARCHAR(60)   NOT NULL,
  full_name     VARCHAR(120)  NOT NULL,
  emp_code      VARCHAR(50)   DEFAULT NULL,
  role          VARCHAR(20)   NOT NULL DEFAULT 'user',
  password      VARCHAR(120)  NOT NULL,
  is_active     TINYINT(1)    NOT NULL DEFAULT 1,
  created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME      DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (username),
  KEY idx_users_role (role),
  KEY idx_users_emp_code (emp_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ตาราง forms — เก็บข้อมูลฟอร์มส่งมอบครุภัณฑ์ทั้งหมด (flat columns ไม่ใช้ JSON blob)
CREATE TABLE IF NOT EXISTS forms (
  -- Primary Key และ Token
  id                VARCHAR(50)    NOT NULL,
  token             VARCHAR(50)    NOT NULL,

  -- สถานะและ revision
  status            VARCHAR(30)    NOT NULL DEFAULT 'sent',
  revision          INT            NOT NULL DEFAULT 1,
  template_id       INT            DEFAULT NULL,
  template_name     VARCHAR(200)   DEFAULT NULL,
  last_edit_note    TEXT           DEFAULT NULL,
  updated_by        VARCHAR(120)   DEFAULT NULL,
  edit_history      JSON           DEFAULT NULL,  -- list of {at, by, action, note}

  -- ข้อมูลพนักงาน
  emp_name          VARCHAR(200)   DEFAULT NULL,
  emp_code          VARCHAR(50)    DEFAULT NULL,
  emp_dept          VARCHAR(200)   DEFAULT NULL,
  emp_email         VARCHAR(200)   DEFAULT NULL,

  -- ข้อมูลครุภัณฑ์
  asset_code        VARCHAR(50)    DEFAULT NULL,
  asset_model       VARCHAR(200)   DEFAULT NULL,
  asset_serial      VARCHAR(100)   DEFAULT NULL,
  asset_spec        TEXT           DEFAULT NULL,
  deliver_date      VARCHAR(20)    DEFAULT NULL,  -- YYYY-MM-DD
  deliver_type      VARCHAR(30)    DEFAULT NULL,
  location          VARCHAR(300)   DEFAULT NULL,

  -- ฝั่ง Admin
  admin_note        TEXT           DEFAULT NULL,
  admin_sig         MEDIUMTEXT     DEFAULT NULL,  -- base64 PNG ลายเซ็น
  admin_final_sig   MEDIUMTEXT     DEFAULT NULL,  -- base64 PNG ลายเซ็นยืนยัน

  -- Checklist (array of objects)
  checklist         JSON           DEFAULT NULL,

  -- ฝั่ง User
  user_sig          MEDIUMTEXT     DEFAULT NULL,  -- base64 PNG ลายเซ็น User
  user_filled_at    VARCHAR(50)    DEFAULT NULL,  -- ISO timestamp
  user_issues       TEXT           DEFAULT NULL,
  user_test_items   JSON           DEFAULT NULL,  -- list of strings
  user_receive_date VARCHAR(20)    DEFAULT NULL,  -- YYYY-MM-DD

  -- Timestamps
  admin_created_at DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,  -- เวลา Admin สร้างฟอร์ม
  updated_at       DATETIME       DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  completed_at     DATETIME       DEFAULT NULL,

  PRIMARY KEY (id),
  UNIQUE KEY uq_token (token),
  KEY idx_status (status),
  KEY idx_admin_created_at (admin_created_at),
  KEY idx_emp_code (emp_code),
  KEY idx_asset_code (asset_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ตาราง form_templates — เก็บ template checklist และการตั้งค่าส่วนหัวฟอร์ม
CREATE TABLE IF NOT EXISTS form_templates (
  id              INT           NOT NULL AUTO_INCREMENT,
  name            VARCHAR(200)  NOT NULL,
  sections        JSON          NOT NULL,
  user_test_items JSON          DEFAULT NULL,
  header_fields   JSON          DEFAULT NULL,
  is_default      TINYINT(1)    NOT NULL DEFAULT 0,
  created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME      DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
