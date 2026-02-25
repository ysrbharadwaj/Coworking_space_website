/* admin-frontend/js/pricing-rules-list.js */
let allRules = [];

document.addEventListener('DOMContentLoaded', loadRules);

// Auto-refresh every 15 seconds
setInterval(loadRules, 15000);

// Auto-refresh when returning from edit page
window.addEventListener('pageshow', (event) => {
    if (event.persisted || performance.navigation.type === 2) {
        loadRules();
    }
});

async function loadRules() {
    try {
        const res = await fetch(`${API_URL}/pricing`);
        const json = await res.json();
        allRules = json.data || json;
        renderRules(allRules);
        updateTimestamp();
    } catch {
        document.getElementById('rules-table').innerHTML =
            '<tr><td colspan="7" style="text-align:center;">Failed to load pricing rules.</td></tr>';
    }
}

function updateTimestamp() {
    const el = document.getElementById('last-updated');
    if (el) el.textContent = 'Updated: ' + new Date().toLocaleTimeString();
}

function filterRules() {
    const q = (document.getElementById('search')?.value || '').toLowerCase();
    const type = document.getElementById('filter-type')?.value || '';
    const filtered = allRules.filter(r => {
        const workspaceName = r.workspaces?.name || '';
        const matchQ = !q || workspaceName.toLowerCase().includes(q) || (r.rule_type || '').toLowerCase().includes(q);
        const matchType = !type || r.rule_type === type;
        return matchQ && matchType;
    });
    renderRules(filtered);
}

function renderRules(rules) {
    const tbody = document.getElementById('rules-table');
    if (!rules.length) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;">No pricing rules found.</td></tr>';
        return;
    }
    tbody.innerHTML = rules.map(r => {
        const workspaceName = r.workspaces?.name || `Workspace #${r.workspace_id}`;
        const percentMod = r.percentage_modifier != null ? (r.percentage_modifier > 0 ? '+' : '') + r.percentage_modifier + '%' : '—';
        const flatMod = r.flat_modifier != null ? (r.flat_modifier > 0 ? '+' : '') + '₹' + r.flat_modifier : '—';
        const timeRange = r.start_time && r.end_time ? `${r.start_time} – ${r.end_time}` : '—';
        const days = r.days && r.days.length > 0 ? r.days.join(', ') : 'All';

        return `
        <tr>
            <td>${r.id}</td>
            <td><strong>${workspaceName}</strong></td>
            <td>${formatRuleType(r.rule_type)}</td>
            <td>${percentMod}</td>
            <td>${flatMod}</td>
            <td>${timeRange}</td>
            <td><span class="badge badge-secondary" style="font-size:0.75rem;">${days}</span></td>
            <td>
                <a href="pricing-rule-form.html?rule_id=${r.id}" class="btn btn-sm btn-outline" title="Edit"><i class="fas fa-edit"></i></a>
                <button class="btn btn-sm btn-danger" onclick="deleteRule(${r.id})" title="Delete"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
        `;
    }).join('');
}

function formatRuleType(type) {
    const map = {
        peak_hours: 'Peak Hours',
        off_peak: 'Off-Peak',
        weekend: 'Weekend',
        demand: 'High Demand',
        long_booking: 'Long Booking',
        last_minute: 'Last Minute',
        early_bird: 'Early Bird',
        time_based: 'Time Based',
        day_based: 'Day Based',
        custom: 'Custom'
    };
    return map[type] || type || '—';
}



async function deleteRule(id) {
    if (!confirm('Are you sure you want to delete this pricing rule?')) return;
    try {
        const res = await fetch(`${API_URL}/pricing/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error();
        showToast('Rule deleted successfully', 'success');
        // Reload from server to ensure data is fresh
        await loadRules();
    } catch {
        showToast('Failed to delete rule', 'error');
    }
}
