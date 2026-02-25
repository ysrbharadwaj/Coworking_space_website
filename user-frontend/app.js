const API_URL = 'http://localhost:3001/api';

// State
let currentWorkspace = null;
let currentBookingData = null;
let currentBookingId = null;
let selectedResources = [];
let selectedPaymentMethod = null;
let currentHub = null;
let allHubs = [];
let allWorkspaces = [];
let appliedCoupon = null; // Stores {code, discount, workspace_id}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupNavigation();
    loadCities();
    loadHubs();
    loadTransactions();

    // Setup booking form
    document.getElementById('booking-form').addEventListener('submit', handleBookingSubmit);

    // Add event listeners for dynamic pricing when dates/booking type change
    document.getElementById('start-time').addEventListener('change', updatePricingSummary);
    document.getElementById('end-time').addEventListener('change', updatePricingSummary);
    document.getElementById('booking-type').addEventListener('change', updatePricingSummary);
});

// Navigation
function setupNavigation() {
    document.querySelectorAll('.nav-menu a').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetPage = e.target.getAttribute('data-page');

            // Update active states
            document.querySelectorAll('.nav-menu a').forEach(l => l.classList.remove('active'));
            e.target.classList.add('active');

            // Show target page
            document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
            document.getElementById(targetPage).classList.add('active');

            // Load data for specific pages
            if (targetPage === 'search') {
                // If a hub is already selected, reload its workspaces
                if (currentHub) {
                    selectHub(currentHub.id);
                } else {
                    backToHubs();
                    loadHubs();
                }
            }
            if (targetPage === 'bookings') loadMyBookings();
            if (targetPage === 'transactions') loadTransactions();
        });
    });
}

// Load Cities
async function loadCities() {
    try {
        const response = await fetch(`${API_URL}/hubs`);
        const result = await response.json();
        const hubs = result.data || [];

        const cities = [...new Set(hubs.map(hub => hub.city))];

        const heroCitySelect = document.getElementById('hero-city');
        const filterCitySelect = document.getElementById('filter-city');

        cities.forEach(city => {
            heroCitySelect.innerHTML += `<option value="${city}">${city}</option>`;
            filterCitySelect.innerHTML += `<option value="${city}">${city}</option>`;
        });
    } catch (error) {
        console.error('Error loading cities:', error);
    }
}

// Search from Hero
function searchFromHero() {
    const city = document.getElementById('hero-city').value;

    // Set filters
    if (city) document.getElementById('filter-city').value = city;

    // Navigate to search page
    document.querySelectorAll('.nav-menu a').forEach(l => l.classList.remove('active'));
    document.querySelector('[data-page="search"]').classList.add('active');
    document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
    document.getElementById('search').classList.add('active');

    // Load and filter hubs
    filterHubs();
}

// Load Hubs
async function loadHubs() {
    const grid = document.getElementById('hubs-grid');
    grid.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i><p>Loading hubs...</p></div>';

    try {
        const response = await fetch(`${API_URL}/hubs`);
        const result = await response.json();
        allHubs = result.data || [];
        displayHubs(allHubs);
    } catch (error) {
        console.error('Error loading hubs:', error);
        grid.innerHTML = '<div class="no-data"><i class="fas fa-exclamation-circle"></i><h3>Error loading hubs</h3><p>Please try again later</p></div>';
    }
}

function displayHubs(hubs) {
    const grid = document.getElementById('hubs-grid');

    if (hubs.length === 0) {
        grid.innerHTML = '<div class="no-data"><i class="fas fa-inbox"></i><h3>No hubs found</h3><p>Try adjusting your filters</p></div>';
        return;
    }

    grid.innerHTML = hubs.map(hub => `
        <div class="hub-card" onclick="selectHub(${hub.id})">
            <div class="hub-card-header">
                <h3>${hub.name}</h3>
                <div class="hub-location">
                    <i class="fas fa-map-marker-alt"></i>
                    <span>${hub.city}, ${hub.state}</span>
                </div>
            </div>
            <div class="hub-card-body">
                <div class="hub-info">
                    <div class="hub-info-item">
                        <i class="fas fa-location-arrow"></i>
                        <span>${hub.address}</span>
                    </div>
                    <div class="hub-info-item">
                        <i class="fas fa-map-pin"></i>
                        <span>${hub.pincode}, ${hub.country}</span>
                    </div>
                </div>
                <div class="hub-stats">
                    <div class="hub-stat">
                        <div class="number" id="hub-${hub.id}-workspaces">-</div>
                        <div class="label">Workspaces</div>
                    </div>
                    <div class="hub-stat">
                        <div class="number"><i class="fas fa-arrow-right"></i></div>
                        <div class="label">View Details</div>
                    </div>
                </div>
            </div>
        </div>
    `).join('');

    // Load workspace counts for each hub
    hubs.forEach(hub => loadHubWorkspaceCount(hub.id));
}

async function loadHubWorkspaceCount(hubId) {
    try {
        const response = await fetch(`${API_URL}/workspaces?hub_id=${hubId}`);
        const result = await response.json();
        const count = (result.data || []).length;
        const element = document.getElementById(`hub-${hubId}-workspaces`);
        if (element) element.textContent = count;
    } catch (error) {
        console.error('Error loading workspace count:', error);
    }
}

function filterHubs() {
    const city = document.getElementById('filter-city').value.toLowerCase();
    const searchTerm = document.getElementById('search-hub').value.toLowerCase();

    let filtered = allHubs;

    if (city) {
        filtered = filtered.filter(hub => hub.city.toLowerCase() === city.toLowerCase());
    }

    if (searchTerm) {
        filtered = filtered.filter(hub =>
            hub.name.toLowerCase().includes(searchTerm) ||
            hub.address.toLowerCase().includes(searchTerm)
        );
    }

    displayHubs(filtered);
}

// Select Hub and Load Workspaces
async function selectHub(hubId) {
    try {
        // Get hub details
        const hubResponse = await fetch(`${API_URL}/hubs/${hubId}`);
        const hubResult = await hubResponse.json();
        currentHub = hubResult.data;

        // Load workspaces for this hub
        const workspacesResponse = await fetch(`${API_URL}/workspaces?hub_id=${hubId}`);
        const workspacesResult = await workspacesResponse.json();
        allWorkspaces = workspacesResult.data || [];

        // Update UI
        document.getElementById('selected-hub-name').textContent = currentHub.name;
        document.getElementById('selected-hub-address').textContent = `${currentHub.address}, ${currentHub.city}, ${currentHub.state}`;

        // Hide hubs section, show workspaces section
        document.getElementById('hubs-section').style.display = 'none';
        document.getElementById('workspaces-section').style.display = 'block';

        // Reset filters
        document.getElementById('filter-type').value = '';
        document.getElementById('filter-capacity').value = '';
        document.getElementById('sort-by').value = '';

        // Display workspaces
        displayWorkspaces(allWorkspaces);

    } catch (error) {
        console.error('Error loading hub workspaces:', error);
        alert('Error loading workspaces for this hub');
    }
}

function backToHubs() {
    document.getElementById('hubs-section').style.display = 'block';
    document.getElementById('workspaces-section').style.display = 'none';
    currentHub = null;
    allWorkspaces = [];

    // Clear the workspaces grid
    const workspacesGrid = document.getElementById('workspaces-grid');
    if (workspacesGrid) {
        workspacesGrid.innerHTML = '';
    }

    // Reset all workspace filters
    document.getElementById('filter-type').value = '';
    document.getElementById('filter-capacity').value = '';
    document.getElementById('filter-availability').value = '';
    document.getElementById('sort-by').value = '';
}

