/* admin-frontend/js/hub-form.js */
const hubId = getParam('hub_id');
const isEdit = !!hubId;

document.addEventListener('DOMContentLoaded', async () => {
    document.getElementById('form-heading').textContent = isEdit ? 'Edit Hub' : 'Add New Hub';
    document.getElementById('page-title').textContent = isEdit ? 'Edit Hub' : 'Add Hub';
    document.getElementById('submit-btn').textContent = isEdit ? 'Update Hub' : 'Save Hub';

    if (isEdit) await loadHub();

    document.getElementById('hub-form').addEventListener('submit', handleSubmit);
});

async function loadHub() {
    try {
        const res = await fetch(`${API_URL}/hubs/${hubId}`);
        const json = await res.json();
        const hub = json.data || json;
        const f = document.getElementById('hub-form');
        f.elements['name'].value = hub.name || '';
        f.elements['city'].value = hub.city || '';
        f.elements['state'].value = hub.state || '';
        f.elements['country'].value = hub.country || '';
        f.elements['address'].value = hub.address || '';
        f.elements['pincode'].value = hub.pincode || '';
        f.elements['latitude'].value = hub.latitude || '';
        f.elements['longitude'].value = hub.longitude || '';
    } catch {
        showToast('Failed to load hub data', 'error');
    }
}

async function handleSubmit(e) {
    e.preventDefault();
    const errEl = document.getElementById('form-error');
    errEl.style.display = 'none';

    if (!validateForm(e.target)) return;

    const body = Object.fromEntries(new FormData(e.target).entries());

    // Convert latitude/longitude to numbers if provided
    if (body.latitude && body.latitude !== '') {
        body.latitude = parseFloat(body.latitude);
    } else {
        delete body.latitude; // Don't send empty string
    }

    if (body.longitude && body.longitude !== '') {
        body.longitude = parseFloat(body.longitude);
    } else {
        delete body.longitude; // Don't send empty string
    }

    const url = isEdit ? `${API_URL}/hubs/${hubId}` : `${API_URL}/hubs`;
    const method = isEdit ? 'PUT' : 'POST';

    try {
        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error || 'Failed to save hub');
        }
        showToast(isEdit ? 'Hub updated!' : 'Hub created!', 'success');
        setTimeout(() => { window.location.href = 'hubs-list.html'; }, 800);
    } catch (err) {
        errEl.textContent = err.message;
        errEl.style.display = 'block';
    }
}
