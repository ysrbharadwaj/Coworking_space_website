// booking-confirmation.js – Booking success page

document.addEventListener('DOMContentLoaded', () => {
    if (!requireAuth()) return;
    const data = getSession('confirmedBooking');
    if (!data) { window.location.href = 'my-bookings.html'; return; }
    const bookingId = data.booking_id || data.booking?.id || null;

    // Booking summary
    document.getElementById('booking-summary').innerHTML = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem;">
            <div>
                <div style="font-size:.75rem;text-transform:uppercase;color:var(--text-light);font-weight:600;">Workspace</div>
                <div style="font-weight:600;">${data.workspace_name || 'N/A'}</div>
            </div>
            <div>
                <div style="font-size:.75rem;text-transform:uppercase;color:var(--text-light);font-weight:600;">Location</div>
                <div>${data.hub_name || 'N/A'}${data.hub_city ? ', ' + data.hub_city : ''}</div>
            </div>
            <div>
                <div style="font-size:.75rem;text-transform:uppercase;color:var(--text-light);font-weight:600;">Check-in</div>
                <div>${formatDateTime(data.start_time)}</div>
            </div>
            <div>
                <div style="font-size:.75rem;text-transform:uppercase;color:var(--text-light);font-weight:600;">Check-out</div>
                <div>${formatDateTime(data.end_time)}</div>
            </div>
            <div>
                <div style="font-size:.75rem;text-transform:uppercase;color:var(--text-light);font-weight:600;">Booking ID</div>
                <div style="font-weight:700;">${bookingId ? `#${bookingId}` : 'N/A'}</div>
            </div>
            <div style="grid-column:1/-1;">
                <div style="font-size:.75rem;text-transform:uppercase;color:var(--text-light);font-weight:600;">Total Paid</div>
                <div style="font-size:1.5rem;font-weight:700;color:var(--success);">${formatCurrency(data.total_price)}</div>
            </div>
        </div>`;

    // QR code
    const qrContainer = document.getElementById('qr-container');
    if (data.qr_image) {
        renderQrCode(qrContainer, data.qr_image, bookingId, data.qr_value);
    } else {
        // Try to fetch QR from API using booking id
        if (bookingId) {
            fetchQR(bookingId, qrContainer);
        } else {
            qrContainer.innerHTML = `<p style="color:var(--text-light);">QR code not available.</p>`;
        }
    }

    // Clear session after render
    clearSession('confirmedBooking');
});

async function fetchQR(bookingId, container) {
    try {
        const res = await fetch(`${API_URL}/qr/booking/${bookingId}`);
        const result = await res.json();
        if (result.success && result.data?.qr_image) {
            renderQrCode(container, result.data.qr_image, bookingId, result.data?.qr_code?.qr_value);
        } else {
            container.innerHTML = `<p style="color:var(--text-light);">QR code not available.</p>`;
        }
    } catch {
        container.innerHTML = `<p style="color:var(--text-light);">Could not load QR code.</p>`;
    }
}

function renderQrCode(container, qrImage, bookingId, qrValue) {
    container.innerHTML = `
        <img src="${qrImage}" alt="QR Code"
            style="max-width:200px;border:4px solid var(--accent);border-radius:8px;padding:.5rem;">
        <p style="margin-top:.75rem;font-size:.85rem;color:var(--text-light);">
            Booking ID: <strong>#${bookingId || 'N/A'}</strong>
        </p>
        ${qrValue ? `<p style="font-size:.75rem;color:var(--text-light);word-break:break-word;">${qrValue}</p>` : ''}
    `;
}
