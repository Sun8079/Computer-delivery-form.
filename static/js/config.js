// ============================================================
//  config.js  — ค่าคงที่ทั้งหมดของระบบ
// ============================================================
//
//  โหลดลำดับที่: 1 (โหลดก่อนทุกไฟล์)
//
//  ไฟล์นี้ประกาศค่าคงที่ (constant) ที่ใช้ร่วมกันทุกหน้า
//  ไม่มี logic ใดๆ — แก้ไขที่นี่อย่างเดียวเพื่อปรับพฤติกรรมระบบ
//
//  ประกอบด้วย:
//  ┌─────────────────────────────────────────────────────────┐
//  │  STATUS          enum สถานะฟอร์ม 4 ค่า                │
//  │  STATUS_LABEL    ชื่อภาษาไทยของสถานะ (ใช้ใน Badge)    │
//  │  STATUS_COLOR    สีประจำสถานะ (ใช้ใน stat card)        │
//  │  CATEGORY_LABEL  ชื่อ category ของ checklist           │
//  │  CHECKLIST_TEMPLATE  รายการตรวจสอบทั้งหมด 3 category  │
//  │  DELIVER_TYPES   ประเภทการส่งมอบ (dropdown)            │
//  └─────────────────────────────────────────────────────────┘
//
//  ใครใช้ไฟล์นี้:
//    models.js  → CHECKLIST_TEMPLATE (สร้าง form.checklist)
//    ui.js      → CHECKLIST_TEMPLATE, STATUS_LABEL
//    admin.js   → STATUS, CHECKLIST_TEMPLATE, DELIVER_TYPES
//    user.js    → STATUS, CHECKLIST_TEMPLATE
//
// ============================================================

// -------------------- FORM STATUS --------------------
// enum สถานะฟอร์ม — ใช้ค่าเหล่านี้เปรียบเสมอ (ห้ามใช้ string ตรงๆ)
const STATUS = {
  DRAFT:       'draft',       // แบบร่าง (ยังไม่ได้ใช้นโยบายปัจจุบัน)
  SENT:        'sent',        // Admin สร้างแล้ว — รอ User เปิด link กรอก
  USER_FILLED: 'user_filled', // User กรอกแล้ว — รอ Admin ตรวจ/ยืนยัน
  COMPLETED:   'completed',   // Admin ยืนยันแล้ว — ปิดฟอร์ม
};

// ข้อความแสดงผลภาษาไทยสำหรับแต่ละสถานะ — ใช้สร้าง badge
const STATUS_LABEL = {
  draft:       'แบบร่าง',
  sent:        'รอ User กรอก',
  user_filled: 'รอ Admin ยืนยัน',
  completed:   'เสร็จสิ้น',
};

// สีประจำแต่ละสถานะ — ใช้ใน CSS border-top ของ stat card
const STATUS_COLOR = {
  draft:       '#6b7280',  // เทา
  sent:        '#2563a8',  // น้ำเงิน
  user_filled: '#d97706',  // ส้มใส้ง (pending)
  completed:   '#059669',  // เขียว (done)
};

// -------------------- CATEGORY LABELS --------------------
// label สำหรับสร้าง section header ใน checklist
const CATEGORY_LABEL = {
  hardware: '🖥️ Hardware',
  software: '💿 Software',
  network:  '🌐 Network',
};

// -------------------- CHECKLIST TEMPLATE --------------------
// รายการตรวจสอบ — แก้ไขได้ที่นี่สำหรับปรับรายการตรวจสอบทั้งหมดโดยไม่ต้องแก้ไขโค้ดอื่น
const CHECKLIST_TEMPLATE = [
  {
    category: 'hardware',
    label: '🖥️ Hardware',
    items: [
      'CPU ทำงานปกติ ไม่มีอาการค้าง/ร้อนผิดปกติ',
      'RAM ถูกต้องตาม Spec ที่กำหนด',
      'HDD / SSD ทำงานปกติ ไม่มี Bad Sector',
      'จอภาพแสดงผลชัดเจน ไม่มีจุดดำหรือเส้น',
      'Keyboard ทำงานปกติทุกปุ่ม',
      'Mouse / Touchpad ทำงานปกติ',
      'Port USB ทำงานครบทุก Port',
      'Speaker / Headphone Jack ทำงานปกติ',
      'กล้อง / ไมโครโฟน ทำงานปกติ (ถ้ามี)',
      'แบตเตอรี่ / Power Supply ปกติ',
    ],
  },
  {
    category: 'software',
    label: '💿 Software',
    items: [
      'Windows / OS ติดตั้งเรียบร้อย และ Activate แล้ว',
      'Microsoft Office / โปรแกรมสำนักงาน',
      'Antivirus ติดตั้งและ Update แล้ว',
      'Driver ทุกตัวติดตั้งครบถ้วน',
      'โปรแกรมเฉพาะแผนก ติดตั้งเรียบร้อย',
      'Windows Update อัปเดตล่าสุด',
    ],
  },
  {
    category: 'network',
    label: '🌐 Network & Connectivity',
    items: [
      'เชื่อมต่อ Network / Intranet บริษัทได้',
      'Email ตั้งค่าและทดสอบรับ-ส่งได้',
      'VPN ตั้งค่าเรียบร้อย (ถ้าจำเป็น)',
      'Printer ตั้งค่าและทดสอบพิมพ์ได้',
    ],
  },
];

// -------------------- DELIVER TYPES --------------------
// ประเภทการส่งมอบ — Admin เลือกใน dropdown ตอนสร้างฟอร์ม
const DELIVER_TYPES = [
  { value: 'new',     label: 'เครื่องใหม่'    },
  { value: 'replace', label: 'เปลี่ยนทดแทน'  },
  { value: 'transfer',label: 'โอนย้าย'        },
  { value: 'repair',  label: 'ซ่อมแล้วคืน'   },
];
