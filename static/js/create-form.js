// ============================================================
//  create-form.js — Logic เฉพาะหน้าสร้าง/แก้ไขฟอร์ม
// ============================================================
//  โหลดใน: create-form.html เท่านั้น
//
//  ┌─────────────────────────────────────────────────────────┐
//  │  AdminCreate.init()     — จุดเริ่มต้น, รองรับ ?edit=ID  │
//  │  AdminCreate.reset()    — ล้างฟอร์มทั้งหมด              │
//  │  AdminCreate.submit()   — บันทึกและสร้าง Link            │
//  │  AdminCreate.cancel()   — ยกเลิก / คืนค่าเดิม           │
//  └─────────────────────────────────────────────────────────┘
// ============================================================

function getAdminActorLabel() {
  const profile = (window.Auth && typeof window.Auth.getAdminProfile === 'function')
    ? window.Auth.getAdminProfile()
    : { fullName: 'admin', empCode: '' };
  return profile.empCode ? `${profile.fullName} (${profile.empCode})` : profile.fullName;
}

function getAdminEmpCode() {
  const profile = (window.Auth && typeof window.Auth.getAdminProfile === 'function')
    ? window.Auth.getAdminProfile()
    : { empCode: '' };
  return (profile.empCode || '').trim();
}

// ========================= CREATE FORM (Admin Only) =========================
const AdminCreate = {
  _currentLink: '',
  _editingId: null,
  _loadedForm: null,
  _employeeLookupBound: false,
  _currentTemplate: null,
  _currentUserTestItems: null,
  _templateLoading: false,

  _setTemplateStatus(text, color = 'var(--text3)') {
    const el = document.getElementById('c-template-status');
    if (!el) return;
    el.textContent = text;
    el.style.color = color;
  },

  _setTemplateControlsLocked(locked) {
    const sel = document.getElementById('c-template');
    const reloadBtn = document.getElementById('c-template-reload-btn');
    if (sel) sel.disabled = !!locked;
    if (reloadBtn) reloadBtn.disabled = !!locked;
  },

  _buildTemplateFromChecklist(checklist) {
    if (!Array.isArray(checklist) || !checklist.length) return null;

    const sections = [];
    const sectionMap = new Map();

    checklist.forEach(c => {
      const category = c?.category || 'misc';
      if (!sectionMap.has(category)) {
        const sec = {
          category,
          label: c?.sectionLabel || category,
          items: [],
          _groupMap: new Map(),
        };
        sectionMap.set(category, sec);
        sections.push(sec);
      }

      const sec = sectionMap.get(category);
      const itemText = String(c?.item || '').trim();
      if (!itemText) return;

      if (c?.group) {
        const groupLabel = String(c.group).trim();
        if (!groupLabel) {
          sec.items.push(itemText);
          return;
        }

        let groupObj = sec._groupMap.get(groupLabel);
        if (!groupObj) {
          groupObj = { label: groupLabel, options: [] };
          sec._groupMap.set(groupLabel, groupObj);
          sec.items.push(groupObj);
        }
        groupObj.options.push(itemText);
        return;
      }

      sec.items.push(itemText);
    });

    return sections
      .map(({ _groupMap, ...sec }) => sec)
      .filter(sec => Array.isArray(sec.items) && sec.items.length > 0);
  },

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
    const dataList  = document.getElementById('employeeCodeList');
    const nameList  = document.getElementById('employeeNameList');

    if (!codeInput || !nameInput || !deptInput) return;

    const employees = this._getEmployees();

    if (dataList && employees.length) {
      dataList.innerHTML = employees.map(emp =>
        `<option value="${emp.code}">${emp.fullName} (${emp.department} - ${emp.company})</option>`
      ).join('');
    }
    if (nameList && employees.length) {
      nameList.innerHTML = employees.map(emp =>
        `<option value="${emp.fullName}">${emp.code} (${emp.department} - ${emp.company})</option>`
      ).join('');
    }

    const codeHint = document.getElementById('c-code-hint');
    const nameHint = document.getElementById('c-name-hint');

    const showHint = (el, msg) => { if (el) { el.textContent = msg; el.style.display = msg ? 'block' : 'none'; } };

    const applyByCode = (showError) => {
      const code = codeInput.value.trim();
      if (!code) { showHint(codeHint, ''); return; }
      const emp = this._findEmployeeByCode(code);
      if (emp) {
        this._fillEmployeeFields(emp);
        showHint(codeHint, '');
        showHint(nameHint, '');
      } else if (showError) {
        showHint(codeHint, `ไม่พบข้อมูลพนักงานรหัส "${code}"`);
      }
    };

    const applyByName = (showError) => {
      const name = nameInput.value.trim();
      if (!name) { showHint(nameHint, ''); return; }
      const emp = this._findEmployeeByName(name);
      if (emp) {
        this._fillEmployeeFields(emp);
        showHint(nameHint, '');
        showHint(codeHint, '');
      } else if (showError) {
        showHint(nameHint, `ไม่พบข้อมูลพนักงานชื่อ "${name}"`);
      }
    };

    // ระหว่างพิมพ์ — แค่ล้าง error; ไม่ autofill จากชื่อ (กัน fill กลางคัน)
    // code ใช้ exact match เลย autofill ระหว่างพิมพ์ได้
    codeInput.addEventListener('input',  () => { showHint(codeHint, ''); applyByCode(false); });
    // name ใช้ includes() เลยรอ change/blur เท่านั้น
    nameInput.addEventListener('input',  () => { showHint(nameHint, ''); });
    // เมื่อออกจากช่อง / เลือกจาก datalist — แสดง error ถ้าไม่เจอ
    codeInput.addEventListener('change', () => applyByCode(true));
    codeInput.addEventListener('blur',   () => applyByCode(true));
    nameInput.addEventListener('change', () => applyByName(true));
    nameInput.addEventListener('blur',   () => applyByName(true));

    this._employeeLookupBound = true;
  },

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

  async loadTemplates() {
    const sel = document.getElementById('c-template');
    if (!sel) return;
    this._setTemplateStatus('กำลังโหลดรายการ Template...', 'var(--primary)');
    try {
      const r = await fetch('/api/form-templates', {
        headers: { 'Authorization': `Bearer ${Auth.getToken()}` },
      });
      if (!r.ok) {
        this._setTemplateStatus('โหลดรายการ Template ไม่สำเร็จ', 'var(--danger)');
        return;
      }
      const templates = await r.json();
      sel.innerHTML = '<option value="">⬛ Default (มาตรฐานระบบ)</option>' +
        templates.map(t =>
          `<option value="${t.id}"${t.isDefault ? ' selected' : ''}>${t.name}${t.isDefault ? ' ⭐' : ''}</option>`
        ).join('');
      const pendingId = localStorage.getItem('dashboard_select_template');
      if (pendingId) {
        localStorage.removeItem('dashboard_select_template');
        sel.value = pendingId;
      }
      if (sel.value) {
        await this.onTemplateChange();
      } else {
        this._setTemplateStatus('ใช้แบบฟอร์มมาตรฐาน (Default)', 'var(--text3)');
      }
    } catch (_) { /* ไม่มี template — ใช้ built-in */ }
  },

  async onTemplateChange() {
    const id = document.getElementById('c-template')?.value;
    if (!id) {
      this._currentTemplate = null;
      this._currentUserTestItems = null;
      this._templateLoading = false;
      this.renderChecklist();
      this._setTemplateStatus('ใช้แบบฟอร์มมาตรฐาน (Default)', 'var(--text3)');
      return;
    }
    this._templateLoading = true;
    this._setTemplateStatus('กำลังโหลด Template ที่เลือก...', 'var(--primary)');
    try {
      const r = await fetch(`/api/form-templates/${id}`, {
        headers: { 'Authorization': `Bearer ${Auth.getToken()}` },
      });
      if (!r.ok) {
        this._currentTemplate = null;
        this._currentUserTestItems = null;
        this._templateLoading = false;
        this.renderChecklist();
        this._setTemplateStatus('โหลด Template ไม่สำเร็จ (Fallback เป็น Default)', 'var(--danger)');
        alert('โหลด Template ที่เลือกไม่สำเร็จ ระบบจะใช้แบบฟอร์มมาตรฐานแทน');
        return;
      }
      const tmpl = await r.json();
      this._currentTemplate = tmpl.sections?.length ? tmpl.sections : null;
      this._currentUserTestItems = tmpl.userTestItems?.length ? tmpl.userTestItems : null;
      this._templateLoading = false;
      this.renderChecklist();
      this._setTemplateStatus(`โหลดสำเร็จ: ${tmpl.name || 'Template ที่เลือก'}`, 'var(--success)');
    } catch (_) {
      this._currentTemplate = null;
      this._currentUserTestItems = null;
      this._templateLoading = false;
      this.renderChecklist();
      this._setTemplateStatus('เชื่อมต่อไม่ได้ (Fallback เป็น Default)', 'var(--danger)');
      alert('ไม่สามารถเชื่อมต่อเพื่อโหลด Template ได้ ระบบจะใช้แบบฟอร์มมาตรฐานแทน');
    }
  },

  async _ensureSelectedTemplateReady() {
    const selectedTemplateId = document.getElementById('c-template')?.value;
    if (!selectedTemplateId) return true;
    if (Array.isArray(this._currentTemplate) && this._currentTemplate.length) return true;

    await this.onTemplateChange();
    if (Array.isArray(this._currentTemplate) && this._currentTemplate.length) return true;

    alert('Template ที่เลือกยังโหลดไม่สำเร็จ กรุณากดโหลดใหม่หรือเลือก Template อีกครั้งก่อนบันทึก');
    return false;
  },

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
    this._setTemplateControlsLocked(false);
    await this.loadTemplates();
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
    const history = Array.isArray(form.editHistory) ? form.editHistory : [];
    history.push({
      at: nowISO,
      by: actor,
      action,
      note: note || '',
      revision: form.revision || 1,
    });
    form.editHistory = history;
    form.updatedAt = nowISO;
    form.updatedBy = actor;
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

    // โหมดแก้ไขต้องแสดงรายการเดิมของฟอร์มนั้นเสมอ
    this._currentTemplate = this._buildTemplateFromChecklist(f.checklist) || this._currentTemplate;
    this._currentUserTestItems = Array.isArray(f.userTestItems) && f.userTestItems.length
      ? f.userTestItems
      : this._currentUserTestItems;

    this.renderChecklist();
    const checklist = Array.isArray(f.checklist) ? f.checklist : [];
    checklist.forEach(c => {
      const chk  = document.getElementById(`chk_${c.key}`);
      const note = document.getElementById(`note_${c.key}`);
      if (chk)  chk.checked  = !!c.adminChecked;
      if (note) note.value   = c.adminNote || '';
    });

    const editBox  = document.getElementById('editModeBox');
    const editIdEl = document.getElementById('editModeFormId');
    if (editBox)  editBox.style.display = 'block';
    if (editIdEl) editIdEl.textContent  = f.id;
    this._setEditNoteVisibility(true);

    const submitBtn = document.getElementById('btnCreateSubmit');
    if (submitBtn) submitBtn.textContent = '💾 บันทึกการแก้ไขและส่งกลับ User →';

    // ล็อกการเปลี่ยน template ระหว่างแก้ไข เพื่อไม่ให้โครงสร้างเดิมถูกทับ
    this._setTemplateControlsLocked(true);
    this._setTemplateStatus();

    SigPad.reinit('sig-admin-create');
  },

  cancel() {
    if (this._editingId && this._loadedForm) {
      this._applyFormToEditor(this._loadedForm);
      return;
    }
    this.reset();
  },

  // โหลดฟอร์มที่มีอยู่เพื่อแก้ไข (ถูกเรียกจาก dashboard หรือ URL param ?edit=ID)
  async loadForEdit(id) {
    const f = await DB.getById(id);
    if (!f) {
      alert('ไม่พบฟอร์มที่ต้องการแก้ไข');
      window.location.href = 'dashboard.html';
      return;
    }
    await this.reset();
    this._editingId = id;
    this._loadedForm = JSON.parse(JSON.stringify(f));
    this._applyFormToEditor(f);
  },

  async _getFileSig(inputId) {
    const file = document.getElementById(inputId)?.files?.[0];
    if (!file) return null;
    return new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result);
      reader.readAsDataURL(file);
    });
  },

  async submit() {
    this._bindEmployeeLookup();

    if (this._templateLoading) {
      alert('กำลังโหลด Template อยู่ กรุณารอสักครู่แล้วลองบันทึกอีกครั้ง');
      return;
    }

    if (!(await this._ensureSelectedTemplateReady())) {
      return;
    }

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
      alert('กรุณาระบุหมายเหตุการแก้ไขก่อนบันทึก');
      document.getElementById('c-edit-note')?.focus();
      return;
    }

    if (this._editingId && this._loadedForm) {
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
      form.adminSig    = SigPad.getData('sig-admin-create') || await AdminCreate._getFileSig('sig-create-file') || form.adminSig || null;
      form.adminFinalSig = null;
      form.completedAt   = null;
      form.status        = STATUS.SENT;
      form.revision      = (form.revision || 1) + 1;
      form.lastEditNote  = editNote;
      form.lastReturnNote = '';
      if (!form.adminCreatorEmpCode) {
        form.adminCreatorEmpCode = getAdminEmpCode();
      }
      form.checklist = FormModel.readChecklistFromDOM().map(c => ({ ...c, userStatus: null, userNote: '' }));
      form.userSig         = null;
      form.userFilledAt    = null;
      form.userIssues      = '';
      const _defTestItemsEdit = ['สามารถ Login เข้าเครื่องได้', 'สามารถใช้งานโปรแกรมพื้นฐานได้', 'สามารถเข้าใช้งาน File sharing ได้', 'อื่นๆ'];
      form.userTestItems   = this._currentUserTestItems || _defTestItemsEdit;
      form.userReceiveDate = null;

      this._appendHistory(form, 'edit_and_resend', editNote);

      const ok = await DB.update(form);
      if (!ok) {
        alert('❌ บันทึกการแก้ไขไม่สำเร็จ กรุณาลองใหม่');
        return;
      }

      this._currentLink = Utils.getUserPageUrl(form.token, form.id);
      document.getElementById('modalLinkText').textContent = this._currentLink;
      openModal('modalLink');
      this.reset();
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
      adminSig:    SigPad.getData('sig-admin-create') || await AdminCreate._getFileSig('sig-create-file'),
    });

    if (!form.adminCreatorEmpCode) {
      form.adminCreatorEmpCode = getAdminEmpCode();
    }

    form.checklist = FormModel.readChecklistFromDOM();
    const _defTestItems = ['สามารถ Login เข้าเครื่องได้', 'สามารถใช้งานโปรแกรมพื้นฐานได้', 'สามารถเข้าใช้งาน File sharing ได้', 'อื่นๆ'];
    form.userTestItems = this._currentUserTestItems || _defTestItems;

    const created = await DB.add(form);
    if (!created) {
      alert('❌ บันทึกฟอร์มไม่สำเร็จ กรุณาตรวจสอบการ login และลองใหม่');
      return;
    }

    this._currentLink = Utils.getUserPageUrl(created.token || form.token, created.id || form.id);
    document.getElementById('modalLinkText').textContent = this._currentLink;
    openModal('modalLink');
  },

  copyLink() {
    navigator.clipboard.writeText(this._currentLink)
      .then(() => alert('คัดลอก Link แล้ว!'));
  },

  // ========================= INIT =========================
  async init() {
    initModalOverlays();
    // ตรวจสอบ URL param ?edit=ID สำหรับโหมดแก้ไข
    const editId = new URLSearchParams(window.location.search).get('edit');
    if (editId) {
      await this.loadForEdit(editId);
    } else {
      await this.reset();
    }
  },
};

// expose ให้โค้ดอื่น/inline handlers อ้างถึงได้แน่นอน
window.AdminCreate = AdminCreate;

// ========================= BOOTSTRAP =========================
document.addEventListener('DOMContentLoaded', () => AdminCreate.init());
