// ============================================================
//  models.js  — โครงสร้างข้อมูลและ Utility Functions
// ============================================================
//
//  โหลดลำดับที่: 2 (หลัง config.js)
//
//  ประกอบด้วย:
//  ┌─────────────────────────────────────────────────────────┐
//  │  Utils                  ฟังก์ชันช่วยเหลือทั่วไป        │
//  │    .genId()             สร้าง ID ฟอร์ม เช่น F-LX7R2K  │
//  │    .genToken()          สร้าง token สำหรับ user link   │
//  │    .today()             วันนี้ format YYYY-MM-DD        │
//  │    .fmtDate(d)          แปลงวันที่เป็นภาษาไทย          │
//  │    .fmtDateTime(d)      แปลงวันที่+เวลาเป็นภาษาไทย     │
//  │    .getUserPageUrl(t)   สร้าง URL หน้า User + token    │
//  │                                                         │
//  │  FormModel              สร้างโครงสร้างข้อมูลฟอร์ม      │
//  │    .create(adminData)   สร้าง form object ใหม่ทั้งหมด  │
//  │    .readChecklistFromDOM() อ่าน checkbox จาก DOM       │
//  └─────────────────────────────────────────────────────────┘
//
//  Call Flow:
//    admin.js → AdminCreate.submit()
//               └→ FormModel.create(adminData)   สร้าง form object
//               └→ Utils.getUserPageUrl(token)   สร้าง link ส่ง User
//    admin.js → AdminCreate.renderChecklist()
//               └→ เสร็จแล้ว user กดบันทึก → readChecklistFromDOM()
//    ui.js    → Utils.fmtDate(), Utils.fmtDateTime()   แสดงวันที่
//
// ============================================================

// -------------------- UTILITY FUNCTIONS --------------------
const Utils = {
  _TH_DATE_LOCALE: 'th-TH-u-ca-buddhist',
  _TH_TIME_ZONE: 'Asia/Bangkok',

  _parseDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  },

  // สร้าง ID ไม่ซ้ำกันโดยใช้ timestamp แปลงเป็น base36
  genId() {
    return 'F-' + Date.now().toString(36).toUpperCase();
    // เช่น F-LX7R2K — ระบุ 'F-' นำหน้าเพื่อไม่สับสนกับ UUID
  },

  // สร้าง token สุ่ม 10 ตัวอักษร สำหรับ user link
  genToken() {
    return Math.random().toString(36).substr(2, 10).toUpperCase();
    // เช่น XK9RN2ABCD — substr(2) ตัด '0.' ผลลัพธ์ที่ Math.random() สร้าง
  },

  // วันนี้ (YYYY-MM-DD) — ใช้เป็น default ของ deliverDate
  today() {
    // ใช้ timezone ไทยเพื่อไม่ให้วันที่เลื่อนเมื่อเครื่อง client อยู่โซนเวลาอื่น
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: this._TH_TIME_ZONE,
    }).format(new Date());
  },

  // แปลงวันที่เป็นภาษาไทย เช่น "5 มเ..’ 2568"
  fmtDate(d) {
    if (!d) return '—';  // null/undefined → dash
    const date = this._parseDate(d);
    if (!date) return '—';
    return new Intl.DateTimeFormat(this._TH_DATE_LOCALE, {
      timeZone: this._TH_TIME_ZONE,
      year: 'numeric', month: 'short', day: 'numeric',
    }).format(date);
  },

  // แปลงวันที่+เวลาเป็นภาษาไทย เช่น "5 มเ..’ 2568 10:30"
  fmtDateTime(d) {
    if (!d) return '—';
    const date = this._parseDate(d);
    if (!date) return '—';
    return new Intl.DateTimeFormat(this._TH_DATE_LOCALE, {
      timeZone: this._TH_TIME_ZONE,
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
      hourCycle: 'h23',
    }).format(date);
  },

  // สร้าง URL สำหรับส่งให้ User เปิดฟอร์ม
  getUserPageUrl(token) {
    // สร้าง URL จาก origin เสมอ — ไม่ขึ้นกับหน้าที่เรียก
    return `${window.location.origin}/user.html?token=${token}`;
  },
};

