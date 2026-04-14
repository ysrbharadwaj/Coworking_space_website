# YOUR CONTRIBUTIONS EXPLAINED - Complete Code Guide

---

## TABLE OF CONTENTS

1. **Admin Dashboard JS Files** (First 10)
2. **Admin Frontend HTML Files** (First 10)
3. **Backend Routes** (bookings.js, pricing.js, ratings.js)
4. **Dynamic Pricing Engine**
5. **Data Scraping / Migration** 

---

## PART 1: ADMIN DASHBOARD JS FILES (FIRST 10)

### 1. `admin-dashboard.js` - Main Admin Home

**Main Function:** `loadDashboard()`

**What it does:** Fetch all data from API and display KPI cards on dashboard

```javascript
async function loadDashboard() {
    try {
        // Fetch 4 data sources in parallel
        const [hubs, workspaces, bookings, users] = await Promise.all([
            fetch(`${API_URL}/hubs`).then(r => r.json()).then(d => d.data || d),
            fetch(`${API_URL}/workspaces`).then(r => r.json()).then(d => d.data || d),
            fetch(`${API_URL}/bookings`).then(r => r.json()).then(d => d.data || d),
            fetch(`${API_URL}/users`, { headers: getAdminHeaders() })
                .then(r => r.json())
                .then(d => d.data || d)
                .catch(() => [])
        ]);

        // Calculate revenue: sum total_price from all paid bookings
        const paidStatuses = new Set(['confirmed', 'completed', 'checked_in']);
        const revenue = Array.isArray(bookings)
            ? bookings
                .filter(b => paidStatuses.has(b.status))
                .reduce((sum, b) => sum + (parseFloat(b.total_price) || 0), 0)
            : 0;

        // Calculate active bookings (confirmed or checked in)
        const activeBookings = Array.isArray(bookings)
            ? bookings.filter(b => b.status === 'confirmed' || b.status === 'checked_in').length
            : 0;

        // Count users
        const userCount = Array.isArray(users) ? users.length : 0;

        // Display stats cards
        document.getElementById('stats-row').innerHTML = `
            <div class="stat-card">
                <i class="fas fa-rupee-sign"></i>
                <div><div class="value">${formatCurrency(revenue)}</div><div class="label">Total Revenue</div></div>
            </div>
            <div class="stat-card green">
                <i class="fas fa-calendar-check"></i>
                <div><div class="value">${activeBookings}</div><div class="label">Active Bookings</div></div>
            </div>
            <div class="stat-card yellow">
                <i class="fas fa-building"></i>
                <div><div class="value">${Array.isArray(hubs) ? hubs.length : 0}</div><div class="label">Hubs</div></div>
            </div>
            <div class="stat-card">
                <i class="fas fa-door-open"></i>
                <div><div class="value">${Array.isArray(workspaces) ? workspaces.length : 0}</div><div class="label">Workspaces</div></div>
            </div>
            <div class="stat-card">
                <i class="fas fa-users"></i>
                <div><div class="value">${userCount}</div><div class="label">Total Users</div></div>
            </div>
        `;

        document.getElementById('last-updated').textContent = 'Updated: ' + new Date().toLocaleTimeString();

        // Render charts
        renderRecentBookings(Array.isArray(bookings) ? bookings : []);
        renderHubOverview(Array.isArray(hubs) ? hubs : [], Array.isArray(workspaces) ? workspaces : []);
        renderBookingsTrendChart(Array.isArray(bookings) ? bookings : []);
        renderStatusDistributionChart(Array.isArray(bookings) ? bookings : []);
    } catch (err) {
        console.error('Dashboard load error', err);
    }
}

// Auto-refresh every 15 seconds
document.addEventListener('DOMContentLoaded', loadDashboard);
setInterval(loadDashboard, 15000);
```

---

### 2. `bookings-list.js` - Show All Bookings

**Main Function:** `loadBookings()`

**What it does:** Fetch bookings and display in filterable table

```javascript
async function loadBookings() {
    try {
        const json = await fetch(`${API_URL}/bookings`).then(r => r.json());
        allBookings = json.data || json;
        renderBookings(allBookings);
        updateTimestamp();
    } catch {
        document.getElementById('bookings-table').innerHTML =
            '<tr><td colspan="8" style="text-align:center;">Failed to load bookings.</td></tr>';
    }
}

// Render bookings in table
function renderBookings(bookings) {
    const tbody = document.getElementById('bookings-table');
    if (!bookings.length) {
        tbody.innerHTML = '<tr><td colspan="9">No bookings found.</td></tr>';
        return;
    }
    
    tbody.innerHTML = bookings.map(b => `
        <tr>
            <td>#${b.id}</td>
            <td>${b.guest_name || '—'}</td>
            <td>${b.guest_email || '—'}</td>
            <td>${b.workspace_name || b.workspace_id || '—'}</td>
            <td>${formatDateTime(b.start_time)}</td>
            <td>${formatDateTime(b.end_time)}</td>
            <td><strong>${formatDateTime(b.created_at)}</strong></td>
            <td><span class="badge ${statusBadge(b.status)}">${b.status}</span></td>
            <td style="display:flex;gap:.5rem;">
                <a href="booking-details-admin.html?booking_id=${b.id}" class="btn btn-sm btn-outline">
                    <i class="fas fa-eye"></i> View
                </a>
                ${getQuickActions(b)}
            </td>
        </tr>
    `).join('');
}

// Quick status update
async function quickUpdateStatus(bookingId, status) {
    if (!confirm(`Change booking #${bookingId} status to "${status}"?`)) return;

    try {
        const res = await fetch(`${API_URL}/bookings/${bookingId}`, {
            method: 'PATCH',
            headers: { ...getAdminHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });

        if (!res.ok) throw new Error('Failed to update');
        // Reload list
        loadBookings();
        showToast(`Booking updated to ${status}`, 'success');
    } catch (err) {
        showToast(err.message, 'error');
    }
}
```

---

### 3. `financial-reports.js` - Revenue Analytics

**Main Function:** `loadReport()`

**What it does:** Calculate KPIs and generate revenue charts

```javascript
async function loadReport() {
    const days = parseInt(document.getElementById('period')?.value || '30');
    const cutoff = new Date(Date.now() - days * 86400000);

    try {
        const [bookings, hubs, workspaces, ratings] = await Promise.all([
            fetch(`${API_URL}/bookings`).then(r => r.json()).then(d => d.data || d),
            fetch(`${API_URL}/hubs`).then(r => r.json()).then(d => d.data || d),
            fetch(`${API_URL}/workspaces`).then(r => r.json()).then(d => d.data || d),
            fetch(`${API_URL}/ratings`).then(r => r.json()).then(d => d.data || d).catch(() => [])
        ]);

        // Filter bookings by date period
        const periodBookings = Array.isArray(bookings)
            ? bookings.filter(b => {
                const date = new Date(b.created_at || b.start_time);
                return date >= cutoff;
            })
            : [];

        // Compute dashboard metrics
        computeKPIs(periodBookings, workspaces, ratings, days);
        renderRevenueByHub(periodBookings, hubs, workspaces);
        renderBookingsByStatus(periodBookings);
        renderRevenueByType(periodBookings, workspaces);
        renderTopWorkspaces(periodBookings, workspaces);
    } catch (err) {
        console.error('Financial reports error', err);
    }
}

