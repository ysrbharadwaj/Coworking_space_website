// booking-form.js – Booking details form with validation

let currentWorkspace = null;
let selectedResources = [];
let currentAvailability = null;
const WAITLIST_ACTIVE_STATUSES = ['pending', 'offered'];
let activeWaitlistEntry = null;
let waitlistPollTimer = null;

document.addEventListener('DOMContentLoaded', async () => {
    if (!requireAuth()) return;
    const wsId  = getParam('workspace_id');
    const hubId = getParam('hub_id');
    if (!wsId) { window.location.href = 'search-hubs.html'; return; }

    await loadWorkspace(wsId, hubId);
    await loadResources(wsId);

    document.getElementById('booking-form').addEventListener('submit', handleSubmit);

    const joinBtn  = document.getElementById('join-waitlist-btn');
    const leaveBtn = document.getElementById('leave-waitlist-btn');
    if (joinBtn)  joinBtn.addEventListener('click', joinWaitlist);
    if (leaveBtn) leaveBtn.addEventListener('click', leaveWaitlist);

    // Wire up real-time pricing updates
    ['start-time', 'end-time', 'booking-type'].forEach(id => {
        document.getElementById(id).addEventListener('change', updatePricing);
    });
});

// ── Workspace ──────────────────────────────────

async function loadWorkspace(wsId, hubId) {
    try {
        const res  = await fetch(`${API_URL}/workspaces/${wsId}`);
        currentWorkspace = (await res.json()).data;

        const hubLink = `hub-workspaces.html?hub_id=${hubId || currentWorkspace.hub_id}`;
        document.getElementById('hub-back-link').href = hubLink;
        document.getElementById('hub-back-link').textContent = currentWorkspace.working_hubs?.name || 'Hub';
        document.getElementById('workspace-name-bc').textContent = currentWorkspace.name;
        document.title = `Book ${currentWorkspace.name} - WorkSpace`;

        document.getElementById('workspace-summary').innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:1rem;">
                <div>
                    <h3 style="color:var(--primary);margin-bottom:.3rem;">${currentWorkspace.name}</h3>
                    <p style="color:var(--text-light);font-size:.9rem;">
                        <i class="fas fa-map-marker-alt"></i>
                        ${currentWorkspace.working_hubs?.name || 'N/A'},
                        ${currentWorkspace.working_hubs?.city || 'N/A'}
                    </p>
                    <div style="margin-top:.5rem;display:flex;gap:.5rem;flex-wrap:wrap;">
                        <span class="workspace-type">${formatType(currentWorkspace.type)}</span>
                        <span style="font-size:.875rem;color:var(--text-light);">
                            <i class="fas fa-users"></i> ${currentWorkspace.capacity} people
                        </span>
                    </div>
                </div>
                <div style="text-align:right;">
                    <div style="font-size:1.5rem;font-weight:700;color:var(--primary);">
                        ₹${currentWorkspace.base_price}<span style="font-size:.875rem;font-weight:400;color:var(--text-light);">/hr</span>
                    </div>
                </div>
            </div>
        `;
    } catch (e) {
        document.getElementById('workspace-summary').innerHTML =
            `<p style='color:var(--danger);'>Failed to load workspace details.</p>`;
    }
}

// ── Resources ──────────────────────────────────

async function loadResources(wsId) {
    try {
        const res = await fetch(`${API_URL}/resources/workspace/${wsId}`);
        const resources = (await res.json()).data || [];
        const list = document.getElementById('resources-list');

        if (!resources.length) {
            list.innerHTML = '<p style="color:var(--text-light);">No additional resources available.</p>';
            return;
        }

        list.innerHTML = resources.map(r => `
            <div class="resource-item">
                <div class="resource-info">
                    <h4>${r.name}</h4>
                    <p>${r.description || ''}</p>
                </div>
                <div class="resource-select">
                    <span class="resource-price">₹${r.price_per_slot}/hr</span>
                    <div style="display:flex;align-items:center;gap:.5rem;">
                        <input type="number" id="qty-${r.id}" min="0" value="0"
                            style="width:60px;padding:.25rem;border:1px solid var(--border);border-radius:4px;text-align:center;"
                            onchange="updateResourceQty(${r.id}, ${r.price_per_slot}, '${r.name}')">
                        <label for="qty-${r.id}" style="font-size:.85rem;color:var(--text-light);">Qty</label>
                    </div>
                </div>
            </div>
        `).join('');
    } catch (e) {
        document.getElementById('resources-list').innerHTML =
            '<p style="color:var(--text-light);">Could not load resources.</p>';
    }
}

function updateResourceQty(id, price, name) {
    const qty = parseInt(document.getElementById(`qty-${id}`).value) || 0;
    const idx = selectedResources.findIndex(r => r.id === id);
    if (qty === 0) { if (idx > -1) selectedResources.splice(idx, 1); }
    else if (idx > -1) { selectedResources[idx].quantity = qty; }
    else { selectedResources.push({ id, price, quantity: qty, name }); }
    updatePricing();
}

// ── Pricing ────────────────────────────────────

function onScheduleChange() { updatePricing(); }

function renderAvailability(message, kind = 'info') {
    const el = document.getElementById('availability-status');
    if (!el) return;

    if (!message) {
        el.style.display = 'none';
        el.textContent = '';
        el.className = 'alert alert-info';
        return;
    }

    el.style.display = 'flex';
    el.className = `alert alert-${kind}`;
    el.innerHTML = message;
}

async function checkAvailability() {
    const start = document.getElementById('start-time').value;
    const end = document.getElementById('end-time').value;

    if (!currentWorkspace || !start || !end) {
        currentAvailability = null;
        renderAvailability('Select start and end time to check live availability.', 'info');
        return null;
    }

    if (new Date(end) <= new Date(start)) {
        currentAvailability = null;
        renderAvailability('<i class="fas fa-exclamation-triangle"></i><span><strong>Invalid range:</strong> End time must be after start time.</span>', 'error');
        return null;
    }

    try {
        const res = await fetch(`${API_URL}/bookings/availability`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({
                workspace_id: currentWorkspace.id,
                start_time: start,
                end_time: end
            })
        });

        const result = await res.json();
        if (!res.ok || !result.success) throw new Error(result.error || 'Availability check failed');

        currentAvailability = result.data;

        if (result.data.available) {
            renderAvailability('<i class="fas fa-circle-check"></i><span><strong>Available:</strong> Slot is currently free. Proceed quickly to hold it.</span>', 'success');
        } else if (result.data.has_hold_conflict) {
            renderAvailability('<i class="fas fa-hourglass-half"></i><span><strong>Temporarily unavailable:</strong> Another user is currently holding this slot.</span>', 'warning');
        } else {
            renderAvailability('<i class="fas fa-ban"></i><span><strong>Unavailable:</strong> This slot is already booked.</span>', 'error');
        }

        await syncWaitlistEntryForCurrentSlot();
        updateWaitlistPanel(result.data);

        return result.data;
    } catch (e) {
        currentAvailability = null;
        renderAvailability(`<i class="fas fa-wifi"></i><span><strong>Could not verify live availability:</strong> ${e.message}</span>`, 'warning');
        updateWaitlistPanel(null);
        return null;
    }
}

async function createSlotHold() {
    const start = document.getElementById('start-time').value;
    const end = document.getElementById('end-time').value;

    const res = await fetch(`${API_URL}/bookings/holds`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
            workspace_id: currentWorkspace.id,
            start_time: start,
            end_time: end,
            ttl_seconds: 600
        })
    });

    const result = await res.json();
    if (!res.ok || !result.success) {
        throw new Error(result.error || 'Could not hold slot');
    }

    return result.data;
}

async function updatePricing() {
    if (!currentWorkspace) return;

    const start   = document.getElementById('start-time').value;
    const end     = document.getElementById('end-time').value;
    const bType   = document.getElementById('booking-type').value;
    const summary = document.getElementById('pricing-summary');

    if (!start || !end) {
        const base = currentWorkspace.base_price;
        const res  = selectedResources.reduce((s, r) => s + r.price * r.quantity, 0);
        summary.innerHTML = `
            <div class="price-row"><span>Base Price:</span><span>₹${base}</span></div>
            <div class="price-row"><span>Resources:</span><span>₹${res}</span></div>
            <div class="price-row total"><span>Total:</span><span id="total-price">₹${base + res}</span></div>`;
        return;
    }

    if (new Date(end) <= new Date(start)) {
        summary.innerHTML = `
            <div class="alert alert-error">
                <i class="fas fa-exclamation-triangle"></i>
                <strong>Invalid Time Range:</strong> End time must be after start time.
            </div>`;
        return;
    }

    try {
        const res = await fetch(`${API_URL}/pricing/calculate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                workspace_id: currentWorkspace.id,
                start_time: start,
                end_time: end,
                booking_type: bType
            })
        });
        const result = await res.json();

        if (!result.success) throw new Error(result.error);

        const pricing  = result.data;
        const hours    = (new Date(end) - new Date(start)) / 3600000;
        const resTotal = selectedResources.reduce((s, r) => s + r.price * r.quantity * hours, 0);
        const total    = pricing.final_price + resTotal;

        let html = `
            <h3 style="margin-bottom:1rem;color:var(--primary);font-size:1rem;">
                <i class="fas fa-receipt"></i> Pricing Breakdown
            </h3>
            <div class="price-row">
                <span>Base Price (${pricing.hours || 0} hours):</span>
                <span>₹${pricing.breakdown.base}</span>
            </div>`;

        // Dynamic modifiers
        const mods = [];
        if (pricing.is_workday && pricing.breakdown.workday > 0)
            mods.push({ icon:'fa-briefcase', color:'#3498db', label:'Workday Premium',
                reason:'Booking during weekdays', pct:'+8%', amt: pricing.breakdown.workday });
        if (pricing.breakdown.occupancy > 0)
            mods.push({ icon:'fa-chart-line', color:'#e74c3c', label:'High Demand',
                reason: pricing.booked_workspaces
                    ? `${pricing.booked_workspaces}/${pricing.total_workspaces} workspaces booked`
                    : `${pricing.occupancy_rate}% occupancy`,
                pct:'+15%', amt: pricing.breakdown.occupancy });
        if (pricing.breakdown.rating > 0)
            mods.push({ icon:'fa-star', color:'#f39c12', label:'Premium Quality',
                reason: `Highly rated (${pricing.average_rating?.toFixed(1) || 'N/A'} ⭐)`,
                pct:'+5%', amt: pricing.breakdown.rating });

        if (mods.length) {
            html += `<div style="margin:1rem 0;padding:1rem;background:#f8f9fa;border-radius:6px;border-left:3px solid var(--accent);">
                <div style="font-weight:600;margin-bottom:.75rem;color:var(--primary);font-size:.9rem;">
                    <i class="fas fa-info-circle"></i> Price Increased Due To:
                </div>`;
            mods.forEach(m => {
                html += `<div class="price-modifier">
                    <div class="modifier-info">
                        <i class="fas ${m.icon}" style="color:${m.color};margin-right:.5rem;"></i>
                        <div>
                            <div style="font-weight:600;font-size:.875rem;">
                                ${m.label} <span style="color:${m.color};">${m.pct}</span>
                            </div>
                            <div style="font-size:.8rem;color:var(--text-light);margin-top:.2rem;">${m.reason}</div>
                        </div>
                    </div>
                    <div style="font-weight:600;color:${m.color};">+₹${Number(m.amt).toFixed(2)}</div>
                </div>`;
            });
            html += `</div>`;
        }

        if (selectedResources.length) {
            html += `<div style="margin-top:1rem;padding-top:1rem;border-top:1px solid var(--border);">
                <div style="font-weight:600;margin-bottom:.5rem;color:var(--primary);font-size:.9rem;">
                    <i class="fas fa-plus-circle"></i> Additional Resources:
                </div>`;
            selectedResources.forEach(r => {
                const rTotal = r.price * r.quantity * hours;
                html += `<div class="price-row" style="font-size:.875rem;margin-left:1rem;">
                    <span>${r.name}
                        <span style="color:var(--text-light);">(${r.quantity} × ₹${r.price} × ${hours.toFixed(1)}h)</span>
                    </span>
                    <span>₹${rTotal.toFixed(2)}</span>
                </div>`;
            });
            html += `<div class="price-row" style="font-weight:600;margin-top:.5rem;">
                <span>Resources Subtotal:</span><span>₹${resTotal.toFixed(2)}</span>
            </div></div>`;
        }

        html += `<div class="price-row total" style="font-size:1.25rem;padding-top:1rem;border-top:2px solid var(--border);">
            <span><i class="fas fa-money-bill-wave"></i> Total Amount:</span>
            <span id="total-price">₹${total.toFixed(2)}</span>
        </div>`;

        summary.innerHTML = html;
        await checkAvailability();

    } catch (e) {
        const base = currentWorkspace.base_price;
        const res  = selectedResources.reduce((s, r) => s + r.price * r.quantity, 0);
        summary.innerHTML = `
            <div class="price-row"><span>Base Price:</span><span id="base-price">₹${base}</span></div>
            <div class="price-row"><span>Resources:</span><span id="resources-price">₹${res}</span></div>
            <div class="price-row total"><span>Total:</span><span id="total-price">₹${base + res}</span></div>`;
        await checkAvailability();
    }
}

