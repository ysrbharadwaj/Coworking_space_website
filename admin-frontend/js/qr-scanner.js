let html5Qr = null;
let cameraRunning = false;
let processingScan = false;
let lastScanText = '';
let lastScanAt = 0;

const SCAN_COOLDOWN_MS = 2500;

function getScanApiCandidates() {
    const list = [`${API_URL}/qr/scan`];

    if (/localhost/i.test(API_URL)) {
        list.push(`${API_URL.replace(/localhost/ig, '127.0.0.1')}/qr/scan`.replace('/qr/scan/qr/scan', '/qr/scan'));
    } else if (/127\.0\.0\.1/i.test(API_URL)) {
        list.push(`${API_URL.replace(/127\.0\.0\.1/ig, 'localhost')}/qr/scan`.replace('/qr/scan/qr/scan', '/qr/scan'));
    }

    // De-duplicate while preserving order
    return [...new Set(list.map(s => s.replace(/\/api\/qr\/scan\/api\/qr\/scan/, '/api/qr/scan')))];
}

async function postScanWithFallback(rawText) {
    const endpoints = getScanApiCandidates();
    let lastError = null;

    for (const endpoint of endpoints) {
        try {
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: getAdminHeaders(),
                body: JSON.stringify({ qr_value: rawText })
            });

            const payload = await res.json().catch(() => ({}));
            return { res, payload };
        } catch (err) {
            lastError = err;
        }
    }

    throw lastError || new Error('Failed to fetch');
}

function getAdminAuthObject() {
    try {
        const raw = localStorage.getItem('adminAuth');
        return raw ? JSON.parse(raw) : null;
    } catch (_) {
        return null;
    }
}

function decodeJwtPayload(token) {
    try {
        const parts = String(token || '').split('.');
        if (parts.length !== 3) return null;
        const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
        return JSON.parse(atob(padded));
    } catch (_) {
        return null;
    }
}

function isExpiredJwt(token) {
    const payload = decodeJwtPayload(token);
    if (!payload || !payload.exp) return false;
    const nowSec = Math.floor(Date.now() / 1000);
    return nowSec >= Number(payload.exp);
}

function redirectToAdminLogin(message) {
    localStorage.removeItem('adminAuth');
    setScannerStatus(message || 'Admin session expired. Redirecting to login...', 'warning');
    showToast(message || 'Session expired. Please login again.', 'warning');
    setTimeout(() => {
        window.location.href = 'login.html';
    }, 900);
}

function ensureAdminSession() {
    const adminAuth = getAdminAuthObject();
    const token = adminAuth && adminAuth.token;

    if (!token) {
        redirectToAdminLogin('Missing admin session. Redirecting to login...');
        return false;
    }

    if (isExpiredJwt(token)) {
        redirectToAdminLogin('Admin session expired. Redirecting to login...');
        return false;
    }

    return true;
}

document.addEventListener('DOMContentLoaded', () => {
    const startBtn = document.getElementById('start-scan-btn');
    const stopBtn = document.getElementById('stop-scan-btn');
    const manualForm = document.getElementById('manual-validate-form');
    const clearBtn = document.getElementById('manual-clear-btn');

    startBtn?.addEventListener('click', startScanner);
    stopBtn?.addEventListener('click', stopScanner);
    manualForm?.addEventListener('submit', onManualValidate);
    clearBtn?.addEventListener('click', clearManualInput);

    window.addEventListener('beforeunload', () => {
        stopScanner();
    });
});

function setScannerStatus(message, type = 'info') {
    const el = document.getElementById('scanner-status');
    if (!el) return;
    el.className = `alert alert-${type}`;
    el.textContent = message;
}

function toggleScanButtons(isRunning) {
    const startBtn = document.getElementById('start-scan-btn');
    const stopBtn = document.getElementById('stop-scan-btn');
    if (startBtn) startBtn.disabled = isRunning;
    if (stopBtn) stopBtn.disabled = !isRunning;
}

async function startScanner() {
    if (!ensureAdminSession()) return;
    if (cameraRunning) return;

    if (typeof Html5Qrcode === 'undefined') {
        setScannerStatus('QR scanner library did not load. Refresh and try again.', 'error');
        return;
    }

    try {
        html5Qr = new Html5Qrcode('qr-reader');

        const cameras = await Html5Qrcode.getCameras();
        if (!cameras || cameras.length === 0) {
            setScannerStatus('No camera found on this device.', 'warning');
            return;
        }

        const preferredCamera = cameras.find(c => /back|rear|environment/i.test(c.label || '')) || cameras[0];

        await html5Qr.start(
            { deviceId: { exact: preferredCamera.id } },
            {
                fps: 10,
                qrbox: { width: 280, height: 280 },
                aspectRatio: 1.333
            },
            onScanSuccess,
            () => { }
        );

        cameraRunning = true;
        toggleScanButtons(true);
        setScannerStatus('Scanner is active. Point camera at QR code.', 'success');
    } catch (err) {
        console.error('Failed to start scanner:', err);
        setScannerStatus('Could not start camera scanner. Check camera permission.', 'error');
        await stopScanner();
    }
}

