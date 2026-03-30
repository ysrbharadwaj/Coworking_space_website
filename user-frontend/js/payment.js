// payment.js – Payment gateway page with form validation

let bookingData  = null;
let activeMethod = null;

document.addEventListener('DOMContentLoaded', () => {
    if (!requireAuth()) return;
    bookingData = getSession('pendingBooking');
    if (!bookingData) { window.location.href = 'search-hubs.html'; return; }

    document.getElementById('payment-amount').textContent = formatCurrency(bookingData.total_price);

    // Show pricing breakdown from booking form
    const bd = document.getElementById('payment-breakdown');
    if (bookingData.pricing_html) {
        bd.innerHTML = `<div style="padding:1rem;background:var(--light);border-radius:8px;font-size:.9rem;">
            ${bookingData.pricing_html}
        </div>`;
    } else {
        bd.innerHTML = `<div style="padding:1rem;background:var(--light);border-radius:8px;">
            <div style="display:flex;justify-content:space-between;">
                <span>${bookingData.workspace_name}</span>
                <strong>${formatCurrency(bookingData.total_price)}</strong>
            </div>
            <div style="font-size:.85rem;color:var(--text-light);margin-top:.4rem;">
                ${formatDateTime(bookingData.start_time)} → ${formatDateTime(bookingData.end_time)}
            </div>
        </div>`;
    }

    if (bookingData.hold_expires_at) {
        const holdExpiry = new Date(bookingData.hold_expires_at);
        const expiryText = Number.isNaN(holdExpiry.getTime()) ? 'soon' : formatDateTime(holdExpiry.toISOString());
        bd.innerHTML += `<div class="alert alert-warning" style="margin-top:1rem;">
            <i class="fas fa-hourglass-half"></i>
            <span><strong>Slot reserved temporarily:</strong> Complete payment before ${expiryText}.</span>
        </div>`;
    }
});

// ── Payment Method Selection ───────────────────

function selectPayment(method, el) {
    activeMethod = method;
    document.querySelectorAll('.payment-method').forEach(m => m.classList.remove('active'));
    el.classList.add('active');
    document.querySelectorAll('.payment-form').forEach(f => f.classList.remove('active'));
    document.getElementById(`${method}-form`).classList.add('active');
    document.getElementById('payment-method-error').style.display = 'none';
}

// ── Card number formatter ──────────────────────

function formatCardNumber(input) {
    let v = input.value.replace(/\D/g, '').slice(0, 16);
    input.value = v.replace(/(.{4})/g, '$1 ').trim();
}

function formatExpiry(input) {
    let v = input.value.replace(/\D/g, '').slice(0, 4);
    if (v.length > 2) v = `${v.slice(0, 2)}/${v.slice(2)}`;
    input.value = v;
}

// ── Process Payment ────────────────────────────

async function processPayment(method) {
    // Guard: method must be selected
    if (!activeMethod) {
        document.getElementById('payment-method-error').style.display = 'flex';
        return;
    }

    // Validate active payment form
    const form = document.getElementById(`${method}-form`);
    if (!validateForm(form)) {
        showToast('Please fill in all required payment details.', 'error');
        return;
    }

    const btn = form.querySelector('button[onclick]');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing…'; }

    try {
        // 1. Create booking (auth token provides user identity — no need to send user fields)
        const bookRes = await fetch(`${API_URL}/bookings`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({
                workspace_id: bookingData.workspace_id,
                start_time:   bookingData.start_time,
                end_time:     bookingData.end_time,
                hold_token:   bookingData.hold_token,
                total_price:  bookingData.total_price,
                booking_type: bookingData.booking_type,
                status:       'confirmed',
                // Pass resources inline so the backend handles them in one transaction
                resources: (bookingData.resources || []).map(r => ({
                    resource_id: r.id,
                    quantity: r.quantity || 1
                }))
            })
        });
        const bookResult = await bookRes.json();
        if (!bookResult.success) throw new Error(bookResult.error || 'Booking failed');

        const booking = bookResult.data;

        // 2. Generate QR code
        const qrRes    = await fetch(`${API_URL}/qr/generate/${booking.id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
        const qrResult = await qrRes.json();

        // 3. Persist confirmation data and navigate (server is source of truth for user identity)
        const currentUser = getCurrentUser();
        saveSession('confirmedBooking', {
            booking,
            qr_image: qrResult.data?.qr_image || null,
            workspace_name: bookingData.workspace_name,
            hub_name:   bookingData.hub_name,
            hub_city:   bookingData.hub_city,
            total_price: bookingData.total_price,
            user_name:  currentUser?.name  || bookingData.user_name,
            start_time: bookingData.start_time,
            end_time:   bookingData.end_time
        });

        clearSession('pendingBooking');
        window.location.href = 'booking-confirmation.html';

    } catch (err) {
        console.error('Payment error:', err);
        showToast('Payment failed: ' + err.message, 'error');
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-lock"></i> Pay'; }
    }
}

// ── Form validation helper ─────────────────────

function validateForm(formEl) {
    let valid = true;
    formEl.querySelectorAll('[data-validate]').forEach(field => {
        // clear previous errors
        field.classList.remove('input-error');
        const old = field.parentNode.querySelector('.field-error');
        if (old) old.remove();

        const rules = field.getAttribute('data-validate').split('|');
        for (const rule of rules) {
            const [r, param] = rule.split(':');
            const err = checkValidationRule(r, param, field);
            if (err) {
                field.classList.add('input-error');
                const span = document.createElement('span');
                span.className = 'field-error';
                span.textContent = err;
                field.parentNode.appendChild(span);
                valid = false;
                break;
            }
        }
    });
    return valid;
}

function checkValidationRule(rule, param, field) {
    const val   = field.value.trim();
    const label = field.getAttribute('data-label') || 'This field';
    if (rule === 'required' && !val)         return `${label} is required.`;
    if (rule === 'email'   && val && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) return 'Invalid email.';
    if (rule === 'minlen'  && val && val.replace(/[\s-]/g,'').length < Number(param))
        return `Minimum ${param} characters required.`;
    return null;
}
