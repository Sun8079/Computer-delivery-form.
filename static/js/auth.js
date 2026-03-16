// ============================================================
//  auth.js  — Authentication & Session Management
// ============================================================
//
//  โหลดลำดับที่: 4 (หลัง db.js) — แต่ในทางปฏิบัติโหลดก่อนสุด
//  ทุกหน้าต้องมี auth.js และเรียก Auth.init() อัตโนมัติ
//
//  ┌─────────────────────────────────────────────────────────┐
//  │  Auth._API              '/api/auth'                     │
//  │                                                         │
//  │  .loginAdmin(event)     Admin กรอก user/pass            │
//  │    └→ POST /api/auth/login                              │
//  │    └→ เก็บ JWT ใน localStorage                         │
//  │    └→ redirect → dashboard.html                        │
//  │                                                         │
//  │  .loginUser()           User กรอก token หรือวาง URL    │
//  │    └→ redirect → user.html?token=XXX                   │
//  │                                                         │
//  │  .isAdmin()             ตรวจว่า session เป็น admin      │
//  │  .getToken()            อ่าน JWT (ส่งให้ db.js)         │
//  │  .logout()              ลบ session + redirect login     │
//  │                                                         │
//  │  .init()                เรียกอัตโนมัติทุกหน้า           │
//  │    └→ ถ้าหน้า admin: ตรวจ token กับ server             │
//  │       GET /api/auth/verify                              │
//  │    └→ ถ้าผิด role: redirect ออก                        │
//  │                                                         │
//  │  ._showError(msg)       แสดง error ใน #errorMsg        │
//  └─────────────────────────────────────────────────────────┘
//
//  Call Flow:
//    main.html       → form onsubmit → Auth.loginAdmin(event)
//    main.html       → button click  → Auth.loginUser()
//    dashboard.html  → DOMContentLoaded → Auth.init() → ตรวจสิทธิ์
//    user.html       → DOMContentLoaded → Auth.init() → (ผ่าน เพราะ page=user)
//    dashboard.html  → ปุ่มออกจากระบบ → Auth.logout()
//
// ============================================================