// ── Waitlist Helpers ─────────────────────────

function getCurrentSlotKey() {
    if (!currentWorkspace) return null;
    const start = document.getElementById('start-time').value;
    const end   = document.getElementById('end-time').value;
    if (!start || !end) return null;
    try {
        return `${currentWorkspace.id}:${new Date(start).toISOString()}:${new Date(end).toISOString()}`;
    } catch (e) {
        return null;
    }
}

function updateWaitlistPanel(availabilityData) {
    const panel    = document.getElementById('waitlist-panel');
    const message  = document.getElementById('waitlist-message');
    const joinBtn  = document.getElementById('join-waitlist-btn');
    const leaveBtn = document.getElementById('leave-waitlist-btn');
    if (!panel || !message || !joinBtn || !leaveBtn) return;

    const slotKey = getCurrentSlotKey();
    const slotBlocked = availabilityData && availabilityData.available === false;

    if (!activeWaitlistEntry && !slotBlocked) {
        panel.style.display = 'none';
        return;
    }

    panel.style.display = 'block';

    if (activeWaitlistEntry) {
        joinBtn.style.display  = 'none';
        leaveBtn.style.display = 'inline-flex';

        if (activeWaitlistEntry.status === 'pending') {
            const position = activeWaitlistEntry.queue_position || '...';
            message.className = 'alert alert-warning';
            message.innerHTML = `<i class="fas fa-user-clock"></i><span><strong>On waitlist:</strong> You are #${position} for this slot. We will alert you as soon as it frees up.</span>`;
        } else if (activeWaitlistEntry.status === 'offered') {
            const deadline = activeWaitlistEntry.offer_expires_at
                ? new Date(activeWaitlistEntry.offer_expires_at).toLocaleTimeString()
                : 'soon';
            message.className = 'alert alert-success';
            message.innerHTML = `<i class="fas fa-bell"></i><span><strong>Your turn!</strong> You have priority access until ${deadline}. Proceed to payment to confirm.</span>`;
        } else {
            panel.style.display = 'none';
        }
        return;
    }

    if (slotBlocked && slotKey) {
        joinBtn.style.display  = 'inline-flex';
        joinBtn.disabled       = false;
        leaveBtn.style.display = 'none';
        message.className      = 'alert alert-warning';
        message.innerHTML      = '<i class="fas fa-user-clock"></i><span><strong>Slot full:</strong> Join the waitlist to be auto-allocated when it frees up.</span>';
    } else {
        panel.style.display = 'none';
    }
}