// Calculate key indicators
function computeKPIs(bookings, workspaces, ratings, days) {
    // Calculate revenue from successful bookings
    const revenue = bookings
        .filter(b => b.status === 'confirmed' || b.status === 'completed')
        .reduce((sum, b) => sum + (parseFloat(b.total_price) || 0), 0);

    // Count confirmed/completed bookings
    const confirmedBookings = bookings.filter(b =>
        b.status === 'confirmed' || b.status === 'completed' || b.status === 'checked_in'
    ).length;

    // Calculate occupancy rate (simplified)
    const totalWorkspaces = workspaces.length || 1;
    const occupancy = Math.round((confirmedBookings / (totalWorkspaces * days)) * 100);

    // Calculate average rating from API
    const avgRating = Array.isArray(ratings) && ratings.length > 0
        ? (ratings.reduce((sum, r) => sum + (r.rating || 0), 0) / ratings.length).toFixed(1)
        : '0.0';

    setEl('total-revenue', formatCurrency(revenue));
    setEl('total-bookings', bookings.length);
    setEl('occupancy-rate', occupancy + '%');
    setEl('avg-rating', avgRating + ' ★');
}
```

---

### 4. `pricing-rule-form.js` - Create/Edit Pricing Rules

**Main Function:** `handleSubmit(e)`

**What it does:** Save custom pricing rules to database

```javascript
const ruleId = getParam('rule_id');
const isEdit = !!ruleId;

document.addEventListener('DOMContentLoaded', async () => {
    document.getElementById('form-heading').textContent = isEdit ? 'Edit Pricing Rule' : 'Add Pricing Rule';
    document.getElementById('submit-btn').textContent = isEdit ? 'Update Rule' : 'Save Rule';

    await loadWorkspaces();
    if (isEdit) await loadRule();

    document.getElementById('pricing-rule-form').addEventListener('submit', handleSubmit);
});

// Load all workspaces for dropdown
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

// Load existing rule for editing
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
        showToast('Failed to load rule data', 'error');
    }
}

// Save rule to backend
async function handleSubmit(e) {
    e.preventDefault();
    const errEl = document.getElementById('form-error');
    errEl.style.display = 'none';

    const data = Object.fromEntries(new FormData(e.target).entries());
    const checkedDays = Array.from(document.querySelectorAll('input[name="day"]:checked'))
        .map(cb => cb.value);

    const body = {
        workspace_id: parseInt(data.workspace_id),
        rule_type: data.rule_type,
        percentage_modifier: parseFloat(data.percentage_modifier) || 0,
        flat_modifier: parseFloat(data.flat_modifier) || 0,
        start_time: data.start_time || null,
        end_time: data.end_time || null,
        days: checkedDays
    };

    const url = isEdit ? `${API_URL}/pricing/${ruleId}` : `${API_URL}/pricing`;
    const method = isEdit ? 'PUT' : 'POST';

    try {
        const res = await fetch(url, {
            method,
            headers: getAdminHeaders(),
            body: JSON.stringify(body)
        });
        
        if (!res.ok) {
            const d = await res.json().catch(() => ({}));
            throw new Error(d.error || 'Failed to save rule');
        }
        
        showToast(isEdit ? 'Rule updated!' : 'Rule created!', 'success');
        setTimeout(() => { window.location.href = 'pricing-rules-list.html'; }, 800);
    } catch (err) {
        errEl.textContent = err.message;
        errEl.style.display = 'block';
    }
}
```

---

### 5. `pricing-rules-list.js` - View All Pricing Rules

**Main Function:** `loadRules()`

**What it does:** Display all pricing rules in a table

```javascript
let allRules = [];

document.addEventListener('DOMContentLoaded', loadRules);

// Auto-refresh every 15 seconds
setInterval(loadRules, 15000);

async function loadRules() {
    try {
        const res = await fetch(`${API_URL}/pricing`);
        const json = await res.json();
        allRules = json.data || json;
        renderRules(allRules);
        updateTimestamp();
    } catch {
        document.getElementById('rules-table').innerHTML =
            '<tr><td colspan="7">Failed to load pricing rules.</td></tr>';
    }
}

// Filter rules by search/type
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

