// ============================================================
//  user.js  — Logic เฉพาะหน้า User (ตรวจรับครุภัณฑ์)
// ============================================================
//
//  โหลดลำดับที่: 7 (หลัง ui.js) — ใช้เฉพาะใน user.html
//
//  ⚠ User กรอกได้เฉพาะ 4 สิ่งเท่านั้น:
//    checklist.userStatus, checklist.userNote,
//    userIssues, userSig, userTestItems, userReceiveDate
//  ❌ ห้ามแตะ: empName, empCode, adminSig, checklist.adminChecked
//
//  ┌─────────────────────────────────────────────────────────┐
//  │  UserApp.form          เก็บ object ฟอร์มที่โหลดมา     │
//  │  UserApp.token         token จาก URL query param       │
//  │                                                         │
//  │  .init()               จุดเริ่มต้น — อ่าน token จาก URL  │
//  │    └→ DB.getByToken() → ตรวจ status →เรนเดอร์    │
//  │                                                         │
//  │  ._renderEmployeeLogin() หน้ายืนยันตัวตนด้วยรหัส  │
//  │  .verifyEmployee(e)    ตรวจ empCode กับข้อมูลฟอร์ม   │
//  │                                                         │
//  │  ._renderForm()        สร้างหน้ากรอกฟอร์ม           │
//  │    └→ สร้าง checklist (เฉพาะที่ adminChecked)    │
//  │    └→ สร้างปุ่ม ok/issue สำหรับแต่ละรายการ   │
//  │    └→ SigPad.init('sig-user')                          │
//  │                                                         │
//  │  .submit()             ส่งฟอร์มที่ User กรอกแล้ว        │
//  │    └→ SigPad.getData() → ได้ลายเซ็นเป็น base64       │
//  │    └→ DB.update(form) → status = 'user_filled'         │
//  │    └→ _renderDone()                                    │
//  │                                                         │
//  │  ._renderDone(t, msg)  หน้าเสร็จสิ้น                   │
//  │  ._renderError(t, msg) หน้าแสดงข้อผิดพลาด              │
//  └─────────────────────────────────────────────────────────┘
//
//  Call Flow หลัก:
//    เปิด user.html?token=XXX
//      └→ Auth.init() → (ไม่บล็อคหน้า user)
//      └→ UserApp.init() → DB.getByToken(token)
//        └→ (ยังไม่ยืนยันตัวตน) → _renderEmployeeLogin()
//          └→ User กรอกรหัส → verifyEmployee() → _renderForm()
//        └→ (ยืนยันแล้ว) → _renderForm()
//          └→ User กรอก+เซ็น → submit()
//            └→ DB.update() → status = 'user_filled' → _renderDone()
//
// ============================================================

