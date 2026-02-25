/* admin-frontend/js/workspace-form.js */
const workspaceId = getParam('workspace_id');
const isEdit = !!workspaceId;

document.addEventListener('DOMContentLoaded', async () => {
    document.getElementById('form-heading').textContent = isEdit ? 'Edit Workspace' : 'Add New Workspace';
    document.getElementById('page-title').textContent = isEdit ? 'Edit Workspace' : 'Add Workspace';
    document.getElementById('submit-btn').textContent = isEdit ? 'Update Workspace' : 'Save Workspace';

    await loadHubs();
    if (isEdit) await loadWorkspace();

    document.getElementById('workspace-form').addEventListener('submit', handleSubmit);
});

async function loadHubs() {
    try {
        const json = await fetch(`${API_URL}/hubs`).then(r => r.json());
        const hubs = json.data || json;
        const sel = document.getElementById('hub_id');
        hubs.forEach(h => {
            const opt = document.createElement('option');
            opt.value = h.id; opt.textContent = h.name;
            sel.appendChild(opt);
        });
    } catch {
        showToast('Failed to load hubs', 'error');
    }
}

async function loadWorkspace() {
    try {
        const res = await fetch(`${API_URL}/workspaces/${workspaceId}`);
        const json = await res.json();
        const w = json.data || json;
        const f = document.getElementById('workspace-form');
        f.elements['hub_id'].value = w.hub_id || '';
        f.elements['name'].value = w.name || '';
        f.elements['type'].value = w.type || '';
        f.elements['capacity'].value = w.capacity || '';
        f.elements['base_price'].value = w.base_price || w.price_per_hour || '';
        f.elements['amenities'].value = Array.isArray(w.amenities) ? w.amenities.join(', ') : (w.amenities || '');
        f.elements['description'].value = w.description || '';
        f.elements['is_available'].value = w.is_available === false ? 'false' : 'true';
    } catch {
        showToast('Failed to load workspace data', 'error');
    }
}

async function handleSubmit(e) {
    e.preventDefault();
    const errEl = document.getElementById('form-error');
    errEl.style.display = 'none';

    if (!validateForm(e.target)) return;

    const data = Object.fromEntries(new FormData(e.target).entries());
    const body = {
        hub_id: parseInt(data.hub_id),
        name: data.name,
        type: data.type,
        capacity: parseInt(data.capacity),
        base_price: parseFloat(data.base_price),
        amenities: data.amenities ? data.amenities.split(',').map(s => s.trim()).filter(Boolean) : [],
        description: data.description,
        is_available: data.is_available === 'true',
    };

    const url = isEdit ? `${API_URL}/workspaces/${workspaceId}` : `${API_URL}/workspaces`;
    const method = isEdit ? 'PUT' : 'POST';

    try {
        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        if (!res.ok) {
            const d = await res.json().catch(() => ({}));
            throw new Error(d.error || 'Failed to save workspace');
        }
        showToast(isEdit ? 'Workspace updated!' : 'Workspace created!', 'success');
        setTimeout(() => { window.location.href = 'workspaces-list.html'; }, 800);
    } catch (err) {
        errEl.textContent = err.message;
        errEl.style.display = 'block';
    }
}
