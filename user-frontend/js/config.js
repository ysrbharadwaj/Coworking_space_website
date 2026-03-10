// ================================================
// Shared Configuration & Utility Functions
// ================================================

const API_URL = 'http://localhost:3001/api';

// Google OAuth Configuration
// IMPORTANT: Replace this with your actual Google Client ID from Google Cloud Console
const GOOGLE_CLIENT_ID = '894839191711-dm93d40qebp8hrlilh5lbfucem4tpemf.apps.googleusercontent.com';

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

// ── Authentication Helpers ──────────────────────

/** Save JWT token to localStorage (persists across browser sessions) */
function saveToken(token) {
    localStorage.setItem('authToken', token);
}

/** Retrieve stored JWT token */
function getToken() {
    return localStorage.getItem('authToken');
}

/** Clear stored token */
function clearToken() {
    localStorage.removeItem('authToken');
}

/** Get the currently logged-in user object from sessionStorage.
 *  Falls back to localStorage if session was lost (e.g., new tab). */
function getCurrentUser() {
    return getSession('currentUser') || JSON.parse(localStorage.getItem('currentUser') || 'null');
}

/**
 * Auth guard – call at the top of every protected page's DOMContentLoaded.
 * Shows a loading overlay while verifying, then either reveals the page
 * or redirects to auth.html if the user is not authenticated.
 * Returns the user object on success (or null on redirect).
 */
function requireAuth() {
    const user  = getCurrentUser();
    const token = getToken();
    if (!user || !token) {
        window.location.href = 'auth.html';
        return null;
    }
    // Refresh sessionStorage in case we're in a new tab
    if (!getSession('currentUser')) {
        saveSession('currentUser', user);
    }
    // Hide loading overlay if present, reveal page content
    const overlay = document.getElementById('auth-loading-overlay');
    if (overlay) overlay.style.display = 'none';
    // Auto-populate navbar user info
    initNavUser(user);
    return user;
}

/**
 * Populates the navbar user avatar, name, and dropdown info.
 * Called automatically by requireAuth() – no need to call it manually.
 */
function initNavUser(user) {
    user = user || getCurrentUser();
    if (!user) return;

    const name     = user.name  || user.email || 'User';
    const email    = user.email || '';
    const initials = name.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();

    const nameEl    = document.getElementById('user-name');
    const avatarEl  = document.getElementById('user-avatar');
    const ddName    = document.getElementById('user-dropdown-name');
    const ddEmail   = document.getElementById('user-dropdown-email');
    const ddAvatar  = document.getElementById('user-dropdown-avatar');

    if (nameEl)   nameEl.textContent   = name;
    if (avatarEl) avatarEl.textContent = initials;
    if (ddName)   ddName.textContent   = name;
    if (ddEmail)  ddEmail.textContent  = email;
    if (ddAvatar) ddAvatar.textContent = initials;
}

/**
 * Toggle the user dropdown open/closed.
 * Wired to onclick="toggleUserMenu()" in every navbar.
 */
function toggleUserMenu() {
    const dd = document.getElementById('user-dropdown');
    if (!dd) return;
    dd.style.display = dd.style.display === 'block' ? 'none' : 'block';
}

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('.nav-user')) {
        const dd = document.getElementById('user-dropdown');
        if (dd) dd.style.display = 'none';
    }
});

/**
 * Returns fetch headers including the Authorization Bearer token.
 * Always includes Content-Type: application/json.
 */
function getAuthHeaders() {
    const token = getToken();
    return {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
}

/** Log the current user out and redirect to auth page. */
function logout() {
    clearToken();
    clearSession('currentUser');
    clearSession('pendingBooking');
    clearSession('confirmedBooking');
    localStorage.removeItem('currentUser');
    localStorage.removeItem('transactions');
    window.location.href = 'auth.html';
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
    if (rule === 'maxlen' && val && val.length > Number(param)) return `${label} must not exceed ${param} characters.`;
    if (rule === 'future' && val && new Date(val) <= new Date()) return `${label} must be a future date/time.`;
    if (rule === 'afterField') {
        const other = document.getElementById(param);
        if (other && val && other.value && new Date(val) <= new Date(other.value))
            return `Must be after ${other.getAttribute('data-label') || param}.`;
    }
    if (rule === 'maxfuturedays' && val) {
        const limit = new Date();
        limit.setDate(limit.getDate() + Number(param));
        if (new Date(val) > limit) return `${label} cannot be more than ${param} days in the future.`;
    }
    if (rule === 'maxduration' && val) {
        const startField = document.getElementById('start-time');
        if (startField && startField.value) {
            const diffHrs = (new Date(val) - new Date(startField.value)) / 3600000;
            if (diffHrs > Number(param)) return `Booking duration cannot exceed ${param} hours.`;
        }
    }
    if (rule === 'match' && val) {
        const other = document.getElementById(param);
        if (other && val !== other.value.trim()) return `${label} does not match.`;
    }
    if (rule === 'phone' && val && !/^[+\d][\d\s\-().]{6,19}$/.test(val))
        return 'Enter a valid phone number (digits, spaces, +, -, ()).';
    if (rule === 'cardnum' && val) {
        const digits = val.replace(/\s/g, '');
        if (!/^\d{16}$/.test(digits)) return 'Card number must be exactly 16 digits.';
    }
    if (rule === 'expiry' && val) {
        if (!/^\d{2}\/\d{2}$/.test(val)) return 'Enter expiry as MM/YY.';
        const [mm, yy] = val.split('/').map(Number);
        if (mm < 1 || mm > 12) return 'Invalid expiry month.';
        const now = new Date();
        const expYear = 2000 + yy;
        const expMonth = mm; // 1-based
        if (expYear < now.getFullYear() || (expYear === now.getFullYear() && expMonth < now.getMonth() + 1))
            return 'Card has expired.';
    }
    if (rule === 'cvv' && val && !/^\d{3,4}$/.test(val)) return 'CVV must be 3 or 4 digits.';
    if (rule === 'upi' && val && !/^[\w.\-]{2,}@[a-zA-Z]{2,}$/.test(val))
        return 'Enter a valid UPI ID (e.g. name@paytm).';
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
