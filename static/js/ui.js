// ============================================================
//  ui.js  — UI Helper Functions (ใช้ร่วมทุกหน้า)
// ============================================================
//
//  โหลดลำดับที่: 6 (หลัง signature.js)
//
//  ┌─────────────────────────────────────────────────────────┐
//  │  renderBadge(status)    → HTML badge สีตามสถานะ      │
//  │    └→ ใช้ใน Dashboard และ History ตาราง     │
//  │                                                         │
//  │  renderSigBox(l,img,d)  → HTML กล่องลายเซ็น read-only  │
//  │    └→ ใช้ใน buildFormView() และ modal view    │
//  │                                                         │
//  │  buildFormView(f)       → HTML สรุปข้อมูลฟอร์ม     │
//  │    └→ ใช้ใน ViewModal และ ReviewModal          │
//  │    └→ แสดงเฉพาะรายการที่ adminChecked=true   │
//  │                                                         │
//  │  printFormById(id)      เปิดหน้าต่างพิมพ์ A4      │
//  │    └→ โหลดข้อมูล → สร้างหน้าจาก HTML template │
//  │    └→ เรียก window.print() อัตโนมัติ              │
//  │    └→ Layout: info 3 คอล, checklist 2 คอล       │
//  │                                                         │
//  │  openModal(id)          เปิด modal                      │
//  │  closeModal(id)         ปิด modal                      │
//  │  initModalOverlays()    ปิดเมื่อคลิกนอก                │
//  └─────────────────────────────────────────────────────────┘
//
//  Call Flow:
//    admin.js → _renderTable()    → renderBadge(), _actionBtns()
//    admin.js → ViewModal.open()  → buildFormView(f) → renderSigBox()
//    admin.js → _actionBtns()     → printFormById(id)
//    admin.js → DOMContentLoaded  → initModalOverlays()
//
// ============================================================

// -------------------- BADGE HTML --------------------
// สร้าง HTML badge สีเปลี่ยนตามสถานะ — CSS class สร้างจาก shared.css
function renderBadge(status) {
  return `<span class="badge badge-${status}">${STATUS_LABEL[status] || status}</span>`;
}

// -------------------- SIGNATURE BOX (view only) --------------------
// แสดงกล่องลายเซ็นแบบ read-only (ไม่ใช่ canvas) — ใช้สำหรับแสดงใน modal view และหน้าสรุป
function renderSigBox(label, sigData, dateStr) {
  return `
    <div class="sig-box-view">
      <div class="sig-box-label">${label}</div>
      ${sigData
        ? `<img src="${sigData}" alt="ลายเซ็น" class="sig-img">`  // แสดงรูป base64 PNG
        : `<div class="sig-empty">ยังไม่ได้เซ็น</div>`    // placeholder
      }
      <div class="sig-box-date">${Utils.fmtDate(dateStr)}</div>
    </div>
  `;
}

