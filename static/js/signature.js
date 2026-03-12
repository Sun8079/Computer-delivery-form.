// ============================================================
//  signature.js  — Signature Pad (วาดลายเซ็นบน <canvas>)
// ============================================================
//
//  โหลดลำดับที่: 5 (หลัง db.js) — ใช้ร่วมกันทั้ง dashboard.html และ user.html
//
//  ┌─────────────────────────────────────────────────────────┐
//  │  SigPad._initialized    Setเป็น cache ป้องกัน init ซ้ำ    │
//  │                                                         │
//  │  .init(canvasId)        เริ่มต้น pad บน canvas              │
//  │    └→ รองรับทั้ง mouse และ touch (mobile)           │
//  │    └→ ส้างเส้น context 2D                              │
//  │    └→ ปรับ HiDPI (Retina) อัตโนมัติ                  │
//  │                                                         │
//  │  .clear(canvasId)       ลบลายเซ็นออก                   │
//  │    └→ ถูกเรียกจากปุ่ม "ล้าง" ใน HTML              │
//  │                                                         │
//  │  .getData(canvasId)     อ่านลายเซ็นเป็น base64 PNG     │
//  │    └→ คืน null ถ้ายังไม่ได้วาด                    │
//  │    └→ ถูกเรียกโดย admin.js / user.js ค่อน save │
//  │                                                         │
//  │  .reinit(canvasId)      re-init หลัง innerHTML render  │
//  │    └→ ใช้ใน ReviewModal เพราะ canvas เกิดใหม่   │
//  └─────────────────────────────────────────────────────────┘
//
//  Call Flow:
//    admin.js → DOMContentLoaded → SigPad.init('sig-admin-create')
//    user.js  → _renderForm()    → SigPad.init('sig-user')
//    admin.js → ReviewModal.open()→ SigPad.reinit('sig-admin-final')
//    admin.js → Adminตรวจยืนยัน  → SigPad.getData('sig-admin-final')
//    user.js  → UserApp.submit() → SigPad.getData('sig-user')
//
// ============================================================

const SigPad = {
  // เก็บ canvas ที่ init แล้ว (ป้องกัน double-init เมื่อ render HTML ใหม่)
  _initialized: new Set(),

  // ---- เริ่มต้น signature pad บน canvas ที่ระบุ ----
  init(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || this._initialized.has(canvasId)) return;  // ไม่มีหรือ init ไปแล้ว — ออก
    this._initialized.add(canvasId);

    // ปรับขนาด canvas ให้ตรงกับ pixel จริง (รองรับ Retina/HiDPI)
    // rect.width คือขนาด CSS — canvas.width คือ pixel จริง
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width  = rect.width  * dpr;
    canvas.height = rect.height * dpr;

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);         // scale context ให้ตรงกับขนาด CSS
    ctx.strokeStyle = '#0f2744'; // สีน้ำเงินเข้ม
    ctx.lineWidth   = 2;
    ctx.lineCap     = 'round';   // ปลายเส้นเป็นวงกลม
    ctx.lineJoin    = 'round';   // มุมสันเป็นวงกลม

    let drawing = false;
    let lastX   = 0;
    let lastY   = 0;

    // ---- helper: แปลง event → พิกัดบน canvas (รองรับทั้ง mouse และ touch) ----
    const getPos = (e) => {
      const r = canvas.getBoundingClientRect();
      if (e.touches && e.touches[0]) {
        // สำหรับ mobile — touches[0] คือนิ้วแรก
        return {
          x: e.touches[0].clientX - r.left,
          y: e.touches[0].clientY - r.top,
        };
      }
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };

    // ---- Mouse Events ----
    canvas.addEventListener('mousedown', (e) => {
      drawing = true;  // เริ่มวาด
      const p = getPos(e);
      lastX = p.x; lastY = p.y;
    });
    canvas.addEventListener('mousemove', (e) => {
      if (!drawing) return;  // ยังไม่กดปุ่ม — ไม่วาด
      const p = getPos(e);
      ctx.beginPath();
      ctx.moveTo(lastX, lastY);  // จุดเริ่มเส้น
      ctx.lineTo(p.x, p.y);      // จุดสิ้นเส้น
      ctx.stroke();
      lastX = p.x; lastY = p.y;  // เลื่อนจุดเริ่มใหม่
    });
    canvas.addEventListener('mouseup',    () => drawing = false);
    canvas.addEventListener('mouseleave', () => drawing = false);  // ออกจาก canvas — หยุดวาด

    // ---- Touch Events (mobile / tablet) ----
    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();  // ป้องกัน scroll ขณะวาดลายเซ็น
      drawing = true;
      const p = getPos(e);
      lastX = p.x; lastY = p.y;
    }, { passive: false });  // passive: false — ให้ preventDefault() ทำงานได้
    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();  // ป้องกันหน้า scroll ไปด้วย
      if (!drawing) return;
      const p = getPos(e);
      ctx.beginPath();
      ctx.moveTo(lastX, lastY);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      lastX = p.x; lastY = p.y;
    }, { passive: false });
    canvas.addEventListener('touchend', () => drawing = false);
  },

  // ---- ล้างลายเซ็น ----
  clear(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);  // ลบ pixel ทั้ง canvas
  },

  // ---- อ่านข้อมูลลายเซ็นเป็น base64 PNG ----
  // คืนค่า null ถ้ายังไม่ได้เซ็น
  getData(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;
    const ctx  = canvas.getContext('2d');
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    // ตรวจสอบว่ามีการวาดหรือไม่ (alpha channel > 0)
    // i += 4 คือ RGBA bytes per pixel
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] > 0) return canvas.toDataURL('image/png');  // พบ pixel ที่ไม่โปร่งใส
    }
    return null; // ว่างเปล่า
  },

  // ---- re-init หลัง DOM render ใหม่ (ใช้หลัง innerHTML) ----
  // ต้อง delete ออกจาก Set ก่อน มิฉะนั้น init() จะเชื่อว่า init แล้ว และเริ่มต้นใหม่ไม่ได้
  reinit(canvasId) {
    this._initialized.delete(canvasId);  // ผวฆ init flag ออก
    setTimeout(() => this.init(canvasId), 100);  // รอ 100ms ให้ DOM render เสร็จ
  },
};
