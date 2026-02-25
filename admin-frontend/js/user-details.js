/* admin-frontend/js/user-details.js */
let userEmail = '';
let userBookings = [];
let userTransactions = [];

document.addEventListener('DOMContentLoaded', loadUserDetails);

async function loadUserDetails() {
    userEmail = getParam('email');

    if (!userEmail) {
        document.getElementById('user-info').innerHTML =
            '<p style="color:var(--danger);">No user email provided.</p>';
        return;
    }

    try {
        // Fetch all bookings
        const allBookings = await fetch(`${API_URL}/bookings`).then(r => r.json());
        const bookingsArray = Array.isArray(allBookings) ? allBookings : (allBookings.data || []);

        // Filter bookings for this user
        userBookings = bookingsArray.filter(b =>
            (b.guest_email || b.user_email) === userEmail
        );

        if (!userBookings.length) {
            document.getElementById('user-info').innerHTML =
                '<p>No bookings found for this user.</p>';
            return;
        }

        // Get transactions from localStorage
        const allTransactions = getTransactions();
        userTransactions = allTransactions.filter(t =>
            userBookings.some(b => b.id === t.booking_id)
        );

        // Display user info
        const user = {
            name: userBookings[0].guest_name || userBookings[0].user_name || 'N/A',
            email: userEmail,
            phone: userBookings[0].guest_phone || userBookings[0].user_phone || 'N/A'
        };

        document.getElementById('user-info').innerHTML = `
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:1.5rem;">
                <div>
                    <label style="font-weight:600;color:var(--text-light);font-size:.85rem;">Full Name</label>
                    <p style="font-size:1.1rem;margin:.25rem 0 0 0;">${user.name}</p>
                </div>
                <div>
                    <label style="font-weight:600;color:var(--text-light);font-size:.85rem;">Email Address</label>
                    <p style="font-size:1.1rem;margin:.25rem 0 0 0;">${user.email}</p>
                </div>
                <div>
                    <label style="font-weight:600;color:var(--text-light);font-size:.85rem;">Phone Number</label>
                    <p style="font-size:1.1rem;margin:.25rem 0 0 0;">${user.phone}</p>
                </div>
            </div>
        `;

        // Calculate stats
        const totalSpent = userTransactions
            .filter(t => t.status === 'success')
            .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);

        const completed = userBookings.filter(b =>
            ['completed', 'checked_in'].includes(b.status)
        ).length;

        // Get average rating (from localStorage ratings if available)
        const allRatings = JSON.parse(localStorage.getItem('ratings') || '[]');
        const userRatings = allRatings.filter(r =>
            userBookings.some(b => b.id === r.booking_id)
        );
        const avgRating = userRatings.length
            ? (userRatings.reduce((s, r) => s + r.rating, 0) / userRatings.length).toFixed(1)
            : '—';

        document.getElementById('user-bookings-count').textContent = userBookings.length;
        document.getElementById('user-total-spent').textContent = formatCurrency(totalSpent);
        document.getElementById('user-completed-bookings').textContent = completed;
        document.getElementById('user-avg-rating').textContent = avgRating + (avgRating !== '—' ? ' ★' : '');

        renderBookings(userBookings);

    } catch (err) {
        console.error('User details load error', err);
        document.getElementById('user-info').innerHTML =
            '<p style="color:var(--danger);">Failed to load user details.</p>';
    }
}

function renderBookings(bookings) {
    const tbody = document.getElementById('bookings-table');

    if (!bookings.length) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;">No bookings found.</td></tr>';
        return;
    }

    // Sort by date (newest first)
    const sorted = [...bookings].sort((a, b) =>
        new Date(b.created_at || b.start_time) - new Date(a.created_at || a.start_time)
    );

    tbody.innerHTML = sorted.map(b => {
        const hubName = b.workspaces?.working_hubs?.name || '—';
        const city = b.workspaces?.working_hubs?.city || '—';
        const workspaceName = b.workspaces?.name || b.workspace_name || `WS #${b.workspace_id}`;

        return `
            <tr>
                <td>#${b.id}</td>
                <td>${workspaceName}</td>
                <td>${hubName}<br><small style="color:var(--text-light);">${city}</small></td>
                <td>${formatDateTime(b.start_time)}</td>
                <td>${formatDateTime(b.end_time)}</td>
                <td><strong>${formatDateTime(b.created_at)}</strong></td>
                <td><strong>${formatCurrency(b.total_amount || b.amount || 0)}</strong></td>
                <td><span class="badge ${statusBadge(b.status)}">${formatStatus(b.status)}</span></td>
                <td>
                    <a href="booking-details-admin.html?booking_id=${b.id}" 
                       class="btn btn-sm btn-outline">
                        <i class="fas fa-eye"></i> View
                    </a>
                </td>
            </tr>
        `;
    }).join('');
}

function statusBadge(s) {
    const map = {
        confirmed: 'badge-success',
        cancelled: 'badge-danger',
        pending: 'badge-warning',
        completed: 'badge-info',
        checked_in: 'badge-info'
    };
    return map[s] || 'badge-secondary';
}
