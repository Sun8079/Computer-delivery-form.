// ============================================================
//  db.js  — Database Layer (เรียก FastAPI REST API)
// ============================================================
//
//  โหลดลำดับที่: 3 (หลัง models.js)
//
//  ทุกฟังก์ชันเป็น async/await — เรียก FastAPI ผ่าน fetch()
//  Admin ต้องมี JWT token (เก็บใน localStorage โดย auth.js)
//
//  ┌─────────────────────────────────────────────────────────┐
//  │  DB._headers()          สร้าง Authorization header      │
//  │                                                         │
//  │  สำหรับ Admin (ต้อง login):                            │
//  │    .getAll()            GET  /api/forms                 │
//  │    .getById(id)         GET  /api/forms/:id             │
//  │    .add(form)           POST /api/forms                 │
//  │    .update(form)        PUT  /api/forms/:id             │
//  │    .patch(id, fields)   PATCH /api/forms/:id            │
//  │    .delete(id)          DELETE /api/forms/:id           │
//  │    .getStats()          GET  /api/forms/stats           │
//  │                                                         │
//  │  สำหรับ User (ไม่ต้อง login — ใช้ token ใน URL):      │
//  │    .getByToken(token)   GET  /api/forms/token/:token    │
//  └─────────────────────────────────────────────────────────┘
//
//  Call Flow:
//    admin.js → Dashboard.render()  → DB.getAll(), DB.getStats()
//    admin.js → ViewModal.open()    → DB.getById(id)
//    admin.js → ReviewModal.open()  → DB.getById(id)
//    admin.js → AdminCreate.submit()→ DB.add(form) หรือ DB.update(form)
//    admin.js → History.render()    → DB.getAll()
//    user.js  → UserApp.init()      → DB.getByToken(token)
//    user.js  → UserApp._submit()   → DB.update(form)
//
// ============================================================

const DB = {
  _BASE: '/api',  // base path ของ API — ตรงกับ prefix ใน FastAPI router

  // ---- Authorization header (Admin เท่านั้น) ----
  // json=true → เพิ่ม Content-Type: application/json ด้วย
  _headers(json = true) {
    const token = localStorage.getItem('auth_token');  // JWT ที่ auth.js เก็บไว้
    return {
      ...(json ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),  // Bearer scheme
    };
  },

  // ---- ดึงทั้งหมด (Admin) ----
  async getAll() {
    try {
      const r = await fetch(`${this._BASE}/forms`, { headers: this._headers(false) });
      if (!r.ok) return [];  // auth fail → คืน array ว่าง (ไม่ crash UI)
      return await r.json();
    } catch { return []; }  // network error → คืน array ว่าง
  },

  // ---- ดึงด้วย id (Admin) ----
  async getById(id) {
    try {
      const r = await fetch(`${this._BASE}/forms/${id}`, { headers: this._headers(false) });
      if (!r.ok) return null;  // ไม่พบ → null
      return await r.json();
    } catch { return null; }
  },

  // ---- ดึงด้วย token (User — ไม่ต้อง auth) ----
  // ไม่ใส่ Authorization header เพราะ endpoint นี้เปิด public
  async getByToken(token) {
    try {
      const r = await fetch(`${this._BASE}/forms/token/${token}`);
      if (!r.ok) return null;
      return await r.json();
    } catch { return null; }
  },

  // ---- เพิ่มฟอร์มใหม่ (Admin) ----
  async add(form) {
    const r = await fetch(`${this._BASE}/forms`, {
      method:  'POST',
      headers: this._headers(),     // Content-Type + Authorization
      body:    JSON.stringify(form), // ส่ง form object ทั้งหมด
    });
    return r.ok ? await r.json() : null;  // คืน form ที่สร้างแล้ว หรือ null ถ้า fail
  },

  // ---- อัปเดตฟอร์มทั้งหมด (User หรือ Admin) — PUT ----
  async update(form) {
    const r = await fetch(`${this._BASE}/forms/${form.id}`, {
      method:  'PUT',
      headers: this._headers(),
      body:    JSON.stringify(form),
    });
    return r.ok;  // คืน boolean — caller ตรวจเอง
  },

  // ---- อัปเดตบางฟิลด์ (Admin) — PATCH ----
  // ใช้สำหรับ Admin ยืนยัน (adminFinalSig + status: completed)
  async patch(id, fields) {
    const r = await fetch(`${this._BASE}/forms/${id}`, {
      method:  'PATCH',
      headers: this._headers(),
      body:    JSON.stringify(fields),  // ส่งเฉพาะ field ที่ต้องการเปลี่ยน
    });
    return r.ok;
  },

  // ---- ลบฟอร์ม (Admin) ----
  async delete(id) {
    const r = await fetch(`${this._BASE}/forms/${id}`, {
      method:  'DELETE',
      headers: this._headers(false),  // ไม่ต้อง Content-Type สำหรับ DELETE
    });
    return r.ok;
  },

  // ---- สถิติ (Admin) ----
  async getStats() {
    try {
      const r = await fetch(`${this._BASE}/forms/stats`, { headers: this._headers(false) });
      if (!r.ok) return { total: 0, sent: 0, pending: 0, completed: 0 };  // fallback ถ้า auth fail
      return await r.json();
    } catch { return { total: 0, sent: 0, pending: 0, completed: 0 }; }
  },

  // ---- ไม่ใช้แล้ว (seedDemo อยู่ใน server) ----
  seedDemo() {},
};

