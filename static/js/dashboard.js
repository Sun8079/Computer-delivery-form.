// ============================================================
//  dashboard.js — Logic เฉพาะหน้า Dashboard / ประวัติ
// ============================================================
//  โหลดใน: dashboard.html เท่านั้น
//
//  Page.show()     — คงไว้สำหรับ nav (ตอนนี้ใช้หน้า dashboard เดียว)
//  Dashboard       — โหลด stats + ฟอร์มล่าสุด + ส่วนประวัติ
//  History         — ค้นหา/กรองประวัติฟอร์มทั้งหมด
//  AdminCreate     — stub: editExisting(redirect) + copyExistingLink
//  ViewModal       — ดูรายละเอียดฟอร์ม
//  ReviewModal     — ตรวจสอบและยืนยัน/ส่งกลับฟอร์ม
// ============================================================

function getAdminActorLabel() {
  const profile = (window.Auth && typeof window.Auth.getAdminProfile === 'function')
    ? window.Auth.getAdminProfile()
    : { fullName: 'admin', empCode: '' };
  return profile.empCode ? `${profile.fullName} (${profile.empCode})` : profile.fullName;
}

function renderTemplateCell(f) {
  // ถ้าเป็นฟอร์มเก่าที่ยังไม่มี metadata ให้แสดงเป็น DEFAULT
  const code = f.templateId ? `TMP-${f.templateId}` : 'DEFAULT';
  const name = f.templateName || 'Default (มาตรฐานระบบ)';
  return `<span class="mono">${code}</span><br><small class="text-muted">${name}</small>`;
}

// ========================= SEARCH SUGGEST =========================
// ชุดนี้ดูแล autocomplete ของช่องค้นหา:
// - พิมพ์แล้วโชว์คำแนะนำแบบเรียลไทม์
// - รองรับขึ้น/ลง/Enter/Esc
// - เลือกคำแนะนำแล้วกรองตารางทันที
const SearchSuggest = {
  _items: [],
  _activeIndex: -1,
  _isComposing: false,

  async refreshSource() {
    // โหลดข้อมูลล่าสุดทุกครั้งที่ต้องรีเฟรชแหล่งคำค้น
    // เพื่อให้รายการแนะนำสอดคล้องกับข้อมูลในตารางจริง
    const all = await DB.getAll();
    const set = new Set();

    // เก็บคำจากหลายฟิลด์เพื่อให้ค้นหาได้ใกล้เคียงการใช้งานจริง
    all.forEach(f => {
      [f.empName, f.empCode, f.assetCode].forEach(v => {
        const text = String(v || '').trim();
        if (text) set.add(text);
      });
    });

    this._items = Array.from(set);
  },

  _rank(query, text) {
    const q = query.toLowerCase();
    const t = text.toLowerCase();
    // กติกา: ผ่านเฉพาะคำที่ขึ้นต้นตรงกับสิ่งที่พิมพ์
    if (t.startsWith(q)) return 0; // รองรับเฉพาะ "ขึ้นต้นคำ" เท่านั้น
    return Number.POSITIVE_INFINITY;
  },

  _escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  },

  _highlight(text, query) {
    const safe = this._escapeHtml(text);
    if (!query) return safe;
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx < 0) return safe;

    const a = this._escapeHtml(text.slice(0, idx));
    const b = this._escapeHtml(text.slice(idx, idx + query.length));
    const c = this._escapeHtml(text.slice(idx + query.length));
    return `${a}<mark>${b}</mark>${c}`;
  },

  _getSuggestEl() {
    return document.getElementById('hSuggest');
  },

  _hide() {
    const box = this._getSuggestEl();
    if (!box) return;
    box.style.display = 'none';
    box.innerHTML = '';
    this._activeIndex = -1;
  },

  async onInput(evt) {
    // กรองตารางก่อนทุกครั้ง เพื่อให้ผลลัพธ์แสดงทันทีตอนพิมพ์
    await History.render();

    // IME ภาษาไทย: ระหว่างกำลังประกอบคำยังไม่ต้องโชว์ dropdown
    if (evt?.isComposing || this._isComposing) return;

    const input = document.getElementById('hSearch');
    const q = input?.value.trim() || '';
    if (!q) {
      this._hide();
      return;
    }

    if (!this._items.length) {
      await this.refreshSource();
    }

    const ranked = this._items
      .map(text => ({ text, score: this._rank(q, text) }))
      .filter(x => Number.isFinite(x.score))
      // ถ้าคะแนนเท่ากัน เรียงตามภาษาไทยเพื่อให้รายการนิ่งและเดาง่าย
      .sort((a, b) => (a.score - b.score) || a.text.localeCompare(b.text, 'th'))
      .slice(0, 10);

    const box = this._getSuggestEl();
    if (!box || !ranked.length) {
      this._hide();
      return;
    }

    box.innerHTML = ranked.map((r, i) => `
      <div class="search-suggest-item${i === this._activeIndex ? ' active' : ''}" data-index="${i}" data-value="${encodeURIComponent(r.text)}">
        <span class="search-suggest-icon">🔍</span>
        <span>${this._highlight(r.text, q)}</span>
      </div>
    `).join('');
    box.style.display = 'block';

    box.querySelectorAll('.search-suggest-item').forEach(el => {
      // mousedown ทำงานก่อน blur เพื่อป้องกัน dropdown หายก่อนเลือกค่า
      el.addEventListener('mousedown', (e) => {
        e.preventDefault();
        const value = decodeURIComponent(el.getAttribute('data-value') || '');
        this._applyValue(value);
      });
    });
  },

  async onStatusChange() {
    await History.render();
    this._hide();
  },

  async onKeyDown(evt) {
    const box = this._getSuggestEl();
    const open = !!box && box.style.display !== 'none';
    if (!open) return;

    const items = Array.from(box.querySelectorAll('.search-suggest-item'));
    if (!items.length) return;

    if (evt.key === 'ArrowDown') {
      evt.preventDefault();
      this._activeIndex = (this._activeIndex + 1) % items.length;
      this._paintActive(items);
      return;
    }
    if (evt.key === 'ArrowUp') {
      evt.preventDefault();
      this._activeIndex = (this._activeIndex - 1 + items.length) % items.length;
      this._paintActive(items);
      return;
    }
    if (evt.key === 'Enter') {
      evt.preventDefault();
      const idx = this._activeIndex >= 0 ? this._activeIndex : 0;
      const value = decodeURIComponent(items[idx]?.getAttribute('data-value') || '');
      this._applyValue(value);
      return;
    }
    if (evt.key === 'Escape') {
      this._hide();
    }
  },

  _paintActive(items) {
    items.forEach((el, i) => el.classList.toggle('active', i === this._activeIndex));
  },

  async _applyValue(value) {
    // เมื่อผู้ใช้เลือกคำแนะนำ: ใส่ค่าใน input แล้วกรองตารางซ้ำทันที
    const input = document.getElementById('hSearch');
    if (input) input.value = value;
    this._hide();
    await History.render();
  },

  bindEvents() {
    const input = document.getElementById('hSearch');
    if (!input) return;

    input.addEventListener('keydown', (e) => this.onKeyDown(e));
    input.addEventListener('compositionstart', () => {
      this._isComposing = true;
    });
    input.addEventListener('compositionend', async () => {
      this._isComposing = false;
      await this.onInput();
    });

    document.addEventListener('click', (e) => {
      const wrap = document.querySelector('.search-autocomplete');
      if (!wrap || wrap.contains(e.target)) return;
      this._hide();
    });
  },
};

