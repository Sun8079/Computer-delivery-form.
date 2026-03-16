// ============================================================
//  admin-employees.js — Employee upload/export for admin.html
//  Scope: ใช้เฉพาะหน้า Template Manager (admin.html)
// ============================================================

const EmpMgr = (() => {
  let _pendingData = null;

  async function init() {
    try {
      const token = Auth.getToken();
      const res = await fetch('/api/employees', { headers: { Authorization: 'Bearer ' + token } });
      if (res.ok) {
        const data = await res.json();
        document.getElementById('empCount').textContent = `${data.length} คน`;
      }
    } catch (_) {
      document.getElementById('empCount').textContent = 'ไม่สามารถโหลดข้อมูลได้';
    }
  }

  function onFileSelected(input) {
    const file = input.files[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      _showMsg('❌ รองรับเฉพาะไฟล์ .xlsx เท่านั้น', false);
      input.value = '';
      return;
    }

    _pendingData = { file };
    _showPendingFile(file.name);
    input.value = '';
  }

  function _showPendingFile(name) {
    const tbody = document.getElementById('empPreviewBody');
    tbody.innerHTML = `<tr><td colspan="5" style="padding:10px;color:var(--text2);text-align:center">📄 ${name}</td></tr>`;
    document.getElementById('empPreviewLabel').textContent = 'ไฟล์ที่เลือก — กด "ยืนยันอัปโหลด" เพื่อบันทึก';
    document.getElementById('empPreviewWrap').style.display = 'block';
    document.getElementById('empMsg').style.display = 'none';
  }

  async function _refreshPreviewAfterUpload(count) {
    const tbody = document.getElementById('empPreviewBody');
    try {
      const token = Auth.getToken();
      const res = await fetch('/api/employees', { headers: { Authorization: 'Bearer ' + token } });
      if (res.ok) {
        const rows = await res.json();
        tbody.innerHTML = rows.slice(0, 10).map((r, i) => `
          <tr style="border-top:1px solid var(--border)">
            <td style="padding:5px 10px;color:var(--text3)">${i + 1}</td>
            <td style="padding:5px 10px">${r.code}</td>
            <td style="padding:5px 10px">${r.fullName}</td>
            <td style="padding:5px 10px">${r.department}</td>
            <td style="padding:5px 10px">${r.company}</td>
          </tr>`).join('') +
          (rows.length > 10 ? `<tr><td colspan="5" style="padding:5px 10px;color:var(--text3);text-align:center">... และอีก ${rows.length - 10} รายการ</td></tr>` : '');
        document.getElementById('empPreviewLabel').textContent = `อัปโหลดสำเร็จ — ${count} คน (แสดง 10 รายการแรก)`;
      }
    } catch (_) {
      // ไม่แสดงข้อผิดพลาดถ้าโหลด preview ไม่ได้
    }
  }

  async function confirmUpload() {
    if (!_pendingData) return;

    const { file } = _pendingData;
    const token = Auth.getToken();
    const fd = new FormData();
    fd.append('file', file);

    try {
      const res = await fetch('/api/employees/upload', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token },
        body: fd,
      });
      const json = await res.json();
      if (res.ok) {
        _showMsg('✅ ' + json.message, true);
        document.getElementById('empCount').textContent = `${json.count} คน`;
        _pendingData = null;
        await _refreshPreviewAfterUpload(json.count);
      } else {
        _showMsg('❌ ' + (json.detail || 'อัปโหลดไม่สำเร็จ'), false);
      }
    } catch (_) {
      _showMsg('❌ ไม่สามารถเชื่อมต่อ server ได้', false);
    }
  }

  function cancelPreview() {
    _pendingData = null;
    document.getElementById('empPreviewWrap').style.display = 'none';
    document.getElementById('empPreviewBody').innerHTML = '';
  }

  function _showMsg(text, ok) {
    const el = document.getElementById('empMsg');
    el.textContent = text;
    el.style.display = 'block';
    el.style.background = ok ? 'rgba(16,185,129,.15)' : 'rgba(239,68,68,.12)';
    el.style.color = ok ? 'var(--success)' : 'var(--danger)';
  }

  async function downloadXLSX() {
    const token = Auth.getToken();
    try {
      const res = await fetch('/api/employees/export', {
        headers: { Authorization: 'Bearer ' + token },
      });
      if (!res.ok) {
        _showMsg('❌ ดาวน์โหลดไม่สำเร็จ', false);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'employee_data.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    } catch (_) {
      _showMsg('❌ ไม่สามารถเชื่อมต่อ server ได้', false);
    }
  }

  return { init, onFileSelected, confirmUpload, cancelPreview, downloadXLSX };
})();

document.addEventListener('DOMContentLoaded', () => EmpMgr.init());
