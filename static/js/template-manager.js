// ============================================================
//  template-manager.js — จัดการ Template รายการตรวจสอบ
// ============================================================
//
//  ใช้ใน admin.html
//  โฟลว์:
//    1. โหลดรายการ template จาก /api/form-templates → เติม dropdown
//    2. ผู้ใช้เลือก template ใน dropdown แล้วโหลดลง Editor อัตโนมัติ
//       → แสดง sections/items ที่แก้ไขได้
//       หรือถ้าเลือก "Built-in" → โหลด CHECKLIST_TEMPLATE จาก config.js
//       พร้อมกำหนด owner ของแต่ละ section ได้ว่าเป็นงานของ Admin หรือ User
//    3. ผู้ใช้แก้ไข Section label และรายการตรวจสอบ
//    4. กด "เซฟเป็น Template ใหม่" → POST /api/form-templates (สร้างใหม่เสมอ)
//       ไม่เคย PUT — ไม่ทับ template เดิม
// 
// ============================================================

// รายการ default สำหรับ user test (ใช้เมื่อยังไม่มี template)
const DEFAULT_USER_TEST_ITEMS = [
  'สามารถ Login เข้าเครื่องได้',
  'สามารถใช้งานโปรแกรมพื้นฐานได้',
  'สามารถเข้าใช้งาน File sharing ได้',
  'อื่นๆ',
];

// ค่าเริ่มต้นของ "ส่วนหัวฟอร์ม" ที่จะใช้เป็น fallback เสมอ
// โครงสร้างนี้จะถูกบันทึกลง DB ใน field: header_fields (JSON)
const DEFAULT_HEADER_FIELDS = {
  // ชื่อการ์ดข้อมูลพนักงานในหน้า create-form
  employeeCardTitle: '👤 ข้อมูลพนักงานผู้รับ',
  // ชื่อการ์ดข้อมูลครุภัณฑ์ในหน้า create-form
  assetCardTitle: '💻 ข้อมูลครุภัณฑ์',
  // labels: map id input -> ข้อความ label
  labels: {
    'c-name': 'ชื่อ-นามสกุล',
    'c-code': 'รหัสพนักงาน',
    'c-dept': 'แผนก',
    'c-email': 'Email (สำหรับส่ง Link)',
    'c-asset': 'รหัสครุภัณฑ์',
    'c-model': 'ยี่ห้อ / รุ่น',
    'c-serial': 'Serial Number',
    'c-spec': 'Spec โดยย่อ',
    'c-date': 'วันที่ส่งมอบ',
    'c-loc': 'สถานที่ส่งมอบ',
    'c-type': 'ประเภท',
  },
  // placeholders: map id input -> placeholder ในช่องกรอก
  placeholders: {
    'c-name': 'พิมพ์ชื่อหรือเลือกจากรายการ',
    'c-code': 'เช่น 1001',
    'c-dept': 'เช่น ฝ่ายบัญชี',
    'c-email': 'somchai@company.com',
    'c-asset': 'IT-PC-0001',
    'c-model': 'Dell OptiPlex 5090',
    'c-serial': 'SN123456',
    'c-spec': 'Intel i5-11500, RAM 16GB, SSD 512GB',
    'c-date': '',
    'c-loc': 'อาคาร A ชั้น 3',
    'c-type': '',
  },
};

