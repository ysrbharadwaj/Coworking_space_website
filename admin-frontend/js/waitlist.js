let waitlistEntries = [];
let waitlistTimer = null;

const WAITLIST_STATUS_LABELS = {
    pending: 'Pending',
    offered: 'Offered',
    claimed: 'Claimed',
    cancelled: 'Cancelled',
    expired: 'Expired'
};

const WAITLIST_STATUS_BADGES = {
    pending: 'badge-warning',
    offered: 'badge-info',
    claimed: 'badge-success',
    cancelled: 'badge-danger',
    expired: 'badge-secondary'
};

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('waitlist-refresh-btn')?.addEventListener('click', () => loadWaitlist(true));
    document.getElementById('waitlist-search')?.addEventListener('input', renderWaitlist);
    document.getElementById('waitlist-status')?.addEventListener('change', renderWaitlist);
    document.getElementById('waitlist-active-only')?.addEventListener('change', () => loadWaitlist(true));

    loadWaitlist();
    waitlistTimer = setInterval(loadWaitlist, 20000);
});

async function loadWaitlist(showToastOnError = false) {
    try {
        const activeOnly = document.getElementById('waitlist-active-only')?.checked;
        const params = new URLSearchParams();
        if (activeOnly) params.set('only_active', 'true');

        const refreshBtn = document.getElementById('waitlist-refresh-btn');
        if (refreshBtn) refreshBtn.disabled = true;

        const res = await fetch(`${API_URL}/bookings/waitlist${params.toString() ? `?${params.toString()}` : ''}`, {
            headers: getAdminHeaders()
        });
        const result = await res.json();

        if (!res.ok || !result.success) {
            throw new Error(result.error || 'Failed to fetch waitlist');
        }

        waitlistEntries = result.data || [];
        renderWaitlist();
        updateWaitlistTimestamp();
    } catch (err) {
        console.error('Waitlist fetch failed:', err);
        if (showToastOnError) {
            showToast(err.message || 'Failed to refresh waitlist', 'error');
        }
    } finally {
        const refreshBtn = document.getElementById('waitlist-refresh-btn');
        if (refreshBtn) refreshBtn.disabled = false;
    }
}

function updateWaitlistTimestamp() {
    const el = document.getElementById('waitlist-updated');
    if (el) el.textContent = 'Updated ' + new Date().toLocaleTimeString();
}

function getSortedWaitlist(entries = waitlistEntries) {
    return [...entries].sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        return new Date(a.created_at) - new Date(b.created_at);
    });
}

function renderWaitlist() {
    const tbody = document.getElementById('waitlist-table');
    if (!tbody) return;

    const search = (document.getElementById('waitlist-search')?.value || '').trim().toLowerCase();
    const statusFilter = document.getElementById('waitlist-status')?.value || '';

    const sorted = getSortedWaitlist();
    const rankMap = new Map();
    sorted.forEach((entry, idx) => rankMap.set(entry.id, idx + 1));

    const filtered = sorted.filter(entry => {
        const matchesStatus = !statusFilter || entry.status === statusFilter;
        const matchesSearch = !search || matchesWaitlistSearch(entry, search);
        return matchesStatus && matchesSearch;
    });

    if (!filtered.length) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;">${noDataHTML('fa-clock', 'No waitlist entries match your filters')}</td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map(entry => renderWaitlistRow(entry, rankMap.get(entry.id))).join('');
}

function matchesWaitlistSearch(entry, query) {
    const workspaceName = entry.workspaces?.name || '';
    const hubName = entry.workspaces?.working_hubs?.name || '';
    const city = entry.workspaces?.working_hubs?.city || '';
    const slotKey = entry.slot_key || '';
    const notes = entry.notes || '';
    return [workspaceName, hubName, city, slotKey, entry.user_email || '', notes]
        .some(value => value.toLowerCase().includes(query));
}

function renderWaitlistRow(entry, rank) {
    const workspaceName = entry.workspaces?.name || `Workspace #${entry.workspace_id}`;
    const hubName = entry.workspaces?.working_hubs?.name;
    const city = entry.workspaces?.working_hubs?.city;
    const statusLabel = WAITLIST_STATUS_LABELS[entry.status] || entry.status;
    const badgeClass = WAITLIST_STATUS_BADGES[entry.status] || 'badge-secondary';

    const offerInfo = formatOfferWindow(entry);
    const notes = entry.notes ? `<div class="muted" style="font-size:.8rem;margin-top:.25rem;">${entry.notes}</div>` : '';

    return `
        <tr>
            <td><strong>#${rank || '—'}</strong></td>
            <td>
                <div style="font-weight:600;">${workspaceName}</div>
                ${hubName ? `<div class="muted" style="font-size:.85rem;">${hubName}${city ? `, ${city}` : ''}</div>` : ''}
                <div class="muted" style="font-size:.85rem;margin-top:.25rem;">
                    <i class="fas fa-clock"></i> ${formatDateTime(entry.start_time)} → ${formatDateTime(entry.end_time)}
                </div>
            </td>
            <td>
                <div style="font-weight:600;">${entry.user_email}</div>
                ${(rank || entry.queue_position) ? `<div class="muted" style="font-size:.8rem;">Queue position: ${rank || entry.queue_position}</div>` : ''}
                ${notes}
            </td>
            <td>
                <span class="badge ${badgeClass}">${statusLabel}</span>
            </td>
            <td>
                <div style="font-weight:600;">${entry.priority}</div>
                <div class="muted" style="font-size:.75rem;">Created ${formatDateTime(entry.created_at)}</div>
            </td>
            <td>${offerInfo}</td>
            <td>
                <div class="table-actions" style="display:flex;gap:.35rem;flex-wrap:wrap;">
                    ${actionButton('up', entry)}
                    ${actionButton('down', entry)}
                    ${forceOfferButton(entry)}
                    ${removeButton(entry)}
                </div>
            </td>
        </tr>
    `;
}

