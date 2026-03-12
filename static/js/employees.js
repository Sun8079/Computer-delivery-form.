// ============================================================
//  employees.js — Employee Directory (loaded from /api/employees)
// ============================================================

// EMPLOYEES starts empty; populated async from /api/employees (employee_data.xlsx).
let EMPLOYEES = [];

const employeesReady = (async () => {
  try {
    const res = await fetch('/api/employees');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        EMPLOYEES = data;
      }
    }
  } catch (_) { /* ignore — page still works with empty list */ }
})();