function filterWorkspaces() {
    const type = document.getElementById('filter-type').value;
    const capacity = document.getElementById('filter-capacity').value;
    const availability = document.getElementById('filter-availability').value;
    const sortBy = document.getElementById('sort-by').value;

    let filtered = [...allWorkspaces];

    // Filter by type
    if (type) {
        filtered = filtered.filter(w => w.type === type);
    }

    // Filter by capacity
    if (capacity) {
        if (capacity === '1-5') filtered = filtered.filter(w => w.capacity >= 1 && w.capacity <= 5);
        else if (capacity === '6-10') filtered = filtered.filter(w => w.capacity >= 6 && w.capacity <= 10);
        else if (capacity === '11-20') filtered = filtered.filter(w => w.capacity >= 11 && w.capacity <= 20);
        else if (capacity === '21+') filtered = filtered.filter(w => w.capacity >= 21);
    }

    // Filter by availability
    if (availability) {
        if (availability === 'available') {
            filtered = filtered.filter(w => w.is_available !== false);
        } else if (availability === 'unavailable') {
            filtered = filtered.filter(w => w.is_available === false);
        }
    }

    // Sort
    if (sortBy === 'price-low') {
        filtered.sort((a, b) => a.base_price - b.base_price);
    } else if (sortBy === 'price-high') {
        filtered.sort((a, b) => b.base_price - a.base_price);
    } else if (sortBy === 'capacity-low') {
        filtered.sort((a, b) => a.capacity - b.capacity);
    } else if (sortBy === 'capacity-high') {
        filtered.sort((a, b) => b.capacity - a.capacity);
    }

    displayWorkspaces(filtered);
}

function displayWorkspaces(workspaces) {
    const grid = document.getElementById('workspaces-grid');

    if (workspaces.length === 0) {
        showRecommendedWorkspaces();
        return;
    }

    grid.innerHTML = workspaces.map(workspace => {
        const isUnavailable = workspace.is_available === false;
        return `
        <div class="workspace-card ${isUnavailable ? 'unavailable' : ''}" data-workspace-id="${workspace.id}">
            ${isUnavailable ? '<div class="unavailable-badge"><i class="fas fa-lock"></i> Unavailable</div>' : ''}
            <div id="booking-badge-${workspace.id}"></div>
            <div class="workspace-header">
                <h3>${workspace.name}</h3>
                <div class="workspace-location">
                    <i class="fas fa-map-marker-alt"></i>
                    <span>${workspace.working_hubs?.city || 'N/A'}</span>
                </div>
            </div>
            <div class="workspace-body">
                <span class="workspace-type">${formatType(workspace.type)}</span>
                <div class="workspace-info">
                    <div class="info-item">
                        <i class="fas fa-users"></i>
                        <span>${workspace.capacity} people</span>
                    </div>
                    <div class="info-item workspace-rating" id="rating-${workspace.id}">
                        <i class="fas fa-star"></i>
                        <span>Loading...</span>
                    </div>
                </div>
                <div class="amenities">
                    ${(workspace.amenities || []).map(a => `<span class="amenity-tag">${a}</span>`).join('')}
                </div>
                <div class="workspace-footer">
                    <div class="price">
                        ₹${workspace.base_price} <span>/hr</span>
                    </div>
                    <button class="btn-primary" id="book-btn-${workspace.id}" onclick="openBookingModal(${workspace.id})" ${isUnavailable ? 'disabled' : ''}>
                        <i class="fas fa-calendar-check"></i> ${isUnavailable ? 'Not Available' : 'Book Now'}
                    </button>
                </div>
            </div>
        </div>
    `;
    }).join('');

    // Load ratings and booking status for each workspace
    workspaces.forEach(workspace => {
        loadWorkspaceRating(workspace.id);
    });

    // Check booking status after a small delay to ensure DOM is ready
    setTimeout(() => {
        workspaces.forEach(workspace => {
            checkWorkspaceBookingStatus(workspace.id);
        });
    }, 100);
}

function formatType(type) {
    const types = {
        'hotdesk': 'Hot Desk',
        'cabin': 'Private Cabin',
        'meeting_room': 'Meeting Room',
        'conference': 'Conference Hall'
    };
    return types[type] || type;
}

// Show recommended workspaces when no results found
async function showRecommendedWorkspaces() {
    const grid = document.getElementById('workspaces-grid');

    grid.innerHTML = `
        <div style="grid-column: 1 / -1;">
            <div class="no-data">
                <i class="fas fa-inbox"></i>
                <h3>No workspaces found</h3>
                <p>But here are some popular workspaces you might like</p>
            </div>
        </div>
    `;

    try {
        // Get all workspaces
        const response = await fetch(`${API_URL}/workspaces`);
        const result = await response.json();
        const allWorkspaces = result.data || [];

        // Get ratings for workspaces and sort by rating
        const workspacesWithRatings = await Promise.all(
            allWorkspaces.slice(0, 20).map(async (workspace) => {
                try {
                    const ratingResponse = await fetch(`${API_URL}/ratings/workspace/${workspace.id}`);
                    const ratingResult = await ratingResponse.json();
                    return {
                        ...workspace,
                        avgRating: parseFloat(ratingResult.data?.average || 0),
                        ratingCount: ratingResult.data?.count || 0
                    };
                } catch {
                    return { ...workspace, avgRating: 0, ratingCount: 0 };
                }
            })
        );

        // Sort by rating and get top 4
        const recommended = workspacesWithRatings
            .sort((a, b) => b.avgRating - a.avgRating)
            .slice(0, 4);

        const recommendedHTML = `
            <div style="grid-column: 1 / -1; margin-top: 2rem;">
                <h2 style="color: var(--primary); margin-bottom: 1.5rem; display: flex; align-items: center; gap: 0.5rem;">
                    <i class="fas fa-star" style="color: #f39c12;"></i> 
                    <span>Recommended Workspaces</span>
                </h2>
            </div>
            ${recommended.map(workspace => `
                <div class="workspace-card">
                    <div class="workspace-header">
                        <h3>${workspace.name}</h3>
                        <div class="workspace-location">
                            <i class="fas fa-map-marker-alt"></i>
                            <span>${workspace.working_hubs?.city || 'N/A'}</span>
                        </div>
                    </div>
                    <div class="workspace-body">
                        <span class="workspace-type">${formatType(workspace.type)}</span>
                        <div class="workspace-info">
                            <div class="info-item">
                                <i class="fas fa-users"></i>
                                <span>${workspace.capacity} people</span>
                            </div>
                            <div class="info-item workspace-rating">
                                ${workspace.ratingCount > 0 ? `
                                    ${generateStars(workspace.avgRating)}
                                    <span style="margin-left: 0.25rem;">${workspace.avgRating.toFixed(1)} (${workspace.ratingCount})</span>
                                ` : `
                                    <i class="far fa-star"></i>
                                    <span>No ratings</span>
                                `}
                            </div>
                        </div>
                        <div class="amenities">
                            ${(workspace.amenities || []).map(a => `<span class="amenity-tag">${a}</span>`).join('')}
                        </div>
                        <div class="workspace-footer">
                            <div class="price">
                                ₹${workspace.base_price} <span>/hr</span>
                            </div>
                            <button class="btn-primary" onclick="selectHub(${workspace.hub_id})">
                                <i class="fas fa-arrow-right"></i> View Hub
                            </button>
                        </div>
                    </div>
                </div>
            `).join('')}
        `;

        grid.innerHTML += recommendedHTML;

    } catch (error) {
        console.error('Error loading recommended workspaces:', error);
        grid.innerHTML = '<div class="no-data"><i class="fas fa-inbox"></i><h3>No workspaces found</h3><p>Try adjusting your filters</p></div>';
    }
}

