// my-bookings.js – View and manage all bookings

let allBookings = [];
let activeStatus = '';

document.addEventListener('DOMContentLoaded', () => {
    loadBookings();
});

// ── Load ───────────────────────────────────────

async function loadBookings() {
    const container = document.getElementById('bookings-list');
    container.innerHTML = loadingHTML('Loading bookings...');
    try {
        const res = await fetch(`${API_URL}/bookings`);
        const result = await res.json();
        allBookings = result.data || [];
        applyFilters();
    } catch (e) {
        container.innerHTML = noDataHTML('fa-exclamation-circle', 'Error loading bookings', 'Please try again.');
    }
}

// ── Filters ────────────────────────────────────

function setStatusFilter(btn) {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeStatus = btn.getAttribute('data-status');
    applyFilters();
}

function filterBookings() { applyFilters(); }

function applyFilters() {
    const search = (document.getElementById('search-bookings').value || '').toLowerCase();
    let list = allBookings;

    if (activeStatus) list = list.filter(b => b.status === activeStatus);
    if (search) list = list.filter(b =>
        b.user_name.toLowerCase().includes(search) ||
        (b.user_email && b.user_email.toLowerCase().includes(search))
    );

    displayBookings(list);
}

// ── Display ────────────────────────────────────

function displayBookings(bookings) {
    const container = document.getElementById('bookings-list');
    if (!bookings.length) {
        container.innerHTML = noDataHTML('fa-calendar', 'No bookings found', 'Book a workspace to get started.');
        return;
    }

    container.innerHTML = bookings.map(b => `
        <div class="booking-card ${b.status}">
            <div class="booking-header">
                <div class="booking-title">
                    <h3>${b.workspaces?.name || 'N/A'}</h3>
                    <p>${b.workspaces?.working_hubs?.name || 'N/A'}, ${b.workspaces?.working_hubs?.city || 'N/A'}</p>
                </div>
                <span class="booking-status ${b.status}">${formatStatus(b.status)}</span>
            </div>
            <div class="booking-details">
                <div class="detail-item"><i class="fas fa-user"></i><span>${b.user_name}</span></div>
                <div class="detail-item"><i class="fas fa-calendar"></i><span>${formatDateTime(b.start_time)}</span></div>
                <div class="detail-item"><i class="fas fa-clock"></i><span>${formatDateTime(b.end_time)}</span></div>
                <div class="detail-item" title="Booking & Payment Date"><i class="fas fa-check-circle"></i><span><strong>${formatDateTime(b.created_at)}</strong></span></div>
            </div>
            <div class="booking-footer">
                <div class="booking-price">${formatCurrency(b.total_price)}</div>
                <div style="display:flex;gap:.5rem;flex-wrap:wrap;">
                    <a href="booking-detail.html?booking_id=${b.id}" class="btn-secondary" style="font-size:.875rem;">
                        <i class="fas fa-eye"></i> Details
                    </a>
                    ${(b.status === 'confirmed' || b.status === 'checked_in') ? `
                        <button class="btn-secondary" onclick="viewQR(${b.id})" style="font-size:.875rem;">
                            <i class="fas fa-qrcode"></i> QR Code
                        </button>
                    ` : ''}
                    ${b.status === 'confirmed' ? `
                        <button onclick="cancelBooking(${b.id})"
                            style="background:var(--danger);color:white;padding:.5rem 1rem;border:none;border-radius:6px;cursor:pointer;font-size:.875rem;display:inline-flex;align-items:center;gap:.4rem;">
                            <i class="fas fa-times-circle"></i> Cancel
                        </button>
                    ` : ''}
                </div>
            </div>
        </div>
    `).join('');
}

// ── QR Code ────────────────────────────────────

async function viewQR(bookingId) {
    try {
        const res = await fetch(`${API_URL}/qr/booking/${bookingId}`);
        const result = await res.json();
        if (!result.success) { showToast(result.error || 'QR not found', 'error'); return; }

        // Show in a simple overlay
        let overlay = document.getElementById('qr-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'qr-overlay';
            overlay.style.cssText =
                'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9000;display:flex;align-items:center;justify-content:center;padding:2rem;';
            overlay.onclick = () => overlay.remove();
            document.body.appendChild(overlay);
        }
        overlay.innerHTML = `
            <div style="background:white;border-radius:12px;padding:2rem;text-align:center;max-width:360px;width:100%;"
                onclick="event.stopPropagation()">
                <h3 style="color:var(--primary);margin-bottom:1rem;">Your QR Code</h3>
                <img src="${result.data.qr_image}" alt="QR" style="max-width:220px;border:4px solid var(--accent);border-radius:8px;padding:.5rem;">
                <p style="font-size:.85rem;color:var(--text-light);margin-top:1rem;">Show this at the venue</p>
                <button onclick="document.getElementById('qr-overlay').remove()"
                    style="margin-top:1rem;background:var(--accent);color:white;border:none;border-radius:6px;padding:.6rem 1.5rem;cursor:pointer;font-weight:600;">
                    Close
                </button>
            </div>`;
    } catch (e) {
        showToast('Error loading QR code.', 'error');
    }
}

// ── Cancel ─────────────────────────────────────

async function cancelBooking(bookingId) {
    if (!confirm('Cancel this booking?')) return;
    try {
        const res = await fetch(`${API_URL}/bookings/${bookingId}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'cancelled' })
        });
        const result = await res.json();
        if (result.success) { showToast('Booking cancelled.', 'success'); loadBookings(); }
        else showToast(result.error || 'Cancel failed.', 'error');
    } catch (e) {
        showToast('Error cancelling booking.', 'error');
    }
}
