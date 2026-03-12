# ============================================================
#  backend/utils/db.py
#  SQLAlchemy engine + session สำหรับ MySQL
#
#  ใช้ทั่วระบบ — import จากที่นี่ที่เดียว
#    from backend.utils.db import engine, Base, SessionLocal, get_db
# ============================================================
import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

load_dotenv()

DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "3306")
DB_NAME = os.getenv("DB_NAME", "it_asset")
DB_USER = os.getenv("DB_USER", "root")
DB_PASS = os.getenv("DB_PASS", "")

DATABASE_URL = f"mysql+pymysql://{DB_USER}:{DB_PASS}@{DB_HOST}:{DB_PORT}/{DB_NAME}?charset=utf8mb4"

engine = create_engine(DATABASE_URL, echo=False, pool_pre_ping=True)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    """FastAPI Dependency สำหรับ inject DB session เข้า endpoint"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def ensure_database_exists() -> None:
    """สร้าง database ถ้ายังไม่มี — เชื่อมต่อโดยไม่ระบุ DB ก่อน"""
    from sqlalchemy import create_engine, text

    root_url = (
        f"mysql+pymysql://{DB_USER}:{DB_PASS}"
        f"@{DB_HOST}:{DB_PORT}/?charset=utf8mb4"
    )
    root_engine = create_engine(root_url, pool_pre_ping=True)
    print(f"📦 Checking database '{DB_NAME}'...")
    try:
        with root_engine.connect() as conn:
            conn.execute(text(
                f"CREATE DATABASE IF NOT EXISTS `{DB_NAME}` "
                "CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
            ))
            conn.commit()
        print(f"✅ Database '{DB_NAME}' พร้อมใช้งาน")
    except Exception as e:
        print(f"❌ Database Error: {e}")
    finally:
        root_engine.dispose()