async function stopScanner() {
    if (!html5Qr) {
        cameraRunning = false;
        toggleScanButtons(false);
        return;
    }

    try {
        if (cameraRunning) {
            await html5Qr.stop();
        }
    } catch (_) {
        // Ignore stop errors.
    }

    try {
        await html5Qr.clear();
    } catch (_) {
        // Ignore clear errors.
    }

    html5Qr = null;
    cameraRunning = false;
    toggleScanButtons(false);
    setScannerStatus('Scanner stopped.', 'info');
}

async function onScanSuccess(decodedText) {
    const text = (decodedText || '').trim();
    if (!text) return;

    const now = Date.now();
    if (processingScan) return;
    if (text === lastScanText && (now - lastScanAt) < SCAN_COOLDOWN_MS) return;

    processingScan = true;
    lastScanText = text;
    lastScanAt = now;

    try {
        await validateQrText(text, 'camera');
    } finally {
        processingScan = false;
    }
}

async function onManualValidate(e) {
    e.preventDefault();
    if (!ensureAdminSession()) return;

    const input = document.getElementById('manual-qr-value');
    const value = (input?.value || '').trim();

    if (!value) {
        showToast('Enter a QR value or URL first.', 'warning');
        return;
    }

    await validateQrText(value, 'manual');
}

function clearManualInput() {
    const input = document.getElementById('manual-qr-value');
    if (input) input.value = '';
}

async function validateQrText(rawText, source) {
    if (!ensureAdminSession()) return;

    const resultEl = document.getElementById('scan-result');
    if (resultEl) {
        resultEl.innerHTML = loadingHTML('Validating QR code...');
    }

    try {
        const { res, payload } = await postScanWithFallback(rawText);
        if (res.status === 401 || res.status === 403) {
            redirectToAdminLogin(payload.error || 'Session expired or invalid. Please login again.');
            return;
        }

        if (!res.ok || !payload.success) {
            throw new Error(payload.error || 'QR validation failed');
        }

        renderSuccess(payload.data, source, rawText);
        if (payload.data && payload.data.already_scanned) {
            showToast('Guest already marked as entered', 'info');
        } else {
            showToast('Check-in successful', 'success');
        }

        if (cameraRunning) {
            await stopScanner();
        }
    } catch (err) {
        const msg = (err && err.message === 'Failed to fetch')
            ? 'Cannot reach backend API. Make sure backend runs on port 3001.'
            : (err && err.message) || 'QR validation failed';
        renderFailure(msg, rawText);
        showToast(msg, 'error');
    }
}

function renderSuccess(data, source, rawText) {
    const resultEl = document.getElementById('scan-result');
    if (!resultEl) return;

    const booking = data?.booking || {};
    const workspace = booking.workspaces || {};
    const hub = workspace.working_hubs || {};

    resultEl.innerHTML = `
        <div class="alert alert-success" style="margin-bottom:1rem;">
            <strong>Validated:</strong> ${data?.already_scanned ? 'Guest was already marked as entered.' : 'Guest check-in is confirmed.'}
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem;">
            ${detailRow('Booking ID', `#${booking.id || 'N/A'}`)}
            ${detailRow('Status', formatStatus(booking.status || 'checked_in'))}
            ${detailRow('Guest', booking.user_name || 'N/A')}
            ${detailRow('Workspace', workspace.name || 'N/A')}
            ${detailRow('Hub', hub.name || 'N/A')}
            ${detailRow('Scan Source', source === 'camera' ? 'Camera' : 'Manual')}
            ${detailRow('Scanned At', formatDateTime(data.scanned_at || new Date().toISOString()))}
            ${detailRow('Raw QR', escapeHtml(rawText))}
        </div>
    `;
}

function renderFailure(message, rawText) {
    const resultEl = document.getElementById('scan-result');
    if (!resultEl) return;

    resultEl.innerHTML = `
        <div class="alert alert-error" style="margin-bottom:1rem;">
            <strong>Validation failed:</strong> ${escapeHtml(message || 'Unknown error')}
        </div>
        <div style="font-size:.9rem;color:var(--text-light);">
            Last scanned value: ${escapeHtml(rawText || 'N/A')}
        </div>
    `;
}

function detailRow(label, value) {
    return `
        <div style="padding:.7rem;border:1px solid var(--border);border-radius:6px;background:var(--light);">
            <div style="font-size:.72rem;text-transform:uppercase;color:var(--text-light);font-weight:600;">${escapeHtml(label)}</div>
            <div style="font-weight:600;word-break:break-word;">${escapeHtml(value)}</div>
        </div>
    `;
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
