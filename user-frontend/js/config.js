// ================================================
// Shared Configuration & Utility Functions
// ================================================

const API_URL = 'http://localhost:3001/api';

// ── Formatters ─────────────────────────────────

function formatType(type) {
    const types = {
        hotdesk: 'Hot Desk',
        cabin: 'Private Cabin',
        meeting_room: 'Meeting Room',
        conference: 'Conference Hall'
    };
    return types[type] || type;
}

function formatStatus(status) {
    const statuses = {
        confirmed: 'Confirmed',
        checked_in: 'Checked In',
        completed: 'Completed',
        cancelled: 'Cancelled'
    };
    return statuses[status] || status;
}

function formatPaymentMethod(method) {
    const methods = {
        card: 'Credit/Debit Card',
        upi: 'UPI',
        netbanking: 'Net Banking',
        wallet: 'Wallet'
    };
    return methods[method] || method;
}

function formatDateTime(dateTime) {
    // Parse ISO string directly: "2026-02-25T21:30:00.000Z"
    const isoString = dateTime.includes('T') ? dateTime : new Date(dateTime).toISOString();
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

function formatCurrency(amount) {
    return `₹${Number(amount).toFixed(2)}`;
}

// ── Star Rating ─────────────────────────────────

function generateStars(rating) {
    const full = Math.floor(rating);
    const half = rating % 1 >= 0.5;
    const empty = 5 - full - (half ? 1 : 0);
    return (
        '<i class="fas fa-star" style="color:#f39c12;"></i>'.repeat(full) +
        (half ? '<i class="fas fa-star-half-alt" style="color:#f39c12;"></i>' : '') +
        '<i class="far fa-star" style="color:#f39c12;"></i>'.repeat(empty)
    );
}

// ── Session / LocalStorage Helpers ─────────────

function saveSession(key, value) {
    sessionStorage.setItem(key, JSON.stringify(value));
}

function getSession(key) {
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
}

function clearSession(key) {
    sessionStorage.removeItem(key);
}

// ── URL Params ──────────────────────────────────

function getParam(name) {
    return new URLSearchParams(window.location.search).get(name);
}

// ── Toast / Alert Helper ────────────────────────

function showToast(message, type = 'info') {
    let toast = document.getElementById('ws-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'ws-toast';
        toast.style.cssText = `
            position:fixed; bottom:1.5rem; right:1.5rem; z-index:9999;
            padding:1rem 1.5rem; border-radius:8px; font-weight:600;
            color:white; max-width:350px; box-shadow:0 4px 12px rgba(0,0,0,.2);
            transition:opacity .3s;
        `;
        document.body.appendChild(toast);
    }
    const colors = { success: '#27ae60', error: '#e74c3c', info: '#3498db', warning: '#f39c12' };
    toast.style.background = colors[type] || colors.info;
    toast.textContent = message;
    toast.style.opacity = '1';
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => { toast.style.opacity = '0'; }, 3500);
}

// ── Loading Placeholder ─────────────────────────

function loadingHTML(msg = 'Loading...') {
    return `<div class="loading"><i class="fas fa-spinner fa-spin"></i><p>${msg}</p></div>`;
}

function noDataHTML(icon = 'fa-inbox', title = 'No data found', sub = '') {
    return `<div class="no-data"><i class="fas ${icon}"></i><h3>${title}</h3>${sub ? `<p>${sub}</p>` : ''}</div>`;
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

// ── Form Validation ─────────────────────────────

/**
 * Validates all fields in a form that have the [data-validate] attribute.
 * Returns true if all fields pass, false otherwise.
 */
function validateForm(formEl) {
    let valid = true;
    formEl.querySelectorAll('[data-validate]').forEach(field => {
        clearFieldError(field);
        const rules = field.getAttribute('data-validate').split('|');
        for (const rule of rules) {
            const [r, param] = rule.split(':');
            const err = checkValidationRule(r, param, field);
            if (err) { showFieldError(field, err); valid = false; break; }
        }
    });
    return valid;
}

function checkValidationRule(rule, param, field) {
    const val = field.value.trim();
    const label = field.getAttribute('data-label') || field.id || 'This field';
    if (rule === 'required' && !val) return `${label} is required.`;
    if (rule === 'email' && val && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) return 'Enter a valid email address.';
    if (rule === 'min' && val && Number(val) < Number(param)) return `Minimum value is ${param}.`;
    if (rule === 'max' && val && Number(val) > Number(param)) return `Maximum value is ${param}.`;
    if (rule === 'minlen' && val && val.length < Number(param)) return `Minimum ${param} characters required.`;
    if (rule === 'future' && val && new Date(val) <= new Date()) return `${label} must be a future date/time.`;
    if (rule === 'afterField') {
        const other = document.getElementById(param);
        if (other && val && other.value && new Date(val) <= new Date(other.value))
            return `Must be after ${other.getAttribute('data-label') || param}.`;
    }
    return null;
}

function showFieldError(field, msg) {
    field.classList.add('input-error');
    const span = document.createElement('span');
    span.className = 'field-error';
    span.textContent = msg;
    field.parentNode.appendChild(span);
}

function clearFieldError(field) {
    field.classList.remove('input-error');
    const existing = field.parentNode.querySelector('.field-error');
    if (existing) existing.remove();
}
