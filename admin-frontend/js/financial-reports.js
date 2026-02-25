/* admin-frontend/js/financial-reports.js */
document.addEventListener('DOMContentLoaded', loadReport);

// Auto-refresh every 15 seconds for faster updates
setInterval(loadReport, 15000);

// Refresh when returning to reports page
window.addEventListener('pageshow', (event) => {
    if (event.persisted || performance.navigation.type === 2) {
        loadReport();
    }
});

async function loadReport() {
    const days = parseInt(document.getElementById('period')?.value || '30');
    const cutoff = new Date(Date.now() - days * 86400000);

    try {
        const [bookings, hubs, workspaces, ratings] = await Promise.all([
            fetch(`${API_URL}/bookings`).then(r => r.json()).then(d => d.data || d),
            fetch(`${API_URL}/hubs`).then(r => r.json()).then(d => d.data || d),
            fetch(`${API_URL}/workspaces`).then(r => r.json()).then(d => d.data || d),
            fetch(`${API_URL}/ratings`).then(r => r.json()).then(d => d.data || d).catch(() => [])
        ]);

        // Filter bookings by date period
        const periodBookings = Array.isArray(bookings)
            ? bookings.filter(b => {
                const date = new Date(b.created_at || b.start_time);
                return date >= cutoff;
            })
            : [];

        computeKPIs(periodBookings, workspaces, ratings, days);
        renderRevenueByHub(periodBookings, hubs, workspaces);
        renderBookingsByStatus(periodBookings);
        renderRevenueByType(periodBookings, workspaces);
        renderTopWorkspaces(periodBookings, workspaces);
    } catch (err) {
        console.error('Financial reports error', err);
    }
}

function computeKPIs(bookings, workspaces, ratings, days) {
    // Calculate revenue from successful bookings
    const revenue = bookings
        .filter(b => b.status === 'confirmed' || b.status === 'completed')
        .reduce((sum, b) => sum + (parseFloat(b.total_price) || 0), 0);

    // Count confirmed/completed bookings
    const confirmedBookings = bookings.filter(b =>
        b.status === 'confirmed' || b.status === 'completed' || b.status === 'checked_in'
    ).length;

    // Calculate occupancy rate (simplified)
    const totalWorkspaces = workspaces.length || 1;
    const occupancy = Math.round((confirmedBookings / (totalWorkspaces * days)) * 100);

    // Calculate average rating from API
    const avgRating = Array.isArray(ratings) && ratings.length > 0
        ? (ratings.reduce((sum, r) => sum + (r.rating || 0), 0) / ratings.length).toFixed(1)
        : '0.0';

    setEl('total-revenue', formatCurrency(revenue));
    setEl('total-bookings', bookings.length);
    setEl('occupancy-rate', occupancy + '%');
    setEl('avg-rating', avgRating + ' ★');
}

function renderRevenueByHub(bookings, hubs, workspaces) {
    const el = document.getElementById('revenue-by-hub');
    if (!hubs.length) { el.innerHTML = '<p style="text-align:center;color:var(--text-light);">No hubs found.</p>'; return; }

    const hubRevenue = hubs.map(h => {
        // Get workspace IDs for this hub
        const wsIds = workspaces.filter(w => w.hub_id === h.id).map(w => w.id);

        // Calculate revenue from bookings for these workspaces
        const revenue = bookings
            .filter(b => wsIds.includes(b.workspace_id) && (b.status === 'confirmed' || b.status === 'completed'))
            .reduce((sum, b) => sum + (parseFloat(b.total_price) || 0), 0);

        return { name: h.name, revenue };
    }).sort((a, b) => b.revenue - a.revenue);

    const maxRevenue = Math.max(...hubRevenue.map(h => h.revenue), 1);
    el.innerHTML = hubRevenue.map(h => `
        <div style="margin-bottom:1rem;">
            <div style="display:flex;justify-content:space-between;margin-bottom:.25rem;">
                <span style="font-size:.9rem;">${h.name}</span>
                <strong>${formatCurrency(h.revenue)}</strong>
            </div>
            <div style="background:var(--border);height:8px;border-radius:4px;overflow:hidden;">
                <div style="background:var(--primary);height:8px;width:${Math.round(h.revenue / maxRevenue * 100)}%;transition:width .3s;"></div>
            </div>
        </div>
    `).join('');
}

