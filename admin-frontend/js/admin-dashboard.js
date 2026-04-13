/* admin-frontend/js/admin-dashboard.js */
let bookingsChart = null;
let statusChart = null;

document.addEventListener('DOMContentLoaded', loadDashboard);

// Auto-refresh every 15 seconds for faster updates
setInterval(loadDashboard, 15000);

// Refresh when returning to dashboard
window.addEventListener('pageshow', (event) => {
    if (event.persisted || performance.navigation.type === 2) {
        loadDashboard();
    }
});

async function loadDashboard() {
    try {
        const [hubs, workspaces, bookings, users] = await Promise.all([
            fetch(`${API_URL}/hubs`).then(r => r.json()).then(d => d.data || d),
            fetch(`${API_URL}/workspaces`).then(r => r.json()).then(d => d.data || d),
            fetch(`${API_URL}/bookings`).then(r => r.json()).then(d => d.data || d),
            fetch(`${API_URL}/users`, { headers: getAdminHeaders() }).then(r => r.json()).then(d => d.data || d).catch(() => [])
        ]);

        // Calculate revenue: sum total_price from all paid bookings
        const paidStatuses = new Set(['confirmed', 'completed', 'checked_in']);
        const revenue = Array.isArray(bookings)
            ? bookings
                .filter(b => paidStatuses.has(b.status))
                .reduce((sum, b) => sum + (parseFloat(b.total_price) || 0), 0)
            : 0;

        // Calculate active bookings (confirmed or checked in)
        const activeBookings = Array.isArray(bookings)
            ? bookings.filter(b => b.status === 'confirmed' || b.status === 'checked_in').length
            : 0;

        // Calculate average rating

        // Count users
        const userCount = Array.isArray(users) ? users.length : 0;

        document.getElementById('stats-row').innerHTML = `
            <div class="stat-card" style="border:1px solid var(--accent);border-radius:0;box-shadow:0 6px 18px rgba(198, 169, 105, .08);">
                <i class="fas fa-rupee-sign"></i>
                <div><div class="value">${formatCurrency(revenue)}</div><div class="label">Total Revenue</div></div>
            </div>
            <div class="stat-card green" style="border:1px solid var(--accent);border-radius:0;box-shadow:0 6px 18px rgba(198, 169, 105, .08);">
                <i class="fas fa-calendar-check"></i>
                <div><div class="value">${activeBookings}</div><div class="label">Active Bookings</div></div>
            </div>
            <div class="stat-card yellow" style="border:1px solid var(--accent);border-radius:0;box-shadow:0 6px 18px rgba(198, 169, 105, .08);">
                <i class="fas fa-building"></i>
                <div><div class="value">${Array.isArray(hubs) ? hubs.length : 0}</div><div class="label">Hubs</div></div>
            </div>
            <div class="stat-card" style="border:1px solid var(--accent);border-radius:0;box-shadow:0 6px 18px rgba(198, 169, 105, .08);">
                <i class="fas fa-door-open"></i>
                <div><div class="value">${Array.isArray(workspaces) ? workspaces.length : 0}</div><div class="label">Workspaces</div></div>
            </div>
            <div class="stat-card" style="border:1px solid var(--accent);border-radius:0;box-shadow:0 6px 18px rgba(198, 169, 105, .08);">
                <i class="fas fa-users"></i>
                <div><div class="value">${userCount}</div><div class="label">Total Users</div></div>
            </div>
        `;

        document.getElementById('last-updated').textContent = 'Updated: ' + new Date().toLocaleTimeString();

        renderRecentBookings(Array.isArray(bookings) ? bookings : []);
        renderHubOverview(Array.isArray(hubs) ? hubs : [], Array.isArray(workspaces) ? workspaces : []);
        renderBookingsTrendChart(Array.isArray(bookings) ? bookings : []);
        renderStatusDistributionChart(Array.isArray(bookings) ? bookings : []);
    } catch (err) {
        console.error('Dashboard load error', err);
    }
}