// Display rules in table
function renderRules(rules) {
    const tbody = document.getElementById('rules-table');
    if (!rules.length) {
        tbody.innerHTML = '<tr><td colspan="8">No pricing rules found.</td></tr>';
        return;
    }
    
    tbody.innerHTML = rules.map(r => `
        <tr>
            <td>${r.id}</td>
            <td>${r.workspaces?.name || '—'}</td>
            <td><span class="badge">${r.rule_type}</span></td>
            <td>${r.percentage_modifier || 0}%</td>
            <td>₹${r.flat_modifier || 0}</td>
            <td>${r.start_time ? `${r.start_time} - ${r.end_time}` : 'All day'}</td>
            <td>${r.days ? r.days.join(', ') : 'All days'}</td>
            <td>
                <a href="pricing-rule-form.html?rule_id=${r.id}" class="btn btn-sm"><i class="fas fa-edit"></i></a>
                <button class="btn btn-sm btn-danger" onclick="deleteRule(${r.id})"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}
```

---

### 6. `hub-form.js` - Add/Edit Hub with Map

**Main Function:** `handleSubmit(e)`, `updateMapPreview()`

**What it does:** Create/edit hub with Google Maps preview

```javascript
const hubId = getParam('hub_id');
const isEdit = !!hubId;

document.addEventListener('DOMContentLoaded', async () => {
    document.getElementById('form-heading').textContent = isEdit ? 'Edit Hub' : 'Add New Hub';
    document.getElementById('submit-btn').textContent = isEdit ? 'Update Hub' : 'Save Hub';

    if (isEdit) await loadHub();

    // Event listeners for live map update
    document.getElementById('address').addEventListener('change', updateMapPreview);
    document.getElementById('city').addEventListener('change', updateMapPreview);
    document.getElementById('state').addEventListener('change', updateMapPreview);

    if (isEdit) {
        updateMapPreview();
    }

    document.getElementById('hub-form').addEventListener('submit', handleSubmit);
});

// Load hub data for editing
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

// Update map preview based on address
function updateMapPreview() {
    const address = document.getElementById('address')?.value || '';
    const city = document.getElementById('city')?.value || '';
    const state = document.getElementById('state')?.value || '';
    
    if (!address || !city) return;

    const mapHTML = generateAddressMapEmbed(address, city, state);
    const mapContainer = document.getElementById('hub-map-preview');
    if (mapContainer) mapContainer.innerHTML = mapHTML;
}

// Save hub to backend
async function handleSubmit(e) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target).entries());
    
    const body = {
        name: data.name,
        address: data.address,
        city: data.city,
        state: data.state,
        country: data.country || 'India',
        pincode: data.pincode,
        latitude: parseFloat(data.latitude),
        longitude: parseFloat(data.longitude)
    };

    const url = isEdit ? `${API_URL}/hubs/${hubId}` : `${API_URL}/hubs`;
    const method = isEdit ? 'PUT' : 'POST';

    try {
        const res = await fetch(url, {
            method,
            headers: getAdminHeaders(),
            body: JSON.stringify(body)
        });

        if (!res.ok) throw new Error('Failed to save hub');
        
        showToast(isEdit ? 'Hub updated!' : 'Hub created!', 'success');
        setTimeout(() => { window.location.href = 'hubs-list.html'; }, 800);
    } catch (err) {
        showToast(err.message, 'error');
    }
}
```

---

### 7. `hubs-list.js` - View All Hubs

**Main Function:** `loadHubs()`

**What it does:** Display hubs in table with city filter

```javascript
let allHubs = [];

document.addEventListener('DOMContentLoaded', loadHubs);
setInterval(loadHubs, 15000); // Auto-refresh

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
        tbody.innerHTML = '<tr><td colspan="7">Failed to load hubs.</td></tr>';
    }
}

// Populate city filter dropdown
function populateCityFilter() {
    const sel = document.getElementById('filter-city');
    if (!sel) return;
    const cities = [...new Set(allHubs.map(h => h.city).filter(Boolean))].sort();
    cities.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c;
        opt.textContent = c;
        sel.appendChild(opt);
    });
}

// Filter hubs
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

// Display hubs table
function renderHubs(hubs) {
    const tbody = document.getElementById('hubs-table');
    if (!hubs.length) {
        tbody.innerHTML = '<tr><td colspan="7">No hubs found.</td></tr>';
        return;
    }
    
    tbody.innerHTML = hubs.map(h => `
        <tr>
            <td>${h.id}</td>
            <td><strong>${h.name}</strong></td>
            <td>${h.address}</td>
            <td>${h.city}</td>
            <td>${h.state}</td>
            <td>${h.pincode}</td>
            <td>
                <a href="hub-form.html?hub_id=${h.id}" class="btn btn-sm"><i class="fas fa-edit"></i></a>
                <button class="btn btn-sm btn-danger" onclick="deleteHub(${h.id})"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}
```

---

### 8. `map-utils.js` - Google Maps Helper Functions

**Main Function:** `generateAdminMapEmbed()`, `generateAddressMapEmbed()`

**What it does:** Generate Google Maps embeds for hub locations

```javascript
/**
 * Generate Google Maps embed iframe for admin forms
 * @param {Object} hub - Hub object with address, city, state
 * @param {number} height - Height in pixels (default: 300)
 * @returns {string} HTML for map embed
 */
function generateAdminMapEmbed(hub, height = 300) {
    if (!hub || !hub.address || !hub.city) return '';

    const fullAddress = `${hub.address}, ${hub.city}, ${hub.state || ''}, India`;
    const encodedAddress = encodeURIComponent(fullAddress);
    
    const mapHTML = `
        <div style="background:white;border-radius:8px;box-shadow:0 2px 10px rgba(0,0,0,0.1);margin-top:1rem;overflow:hidden;">
            <div style="width:100%;height:${height}px;position:relative;">
                <iframe 
                    width="100%" 
                    height="100%" 
                    style="border:none;border-radius:8px;" 
                    loading="lazy" 
                    allowfullscreen="" 
                    referrerpolicy="no-referrer-when-downgrade"
                    src="https://www.google.com/maps?q=${encodedAddress}&output=embed">
                </iframe>
            </div>
            <div style="padding:1rem;background:#f8f9fa;border-top:1px solid #e0e0e0;">
                <p style="margin:0;font-size:0.9rem;"><i class="fas fa-map-marker-alt" style="color:#3b82f6;margin-right:.5rem;"></i><strong>${hub.name || 'Location'}</strong></p>
                <p style="margin:0.25rem 0 0 0;font-size:0.85rem;color:#666;">${fullAddress}</p>
            </div>
        </div>
    `;

    return mapHTML;
}

/**
 * Generate map from address components (for form preview)
 */
function generateAddressMapEmbed(address, city, state, height = 300) {
    if (!address || !city) return '';

    const fullAddress = `${address}, ${city}, ${state || ''}, India`;
    const encodedAddress = encodeURIComponent(fullAddress);
    
    return `
        <div style="background:white;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.1);overflow:hidden;">
            <iframe 
                width="100%" 
                height="${height}" 
                style="border:none;" 
                loading="lazy" 
                allowfullscreen="" 
                src="https://www.google.com/maps?q=${encodedAddress}&output=embed">
            </iframe>
        </div>
    `;
}
```

---

### 9. `config.js` - Shared Configuration

**Main Function:** Utility functions for formatting and API setup

**What it does:** Shared helper functions used across all admin pages

```javascript
// API Configuration
const API_HOST = window.location.hostname || 'localhost';
const API_URL = `${window.location.protocol}//${API_HOST}:3001/api`;

// Format workspace type (hotdesk → Hot Desk)
function formatType(type) {
    const m = { 
        hotdesk: 'Hot Desk', 
        cabin: 'Private Cabin', 
        meeting_room: 'Meeting Room', 
        conference: 'Conference Hall' 
    };
    return m[type] || type;
}

// Format booking status
function formatStatus(status) {
    const m = { 
        confirmed: 'Confirmed', 
        checked_in: 'Checked In', 
        completed: 'Completed', 
        cancelled: 'Cancelled' 
    };
    return m[status] || status;
}

// Format ISO date to readable format
function formatDateTime(dt) {
    const isoString = dt.includes('T') ? dt : new Date(dt).toISOString();
    const [datePart, timePart] = isoString.split('T');
    const [year, month, day] = datePart.split('-');
    const [hourMin] = timePart.split(':');
    const hours24 = parseInt(hourMin);
    const minutes = timePart.split(':')[1];

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthName = months[parseInt(month) - 1];
    const ampm = hours24 >= 12 ? 'pm' : 'am';
    const hours12 = hours24 % 12 || 12;

    return `${parseInt(day)} ${monthName} ${year}, ${String(hours12).padStart(2, '0')}:${minutes} ${ampm}`;
}

// Format as currency
function formatCurrency(n) { 
    return `₹${Number(n).toFixed(2)}`; 
}

// Get URL parameter
function getParam(name) { 
    return new URLSearchParams(window.location.search).get(name); 
}

// Show toast notification
function showToast(msg, type = 'info') {
    let t = document.getElementById('admin-toast');
    if (!t) {
        t = document.createElement('div');
        t.id = 'admin-toast';
        t.style.cssText = 'position:fixed;bottom:1.5rem;right:1.5rem;z-index:9999;padding:1rem 1.5rem;border:1px solid;font-weight:600;color:white;max-width:350px;transition:opacity .3s;';
        document.body.appendChild(t);
    }
    const c = { success: '#27ae60', error: '#e74c3c', info: '#3498db', warning: '#f39c12' };
    t.style.background = c[type] || c.info;
    t.textContent = msg;
    t.style.opacity = '1';
    setTimeout(() => { t.style.opacity = '0'; }, 3000);
}

// Get admin auth headers
function getAdminHeaders() {
    const adminAuth = localStorage.getItem('adminAuth');
    const authObj = adminAuth ? JSON.parse(adminAuth) : null;
    return {
        'Authorization': `Bearer ${authObj?.token || ''}`,
        'Content-Type': 'application/json'
    };
}
```

---

### 10. `resource-form.js` & `resources-list.js`

**Main Function:** `handleSubmit()`, `loadResources()`

**What it does:** Manage add-on resources like projectors, whiteboards

```javascript
// RESOURCE FORM
const resourceId = getParam('resource_id');
const isEdit = !!resourceId;

async function handleSubmit(e) {
    e.preventDefault();
    
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
            headers: getAdminHeaders(),
            body: JSON.stringify(body)
        });
        if (!res.ok) throw new Error('Failed to save resource');
        showToast(isEdit ? 'Resource updated!' : 'Resource created!', 'success');
        setTimeout(() => { window.location.href = 'resources-list.html'; }, 800);
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// RESOURCES LIST
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
            '<tr><td colspan="7">Failed to load resources.</td></tr>';
    }
}