// Load workspace rating
async function loadWorkspaceRating(workspaceId) {
    try {
        const response = await fetch(`${API_URL}/ratings/workspace/${workspaceId}`);
        const result = await response.json();

        if (result.success && result.data) {
            const element = document.getElementById(`rating-${workspaceId}`);
            if (element) {
                const avg = parseFloat(result.data.average) || 0;
                const count = result.data.count || 0;

                if (count > 0) {
                    const stars = generateStars(avg);
                    element.innerHTML = `
                        ${stars}
                        <span style="margin-left: 0.25rem;">${avg.toFixed(1)} (${count})</span>
                    `;
                } else {
                    element.innerHTML = `
                        <i class="far fa-star"></i>
                        <span>No ratings</span>
                    `;
                }
            }
        }
    } catch (error) {
        console.error('Error loading rating:', error);
    }
}

function generateStars(rating) {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

    let stars = '';
    for (let i = 0; i < fullStars; i++) {
        stars += '<i class="fas fa-star" style="color: #f39c12;"></i>';
    }
    if (hasHalfStar) {
        stars += '<i class="fas fa-star-half-alt" style="color: #f39c12;"></i>';
    }
    for (let i = 0; i < emptyStars; i++) {
        stars += '<i class="far fa-star" style="color: #f39c12;"></i>';
    }

    return stars;
}

// Check if workspace has active bookings
async function checkWorkspaceBookingStatus(workspaceId) {
    try {
        const response = await fetch(`${API_URL}/bookings?workspace_id=${workspaceId}`);
        const result = await response.json();

        console.log(`Checking booking status for workspace ${workspaceId}:`, result.data);

        if (result.success && result.data) {
            const now = new Date();
            // Check for confirmed/checked-in bookings that haven't ended yet (cancelled bookings are automatically excluded)
            const activeBooking = result.data.find(booking => {
                const startTime = new Date(booking.start_time);
                const endTime = new Date(booking.end_time);
                // Show as booked if the booking hasn't ended yet and status is confirmed or checked_in
                const hasNotEnded = endTime > now;
                const isBooked = (booking.status === 'confirmed' || booking.status === 'checked_in') && hasNotEnded;

                console.log(`  Booking ${booking.id}: status=${booking.status}, start=${startTime}, end=${endTime}, hasNotEnded=${hasNotEnded}, isBooked=${isBooked}`);

                return isBooked;
            });

            console.log(`  Active booking found:`, activeBooking);

            if (activeBooking) {
                const card = document.querySelector(`[data-workspace-id="${workspaceId}"]`);
                const badgeContainer = document.getElementById(`booking-badge-${workspaceId}`);
                const bookButton = document.getElementById(`book-btn-${workspaceId}`);

                console.log(`  Elements found: card=${!!card}, badge=${!!badgeContainer}, button=${!!bookButton}`);

                const now = new Date();
                const startTime = new Date(activeBooking.start_time);
                const endTime = new Date(activeBooking.end_time);
                const isCurrentlyActive = startTime <= now && now <= endTime;

                if (card && !card.classList.contains('unavailable')) {
                    card.classList.add('booked');
                }

                if (badgeContainer) {
                    if (isCurrentlyActive) {
                        badgeContainer.innerHTML = '<div class="booked-badge"><i class="fas fa-calendar-check"></i> Currently Booked</div>';
                    } else {
                        badgeContainer.innerHTML = '<div class="booked-badge"><i class="fas fa-clock"></i> Booked Soon</div>';
                    }
                }

                if (bookButton && !bookButton.disabled) {
                    bookButton.disabled = true;
                    if (isCurrentlyActive) {
                        bookButton.innerHTML = '<i class="fas fa-calendar-times"></i> Currently Booked';
                    } else {
                        bookButton.innerHTML = '<i class="fas fa-calendar-times"></i> Already Booked';
                    }
                }
            }
        }
    } catch (error) {
        console.error('Error checking booking status:', error);
    }
}

// Booking Modal
async function openBookingModal(workspaceId) {
    try {
        // Reset state for new booking
        selectedResources = [];
        currentWorkspace = null;
        appliedCoupon = null; // Clear previous coupon
        document.getElementById('coupon-code').value = '';
        document.getElementById('coupon-message').innerHTML = '';

        const response = await fetch(`${API_URL}/workspaces/${workspaceId}`);
        const result = await response.json();
        currentWorkspace = result.data;

        // Load resources
        const resourcesResponse = await fetch(`${API_URL}/resources?workspace_id=${workspaceId}`);
        const resourcesResult = await resourcesResponse.json();
        const resources = resourcesResult.data || [];

        // Display workspace details
        document.getElementById('workspace-details').innerHTML = `
            <div style="padding: 1rem; background: var(--light); border-radius: 8px; margin-bottom: 1rem;">
                <h3>${currentWorkspace.name}</h3>
                <p style="color: var(--text-light);">${currentWorkspace.working_hubs?.name || 'N/A'}, ${currentWorkspace.working_hubs?.city || 'N/A'}</p>
                <div style="margin-top: 1rem;">
                    <span class="workspace-type">${formatType(currentWorkspace.type)}</span>
                    <span style="margin-left: 1rem;">Capacity: ${currentWorkspace.capacity} people</span>
                </div>
            </div>
        `;

        // Display resources
        const resourcesList = document.getElementById('resources-list');
        if (resources.length > 0) {
            resourcesList.innerHTML = resources.map(resource => `
                <div class="resource-item">
                    <div class="resource-info">
                        <h4>${resource.name}</h4>
                        <p>${resource.description}</p>
                    </div>
                    <div class="resource-select">
                        <span class="resource-price">₹${resource.price_per_slot}/hour</span>
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <input type="number" id="qty-${resource.id}" min="0" value="0" style="width: 60px; padding: 0.25rem; border: 1px solid var(--border); border-radius: 4px; text-align: center;" onchange="updateResourceQuantity(${resource.id}, ${resource.price_per_slot}, '${resource.name}')">
                            <label for="qty-${resource.id}" style="font-size: 0.85rem; color: var(--text-light);">Qty</label>
                        </div>
                    </div>
                </div>
            `).join('');
        } else {
            resourcesList.innerHTML = '<p style="color: var(--text-light);">No additional resources available</p>';
        }

        // Reset form
        document.getElementById('booking-form').reset();
        selectedResources = [];
        handleBookingTypeChange(); // Initialize booking type UI
        updatePricingSummary();

        // Show modal
        document.getElementById('booking-modal').classList.add('active');
    } catch (error) {
        console.error('Error loading workspace details:', error);
        alert('Error loading workspace details');
    }
}

