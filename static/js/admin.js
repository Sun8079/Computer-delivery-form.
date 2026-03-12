

function getAdminActorLabel() {
  const profile = (window.Auth && typeof window.Auth.getAdminProfile === 'function')
    ? window.Auth.getAdminProfile()
    : { fullName: 'admin', empCode: '' };
  return profile.empCode ? `${profile.fullName} (${profile.empCode})` : profile.fullName;
}

// ========================= PAGE NAVIGATION =========================
const Page = {
  _tabs: ['dashboard', 'create', 'history'],  // ลำดับ tab ตรงกับ index ใน .nav-tab

  async show(name) {
    // ซ่อนทุก page และ nav-tab ออกก่อน
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-tab').forEach((t, i) => {
      t.classList.toggle('active', this._tabs[i] === name);  // highlight tab ที่ตรงกัน
    });
    document.getElementById(`page-${name}`)?.classList.add('active');  // แสดง page ใหม่

    // โหลดข้อมูลตามหน้าที่เลือก
    if (name === 'dashboard') await Dashboard.render();
    if (name === 'history')   await History.render();
    if (name === 'create')    await AdminCreate.reset();  // ล้างฟอร์มและโหลด template
  },
};

// ========================= DASHBOARD =========================
const Dashboard = {
  async render() {
    await this._renderStats();
    await this._renderTable();
  },

  async _renderStats() {
    const s = await DB.getStats();
    const items = [
      { n: s.total,     l: 'ฟอร์มทั้งหมด',   c: 'var(--primary-lt)' },
      { n: s.sent,      l: 'รอ User กรอก',     c: 'var(--primary-lt)' },
      { n: s.pending,   l: 'รอ Admin ยืนยัน',  c: 'var(--warning)'    },
      { n: s.completed, l: 'เสร็จสิ้น',        c: 'var(--success)'    },
    ];
    document.getElementById('statsGrid').innerHTML = items.map(i =>
      `<div class="stat-card" style="border-top-color:${i.c}">
        <div class="stat-num" style="color:${i.c}">${i.n}</div>
        <div class="stat-label">${i.l}</div>
      </div>`
    ).join('');
  },

  async _renderTable() {
    const tbody = document.getElementById('dashTable');
    const forms = (await DB.getAll()).slice(0, 10);
    if (!forms.length) {
      tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><div class="icon">📭</div><p>ยังไม่มีฟอร์ม</p></div></td></tr>`;
      return;
    }
    tbody.innerHTML = forms.map(f => `
      <tr>
        <td><span class="mono" style="color:var(--primary-lt)">${f.id}</span></td>
        <td><b>${f.empName}</b></td>
        <td><span class="mono">${f.empCode}</span></td>
        <td>${f.empDept || '—'}</td>
        <td>${f.assetCode}<br><small class="text-muted">${f.assetModel || ''}</small></td>
        <td>${renderBadge(f.status)}</td>
        <td style="white-space:nowrap">${Utils.fmtDate(f.createdAt)}</td>
        <td>${this._actionBtns(f)}</td>
      </tr>
    `).join('');
  },

  _actionBtns(f) {
    let b = `<button class="btn btn-outline btn-sm" onclick="ViewModal.open('${f.id}')">👁 ดู</button> `;
    b += `<button class="btn btn-outline btn-sm" onclick="AdminCreate.editExisting('${f.id}')">✏️ แก้ไข</button> `;
    if (f.status === STATUS.SENT) {
      b += `<button class="btn btn-outline btn-sm" onclick="AdminCreate.copyExistingLink('${f.id}')">🔗 Link</button> `;
    }
    if (f.status === STATUS.USER_FILLED) {
      b += `<button class="btn btn-primary btn-sm" onclick="ReviewModal.open('${f.id}')">✅ ตรวจ/ยืนยัน</button> `;
    }
    if (f.status === STATUS.COMPLETED) {
      b += `<button class="btn btn-outline btn-sm" onclick="printFormById('${f.id}')">🖨️</button>`;
    }
    return b;
  },
};

// ========================= HISTORY =========================
const History = {
  async render() {
    // อ่านค่า filter จาก input fields (ถ้าไม่มี → ใช้ default ว่าง)
    const q  = document.getElementById('hSearch')?.value.toLowerCase() || '';
    const st = document.getElementById('hStatus')?.value || '';
    const all = await DB.getAll();  // ดึงทั้งหมด (ไม่ limit 10 เหมือน dashboard)
    const filtered = all.filter(f => {
      // ค้นในหลาย field พร้อมกัน
      const match = !q || [f.empName, f.empCode, f.assetCode, f.id]
        .some(v => v?.toLowerCase().includes(q));
      return match && (!st || f.status === st);  // กรองสถานะด้วย
    });

    const tbody = document.getElementById('histTable');
    if (!filtered.length) {
      tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state"><div class="icon">🔍</div><p>ไม่พบฟอร์มที่ค้นหา</p></div></td></tr>`;
      return;
    }
    tbody.innerHTML = filtered.map(f => `
      <tr>
        <td><span class="mono" style="color:var(--primary-lt)">${f.id}</span></td>
        <td><b>${f.empName}</b></td>
        <td><span class="mono">${f.empCode}</span></td>
        <td>${f.empDept || '—'}</td>
        <td>${f.assetCode}<br><small class="text-muted">${f.assetModel || ''}</small></td>
        <td>${renderBadge(f.status)}</td>
        <td style="white-space:nowrap">${Utils.fmtDate(f.createdAt)}</td>
        <td style="white-space:nowrap">${Utils.fmtDate(f.completedAt)}</td>
        <td>${Dashboard._actionBtns(f)}</td>
      </tr>
    `).join('');
  },
};