function renderResources(resources) {
    const tbody = document.getElementById('resources-table');
    tbody.innerHTML = resources.map(r => `
        <tr>
            <td>${r.id}</td>
            <td>${r.name}</td>
            <td>${workspaceName(r.workspace_id)}</td>
            <td>₹${r.price_per_slot}/slot</td>
            <td>${r.quantity || '—'}</td>
            <td>${r.description || '—'}</td>
            <td>
                <a href="resource-form.html?resource_id=${r.id}" class="btn btn-sm"><i class="fas fa-edit"></i></a>
                <button class="btn btn-sm btn-danger" onclick="deleteResource(${r.id})"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}
```

---

## PART 2: ADMIN HTML FILES (FIRST 10)

Your 10 HTML files are the UI templates that work with the JS files above:

1. **admin-dashboard.html** - Dashboard page with KPI cards
2. **booking-details-admin.html** - Single booking detail view
3. **bookings-list.html** - All bookings in table
4. **financial-reports.html** - Revenue analytics
5. **hub-form.html** - Add/edit hub with map preview
6. **hubs-list.html** - Hub directory
7. **login.html** - Admin login page
8. **pricing-rule-form.html** - Add/edit pricing rules
9. **pricing-rules-list.html** - View all rules
10. **resource-form.html** - Add/edit resources (projectors, etc.)

---

## PART 3: BACKEND ROUTES

### **`bookings.js` - Main Booking Logic**

**Main Endpoint:** `POST /api/bookings` (Create booking)

**What it does:** 
1. Validate input
2. Check slot availability (prevent double-booking)
3. **Call calculateDynamicPrice() ↓↓↓**
4. Calculate resource costs
5. Save booking to database
6. Send confirmation email

```javascript
// CREATE BOOKING - WHERE DYNAMIC PRICING IS APPLIED
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      workspace_id,
      start_time,
      end_time,
      booking_type,
      user_name,
      user_email,
      resources,
      status,
      finalPrice
    } = req.body;

    // Validate all inputs
    const err = validate(req.body, {
      workspace_id: [rules.required, rules.positiveInt],
      start_time: [rules.required, rules.isoDate, rules.futureDate, rules.maxFutureDays(90)],
      end_time: [rules.required, rules.isoDate, rules.after('start_time'), rules.maxDuration(720)],
      booking_type: [rules.oneOf(['hourly', 'daily', 'monthly'])],
      user_name: [rules.required, rules.maxLen(100), rules.noScript]
    });
    if (err) return res.status(400).json({ success: false, error: err });

    await runWaitlistMaintenance();

    const workspaceId = Number(workspace_id);
    const startIso = normalizeIsoTime(start_time);
    const endIso = normalizeIsoTime(end_time);

    // Check if workspace exists
    const { data: workspace, error: wsErr } = await supabase
      .from('workspaces')
      .select('id, name, base_price')
      .eq('id', workspaceId)
      .single();

    if (wsErr || !workspace) {
      return res.status(404).json({ success: false, error: 'Workspace not found' });
    }

    // Check for booking conflicts
    const { data: conflict, error: conflictErr } = await supabase
      .from('bookings')
      .select('id')
      .eq('workspace_id', workspaceId)
      .in('status', ACTIVE_BOOKING_STATUSES)
      .lt('start_time', endIso)
      .gt('end_time', startIso)
      .limit(1);

    if (conflictErr) throw conflictErr;
    if (conflict && conflict.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'This slot is already booked. Please choose another time.'
      });
    }

    // ========== CALCULATE DYNAMIC PRICE HERE ==========
    if (!finalPrice) {
      const dynamicPrice = await calculateDynamicPrice(
        workspaceId,
        workspace.base_price,
        startIso,
        endIso,
        booking_type
      );

      // Calculate resource costs
      let resourceCost = 0;
      if (resources && resources.length > 0) {
        for (const res of resources) {
          const { data: resourceData } = await supabase
            .from('resources')
            .select('price_per_slot')
            .eq('id', res.resource_id)
            .single();

          if (resourceData) {
            resourceCost += resourceData.price_per_slot * res.quantity;
          }
        }
      }

      finalPrice = dynamicPrice.finalPrice + resourceCost;
    }

    // Generate transaction ID with IST timestamp
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000; // IST = UTC + 5:30
    const istTime = new Date(now.getTime() + istOffset).toISOString();
    const istDate = new Date(now.getTime() + istOffset);
    const dateStr = istDate.toISOString().slice(0, 19).replace(/[-:T]/g, '').slice(0, 14);
    const transactionId = `TXN-${dateStr}`;

    console.log('\n=== NEW BOOKING TRANSACTION ===');
    console.log('UTC Time:', now.toISOString());
    console.log('IST Time (Stored):', istTime);
    console.log('Transaction ID:', transactionId);
    console.log('User:', user_name);
    console.log('Workspace ID:', workspace_id);
    console.log('Start Time:', start_time);
    console.log('End Time:', end_time);
    console.log('Total Price:', finalPrice);
    console.log('===============================\n');

    const normalizedStatus = status || 'confirmed';
    const paymentStatus = normalizedStatus === 'pending' ? 'pending' : 'paid';

    // Create booking record
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .insert([{
        workspace_id: workspaceId,
        user_name,
        user_email,
        start_time: startIso,
        end_time: endIso,
        total_price: finalPrice,
        booking_type,
        status: normalizedStatus,
        payment_status: paymentStatus,
        created_at: istTime,
        transaction_id: transactionId
      }])
      .select()
      .single();

    if (bookingError) throw bookingError;

    // Send confirmation email
    await sendBookingConfirmationEmail(booking, workspace);

    // Promote from waitlist if applicable
    const slotKey = buildSlotKey(workspaceId, startIso, endIso);
    await runWaitlistMaintenance([slotKey]);

    res.json({ success: true, data: booking });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
```

---

### **`pricing.js` - Create/Manage Pricing Rules**

**Main Endpoints:** 

```javascript
// GET ALL PRICING RULES
router.get('/', async (req, res) => {
  try {
    const { workspace_id } = req.query;

    let query = supabase
      .from('pricing_rules')
      .select(`
        *,
        workspaces (
          id,
          name,
          type
        )
      `)
      .order('id', { ascending: false });

    if (workspace_id) query = query.eq('workspace_id', workspace_id);

    const { data, error } = await query;
    if (error) throw error;
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET SINGLE PRICING RULE
router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('pricing_rules')
      .select(`*,workspaces(id,name,type)`)
      .eq('id', req.params.id)
      .single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// CREATE PRICING RULE (ADMIN ONLY)
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const {
      workspace_id,
      rule_type,
      percentage_modifier,
      flat_modifier,
      start_time,
      end_time,
      days
    } = req.body;

    if (!workspace_id || !rule_type) {
      return res.status(400).json({
        success: false,
        error: 'workspace_id and rule_type are required'
      });
    }

    const { data, error } = await supabase
      .from('pricing_rules')
      .insert([{
        workspace_id,
        rule_type,
        percentage_modifier: percentage_modifier || 0,
        flat_modifier: flat_modifier || 0,
        start_time: start_time || null,
        end_time: end_time || null,
        days: days || []
      }])
      .select();

    if (error) throw error;
    res.json({ success: true, data: data[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// UPDATE PRICING RULE (ADMIN ONLY)
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const {
      percentage_modifier,
      flat_modifier,
      start_time,
      end_time,
      days
    } = req.body;

    const { data, error } = await supabase
      .from('pricing_rules')
      .update({
        percentage_modifier,
        flat_modifier,
        start_time,
        end_time,
        days
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE PRICING RULE (ADMIN ONLY)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { error } = await supabase
      .from('pricing_rules')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ success: true, message: 'Pricing rule deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
```

---

### **`ratings.js` - Customer Reviews**

**Main Endpoints:**

```javascript
// GET ALL RATINGS (ADMIN)
router.get('/', async (req, res) => {
  try {
    const { data: ratings, error } = await supabase
      .from('ratings')
      .select(`
        *,
        workspaces (
          id,
          name,
          type,
          working_hubs (
            name,
            city
          )
        )
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ success: true, data: ratings });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ADD RATING TO WORKSPACE
router.post('/:workspace_id', async (req, res) => {
  try {
    const { workspace_id } = req.params;
    const { user_name, user_email, rating, review, booking_id } = req.body;

    // Validate inputs
    const err = validate(req.body, {
      user_name: [rules.required, rules.string, rules.maxLen(100), rules.noScript],
      rating: [rules.required, rules.oneOf(['1','2','3','4','5',1,2,3,4,5])],
      review: [rules.maxLen(1000), rules.noScript],
      user_email: [rules.email, rules.maxLen(255)],
    });
    if (err) return res.status(400).json({ success: false, error: err });

    const numRating = Number(rating);
    if (numRating < 1 || numRating > 5) {
      return res.status(400).json({ success: false, error: 'Rating must be 1-5' });
    }

    // Check if workspace exists
    const { data: workspace, error: wsError } = await supabase
      .from('workspaces')
      .select('id')
      .eq('id', workspace_id)
      .single();

    if (wsError || !workspace) {
      return res.status(404).json({ success: false, error: 'Workspace not found' });
    }

    // If booking_id provided, verify booking is completed
    if (booking_id) {
      const { data: booking } = await supabase
        .from('bookings')
        .select('*')
        .eq('id', booking_id)
        .eq('workspace_id', workspace_id)
        .eq('status', 'completed')
        .single();

      if (!booking) {
        return res.status(400).json({
          success: false,
          error: 'Only completed bookings can be rated'
        });
      }
    }

    // Insert rating
    const { data, error } = await supabase
      .from('ratings')
      .insert([{
        workspace_id,
        user_name,
        user_email,
        rating: numRating,
        review: review || null,
        booking_id: booking_id || null
      }])
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE RATING (ADMIN)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { error } = await supabase
      .from('ratings')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ success: true, message: 'Rating deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
```

---

## PART 4: DYNAMIC PRICING ENGINE

### **`pricing.js` (Backend Utility) - The STAR Feature**

**Main Function:** `calculateDynamicPrice(workspace_id, base_price, start_time, end_time, booking_type)`

**What it does:** Apply 3 smart pricing modifiers based on real-time market data

```javascript
async function calculateDynamicPrice(workspace_id, base_price, start_time, end_time, booking_type) {
  try {
    const start = new Date(start_time);
    const end = new Date(end_time);
    const durationHours = (end - start) / (1000 * 60 * 60);

    // Base price calculation by booking type
    let calculatedPrice = base_price;

    if (booking_type === 'daily') {
      calculatedPrice *= 8; // 8 hours per day
    } else if (booking_type === 'monthly') {
      calculatedPrice *= 8 * 22; // 8 hours * 22 working days
    } else {
      calculatedPrice *= durationHours;
    }

    let priceModifiers = {
      base: calculatedPrice,
      workday: 0,
      occupancy: 0,
      rating: 0,
      total: calculatedPrice
    };

    // ═════════════════════════════════════════════════════════════════
    // MODIFIER 1: WORKDAY PRICING (+8% Monday-Friday)
    // =====================================================
    const dayOfWeek = start.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
    const isWorkday = dayOfWeek >= 1 && dayOfWeek <= 5;

    if (isWorkday) {
      const workdayIncrease = calculatedPrice * 0.08; // +8%
      priceModifiers.workday = workdayIncrease;
      calculatedPrice += workdayIncrease;
    }

    console.log(`📅 Workday Pricing: ${isWorkday ? 'YES +8%' : 'NO (Weekend)'}`);

    // =====================================================
    // MODIFIER 2: OCCUPANCY-BASED PRICING (+5% if >70% booked)
    // =====================================================
    // Get hub_id for this workspace
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('hub_id, capacity')
      .eq('id', workspace_id)
      .single();

    // Get all workspaces in the same hub
    const { data: allWorkspaces } = await supabase
      .from('workspaces')
      .select('id')
      .eq('hub_id', workspace.hub_id);

    const totalWorkspaces = allWorkspaces?.length || 1;

    // Get all confirmed bookings that overlap with this time slot
    const { data: overlappingBookings } = await supabase
      .from('bookings')
      .select('workspace_id, workspaces!inner(hub_id)')
      .eq('workspaces.hub_id', workspace.hub_id)
      .in('status', ['confirmed', 'checked_in'])
      .lte('start_time', end_time)
      .gte('end_time', start_time);

    // Count unique workspaces that have bookings during this time
    const bookedWorkspaces = new Set(overlappingBookings?.map(b => b.workspace_id) || []).size;
    const occupancyRate = (bookedWorkspaces / totalWorkspaces) * 100;

    if (occupancyRate > 70) {
      const occupancyIncrease = calculatedPrice * 0.05; // +5%
      priceModifiers.occupancy = occupancyIncrease;
      calculatedPrice += occupancyIncrease;
    }

    console.log(`🏢 Occupancy Rate: ${occupancyRate.toFixed(1)}% (${bookedWorkspaces}/${totalWorkspaces})`);

    // =====================================================
    // MODIFIER 3: RATING-BASED PRICING (+5% for ≥4.0 stars)
    // =====================================================
    const { data: ratings } = await supabase
      .from('ratings')
      .select('rating')
      .eq('workspace_id', workspace_id);

    if (ratings && ratings.length > 0) {
      const avgRating = ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length;

      if (avgRating >= 4.0) {
        const ratingIncrease = calculatedPrice * 0.05; // +5% for quality
        priceModifiers.rating = ratingIncrease;
        calculatedPrice += ratingIncrease;
      }

      priceModifiers.average_rating = Math.round(avgRating * 10) / 10;
      console.log(`Average Rating: ${avgRating.toFixed(1)} stars`);
    }

    // =====================================================
    // APPLY CUSTOM PRICING RULES FROM DATABASE
    // =====================================================
    const { data: rules } = await supabase
      .from('pricing_rules')
      .select('*')
      .eq('workspace_id', workspace_id);

    const bookingDay = start.toLocaleDateString('en-US', { weekday: 'short' });
    const bookingTime = start.toTimeString().slice(0, 5);

    const appliedRules = [];

    for (const rule of rules || []) {
      let applies = true;
      const reasons = [];

      // Check if day matches (if specified)
      if (rule.days && rule.days.length > 0) {
        if (!rule.days.includes(bookingDay)) {
          applies = false;
          reasons.push(`Day mismatch (needs ${rule.days.join(', ')}, got ${bookingDay})`);
        } else {
          reasons.push(`Day matched (${bookingDay})`);
        }
      } else {
        reasons.push('No day restriction');
      }

      // Check if time is within range (if specified)
      if (rule.start_time && rule.end_time) {
        const crossesMidnight = rule.start_time > rule.end_time;
        let inTimeRange = false;

        if (crossesMidnight) {
          // Overnight range (e.g., 23:00 - 02:00)
          inTimeRange = bookingTime >= rule.start_time || bookingTime <= rule.end_time;
        } else {
          // Normal range (e.g., 09:00 - 17:00)
          inTimeRange = bookingTime >= rule.start_time && bookingTime <= rule.end_time;
        }

        if (!inTimeRange) {
          applies = false;
          reasons.push(`Time outside range (needs ${rule.start_time}-${rule.end_time}, got ${bookingTime})`);
        } else {
          reasons.push(`Time in range (${rule.start_time}-${rule.end_time})`);
        }
      } else {
        reasons.push('No time restriction');
      }

      // Apply rule if conditions met
      if (applies) {
        const priceBeforeRule = calculatedPrice;
        calculatedPrice += (calculatedPrice * (rule.percentage_modifier || 0) / 100);
        calculatedPrice += (rule.flat_modifier || 0);
        const adjustment = calculatedPrice - priceBeforeRule;

        appliedRules.push({
          rule_type: rule.rule_type,
          percentage_modifier: rule.percentage_modifier,
          flat_modifier: rule.flat_modifier,
          adjustment: adjustment.toFixed(2),
          reasons: reasons.join(', ')
        });

        console.log(`Applied rule: ${rule.rule_type} | Adjustment: ₹${adjustment.toFixed(2)}`);
      } else {
        console.log(`Skipped rule: ${rule.rule_type} | ${reasons.join(', ')}`);
      }
    }

    priceModifiers.appliedRules = appliedRules;
    priceModifiers.total = Math.round(calculatedPrice * 100) / 100;

    console.log('===============================================');
    console.log('FINAL PRICE BREAKDOWN:');
    console.log(`  Base Price:       ₹${priceModifiers.base.toFixed(2)}`);
    console.log(`  Workday (+8%):    ₹${priceModifiers.workday.toFixed(2)}`);
    console.log(`  Occupancy (+5%):  ₹${priceModifiers.occupancy.toFixed(2)}`);
    console.log(`  Rating (+5%):     ₹${priceModifiers.rating.toFixed(2)}`);
    console.log(`  -----------------------------------------------`);
    console.log(`  TOTAL PRICE:      ₹${priceModifiers.total.toFixed(2)}`);
    console.log('===============================================');

    return {
      finalPrice: priceModifiers.total,
      breakdown: priceModifiers,
      occupancyRate: Math.round(occupancyRate * 100) / 100,
      isWorkday,
      average_rating: priceModifiers.average_rating || null,
      hours: durationHours,
      totalWorkspaces,
      bookedWorkspaces
    };
  } catch (error) {
    console.error('Error calculating dynamic price:', error);
    return {
      finalPrice: base_price * durationHours,
      breakdown: { base: base_price * durationHours, total: base_price * durationHours },
      occupancyRate: 0,
      isWorkday: false
    };
  }
}

module.exports = { calculateDynamicPrice };
```

**Example Calculation:**
```
Base Price: ₹100/hour
Duration: 1 hour
Booking: Monday, 10:00 AM
Hub Occupancy: 75% (4/5 workspaces booked)
Workspace Rating: 4.3 stars

===============================================
FINAL PRICE BREAKDOWN:
  Base Price:       ₹100.00
  Workday (+8%):    ₹8.00    [YES] Monday
  Occupancy (+5%):  ₹5.54    [YES] 75% booked
  Rating (+5%):     ₹5.77    [YES] 4.3 stars
  -----------------------------------------------
  TOTAL PRICE:      ₹119.31
===============================================
```

---

## PART 5: DATA SCRAPING / MIGRATION

### **`populate-real-data.js` - CSV Data Migration Script**

**Main Function:** `main()`, `parseCSV()`, `parseRoomInfo()`

**What it does:** Read real coworking space data from CSV file and populate database

**File Location:** `backend/scripts/populate-real-data.js`

**How to Run:**
```bash
node backend/scripts/populate-real-data.js
```

```javascript
/**
 * Real Data Migration Script
 * Clears all existing hub/workspace data and populates from CSV
 * Run: node backend/scripts/populate-real-data.js
 */

'use strict';

const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const supabase = createClient(process.env.PROJECT_URL, process.env.API_KEY);
const CSV_PATH = path.resolve(__dirname, '../../data/coworking_india_v2.csv');

// =====================================================================
// PARSE CSV - FULL PARSER (Handles quoted fields with embedded newlines)
// =====================================================================
function parseCSV(content) {
  const rows = [];
  let inQuotes = false;
  let currentField = '';
  let currentRow = [];

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const nextChar = content[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quotes inside quoted string
        currentField += '"';
        i++;
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // End of field
      currentRow.push(currentField.trim());
      currentField = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      // End of row
      if (currentField || currentRow.length > 0) {
        currentRow.push(currentField.trim());
        if (currentRow.some(f => f)) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentField = '';
      }
      if (char === '\r' && nextChar === '\n') i++; // Skip \r\n
    } else {
      currentField += char;
    }
  }

  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some(f => f)) rows.push(currentRow);
  }

  return rows;
}

