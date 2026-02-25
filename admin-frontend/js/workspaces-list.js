/* admin-frontend/js/workspaces-list.js */
let allWorkspaces = [];
let allHubs = [];

document.addEventListener('DOMContentLoaded', loadWorkspaces);

// Auto-refresh every 15 seconds
setInterval(loadWorkspaces, 15000);

// Refresh when returning from form pages
window.addEventListener('pageshow', (event) => {
    if (event.persisted || performance.navigation.type === 2) {
        loadWorkspaces();
    }
});

async function loadWorkspaces() {
    try {
        [allHubs, allWorkspaces] = await Promise.all([
            fetch(`${API_URL}/hubs`).then(r => r.json()).then(d => d.data || d),
            fetch(`${API_URL}/workspaces`).then(r => r.json()).then(d => d.data || d),
        ]);
        populateHubFilter();
        renderWorkspaces(allWorkspaces);
        updateTimestamp();
    } catch {
        document.getElementById('workspaces-table').innerHTML =
            '<tr><td colspan="8" style="text-align:center;">Failed to load workspaces.</td></tr>';
    }
}

function updateTimestamp() {
    const el = document.getElementById('last-updated');
    if (el) el.textContent = 'Updated: ' + new Date().toLocaleTimeString();
}

function populateHubFilter() {
    const sel = document.getElementById('filter-hub');
    if (!sel) return;
    allHubs.forEach(h => {
        const opt = document.createElement('option');
        opt.value = h.id; opt.textContent = h.name;
        sel.appendChild(opt);
    });
}

function filterWorkspaces() {
    const q = (document.getElementById('search')?.value || '').toLowerCase();
    const hub = document.getElementById('filter-hub')?.value || '';
    const type = document.getElementById('filter-type')?.value || '';
    const filtered = allWorkspaces.filter(w => {
        const matchQ = !q || (w.name || '').toLowerCase().includes(q);
        const matchHub = !hub || String(w.hub_id) === hub;
        const matchType = !type || w.type === type;
        return matchQ && matchHub && matchType;
    });
    renderWorkspaces(filtered);
}

function hubName(id) {
    const h = allHubs.find(h => h.id === id);
    return h ? h.name : id;
}

function renderWorkspaces(workspaces) {
    const tbody = document.getElementById('workspaces-table');
    if (!workspaces.length) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;">No workspaces found.</td></tr>';
        return;
    }
    tbody.innerHTML = workspaces.map(w => `
        <tr>
            <td>${w.id}</td>
            <td>${w.name}</td>
            <td>${hubName(w.hub_id)}</td>
            <td>${formatType(w.type)}</td>
            <td>${w.capacity || '—'}</td>
            <td>₹${w.base_price || w.price_per_hour || 0}/hr</td>
            <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${w.description || ''}">${w.description || '—'}</td>
            <td><span class="badge ${w.is_available !== false ? 'badge-success' : 'badge-danger'}">
                ${w.is_available !== false ? 'Available' : 'Unavailable'}
            </span></td>
            <td>
                <a href="workspace-form.html?workspace_id=${w.id}" class="btn btn-sm btn-outline"><i class="fas fa-edit"></i></a>
                <button class="btn btn-sm btn-danger" onclick="deleteWorkspace(${w.id})"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

async function deleteWorkspace(id) {
    if (!confirm('Delete this workspace?')) return;
    try {
        const res = await fetch(`${API_URL}/workspaces/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error();
        showToast('Workspace deleted', 'success');
        allWorkspaces = allWorkspaces.filter(w => w.id !== id);
        filterWorkspaces();
    } catch {
        showToast('Failed to delete workspace', 'error');
    }
}