// ========================= CREATE FORM (Admin Only) =========================
const AdminCreate = {
  _currentLink: '',
  _editingId: null,
  _loadedForm: null,
  _employeeLookupBound: false,
  _currentTemplate: null,      // sections ของ template ที่เลือกไว้ (null = ใช้ default)
  _currentUserTestItems: null, // user test items ของ template (null = ใช้ default)

  _getEmployees() {
    if (typeof EMPLOYEES !== 'undefined' && Array.isArray(EMPLOYEES)) {
      return EMPLOYEES;
    }
    if (Array.isArray(window.EMPLOYEES)) {
      return window.EMPLOYEES;
    }
    return [];
  },

  _findEmployeeByCode(code) {
    const normalized = String(code || '').trim().toUpperCase();
    if (!normalized) return null;
    return this._getEmployees().find(emp => emp.code === normalized) || null;
  },

  _findEmployeeByName(name) {
    const normalized = String(name || '').trim().toLowerCase();
    if (!normalized) return null;
    const employees = this._getEmployees();
    return employees.find(emp => String(emp.fullName || '').trim().toLowerCase() === normalized)
      || employees.find(emp => String(emp.fullName || '').toLowerCase().includes(normalized))
      || null;
  },

  _fillEmployeeFields(emp) {
    if (!emp) return;
    const codeInput = document.getElementById('c-code');
    const nameInput = document.getElementById('c-name');
    const deptInput = document.getElementById('c-dept');

    if (codeInput) codeInput.value = emp.code;
    if (nameInput) nameInput.value = emp.fullName;
    if (deptInput) deptInput.value = `${emp.department} (${emp.company})`;
  },

  _bindEmployeeLookup() {
    if (this._employeeLookupBound) return;

    const codeInput = document.getElementById('c-code');
    const nameInput = document.getElementById('c-name');
    const deptInput = document.getElementById('c-dept');
    const dataList = document.getElementById('employeeCodeList');
    const nameList = document.getElementById('employeeNameList');

    if (!codeInput || !nameInput || !deptInput) return;

    const employees = this._getEmployees();

    if (dataList && employees.length) {
      dataList.innerHTML = employees.map(emp => (
        `<option value="${emp.code}">${emp.fullName} (${emp.department} - ${emp.company})</option>`
      )).join('');
    }

    if (nameList && employees.length) {
      nameList.innerHTML = employees.map(emp => (
        `<option value="${emp.fullName}">${emp.code} (${emp.department} - ${emp.company})</option>`
      )).join('');
    }

    const applyByCode = () => {
      const code = codeInput.value.trim().toUpperCase();
      if (!code) return;

      const emp = this._findEmployeeByCode(code);
      if (!emp) return;

      this._fillEmployeeFields(emp);
    };

    const applyByName = () => {
      const name = nameInput.value.trim();
      if (!name) return;

      const emp = this._findEmployeeByName(name);
      if (!emp) return;

      this._fillEmployeeFields(emp);
    };

    codeInput.addEventListener('change', applyByCode);
    codeInput.addEventListener('blur', applyByCode);
    codeInput.addEventListener('input', applyByCode);
    nameInput.addEventListener('change', applyByName);
    nameInput.addEventListener('blur', applyByName);
    nameInput.addEventListener('input', applyByName);

    this._employeeLookupBound = true;
  },

  // render checklist items สำหรับ Admin กรอก
  // ถ้ามี this._currentTemplate ใช้ sections นั้นแทน CHECKLIST_TEMPLATE จาก config.js
  renderChecklist() {
    const sections = this._currentTemplate || CHECKLIST_TEMPLATE;
    document.getElementById('adminChecklist').innerHTML =
      sections.map(sec => `
        <div class="cl-section">
          <div class="cl-sect-head">${sec.label}</div>
          ${sec.items.map((item, i) => {
            if (typeof item === 'string') {
              const k = `${sec.category}_${i}`;
              return `
                <div class="cl-item">
                  <span class="cl-item-label">${item}</span>
                  <input type="text" class="cl-note" id="note_${k}" placeholder="ผลตรวจ ">
                </div>
              `;
            }
            // item มี sub-options: {label, options: []} — ยังคง checkbox ให้ admin เลือก
            return `
              <div class="cl-group">
                <div class="cl-group-label">${item.label}</div>
                ${item.options.map((opt, oi) => {
                  const k = `${sec.category}_${i}_${oi}`;
                  return `
                    <div class="cl-item cl-subitem">
                      <input type="checkbox" class="cl-check" id="chk_${k}" data-key="${k}">
                      <label for="chk_${k}" class="cl-item-label">${opt}</label>
                      <input type="text" class="cl-note" id="note_${k}" placeholder="ผลตรวจ ">
                    </div>
                  `;
                }).join('')}
              </div>
            `;
          }).join('')}
        </div>
      `).join('');
  },

  // โหลด template จาก API และเติม dropdown selector
  async loadTemplates() {
    const sel = document.getElementById('c-template');
    if (!sel) return;
    try {
      const r = await fetch('/api/form-templates', {
        headers: { 'Authorization': `Bearer ${Auth.getToken()}` },
      });
      if (!r.ok) return;
      const templates = await r.json();
      sel.innerHTML = '<option value="">⬛ Default (มาตรฐานระบบ)</option>' +
        templates.map(t =>
          `<option value="${t.id}"${t.isDefault ? ' selected' : ''}>${t.name}${t.isDefault ? ' ⭐' : ''}</option>`
        ).join('');
      // ถ้ากลับมาจากหน้า template manager ให้เลือก template ที่เพิ่งบันทึก
      const pendingId = localStorage.getItem('dashboard_select_template');
      if (pendingId) {
        localStorage.removeItem('dashboard_select_template');
        sel.value = pendingId;
      }
      // ถ้ามี template ที่เลือกอยู่ (default หรือ template ที่เพิ่งบันทึก) ให้โหลดอัตโนมัติ
      if (sel.value) await this.onTemplateChange();
    } catch (_) { /* ไม่มี template ในระบบ — ใช้ built-in */ }
  },

  // เมื่อเลือก template อื่นจาก dropdown
  async onTemplateChange() {
    const id = document.getElementById('c-template')?.value;
    if (!id) {
      this._currentTemplate = null;
      this._currentUserTestItems = null;
      this.renderChecklist();
      return;
    }
    try {
      const r = await fetch(`/api/form-templates/${id}`, {
        headers: { 'Authorization': `Bearer ${Auth.getToken()}` },
      });
      if (!r.ok) return;
      const tmpl = await r.json();
      this._currentTemplate = tmpl.sections?.length ? tmpl.sections : null;
      this._currentUserTestItems = tmpl.userTestItems?.length ? tmpl.userTestItems : null;
      this.renderChecklist();
    } catch (_) { /* ใช้ default */ }
  },

  // ล้างฟอร์มและ reinit signature
  async reset() {
    this._bindEmployeeLookup();

    const fields = ['c-name','c-code','c-dept','c-email','c-asset','c-model','c-serial','c-spec','c-loc','c-note','c-edit-note'];
    fields.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    document.getElementById('c-date').value = Utils.today();
    document.getElementById('c-type').value = 'new';
    this._editingId = null;
    this._loadedForm = null;
    this._currentTemplate = null;
    this._currentUserTestItems = null;
    const editBox = document.getElementById('editModeBox');
    if (editBox) editBox.style.display = 'none';
    this._setEditNoteVisibility(false);
    const submitBtn = document.getElementById('btnCreateSubmit');
    if (submitBtn) submitBtn.textContent = '💾 บันทึกและสร้าง Link →';
    await this.loadTemplates();  // โหลด template และ render checklist แบบที่เลือกไว้
    // ถ้าไม่มี template ในระบบ (sel.value ว่าง) ให้รัน renderChecklist ด้วย built-in
    if (!document.getElementById('c-template')?.value) this.renderChecklist();
    SigPad.reinit('sig-admin-create');
  },

  _setEditNoteVisibility(show) {
    const editNoteGroup = document.getElementById('c-edit-note-group');
    const editNoteInput = document.getElementById('c-edit-note');
    if (editNoteGroup) editNoteGroup.style.display = show ? 'block' : 'none';
    if (!show && editNoteInput) editNoteInput.value = '';
  },

  _appendHistory(form, action, note) {
    const nowISO = new Date().toISOString();
    const actor = getAdminActorLabel();
    const history = Array.isArray(form.editHistory) ? form.editHistory : [];  // ป้องกัน null
    history.push({
      at: nowISO,
      by: actor,
      action,     // 'create' | 'edit_and_resend' | 'return_to_user'
      note: note || '',
      revision: form.revision || 1,
    });
    form.editHistory = history;
    form.updatedAt = nowISO;   // อัปเดต timestamp
    form.updatedBy = actor;    // ระบุว่า admin คนไหนเป็นคนแก้ล่าสุด
  },

  _applyFormToEditor(f) {
    document.getElementById('c-name').value   = f.empName || '';
    document.getElementById('c-code').value   = f.empCode || '';
    document.getElementById('c-dept').value   = f.empDept || '';
    document.getElementById('c-email').value  = f.empEmail || '';
    document.getElementById('c-asset').value  = f.assetCode || '';
    document.getElementById('c-model').value  = f.assetModel || '';
    document.getElementById('c-serial').value = f.assetSerial || '';
    document.getElementById('c-spec').value   = f.assetSpec || '';
    document.getElementById('c-date').value   = f.deliverDate || Utils.today();
    document.getElementById('c-type').value   = f.deliverType || 'new';
    document.getElementById('c-loc').value    = f.location || '';
    document.getElementById('c-note').value   = f.adminNote || '';
    document.getElementById('c-edit-note').value = '';

    this.renderChecklist();
    const checklist = Array.isArray(f.checklist) ? f.checklist : [];
    checklist.forEach(c => {
      const chk = document.getElementById(`chk_${c.key}`);
      const note = document.getElementById(`note_${c.key}`);
      if (chk) chk.checked = !!c.adminChecked;  // เฉพาะ sub-option items ที่ยังมี checkbox
      if (note) note.value = c.adminNote || '';
    });

    const editBox = document.getElementById('editModeBox');
    const editIdEl = document.getElementById('editModeFormId');
    if (editBox) editBox.style.display = 'block';
    if (editIdEl) editIdEl.textContent = f.id;
    this._setEditNoteVisibility(true);

    const submitBtn = document.getElementById('btnCreateSubmit');
    if (submitBtn) submitBtn.textContent = '💾 บันทึกการแก้ไขและส่งกลับ User →';

    SigPad.reinit('sig-admin-create');
  },

  // ปุ่มยกเลิก: ถ้าอยู่โหมดแก้ไขให้คืนค่าเดิม, ถ้าโหมดสร้างใหม่ให้ล้างฟอร์ม
  cancel() {
    if (this._editingId && this._loadedForm) {
      this._applyFormToEditor(this._loadedForm);
      return;
    }
    this.reset();
  },

  async editExisting(id) {
    const f = await DB.getById(id);
    if (!f) {
      alert('ไม่พบฟอร์มที่ต้องการแก้ไข');
      return;
    }

    await Page.show('create');

    // สำคัญ: ต้องตั้งค่าหลัง Page.show('create') เพราะ show() จะเรียก reset()
    // ถ้าตั้งก่อน ค่านี้จะโดนล้าง และปุ่มยกเลิกจะคืนค่าเดิมไม่ได้
    this._editingId = id;
    this._loadedForm = JSON.parse(JSON.stringify(f));
    this._applyFormToEditor(f);
  },

  async _getFileSig(inputId) {
    // รองรับการแนบรูปแทนการวาดลายเซ็น: แปลงไฟล์ภาพเป็น base64
    const file = document.getElementById(inputId)?.files?.[0];
    if (!file) return null;
    return new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result);
      reader.readAsDataURL(file);
    });
  },

  // ส่งและบันทึกฟอร์ม
  async submit() {
    this._bindEmployeeLookup();

    const codeInput = document.getElementById('c-code');
    if (codeInput) {
      const emp = this._findEmployeeByCode(codeInput.value);
      if (emp) {
        this._fillEmployeeFields(emp);
      } else {
        const nameInput = document.getElementById('c-name');
        const byName = this._findEmployeeByName(nameInput?.value || '');
        if (byName) this._fillEmployeeFields(byName);
      }
    }

    // ---- ตรวจสอบ field บังคับ ----
    const name  = document.getElementById('c-name').value.trim();
    const code  = document.getElementById('c-code').value.trim();
    const asset = document.getElementById('c-asset').value.trim();
    if (!name || !code || !asset) {
      alert('กรุณากรอกข้อมูลที่จำเป็น: ชื่อพนักงาน, รหัสพนักงาน, รหัสครุภัณฑ์');
      return;
    }

    const editNote = document.getElementById('c-edit-note').value.trim();

    // ---- โหมดแก้ไขฟอร์มที่มีอยู่ ----
    if (this._editingId && !editNote) {
      // บังคับกรอกหมายเหตุเมื่อแก้ไข
      alert('กรุณาระบุหมายเหตุการแก้ไขก่อนบันทึก');
      document.getElementById('c-edit-note')?.focus();
      return;
    }

    if (this._editingId && this._loadedForm) {
      // ---- deep copy ฟอร์มเดิม แล้วอัปเดต field ----
      const form = JSON.parse(JSON.stringify(this._loadedForm));
      form.empName     = name;
      form.empCode     = code;
      form.empDept     = document.getElementById('c-dept').value.trim();
      form.empEmail    = document.getElementById('c-email').value.trim();
      form.assetCode   = asset;
      form.assetModel  = document.getElementById('c-model').value.trim();
      form.assetSerial = document.getElementById('c-serial').value.trim();
      form.assetSpec   = document.getElementById('c-spec').value.trim();
      form.deliverDate = document.getElementById('c-date').value || Utils.today();
      form.deliverType = document.getElementById('c-type').value;
      form.location    = document.getElementById('c-loc').value.trim();
      form.adminNote   = document.getElementById('c-note').value.trim();
      // ลำดับความสำคัญลายเซ็นตอนแก้ไข: วาดใหม่ > แนบไฟล์ใหม่ > ของเดิม
      form.adminSig    = SigPad.getData('sig-admin-create') || await AdminCreate._getFileSig('sig-create-file') || form.adminSig || null;
      form.adminFinalSig = null;   // รีเซ็ต ลายเซ็นยืนยัน (ต้องเซ็นใหม่)
      form.completedAt = null;     // รีเซ็ต completed
      form.status = STATUS.SENT;   // ส่งกลับไป User อีกรอบ
      form.revision = (form.revision || 1) + 1;  // เพิ่ม revision
      form.lastEditNote = editNote;
      form.lastReturnNote = '';    // ล้าง note เดิมที่ส่งกลับ User
      // reset checklist ของ User (userStatus, userNote) เพราะส่งใหม่
      form.checklist = FormModel.readChecklistFromDOM().map(c => ({ ...c, userStatus: null, userNote: '' }));
      form.userSig = null;         // ล้างลายเซ็น User
      form.userFilledAt = null;
      form.userIssues = '';
      // คืน user test items เป็น template ปัจจุบัน หรือ default ถ้าไม่ได้เลือก
      const _defTestItemsEdit = ['สามารถ Login เข้าเครื่องได้', 'สามารถใช้งานโปรแกรมพื้นฐานได้', 'สามารถเข้าใช้งาน File sharing ได้', 'อื่นๆ'];
      form.userTestItems = this._currentUserTestItems || _defTestItemsEdit;
      form.userReceiveDate = null;

      this._appendHistory(form, 'edit_and_resend', editNote);  // บันทึก history

      const ok = await DB.update(form);  // PUT /api/forms/{id}
      if (!ok) {
        alert('❌ บันทึกการแก้ไขไม่สำเร็จ กรุณาลองใหม่');
        return;
      }

      // แสดง modal link เพื่อส่งให้ User ใหม่
      this._currentLink = Utils.getUserPageUrl(form.token);
      document.getElementById('modalLinkText').textContent = this._currentLink;
      openModal('modalLink');
      this.reset();
      await Promise.all([Dashboard.render(), History.render()]);  // รีโหลดทั้งสอง tab
      return;
    }

    // ---- โหมดสร้างฟอร์มใหม่ ----
    const form = FormModel.create({
      empName:     name,
      empCode:     code,
      empDept:     document.getElementById('c-dept').value.trim(),
      empEmail:    document.getElementById('c-email').value.trim(),
      assetCode:   asset,
      assetModel:  document.getElementById('c-model').value.trim(),
      assetSerial: document.getElementById('c-serial').value.trim(),
      assetSpec:   document.getElementById('c-spec').value.trim(),
      deliverDate: document.getElementById('c-date').value || Utils.today(),
      deliverType: document.getElementById('c-type').value,
      location:    document.getElementById('c-loc').value.trim(),
      adminNote:   document.getElementById('c-note').value.trim(),
      lastEditNote: editNote || '',
      // ตอนสร้างใหม่รองรับทั้งวาดบน canvas และแนบไฟล์ภาพ
      adminSig:    SigPad.getData('sig-admin-create') || await AdminCreate._getFileSig('sig-create-file'),  // base64 PNG หรือ null
    });

    // อ่าน checklist ที่ Admin ติ๊กจาก DOM
    form.checklist = FormModel.readChecklistFromDOM();
    // เพิ่ม user test items จาก template (ถ้าไม่มี ใช้ default)
    const _defTestItems = ['สามารถ Login เข้าเครื่องได้', 'สามารถใช้งานโปรแกรมพื้นฐานได้', 'สามารถเข้าใช้งาน File sharing ได้', 'อื่นๆ'];
    form.userTestItems = this._currentUserTestItems || _defTestItems;

    const created = await DB.add(form);  // POST /api/forms
    if (!created) {
      alert('❌ บันทึกฟอร์มไม่สำเร็จ กรุณาตรวจสอบการ login และลองใหม่');
      return;
    }

    // แสดง modal พร้อม link ที่สร้างขึ้น
    this._currentLink = Utils.getUserPageUrl(created.token || form.token);
    document.getElementById('modalLinkText').textContent = this._currentLink;
    openModal('modalLink');
    await Dashboard.render();  // รีโหลด dashboard
  },

  // คัดลอก link ที่เพิ่งสร้าง
  copyLink() {
    navigator.clipboard.writeText(this._currentLink)
      .then(() => alert('คัดลอก Link แล้ว!'));
  },

  // คัดลอก link จาก id ที่มีอยู่ (ใช้ใน dashboard)
  async copyExistingLink(id) {
    const f = await DB.getById(id);
    if (!f) return;
    const link = Utils.getUserPageUrl(f.token);
    navigator.clipboard.writeText(link).then(() => alert('คัดลอก Link แล้ว!'));
  },
};

