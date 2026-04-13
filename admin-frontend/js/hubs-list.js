/* admin-frontend/js/hubs-list.js */
let allHubs = [];

document.addEventListener('DOMContentLoaded', loadHubs);

// Auto-refresh every 15 seconds
setInterval(loadHubs, 15000);

// Refresh when returning from form pages
window.addEventListener('pageshow', (event) => {
    if (event.persisted || performance.navigation.type === 2) {
        loadHubs();
    }
});

async function loadHubs() {
    const tbody = document.getElementById('hubs-table');
    try {
        const res = await fetch(`${API_URL}/hubs`);
        const json = await res.json();
        allHubs = json.data || json;
        populateCityFilter();
        renderHubs(allHubs);
        updateTimestamp();
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">Failed to load hubs.</td></tr>';
    }
}

function updateTimestamp() {
    const el = document.getElementById('last-updated');
    if (el) el.textContent = 'Updated: ' + new Date().toLocaleTimeString();
}

function populateCityFilter() {
    const sel = document.getElementById('filter-city');
    if (!sel) return;
    const cities = [...new Set(allHubs.map(h => h.city).filter(Boolean))].sort();
    cities.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c; opt.textContent = c;
        sel.appendChild(opt);
    });
}

function filterHubs() {
    const q = (document.getElementById('search')?.value || '').toLowerCase();
    const city = document.getElementById('filter-city')?.value || '';
    const filtered = allHubs.filter(h => {
        const matchQ = !q || (h.name || '').toLowerCase().includes(q) || (h.city || '').toLowerCase().includes(q);
        const matchCity = !city || h.city === city;
        return matchQ && matchCity;
    });
    renderHubs(filtered);
}

function renderHubs(hubs) {
    const tbody = document.getElementById('hubs-table');
    if (!hubs.length) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">No hubs found.</td></tr>';
        return;
    }
    tbody.innerHTML = hubs.map(h => `
        <tr>
            <td>${h.id}</td>
            <td>${h.name}</td>
            <td>${h.city || '—'}</td>
            <td>${h.state || '—'}</td>
            <td>${h.country || '—'}</td>
            <td>${h.address || '—'}</td>
            <td>
                <div class="table-actions hub-actions" style="display:flex;align-items:center;gap:.45rem;flex-wrap:nowrap;white-space:nowrap;">
                    <a href="hub-form.html?hub_id=${h.id}" class="btn btn-sm btn-outline"><i class="fas fa-edit"></i> Edit</a>
                    <button class="btn btn-sm btn-danger" onclick="deleteHub(${h.id})"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        </tr>
    `).join('');
}

async function deleteHub(id) {
    if (!confirm('Delete this hub? This cannot be undone.')) return;
    try {
        const res = await fetch(`${API_URL}/hubs/${id}`, { method: 'DELETE', headers: getAdminHeaders() });
        if (!res.ok) throw new Error();
        showToast('Hub deleted', 'success');
        allHubs = allHubs.filter(h => h.id !== id);
        filterHubs();
    } catch {
        showToast('Failed to delete hub', 'error');
    }
}