function closeBookingModal() {
    document.getElementById('booking-modal').classList.remove('active');

    // Reset coupon
    appliedCoupon = null;
    document.getElementById('coupon-code').value = '';
    document.getElementById('coupon-message').innerHTML = '';

    // Reset pricing summary structure for next booking
    const pricingSummary = document.querySelector('.pricing-summary');
    if (pricingSummary) {
        pricingSummary.innerHTML = `
            <div class="price-row">
                <span>Base Price:</span>
                <span id="base-price">₹0</span>
            </div>
            <div class="price-row">
                <span>Resources:</span>
                <span id="resources-price">₹0</span>
            </div>
            <div class="price-row total">
                <span>Total:</span>
                <span id="total-price">₹0</span>
            </div>
        `;
    }

    // Clear selected resources
    selectedResources = [];
    // Don't clear currentWorkspace here - it's needed for payment processing
}

// Apply coupon code
function applyCoupon() {
    const couponCode = document.getElementById('coupon-code').value.trim().toUpperCase();
    const messageEl = document.getElementById('coupon-message');

    if (!couponCode) {
        messageEl.innerHTML = '<span style="color: #e74c3c;"><i class="fas fa-exclamation-circle"></i> Please enter a coupon code</span>';
        return;
    }

    if (!currentWorkspace) {
        messageEl.innerHTML = '<span style="color: #e74c3c;"><i class="fas fa-exclamation-circle"></i> No workspace selected</span>';
        return;
    }

    // Predefined coupons (you can move this to backend later)
    const coupons = {
        'WELCOME10': { discount: 10, type: 'percentage', description: '10% off' },
        'SAVE20': { discount: 20, type: 'percentage', description: '20% off' },
        'FLAT100': { discount: 100, type: 'fixed', description: '₹100 off' },
        'FLAT200': { discount: 200, type: 'fixed', description: '₹200 off' },
        'FIRSTBOOK': { discount: 15, type: 'percentage', description: '15% off first booking' }
    };

    const coupon = coupons[couponCode];

    if (!coupon) {
        messageEl.innerHTML = '<span style="color: #e74c3c;"><i class="fas fa-times-circle"></i> Invalid coupon code</span>';
        appliedCoupon = null;
        updatePricingSummary();
        return;
    }

    // Apply coupon to current workspace
    appliedCoupon = {
        code: couponCode,
        discount: coupon.discount,
        type: coupon.type,
        description: coupon.description,
        workspace_id: currentWorkspace.id
    };

    messageEl.innerHTML = `<span style="color: #27ae60;"><i class="fas fa-check-circle"></i> Coupon "${couponCode}" applied! ${coupon.description}</span>`;

    // Update pricing to reflect discount
    updatePricingSummary();
}

function updateResourceQuantity(resourceId, price, name) {
    const quantity = parseInt(document.getElementById(`qty-${resourceId}`).value) || 0;
    const index = selectedResources.findIndex(r => r.id === resourceId);

    if (quantity === 0) {
        // Remove resource if quantity is 0
        if (index > -1) {
            selectedResources.splice(index, 1);
        }
    } else {
        // Add or update resource with quantity
        if (index > -1) {
            selectedResources[index].quantity = quantity;
        } else {
            selectedResources.push({ id: resourceId, price, quantity, name });
        }
    }
    updatePricingSummary();
}

// Handle booking type change
function handleBookingTypeChange() {
    const bookingType = document.getElementById('booking-type').value;
    const startTime = document.getElementById('start-time');
    const endTime = document.getElementById('end-time');
    const hintDiv = document.getElementById('booking-hint');
    const startLabel = document.getElementById('start-label');
    const endLabel = document.getElementById('end-label');

    // Update labels and hints based on booking type
    if (bookingType === 'hourly') {
        startLabel.textContent = 'Start Time';
        endLabel.textContent = 'End Time';
        startTime.type = 'datetime-local';
        endTime.type = 'datetime-local';
        hintDiv.innerHTML = '<i class="fas fa-info-circle"></i> <strong>Hourly:</strong> Select start and end time on the same day. Charged per hour.';
        hintDiv.style.background = '#e3f2fd';
        hintDiv.style.borderColor = '#2196F3';
        hintDiv.style.color = '#1976D2';
    } else if (bookingType === 'daily') {
        startLabel.textContent = 'Start Date';
        endLabel.textContent = 'End Date';
        startTime.type = 'date';
        endTime.type = 'date';
        hintDiv.innerHTML = '<i class="fas fa-info-circle"></i> <strong>Daily:</strong> Select full days. Charged at 8 hours per day rate.';
        hintDiv.style.background = '#fff3e0';
        hintDiv.style.borderColor = '#ff9800';
        hintDiv.style.color = '#e65100';
    } else if (bookingType === 'monthly') {
        startLabel.textContent = 'Start Date';
        endLabel.textContent = 'End Date (30 days)';
        startTime.type = 'date';
        endTime.type = 'date';
        hintDiv.innerHTML = '<i class="fas fa-info-circle"></i> <strong>Monthly:</strong> Minimum 30 days booking. Charged at 8 hours/day * 22 working days.';
        hintDiv.style.background = '#f3e5f5';
        hintDiv.style.borderColor = '#9c27b0';
        hintDiv.style.color = '#6a1b9a';
    }

    // Clear existing values
    startTime.value = '';
    endTime.value = '';

    updatePricingSummary();
}