function setActiveWaitlistEntry(entry) {
    const sanitized = entry && WAITLIST_ACTIVE_STATUSES.includes(entry.status) ? entry : null;
    activeWaitlistEntry = sanitized;
    if (activeWaitlistEntry) {
        startWaitlistPolling();
    } else {
        stopWaitlistPolling();
    }
    updateWaitlistPanel(currentAvailability);
}

function startWaitlistPolling() {
    if (waitlistPollTimer) return;
    waitlistPollTimer = setInterval(refreshActiveWaitlistEntry, 15000);
}

function stopWaitlistPolling() {
    if (waitlistPollTimer) {
        clearInterval(waitlistPollTimer);
        waitlistPollTimer = null;
    }
}

async function refreshActiveWaitlistEntry() {
    if (!activeWaitlistEntry) return;
    try {
        const entries = await fetchMyWaitlistEntries();
        const updated = entries.find(e => e.slot_key === activeWaitlistEntry.slot_key && WAITLIST_ACTIVE_STATUSES.includes(e.status));
        setActiveWaitlistEntry(updated || null);
    } catch (err) {
        console.warn('Failed to refresh waitlist entry', err);
    }
}

async function fetchMyWaitlistEntries() {
    const res = await fetch(`${API_URL}/bookings/waitlist/my`, {
        headers: getAuthHeaders()
    });
    const result = await res.json();
    if (!res.ok || !result.success) throw new Error(result.error || 'Could not load waitlist entries');
    return result.data || [];
}

