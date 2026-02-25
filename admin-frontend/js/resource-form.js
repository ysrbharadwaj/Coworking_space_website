/* admin-frontend/js/resource-form.js */
const resourceId = getParam('resource_id');
const isEdit = !!resourceId;

document.addEventListener('DOMContentLoaded', async () => {
    document.getElementById('form-heading').textContent = isEdit ? 'Edit Resource' : 'Add New Resource';
    document.getElementById('page-title').textContent = isEdit ? 'Edit Resource' : 'Add Resource';
    document.getElementById('submit-btn').textContent = isEdit ? 'Update Resource' : 'Save Resource';

    await loadWorkspaces();
    if (isEdit) await loadResource();

    document.getElementById('resource-form').addEventListener('submit', handleSubmit);
});

async function loadWorkspaces() {
    try {
        const json = await fetch(`${API_URL}/workspaces`).then(r => r.json());
        const workspaces = json.data || json;
        const sel = document.getElementById('workspace_id');
        workspaces.forEach(w => {
            const opt = document.createElement('option');
            opt.value = w.id; opt.textContent = w.name;
            sel.appendChild(opt);
        });
    } catch {
        showToast('Failed to load workspaces', 'error');
    }
}

async function loadResource() {
    try {
        const res = await fetch(`${API_URL}/resources/${resourceId}`);
        const json = await res.json();
        const r = json.data || json;
        const f = document.getElementById('resource-form');
        f.elements['workspace_id'].value = r.workspace_id || '';
        f.elements['name'].value = r.name || '';
        f.elements['price_per_slot'].value = r.price_per_slot || '';
        f.elements['quantity'].value = r.quantity || '';
        f.elements['description'].value = r.description || '';
    } catch {
        showToast('Failed to load resource data', 'error');
    }
}

async function handleSubmit(e) {
    e.preventDefault();
    const errEl = document.getElementById('form-error');
    errEl.style.display = 'none';

    if (!validateForm(e.target)) return;

    const data = Object.fromEntries(new FormData(e.target).entries());
    const body = {
        workspace_id: parseInt(data.workspace_id),
        name: data.name,
        price_per_slot: parseFloat(data.price_per_slot),
        quantity: data.quantity ? parseInt(data.quantity) : undefined,
        description: data.description,
    };

    const url = isEdit ? `${API_URL}/resources/${resourceId}` : `${API_URL}/resources`;
    const method = isEdit ? 'PUT' : 'POST';

    try {
        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        if (!res.ok) {
            const d = await res.json().catch(() => ({}));
            throw new Error(d.error || 'Failed to save resource');
        }
        showToast(isEdit ? 'Resource updated!' : 'Resource created!', 'success');
        setTimeout(() => { window.location.href = 'resources-list.html'; }, 800);
    } catch (err) {
        errEl.textContent = err.message;
        errEl.style.display = 'block';
    }
}
