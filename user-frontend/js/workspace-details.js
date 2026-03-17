// workspace-details.js – Detailed view of a workspace

document.addEventListener('DOMContentLoaded', async () => {
    if (!requireAuth()) return;
    const wsId  = getParam('workspace_id');
    const hubId = getParam('hub_id');
    if (!wsId) { window.location.href = 'search-hubs.html'; return; }
    await loadWorkspace(wsId, hubId);
});

async function loadWorkspace(wsId, hubId) {
    const container = document.getElementById('content');
    try {
        const [wsRes, ratRes] = await Promise.all([
            fetch(`${API_URL}/workspaces/${wsId}`),
            fetch(`${API_URL}/ratings/workspace/${wsId}`)
        ]);
        const ws  = (await wsRes.json()).data;
        const rat = (await ratRes.json()).data;

        const hubLink = hubId
            ? `hub-workspaces.html?hub_id=${hubId}`
            : `hub-workspaces.html?hub_id=${ws.hub_id}`;

        document.getElementById('hub-link').href = hubLink;
        document.getElementById('hub-link').textContent = ws.working_hubs?.name || 'Hub';
        document.getElementById('workspace-name-bc').textContent = ws.name;
        document.title = `${ws.name} - WorkSpace`;

        const avg = parseFloat(rat?.average || 0);
        const cnt = rat?.count || 0;

        container.innerHTML = `
            <div style="display:grid;grid-template-columns:1fr 340px;gap:2rem;align-items:start;">
                <!-- Left: Info -->
                <div>
                    <div style="background:white;border-radius:8px;box-shadow:0 2px 10px var(--shadow);overflow:hidden;margin-bottom:1.5rem;">
                        <div style="background:var(--primary);padding:2rem;color:white;">
                            <h1 style="font-size:1.75rem;margin-bottom:.5rem;">${ws.name}</h1>
                            <p style="opacity:.85;"><i class="fas fa-map-marker-alt"></i>
                                ${ws.working_hubs?.name || 'N/A'}, ${ws.working_hubs?.city || 'N/A'}</p>
                        </div>
                        <div style="padding:1.5rem;">
                            <div style="display:flex;flex-wrap:wrap;gap:1rem;margin-bottom:1.5rem;">
                                <span class="workspace-type">${formatType(ws.type)}</span>
                                <span style="display:flex;align-items:center;gap:.4rem;color:var(--text-light);">
                                    <i class="fas fa-users" style="color:var(--accent);"></i>
                                    ${ws.capacity} people capacity
                                </span>
                                <span style="display:flex;align-items:center;gap:.4rem;color:var(--text-light);">
                                    ${cnt > 0
                                        ? `${generateStars(avg)}<span style="margin-left:.25rem;">${avg.toFixed(1)} (${cnt} reviews)</span>`
                                        : `<i class="far fa-star" style="color:#f39c12;"></i> No ratings yet`
                                    }
                                </span>
                            </div>

                            ${ws.description ? `<p style="color:var(--text-light);margin-bottom:1rem;">${ws.description}</p>` : ''}

                            <h3 style="color:var(--primary);margin-bottom:.75rem;">Amenities</h3>
                            <div class="amenities">
                                ${(ws.amenities || []).map(a => `<span class="amenity-tag">${a}</span>`).join('') || '<span style="color:var(--text-light);">No amenities listed</span>'}
                            </div>
                        </div>
                    </div>

                    <!-- Hub Info -->
                    <div style="background:white;border-radius:8px;box-shadow:0 2px 10px var(--shadow);padding:1.5rem;">
                        <h3 style="color:var(--primary);margin-bottom:1rem;"><i class="fas fa-building" style="color:var(--accent);"></i> Hub Details</h3>
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem;">
                            <div><div style="font-size:.75rem;text-transform:uppercase;color:var(--text-light);font-weight:600;">Hub Name</div>
                                <div>${ws.working_hubs?.name || 'N/A'}</div></div>
                            <div><div style="font-size:.75rem;text-transform:uppercase;color:var(--text-light);font-weight:600;">City</div>
                                <div>${ws.working_hubs?.city || 'N/A'}, ${ws.working_hubs?.state || ''}</div></div>
                            <div style="grid-column:1/-1;">
                                <div style="font-size:.75rem;text-transform:uppercase;color:var(--text-light);font-weight:600;">Address</div>
                                <div>${ws.working_hubs?.address || 'N/A'}</div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Right: Pricing Card -->
                <div style="position:sticky;top:90px;">
                    <div style="background:white;border-radius:8px;box-shadow:0 2px 10px var(--shadow);padding:1.5rem;">
                        <h3 style="color:var(--primary);margin-bottom:1rem;">Pricing</h3>
                        <div style="display:flex;flex-direction:column;gap:.75rem;margin-bottom:1.5rem;">
                            <div style="display:flex;justify-content:space-between;padding:.75rem;background:var(--light);border-radius:6px;">
                                <span><i class="fas fa-clock" style="color:var(--accent);"></i> Hourly</span>
                                <strong>₹${ws.base_price}/hr</strong>
                            </div>
                            <div style="display:flex;justify-content:space-between;padding:.75rem;background:var(--light);border-radius:6px;">
                                <span><i class="fas fa-calendar-day" style="color:var(--accent);"></i> Daily (8hrs)</span>
                                <strong>~₹${(ws.base_price * 8).toLocaleString()}</strong>
                            </div>
                            <div style="display:flex;justify-content:space-between;padding:.75rem;background:var(--light);border-radius:6px;">
                                <span><i class="fas fa-calendar-alt" style="color:var(--accent);"></i> Monthly</span>
                                <strong>~₹${(ws.base_price * 160).toLocaleString()}</strong>
                            </div>
                        </div>
                        <p style="font-size:.8rem;color:var(--text-light);margin-bottom:1.25rem;">
                            * Dynamic pricing may apply based on demand, rating, and day.
                        </p>
                        ${ws.is_available === false
                            ? `<button class="btn-primary btn-block" disabled style="opacity:.6;">
                                <i class="fas fa-lock"></i> Not Available
                               </button>`
                            : `<a href="booking-form.html?workspace_id=${ws.id}&hub_id=${hubId || ws.hub_id}"
                                    class="btn-primary btn-block">
                                <i class="fas fa-calendar-check"></i> Book Now
                               </a>`
                        }
                        <a href="${hubLink}" class="btn-secondary btn-block" style="margin-top:.75rem;">
                            <i class="fas fa-arrow-left"></i> Back to Hub
                        </a>
                    </div>
                </div>
            </div>
        `;
    } catch (e) {
        console.error('Error loading workspace:', e);
        container.innerHTML = noDataHTML('fa-exclamation-circle', 'Error loading workspace', 'Please go back and try again.');
    }
}