// -------------------- BUILD FORM VIEW (HTML สรุปฟอร์ม) --------------------
// ใช้ทั้งใน modal view และหน้า user
function buildFormView(f) {
  const checklist = Array.isArray(f.checklist) ? f.checklist : [];
  const issues = checklist.filter(c => c.userStatus === 'issue');

  return `
    <!-- Status & Meta -->
    <div class="view-meta">
      ${renderBadge(f.status)}
      <span class="mono text-muted">${f.id}</span>
      <span class="text-muted small">สร้าง: ${Utils.fmtDateTime(f.createdAt)}</span>
      ${f.revision ? `<span class="text-muted small">Revision: ${f.revision}</span>` : ''}
      ${f.updatedBy ? `<span class="text-muted small">อัปเดตโดย: ${f.updatedBy}</span>` : ''}
      ${f.completedAt
        ? `<span class="text-success small">เสร็จ: ${Utils.fmtDateTime(f.completedAt)}</span>`
        : ''}
    </div>

    <!-- Info Grid -->
    <div class="view-info-grid">
      <div class="info-box">
        <div class="info-box-title">👤 ข้อมูลพนักงาน</div>
        <div class="info-row"><span class="lbl">ชื่อ-นามสกุล</span><span class="val">${f.empName}</span></div>
        <div class="info-row"><span class="lbl">รหัสพนักงาน</span><span class="val mono">${f.empCode}</span></div>
        <div class="info-row"><span class="lbl">แผนก</span><span class="val">${f.empDept || '—'}</span></div>
        <div class="info-row"><span class="lbl">Email</span><span class="val">${f.empEmail || '—'}</span></div>
      </div>
      <div class="info-box">
        <div class="info-box-title">💻 ข้อมูลครุภัณฑ์</div>
        <div class="info-row"><span class="lbl">รหัส</span><span class="val mono">${f.assetCode}</span></div>
        <div class="info-row"><span class="lbl">รุ่น</span><span class="val">${f.assetModel || '—'}</span></div>
        <div class="info-row"><span class="lbl">Serial</span><span class="val mono">${f.assetSerial || '—'}</span></div>
        <div class="info-row"><span class="lbl">Spec</span><span class="val small">${f.assetSpec || '—'}</span></div>
        <div class="info-row"><span class="lbl">วันส่งมอบ</span><span class="val">${Utils.fmtDate(f.deliverDate)}</span></div>
        <div class="info-row"><span class="lbl">สถานที่</span><span class="val">${f.location || '—'}</span></div>
      </div>
    </div>

    <!-- Checklist — รองรับทั้ง template มาตรฐานและ custom -->
    ${(() => {
      if (!checklist.length) return '';
      const catMap = new Map();
      checklist.forEach(c => {
        const cat = c.category || '';
        if (!catMap.has(cat)) {
          const tmplSec = CHECKLIST_TEMPLATE.find(s => s.category === cat);
          catMap.set(cat, { label: c.sectionLabel || tmplSec?.label || cat, items: [] });
        }
        catMap.get(cat).items.push(c);
      });
      return [...catMap.values()].map(sec => `
        <div class="checklist-view-section">
          <div class="checklist-view-title">${sec.label}</div>
          <div class="checklist-view-header">
            <span></span><span>รายการ</span>
            <span class="center">Admin</span>
            <span class="center">User</span>
          </div>
          ${sec.items.map(c => `
            <div class="checklist-view-row">
              <span class="check-icon">${c.adminChecked ? '✅' : '⬜'}</span>
              <span class="item-name">
                ${c.group ? `<span style="font-size:11px;color:var(--text3)">${c.group} › </span>` : ''}${c.item}
                ${c.adminNote ? `<small class="admin-note">📌 ${c.adminNote}</small>` : ''}
              </span>
              <span class="center">${c.adminChecked ? '<span class="tag-ok">ผ่าน</span>' : '<span class="tag-empty">—</span>'}</span>
              <span class="center">
                ${c.adminChecked
                  ? (c.userStatus === 'ok'
                      ? `<span class="tag-ok">✓ ปกติ</span>`
                      : c.userStatus === 'issue'
                        ? `<span class="tag-issue">⚠ ปัญหา</span>${c.userNote ? `<small class="user-note">${c.userNote}</small>` : ''}`
                        : `<span class="tag-empty">ยังไม่กรอก</span>`)
                  : '<span class="tag-empty">—</span>'}
              </span>
            </div>
          `).join('')}
        </div>
      `).join('');
    })()}

    <!-- User Test Items -->
    ${(f.userTestItems && f.userTestItems.length) || f.userReceiveDate ? `
      <div class="user-test-box">
        <div class="user-test-title">📋 ผู้รับมอบทดสอบการใช้งาน</div>
        ${f.userTestItems && f.userTestItems.length ? `
          <div class="user-test-list">
            ${f.userTestItems.map(t => `
              <div class="user-test-item">☑ ${t}</div>
            `).join('')}
          </div>
        ` : '<div style="font-size:13px;color:var(--text3)">ไม่ได้ระบุรายการทดสอบ</div>'}
        ${f.userReceiveDate ? `
          <div style="margin-top:8px;font-size:13px;color:var(--text2)">
            📅 วันที่รับมอบ: <b>${Utils.fmtDate(f.userReceiveDate)}</b>
          </div>
        ` : ''}
      </div>
    ` : ''}

    <!-- Issues Summary -->
    ${issues.length ? `
      <div class="issues-summary">
        <div class="issues-title">⚠️ ปัญหาที่ User แจ้ง (${issues.length} รายการ)</div>
        ${issues.map(c => `
          <div class="issue-item">• ${c.item}${c.userNote ? ': ' + c.userNote : ''}</div>
        `).join('')}
        ${f.userIssues
          ? `<div class="issue-extra">หมายเหตุเพิ่มเติม: ${f.userIssues}</div>`
          : ''}
      </div>
    ` : ''}

    <!-- Admin Note -->
    ${f.adminNote ? `
      <div class="admin-note-box">
        <strong>หมายเหตุ Admin:</strong> ${f.adminNote}
      </div>
    ` : ''}

    ${f.lastEditNote ? `
      <div class="admin-note-box">
        <strong>หมายเหตุการแก้ไขล่าสุด:</strong> ${f.lastEditNote}
      </div>
    ` : ''}

    ${f.lastReturnNote ? `
      <div class="issues-summary">
        <div class="issues-title">↩ หมายเหตุที่ส่งกลับให้ User แก้ไข</div>
        <div class="issue-item">${f.lastReturnNote}</div>
      </div>
    ` : ''}

    <!-- Signatures -->
    <div class="sig-row ${f.adminFinalSig ? 'three-col' : 'two-col'}">
      ${renderSigBox('เจ้าหน้าที่ IT (ตรวจสอบ)', f.adminSig,      f.createdAt)}
      ${renderSigBox('ผู้รับครุภัณฑ์',            f.userSig,       f.userFilledAt)}
      ${f.adminFinalSig
        ? renderSigBox('เจ้าหน้าที่ IT (ยืนยัน)', f.adminFinalSig, f.completedAt)
        : ''}
    </div>
  `;
}