function updatePricingSummary() {
    const startTime = document.getElementById('start-time').value;
    const endTime = document.getElementById('end-time').value;
    const bookingType = document.getElementById('booking-type').value;

    // Ensure pricing summary structure exists
    const pricingSummary = document.querySelector('.pricing-summary');
    if (!pricingSummary) return;

    // Check if structure needs to be restored
    if (!document.getElementById('base-price')) {
        pricingSummary.innerHTML = `
            <div class="price-row">
                <span>Base Price:</span>
                <span id="base-price">₹0</span>
            </div>
            <div class="price-row">
                <span>Resources:</span>
                <span id="resources-price">₹0</span>
            </div>
            <div class="price-row total">
                <span>Total:</span>
                <span id="total-price">₹0</span>
            </div>
        `;
    }

    if (!currentWorkspace || !startTime || !endTime) {
        const basePrice = currentWorkspace ? currentWorkspace.base_price : 0;
        const resourcesPrice = selectedResources.reduce((sum, r) => sum + (r.price * r.quantity), 0);
        const totalPrice = basePrice + resourcesPrice;

        document.getElementById('base-price').textContent = `₹${basePrice}`;
        document.getElementById('resources-price').textContent = `₹${resourcesPrice}`;
        document.getElementById('total-price').textContent = `₹${totalPrice}`;
        return;
    }

    const startDate = new Date(startTime);
    const endDate = new Date(endTime);

    // Validate that end time is after start time
    if (endDate <= startDate) {
        document.querySelector('.pricing-summary').innerHTML = `
            <div style="padding: 1rem; background: #fee; border-left: 3px solid #e74c3c; border-radius: 4px;">
                <i class="fas fa-exclamation-triangle" style="color: #e74c3c;"></i>
                <strong style="color: #e74c3c;">Invalid Time Range</strong>
                <p style="margin-top: 0.5rem; color: #c0392b;">End date/time must be after start date/time</p>
            </div>
        `;
        return;
    }

    // Validate based on booking type
    if (bookingType === 'hourly') {
        // For hourly, check if same day
        const isSameDay = startDate.toDateString() === endDate.toDateString();
        if (!isSameDay) {
            document.querySelector('.pricing-summary').innerHTML = `
                <div style="padding: 1rem; background: #fee; border-left: 3px solid #e74c3c; border-radius: 4px;">
                    <i class="fas fa-exclamation-triangle" style="color: #e74c3c;"></i>
                    <strong style="color: #e74c3c;">Invalid Hourly Booking</strong>
                    <p style="margin-top: 0.5rem; color: #c0392b;">Hourly bookings must be on the same day. Use Daily booking for multi-day reservations.</p>
                </div>
            `;
            return;
        }

        // Check max 12 hours for hourly booking
        const hours = (endDate - startDate) / (1000 * 60 * 60);
        if (hours > 12) {
            document.querySelector('.pricing-summary').innerHTML = `
                <div style="padding: 1rem; background: #fee; border-left: 3px solid #e74c3c; border-radius: 4px;">
                    <i class="fas fa-exclamation-triangle" style="color: #e74c3c;"></i>
                    <strong style="color: #e74c3c;">Hourly Booking Limit</strong>
                    <p style="margin-top: 0.5rem; color: #c0392b;">Maximum 12 hours for hourly booking. For longer durations, use Daily booking.</p>
                </div>
            `;
            return;
        }
    } else if (bookingType === 'monthly') {
        // For monthly, check minimum 28 days
        const days = (endDate - startDate) / (1000 * 60 * 60 * 24);
        if (days < 28) {
            document.querySelector('.pricing-summary').innerHTML = `
                <div style="padding: 1rem; background: #fee; border-left: 3px solid #e74c3c; border-radius: 4px;">
                    <i class="fas fa-exclamation-triangle" style="color: #e74c3c;"></i>
                    <strong style="color: #e74c3c;">Monthly Booking Minimum</strong>
                    <p style="margin-top: 0.5rem; color: #c0392b;">Monthly bookings require minimum 28 days. For shorter periods, use Daily booking.</p>
                </div>
            `;
            return;
        }
    }

    // Calculate dynamic pricing
    fetch(`${API_URL}/pricing/calculate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            workspace_id: currentWorkspace.id,
            start_time: startTime,
            end_time: endTime,
            booking_type: bookingType
        })
    })
        .then(res => res.json())
        .then(result => {
            if (result.success) {
                const pricing = result.data;

                // Calculate resources price based on booking type
                const resourcesPrice = selectedResources.reduce((sum, r) => {
                    const start = new Date(startTime);
                    const end = new Date(endTime);
                    let hours = (end - start) / (1000 * 60 * 60);

                    // For daily bookings, calculate per day (8 hours)
                    if (bookingType === 'daily') {
                        const days = Math.ceil(hours / 24);
                        hours = days * 8;
                    } else if (bookingType === 'monthly') {
                        hours = 22 * 8; // 22 working days * 8 hours
                    }

                    return sum + (r.price * r.quantity * hours);
                }, 0);

                const totalPrice = pricing.final_price + resourcesPrice;

                // Format duration for display based on booking type
                let durationText = '';
                if (bookingType === 'hourly') {
                    const hoursFormatted = pricing.hours % 1 === 0 ? pricing.hours : pricing.hours.toFixed(1);
                    durationText = `${hoursFormatted} hour${pricing.hours !== 1 ? 's' : ''}`;
                } else if (bookingType === 'daily') {
                    const days = Math.ceil(pricing.hours / 8);
                    durationText = `${days} day${days !== 1 ? 's' : ''} @ 8h/day`;
                } else if (bookingType === 'monthly') {
                    durationText = '1 month (22 working days @ 8h/day)';
                }

                let priceHTML = `
                <h3 style="margin-bottom: 1rem; color: var(--primary); font-size: 1rem;">
                    <i class="fas fa-receipt"></i> Pricing Breakdown
                </h3>
                <div class="price-row">
                    <span>Base Price (${durationText}):</span>
                    <span>₹${pricing.breakdown.base.toFixed(2)}</span>
                </div>
            `;

                // Dynamic pricing modifiers with explanations
                const modifiers = [];

                if (pricing.is_workday && pricing.breakdown.workday > 0) {
                    modifiers.push({
                        icon: 'fa-briefcase',
                        color: '#3498db',
                        label: 'Workday Premium',
                        reason: 'Booking during weekdays (Mon-Fri)',
                        percentage: '+8%',
                        amount: pricing.breakdown.workday.toFixed(2)
                    });
                }

                if (pricing.breakdown.occupancy > 0) {
                    const bookedInfo = pricing.booked_workspaces && pricing.total_workspaces
                        ? `${pricing.booked_workspaces}/${pricing.total_workspaces} workspaces booked`
                        : `${pricing.occupancy_rate}% of slots already booked`;
                    modifiers.push({
                        icon: 'fa-chart-line',
                        color: '#e74c3c',
                        label: 'High Demand',
                        reason: bookedInfo,
                        percentage: '+15%',
                        amount: pricing.breakdown.occupancy.toFixed(2)
                    });
                }

                if (pricing.breakdown.rating > 0) {
                    const ratingDisplay = pricing.average_rating ? pricing.average_rating.toFixed(1) : 'N/A';
                    modifiers.push({
                        icon: 'fa-star',
                        color: '#f39c12',
                        label: 'Premium Quality',
                        reason: `Highly rated workspace (${ratingDisplay} ⭐)`,
                        percentage: '+5%',
                        amount: pricing.breakdown.rating.toFixed(2)
                    });
                }

                // Add custom pricing rules (discounts/surcharges)
                if (pricing.breakdown.appliedRules && pricing.breakdown.appliedRules.length > 0) {
                    pricing.breakdown.appliedRules.forEach(rule => {
                        const adjustment = parseFloat(rule.adjustment);
                        const isDiscount = adjustment < 0;
                        const absAdjustment = Math.abs(adjustment);

                        let displayLabel = rule.rule_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                        let displayPercentage = '';

                        if (rule.percentage_modifier && rule.percentage_modifier !== 0) {
                            displayPercentage = `${rule.percentage_modifier > 0 ? '+' : ''}${rule.percentage_modifier}%`;
                        }
                        if (rule.flat_modifier && rule.flat_modifier !== 0) {
                            displayPercentage += (displayPercentage ? ' + ' : '') + `${rule.flat_modifier > 0 ? '+' : ''}₹${Math.abs(rule.flat_modifier)}`;
                        }

                        modifiers.push({
                            icon: isDiscount ? 'fa-tag' : 'fa-plus-circle',
                            color: isDiscount ? '#27ae60' : '#9b59b6',
                            label: displayLabel,
                            reason: rule.reasons || 'Custom pricing rule applied',
                            percentage: displayPercentage,
                            amount: absAdjustment.toFixed(2),
                            isDiscount: isDiscount
                        });
                    });
                }

                // Display modifiers
                if (modifiers.length > 0) {
                    // Separate modifiers into increases and discounts
                    const increases = modifiers.filter(m => !m.isDiscount);
                    const discounts = modifiers.filter(m => m.isDiscount);

                    // Display price increases
                    if (increases.length > 0) {
                        priceHTML += `
                        <div style="margin: 1rem 0; padding: 1rem; background: #fff3e0; border-radius: 6px; border-left: 3px solid #ff9800;">
                            <div style="font-weight: 600; margin-bottom: 0.75rem; color: #e65100; font-size: 0.9rem;">
                                <i class="fas fa-arrow-up"></i> Price Increased Due To:
                            </div>
                    `;

                        increases.forEach(modifier => {
                            priceHTML += `
                            <div class="price-modifier">
                                <div class="modifier-info">
                                    <i class="fas ${modifier.icon}" style="color: ${modifier.color}; margin-right: 0.5rem;"></i>
                                    <div>
                                        <div style="font-weight: 600; font-size: 0.875rem;">${modifier.label} <span style="color: ${modifier.color};">${modifier.percentage}</span></div>
                                        <div style="font-size: 0.8rem; color: var(--text-light); margin-top: 0.25rem;">${modifier.reason}</div>
                                    </div>
                                </div>
                                <div style="font-weight: 600; color: ${modifier.color};">+₹${modifier.amount}</div>
                            </div>
                        `;
                        });

                        priceHTML += `</div>`;
                    }

                    // Display discounts
                    if (discounts.length > 0) {
                        priceHTML += `
                        <div style="margin: 1rem 0; padding: 1rem; background: #e8f5e9; border-radius: 6px; border-left: 3px solid #4caf50;">
                            <div style="font-weight: 600; margin-bottom: 0.75rem; color: #2e7d32; font-size: 0.9rem;">
                                <i class="fas fa-tag"></i> Discounts Applied:
                            </div>
                    `;

                        discounts.forEach(modifier => {
                            priceHTML += `
                            <div class="price-modifier">
                                <div class="modifier-info">
                                    <i class="fas ${modifier.icon}" style="color: ${modifier.color}; margin-right: 0.5rem;"></i>
                                    <div>
                                        <div style="font-weight: 600; font-size: 0.875rem;">${modifier.label} <span style="color: ${modifier.color};">${modifier.percentage}</span></div>
                                        <div style="font-size: 0.8rem; color: var(--text-light); margin-top: 0.25rem;">${modifier.reason}</div>
                                    </div>
                                </div>
                                <div style="font-weight: 600; color: #27ae60;">-₹${modifier.amount}</div>
                            </div>
                        `;
                        });

                        priceHTML += `</div>`;
                    }
                }

                // Display resources breakdown
                if (selectedResources.length > 0) {
                    priceHTML += `
                    <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--border);">
                        <div style="font-weight: 600; margin-bottom: 0.5rem; color: var(--primary); font-size: 0.9rem;">
                            <i class="fas fa-plus-circle"></i> Additional Resources:
                        </div>
                `;

                    const start = new Date(startTime);
                    const end = new Date(endTime);
                    let hours = (end - start) / (1000 * 60 * 60);
                    let unitText = '';

                    if (bookingType === 'hourly') {
                        const hoursFormatted = hours % 1 === 0 ? hours : hours.toFixed(1);
                        unitText = `${hoursFormatted}h`;
                    } else if (bookingType === 'daily') {
                        const days = Math.ceil(hours / 24);
                        hours = days * 8;
                        unitText = `${days} day${days !== 1 ? 's' : ''} (${hours}h)`;
                    } else if (bookingType === 'monthly') {
                        hours = 22 * 8;
                        unitText = '1 month (176h)';
                    }

                    selectedResources.forEach(resource => {
                        const resourceTotal = resource.price * resource.quantity * hours;
                        priceHTML += `
                        <div class="price-row" style="font-size: 0.875rem; margin-left: 1rem;">
                            <span>${resource.name} <span style="color: var(--text-light);">(${resource.quantity} × ₹${resource.price} × ${unitText})</span></span>
                            <span>₹${resourceTotal.toFixed(2)}</span>
                        </div>
                    `;
                    });

                    priceHTML += `
                        <div class="price-row" style="font-weight: 600; margin-top: 0.5rem;">
                            <span>Resources Subtotal:</span>
                            <span id="resources-price">₹${resourcesPrice.toFixed(2)}</span>
                        </div>
                    </div>
                `;
                }

                // Calculate subtotal before discount
                const subtotal = totalPrice;
                let discount = 0;
                let finalTotal = totalPrice;

                // Apply coupon discount if applicable
                if (appliedCoupon && appliedCoupon.workspace_id === currentWorkspace.id) {
                    if (appliedCoupon.type === 'percentage') {
                        discount = (subtotal * appliedCoupon.discount) / 100;
                    } else if (appliedCoupon.type === 'fixed') {
                        discount = appliedCoupon.discount;
                    }
                    // Ensure discount doesn't exceed total
                    discount = Math.min(discount, subtotal);
                    finalTotal = subtotal - discount;

                    // Display coupon discount
                    priceHTML += `
                    <div style="margin-top: 1rem; padding: 0.75rem; background: #d4edda; border-left: 3px solid #28a745; border-radius: 4px;">
                        <div class="price-row" style="color: #155724;">
                            <span><i class="fas fa-tag"></i> Coupon Discount (${appliedCoupon.code}):</span>
                            <span style="color: #28a745; font-weight: 600;">-₹${discount.toFixed(2)}</span>
                        </div>
                    </div>
                `;
                }

                priceHTML += `
                <div class="price-row total" style="font-size: 1.25rem; padding-top: 1rem; border-top: 2px solid var(--border);">
                    <span><i class="fas fa-money-bill-wave"></i> Total Amount:</span>
                    <span id="total-price">₹${finalTotal.toFixed(2)}</span>
                </div>
            `;

                document.querySelector('.pricing-summary').innerHTML = priceHTML;
            }
        })
        .catch(error => {
            console.error('Error calculating price:', error);
            const basePrice = currentWorkspace.base_price;
            const resourcesPrice = selectedResources.reduce((sum, r) => sum + r.price, 0);
            const totalPrice = basePrice + resourcesPrice;

            document.getElementById('base-price').textContent = `₹${basePrice}`;
            document.getElementById('resources-price').textContent = `₹${resourcesPrice}`;
            document.getElementById('total-price').textContent = `₹${totalPrice}`;
        });
}

// Handle Booking Submit
function handleBookingSubmit(e) {
    e.preventDefault();

    const userName = document.getElementById('user-name').value;
    const userEmail = document.getElementById('user-email').value;
    const startTime = document.getElementById('start-time').value;
    const endTime = document.getElementById('end-time').value;
    const bookingType = document.getElementById('booking-type').value;

    const startDate = new Date(startTime);
    const endDate = new Date(endTime);

    // Validate that end time is after start time
    if (endDate <= startDate) {
        alert('Error: End date/time must be after start date/time');
        return;
    }

    // Validate based on booking type
    if (bookingType === 'hourly') {
        const isSameDay = startDate.toDateString() === endDate.toDateString();
        if (!isSameDay) {
            alert('Error: Hourly bookings must be on the same day. Use Daily booking for multi-day reservations.');
            return;
        }
        const hours = (endDate - startDate) / (1000 * 60 * 60);
        if (hours > 12) {
            alert('Error: Maximum 12 hours for hourly booking. For longer durations, use Daily booking.');
            return;
        }
    } else if (bookingType === 'monthly') {
        const days = (endDate - startDate) / (1000 * 60 * 60 * 24);
        if (days < 28) {
            alert('Error: Monthly bookings require minimum 28 days. For shorter periods, use Daily booking.');
            return;
        }
    }

    // Get the calculated total price from the pricing summary
    const totalPriceText = document.getElementById('total-price').textContent;
    const totalPrice = parseFloat(totalPriceText.replace('₹', '').replace(',', ''));

    currentBookingData = {
        workspace_id: currentWorkspace.id,
        user_name: userName,
        user_email: userEmail,
        start_time: startTime,
        end_time: endTime,
        booking_type: bookingType,
        total_price: totalPrice,
        resources: selectedResources.map(r => r.id),
        coupon_code: appliedCoupon ? appliedCoupon.code : null, // Save coupon if applied
        discount_amount: appliedCoupon ? (appliedCoupon.type === 'percentage' ? (totalPrice / (1 - appliedCoupon.discount / 100) * appliedCoupon.discount / 100) : appliedCoupon.discount) : 0
    };

    // Open payment modal first (to copy pricing summary), then close booking modal
    openPaymentModal(totalPrice);
    setTimeout(() => closeBookingModal(), 100);
}

// Payment Modal
function openPaymentModal(amount) {
    document.getElementById('payment-amount').textContent = `₹${amount}`;

    // Copy pricing summary to payment modal
    const pricingSummary = document.querySelector('.pricing-summary');
    if (pricingSummary) {
        const breakdownHTML = pricingSummary.innerHTML;
        document.getElementById('payment-breakdown').innerHTML = `
            <div style="padding: 1rem; background: var(--light); border-radius: 8px; font-size: 0.9rem;">
                ${breakdownHTML}
            </div>
        `;
    }

    document.getElementById('payment-modal').classList.add('active');
}

function closePaymentModal() {
    document.getElementById('payment-modal').classList.remove('active');
}

function selectPayment(method) {
    selectedPaymentMethod = method;

    // Update active state
    document.querySelectorAll('.payment-method').forEach(pm => pm.classList.remove('active'));
    event.target.closest('.payment-method').classList.add('active');

    // Show appropriate form
    document.querySelectorAll('.payment-form').forEach(form => form.classList.remove('active'));
    document.getElementById(`${method}-form`).classList.add('active');
}

async function processPayment() {
    if (!selectedPaymentMethod) {
        alert('Please select a payment method');
        return;
    }

    try {
        // Create booking
        const bookingResponse = await fetch(`${API_URL}/bookings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                workspace_id: currentBookingData.workspace_id,
                user_name: currentBookingData.user_name,
                user_email: currentBookingData.user_email,
                start_time: currentBookingData.start_time,
                end_time: currentBookingData.end_time,
                total_price: currentBookingData.total_price,
                booking_type: currentBookingData.booking_type,
                status: 'confirmed'
            })
        });

        const bookingResult = await bookingResponse.json();

        if (!bookingResult.success) {
            throw new Error(bookingResult.error || 'Failed to create booking');
        }

        const booking = bookingResult.data;

        // Add resources if any
        if (currentBookingData.resources && currentBookingData.resources.length > 0) {
            for (const resourceId of currentBookingData.resources) {
                await fetch(`${API_URL}/bookings/${booking.id}/resources`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ resource_id: resourceId, quantity: 1 })
                });
            }
        }

        // Generate QR code for the booking
        const qrResponse = await fetch(`${API_URL}/qr/generate/${booking.id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        const qrResult = await qrResponse.json();

        if (!qrResult.success) {
            console.error('QR generation failed:', qrResult.error);
            // Continue anyway - QR can be generated later
        }

        const qrData = qrResult.data;

        // Save transaction
        const transaction = {
            id: `TXN${Date.now()}`,
            booking_id: booking.id,
            workspace_name: currentWorkspace.name,
            amount: currentBookingData.total_price,
            method: selectedPaymentMethod,
            status: 'success',
            date: new Date().toISOString(),
            user_name: currentBookingData.user_name,
            user_email: currentBookingData.user_email
        };

        const transactions = JSON.parse(localStorage.getItem('transactions') || '[]');
        transactions.push(transaction);
        localStorage.setItem('transactions', JSON.stringify(transactions));

        // Close payment modal
        closePaymentModal();

        // Show success modal with QR code and booking ID
        showSuccessModal(qrData.qr_image, booking.id);

    } catch (error) {
        console.error('Error processing payment:', error);
        alert('Error processing payment: ' + error.message);
        // Don't clear state on error - user might want to retry
    }
}

function showSuccessModal(qrCode, bookingId) {
    currentBookingId = bookingId;
    document.getElementById('qr-code-container').innerHTML = `<img src="${qrCode}" alt="QR Code">`;
    document.getElementById('success-modal').classList.add('active');
}

function viewFullTicket() {
    if (currentBookingId) {
        window.open(`ticket.html?id=${currentBookingId}`, '_blank');
    }
}

function closeSuccessModal() {
    document.getElementById('success-modal').classList.remove('active');

    // Clear booking state after successful completion
    currentWorkspace = null;
    selectedResources = [];
    currentBookingData = null;

    loadMyBookings();

    // Reload workspaces to show updated booking status
    if (currentHub && allWorkspaces.length > 0) {
        displayWorkspaces(allWorkspaces);
    }

    // Navigate to bookings page
    document.querySelectorAll('.nav-menu a').forEach(l => l.classList.remove('active'));
    document.querySelector('[data-page="bookings"]').classList.add('active');
    document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
    document.getElementById('bookings').classList.add('active');
}

// Load My Bookings
async function loadMyBookings() {
    const searchTerm = document.getElementById('search-bookings').value.toLowerCase();
    const container = document.getElementById('bookings-list');
    container.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i><p>Loading bookings...</p></div>';

    try {
        const response = await fetch(`${API_URL}/bookings`);
        const result = await response.json();
        let bookings = result.data || [];

        // Filter by search term
        if (searchTerm) {
            bookings = bookings.filter(b =>
                b.user_name.toLowerCase().includes(searchTerm) ||
                (b.user_email && b.user_email.toLowerCase().includes(searchTerm))
            );
        }

        if (bookings.length === 0) {
            container.innerHTML = '<div class="no-data"><i class="fas fa-calendar"></i><h3>No bookings found</h3><p>Book a workspace to get started</p></div>';
            return;
        }

        container.innerHTML = bookings.map(booking => `
            <div class="booking-card ${booking.status}">
                <div class="booking-header">
                    <div class="booking-title">
                        <h3>${booking.workspaces?.name || 'N/A'}</h3>
                        <p>${booking.workspaces?.working_hubs?.name || 'N/A'}, ${booking.workspaces?.working_hubs?.city || 'N/A'}</p>
                    </div>
                    <span class="booking-status ${booking.status}">${formatStatus(booking.status)}</span>
                </div>
                <div class="booking-details">
                    <div class="detail-item">
                        <i class="fas fa-user"></i>
                        <span>${booking.user_name}</span>
                    </div>
                    <div class="detail-item">
                        <i class="fas fa-calendar"></i>
                        <span>${formatDateTime(booking.start_time)}</span>
                    </div>
                    <div class="detail-item">
                        <i class="fas fa-clock"></i>
                        <span>${formatDateTime(booking.end_time)}</span>
                    </div>
                </div>
                <div class="booking-footer">
                    <div class="booking-price">₹${booking.total_price}</div>
                    <div style="display: flex; gap: 0.5rem;">
                        ${booking.status === 'confirmed' || booking.status === 'checked_in' ? `
                            <button class="btn-secondary" onclick="viewQR(${booking.id})">
                                <i class="fas fa-ticket-alt"></i> View Ticket
                            </button>
                        ` : `
                            <button class="btn-secondary" disabled style="opacity: 0.5; cursor: not-allowed;">
                                <i class="fas fa-qrcode"></i> QR Not Available
                            </button>
                        `}
                        ${booking.status === 'confirmed' || booking.status === 'completed' ? `
                            <button class="btn-review" onclick="openReviewModal(${booking.id}, ${booking.workspace_id}, '${booking.user_name}')">
                                <i class="fas fa-star"></i> Review
                            </button>
                        ` : ''}
                        ${booking.status === 'confirmed' ? `
                            <button class="btn-secondary" onclick="cancelBooking(${booking.id})" style="background: #e74c3c; color: white;">
                                <i class="fas fa-times-circle"></i> Cancel
                            </button>
                        ` : ''}
                    </div>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading bookings:', error);
        container.innerHTML = '<div class="no-data"><i class="fas fa-exclamation-circle"></i><h3>Error loading bookings</h3><p>Please try again later</p></div>';
    }
}

