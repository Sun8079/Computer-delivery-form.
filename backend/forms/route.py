# ============================================================
#  backend/forms/route.py
#  Form CRUD endpoints
# ============================================================
"""
Router Layer: forms

หน้าที่:
- รับ HTTP request ที่เกี่ยวกับ /api/forms
- validate request เบื้องต้น
- ตรวจสิทธิ์ (บาง endpoint)
- เรียก service layer และแปลง response ให้ frontend

Flow:
Client -> /api/forms/... -> forms router -> FormService -> FormRepository -> DB
"""

from fastapi import APIRouter, HTTPException, Depends, Body
from sqlalchemy.orm import Session
from typing import Any, Dict
from ..utils.db import get_db
from ..auth.route import get_current_admin
from .service import FormService
from .repo import form_to_dict

router = APIRouter(prefix="/api/forms", tags=["forms"])


# ---- GET /api/forms — ดึงทั้งหมด (Admin only) ----
@router.get("")
def get_all(db: Session = Depends(get_db), _=Depends(get_current_admin)):
    # _ = admin payload (ไม่ใช้ค่า แค่บังคับ auth)
    # Depends(get_current_admin) จะ reject 401/403 ก่อนเข้าบรรทัดนี้ถ้า token ไม่ผ่าน
    forms = FormService.list_forms(db)
    return [form_to_dict(f) for f in forms]  # list comprehension แปลงทุก ORM object


# ---- GET /api/forms/stats — สถิติ (Admin only) ----
# URL นี้ต้องอยู่ก่อน /{form_id} มิฉะนั้น FastAPI จะตีความ "stats" เป็น form_id
@router.get("/stats")
def get_stats(db: Session = Depends(get_db), _=Depends(get_current_admin)):
    return FormService.get_stats(db)  # คืน dict: total, draft, sent, pending, completed


# ---- GET /api/forms/token/{token} — ดึงด้วย token (User access, ไม่ต้อง auth) ----
@router.get("/token/{token}")
def get_by_token(token: str, db: Session = Depends(get_db)):
    # User เปิด link ด้วย token — ไม่มี JWT → ไม่ต้อง Depends(get_current_admin)
    f = FormService.get_form_by_token(db, token)
    if not f:
        raise HTTPException(status_code=404, detail="ไม่พบฟอร์ม")
    return form_to_dict(f)


# ---- GET /api/forms/{id} — ดึงด้วย id (Admin only) ----
@router.get("/{form_id}")
def get_by_id(form_id: str, db: Session = Depends(get_db), _=Depends(get_current_admin)):
    f = FormService.get_form_by_id(db, form_id)
    if not f:
        raise HTTPException(status_code=404, detail="ไม่พบฟอร์ม")
    return form_to_dict(f)


# ---- POST /api/forms — สร้างฟอร์มใหม่ (Admin only) ----
@router.post("", status_code=201)  # 201 Created
def create(form_data: Dict[str, Any] = Body(...), db: Session = Depends(get_db), _=Depends(get_current_admin)):
    # ตรวจ ID ซ้ำก่อน (กันกรณี double submit)
    # ถ้ามีอยู่แล้วให้ตอบ 400 เพื่อให้ frontend แจ้งผู้ใช้ทันที
    if FormService.get_form_by_id(db, form_data["id"]):
        raise HTTPException(status_code=400, detail="Form ID ซ้ำกัน")

    f = FormService.create_form(db, form_data)
    return form_to_dict(f)


# ---- PUT /api/forms/{id} — อัปเดตทั้งหมด (User หรือ Admin) ----
# ไม่บังคับ Auth — User กรอกฟอร์มผ่าน endpoint นี้ด้วย token (ไม่มี JWT)
@router.put("/{form_id}")
def update(form_id: str, form_data: Dict[str, Any] = Body(...), db: Session = Depends(get_db)):
    # ตรวจ ID ป้องกันการแก้ไขฟอร์มข้ามกัน
    # form_id มาจาก path, form_data.id มาจาก body ต้องตรงกัน
    if form_data.get("id") != form_id:
        raise HTTPException(status_code=400, detail="ID ไม่ตรงกัน")
    f = FormService.update_form(db, form_data)
    if not f:
        raise HTTPException(status_code=404, detail="ไม่พบฟอร์ม")
    return form_to_dict(f)


# ---- PATCH /api/forms/{id} — อัปเดตบางฟิลด์ (Admin only) ----
# ใช้สำหรับ Admin ยืนยัน (ส่ง adminFinalSig + status: completed เท่านั้น)
@router.patch("/{form_id}")
def patch(form_id: str, patch_data: Dict[str, Any] = Body(...), db: Session = Depends(get_db), _=Depends(get_current_admin)):
    f = FormService.patch_form(db, form_id, patch_data)
    if not f:
        raise HTTPException(status_code=404, detail="ไม่พบฟอร์ม")
    return form_to_dict(f)


# ---- DELETE /api/forms/{id} — ลบฟอร์ม (Admin only) ----
@router.delete("/{form_id}")
def delete(form_id: str, db: Session = Depends(get_db), _=Depends(get_current_admin)):
    ok = FormService.delete_form(db, form_id)
    if not ok:
        raise HTTPException(status_code=404, detail="ไม่พบฟอร์ม")
    return {"ok": True}  # response สั้นๆ ให้ frontend เช็กผลลัพธ์