// ========================= PAGE NAVIGATION =========================
const Page = {
  _tabs: ['dashboard'],

  async show(name) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-tab').forEach((t, i) => {
      t.classList.toggle('active', this._tabs[i] === name);
    });
    document.getElementById(`page-${name}`)?.classList.add('active');

    // หน้าเดียว: ทุกอย่าง render ผ่าน Dashboard.render()
    if (name === 'dashboard') await Dashboard.render();
  },
};

// ========================= DASHBOARD =========================
const Dashboard = {
  async render() {
    // render หน้า dashboard เป็นสองช่วง: สถิติ -> ตารางข้อมูล
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
    // ใช้ช่องค้นหา/กรองเดียวกันบน dashboard
    // โหมดค้นหา: ต้อง "ขึ้นต้นด้วยคำที่พิมพ์" เท่านั้น เช่น ก -> กร -> กรุ
    const q  = document.getElementById('hSearch')?.value.toLowerCase().trim() || '';
    const st = document.getElementById('hStatus')?.value || '';

    const tbody = document.getElementById('dashTable');
    const all = await DB.getAll();
    const forms = all.filter(f => {
      // ตรวจ prefix match หลายฟิลด์: ชื่อ, รหัสพนักงาน, รหัสครุภัณฑ์, id ฟอร์ม
      const match = !q || [f.empName, f.empCode, f.assetCode, f.id]
        .some(v => String(v || '').toLowerCase().startsWith(q));
      return match && (!st || f.status === st);
    });

    if (!forms.length) {
      const msg = (q || st)
        ? 'ไม่พบฟอร์มที่ค้นหา'
        : 'ยังไม่มีฟอร์ม';
      const icon = (q || st) ? '🔍' : '📭';
      tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state"><div class="icon">${icon}</div><p>${msg}</p></div></td></tr>`;
      return;
    }
    tbody.innerHTML = forms.map(f => `
      <tr>
        <td><span class="mono" style="color:var(--primary-lt)">${Utils.getFormCreatorName(f)}</span></td>
        <td><b>${f.empName}</b></td>
        <td><span class="mono">${f.empCode}</span></td>
        <td>${f.empDept || '—'}</td>
        <td>${f.assetCode}<br><small class="text-muted">${f.assetModel || ''}</small></td>
        <td>${renderTemplateCell(f)}</td>
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
    // ปุ่มลบเป็น hard delete (ลบจากฐานข้อมูลจริง)
    b += ` <button class="btn btn-outline btn-sm" style="border-color:var(--danger);color:var(--danger)" onclick="AdminCreate.deleteExisting('${f.id}')">🗑 ลบ</button>`;
    return b;
  },
};

// ========================= HISTORY =========================
const History = {
  async render() {
    // compatibility layer:
    // ยังคงชื่อ History.render() ไว้ เพื่อไม่ต้องไล่แก้ inline handlers เดิมใน HTML
    // แต่ภายในจะเรียก table renderer ตัวเดียวของ dashboard
    await Dashboard._renderTable();
  },
};

// ========================= ADMIN CREATE — stub สำหรับ dashboard =========================
// การสร้าง/แก้ไขฟอร์มจริงอยู่ใน create-form.html + create-form.js
const AdminCreate = {
  // redirect ไปหน้าแก้ไขฟอร์ม
  editExisting(id) {
    window.location.href = `create-form.html?edit=${encodeURIComponent(id)}`;
  },

  // คัดลอก link จาก id ที่มีอยู่
  async copyExistingLink(id) {
    const f = await DB.getById(id);
    if (!f) return;
    const link = Utils.getUserPageUrl(f.token, f.id);
    navigator.clipboard.writeText(link).then(() => alert('คัดลอก Link แล้ว!'));
  },

  // ลบฟอร์มที่มีอยู่
  async deleteExisting(id) {
    // ยืนยันซ้ำก่อนลบเพราะไม่สามารถกู้คืนได้
    const confirmed = window.confirm(`ยืนยันการลบฟอร์ม ${id} ?\n\nการลบจะไม่สามารถกู้คืนได้`);
    if (!confirmed) return;

    const ok = await DB.delete(id);
    if (!ok) {
      alert('❌ ลบฟอร์มไม่สำเร็จ กรุณาลองใหม่');
      return;
    }

    await Dashboard.render();
    alert('🗑 ลบฟอร์มเรียบร้อยแล้ว');
  },
};

// ========================= VIEW MODAL =========================
const ViewModal = {
  _currentId: null,

  async open(id) {
    this._currentId = id;
    const f = await DB.getById(id);
    if (!f) return;

    document.getElementById('modalViewTitle').textContent = `ผู้สร้าง: ${Utils.getFormCreatorName(f)}  ${f.empName}`;
    document.getElementById('modalViewBody').innerHTML = buildFormView(f);
    document.getElementById('btnPrintView').onclick = () => printFormById(id);
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
    SigPad.reinit('sig-admin-final');

    document.getElementById('btnConfirmReview').onclick = () => this._confirm(id);
    document.getElementById('btnReturnReview').onclick  = () => this._returnToUser(id);
  },

  async _returnToUser(id) {
    const note = document.getElementById('return-note')?.value.trim() || '';
    if (!note) {
      alert('กรุณาระบุหมายเหตุการส่งกลับให้ User');
      document.getElementById('return-note')?.focus();
      return;
    }

    const f = await DB.getById(id);
    if (!f) { alert('ไม่พบฟอร์ม'); return; }

    const actor = getAdminActorLabel();
    f.status        = STATUS.SENT;
    f.adminFinalSig = null;
    f.completedAt   = null;
    f.lastReturnNote = note;
    f.lastEditNote   = note;
    f.revision       = (f.revision || 1) + 1;
    f.checklist = (Array.isArray(f.checklist) ? f.checklist : []).map(c => ({
      ...c, userStatus: null, userNote: '',
    }));
    f.userSig        = null;
    f.userFilledAt   = null;
    f.userIssues     = '';
    f.userTestItems  = [];
    f.userReceiveDate = null;
    f.editHistory = Array.isArray(f.editHistory) ? f.editHistory : [];
    f.editHistory.push({ at: new Date().toISOString(), by: actor, action: 'return_to_user', note, revision: f.revision });
    f.updatedAt = new Date().toISOString();
    f.updatedBy = actor;

    const ok = await DB.update(f);
    if (!ok) { alert('❌ ส่งกลับให้ User ไม่สำเร็จ'); return; }

    closeModal('modalReview');
    await Dashboard.render();
    alert('↩ ส่งกลับให้ User แก้ไขแล้ว');
  },

  async _confirm(id) {
    let sig = SigPad.getData('sig-admin-final');
    if (!sig) {
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

    await DB.patch(id, {
      adminFinalSig: sig,
      completedAt:   new Date().toISOString(),
      updatedAt:     new Date().toISOString(),
      updatedBy:     actor,
      status:        STATUS.COMPLETED,
    });

    closeModal('modalReview');
    await Dashboard.render();
    alert('✅ ยืนยันเรียบร้อย! ฟอร์มปิดแล้ว');
  },
};

// ========================= INIT =========================
document.addEventListener('DOMContentLoaded', async () => {
  initModalOverlays();
  SearchSuggest.bindEvents();
  await Dashboard.render();
  await SearchSuggest.refreshSource();
});