function formatOfferWindow(entry) {
    if (entry.status === 'offered' && entry.offer_expires_at) {
        return `<div style="font-weight:600;color:var(--accent);">Until ${formatDateTime(entry.offer_expires_at)}</div>`;
    }
    if (entry.status === 'claimed' && entry.claimed_booking_id) {
        return `<div>Booked as #${entry.claimed_booking_id}</div>`;
    }
    return '<span class="muted">—</span>';
}

function actionButton(direction, entry) {
    const disabled = entry.status !== 'pending';
    const icon = direction === 'up' ? 'fa-chevron-up' : 'fa-chevron-down';
    const label = direction === 'up' ? 'Move Up' : 'Move Down';
    return `<button class="btn btn-sm btn-outline" title="${label}" ${disabled ? 'disabled' : ''}
                onclick="adminMoveEntry(${entry.id}, '${direction}', this)">
                <i class="fas ${icon}"></i>
            </button>`;
}

function forceOfferButton(entry) {
    const disabled = entry.status !== 'pending';
    return `<button class="btn btn-sm btn-success" title="Force offer" ${disabled ? 'disabled' : ''}
                onclick="adminForceOffer(${entry.id}, this)">
                <i class="fas fa-bolt"></i>
            </button>`;
}

function removeButton(entry) {
    const disabled = entry.status === 'claimed';
    return `<button class="btn btn-sm btn-danger" title="Remove entry" ${disabled ? 'disabled' : ''}
                onclick="adminRemoveEntry(${entry.id}, this)">
                <i class="fas fa-trash"></i>
            </button>`;
}

async function adminMoveEntry(entryId, direction, btn) {
    if (btn) btn.disabled = true;
    try {
        const res = await fetch(`${API_URL}/bookings/waitlist/${entryId}/reorder`, {
            method: 'POST',
            headers: getAdminHeaders(),
            body: JSON.stringify({ direction })
        });
        const result = await res.json();
        if (!res.ok || !result.success) throw new Error(result.error || 'Failed to reorder');
        showToast('Priority updated', 'success');
        await loadWaitlist();
    } catch (err) {
        console.error('Reorder failed', err);
        showToast(err.message || 'Could not reorder waitlist', 'error');
    } finally {
        if (btn) btn.disabled = false;
    }
}

async function adminForceOffer(entryId, btn) {
    if (!confirm('Force-offer this slot to the selected guest? Existing offers will be respected.')) {
        return;
    }
    if (btn) btn.disabled = true;
    try {
        const res = await fetch(`${API_URL}/bookings/waitlist/${entryId}/promote`, {
            method: 'POST',
            headers: getAdminHeaders()
        });
        const result = await res.json();
        if (!res.ok || !result.success) throw new Error(result.error || 'Failed to promote entry');
        showToast('Offer initiated for the guest', 'success');
        await loadWaitlist();
    } catch (err) {
        console.error('Force offer failed', err);
        showToast(err.message || 'Could not trigger offer', 'error');
    } finally {
        if (btn) btn.disabled = false;
    }
}

async function adminRemoveEntry(entryId, btn) {
    if (!confirm('Remove this waitlist entry? This cannot be undone.')) {
        return;
    }
    if (btn) btn.disabled = true;
    try {
        const res = await fetch(`${API_URL}/bookings/waitlist/${entryId}`, {
            method: 'DELETE',
            headers: getAdminHeaders()
        });
        const result = await res.json();
        if (!res.ok || !result.success) throw new Error(result.error || 'Failed to remove entry');
        showToast('Waitlist entry removed', 'success');
        await loadWaitlist();
    } catch (err) {
        console.error('Remove waitlist entry failed', err);
        showToast(err.message || 'Could not remove entry', 'error');
    } finally {
        if (btn) btn.disabled = false;
    }
}

window.adminMoveEntry = adminMoveEntry;
window.adminForceOffer = adminForceOffer;
window.adminRemoveEntry = adminRemoveEntry;
