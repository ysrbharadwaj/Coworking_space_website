// hub-workspaces.js – View workspaces within a hub

let allWorkspaces = [];
let hubData = null;

document.addEventListener('DOMContentLoaded', async () => {
    if (!requireAuth()) return;
    const hubId = getParam('hub_id');
    if (!hubId) { window.location.href = 'search-hubs.html'; return; }
    await loadHub(hubId);
    await loadWorkspaces(hubId);
});

// ── Hub Info ───────────────────────────────────

async function loadHub(hubId) {
    try {
        const res  = await fetch(`${API_URL}/hubs/${hubId}`);
        const result = await res.json();
        hubData = result.data;
        document.getElementById('hub-name').textContent = hubData.name;
        document.getElementById('hub-address').textContent =
            `${hubData.address}, ${hubData.city}, ${hubData.state}`;
        document.getElementById('hub-link').href = `hub-workspaces.html?hub_id=${hubId}`;
        document.title = `${hubData.name} - WorkSpace`;
    } catch (e) {
        console.error('Error loading hub:', e);
    }
}

// ── Workspaces ─────────────────────────────────

async function loadWorkspaces(hubId) {
    const grid = document.getElementById('workspaces-grid');
    grid.innerHTML = loadingHTML('Loading workspaces...');
    try {
        const res = await fetch(`${API_URL}/workspaces?hub_id=${hubId}`);
        const result = await res.json();
        allWorkspaces = result.data || [];
        displayWorkspaces(allWorkspaces);
    } catch (e) {
        grid.innerHTML = noDataHTML('fa-exclamation-circle', 'Error loading workspaces', 'Please try again later.');
    }
}

function displayWorkspaces(workspaces) {
    const grid = document.getElementById('workspaces-grid');
    if (!workspaces.length) {
        grid.innerHTML = noDataHTML('fa-inbox', 'No workspaces found', 'Try adjusting your filters.');
        return;
    }

    grid.innerHTML = workspaces.map(ws => {
        const unavail = ws.is_available === false;
        return `
        <div class="workspace-card ${unavail ? 'unavailable' : ''}" data-ws="${ws.id}">
            ${unavail ? '<div class="unavailable-badge"><i class="fas fa-lock"></i> Unavailable</div>' : ''}
            <div id="badge-${ws.id}"></div>
            <div class="workspace-header">
                <h3>${ws.name}</h3>
                <div class="workspace-location">
                    <i class="fas fa-map-marker-alt"></i>
                    <span>${ws.working_hubs?.city || hubData?.city || 'N/A'}</span>
                </div>
            </div>
            <div class="workspace-body">
                <span class="workspace-type">${formatType(ws.type)}</span>
                <div class="workspace-info">
                    <div class="info-item">
                        <i class="fas fa-users"></i>
                        <span>${ws.capacity} people</span>
                    </div>
                    <div class="info-item workspace-rating" id="rating-${ws.id}">
                        <i class="fas fa-star" style="color:#f39c12;"></i>
                        <span>Loading…</span>
                    </div>
                </div>
                <div class="workspace-footer">
                    <div class="price">₹${ws.base_price} <span>/hr</span></div>
                    <div style="display:flex;gap:.5rem;">
                        <a href="workspace-details.html?workspace_id=${ws.id}&hub_id=${getParam('hub_id')}"
                            class="btn-secondary btn-sm"><i class="fas fa-eye"></i> Details</a>
                        <button id="book-${ws.id}" class="btn-primary btn-sm"
                            onclick="bookNow(${ws.id})" ${unavail ? 'disabled' : ''}>
                            <i class="fas fa-calendar-check"></i>
                            ${unavail ? 'Not Available' : 'Book Now'}
                        </button>
                    </div>
                </div>
            </div>
        </div>`;
    }).join('');

    workspaces.forEach(ws => {
        loadRating(ws.id);
        checkBookingStatus(ws.id);
    });
    
    // Display amenities section
    displayAmenities(workspaces);
}

function bookNow(wsId) {
    window.location.href = `booking-form.html?workspace_id=${wsId}&hub_id=${getParam('hub_id')}`;
}

// ── Rating ─────────────────────────────────────

async function loadRating(wsId) {
    try {
        const res = await fetch(`${API_URL}/ratings/workspace/${wsId}`);
        const result = await res.json();
        const el = document.getElementById(`rating-${wsId}`);
        if (!el) return;
        const avg = parseFloat(result.data?.average || 0);
        const cnt = result.data?.count || 0;
        el.innerHTML = cnt > 0
            ? `${generateStars(avg)}<span style="margin-left:.25rem;">${avg.toFixed(1)} (${cnt})</span>`
            : `<i class="far fa-star" style="color:#f39c12;"></i><span>No ratings</span>`;
    } catch {}
}

