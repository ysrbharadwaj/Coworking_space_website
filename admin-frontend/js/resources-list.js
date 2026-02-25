/* admin-frontend/js/resources-list.js */
let allResources = [];
let allWorkspaces = [];

document.addEventListener('DOMContentLoaded', loadResources);

// Auto-refresh every 15 seconds
setInterval(loadResources, 15000);

// Refresh when returning from form pages
window.addEventListener('pageshow', (event) => {
    if (event.persisted || performance.navigation.type === 2) {
        loadResources();
    }
});

async function loadResources() {
    try {
        [allWorkspaces, allResources] = await Promise.all([
            fetch(`${API_URL}/workspaces`).then(r => r.json()).then(d => d.data || d),
            fetch(`${API_URL}/resources`).then(r => r.json()).then(d => d.data || d),
        ]);
        populateWorkspaceFilter();
        renderResources(allResources);
        updateTimestamp();
    } catch {
        document.getElementById('resources-table').innerHTML =
            '<tr><td colspan="7" style="text-align:center;">Failed to load resources.</td></tr>';
    }
}

function updateTimestamp() {
    const el = document.getElementById('last-updated');
    if (el) el.textContent = 'Updated: ' + new Date().toLocaleTimeString();
}

function populateWorkspaceFilter() {
    const sel = document.getElementById('filter-workspace');
    if (!sel) return;
    allWorkspaces.forEach(w => {
        const opt = document.createElement('option');
        opt.value = w.id; opt.textContent = w.name;
        sel.appendChild(opt);
    });
}

function filterResources() {
    const q = (document.getElementById('search')?.value || '').toLowerCase();
    const ws = document.getElementById('filter-workspace')?.value || '';
    const filtered = allResources.filter(r => {
        const matchQ = !q || (r.name || '').toLowerCase().includes(q);
        const matchWs = !ws || String(r.workspace_id) === ws;
        return matchQ && matchWs;
    });
    renderResources(filtered);
}

function workspaceName(id) {
    const w = allWorkspaces.find(w => w.id === id);
    return w ? w.name : id;
}

function renderResources(resources) {
    const tbody = document.getElementById('resources-table');
    if (!resources.length) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">No resources found.</td></tr>';
        return;
    }
    tbody.innerHTML = resources.map(r => `
        <tr>
            <td>${r.id}</td>
            <td>${r.name}</td>
            <td>${workspaceName(r.workspace_id)}</td>
            <td>₹${r.price_per_slot || 0}/slot</td>
            <td>${r.quantity !== undefined ? r.quantity : '—'}</td>
            <td>${r.description || '—'}</td>
            <td>
                <a href="resource-form.html?resource_id=${r.id}" class="btn btn-sm btn-outline"><i class="fas fa-edit"></i></a>
                <button class="btn btn-sm btn-danger" onclick="deleteResource(${r.id})"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

async function deleteResource(id) {
    if (!confirm('Delete this resource?')) return;
    try {
        const res = await fetch(`${API_URL}/resources/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error();
        showToast('Resource deleted', 'success');
        allResources = allResources.filter(r => r.id !== id);
        filterResources();
    } catch {
        showToast('Failed to delete resource', 'error');
    }
}
