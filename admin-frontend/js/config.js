// ================================================
// Admin – Shared Configuration & Utilities
// ================================================

const API_URL = 'http://localhost:3001/api';

function formatType(type) {
    const m = { hotdesk: 'Hot Desk', cabin: 'Private Cabin', meeting_room: 'Meeting Room', conference: 'Conference Hall' };
    return m[type] || type;
}

function formatStatus(status) {
    const m = { confirmed: 'Confirmed', checked_in: 'Checked In', completed: 'Completed', cancelled: 'Cancelled' };
    return m[status] || status;
}

function formatDateTime(dt) {
    // Parse ISO string directly: "2026-02-25T21:30:00.000Z"
    const isoString = dt.includes('T') ? dt : new Date(dt).toISOString();
    const [datePart, timePart] = isoString.split('T');
    const [year, month, day] = datePart.split('-');
    const [hourMin] = timePart.split(':');
    const hours24 = parseInt(hourMin);
    const minutes = timePart.split(':')[1];

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthName = months[parseInt(month) - 1];
    const ampm = hours24 >= 12 ? 'pm' : 'am';
    const hours12 = hours24 % 12 || 12;

    return `${parseInt(day)} ${monthName} ${year}, ${String(hours12).padStart(2, '0')}:${minutes} ${ampm}`;
}

function formatCurrency(n) { return `₹${Number(n).toFixed(2)}`; }

function getParam(name) { return new URLSearchParams(window.location.search).get(name); }

function showToast(msg, type = 'info') {
    let t = document.getElementById('admin-toast');
    if (!t) {
        t = document.createElement('div');
        t.id = 'admin-toast';
        t.style.cssText = 'position:fixed;bottom:1.5rem;right:1.5rem;z-index:9999;padding:1rem 1.5rem;border:1px solid;font-weight:600;color:white;max-width:350px;transition:opacity .3s;';
        document.body.appendChild(t);
    }
    const c = { success: '#27ae60', error: '#e74c3c', info: '#3498db', warning: '#f39c12' };
    t.style.background = c[type] || c.info;
    t.textContent = msg;
    t.style.opacity = '1';
    clearTimeout(t._timer);
    t._timer = setTimeout(() => { t.style.opacity = '0'; }, 3500);
}

function loadingHTML(msg = 'Loading...') {
    return `<div class="loading"><i class="fas fa-spinner fa-spin"></i><p>${msg}</p></div>`;
}

function noDataHTML(icon = 'fa-inbox', title = 'No data', sub = '') {
    return `<div class="no-data"><i class="fas ${icon}"></i><h3>${title}</h3>${sub ? `<p>${sub}</p>` : ''}</div>`;
}

// ── Validation helpers ──────────────────────────

/**
 * Reads all [data-validate] inputs/selects/textareas in the given form element,
 * displays inline error messages, and returns true only if everything passes.
 */
function validateForm(formEl) {
    let valid = true;
    formEl.querySelectorAll('[data-validate]').forEach(field => {
        clearFieldError(field);
        const rules = field.getAttribute('data-validate').split('|');
        for (const rule of rules) {
            const [r, param] = rule.split(':');
            const err = checkRule(r, param, field);
            if (err) { showFieldError(field, err); valid = false; break; }
        }
    });
    return valid;
}

function checkRule(rule, param, field) {
    const val = field.value.trim();
    if (rule === 'required' && !val) return field.getAttribute('data-label') || 'This field' + ' is required.';
    if (rule === 'email' && val && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) return 'Enter a valid email address.';
    if (rule === 'min' && val && Number(val) < Number(param)) return `Minimum value is ${param}.`;
    if (rule === 'max' && val && Number(val) > Number(param)) return `Maximum value is ${param}.`;
    if (rule === 'minlen' && val && val.length < Number(param)) return `Minimum ${param} characters required.`;
    if (rule === 'phone' && val && !/^[6-9]\d{9}$/.test(val)) return 'Enter a valid 10-digit Indian mobile number.';
    if (rule === 'pincode' && val && !/^\d{6}$/.test(val)) return 'Enter a valid 6-digit pincode.';
    return null;
}

function showFieldError(field, msg) {
    field.classList.add('input-error');
    const err = document.createElement('span');
    err.className = 'field-error';
    err.textContent = msg;
    field.parentNode.appendChild(err);
}

function clearFieldError(field) {
    field.classList.remove('input-error');
    const existing = field.parentNode.querySelector('.field-error');
    if (existing) existing.remove();
}

// ── Transactions (localStorage) ─────────────────

function getTransactions() {
    return JSON.parse(localStorage.getItem('transactions') || '[]');
}

function saveTransaction(txn) {
    const list = getTransactions();
    list.push(txn);
    localStorage.setItem('transactions', JSON.stringify(list));
}

// ── Additional Formatters ──────────────────────

function formatPaymentMethod(method) {
    const m = {
        upi: 'UPI',
        card: 'Card',
        netbanking: 'Net Banking',
        wallet: 'Wallet',
        cash: 'Cash'
    };
    return m[method] || method || '—';
}
