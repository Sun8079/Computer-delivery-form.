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
//    dashboard.js   → Dashboard.render()   → DB.getAll(), DB.getStats()
//    dashboard.js   → ViewModal.open()     → DB.getById(id)
//    dashboard.js   → ReviewModal.open()   → DB.getById(id)
//    create-form.js → AdminCreate.submit() → DB.add(form) หรือ DB.update(form)
//    dashboard.js   → History.render()     → DB.getAll()
//    user.js        → UserApp.init()       → DB.getByToken(token)
//    user.js        → UserApp.submit()     → DB.update(form)
//
// ============================================================

const DB = {
  _BASE: '/api',  // base path ของ API — ตรงกับ prefix ใน FastAPI router

  // ---- Authorization header (Admin เท่านั้น) ----
  // json=true → เพิ่ม Content-Type: application/json ด้วย
  _headers(json = true) {
    // โค้ดส่วนใหญ่ฝั่ง Admin ใช้ JWT ใน localStorage
    // ถ้า token หาย/หมดอายุ server จะตอบ 401/403 แล้ว caller เป็นคนจัดการผลลัพธ์
    const token = localStorage.getItem('auth_token');  // JWT ที่ auth.js เก็บไว้
    return {
      ...(json ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),  // Bearer scheme
    };
  },

  // ---- ดึงทั้งหมด (Admin) ----
  async getAll() {
    try {
      // ใช้ json=false เพราะ GET ไม่ต้องส่ง body
      const r = await fetch(`${this._BASE}/forms`, { headers: this._headers(false) });
      if (!r.ok) return [];  // auth fail → คืน array ว่าง (ไม่ crash UI)
      return await r.json();
    } catch { return []; }  // network error → คืน array ว่าง
  },

  // ---- ดึงด้วย id (Admin) ----
  async getById(id) {
    try {
      // endpoint นี้ใช้ใน modal/view/review ฝั่ง Admin
      const r = await fetch(`${this._BASE}/forms/${id}`, { headers: this._headers(false) });
      if (!r.ok) return null;  // ไม่พบ → null
      return await r.json();
    } catch { return null; }
  },

  // ---- ดึงด้วย token (User — ไม่ต้อง auth) ----
  // ไม่ใส่ Authorization header เพราะ endpoint นี้เปิด public
  async getByToken(token) {
    try {
      // encode token ก่อนต่อ URL path เพื่อกันอักขระพิเศษทำให้ route เพี้ยน
      const r = await fetch(`${this._BASE}/forms/token/${encodeURIComponent(token)}`);
      // ตั้งใจคืน null เมื่อหาไม่พบ เพื่อให้หน้า user แสดง error page ได้ชัดเจน
      if (!r.ok) return null;
      return await r.json();
    } catch { return null; }
  },

  // ---- ดึงด้วย token + id (User — ไม่ต้อง auth) ----
  async getByTokenAndId(token, id) {
    try {
      // endpoint แบบเจาะจง ช่วยยืนยันว่า token นี้ต้องคู่กับ form id นี้เท่านั้น
      const r = await fetch(
        `${this._BASE}/forms/token/${encodeURIComponent(token)}/form/${encodeURIComponent(id)}`
      );
      // ถ้าไม่ match จะได้ 404 → null แล้ว UI จะบอกว่า link ไม่ตรงฟอร์ม
      if (!r.ok) return null;
      return await r.json();
    } catch { return null; }
  },

  // ---- เพิ่มฟอร์มใหม่ (Admin) ----
  async add(form) {
    // ส่ง object ทั้งก้อนตาม schema ที่ FormModel.create() สร้างไว้
    const r = await fetch(`${this._BASE}/forms`, {
      method:  'POST',
      headers: this._headers(),     // Content-Type + Authorization
      body:    JSON.stringify(form), // ส่ง form object ทั้งหมด
    });
    return r.ok ? await r.json() : null;  // คืน form ที่สร้างแล้ว หรือ null ถ้า fail
  },

  // ---- อัปเดตฟอร์มทั้งหมด (User หรือ Admin) — PUT ----
  async update(form) {
    // ใช้ PUT (replace style) ดังนั้น caller ต้องส่ง object ครบถ้วน
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
    // ใช้ PATCH เมื่ออัปเดตเฉพาะบางฟิลด์ เช่น admin final confirm
    const r = await fetch(`${this._BASE}/forms/${id}`, {
      method:  'PATCH',
      headers: this._headers(),
      body:    JSON.stringify(fields),  // ส่งเฉพาะ field ที่ต้องการเปลี่ยน
    });
    return r.ok;
  },

  // ---- ลบฟอร์ม (Admin) ----
  async delete(id) {
    // ลบจริงในฐานข้อมูล (hard delete) ฝั่ง server
    const r = await fetch(`${this._BASE}/forms/${id}`, {
      method:  'DELETE',
      headers: this._headers(false),  // ไม่ต้อง Content-Type สำหรับ DELETE
    });
    return r.ok;
  },

  // ---- สถิติ (Admin) ----
  async getStats() {
    try {
      // endpoint นี้เอาไว้เติมการ์ดสถิติบน dashboard เท่านั้น
      const r = await fetch(`${this._BASE}/forms/stats`, { headers: this._headers(false) });
      if (!r.ok) return { total: 0, sent: 0, pending: 0, completed: 0 };  // fallback ถ้า auth fail
      return await r.json();
    } catch { return { total: 0, sent: 0, pending: 0, completed: 0 }; }
  },

  // ---- ไม่ใช้แล้ว (seedDemo อยู่ใน server) ----
  seedDemo() {},
};