// =====================================================================
// PARSE ROOM INFO - Extract pricing from string
// "12 Rooms | ₹350/hr | ₹2,500/day | ₹28,000/mo"
// =====================================================================
function parseRoomInfo(str) {
  if (!str || !str.trim()) return null;
  
  // Remove rupee signs and commas
  const clean = str.replace(/[\u20B9\u0060₹,]/g, '');
  const parts = clean.split('|').map(s => s.trim());
  const countMatch = parts[0].match(/(\d+)/);
  
  if (!countMatch || parseInt(countMatch[1]) === 0) return null;
  
  const num = s => parseFloat((s || '').match(/(\d+)/)?.[1] || '0');
  
  return {
    count:   parseInt(countMatch[1]),
    hourly:  num(parts[1]),
    daily:   num(parts[2]),
    monthly: num(parts[3]),
  };
}

// Extract pincode from address
function extractPincode(addr) {
  const m = addr.match(/\b(\d{6})\b/);
  return m ? m[1] : null;
}

// ═══════════════════════════════════════════════════════════════════════
// BATCH INSERT HELPER
// ═══════════════════════════════════════════════════════════════════════
async function batchInsert(table, data, batchSize = 100, selectFields = '*') {
  if (!data.length) return [];
  const all = [];
  
  for (let i = 0; i < data.length; i += batchSize) {
    const { data: rows, error } = await supabase
      .from(table)
      .insert(data.slice(i, i + batchSize))
      .select(selectFields);
    
    if (error) {
      throw Object.assign(
        new Error(`Insert into "${table}" failed: ${error.message}`),
        { detail: error }
      );
    }
    all.push(...rows);
  }
  return all;
}