async function syncWaitlistEntryForCurrentSlot(force = false) {
    const slotKey = getCurrentSlotKey();
    if (!slotKey) {
        setActiveWaitlistEntry(null);
        return;
    }

    if (!force && activeWaitlistEntry && activeWaitlistEntry.slot_key === slotKey) return;

    try {
        const entries = await fetchMyWaitlistEntries();
        const match = entries.find(e => e.slot_key === slotKey && WAITLIST_ACTIVE_STATUSES.includes(e.status));
        setActiveWaitlistEntry(match || null);
    } catch (err) {
        console.warn('Could not sync waitlist entry', err);
    }
}

async function joinWaitlist() {
    if (!currentWorkspace) return;
    const start = document.getElementById('start-time').value;
    const end   = document.getElementById('end-time').value;
    if (!start || !end) {
        showToast('Select a start and end time before joining the waitlist.', 'error');
        return;
    }

    const joinBtn = document.getElementById('join-waitlist-btn');
    if (joinBtn) joinBtn.disabled = true;

    try {
        const res = await fetch(`${API_URL}/bookings/waitlist`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({
                workspace_id: currentWorkspace.id,
                start_time: start,
                end_time: end
            })
        });
        const result = await res.json();
        if (!res.ok || !result.success) throw new Error(result.error || 'Could not join waitlist');
        setActiveWaitlistEntry(result.data);
        showToast('Added to waitlist for this slot.', 'success');
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        if (joinBtn) joinBtn.disabled = false;
    }
}