function renderBookingsByStatus(bookings) {
    const el = document.getElementById('bookings-by-status');
    const statuses = ['confirmed', 'completed', 'pending', 'cancelled', 'checked_in'];
    const colors = { confirmed: '#27ae60', completed: '#2980b9', pending: '#f39c12', cancelled: '#e74c3c', checked_in: '#8e44ad' };
    const total = bookings.length || 1;
    el.innerHTML = statuses.map(s => {
        const count = bookings.filter(b => b.status === s).length;
        if (!count) return '';
        return `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.75rem;">
                <span class="badge" style="background:${colors[s] || '#999'};color:#fff;">${s}</span>
                <div style="flex:1;margin:0 1rem;background:var(--border);height:8px;">
                    <div style="background:${colors[s] || '#999'};height:8px;width:${Math.round(count / total * 100)}%;"></div>
                </div>
                <strong style="min-width:2rem;text-align:right;">${count}</strong>
            </div>
        `;
    }).join('') || '<p>No bookings in period.</p>';
}

function renderRevenueByType(bookings, workspaces) {
    const el = document.getElementById('revenue-by-type');
    const types = [...new Set(workspaces.map(w => w.type).filter(Boolean))];
    if (!types.length) { el.innerHTML = '<p style="text-align:center;color:var(--text-light);">No workspace types found.</p>'; return; }

    const typeData = types.map(t => {
        const wsIds = workspaces.filter(w => w.type === t).map(w => w.id);
        const revenue = bookings
            .filter(b => wsIds.includes(b.workspace_id) && (b.status === 'confirmed' || b.status === 'completed'))
            .reduce((sum, b) => sum + (parseFloat(b.total_price) || 0), 0);
        return { type: formatType(t), revenue };
    }).sort((a, b) => b.revenue - a.revenue);

    const maxRevenue = Math.max(...typeData.map(d => d.revenue), 1);
    el.innerHTML = typeData.map(d => `
        <div style="margin-bottom:1rem;">
            <div style="display:flex;justify-content:space-between;margin-bottom:.25rem;">
                <span style="font-size:.9rem;">${d.type}</span>
                <strong>${formatCurrency(d.revenue)}</strong>
            </div>
            <div style="background:var(--border);height:8px;border-radius:4px;overflow:hidden;">
                <div style="background:#8e44ad;height:8px;width:${Math.round(d.revenue / maxRevenue * 100)}%;"></div>
            </div>
        </div>
    `).join('');
}

function renderTopWorkspaces(bookings, workspaces) {
    const el = document.getElementById('top-workspaces');

    const workspaceData = workspaces.map(w => {
        const wsBookings = bookings.filter(b => b.workspace_id === w.id);
        const revenue = wsBookings
            .filter(b => b.status === 'confirmed' || b.status === 'completed')
            .reduce((sum, b) => sum + (parseFloat(b.total_price) || 0), 0);
        return {
            name: w.name,
            type: w.type,
            bookings: wsBookings.length,
            revenue
        };
    }).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

    if (!workspaceData.length) {
        el.innerHTML = '<p style="text-align:center;color:var(--text-light);">No workspace data available.</p>';
        return;
    }

    el.innerHTML = `
        <table style="width:100%;font-size:.9rem;">
            <thead><tr style="text-align:left;border-bottom:2px solid var(--border);">
                <th style="padding:.5rem 0;">Workspace</th>
                <th style="padding:.5rem;">Type</th>
                <th style="padding:.5rem;text-align:center;">Bookings</th>
                <th style="padding:.5rem 0;text-align:right;">Revenue</th>
            </tr></thead>
            <tbody>
                ${workspaceData.map((d, i) => `
                    <tr style="border-top:1px solid var(--border);">
                        <td style="padding:.5rem 0;"><strong>${i + 1}.</strong> ${d.name}</td>
                        <td style="padding:.5rem;"><span class="badge badge-secondary" style="font-size:0.75rem;">${formatType(d.type)}</span></td>
                        <td style="padding:.5rem;text-align:center;">${d.bookings}</td>
                        <td style="padding:.5rem 0;text-align:right;"><strong>${formatCurrency(d.revenue)}</strong></td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function formatType(type) {
    const map = {
        'hotdesk': 'Hot Desk',
        'meeting_room': 'Meeting Room',
        'conference': 'Conference',
        'private_cabin': 'Private Cabin',
        'office': 'Office'
    };
    return map[type] || type || 'Other';
}

function setEl(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
}
