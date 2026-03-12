# ============================================================
#  backend/form_templates/route.py
#  Form Template CRUD endpoints — /api/form-templates
# ============================================================

from fastapi import APIRouter, HTTPException, Depends, Body
from sqlalchemy.orm import Session
from typing import Any, Dict

from ..utils.db import get_db
from ..auth.route import get_current_admin
from .service import TemplateService
from .repo import tmpl_to_dict

router = APIRouter(prefix="/api/form-templates", tags=["form-templates"])


# ---- GET /api/form-templates — รายการทั้งหมด (Admin only) ----
@router.get("")
def list_templates(db: Session = Depends(get_db), _=Depends(get_current_admin)):
    return [tmpl_to_dict(t) for t in TemplateService.list_templates(db)]


# ---- GET /api/form-templates/default — ดึง default template ----
# ต้องอยู่ก่อน /{template_id} มิฉะนั้น FastAPI ตีความ "default" เป็น id
@router.get("/default")
def get_default(db: Session = Depends(get_db), _=Depends(get_current_admin)):
    t = TemplateService.get_default(db)
    if not t:
        # ไม่มี default → คืน null ให้ frontend ใช้ built-in CHECKLIST_TEMPLATE
        return {"id": None, "name": "Default (Built-in)", "sections": None, "isDefault": True}
    return tmpl_to_dict(t)


# ---- GET /api/form-templates/{id} ----
@router.get("/{template_id}")
def get_template(template_id: int, db: Session = Depends(get_db), _=Depends(get_current_admin)):
    t = TemplateService.get_by_id(db, template_id)
    if not t:
        raise HTTPException(status_code=404, detail="ไม่พบ Template")
    return tmpl_to_dict(t)


# ---- POST /api/form-templates — สร้างใหม่ ----
@router.post("", status_code=201)
def create_template(
    data: Dict[str, Any] = Body(...),
    db: Session = Depends(get_db),
    _=Depends(get_current_admin),
):
    if not data.get("name", "").strip():
        raise HTTPException(status_code=400, detail="กรุณาระบุชื่อ Template")
    t = TemplateService.create_template(db, data)
    return tmpl_to_dict(t)


# ---- PUT /api/form-templates/{id} — แก้ไข ----
@router.put("/{template_id}")
def update_template(
    template_id: int,
    data: Dict[str, Any] = Body(...),
    db: Session = Depends(get_db),
    _=Depends(get_current_admin),
):
    t = TemplateService.update_template(db, template_id, data)
    if not t:
        raise HTTPException(status_code=404, detail="ไม่พบ Template")
    return tmpl_to_dict(t)


# ---- DELETE /api/form-templates/{id} ----
@router.delete("/{template_id}")
def delete_template(
    template_id: int,
    db: Session = Depends(get_db),
    _=Depends(get_current_admin),
):
    ok = TemplateService.delete_template(db, template_id)
    if not ok:
        raise HTTPException(status_code=404, detail="ไม่พบ Template")
    return {"ok": True}
