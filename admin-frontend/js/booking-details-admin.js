/* admin-frontend/js/booking-details-admin.js */
const bookingId = getParam('booking_id');

document.addEventListener('DOMContentLoaded', async () => {
    if (!bookingId) { showError('No booking ID provided.'); return; }
    await loadBooking();
});

async function loadBooking() {
    const container = document.getElementById('content');
    try {
        const [bResult, qrResult] = await Promise.allSettled([
            fetch(`${API_URL}/bookings/${bookingId}`).then(r => r.json()).then(d => d.data || d),
            fetch(`${API_URL}/qr/${bookingId}`).then(r => r.json()).then(d => d.data || d),
        ]);

        const b = bResult.value;
        if (!b || b.error) { showError('Booking not found.'); return; }

        document.querySelector('h1').innerHTML = `<i class="fas fa-file-alt"></i> Booking #${b.id}`;

        const qrUrl = qrResult.status === 'fulfilled' && qrResult.value?.qr_code_url
            ? qrResult.value.qr_code_url : null;

        // Generate transaction ID if not present
        let txnId = b.transaction_id;
        if (!txnId && b.created_at) {
            const dateStr = new Date(b.created_at).toISOString().slice(0, 19).replace(/[-:T]/g, '').slice(0, 14);
            txnId = `TXN-${dateStr}`;
        } else if (!txnId) {
            txnId = `TXN-${b.id}`;
        }

        const workspace = b.workspaces;
        const hub = workspace?.working_hubs;
        const resources = b.booking_resources || [];

        container.innerHTML = `
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem;">
                <div class="card">
                    <div class="card-header">
                        <h2>Booking Information</h2>
                        <span id="booking-status" class="badge ${statusBadge(b.status)}">${b.status}</span>
                    </div>
                    <div class="card-body">
                        ${detailRow('Booking ID', '<strong>BOOK-' + b.id + '</strong>')}
                        ${detailRow('Transaction ID', '<strong>' + txnId + '</strong>')}
                        ${detailRow('Guest Name', b.user_name || b.guest_name || '&mdash;')}
                        ${detailRow('Email', b.user_email || b.guest_email || '&mdash;')}
                        ${detailRow('Booking Type', formatType(b.booking_type))}
                        ${detailRow('Status', '<span class="badge ' + statusBadge(b.status) + '">' + b.status + '</span>')}
                        ${detailRow('Booked/Paid On', '<strong>' + formatDateTime(b.created_at) + '</strong>')}
                    </div>
                </div>
                
                <div class="card">
                    <div class="card-header">
                        <h2>Workspace Details</h2>
                    </div>
                    <div class="card-body">
                        ${detailRow('Workspace', workspace?.name || b.workspace_name || 'WS #' + b.workspace_id)}
                        ${detailRow('Workspace ID', '#' + b.workspace_id)}
                        ${workspace?.type ? detailRow('Type', workspace.type) : ''}
                        ${workspace?.capacity ? detailRow('Capacity', workspace.capacity + ' people') : ''}
                        ${workspace?.amenities ? detailRow('Amenities', workspace.amenities.join(', ')) : ''}
                        ${hub ? detailRow('Hub', hub.name) : ''}
                        ${hub?.address ? detailRow('Location', hub.address + ', ' + hub.city + ', ' + hub.state) : ''}
                    </div>
                </div>
                
                <div class="card">
                    <div class="card-header">
                        <h2>Schedule & Pricing</h2>
                    </div>
                    <div class="card-body">
                        ${detailRow('Check-In Time', formatDateTime(b.start_time))}
                        ${detailRow('Check-Out Time', formatDateTime(b.end_time))}
                        ${workspace?.base_price ? detailRow('Base Price', formatCurrency(workspace.base_price) + '/hour') : ''}
                        ${detailRow('Total Amount', '<strong style="font-size:1.1rem;color:var(--success);">' + formatCurrency(b.total_price || b.total_amount || b.amount || 0) + '</strong>')}
                        ${detailRow('Payment Method', 'Online')}
                    </div>
                </div>
                
                ${resources.length > 0 ? `
                <div class="card">
                    <div class="card-header">
                        <h2>Additional Resources</h2>
                    </div>
                    <div class="card-body">
                        ${resources.map(r => detailRow(r.resources?.name || 'Resource', 'Qty: ' + r.quantity + ' × ' + formatCurrency(r.resources?.price_per_slot || 0))).join('')}
                    </div>
                </div>
                ` : ''}
                
                <div style="display:flex;flex-direction:column;gap:1.5rem;">
                    <div class="card">
                        <div class="card-header"><h2>Actions</h2></div>
                        <div class="card-body">
                            <div id="action-buttons" style="display:flex;gap:.75rem;flex-wrap:wrap;"></div>
                        </div>
                    </div>
                    ${qrUrl ? `<div class="card"><div class="card-header"><h2>QR Code</h2></div><div class="card-body" style="text-align:center;"><img src="${qrUrl}" alt="QR" style="max-width:180px;"></div></div>` : ''}
                </div>
            </div>
        `;
        renderActions(b.status);
    } catch (err) {
        showError('Failed to load booking: ' + err.message);
    }
}

function detailRow(label, value) {
    return `<div style="display:flex;justify-content:space-between;padding:.6rem 0;border-bottom:1px solid var(--border);"><span style="color:var(--text-light);font-size:.9rem;">${label}</span><strong>${value}</strong></div>`;
}

function renderActions(status) {
    const el = document.getElementById('action-buttons');
    if (!el) return;
    const actions = [];
    if (status === 'pending') actions.push(`<button class="btn btn-success" onclick="updateStatus('confirmed')"><i class="fas fa-check"></i> Confirm</button>`);
    if (status === 'confirmed') actions.push(`<button class="btn" onclick="updateStatus('checked_in')"><i class="fas fa-sign-in-alt"></i> Check In</button>`);
    if (status === 'checked_in') actions.push(`<button class="btn btn-outline" onclick="updateStatus('completed')"><i class="fas fa-flag-checkered"></i> Complete</button>`);
    if (!['cancelled', 'completed'].includes(status))
        actions.push(`<button class="btn btn-danger" onclick="updateStatus('cancelled')"><i class="fas fa-times"></i> Cancel</button>`);
    el.innerHTML = actions.length ? actions.join('') : '<span style="color:var(--text-light);">No actions available.</span>';
}

async function updateStatus(status) {
    if (!confirm(`Change status to "${status}"?`)) return;
    try {
        const res = await fetch(`${API_URL}/bookings/${bookingId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });
        if (!res.ok) throw new Error();
        showToast('Status updated', 'success');
        await loadBooking();
    } catch {
        showToast('Failed to update status', 'error');
    }
}

function statusBadge(s) {
    const map = { confirmed: 'badge-success', cancelled: 'badge-danger', pending: 'badge-warning', completed: 'badge-info', checked_in: 'badge-info' };
    return map[s] || 'badge-secondary';
}

function showError(msg) {
    document.getElementById('content').innerHTML = `<div class="card"><div class="card-body" style="text-align:center;color:#e74c3c;">${msg}</div></div>`;
}