// ── Booking Status ─────────────────────────────

async function checkBookingStatus(wsId) {
    try {
        const res = await fetch(`${API_URL}/bookings?workspace_id=${wsId}`);
        const result = await res.json();
        if (!result.success) return;
        const now = new Date();
        const active = (result.data || []).find(b =>
            (b.status === 'confirmed' || b.status === 'checked_in') &&
            new Date(b.end_time) > now
        );
        if (!active) return;

        const card   = document.querySelector(`[data-ws="${wsId}"]`);
        const badge  = document.getElementById(`badge-${wsId}`);
        const btn    = document.getElementById(`book-${wsId}`);
        const isCurrent = new Date(active.start_time) <= now;

        if (card && !card.classList.contains('unavailable')) card.classList.add('booked');
        if (badge) badge.innerHTML = `<div class="booked-badge">
            <i class="fas ${isCurrent ? 'fa-calendar-check' : 'fa-clock'}"></i>
            ${isCurrent ? 'Currently Booked' : 'Booked Soon'}
        </div>`;
        if (btn && !btn.disabled) {
            btn.disabled = true;
            btn.innerHTML = `<i class="fas fa-calendar-times"></i> ${isCurrent ? 'Booked' : 'Already Booked'}`;
        }
    } catch {}
}

// ── Filters ────────────────────────────────────

function filterWorkspaces() {
    const type   = document.getElementById('filter-type').value;
    const cap    = document.getElementById('filter-capacity').value;
    const avail  = document.getElementById('filter-availability').value;
    const sortBy = document.getElementById('sort-by').value;

    let filtered = [...allWorkspaces];

    if (type) filtered = filtered.filter(w => w.type === type);

    if (cap === '1-5')  filtered = filtered.filter(w => w.capacity >= 1  && w.capacity <= 5);
    else if (cap === '6-10')  filtered = filtered.filter(w => w.capacity >= 6  && w.capacity <= 10);
    else if (cap === '11-20') filtered = filtered.filter(w => w.capacity >= 11 && w.capacity <= 20);
    else if (cap === '21+')   filtered = filtered.filter(w => w.capacity >= 21);

    if (avail === 'available')   filtered = filtered.filter(w => w.is_available !== false);
    if (avail === 'unavailable') filtered = filtered.filter(w => w.is_available === false);

    if      (sortBy === 'price-low')     filtered.sort((a, b) => a.base_price - b.base_price);
    else if (sortBy === 'price-high')    filtered.sort((a, b) => b.base_price - a.base_price);
    else if (sortBy === 'capacity-low')  filtered.sort((a, b) => a.capacity - b.capacity);
    else if (sortBy === 'capacity-high') filtered.sort((a, b) => b.capacity - a.capacity);

    displayWorkspaces(filtered);
}

// ── Amenities Display ──────────────────────────

const amenitiesIconMap = {
    'High-Speed Internet': 'fa-wifi',
    'Power Backup': 'fa-battery-full',
    'Air Conditioning': 'fa-snowflake',
    'Modern Interiors': 'fa-home',
    'CCTV Surveillance': 'fa-camera',
    'Daily Housekeeping': 'fa-broom',
    'Lounge Access': 'fa-couch',
    'Video Conferencing': 'fa-video',
    'Conference Rooms': 'fa-door-open',
    '24x7 Access': 'fa-unlock',
    '24x7 Surveillance': 'fa-eye',
    'Housekeeping': 'fa-broom',
    'Printing': 'fa-print',
    'Projector': 'fa-tv',
    'Events': 'fa-calendar-check',
    'Accessible Commute': 'fa-location-dot',
    'Modern Design': 'fa-palette',
    'Lounge Area': 'fa-couch'
};

function displayAmenities(workspaces) {
    const uniqueAmenities = [...new Set(workspaces.flatMap(w => w.amenities || []))].sort();
    
    if (!uniqueAmenities.length) {
        document.getElementById('amenities-section').style.display = 'none';
        return;
    }
    
    const amenitiesGrid = document.getElementById('amenities-grid');
    amenitiesGrid.innerHTML = uniqueAmenities.map(amenity => {
        const icon = amenitiesIconMap[amenity] || 'fa-check';
        return `
            <div class="amenity-card">
                <div class="amenity-icon">
                    <i class="fas ${icon}"></i>
                </div>
                <div class="amenity-name">${amenity}</div>
            </div>
        `;
    }).join('');
    
    document.getElementById('amenities-section').style.display = 'block';
}