const TM = {
  _API:    '/api/form-templates',
  _secIdx: 0,  // counter unique key ของ section DOM

  // -------------------- headers --------------------
  _h() {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('auth_token') || ''}`,
    };
  },

  // -------------------- init --------------------
  async init() {
    await this.refreshList();
    // render editor ด้วย built-in เป็น default
    this._renderSections(CHECKLIST_TEMPLATE);
    this._renderUserTestItems(DEFAULT_USER_TEST_ITEMS);
    this._renderHeaderFields(DEFAULT_HEADER_FIELDS);
  },

  // -------------------- Load template list into dropdown --------------------
  async refreshList() {
    const sel = document.getElementById('srcTemplate');
    if (!sel) return;
    try {
      const r = await fetch(this._API, { headers: this._h() });
      if (!r.ok) return;
      const list = await r.json();
      sel.innerHTML =
        '<option value="">⬛ Built-in (มาตรฐานระบบ)</option>' +
        list.map(t =>
          `<option value="${t.id}">${this._esc(t.name)}${t.isDefault ? ' ⭐' : ''}</option>`
        ).join('');
    } catch (_) { /* ถ้า API ไม่ตอบ ใช้ built-in ต่อไป */ }
  },

  // -------------------- โหลด template ที่เลือกลง editor --------------------
  async loadIntoEditor() {
    const id = document.getElementById('srcTemplate')?.value;
    if (!id) {
      // Built-in
      document.getElementById('tmplName').value = '';
      document.getElementById('tmplIsDefault').checked = false;
      this._renderSections(CHECKLIST_TEMPLATE);
      this._renderUserTestItems(DEFAULT_USER_TEST_ITEMS);
      this._renderHeaderFields(DEFAULT_HEADER_FIELDS);
      return;
    }
    try {
      const r = await fetch(`${this._API}/${id}`, { headers: this._h() });
      if (!r.ok) { alert('โหลด Template ไม่สำเร็จ'); return; }
      const t = await r.json();
      // ตั้งชื่อเป็น "สำเนา ..." เพื่อเตือนว่าจะสร้างอันใหม่
      document.getElementById('tmplName').value = `สำเนา ${t.name}`;
      document.getElementById('tmplIsDefault').checked = false;
      this._renderSections(t.sections && t.sections.length ? t.sections : CHECKLIST_TEMPLATE);
      this._renderUserTestItems(t.userTestItems && t.userTestItems.length ? t.userTestItems : DEFAULT_USER_TEST_ITEMS);
      this._renderHeaderFields(t.headerFields || DEFAULT_HEADER_FIELDS);
    } catch (e) {
      alert('เกิดข้อผิดพลาด: ' + e.message);
    }
  },

  // -------------------- เปิดหน้าสร้างฟอร์มพร้อม template ที่เลือก --------------------
  openCreateWithSelected() {
    const id = document.getElementById('srcTemplate')?.value || '';
    if (id) {
      // create-form.js จะอ่านค่านี้ตอน loadTemplates แล้วเลือกให้เอง
      localStorage.setItem('dashboard_select_template', String(id));
    } else {
      // ถ้าเลือก Built-in ให้ล้างค่าเดิม เพื่อไม่ให้ติด template เก่า
      localStorage.removeItem('dashboard_select_template');
    }
    window.location.href = 'create-form.html';
  },

  // -------------------- ลบ template ที่เลือก --------------------
  async deleteTemplate() {
    const sel = document.getElementById('srcTemplate');
    const id = sel?.value || '';
    if (!id) {
      alert('กรุณาเลือก Template ที่ต้องการลบก่อน');
      return;
    }

    const name = sel?.options?.[sel.selectedIndex]?.text || `ID ${id}`;
    const ok = window.confirm(`ยืนยันการลบ Template: ${name} ?`);
    if (!ok) return;

    try {
      const r = await fetch(`${this._API}/${id}`, {
        method: 'DELETE',
        headers: this._h(),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        alert('ลบไม่สำเร็จ: ' + (err.detail || r.status));
        return;
      }

      // ถ้าลบ template ที่เคยถูกเลือกไว้ใน dashboard ให้ล้างทิ้ง
      if (localStorage.getItem('dashboard_select_template') === String(id)) {
        localStorage.removeItem('dashboard_select_template');
      }

      await this.refreshList();
      this.resetEditor();
      alert('ลบ Template เรียบร้อยแล้ว');
    } catch (e) {
      alert('เกิดข้อผิดพลาด: ' + e.message);
    }
  },

  // -------------------- Reset editor กลับ built-in --------------------
  resetEditor() {
    document.getElementById('tmplName').value = '';
    document.getElementById('tmplIsDefault').checked = false;
    document.getElementById('srcTemplate').value = '';
    this._renderSections(CHECKLIST_TEMPLATE);
    this._renderUserTestItems(DEFAULT_USER_TEST_ITEMS);
    this._renderHeaderFields(DEFAULT_HEADER_FIELDS);
  },

  // normalize ค่า headerFields ที่ได้จาก API ให้ครบทุก key
  // กรณี template เก่าไม่มี headerFields จะเติมด้วยค่า default ทั้งหมด
  _normHeaderFields(raw) {
    // ผสาน label จาก default + ค่าจริงที่ส่งมา
    const labels = { ...DEFAULT_HEADER_FIELDS.labels, ...(raw?.labels || {}) };
    // ผสาน placeholder จาก default + ค่าจริงที่ส่งมา
    const placeholders = { ...DEFAULT_HEADER_FIELDS.placeholders, ...(raw?.placeholders || {}) };
    return {
      // trim เพื่อตัดช่องว่างหัวท้าย
      employeeCardTitle: String(raw?.employeeCardTitle || DEFAULT_HEADER_FIELDS.employeeCardTitle).trim(),
      // trim เพื่อตัดช่องว่างหัวท้าย
      assetCardTitle: String(raw?.assetCardTitle || DEFAULT_HEADER_FIELDS.assetCardTitle).trim(),
      // คืน labels ที่เติมครบแล้ว
      labels,
      // คืน placeholders ที่เติมครบแล้ว
      placeholders,
    };
  },

  // render ค่า headerFields ลง input ของหน้า admin template editor
  _renderHeaderFields(raw) {
    // normalize ก่อนทุกครั้งเพื่อให้แน่ใจว่า field ไม่หาย
    const cfg = this._normHeaderFields(raw);
    // map id ของ field จริง -> id input สำหรับแก้ label
    const mapLabel = {
      'c-name': 'hf-label-c-name',
      'c-code': 'hf-label-c-code',
      'c-dept': 'hf-label-c-dept',
      'c-email': 'hf-label-c-email',
      'c-asset': 'hf-label-c-asset',
      'c-model': 'hf-label-c-model',
      'c-serial': 'hf-label-c-serial',
      'c-spec': 'hf-label-c-spec',
      'c-date': 'hf-label-c-date',
      'c-loc': 'hf-label-c-loc',
      'c-type': 'hf-label-c-type',
    };
    // map id ของ field จริง -> id input สำหรับแก้ placeholder
    const mapPlaceholder = {
      'c-name': 'hf-ph-c-name',
      'c-code': 'hf-ph-c-code',
      'c-dept': 'hf-ph-c-dept',
      'c-email': 'hf-ph-c-email',
      'c-asset': 'hf-ph-c-asset',
      'c-model': 'hf-ph-c-model',
      'c-serial': 'hf-ph-c-serial',
      'c-spec': 'hf-ph-c-spec',
      'c-date': 'hf-ph-c-date',
      'c-loc': 'hf-ph-c-loc',
      'c-type': 'hf-ph-c-type',
    };

    // input สำหรับหัวข้อการ์ดพนักงาน
    const employeeTitle = document.getElementById('hf-employee-title');
    // input สำหรับหัวข้อการ์ดครุภัณฑ์
    const assetTitle = document.getElementById('hf-asset-title');
    // เติมค่า title ลง input
    if (employeeTitle) employeeTitle.value = cfg.employeeCardTitle;
    // เติมค่า title ลง input
    if (assetTitle) assetTitle.value = cfg.assetCardTitle;

    // วนเติมค่า label ตาม map
    Object.keys(mapLabel).forEach((field) => {
      const el = document.getElementById(mapLabel[field]);
      // ถ้ามี element ให้ใส่ค่า, ถ้าไม่มีให้ข้ามอย่างปลอดภัย
      if (el) el.value = cfg.labels[field] || '';
    });
    // วนเติมค่า placeholder ตาม map
    Object.keys(mapPlaceholder).forEach((field) => {
      const el = document.getElementById(mapPlaceholder[field]);
      // ถ้ามี element ให้ใส่ค่า, ถ้าไม่มีให้ข้ามอย่างปลอดภัย
      if (el) el.value = cfg.placeholders[field] || '';
    });
  },

  // เก็บค่าจาก input editor ทั้งหมด กลับเป็น object headerFields เพื่อส่ง API
  _collectHeaderFields() {
    // map สำหรับดึงค่า label จาก input id
    const mapLabel = {
      'c-name': 'hf-label-c-name',
      'c-code': 'hf-label-c-code',
      'c-dept': 'hf-label-c-dept',
      'c-email': 'hf-label-c-email',
      'c-asset': 'hf-label-c-asset',
      'c-model': 'hf-label-c-model',
      'c-serial': 'hf-label-c-serial',
      'c-spec': 'hf-label-c-spec',
      'c-date': 'hf-label-c-date',
      'c-loc': 'hf-label-c-loc',
      'c-type': 'hf-label-c-type',
    };
    // map สำหรับดึงค่า placeholder จาก input id
    const mapPlaceholder = {
      'c-name': 'hf-ph-c-name',
      'c-code': 'hf-ph-c-code',
      'c-dept': 'hf-ph-c-dept',
      'c-email': 'hf-ph-c-email',
      'c-asset': 'hf-ph-c-asset',
      'c-model': 'hf-ph-c-model',
      'c-serial': 'hf-ph-c-serial',
      'c-spec': 'hf-ph-c-spec',
      'c-date': 'hf-ph-c-date',
      'c-loc': 'hf-ph-c-loc',
      'c-type': 'hf-ph-c-type',
    };

    // object ปลายทางสำหรับ labels
    const labels = {};
    // object ปลายทางสำหรับ placeholders
    const placeholders = {};

    // วนอ่านค่าจาก UI ฝั่ง label
    Object.keys(mapLabel).forEach((field) => {
      const el = document.getElementById(mapLabel[field]);
      // fallback กันกรณีปล่อยว่าง
      const fallback = DEFAULT_HEADER_FIELDS.labels[field] || '';
      // trim เพื่อลดข้อมูลสกปรก
      labels[field] = String(el?.value || fallback).trim();
    });
    // วนอ่านค่าจาก UI ฝั่ง placeholder
    Object.keys(mapPlaceholder).forEach((field) => {
      const el = document.getElementById(mapPlaceholder[field]);
      // fallback กันกรณีปล่อยว่าง
      const fallback = DEFAULT_HEADER_FIELDS.placeholders[field] || '';
      // trim เพื่อลดข้อมูลสกปรก
      placeholders[field] = String(el?.value || fallback).trim();
    });

    // คืนโครงสร้างเดียวกับที่ create-form ใช้
    return {
      // ชื่อการ์ดพนักงาน
      employeeCardTitle: String(document.getElementById('hf-employee-title')?.value || DEFAULT_HEADER_FIELDS.employeeCardTitle).trim(),
      // ชื่อการ์ดครุภัณฑ์
      assetCardTitle: String(document.getElementById('hf-asset-title')?.value || DEFAULT_HEADER_FIELDS.assetCardTitle).trim(),
      // labels ที่รวบรวมแล้ว
      labels,
      // placeholders ที่รวบรวมแล้ว
      placeholders,
    };
  },

  // -------------------- User Test Items --------------------
  _renderUserTestItems(items) {
    const container = document.getElementById('userTestContainer');
    if (!container) return;
    container.innerHTML = items.map((label, i) => this._userTestItemRowHTML(i, label)).join('');
  },

  _userTestItemRowHTML(i, value) {
    return `
      <div class="item-row" id="utest-${i}">
        <span class="item-num">${i + 1}.</span>
        <input type="text" placeholder="เช่น สามารถ Login เข้าเครื่องได้" value="${this._esc(value)}">
        <button class="btn btn-ghost btn-sm" onclick="TM._removeUserTestItem(${i})" title="ลบ" style="color:var(--text3);flex-shrink:0">✕</button>
      </div>
    `;
  },

  addUserTestItem() {
    const container = document.getElementById('userTestContainer');
    if (!container) return;
    const i = container.querySelectorAll('.item-row').length;
    const div = document.createElement('div');
    div.innerHTML = this._userTestItemRowHTML(i, '');
    container.appendChild(div.firstElementChild);
    setTimeout(() => container.querySelector(`#utest-${i} input`)?.focus(), 50);
  },

  _removeUserTestItem(i) {
    document.getElementById(`utest-${i}`)?.remove();
  },

  // -------------------- Render Sections ใน container --------------------
  _renderSections(sections) {
    this._secIdx = sections.length;
    const container = document.getElementById('sectionsContainer');
    if (!container) return;
    container.innerHTML = sections.map((sec, si) =>
      // sec.owner: 'admin' | 'user' (default เป็น admin เพื่อรองรับ template เก่า)
      this._sectionHTML(si, sec.label || '', sec.items || [''], sec.owner || 'admin')
    ).join('');
  },

  _sectionHTML(si, label, items, owner = 'admin') {
    const itemsHtml = items.map((item, ii) => this._itemRowHTML(si, ii, item)).join('');
    return `
      <div class="tmpl-section-card" id="sec-${si}">
        <div class="tmpl-section-head">
          <span style="font-size:12px;color:var(--text3);font-family:var(--mono);flex-shrink:0">#${parseInt(si) + 1}</span>
          <input type="text" id="sec-label-${si}" placeholder="ชื่อ Section เช่น 🖥️ Hardware" value="${this._esc(label)}">
          <select id="sec-owner-${si}" title="กำหนดผู้รับผิดชอบ section นี้" style="max-width:120px">
            <option value="admin"${owner === 'admin' ? ' selected' : ''}>Admin</option>
            <option value="user"${owner === 'user' ? ' selected' : ''}>User</option>
          </select>
          <button class="btn btn-ghost btn-sm" onclick="TM._removeSection(${si})" title="ลบ Section" style="color:var(--danger);flex-shrink:0">✕ ลบ Section</button>
        </div>
        <div class="tmpl-section-body">
          <div id="sec-items-${si}">${itemsHtml}</div>
          <button class="btn btn-outline btn-sm" style="margin-top:4px" onclick="TM._addItem(${si})">+ เพิ่มรายการ</button>
        </div>
      </div>
    `;
  },

  _itemRowHTML(si, ii, value) {
    const isObj = typeof value === 'object' && value !== null;
    const label = isObj ? this._esc(value.label || '') : this._esc(value || '');
    const options = isObj ? (value.options || []) : [];
    const hasOpts = options.length > 0;
    const optRows = options.map((opt, oi) => this._optRowHTML(si, ii, oi, opt)).join('');
    return `
      <div class="item-wrap" id="item-${si}-${ii}">
        <div class="item-row">
          <span class="item-num">${parseInt(ii) + 1}.</span>
          <input type="text" placeholder="รายการตรวจสอบ เช่น CPU ทำงานปกติ..." value="${label}">
          <button class="btn btn-ghost btn-sm opts-toggle${hasOpts ? ' opts-on' : ''}" onclick="TM._toggleItemOpts(${si},${ii})" title="เพิ่ม/ลบ checkbox options" style="flex-shrink:0;padding:3px 8px;font-size:13px">☑</button>
          <button class="btn btn-ghost btn-sm" onclick="TM._removeItem(${si},${ii})" title="ลบ" style="color:var(--text3);flex-shrink:0">✕</button>
        </div>
        <div class="item-opts" id="item-opts-${si}-${ii}"${hasOpts ? '' : ' style="display:none"'}>
          <div id="opts-list-${si}-${ii}">${optRows}</div>
          <button class="btn btn-ghost btn-sm" onclick="TM._addOpt(${si},${ii})" style="font-size:12px;margin-top:4px;color:var(--primary-lt)">+ เพิ่ม option</button>
        </div>
      </div>
    `;
  },

  // -------------------- Add Section --------------------
  addSection() {
    const si = this._secIdx++;
    const container = document.getElementById('sectionsContainer');
    if (!container) return;
    const div = document.createElement('div');
    div.innerHTML = this._sectionHTML(si, '', [''], 'admin');
    container.appendChild(div.firstElementChild);
    setTimeout(() => document.getElementById(`sec-label-${si}`)?.focus(), 50);
  },

  _removeSection(si) {
    document.getElementById(`sec-${si}`)?.remove();
  },

  _addItem(si) {
    const wrap = document.getElementById(`sec-items-${si}`);
    if (!wrap) return;
    const ii = wrap.querySelectorAll('.item-wrap').length;
    const div = document.createElement('div');
    div.innerHTML = this._itemRowHTML(si, ii, '');
    wrap.appendChild(div.firstElementChild);
    setTimeout(() => wrap.querySelector(`#item-${si}-${ii} input`)?.focus(), 50);
  },

  _removeItem(si, ii) {
    document.getElementById(`item-${si}-${ii}`)?.remove();
  },

  // -------------------- Options (sub-checkboxes) --------------------
  _optRowHTML(si, ii, oi, value) {
    return `
      <div class="opt-row" id="opt-${si}-${ii}-${oi}">
        <span class="opt-bullet">☐</span>
        <input type="text" placeholder="เช่น Windows 10..." value="${this._esc(value || '')}">
        <button class="btn btn-ghost btn-sm" onclick="TM._removeOpt(${si},${ii},${oi})" title="ลบ" style="color:var(--text3);flex-shrink:0;padding:2px 6px">✕</button>
      </div>
    `;
  },

  _toggleItemOpts(si, ii) {
    const optsDiv = document.getElementById(`item-opts-${si}-${ii}`);
    const btn = document.querySelector(`#item-${si}-${ii} .opts-toggle`);
    if (!optsDiv) return;
    const isVisible = optsDiv.style.display !== 'none';
    if (isVisible) {
      optsDiv.style.display = 'none';
      document.getElementById(`opts-list-${si}-${ii}`).innerHTML = '';
      if (btn) btn.classList.remove('opts-on');
    } else {
      optsDiv.style.display = '';
      const list = document.getElementById(`opts-list-${si}-${ii}`);
      if (list && !list.querySelector('.opt-row')) {
        const div = document.createElement('div');
        div.innerHTML = this._optRowHTML(si, ii, 0, '');
        list.appendChild(div.firstElementChild);
      }
      if (btn) btn.classList.add('opts-on');
    }
  },

  _addOpt(si, ii) {
    const list = document.getElementById(`opts-list-${si}-${ii}`);
    if (!list) return;
    const oi = list.querySelectorAll('.opt-row').length;
    const div = document.createElement('div');
    div.innerHTML = this._optRowHTML(si, ii, oi, '');
    list.appendChild(div.firstElementChild);
    setTimeout(() => document.getElementById(`opt-${si}-${ii}-${oi}`)?.querySelector('input')?.focus(), 50);
  },

  _removeOpt(si, ii, oi) {
    document.getElementById(`opt-${si}-${ii}-${oi}`)?.remove();
  },

  // -------------------- Collect data from DOM --------------------
  _collect() {
    const name = document.getElementById('tmplName')?.value.trim();
    if (!name) {
      alert('กรุณากรอกชื่อ Template ใหม่ก่อนบันทึก');
      document.getElementById('tmplName')?.focus();
      return null;
    }

    const sections = [];
    document.querySelectorAll('#sectionsContainer .tmpl-section-card').forEach(secEl => {
      const si = secEl.id.replace('sec-', '');
      const label = document.getElementById(`sec-label-${si}`)?.value.trim() || '';
      // owner ระบุว่า section นี้เป็นงานของฝั่งไหน (admin/user)
      const owner = document.getElementById(`sec-owner-${si}`)?.value === 'user' ? 'user' : 'admin';
      const items = [];
      secEl.querySelectorAll('.item-wrap').forEach(itemEl => {
        const labelVal = itemEl.querySelector('.item-row input[type=text]')?.value.trim();
        if (!labelVal) return;
        const optsDiv = itemEl.querySelector('.item-opts');
        if (optsDiv && optsDiv.style.display !== 'none') {
          const opts = [];
          optsDiv.querySelectorAll('.opt-row input[type=text]').forEach(inp => {
            const v = inp.value.trim();
            if (v) opts.push(v);
          });
          items.push(opts.length ? { label: labelVal, options: opts } : labelVal);
        } else {
          items.push(labelVal);
        }
      });
      if (items.length) {
        sections.push({
          category: `section_${si}`,
          label:    label || `Section ${parseInt(si) + 1}`,
          owner,
          items,
        });
      }
    });

    if (!sections.length) {
      alert('กรุณาเพิ่มอย่างน้อย 1 Section ที่มีรายการตรวจสอบ');
      return null;
    }

    // รวบรวม user test items
    const userTestItems = [];
    document.querySelectorAll('#userTestContainer .item-row').forEach(row => {
      const v = row.querySelector('input[type=text]')?.value.trim();
      if (v) userTestItems.push(v);
    });

    return {
      name,
      sections,
      userTestItems,
      // แนบ config ส่วนหัวฟอร์มไปพร้อม template
      headerFields: this._collectHeaderFields(),
      isDefault: document.getElementById('tmplIsDefault')?.checked || false,
    };
  },

  // -------------------- Save as NEW (POST เสมอ) --------------------
  async saveAsNew() {
    const data = this._collect();
    if (!data) return;

    try {
      const r = await fetch(this._API, {
        method:  'POST',
        headers: this._h(),
        body:    JSON.stringify(data),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        alert('บันทึกไม่สำเร็จ: ' + (err.detail || r.status));
        return;
      }
      const saved = await r.json();

      // รีเฟรส dropdown และแสดง toast
      await this.refreshList();
      // เลือก template ที่บันทึกใหม่ใน dropdown
      const sel = document.getElementById('srcTemplate');
      if (sel) sel.value = saved.id;

      this._showToast();
      // เคลียร์ชื่อ (เพื่อให้ชัดว่าบันทึกแล้ว ถ้าต้องการแก้ต่อต้องตั้งชื่อใหม่)
      document.getElementById('tmplName').value = '';
      // กลับไปหน้า dashboard และเลือก template ที่บันทึกใหม่อัตโนมัติ
      localStorage.setItem('dashboard_select_template', String(saved.id));
      setTimeout(() => { window.location.href = 'dashboard.html'; }, 800);
    } catch (e) {
      alert('เกิดข้อผิดพลาด: ' + e.message);
    }
  },

  // -------------------- Toast --------------------
  _showToast() {
    const el = document.getElementById('toast');
    if (!el) return;
    el.style.display  = 'block';
    el.style.opacity  = '1';
    setTimeout(() => {
      el.style.opacity = '0';
      setTimeout(() => { el.style.display = 'none'; el.style.opacity = '1'; }, 350);
    }, 2500);
  },

  // -------------------- Escape HTML --------------------
  _esc(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  },
};

document.addEventListener('DOMContentLoaded', () => TM.init());
