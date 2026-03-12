# ============================================================
#  server.py — FastAPI Entry Point
#  รัน: uvicorn server:app --host 0.0.0.0 --port 8000 --reload
# ============================================================
import sys
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles        # serve ไฟล์ static (CSS/JS/HTML)
from fastapi.responses import FileResponse          # ส่งไฟล์ HTML กลับโดยตรง
from fastapi.middleware.cors import CORSMiddleware  # รองรับการเรียกข้ามโดเมน
from backend.utils.db import engine, Base           # SQLAlchemy engine + Base ORM
from backend.auth import route as auth              # auth router
from backend.forms import route as forms            # forms router
from backend.form_templates import route as templates  # template management router
from backend.utils.bootstrap import run_all          # startup: DB + tables + migrations + seed

# ---- Startup ทั้งหมดจัดการใน backend/utils/bootstrap/ ----
run_all(engine, Base)

# สร้าง FastAPI instance พร้อมกำหนด metadata สำหรับ Swagger docs
app = FastAPI(title="IT Asset Delivery API", version="1.0.0")

# ---- CORS Middleware ----
# อนุญาตทุก origin เพื่อให้ browser ของ frontend เรียก API ได้
# production ควรระบุ origin เฉพาะเจาะจง เช่น allow_origins=["http://localhost"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],       # อนุญาตทุก domain (dev)
    allow_credentials=True,    # รองรับ cookie/auth header
    allow_methods=["*"],       # GET, POST, PUT, PATCH, DELETE
    allow_headers=["*"],       # Authorization, Content-Type ฯลฯ
)

# ---- ลงทะเบียน API Routes ----
app.include_router(auth.router)   # /api/auth/login, /api/auth/verify
app.include_router(forms.router)  # /api/forms/...
app.include_router(templates.router)  # /api/form-templates/...


@app.get("/")
def root_page():
    # redirect root URL ไปที่ main.html (หน้า login)
    return FileResponse("templates/main.html")


@app.get("/main.html")
def main_page():
    # หน้า login — Admin และ User เลือกเข้าระบบ
    return FileResponse("templates/main.html")


@app.get("/dashboard.html")
def dashboard_page():
    # หน้าสำหรับ Admin IT — สร้าง/จัดการฟอร์ม (ต้อง login ก่อน)
    return FileResponse("templates/dashboard.html")


@app.get("/admin.html")
def admin_template_page():
    # หน้าจัดการ Template แบบฟอร์ม (Admin only)
    return FileResponse("templates/admin.html")


@app.get("/user.html")
def user_page():
    # หน้าสำหรับพนักงานรับครุภัณฑ์ — เปิดด้วย token จาก URL
    return FileResponse("templates/user.html")


@app.get("/create-form.html")
def create_form_page():
    # หน้าสร้าง/แก้ไขฟอร์ม (Admin only)
    return FileResponse("templates/create-form.html")

# ---- Serve Static Files (HTML/CSS/JS) ----
# mount หลังสุด เพื่อไม่ให้ทับ API routes ด้านบน
app.mount("/", StaticFiles(directory=".", html=True), name="static")