const Auth = {
  _API: '/api/auth',  // base URL ของ auth endpoints

  // ============================================================
  // ADMIN LOGIN
  // ============================================================
  async loginAdmin(event) {
    event.preventDefault();  // หยุดการ submit form เริ่มต้น
    const username = document.getElementById('adminUsername').value.trim();
    const password = document.getElementById('adminPassword').value;
    const btn = event.target.querySelector('button[type=submit]');
    if (btn) btn.disabled = true;  // ไม่ให้กดซ้ำระหว่างรอ

    try {
      const r = await fetch(`${this._API}/login`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ username, password }),
      });

      if (!r.ok) {
        // server ตอบกลับด้วย 4xx — แสดง error message จาก detail
        const err = await r.json().catch(() => ({}));
        this._showError(err.detail || 'รหัสผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
        return false;
      }

      const data = await r.json();
      // เก็บ JWT + role ไว้ใน localStorage สำหรับทุก request ถัดไป
      localStorage.setItem('auth_token', data.access_token);
      localStorage.setItem('auth_role',  data.role);
      localStorage.setItem('auth_username', data.username || '');
      localStorage.setItem('auth_full_name', data.full_name || data.username || '');
      localStorage.setItem('auth_emp_code', data.emp_code || '');
      window.location.href = 'dashboard.html';  // redirect ไปหน้า dashboard

    } catch (e) {
      // network error — server อาจยังไม่ได้รัน
      this._showError('ไม่สามารถเชื่อมต่อ Server ได้ กรุณาตรวจสอบว่า server รันอยู่');
    } finally {
      if (btn) btn.disabled = false;  // เปิดปุ่มเสมอ ไม่ว่าจะสำเร็จหรือไม่
    }
    return false;
  },

  // ============================================================
  // USER LOGIN VIA TOKEN
  // ============================================================
  loginUser() {
    const tokenInput = document.getElementById('userToken').value.trim();

    if (!tokenInput) {
      this._showError('กรุณากรอก Token หรือวาง Link');
      return;
    }

    // รองรับทั้งแบบกรอก token ตรงๆ และวาง URL เต็ม
    let token = tokenInput;
    let formId = '';
    try {
      const parsed = new URL(tokenInput);
      const fromURL = parsed.searchParams.get('token');  // ดึง token จาก query param
      if (fromURL) token = fromURL;
      formId = parsed.searchParams.get('id') || '';
    } catch (e) {}  // ถ้า parse URL ไม่ได้ → ใช้ tokenInput ตรงๆ

    if (!token) {
      this._showError('ไม่พบ Token ใน Link ที่กรอก กรุณาตรวจสอบอีกครั้ง');
      return;
    }

    // redirect ไป user.html พร้อม token ใน URL — ไม่ต้อง login
    // ถ้า URL ต้นทางมี id ของฟอร์มอยู่แล้ว จะส่งต่อไปด้วยเพื่อรักษาความแม่นยำ
    const query = new URLSearchParams({ token });
    if (formId) query.set('id', formId);
    window.location.href = `user.html?${query.toString()}`;
  },

  // ============================================================
  // SESSION HELPERS
  // ============================================================
  isAdmin() {
    // ตรวจทั้ง role และ token เพื่อกัน bypass
    return localStorage.getItem('auth_role') === 'admin' &&
           !!localStorage.getItem('auth_token');
  },

  getToken() {
    return localStorage.getItem('auth_token');  // JWT สำหรับส่งใน Authorization header
  },

  logout() {
    // ลบ session ออกจาก localStorage แล้ว redirect ไปหน้า login
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_role');
    localStorage.removeItem('auth_username');
    localStorage.removeItem('auth_full_name');
    localStorage.removeItem('auth_emp_code');
    window.location.href = 'main.html';
  },

  getAdminProfile() {
    return {
      username: localStorage.getItem('auth_username') || '',
      fullName: localStorage.getItem('auth_full_name') || 'admin',
      empCode: localStorage.getItem('auth_emp_code') || '',
      role: localStorage.getItem('auth_role') || '',
    };
  },

  _renderAdminChip(name) {
    const chip = document.getElementById('adminRoleChip');
    if (!chip) return;
    // ถ้า chip มี data-prefix ให้ใช้ prefix นั้น (เช่น ⚙️) มิฉะนั้นใช้ 👤
    const prefix = chip.dataset.prefix || '👤';
    chip.textContent = `${prefix} ${name || 'ADMIN'}`;
  },

  // ============================================================
  // INIT — ป้องกัน route ที่ไม่ได้รับอนุญาต
  // ============================================================
  async init() {
    // อ่าน data-page attribute จาก <body data-page="..."> เพื่อรู้ว่าอยู่หน้าไหน
    const page = document.body?.getAttribute('data-page');

    if (page === 'login') {
      // ถ้าล็อกอยู่แล้ว → ไม่ต้องมาหน้า login
      if (this.isAdmin()) window.location.href = 'dashboard.html';
      return;
    }

    const adminPages = ['dashboard', 'create-form', 'admin'];
    if (adminPages.includes(page)) {
      // ถ้าไม่มี token → redirect ออก
      if (!this.isAdmin()) {
        window.location.href = 'main.html';
        return;
      }

      // แสดงชื่อจาก session ทันที (ก่อน verify)
      this._renderAdminChip(this.getAdminProfile().fullName);

      // ตรวจสอบ token กับ server — ที่เหลืออายุหรือถูกเปลี่ยนจะถูก logout
      try {
        const r = await fetch(`${this._API}/verify`, {
          headers: { 'Authorization': `Bearer ${this.getToken()}` },
        });
        if (!r.ok) {
          this.logout();  // token ใช้ไม่ได้แล้ว → logout
          return;
        }

        const data = await r.json().catch(() => ({}));
        if (data.full_name || data.username) {
          const fullName = data.full_name || data.username;
          localStorage.setItem('auth_full_name', fullName);
          if (data.username) localStorage.setItem('auth_username', data.username);
          if (data.emp_code) localStorage.setItem('auth_emp_code', data.emp_code);
          this._renderAdminChip(fullName);
        }
      } catch (_) { /* server อาจยังไม่พร้อม — allow ไปก่อน */ }
    }
  },

  // ============================================================
  // UI HELPER
  // ============================================================
  _showError(message) {
    const el = document.getElementById('errorMsg');
    if (el) {
      el.textContent = message;
      el.classList.add('show');  // CSS แสดง error div
      setTimeout(() => el.classList.remove('show'), 4000);  // ซ่อนหลัง 4 วินาที
    }
  },
};

// เรียก Auth.init() ทันทีเมื่อ DOM พร้อม (หรือรอเกิด event ถ้ายังโหลดไม่เสร็จ)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => Auth.init());
} else {
  Auth.init();  // DOM โหลดเสร็จแล้ว — เรียกได้เลย
}