async function viewQR(bookingId) {
    // Open full ticket page in new tab
    window.open(`ticket.html?id=${bookingId}`, '_blank');
}

async function cancelBooking(bookingId) {
    if (!confirm('Are you sure you want to cancel this booking?')) {
        return;
    }

    try {
        const response = await fetch(`${API_URL}/bookings/${bookingId}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'cancelled' })
        });

        const result = await response.json();

        if (result.success) {
            alert('Booking cancelled successfully');
            loadMyBookings();

            // Reload workspaces if on search page to update booking status
            if (currentHub) {
                // Reload the hub's workspaces to refresh booking status
                selectHub(currentHub.id);
            }
        } else {
            alert('Error cancelling booking: ' + (result.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error cancelling booking:', error);
        alert('Error cancelling booking');
    }
}

function formatStatus(status) {
    const statuses = {
        'confirmed': 'Confirmed',
        'checked_in': 'Checked In',
        'completed': 'Completed',
        'cancelled': 'Cancelled'
    };
    return statuses[status] || status;
}

function formatDateTime(dateTime) {
    // Parse ISO string directly: "2026-02-25T21:30:00.000Z"
    const isoString = dateTime.includes('T') ? dateTime : new Date(dateTime).toISOString();
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

// Transactions
function loadTransactions() {
    const transactions = JSON.parse(localStorage.getItem('transactions') || '[]');
    const container = document.getElementById('transactions-list');

    // Update stats
    const totalTransactions = transactions.length;
    const successfulTransactions = transactions.filter(t => t.status === 'success').length;
    const totalSpent = transactions.filter(t => t.status === 'success').reduce((sum, t) => sum + t.amount, 0);

    document.getElementById('total-transactions').textContent = totalTransactions;
    document.getElementById('successful-transactions').textContent = successfulTransactions;
    document.getElementById('total-spent').textContent = `₹${totalSpent}`;

    if (transactions.length === 0) {
        container.innerHTML = '<div class="no-data"><i class="fas fa-receipt"></i><h3>No transactions yet</h3><p>Your payment history will appear here</p></div>';
        return;
    }

    displayTransactions(transactions);
}

function displayTransactions(transactions) {
    const container = document.getElementById('transactions-list');

    container.innerHTML = transactions.reverse().map(txn => `
        <div class="transaction-card">
            <div class="transaction-header">
                <div>
                    <div class="transaction-id">${txn.id}</div>
                    <p style="color: var(--text-light); font-size: 0.9rem; margin-top: 0.25rem;">${txn.workspace_name}</p>
                </div>
                <span class="transaction-status ${txn.status}">${txn.status === 'success' ? 'Success' : 'Failed'}</span>
            </div>
            <div class="transaction-info">
                <div class="detail-item">
                    <i class="fas fa-user"></i>
                    <span>${txn.user_name}</span>
                </div>
                <div class="detail-item">
                    <i class="fas fa-calendar"></i>
                    <span>${formatDateTime(txn.date)}</span>
                </div>
                <div class="detail-item">
                    <i class="fas fa-credit-card"></i>
                    <span>${formatPaymentMethod(txn.method)}</span>
                </div>
                <div class="transaction-amount">₹${txn.amount}</div>
            </div>
        </div>
    `).join('');
}

function filterTransactions() {
    const searchTerm = document.getElementById('search-transactions').value.toLowerCase();
    const transactions = JSON.parse(localStorage.getItem('transactions') || '[]');

    const filtered = transactions.filter(txn =>
        txn.id.toLowerCase().includes(searchTerm) ||
        txn.workspace_name.toLowerCase().includes(searchTerm) ||
        txn.user_name.toLowerCase().includes(searchTerm)
    );

    displayTransactions(filtered);
}

function formatPaymentMethod(method) {
    const methods = {
        'card': 'Credit/Debit Card',
        'upi': 'UPI',
        'netbanking': 'Net Banking',
        'wallet': 'Wallet'
    };
    return methods[method] || method;
}

// ────────── Review Functions ──────────

let selectedRating = 0;

function openReviewModal(bookingId, workspaceId, userName) {
    document.getElementById('review-booking-id').value = bookingId;
    document.getElementById('review-workspace-id').value = workspaceId;
    document.getElementById('review-user-name').value = userName;
    document.getElementById('review-user-email').value = '';
    document.getElementById('review-text').value = '';
    selectedRating = 0;
    document.getElementById('review-rating').value = '';

    // Reset stars
    document.querySelectorAll('.star').forEach(star => {
        star.classList.remove('active');
    });

    document.getElementById('review-modal').style.display = 'flex';
}

function closeReviewModal() {
    document.getElementById('review-modal').style.display = 'none';
}

// Initialize star rating functionality
document.addEventListener('DOMContentLoaded', () => {
    const stars = document.querySelectorAll('.star');

    stars.forEach(star => {
        star.addEventListener('click', function () {
            selectedRating = parseInt(this.getAttribute('data-rating'));
            document.getElementById('review-rating').value = selectedRating;

            // Update star display
            stars.forEach(s => {
                const starRating = parseInt(s.getAttribute('data-rating'));
                if (starRating <= selectedRating) {
                    s.classList.add('active');
                } else {
                    s.classList.remove('active');
                }
            });
        });

        star.addEventListener('mouseenter', function () {
            const hoverRating = parseInt(this.getAttribute('data-rating'));
            stars.forEach(s => {
                const starRating = parseInt(s.getAttribute('data-rating'));
                if (starRating <= hoverRating) {
                    s.classList.add('active');
                } else {
                    s.classList.remove('active');
                }
            });
        });
    });

    const starRating = document.getElementById('star-rating');
    if (starRating) {
        starRating.addEventListener('mouseleave', function () {
            // Reset to selected rating
            stars.forEach(s => {
                const starRating = parseInt(s.getAttribute('data-rating'));
                if (starRating <= selectedRating) {
                    s.classList.add('active');
                } else {
                    s.classList.remove('active');
                }
            });
        });
    }
});

async function submitReview(event) {
    event.preventDefault();

    const bookingId = document.getElementById('review-booking-id').value;
    const workspaceId = document.getElementById('review-workspace-id').value;
    const userName = document.getElementById('review-user-name').value;
    const userEmail = document.getElementById('review-user-email').value;
    const rating = document.getElementById('review-rating').value;
    const reviewText = document.getElementById('review-text').value;

    if (!rating) {
        alert('Please select a rating');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/ratings/${workspaceId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_name: userName,
                user_email: userEmail,
                rating: parseInt(rating),
                review: reviewText,
                booking_id: parseInt(bookingId)
            })
        });

        const result = await response.json();

        if (result.success) {
            alert('Thank you for your review! ⭐');
            closeReviewModal();
            loadMyBookings(); // Refresh bookings list
        } else {
            alert('Error submitting review: ' + (result.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error submitting review:', error);
        alert('Error submitting review. Please try again.');
    }
}
