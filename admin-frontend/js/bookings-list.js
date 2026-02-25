/* admin-frontend/js/bookings-list.js */
let allBookings = [];

document.addEventListener('DOMContentLoaded', loadBookings);

// Auto-refresh every 15 seconds to show new bookings immediately
setInterval(loadBookings, 15000);

// Refresh when returning from form pages
window.addEventListener('pageshow', (event) => {
    if (event.persisted || performance.navigation.type === 2) {
        loadBookings();
    }
});

async function loadBookings() {
    try {
        const json = await fetch(`${API_URL}/bookings`).then(r => r.json());
        allBookings = json.data || json;
        renderBookings(allBookings);
        updateTimestamp();
    } catch {
        document.getElementById('bookings-table').innerHTML =
            '<tr><td colspan="8" style="text-align:center;">Failed to load bookings.</td></tr>';
    }
}

function updateTimestamp() {
    const el = document.getElementById('last-updated');
    if (el) el.textContent = 'Updated: ' + new Date().toLocaleTimeString();
}

function filterBookings() {
    const q = (document.getElementById('search')?.value || '').toLowerCase();
    const status = document.getElementById('filter-status')?.value || '';
    const filtered = allBookings.filter(b => {
        const matchQ = !q || (b.guest_name || '').toLowerCase().includes(q) || String(b.id).includes(q) || (b.workspace_name || '').toLowerCase().includes(q);
        const matchStatus = !status || b.status === status;
        return matchQ && matchStatus;
    });
    renderBookings(filtered);
}

function statusBadge(s) {
    const map = { confirmed: 'badge-success', cancelled: 'badge-danger', pending: 'badge-warning', completed: 'badge-info', checked_in: 'badge-info' };
    return map[s] || 'badge-secondary';
}

function renderBookings(bookings) {
    const tbody = document.getElementById('bookings-table');
    if (!bookings.length) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;">No bookings found.</td></tr>';
        return;
    }
    tbody.innerHTML = bookings.map(b => `
        <tr>
            <td>#${b.id}</td>
            <td>${b.guest_name || '—'}</td>
            <td>${b.guest_email || '—'}</td>
            <td>${b.workspace_name || b.workspace_id || '—'}</td>
            <td>${formatDateTime(b.start_time)}</td>
            <td>${formatDateTime(b.end_time)}</td>
            <td><strong>${formatDateTime(b.created_at)}</strong></td>
            <td><span class="badge ${statusBadge(b.status)}">${b.status}</span></td>
            <td style="display:flex;gap:.5rem;">
                <a href="booking-details-admin.html?booking_id=${b.id}" class="btn btn-sm btn-outline">
                    <i class="fas fa-eye"></i> View
                </a>
                ${getQuickActions(b)}
            </td>
        </tr>
    `).join('');
}

function getQuickActions(booking) {
    const actions = [];
    if (booking.status === 'pending') {
        actions.push(`<button class="btn btn-sm btn-success" onclick="quickUpdateStatus(${booking.id}, 'confirmed')" title="Confirm"><i class="fas fa-check"></i></button>`);
    }
    if (booking.status === 'confirmed') {
        actions.push(`<button class="btn btn-sm" onclick="quickUpdateStatus(${booking.id}, 'checked_in')" title="Check In"><i class="fas fa-sign-in-alt"></i></button>`);
    }
    if (!['cancelled', 'completed'].includes(booking.status)) {
        actions.push(`<button class="btn btn-sm btn-danger" onclick="quickUpdateStatus(${booking.id}, 'cancelled')" title="Cancel"><i class="fas fa-times"></i></button>`);
    }
    return actions.join('');
}

async function quickUpdateStatus(bookingId, status) {
    if (!confirm(`Change booking #${bookingId} status to "${status}"?`)) return;

    try {
        const res = await fetch(`${API_URL}/bookings/${bookingId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });

        if (!res.ok) throw new Error('Failed to update');

        showToast('Status updated successfully', 'success');

        // Reload bookings
        await loadBookings();
    } catch (err) {
        console.error('Status update error:', err);
        showToast('Failed to update status', 'error');
    }
}