// ═══════════════════════════════════════════════════════════════════════
// CITY COORDINATES FOR MAPPING
// ═══════════════════════════════════════════════════════════════════════
const CITY_BASE_COORDS = {
  Hyderabad: [17.3850, 78.4867],
  Bengaluru: [12.9716, 77.5946],
  Mumbai:    [19.0760, 72.8777],
  Chennai:   [13.0827, 80.2707],
  Pune:      [18.5204, 73.8567],
  Noida:     [28.5355, 77.3910],
  Delhi:     [28.7041, 77.1025],
  Ahmedabad: [23.0225, 72.5714],
};

// ═══════════════════════════════════════════════════════════════════════
// MAIN MIGRATION FUNCTION
// ═══════════════════════════════════════════════════════════════════════
async function main() {
  console.log('\nCo-working India — Real Data Migration');
  console.log('-'.repeat(52));

  // 1. READ & PARSE CSV
  if (!fs.existsSync(CSV_PATH)) {
    throw new Error(`CSV not found at: ${CSV_PATH}`);
  }
  
  const csvContent = fs.readFileSync(CSV_PATH, 'utf8');
  const allRows = parseCSV(csvContent);
  const dataRows = allRows.slice(1).map(fields => ({
    sno:             parseInt(fields[0]) || 0,
    city:            fields[1] || '',
    state:           fields[2] || '',
    area:            fields[3] || '',
    name:            fields[4] || '',
    address:         fields[5] || '',
    approachability: fields[6] || '',
    companyRooms:    parseRoomInfo(fields[8]),
    conferenceRooms: parseRoomInfo(fields[9]),
    meetingRooms:    parseRoomInfo(fields[10]),
    waitingRoom:     parseRoomInfo(fields[11]),
    amenities:       (fields[12] || '').split('|').map(a => a.trim()).filter(Boolean),
    hasLunchRoom:    (fields[13] || '').toLowerCase().trim() === 'yes',
    hasPantry:       (fields[14] || '').toLowerCase().trim() === 'yes',
  })).filter(r => r.sno > 0 && r.name);

  console.log(`\n📄  Parsed ${dataRows.length} coworking spaces from CSV\n`);

  // 2. CLEAR EXISTING DATA (Foreign Key Safe Order)
  console.log('Clearing existing data...');
  await supabase.from('booking_holds').delete().neq('id', -1);
  await supabase.from('booking_waitlist').delete().neq('id', -1);
  await supabase.from('bookings').delete().neq('id', -1);
  await supabase.from('ratings').delete().neq('id', -1);
  await supabase.from('pricing_rules').delete().neq('id', -1);
  await supabase.from('resources').delete().neq('id', -1);
  await supabase.from('workspaces').delete().neq('id', -1);
  await supabase.from('working_hubs').delete().neq('id', -1);
  console.log('  OK  Tables cleared\n');

  // 3. INSERT WORKING HUBS
  console.log('Inserting working hubs...');
  const hubRows = dataRows.map(row => {
    const [baseLat, baseLng] = CITY_BASE_COORDS[row.city] || [20.5937, 78.9629];
    // Deterministic spread for each hub within city
    const latOff = ((row.sno * 13) % 21 - 10) * 0.007;
    const lngOff = ((row.sno *  7) % 15 -  7) * 0.007;
    
    return {
      name:      row.name,
      address:   row.address,
      city:      row.city,
      state:     row.state,
      country:   'India',
      pincode:   extractPincode(row.address),
      latitude:  parseFloat((baseLat + latOff).toFixed(6)),
      longitude: parseFloat((baseLng + lngOff).toFixed(6)),
    };
  });

  const hubs = await batchInsert('working_hubs', hubRows);
  console.log(`  OK  ${hubs.length} hubs inserted\n`);

  // 4. INSERT WORKSPACES
  console.log('Inserting workspaces...');
  const wsMeta = [];
  const wsRows = [];

  for (let hi = 0; hi < dataRows.length; hi++) {
    const row = dataRows[hi];
    const hubId = hubs[hi].id;

    // Define workspace types with meta info
    const WS_TYPES = [
      { type: 'hotdesk', label: 'Hot Desk', csvKey: 'companyRooms', capacity: 50 },
      { type: 'cabin', label: 'Private Cabin', csvKey: 'conferenceRooms', capacity: 4 },
      { type: 'meeting_room', label: 'Meeting Room', csvKey: 'meetingRooms', capacity: 8 },
    ];

    for (const wst of WS_TYPES) {
      const info = row[wst.csvKey];
      if (!info) continue;

      const amenities = [...row.amenities];
      if (row.hasPantry) amenities.push('Pantry & Coffee');
      if (wst.type === 'meeting_room') amenities.push('Video Conferencing');

      wsRows.push({
        hub_id: hubId,
        name: `${row.name} – ${wst.label}`,
        type: wst.type,
        capacity: wst.capacity,
        base_price: info.hourly,
        description: `High-quality ${wst.label} workspace`,
        amenities,
        is_available: true,
      });
      
      wsMeta.push({ row, wst, info, hubId });
    }
  }

  const workspaces = await batchInsert('workspaces', wsRows);
  console.log(`  OK  ${workspaces.length} workspaces inserted\n`);

  // 5. INSERT RESOURCES
  console.log('Inserting resources...');
  const resources = [];
  const wsLookup = {};
  
  for (const ws of workspaces) {
    wsLookup[`${ws.hub_id}:${ws.type}`] = ws.id;
  }

  for (const m of wsMeta) {
    const { row, wst, wsId: workspaceId } = m;
    const wsId = wsLookup[`${m.hubId}:${wst.type}`];

    if (wst.type === 'cabin') {
      if (row.amenities.includes('Projector')) {
        resources.push({
          workspace_id: wsId,
          name: 'Projector',
          description: 'Full HD projector with HDMI & wireless casting',
          price_per_slot: 150,
          quantity: 1
        });
      }
    } else if (wst.type === 'meeting_room') {
      resources.push({
        workspace_id: wsId,
        name: 'Smart Display',
        description: '65-inch 4K smart TV with Chromecast',
        price_per_slot: 100,
        quantity: 1
      });
    }
  }

  const insertedResources = await batchInsert('resources', resources, 100, 'id');
  console.log(`  OK  ${insertedResources.length} resources inserted\n`);

  // 6. INSERT PRICING RULES
  console.log('Inserting pricing rules...');
  const pricingRules = [];
  const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  const WEEKEND = ['Sat', 'Sun'];

  for (const { wsId } of wsMeta) {
    // Peak hours: weekday mornings +12%
    pricingRules.push({
      workspace_id: wsId,
      rule_type: 'peak_hours',
      percentage_modifier: 12,
      flat_modifier: 0,
      start_time: '09:00',
      end_time: '12:00',
      days: WEEKDAYS,
    });

    // Weekend discount: -10%
    pricingRules.push({
      workspace_id: wsId,
      rule_type: 'weekend_discount',
      percentage_modifier: -10,
      flat_modifier: 0,
      start_time: null,
      end_time: null,
      days: WEEKEND,
    });

    // Early-bird: weekday 07:00–09:00 -5%
    pricingRules.push({
      workspace_id: wsId,
      rule_type: 'early_bird',
      percentage_modifier: -5,
      flat_modifier: 0,
      start_time: '07:00',
      end_time: '09:00',
      days: WEEKDAYS,
    });
  }

  const insertedRules = await batchInsert('pricing_rules', pricingRules, 100, 'id');
  console.log(`  OK  ${insertedRules.length} pricing rules inserted\n`);

  // 7. INSERT SAMPLE RATINGS
  console.log('Inserting ratings...');
  const ratings = [];
  const SAMPLE_REVIEWS = {
    hotdesk: [
      { r: 5, t: 'Awesome workspace! Great coffee and Wi-Fi.' },
      { r: 4, t: 'Clean hot desks with excellent lighting.' },
      { r: 5, t: 'Joined a networking event here. Community team goes above and beyond.' },
    ],
    cabin: [
      { r: 4, t: 'Clean, quiet, and well-maintained. Great for concentrated sessions.' },
      { r: 5, t: 'Perfect for small teams. Professional environment and helpful staff.' },
    ],
    meeting_room: [
      { r: 5, t: 'Superb AV setup! Our client pitch went off without a hitch.' },
      { r: 4, t: 'Great video conferencing setup and professional setup.' },
    ],
  };

  for (const ws of workspaces) {
    const reviews = SAMPLE_REVIEWS[ws.type] || [];
    for (const review of reviews) {
      ratings.push({
        workspace_id: ws.id,
        user_name: 'Guest User',
        user_email: 'guest@example.com',
        rating: review.r,
        review: review.t,
      });
    }
  }

  const insertedRatings = await batchInsert('ratings', ratings, 100, 'id');
  console.log(`  OK  ${insertedRatings.length} ratings inserted\n`);

  // SUMMARY
  console.log('Migration complete!\n');
  console.log(`  ${String(hubs.length).padStart(4)}  working hubs`);
  console.log(`  ${String(workspaces.length).padStart(4)}  workspaces`);
  console.log(`  ${String(insertedResources.length).padStart(4)}  resources`);
  console.log(`  ${String(insertedRules.length).padStart(4)}  pricing rules`);
  console.log(`  ${String(insertedRatings.length).padStart(4)}  ratings\n`);

  const cities = [...new Set(dataRows.map(r => r.city))];
  console.log(`  Cities: ${cities.join(', ')}`);
  console.log('-'.repeat(52) + '\n');
}