// -------------------- PRINT A4 --------------------
async function printFormById(id) {
  const f = await DB.getById(id);
  if (!f) return;
  const checklist = Array.isArray(f.checklist) ? f.checklist : [];
  const issues    = checklist.filter(c => c.userStatus === 'issue');
  const win = window.open('', '_blank');

  win.document.write(`<!DOCTYPE html>
<html lang="th"><head>
<meta charset="UTF-8">
<title>แบบฟอร์ม ${f.id}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Sarabun', sans-serif; font-size: 10.5px; color: #111; }

  /* Header */
  .print-title { font-size: 14px; font-weight: 700; text-align: center; margin-bottom: 2px; }
  .print-sub   { text-align: center; color: #555; font-size: 9.5px; margin-bottom: 8px; }

  /* Info grid — 3 คอลัมน์ เพื่อบีบให้สั้น */
  .info-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 3px 10px; border: 1px solid #bbb; border-radius: 4px; padding: 6px 10px; margin-bottom: 7px; }
  .info-lbl  { font-size: 8.5px; color: #777; }
  .info-val  { font-weight: 600; font-size: 10px; }

  /* Checklist 2 คอลัมน์ ซ้าย-ขวา */
  .cl-cols   { display: grid; grid-template-columns: 1fr 1fr; gap: 0 12px; margin-bottom: 6px; }
  .sec-title { font-size: 8.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: #555; border-bottom: 1px solid #ccc; padding-bottom: 2px; margin: 6px 0 3px; }
  .cl-header { display: grid; grid-template-columns: 1fr 48px 48px; gap: 4px; font-size: 7.5px; font-weight: 700; color: #888; text-transform: uppercase; padding: 2px 0; }
  .cl-row    { display: grid; grid-template-columns: 1fr 48px 48px; gap: 4px; padding: 2px 0; border-bottom: 1px solid #f0f0f0; font-size: 9.5px; align-items: start; }
  .center    { text-align: center; }

  /* Issues */
  .issues-box { background: #fff5f5; border: 1px solid #fecaca; border-radius: 3px; padding: 5px 7px; margin: 5px 0; font-size: 9.5px; }

  /* User summary */
  .user-box { background: #f0f9ff; border: 1px solid #bfdbfe; border-radius: 3px; padding: 5px 7px; margin: 5px 0; font-size: 9.5px; }
  .user-box .hd { font-weight: 700; color: #1d4ed8; margin-bottom: 3px; }
  .user-box .row { margin: 1px 0; }

  /* Admin note */
  .note-box { background: #f5f5f5; border-radius: 3px; padding: 4px 7px; font-size: 9.5px; margin: 5px 0; }

  /* Signatures */
  .sig-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-top: 8px; }
  .sig-box  { border: 1px solid #bbb; border-radius: 4px; padding: 5px; text-align: center; }
  .sig-box img   { max-height: 42px; max-width: 100%; object-fit: contain; display: block; margin: 0 auto; }
  .sig-box .lbl  { font-size: 8.5px; color: #666; margin-bottom: 3px; }
  .sig-box .date { font-size: 8.5px; color: #888; margin-top: 3px; }
  .sig-empty-ln  { height: 38px; }

  /* Footer */
  .print-footer { text-align: center; font-size: 8.5px; color: #aaa; margin-top: 7px; border-top: 1px solid #eee; padding-top: 5px; }

  @media print {
    html, body { height: 100%; }
    body { padding: 8mm 12mm 6mm; }
    @page { size: A4 portrait; margin: 0; }
  }
  @media screen {
    body { padding: 14mm 18mm; max-width: 210mm; margin: 0 auto; background: #eee; }
    body > * { background: #fff; }
  }
</style>
</head><body>

<div class="print-title">แบบฟอร์มส่งมอบครุภัณฑ์คอมพิวเตอร์</div>
<div class="print-sub">
  รหัสฟอร์ม: ${f.id} &nbsp;|&nbsp;
  สถานะ: ${STATUS_LABEL[f.status]} &nbsp;|&nbsp;
  วันที่สร้าง: ${Utils.fmtDate(f.createdAt)}
  ${f.completedAt ? ' &nbsp;|&nbsp; วันที่เสร็จ: ' + Utils.fmtDate(f.completedAt) : ''}
</div>

<!-- Info 3 คอลัมน์ -->
<div class="info-grid">
  <div><div class="info-lbl">ชื่อ-นามสกุล</div><div class="info-val">${f.empName}</div></div>
  <div><div class="info-lbl">รหัสพนักงาน</div><div class="info-val">${f.empCode}</div></div>
  <div><div class="info-lbl">แผนก</div><div class="info-val">${f.empDept || '—'}</div></div>
  <div><div class="info-lbl">รหัสครุภัณฑ์</div><div class="info-val">${f.assetCode}</div></div>
  <div><div class="info-lbl">ยี่ห้อ / รุ่น</div><div class="info-val">${f.assetModel || '—'}</div></div>
  <div><div class="info-lbl">Serial Number</div><div class="info-val">${f.assetSerial || '—'}</div></div>
  <div><div class="info-lbl">Spec</div><div class="info-val">${f.assetSpec || '—'}</div></div>
  <div><div class="info-lbl">สถานที่ส่งมอบ</div><div class="info-val">${f.location || '—'}</div></div>
  <div><div class="info-lbl">วันที่ส่งมอบ</div><div class="info-val">${Utils.fmtDate(f.deliverDate)}</div></div>
</div>

<!-- Checklist 2 คอลัมน์ เฉพาะรายการที่ Admin เลือก -->
<div class="cl-cols">
  ${CHECKLIST_TEMPLATE.map(sec => {
    const items = checklist.filter(c => c.category === sec.category && c.adminChecked === true);
    if (!items.length) return '';
    return `
      <div>
        <div class="sec-title">${sec.label}</div>
        <div class="cl-header">
          <span>รายการ</span>
          <span class="center">Admin</span>
          <span class="center">User</span>
        </div>
        ${items.map(c => `
          <div class="cl-row">
            <span>
              ☑ ${c.item}
              ${c.adminNote ? `<br><span style="color:#666;font-size:8px"><b>หมายเหตุ:</b> ${c.adminNote}</span>` : ''}
            </span>
            <span class="center">ผ่าน</span>
            <span class="center" style="color:${c.userStatus === 'issue' ? '#b91c1c' : 'inherit'}">
              ${c.userStatus === 'ok'    ? 'ปกติ'    : ''}
              ${c.userStatus === 'issue' ? '⚠ปัญหา' : ''}
              ${!c.userStatus            ? '—'        : ''}
              ${c.userNote ? `<br><span style="font-size:8px;color:#b91c1c"><b>หมายเหตุ:</b> ${c.userNote}</span>` : ''}
            </span>
          </div>
        `).join('')}
      </div>
    `;
  }).join('')}
</div>

<!-- User Summary -->
<div class="user-box">
  <div class="hd">ข้อมูลที่ User กรอก</div>
  <div class="row"><b>วันที่รับมอบ:</b> ${f.userReceiveDate ? Utils.fmtDate(f.userReceiveDate) : '—'}</div>
  <div class="row"><b>ผลการตรวจ:</b> ปกติ ${checklist.filter(c => c.adminChecked && c.userStatus === 'ok').length} รายการ, มีปัญหา ${checklist.filter(c => c.adminChecked && c.userStatus === 'issue').length} รายการ</div>
  <div class="row"><b>รายการทดสอบ:</b> ${(Array.isArray(f.userTestItems) && f.userTestItems.length) ? f.userTestItems.join(', ') : '—'}</div>
  <div class="row"><b>หมายเหตุ:</b> ${f.userIssues || '—'}</div>
</div>

<!-- Issues -->
${issues.length ? `
  <div class="issues-box">
    <strong>⚠️ ปัญหาที่ User แจ้ง:</strong><br>
    ${issues.map(c =>
      `• ${c.item}${c.userNote ? ': ' + c.userNote : ''}`
    ).join('<br>')}
    ${f.userIssues ? `<br><strong>หมายเหตุ:</strong> ${f.userIssues}` : ''}
  </div>
` : ''}

<!-- Admin note -->
${f.adminNote ? `
  <div class="note-box"><strong>หมายเหตุ Admin:</strong> ${f.adminNote}</div>
` : ''}

<!-- Signatures -->
<div class="sig-grid">
  <div class="sig-box">
    <div class="lbl">เจ้าหน้าที่ IT (ตรวจสอบ)</div>
    ${f.adminSig ? `<img src="${f.adminSig}">` : '<div class="sig-empty-ln"></div>'}
    <div class="date">${Utils.fmtDate(f.createdAt)}</div>
  </div>
  <div class="sig-box">
    <div class="lbl">ผู้รับครุภัณฑ์</div>
    ${f.userSig ? `<img src="${f.userSig}">` : '<div class="sig-empty-ln"></div>'}
    <div class="date">${Utils.fmtDate(f.userFilledAt)}</div>
  </div>
  <div class="sig-box">
    <div class="lbl">เจ้าหน้าที่ IT (ยืนยัน)</div>
    ${f.adminFinalSig ? `<img src="${f.adminFinalSig}">` : '<div class="sig-empty-ln"></div>'}
    <div class="date">${Utils.fmtDate(f.completedAt)}</div>
  </div>
</div>

<div class="print-footer">
  IT Asset Delivery System &nbsp;|&nbsp; พิมพ์วันที่ ${Utils.fmtDate(new Date())}
</div>

<script>window.onload = () => window.print();<\/script>
</body></html>`);

  win.document.close();
}

// -------------------- MODAL HELPERS --------------------
// เปิด/ปิด modal ด้วยการเพิ่ม/ลบ CSS class 'open'
function openModal(id) {
  document.getElementById(id)?.classList.add('open');
}
function closeModal(id) {
  document.getElementById(id)?.classList.remove('open');
}
// ปิด modal เมื่อคลิก overlay ด้านนอก (e.target === el หมายความคลิกที่ overlay โดยตรง ไม่ใช่เนื้อหา)
function initModalOverlays() {
  document.querySelectorAll('.modal-overlay').forEach(el => {
    el.addEventListener('click', e => {
      if (e.target === el) el.classList.remove('open');
    });
  });
}
