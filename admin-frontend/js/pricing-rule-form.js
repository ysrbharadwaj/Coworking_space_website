/* admin-frontend/js/pricing-rule-form.js */
const ruleId = getParam('rule_id');
const isEdit = !!ruleId;

document.addEventListener('DOMContentLoaded', async () => {
    document.getElementById('form-heading').textContent = isEdit ? 'Edit Pricing Rule' : 'Add Pricing Rule';
    document.getElementById('page-title').textContent = isEdit ? 'Edit Pricing Rule' : 'Add Pricing Rule';
    document.getElementById('submit-btn').textContent = isEdit ? 'Update Rule' : 'Save Rule';

    await loadWorkspaces();
    if (isEdit) await loadRule();

    document.getElementById('pricing-rule-form').addEventListener('submit', handleSubmit);
});

async function loadWorkspaces() {
    try {
        const res = await fetch(`${API_URL}/workspaces`);
        const json = await res.json();
        const workspaces = json.data || json;

        const select = document.getElementById('workspace_id');
        select.innerHTML = '<option value="">-- Select Workspace --</option>' +
            workspaces.map(w => `<option value="${w.id}">${w.name} (${w.type})</option>`).join('');
    } catch (err) {
        console.error('Failed to load workspaces:', err);
        showToast('Failed to load workspaces', 'error');
    }
}

async function loadRule() {
    try {
        const res = await fetch(`${API_URL}/pricing/${ruleId}`);
        const json = await res.json();
        const r = json.data || json;

        document.getElementById('workspace_id').value = r.workspace_id || '';
        document.getElementById('rule_type').value = r.rule_type || '';
        document.getElementById('percentage_modifier').value = r.percentage_modifier != null ? r.percentage_modifier : '';
        document.getElementById('flat_modifier').value = r.flat_modifier != null ? r.flat_modifier : '';
        document.getElementById('start_time').value = r.start_time || '';
        document.getElementById('end_time').value = r.end_time || '';

        // Set checked days
        if (r.days && Array.isArray(r.days)) {
            document.querySelectorAll('input[name="day"]').forEach(checkbox => {
                checkbox.checked = r.days.includes(checkbox.value);
            });
        }
    } catch (err) {
        console.error('Failed to load rule:', err);
        showToast('Failed to load rule data', 'error');
    }
}

async function handleSubmit(e) {
    e.preventDefault();
    const errEl = document.getElementById('form-error');
    errEl.style.display = 'none';

    const workspace_id = document.getElementById('workspace_id').value;
    const rule_type = document.getElementById('rule_type').value;
    const percentage_modifier = document.getElementById('percentage_modifier').value;
    const flat_modifier = document.getElementById('flat_modifier').value;
    const start_time = document.getElementById('start_time').value;
    const end_time = document.getElementById('end_time').value;

    // Get selected days
    const days = Array.from(document.querySelectorAll('input[name="day"]:checked'))
        .map(cb => cb.value);

    // Validation
    if (!workspace_id) {
        errEl.textContent = 'Please select a workspace';
        errEl.style.display = 'block';
        return;
    }
    if (!rule_type) {
        errEl.textContent = 'Please select a rule type';
        errEl.style.display = 'block';
        return;
    }
    if (!percentage_modifier && !flat_modifier) {
        errEl.textContent = 'Please provide at least one modifier (percentage or flat)';
        errEl.style.display = 'block';
        return;
    }

    const body = {
        workspace_id: parseInt(workspace_id),
        rule_type: rule_type,
        percentage_modifier: percentage_modifier ? parseFloat(percentage_modifier) : 0,
        flat_modifier: flat_modifier ? parseFloat(flat_modifier) : 0,
        start_time: start_time || null,
        end_time: end_time || null,
        days: days
    };

    const url = isEdit ? `${API_URL}/pricing/${ruleId}` : `${API_URL}/pricing`;
    const method = isEdit ? 'PUT' : 'POST';

    try {
        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        const result = await res.json();

        if (!res.ok) {
            throw new Error(result.error || 'Failed to save rule');
        }

        showToast(isEdit ? 'Rule updated successfully!' : 'Rule created successfully!', 'success');
        setTimeout(() => { window.location.href = 'pricing-rules-list.html'; }, 800);
    } catch (err) {
        console.error('Save error:', err);
        errEl.textContent = err.message;
        errEl.style.display = 'block';
    }
}