main().catch(err => {
  console.error('\nFatal error:', err.message);
  if (err.detail) console.error('   Detail:', JSON.stringify(err.detail, null, 2));
  process.exit(1);
});
```

**Data Flow:**
```
CSV File (data/coworking_india_v2.csv)
    |
    v
parseCSV() - Parse with quoted field support
    |
    v
parseRoomInfo() - Extract pricing from strings
    |
    v
Build hub rows -> batchInsert('working_hubs')
    |
    v
Build workspace rows -> batchInsert('workspaces')
    |
    v
Build resources -> batchInsert('resources')
    |
    v
Build pricing rules -> batchInsert('pricing_rules')
    |
    v
Build ratings -> batchInsert('ratings')
    |
    v
Database populated [OK]
```

---

## SUMMARY TABLE

| File | Main Function | Purpose |
|------|---------------|---------|
| **admin-dashboard.js** | `loadDashboard()` | Show KPI stats cards |
| **bookings-list.js** | `loadBookings()` | Display all bookings |
| **financial-reports.js** | `loadReport()` | Revenue analytics |
| **pricing-rule-form.js** | `handleSubmit()` | Create pricing rules |
| **pricing-rules-list.js** | `loadRules()` | View all rules |
| **hub-form.js** | `handleSubmit()` | Add/edit hub |
| **hubs-list.js** | `loadHubs()` | View hubs list |
| **map-utils.js** | `generateAdminMapEmbed()` | Google Maps embeds |
| **config.js** | Utility functions | Shared helpers |
| **resources-list.js** | `loadResources()` | Manage resources |
| **bookings.js** (route) | `POST /bookings` | Create booking + pricing |
| **pricing.js** (route) | `POST /pricing` | Create pricing rules |
| **ratings.js** (route) | `POST /ratings/:id` | Add reviews |
| **pricing.js** (util) | `calculateDynamicPrice()` | Smart pricing |
| **populate-real-data.js** | `main()` | Data migration |

---

## How to Explain to an Interviewer

**Simple Explanation:**

> "I built the complete admin dashboard system for a coworking space booking platform. 
> 
> My 10 frontend JS files manage the admin UI - showing bookings, hubs, workspaces, pricing rules, and financial reports with auto-refresh every 15 seconds.
> 
> On the backend, I built 3 main routes:
> - Bookings: Handle all booking lifecycle with slot locking & waitlist management
> - Pricing: Admin can create dynamic pricing rules
> - Ratings: Customer reviews improve quality metrics
> 
> My star feature is the Dynamic Pricing Engine - it automatically adjusts prices based on:
> 1. Workday Pricing (+8% Mon-Fri)
> 2. Occupancy (+5% if >70% booked)
> 3. Quality Rating (+5% for >= 4 stars)
> 
> Plus, I built a data migration script that scraped real coworking space data from a CSV file and populated our database."

---

I hope this complete guide helps you explain your contributions clearly! All the main functions, code snippets, and logic flows are here. Good luck!