// ========================= STATE =========================
const UserApp = {
  form:         null,      // ข้อมูลฟอร์มที่โหลดมาจาก API
  userStatuses: {},        // { key: 'ok' | 'issue' } — ยังไม่ใช้ใน version ปัจจุบัน
  token:        null,      // token จาก URL query param
  formId:       null,      // id จาก URL query param (ใช้ยืนยันฟอร์มให้ตรงฉบับ)

  // ---- โหลดฟอร์มจาก token ใน URL ----
  async init() {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');  // อ่าน ?token=XXX
    const formId = params.get('id');
    this.token = token;
    this.formId = formId;

    if (!token) {
      // ไม่มี token — แสดง error ทันที
      return this._renderError('ไม่พบ Token', 'Link ไม่ถูกต้อง กรุณาติดต่อเจ้าหน้าที่ IT');
    }

    // ถ้ามี id มาด้วย ให้ใช้ endpoint แบบเจาะจงและไม่ fallback ด้วย token-only
    // เพื่อป้องกันการเปิดฟอร์มผิดฉบับเมื่อ token ไม่ unique
    if (token && formId) {
      // ลิงก์ใหม่ต้องเปิดด้วย token+id ตรงกัน หากไม่ตรงให้ fail ทันที
      this.form = await DB.getByTokenAndId(token, formId);
      if (!this.form) {
        return this._renderError('ไม่พบฟอร์ม', 'ลิงก์นี้ไม่ตรงกับแบบฟอร์มที่ระบุ หรือข้อมูลถูกเปลี่ยนแปลง');
      }
    } else {
      // รองรับลิงก์เก่าที่ยังมีเฉพาะ token
      this.form = await DB.getByToken(token);  // fallback รองรับ link เก่า
    }

    if (!this.form) {
      return this._renderError('ไม่พบฟอร์ม', 'ไม่พบข้อมูลในระบบ หรือ Link ผิดพลาด');
    }

    // ตรวจสอบว่า User ยืนยันตัวตนแล้วใน session นี้หรือยัง
    if (!this._isUserVerified()) {
      return this._renderEmployeeLogin();
    }

    this._openFormByStatus();
  },

  _openFormByStatus() {
    if (!this.form) {
      return this._renderError('ไม่พบฟอร์ม', 'ไม่พบข้อมูลในระบบ หรือ Link ผิดพลาด');
    }
    if (this.form.status === STATUS.COMPLETED) {
      // Admin ยืนยันแล้ว — ฟอร์มปิด
      return this._renderDone('ฟอร์มนี้ปิดแล้ว', 'เจ้าหน้าที่ IT ยืนยันการรับมอบเรียบร้อยแล้ว');
    }
    if (this.form.status === STATUS.USER_FILLED) {
      // User กรอกแล้ว — รอ Admin ยืนยัน
      return this._renderDone('ส่งแบบฟอร์มแล้ว', 'คุณได้กรอกและส่งแบบฟอร์มไปแล้ว กรุณารอเจ้าหน้าที่ IT ยืนยัน');
    }

    // status = sent — เปิดหน้ากรอกฟอร์ม
    this._renderForm();
  },

  // ทำให้รหัสเป็น lowercase + trim เพื่อเปรียบเทียบไม่เคร่งแครงตัวเล็ก-ใหญ่
  _normalizeCode(v) {
    return String(v || '').trim().toLowerCase();
  },

  // key สำหรับ sessionStorage — ผูกกับ token เพื่อไม่ให้ tab อื่นเข้าได้
  _sessionKey() {
    return `user_verified_${this.token || ''}`;
  },

  _isUserVerified() {
    return sessionStorage.getItem(this._sessionKey()) === '1';
    // ใช้ sessionStorage (สิ้นสุดเมื่อปิด tab) ไม่ใช้ localStorage เพุณความปลอดภัย
  },

  _markVerified() {
    sessionStorage.setItem(this._sessionKey(), '1');  // บันทึกว่ายืนยันตัวตนแล้ว
  },

  _renderEmployeeLogin(errMsg = '') {
    const f = this.form;
    document.getElementById('app').innerHTML = `
      <div class="user-wrap">
        <div class="card" style="max-width:520px;margin:28px auto 0">
          <div class="card-header" style="background:var(--primary);color:#fff">
            <span class="card-title" style="color:#fff">🔐 ยืนยันตัวตนก่อนเข้าฟอร์ม</span>
          </div>
          <div class="card-body">
            <div style="font-size:14px;color:var(--text2);margin-bottom:14px">
              กรุณากรอก <b>รหัสพนักงาน (ชื่อผู้ใช้)</b> เพื่อเข้าใช้งานลิงก์นี้
            </div>
            <div style="font-size:12px;color:var(--text3);margin-bottom:12px">
              ผู้สร้างฟอร์ม: <span class="mono">${Utils.getFormCreatorName(f)}</span>
            </div>
            <form onsubmit="return UserApp.verifyEmployee(event)">
              <div class="form-group" style="margin-bottom:12px">
                <label for="emp-username">รหัสพนักงาน (ชื่อผู้ใช้)</label>
                <input id="emp-username" type="text" autocomplete="username" placeholder="เช่น EMP001" required>
              </div>
              ${errMsg ? `<div style="margin-bottom:12px;color:var(--danger);font-size:13px;font-weight:600">${errMsg}</div>` : ''}
              <button type="submit" class="btn btn-primary">เข้าสู่ฟอร์ม</button>
            </form>
          </div>
        </div>
      </div>
    `;
    document.getElementById('emp-username')?.focus();
  },

  verifyEmployee(event) {
    event.preventDefault();
    const inputCode = this._normalizeCode(document.getElementById('emp-username')?.value);
    const expectCode = this._normalizeCode(this.form?.empCode);  // เปลียนเป็น lowercase ก่อนเปรียบ

    if (inputCode && inputCode === expectCode) {
      this._markVerified();       // บันทึกให้ sessionStorage
      this._openFormByStatus();   // เปิดหน้าตามสถานะ
      return false;
    }

    // รหัสไม่ตรง — แสดง error message
    this._renderEmployeeLogin('ชื่อไม่ตรง โปรดติดต่อ IT');
    return false;
  },

  // ========================= RENDER FORM =========================
  _renderForm() {
    const f = this.form;
    const checklist = Array.isArray(f?.checklist) ? f.checklist : [];
    // แยกตาม owner: admin-owned ใช้อ่านอย่างเดียว, user-owned ให้ผู้ใช้กรอก
    const userOwnedItems = checklist.filter(c => c.sectionOwner === 'user');

    document.getElementById('app').innerHTML = `
      <div class="user-wrap">

        <!-- Step indicator -->
        <div class="step-strip">
          <div class="step-item">
            <div class="step-dot done">✓</div>
            <div class="step-name"><b>Admin ตรวจสอบ</b>เจ้าหน้าที่ IT</div>
          </div>
          <div class="step-line done"></div>
          <div class="step-item">
            <div class="step-dot active">2</div>
            <div class="step-name"><b>ผู้รับกรอกข้อมูล</b>คุณกำลังทำขั้นตอนนี้</div>
          </div>
          <div class="step-line"></div>
          <div class="step-item">
            <div class="step-dot">3</div>
            <div class="step-name"><b>Admin ยืนยัน</b>รอการยืนยันสุดท้าย</div>
          </div>
        </div>

        <!-- ข้อมูลฟอร์ม (read-only — Admin กรอก) -->
        <div class="card" style="margin-bottom:14px">
          <div class="card-header" style="background:var(--primary);color:#fff">
            <span class="card-title" style="color:#fff">📋 ข้อมูลการส่งมอบ</span>
            <span style="font-size:11.5px;font-family:var(--mono);opacity:.7">ผู้สร้าง: ${Utils.getFormCreatorName(f)}</span>
          </div>
          <div class="card-body">
            <div class="lock-notice">
              🔒 ข้อมูลในส่วนนี้บันทึกโดยเจ้าหน้าที่ IT ไม่สามารถแก้ไขได้
            </div>
            <div class="form-grid" style="margin-bottom:12px">
              <div class="form-group"><label>ชื่อ-นามสกุล</label><div class="field-readonly">${f.empName}</div></div>
              <div class="form-group"><label>รหัสพนักงาน</label><div class="field-readonly">${f.empCode}</div></div>
              <div class="form-group"><label>แผนก</label><div class="field-readonly">${f.empDept || '—'}</div></div>
              <div class="form-group"><label>วันที่รับ</label><div class="field-readonly">${_fmtDate(f.deliverDate)}</div></div>
            </div>
            <div class="form-grid">
              <div class="form-group"><label>รหัสครุภัณฑ์</label><div class="field-readonly">${f.assetCode}</div></div>
              <div class="form-group"><label>ยี่ห้อ / รุ่น</label><div class="field-readonly">${f.assetModel || '—'}</div></div>
              <div class="form-group span2"><label>Spec</label><div class="field-readonly">${f.assetSpec || '—'}</div></div>
            </div>
            ${f.adminNote ? `<div style="margin-top:12px"><label>หมายเหตุจากเจ้าหน้าที่ IT</label><div class="field-readonly" style="margin-top:5px">${f.adminNote}</div></div>` : ''}
            ${f.lastReturnNote ? `<div style="margin-top:12px"><label>หมายเหตุการแก้ไขจาก IT</label><div class="field-readonly" style="margin-top:5px;color:var(--danger)">⚠ ${f.lastReturnNote}</div></div>` : ''}
          </div>
        </div>

        <!-- checklist ที่ Admin เลือก (read-only) -->
        ${(() => {
          const checkedItems = checklist.filter(c => c.adminChecked);
          if (!checkedItems.length) return '';

          const catMap = new Map();
          checkedItems.forEach(c => {
            const cat = c.category || '';
            if (!catMap.has(cat)) {
              const tmplSec = CHECKLIST_TEMPLATE.find(s => s.category === cat);
              catMap.set(cat, { label: c.sectionLabel || tmplSec?.label || cat, items: [] });
            }
            catMap.get(cat).items.push(c);
          });
          const byCategory = [...catMap.values()];
          return `
          <div class="card" style="margin-bottom:14px">
            <div class="card-header">
              <span class="card-title">🔍 รายการที่เจ้าหน้าที่ IT ตรวจสอบแล้ว</span>
              <span style="font-size:11.5px;color:var(--text3)">${checkedItems.length} รายการ</span>
            </div>
            <div class="card-body">
              ${byCategory.map(sec => `
                <div style="margin-bottom:12px">
                  <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--text3);padding-bottom:5px;border-bottom:1px solid var(--border);margin-bottom:6px">${sec.label}</div>
                  ${sec.items.map(c => `
                    <div style="display:flex;gap:8px;align-items:flex-start;padding:5px 0;border-bottom:1px dashed var(--border)">
                      <span style="color:var(--success);font-size:16px;flex-shrink:0"></span>
                      <div>
                        <div style="font-size:13.5px;font-weight:500">${c.group ? `<span style="font-size:12px;color:var(--text3)">${c.group} › </span>` : ''}${c.item}</div>
                        ${c.adminNote ? `<div style="font-size:12px;color:var(--text3);margin-top:2px">📌 ผลตรวจสอบ: ${c.adminNote}</div>` : ''}
                      </div>
                    </div>
                  `).join('')}
                </div>
              `).join('')}
            </div>
          </div>
          `;
        })()}

        ${(() => {
          if (!userOwnedItems.length) return '';

          const secMap = new Map();
          userOwnedItems.forEach(c => {
            const cat = c.category || 'user_section';
            if (!secMap.has(cat)) {
              secMap.set(cat, { label: c.sectionLabel || cat, items: [] });
            }
            secMap.get(cat).items.push(c);
          });

          const sections = [...secMap.values()];
          return `
          <div class="card" style="margin-bottom:14px">
            <div class="card-header">
              <span class="card-title">🧩 ส่วนที่ผู้รับต้องกรอก</span>
              <span style="font-size:11.5px;color:var(--text3)">${userOwnedItems.length} รายการ</span>
            </div>
            <div class="card-body">
              <div class="lock-notice" style="margin-bottom:10px">
                ✅ รายการส่วนนี้เป็นหน้าที่ของผู้รับมอบโดยตรง และฝั่ง Admin จะไม่กรอกแทน
              </div>
              <div style="font-size:12px;color:var(--text3);margin-bottom:10px">
                วิธีกรอก: ติ๊กเฉพาะรายการที่ต้องการ/ใช้งาน
              </div>
              <div class="user-role-checklist">
              ${sections.map(sec => `
                <div class="cl-section">
                  <div class="cl-sect-head">${sec.label}</div>
                  ${sec.items.map(c => `
                    <div class="cl-item cl-subitem">
                      <input type="checkbox" class="cl-check" id="u-check-${c.key}" ${c.userStatus === 'ok' ? 'checked' : ''}>
                      <label for="u-check-${c.key}" class="cl-item-label">
                        ${c.item}
                      </label>
                      <input type="text" class="cl-note" id="u-note-${c.key}" placeholder="หมายเหตุเพิ่มเติม (ถ้ามี)" value="${String(c.userNote || '').replace(/&/g, '&amp;').replace(/\"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}">
                    </div>
                  `).join('')}
                </div>
              `).join('')}
              </div>
            </div>
          </div>
          `;
        })()}

        <!-- หมายเหตุ + ผู้รับมอบ + ลายเซ็น -->
        <div style="margin-bottom:20px">

          <!-- หมายเหตุ -->
          <div class="remark-box">
            <span>ผลการตรวจ :</span>
            1.สำหรับเครื่องใหม่ที่มี Storage มากกว่า 300GB จะแบ่งเป็น Driver:C 300GB ที่เหลือเป็น Driver:D<br>
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
            2."โปรแกรมพื้นฐาน"หมายถึง โปรแกรมที่มีลิขสิทธิ์ และจัดซื้ออย่างถูกต้อง
          </div>

          <!-- ตาราง -->
          <table class="receipt-table">
            <tr>
              <!-- ซ้าย: checkboxes + ลงชื่อ -->
              <td class="receipt-left">
                <div class="test-title">ผู้รับมอบทดสอบการใช้งานดังนี้</div>

                ${(() => {
                  const rawItems = Array.isArray(f.userTestItems) && f.userTestItems.length
                    ? f.userTestItems
                    : ['สามารถ Login เข้าเครื่องได้', 'สามารถใช้งานโปรแกรมพื้นฐานได้', 'สามารถเข้าใช้งาน File sharing ได้', 'อื่นๆ'];
                  return rawItems.map((label, idx) => {
                    if (label === 'อื่นๆ') {
                      return `<div class="test-other">
                        <input type="checkbox" id="test-item-${idx}">
                        <label for="test-item-${idx}">อื่นๆ</label>
                        <input type="text" id="test-item-${idx}-text" class="test-other-input" placeholder="ระบุ...">
                      </div>`;
                    }
                    return `<div class="test-item">
                      <input type="checkbox" id="test-item-${idx}">
                      <label for="test-item-${idx}">${label}</label>
                    </div>`;
                  }).join('');
                })()}

                <div style="margin-top:10px;display:flex;align-items:center;gap:8px">
                  <label style="font-size:13px;color:var(--text2)">วันที่รับมอบ</label>
                  <input type="date" id="receive-date" class="date-input">
                </div>
              </td>

              <!-- ขวา: ลายเซ็น canvas + แนบไฟล์ -->
              <td class="receipt-right">
                <div class="right-sig-area">
                  <canvas id="sig-user" class="sig-canvas-small"></canvas>
                  <div class="right-sig-label" id="sig-status-label">✏️ วาดลายเซ็นที่นี่</div>
                  <button class="sig-clear-btn" onclick="SigPad.clear('sig-user');document.getElementById('sig-status-label').textContent='✏️ วาดลายเซ็นที่นี่';document.getElementById('sig-file-upload').value='';document.getElementById('sig-file-preview').style.display='none'">ล้าง</button>
                </div>
                <div style="margin-top:8px;border-top:1px dashed var(--border);padding-top:8px">
                  <div style="font-size:11.5px;color:var(--text3);margin-bottom:4px;text-align:center">หรือแนบไฟล์ลายเซ็น</div>
                  <input type="file" id="sig-file-upload" accept="image/*" style="font-size:11.5px;width:100%"
                    onchange="
                      const f=this.files[0];
                      if(!f)return;
                      const reader=new FileReader();
                      reader.onload=e=>{
                        const prev=document.getElementById('sig-file-preview');
                        prev.src=e.target.result;
                        prev.style.display='block';
                        SigPad.clear('sig-user');
                        document.getElementById('sig-status-label').textContent='📎 ใช้ไฟล์แนบ';
                      };
                      reader.readAsDataURL(f);
                    ">
                  <img id="sig-file-preview" src="" alt="preview" style="display:none;max-width:100%;max-height:60px;margin-top:4px;border-radius:4px;border:1px solid var(--border)">
                </div>
              </td>
            </tr>
          </table>
        </div>

        <!-- Submit -->
        <div style="display:flex;justify-content:flex-end;margin-top:8px">
          <button class="btn btn-success" style="font-size:15px;padding:11px 28px"
            onclick="UserApp.submit()">📤 ส่งแบบฟอร์มให้เจ้าหน้าที่ IT</button>
        </div>

      </div>
    `;

    SigPad.reinit('sig-user');
  },

  // ========================= SUBMIT (User เท่านั้น) =========================
  async submit() {
    let sig = SigPad.getData('sig-user');

    // ถ้าไม่ได้วาด — ตรวจว่าแนบไฟล์ไว้หรือไม่
    if (!sig) {
      const fileInput = document.getElementById('sig-file-upload');
      const file = fileInput?.files?.[0];
      if (file) {
        sig = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = e => resolve(e.target.result);
          reader.readAsDataURL(file);
        });
      }
    }

    if (!sig) {
      alert('⚠️ กรุณาวาดลายเซ็นหรือแนบไฟล์ลายเซ็นก่อนส่งแบบฟอร์ม');
      document.getElementById('sig-user')?.scrollIntoView({ behavior: 'smooth' });
      return;
    }

    const receiveDate = document.getElementById('receive-date').value;
    if (!receiveDate) {
      alert('⚠️ กรุณาระบุวันที่รับมอบ');
      document.getElementById('receive-date')?.focus();
      return;
    }

    // รวบรวม checkboxes ที่ติ๊ก (dynamic จาก template)
    const _availItems = Array.isArray(this.form.userTestItems) && this.form.userTestItems.length
      ? this.form.userTestItems
      : ['สามารถ Login เข้าเครื่องได้', 'สามารถใช้งานโปรแกรมพื้นฐานได้', 'สามารถเข้าใช้งาน File sharing ได้', 'อื่นๆ'];
    const testItems = [];
    _availItems.forEach((label, idx) => {
      const cb = document.getElementById(`test-item-${idx}`);
      if (!cb?.checked) return;
      if (label === 'อื่นๆ') {
        const txt = document.getElementById(`test-item-${idx}-text`)?.value.trim();
        if (txt) testItems.push(`อื่นๆ: ${txt}`);
      } else {
        testItems.push(label);
      }
    });

    // สะท้อนค่าที่ผู้ใช้กรอกจาก user-owned sections กลับลง checklist
    const nextChecklist = Array.isArray(this.form.checklist) ? this.form.checklist.map(item => {
      if (item.sectionOwner !== 'user') return item;
      // โหมดแบบภาพตัวอย่าง: checkbox คือ "เลือกใช้งาน" เท่านั้น
      const isChecked = !!document.getElementById(`u-check-${item.key}`)?.checked;
      const note = document.getElementById(`u-note-${item.key}`)?.value.trim() || '';
      return {
        ...item,
        userStatus: isChecked ? 'ok' : null,
        userNote: note,
      };
    }) : [];

    const userOwnedTotal = nextChecklist.filter(c => c.sectionOwner === 'user').length;
    const userOwnedSelected = nextChecklist.filter(c => c.sectionOwner === 'user' && c.userStatus === 'ok').length;
    if (userOwnedTotal > 0 && userOwnedSelected === 0) {
      alert('⚠️ กรุณาติ๊กอย่างน้อย 1 รายการในส่วนที่ผู้รับต้องกรอก');
      return;
    }

    // ======================================================
    //  ⚠ เขียนเฉพาะ field ของ User เท่านั้น
    // ======================================================
    this.form.checklist      = nextChecklist;
    this.form.userSig        = sig;
    this.form.userFilledAt   = new Date().toISOString();
    this.form.userTestItems  = testItems;
    this.form.userReceiveDate = receiveDate;
    this.form.status         = STATUS.USER_FILLED;
    this.form.updatedBy      = 'user';
    this.form.updatedAt      = new Date().toISOString();
    this.form.editHistory    = Array.isArray(this.form.editHistory) ? this.form.editHistory : [];
    this.form.editHistory.push({
      at: this.form.updatedAt,
      by: 'user',
      action: 'user_submit',
      note: 'User ส่งแบบฟอร์ม',
      revision: this.form.revision || 1,
    });

    const ok = await DB.update(this.form);
    if (!ok) {
      alert('❌ บันทึกข้อมูลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
      return;
    }

    this._renderDone(
      'ส่งแบบฟอร์มเรียบร้อยแล้ว! 🎉',
      'เจ้าหน้าที่ IT จะตรวจสอบและยืนยันการรับมอบต่อไป ขอบคุณครับ/ค่ะ'
    );
  },

  // ========================= STATE PAGES =========================
  _renderDone(title, msg) {
    const f = this.form;
    const isCompleted = f && f.status === STATUS.COMPLETED;  // เสร็จสมบูรณ์ — แสดงปุ่มพิมพ์
    document.getElementById('app').innerHTML = `
      <div class="user-wrap">
        <div class="card">
          <div class="card-body done-page">
            <div class="done-icon">✅</div>
            <h2>${title}</h2>
            <p>${msg}</p>
            ${f ? `
              <div style="margin-top:20px;padding:12px 16px;background:var(--surface2);border-radius:8px;font-size:13px;color:var(--text2);display:inline-block">
                ผู้สร้างฟอร์ม: <b style="font-family:var(--mono)">${Utils.getFormCreatorName(f)}</b>
                &nbsp;|&nbsp; ครุภัณฑ์: <b>${f.assetCode}</b>
              </div>
            ` : ''}
            ${isCompleted ? `
              <div style="margin-top:20px">
                <button class="btn btn-outline" onclick="printFormById('${f.id}')" style="font-size:14px;padding:10px 24px">
                  🖨️ พิมพ์ใบรับมอบ (A4)
                </button>
              </div>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  },

  _renderError(title, msg) {
    // แสดงหน้า error เมื่อ token ผิด หรือไม่พบฟอร์ม
    document.getElementById('app').innerHTML = `
      <div class="user-wrap">
        <div class="error-page">
          <div class="big">❌</div>
          <h2>${title}</h2>
          <p>${msg}</p>
          <p style="margin-top:8px;font-size:12px;color:var(--text4)">กรุณาติดต่อเจ้าหน้าที่ IT เพื่อขอ Link ใหม่</p>
        </div>
      </div>
    `;
  },
};

// ---- helper function เฉพาะหน้า user.js (ไม่ต้องโหลด ui.js) ----
function _fmtDate(d) {
  if (window.Utils && typeof window.Utils.fmtDate === 'function') {
    return window.Utils.fmtDate(d);
  }
  if (!d) return '—';
  return new Date(d).toLocaleDateString('th-TH-u-ca-buddhist', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// ========================= INIT =========================
// เริ่มต้น app หลัง DOM โหลดเสร็จ
document.addEventListener('DOMContentLoaded', () => UserApp.init());
