/* admin-frontend/js/users-list.js */
let allUsers = [];
let allBookings = [];

document.addEventListener('DOMContentLoaded', loadUsers);

// Auto-refresh every 15 seconds to show new users immediately
setInterval(loadUsers, 15000);

// Refresh when returning to this page
window.addEventListener('pageshow', (event) => {
    if (event.persisted || performance.navigation.type === 2) {
        loadUsers();
    }
});

async function loadUsers() {
    try {
        // Fetch users from backend API
        const usersRes = await fetch(`${API_URL}/users`);
        const usersJson = await usersRes.json();
        allUsers = usersJson.data || usersJson;

        // Also fetch bookings for additional data
        const bookingsRes = await fetch(`${API_URL}/bookings`);
        const bookingsJson = await bookingsRes.json();
        allBookings = bookingsJson.data || bookingsJson;


        // Calculate stats
        const now = new Date();
        const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const activeUsers = allUsers.filter(u => {
            const lastDate = new Date(u.first_booking);
            return lastDate >= thisMonth;
        }).length;

        document.getElementById('total-users').textContent = allUsers.length;
        document.getElementById('total-user-bookings').textContent = allUsers.reduce((sum, u) => sum + u.booking_count, 0);
        document.getElementById('active-users').textContent = activeUsers;

        // Populate city filter (keeping for backward compatibility)
        const cityFilter = document.getElementById('filter-city');
        if (cityFilter) {
            const cities = [...new Set(allBookings
                .map(b => b.workspaces?.working_hubs?.city)
                .filter(Boolean))].sort();
            cities.forEach(city => {
                const opt = document.createElement('option');
                opt.value = city;
                opt.textContent = city;
                cityFilter.appendChild(opt);
            });
        }

        renderUsers(allUsers);
        updateTimestamp();
    } catch (err) {
        console.error('Users load error', err);
        document.getElementById('users-table').innerHTML =
            '<tr><td colspan="7" style="text-align:center;">Failed to load users.</td></tr>';
    }
}

function updateTimestamp() {
    const el = document.getElementById('last-updated');
    if (el) el.textContent = 'Updated: ' + new Date().toLocaleTimeString();
}

function filterUsers() {
    const q = (document.getElementById('search')?.value || '').toLowerCase();
    const city = document.getElementById('filter-city')?.value || '';

    const filtered = allUsers.filter(user => {
        const matchQ = !q ||
            (user.name || '').toLowerCase().includes(q) ||
            (user.email || '').toLowerCase().includes(q) ||
            (user.phone || '').includes(q);

        // City filter - simplified since backend doesn't return city per user yet
        const matchCity = !city;

        return matchQ && matchCity;
    });

    renderUsers(filtered);
}

function renderUsers(users) {
    const tbody = document.getElementById('users-table');

    if (!users.length) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">No users found.</td></tr>';
        return;
    }

    // Sort by first booking date (most recent first)
    const sorted = [...users].sort((a, b) =>
        new Date(b.first_booking || 0) - new Date(a.first_booking || 0)
    );

    tbody.innerHTML = sorted.map(user => `
        <tr>
            <td>
                <strong>${user.name || '—'}</strong>
            </td>
            <td>${user.email || '—'}</td>
            <td>${user.phone || '—'}</td>
            <td><span class="badge badge-info">${user.booking_count || 0}</span></td>
            <td><strong>—</strong></td>
            <td>${user.first_booking ? formatDateTime(user.first_booking) : '—'}</td>
            <td>
                <a href="user-details.html?email=${encodeURIComponent(user.email)}" 
                   class="btn btn-sm btn-outline">
                    <i class="fas fa-eye"></i> View
                </a>
            </td>
        </tr>
    `).join('');
}