function renderRecentBookings(bookings) {
    const tbody = document.getElementById('recent-bookings');
    if (!bookings.length) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">No bookings found</td></tr>';
        return;
    }
    // Sort all bookings by created_at descending, then take top 10
    const sorted = [...bookings].sort((a, b) => {
        const dateA = new Date(a.created_at || a.start_time);
        const dateB = new Date(b.created_at || b.start_time);
        return dateB - dateA;
    });

    tbody.innerHTML = sorted.slice(0, 10).map(b => `
        <tr>
            <td>#${b.id}</td>
            <td>${b.user_name || b.guest_name || '—'}</td>
            <td>${b.workspaces?.name || b.workspace_name || `WS #${b.workspace_id}` || '—'}</td>
            <td>${formatDateTime(b.start_time)}</td>
            <td><strong>${formatDateTime(b.created_at)}</strong></td>
            <td>${formatCurrency(b.total_price || b.amount || 0)}</td>
            <td><span class="badge ${statusBadge(b.status)}">${b.status}</span></td>
        </tr>
    `).join('');
}

function renderHubOverview(hubs, workspaces) {
    const el = document.getElementById('hub-overview');
    if (!hubs.length) { el.innerHTML = '<p>No hubs found.</p>'; return; }
    el.innerHTML = hubs.map(h => {
        const count = workspaces.filter(w => w.hub_id === h.id).length;
        return `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:.75rem 0;border-bottom:1px solid var(--border);">
                <div>
                    <strong>${h.name}</strong>
                    <div style="font-size:.82rem;color:var(--text-light);">${h.city || ''}, ${h.state || ''}</div>
                </div>
                <span class="badge badge-info">${count} workspace${count !== 1 ? 's' : ''}</span>
            </div>
        `;
    }).join('');
}

function statusBadge(status) {
    const map = { confirmed: 'badge-success', cancelled: 'badge-danger', pending: 'badge-warning', completed: 'badge-info' };
    return map[status] || 'badge-secondary';
}

function renderBookingsTrendChart(bookings) {
    const ctx = document.getElementById('bookings-chart');
    if (!ctx) return;

    // Destroy existing chart instance
    if (bookingsChart) {
        bookingsChart.destroy();
    }

    // Get last 7 days
    const days = [];
    const counts = [];

    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        d.setHours(0, 0, 0, 0);

        const dayStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        days.push(dayStr);

        const count = bookings.filter(b => {
            const bDate = new Date(b.created_at || b.start_time);
            bDate.setHours(0, 0, 0, 0);
            return bDate.getTime() === d.getTime();
        }).length;

        counts.push(count);
    }

    bookingsChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: days,
            datasets: [{
                label: 'Bookings',
                data: counts,
                borderColor: '#3498db',
                backgroundColor: 'rgba(52, 152, 219, 0.1)',
                tension: 0.3,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { stepSize: 1 }
                }
            }
        }
    });
}

function renderStatusDistributionChart(bookings) {
    const ctx = document.getElementById('status-chart');
    if (!ctx) return;

    // Destroy existing chart instance
    if (statusChart) {
        statusChart.destroy();
    }

    const statusCounts = {
        confirmed: bookings.filter(b => b.status === 'confirmed').length,
        pending: bookings.filter(b => b.status === 'pending').length,
        completed: bookings.filter(b => b.status === 'completed').length,
        checked_in: bookings.filter(b => b.status === 'checked_in').length,
        cancelled: bookings.filter(b => b.status === 'cancelled').length
    };

    const labels = [];
    const data = [];
    const colors = [];

    for (const [status, count] of Object.entries(statusCounts)) {
        if (count > 0) {
            labels.push(status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' '));
            data.push(count);

            const colorMap = {
                confirmed: '#27ae60',
                pending: '#f39c12',
                completed: '#3498db',
                checked_in: '#9b59b6',
                cancelled: '#e74c3c'
            };
            colors.push(colorMap[status] || '#95a5a6');
        }
    }

    statusChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
}
