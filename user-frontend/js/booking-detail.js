// booking-detail.js – Individual booking details with QR

document.addEventListener('DOMContentLoaded', async () => {
    const id = getParam('booking_id');
    if (!id) { window.location.href = 'my-bookings.html'; return; }
    await loadBooking(id);
});

async function loadBooking(id) {
    const container = document.getElementById('content');
    try {
        const [bRes, qrRes] = await Promise.allSettled([
            fetch(`${API_URL}/bookings/${id}`),
            fetch(`${API_URL}/qr/booking/${id}`)
        ]);

        const b = bRes.status === 'fulfilled' ? (await bRes.value.json()).data : null;
        if (!b) { container.innerHTML = noDataHTML('fa-exclamation-circle', 'Booking not found'); return; }

        const qrData = qrRes.status === 'fulfilled' ? (await qrRes.value.json()).data : null;

        const canCancel = b.status === 'confirmed';
        const hasQR = b.status === 'confirmed' || b.status === 'checked_in';

        document.title = `Booking #${b.id} - WorkSpace`;

        container.innerHTML = `
            <div style="display:grid;grid-template-columns:1fr 320px;gap:2rem;align-items:start;">
                <!-- Details -->
                <div>
                    <div style="background:white;border-radius:8px;box-shadow:0 2px 10px var(--shadow);overflow:hidden;margin-bottom:1.5rem;">
                        <div style="background:linear-gradient(135deg,var(--primary),var(--secondary));padding:1.5rem;color:white;
                            display:flex;justify-content:space-between;align-items:center;">
                            <div>
                                <h2 style="margin-bottom:.25rem;">${b.workspaces?.name || 'N/A'}</h2>
                                <p style="opacity:.85;">${b.workspaces?.working_hubs?.name || 'N/A'},
                                    ${b.workspaces?.working_hubs?.city || 'N/A'}</p>
                            </div>
                            <span class="booking-status ${b.status}">${formatStatus(b.status)}</span>
                        </div>
                        <div style="padding:1.5rem;">
                            <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1.5rem;">
                                ${detail('Guest', b.user_name)}
                                ${detail('Email', b.user_email)}
                                ${detail('Check-in', formatDateTime(b.start_time))}
                                ${detail('Check-out', formatDateTime(b.end_time))}
                                ${detail('Booking Type', b.booking_type || 'N/A')}
                                ${detail('Booking ID', `#${b.id}`)}
                                ${detail('Booked/Paid On', `<strong>${formatDateTime(b.created_at)}</strong>`)}
                            </div>
                            <div style="padding-top:1rem;border-top:1px solid var(--border);
                                display:flex;justify-content:space-between;align-items:center;">
                                <div>
                                    <div style="font-size:.8rem;color:var(--text-light);font-weight:600;">TOTAL PAID</div>
                                    <div style="font-size:1.75rem;font-weight:700;color:var(--primary);">
                                        ${formatCurrency(b.total_price)}
                                    </div>
                                </div>
                                <div style="display:flex;gap:.75rem;">
                                    ${canCancel ? `<button onclick="cancelBooking(${b.id})"
                                        style="background:var(--danger);color:white;padding:.6rem 1.25rem;border:none;
                                        border-radius:6px;cursor:pointer;font-weight:600;display:flex;align-items:center;gap:.4rem;">
                                        <i class="fas fa-times-circle"></i> Cancel
                                    </button>` : ''}
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Workspace Details -->
                    <div style="background:white;border-radius:8px;box-shadow:0 2px 10px var(--shadow);padding:1.5rem;">
                        <h3 style="color:var(--primary);margin-bottom:1rem;">Workspace Info</h3>
                        <div style="display:flex;gap:.5rem;flex-wrap:wrap;">
                            ${(b.workspaces?.amenities || []).map(a => `<span class="amenity-tag">${a}</span>`).join('')}
                        </div>
                    </div>
                </div>

                <!-- QR Code -->
                ${hasQR ? `
                <div style="position:sticky;top:90px;">
                    <div style="background:white;border-radius:8px;box-shadow:0 2px 10px var(--shadow);
                        padding:1.5rem;text-align:center;">
                        <h3 style="color:var(--primary);margin-bottom:1rem;">
                            <i class="fas fa-qrcode" style="color:var(--accent);"></i> Entry QR Code
                        </h3>
                        ${qrData?.qr_image
                    ? `<img src="${qrData.qr_image}" alt="QR"
                                style="max-width:220px;border:4px solid var(--accent);border-radius:8px;padding:.5rem;">`
                    : `<p style="color:var(--text-light);">QR code not available.</p>`
                }
                        <p style="font-size:.85rem;color:var(--text-light);margin-top:1rem;">
                            Show this QR at the venue for check-in
                        </p>
                    </div>
                </div>
                ` : ''}
            </div>
        `;
    } catch (e) {
        container.innerHTML = noDataHTML('fa-exclamation-circle', 'Error loading booking');
    }
}

function detail(label, value) {
    return `<div>
        <div style="font-size:.75rem;text-transform:uppercase;color:var(--text-light);font-weight:600;">${label}</div>
        <div style="font-weight:500;">${value || '—'}</div>
    </div>`;
}

async function cancelBooking(bookingId) {
    if (!confirm('Are you sure you want to cancel this booking?')) return;
    try {
        const res = await fetch(`${API_URL}/bookings/${bookingId}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'cancelled' })
        });
        const result = await res.json();
        if (result.success) {
            showToast('Booking cancelled successfully.', 'success');
            setTimeout(() => loadBooking(bookingId), 800);
        } else {
            showToast(result.error || 'Cancel failed.', 'error');
        }
    } catch {
        showToast('Error cancelling booking.', 'error');
    }
}