async function leaveWaitlist() {
    if (!activeWaitlistEntry) return;
    const leaveBtn = document.getElementById('leave-waitlist-btn');
    if (leaveBtn) leaveBtn.disabled = true;

    try {
        const res = await fetch(`${API_URL}/bookings/waitlist/${activeWaitlistEntry.id}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        const result = await res.json();
        if (!res.ok || !result.success) throw new Error(result.error || 'Could not leave waitlist');
        showToast('Removed from waitlist.', 'success');
        setActiveWaitlistEntry(null);
        await syncWaitlistEntryForCurrentSlot(true);
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        if (leaveBtn) leaveBtn.disabled = false;
    }
}

// ── Submit ─────────────────────────────────────

async function handleSubmit(e) {
    e.preventDefault();

    // Run validation
    if (!validateForm(e.target)) {
        showToast('Please fix the errors before proceeding.', 'error');
        return;
    }

    const start  = document.getElementById('start-time').value;
    const end    = document.getElementById('end-time').value;

    // Extra cross-field check
    if (new Date(end) <= new Date(start)) {
        showToast('End time must be after start time.', 'error');
        return;
    }

    const availability = await checkAvailability();
    if (!availability || !availability.available) {
        showToast('Selected slot is not available. Please pick another time.', 'error');
        return;
    }

    let holdData;
    try {
        holdData = await createSlotHold();
    } catch (err) {
        showToast(err.message || 'Failed to lock slot. Please try another time.', 'error');
        await checkAvailability();
        return;
    }

    const totalEl = document.getElementById('total-price');
    const total   = totalEl ? parseFloat(totalEl.textContent.replace('₹', '').replace(',', '')) : 0;

    // Persist booking data to session storage for payment page
    // Always use the authenticated user's identity (not manually entered values)
    const currentUser = getCurrentUser();
    saveSession('pendingBooking', {
        workspace_id:  currentWorkspace.id,
        workspace_name: currentWorkspace.name,
        hub_name:      currentWorkspace.working_hubs?.name,
        hub_city:      currentWorkspace.working_hubs?.city,
        user_name:     currentUser.name,
        user_email:    currentUser.email,
        start_time:    start,
        end_time:      end,
        booking_type:  document.getElementById('booking-type').value,
        total_price:   total,
        hold_token:    holdData.hold_token,
        hold_expires_at: holdData.expires_at,
        resources:     selectedResources.map(r => ({ id: r.id, quantity: r.quantity })),
        pricing_html:  document.getElementById('pricing-summary').innerHTML
    });

    window.location.href = 'payment.html';
}