// ========================= VIEW MODAL =========================
const ViewModal = {
  _currentId: null,  // id ของฟอร์มที่กำลังดูอยู่

  async open(id) {
    this._currentId = id;
    const f = await DB.getById(id);  // โหลดข้อมูลฟอร์มล่าสุด
    if (!f) return;

    // ตั้งค่า title และ body ของ modal
    document.getElementById('modalViewTitle').textContent = `ฟอร์ม ${f.id} — ${f.empName}`;
    document.getElementById('modalViewBody').innerHTML = buildFormView(f);  // สร้าง HTML จาก ui.js

    document.getElementById('btnPrintView').onclick = () => printFormById(id);  // ผูกปุ่มพิมพ์
    openModal('modalView');
  },
};

// ========================= REVIEW MODAL (Admin ยืนยัน) =========================
const ReviewModal = {
  async open(id) {
    const f = await DB.getById(id);
    if (!f) return;

    document.getElementById('modalReviewBody').innerHTML = `
      ${buildFormView(f)}
      <div class="divider"></div>
      <div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:12px;margin-bottom:12px">
        <div style="font-size:13px;font-weight:700;color:var(--danger);margin-bottom:8px">↩ ส่งกลับให้ User แก้ไข (กรณีข้อมูลผิดพลาด)</div>
        <input type="text" id="return-note" placeholder="ระบุสาเหตุที่ส่งกลับ เช่น ชื่อ/Serial ไม่ตรง" style="width:100%">
      </div>
      <div style="background:var(--warning-lt);border:1px solid #fde68a;border-radius:8px;padding:16px">
        <div style="font-size:13px;font-weight:700;color:var(--warning);margin-bottom:12px">
          ✍️ ลายเซ็น Admin (ยืนยันรับทราบผลจาก User)
          <span style="font-size:11px;font-weight:400;margin-left:8px;color:var(--danger)">⚠ Admin เท่านั้น</span>
        </div>
        <div class="sig-wrap">
          <canvas id="sig-admin-final" class="sig-canvas"></canvas>
          <div class="sig-toolbar">
            <span class="sig-label" id="sig-final-label">✏️ วาดลายเซ็นเพื่อยืนยัน</span>
            <button class="btn btn-ghost btn-sm" onclick="SigPad.clear('sig-admin-final');document.getElementById('sig-final-label').textContent='✏️ วาดลายเซ็นเพื่อยืนยัน';document.getElementById('sig-final-file').value='';document.getElementById('sig-final-preview').style.display='none'">ล้าง</button>
          </div>
        </div>
        <div style="margin-top:8px;border-top:1px dashed var(--border);padding-top:8px">
          <div style="font-size:11.5px;color:var(--text3);margin-bottom:4px;text-align:center">หรือแนบไฟล์ลายเซ็น</div>
          <input type="file" id="sig-final-file" accept="image/*" style="font-size:11.5px;width:100%"
            onchange="const f=this.files[0];if(!f)return;const r=new FileReader();r.onload=e=>{const p=document.getElementById('sig-final-preview');p.src=e.target.result;p.style.display='block';SigPad.clear('sig-admin-final');document.getElementById('sig-final-label').textContent='📎 ใช้ไฟล์แนบ';};r.readAsDataURL(f)">
          <img id="sig-final-preview" src="" alt="preview" style="display:none;max-width:100%;max-height:60px;margin-top:4px;border-radius:4px;border:1px solid var(--border)">
        </div>
      </div>
    `;
    openModal('modalReview');
    SigPad.reinit('sig-admin-final');  // init signature pad หลัง innerHTML ถูก render

    // ผูก confirm button ทุกครั้งที่เปิด modal (ป้องกัน event ซ้ำซ้อน)
    document.getElementById('btnConfirmReview').onclick = () => this._confirm(id);
    document.getElementById('btnReturnReview').onclick = () => this._returnToUser(id);
  },

  async _returnToUser(id) {
    const note = document.getElementById('return-note')?.value.trim() || '';
    if (!note) {
      alert('กรุณาระบุหมายเหตุการส่งกลับให้ User');
      document.getElementById('return-note')?.focus();
      return;
    }

    const f = await DB.getById(id);
    if (!f) {
      alert('ไม่พบฟอร์ม');
      return;
    }

    const actor = getAdminActorLabel();
    f.status = STATUS.SENT;
    f.adminFinalSig = null;
    f.completedAt = null;
    f.lastReturnNote = note;
    f.lastEditNote = note;
    f.revision = (f.revision || 1) + 1;
    f.checklist = (Array.isArray(f.checklist) ? f.checklist : []).map(c => ({
      ...c,
      userStatus: null,
      userNote: '',
    }));
    f.userSig = null;
    f.userFilledAt = null;
    f.userIssues = '';
    f.userTestItems = [];
    f.userReceiveDate = null;
    f.editHistory = Array.isArray(f.editHistory) ? f.editHistory : [];
    f.editHistory.push({
      at: new Date().toISOString(),
      by: actor,
      action: 'return_to_user',
      note,
      revision: f.revision,
    });
    f.updatedAt = new Date().toISOString();
    f.updatedBy = actor;

    const ok = await DB.update(f);
    if (!ok) {
      alert('❌ ส่งกลับให้ User ไม่สำเร็จ');
      return;
    }

    closeModal('modalReview');
    await Promise.all([Dashboard.render(), History.render()]);
    alert('↩ ส่งกลับให้ User แก้ไขแล้ว');
  },

  async _confirm(id) {
    let sig = SigPad.getData('sig-admin-final');
    if (!sig) {
      // ถ้าไม่ได้วาดใน modal ยืนยัน ให้ใช้ไฟล์ภาพที่แนบแทน
      const file = document.getElementById('sig-final-file')?.files?.[0];
      if (file) {
        sig = await new Promise(resolve => {
          const reader = new FileReader();
          reader.onload = e => resolve(e.target.result);
          reader.readAsDataURL(file);
        });
      }
    }
    if (!sig) { alert('กรุณาเซ็นชื่อ Admin หรือแนบไฟล์ลายเซ็นก่อนยืนยัน'); return; }
    const actor = getAdminActorLabel();

    // PATCH เฉพาะ field ที่ต้องการ — ไม่ส่ง data ทั้งหมด (ประหยัด bandwidth)
    await DB.patch(id, {
      adminFinalSig: sig,               // ลายเซ็น Admin ยืนยัน (base64 PNG)
      completedAt:   new Date().toISOString(),
      updatedAt:     new Date().toISOString(),
      updatedBy:     actor,
      status:        STATUS.COMPLETED,  // เปลี่ยนสถานะเป็น completed
    });

    closeModal('modalReview');
    await Promise.all([Dashboard.render(), History.render()]);  // refresh ทั้งสอง tab
    alert('✅ ยืนยันเรียบร้อย! ฟอร์มปิดแล้ว');
  },
};

// ========================= INIT =========================
document.addEventListener('DOMContentLoaded', async () => {
  initModalOverlays();  // ผูก event ปิด modal เมื่อคลิก overlay
  await Dashboard.render();
  AdminCreate.reset();  // render checklist ครั้งแรก
});
