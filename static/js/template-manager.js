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