// -------------------- FORM MODEL --------------------
// โครงสร้างฟอร์ม — สร้างด้วย FormModel.create()
const FormModel = {

  // สร้างฟอร์มใหม่จาก field ที่ Admin กรอก
  create(adminData) {
    const nowISO = new Date().toISOString();  // timestamp สำหรับ created/updated
    const profile = (window.Auth && typeof window.Auth.getAdminProfile === 'function')
      ? window.Auth.getAdminProfile()
      : { fullName: 'admin', empCode: '' };
    const actorLabel = profile.empCode
      ? `${profile.fullName} (${profile.empCode})`
      : profile.fullName;

    return {
      // ---- Metadata ----
      id:          Utils.genId(),    // F-XXXXXX ไม่ซ้ำกัน
      token:       Utils.genToken(), // token สำหรับ user link
      status:      STATUS.SENT,      // เริ่มด้วยสถานะ "sent" เสมอ
      createdAt:   nowISO,
      updatedAt:   nowISO,
      updatedBy:   actorLabel,
      revision:    1,                // นับรอบการแก้ไข (เพิ่มขึ้นทุกครั้งที่ Admin แก้ไข)
      lastEditNote:   adminData.lastEditNote || '',
      lastReturnNote: '',            // ใช้เมื่อ Admin ส่งกลับให้ User แก้ไข
      editHistory: [{
        at: nowISO,
        by: actorLabel,
        action: 'create',
        note: adminData.lastEditNote || 'สร้างฟอร์มใหม่',
        revision: 1,
      }],  // ประวัติการแก้ไขทั้งหมด

      // ---- ข้อมูลพนักงาน (Admin กรอก) ----
      empName:     adminData.empName     || '',
      empCode:     adminData.empCode     || '',  // รหัสพนักงาน — User ใช้ยืนยันตัวตน
      empDept:     adminData.empDept     || '',
      empEmail:    adminData.empEmail    || '',

      // ---- ข้อมูลครุภัณฑ์ (Admin กรอก) ----
      assetCode:   adminData.assetCode   || '',
      assetModel:  adminData.assetModel  || '',
      assetSerial: adminData.assetSerial || '',
      assetSpec:   adminData.assetSpec   || '',
      deliverDate: adminData.deliverDate || Utils.today(),
      deliverType: adminData.deliverType || 'new',  // new|replace|transfer|repair
      location:    adminData.location    || '',

      // ---- ส่วน Admin ----
      adminNote:      adminData.adminNote || '',
      adminSig:       adminData.adminSig  || null,  // ลายเซ็น Admin (ตรวจสอบ) base64 PNG
      adminFinalSig:  null,                          // ลายเซ็น Admin (ยืนยันสุดท้าย) — null จนกว่า complete
      completedAt:    null,

      // ---- Checklist ----
      // adminChecked, adminNote → Admin เท่านั้น
      // userStatus, userNote    → User เท่านั้น
      checklist: CHECKLIST_TEMPLATE.flatMap(sec =>
        sec.items.map((item, i) => ({
          key:          `${sec.category}_${i}`,  // key สำหรับ map กลับ DOM element
          category:     sec.category,
          item:         item,
          adminChecked: false,   // Admin ติ๊กว่าผ่านการตรวจสอบ
          adminNote:    '',      // หมายเหตุจาก Admin
          userStatus:   null,    // User กรอก: 'ok' | 'issue' | null
          userNote:     '',      // หมายเหตุจาก User
        }))
      ),

      // ---- ส่วน User (ห้าม Admin แตะ) ----
      userSig:         null,   // ลายเซ็น User base64 PNG
      userFilledAt:    null,   // เวลาที่ User submit
      userIssues:      '',     // หมายเหตุเพิ่มเติมจาก User
      userTestItems:   [],     // รายการที่ User ติ๊กทดสอบ
      userReceiveDate: null,   // วันที่รับมอบที่ User ระบุ
    };
  },

  // อ่านค่า checklist จาก DOM (ใช้ใน dashboard.html ตอนสร้างฟอร์ม)
  readChecklistFromDOM() {
    const sections = (window.AdminCreate?._currentTemplate) || CHECKLIST_TEMPLATE;
    return sections.flatMap(sec =>
      sec.items.flatMap((item, i) => {
        if (typeof item === 'string') {
          const key = `${sec.category}_${i}`;
          return [{
            key,
            category:     sec.category,
            sectionLabel: sec.label,
            item,
            adminChecked: true,  // หัวข้อหลักไม่มี checkbox — ถือว่าผ่านเสมอ
            adminNote:    document.getElementById(`note_${key}`)?.value.trim() || '',
            userStatus:   null,
            userNote:     '',
          }];
        }
        // item มี options — อ่าน checkbox จาก DOM (sub-options ยังมี checkbox)
        return item.options.map((opt, oi) => {
          const key = `${sec.category}_${i}_${oi}`;
          return {
            key,
            category:     sec.category,
            sectionLabel: sec.label,
            item:         opt,
            group:        item.label,
            adminChecked: document.getElementById(`chk_${key}`)?.checked || false,
            adminNote:    document.getElementById(`note_${key}`)?.value.trim() || '',
            userStatus:   null,
            userNote:     '',
          };
        });
      })
    );
  },
};
