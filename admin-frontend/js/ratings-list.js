/* admin-frontend/js/ratings-list.js */
let allRatings = [];

document.addEventListener('DOMContentLoaded', loadRatings);

// Auto-refresh every 15 seconds to show new reviews immediately
setInterval(loadRatings, 15000);

async function loadRatings() {
    try {
        // Fetch ratings from API
        const apiRatings = await fetch(`${API_URL}/ratings`).then(r => r.json());
        const apiRatingsArray = apiRatings.success && Array.isArray(apiRatings.data) ? apiRatings.data : [];

        // Also get ratings from localStorage (if any)
        const localRatings = JSON.parse(localStorage.getItem('ratings') || '[]');

        // Combine and deduplicate
        const ratingsMap = new Map();

        // Add API ratings first (they have more complete data)
        apiRatingsArray.forEach(r => {
            if (r.id) ratingsMap.set(r.id, r);
        });

        // Add local ratings if not already present
        localRatings.forEach(r => {
            if (r.id && !ratingsMap.has(r.id)) {
                ratingsMap.set(r.id, r);
            }
        });

        allRatings = Array.from(ratingsMap.values());

        // Calculate stats
        const totalRatings = allRatings.length;
        const avgRating = totalRatings > 0
            ? (allRatings.reduce((s, r) => s + (r.rating || 0), 0) / totalRatings).toFixed(1)
            : '0.0';
        const positiveRatings = allRatings.filter(r => r.rating >= 4).length;

        document.getElementById('total-ratings').textContent = totalRatings;
        document.getElementById('avg-rating').textContent = avgRating + ' ★';
        document.getElementById('positive-ratings').textContent = positiveRatings;

        renderRatings(allRatings);
        updateTimestamp();
    } catch (err) {
        console.error('Ratings load error', err);
        const tbody = document.getElementById('ratings-table');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="8" style="color:var(--danger);text-align:center;padding:2rem;">Failed to load ratings.</td></tr>';
        }
    }
}

function updateTimestamp() {
    const el = document.getElementById('last-updated');
    if (el) el.textContent = 'Updated: ' + new Date().toLocaleTimeString();
}

function filterRatings() {
    const q = (document.getElementById('search')?.value || '').toLowerCase();
    const rating = document.getElementById('filter-rating')?.value;

    const filtered = allRatings.filter(r => {
        const matchQ = !q ||
            (r.user_name || '').toLowerCase().includes(q) ||
            (r.user_email || '').toLowerCase().includes(q) ||
            (r.review || '').toLowerCase().includes(q) ||
            (r.workspaces?.name || '').toLowerCase().includes(q);

        const matchRating = !rating || r.rating === parseInt(rating);

        return matchQ && matchRating;
    });

    renderRatings(filtered);
}

function renderRatings(ratings) {
    const tbody = document.getElementById('ratings-table');

    if (!ratings.length) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--text-light);padding:2rem;">No reviews found.</td></tr>';
        return;
    }

    tbody.innerHTML = ratings.map(r => {
        const workspaceName = r.workspaces?.name || r.workspace_name || `Workspace #${r.workspace_id}`;
        const hubName = r.workspaces?.working_hubs?.name || '—';
        const stars = '★'.repeat(r.rating) + '☆'.repeat(5 - r.rating);
        const date = r.created_at ? formatDateTime(r.created_at) : '—';
        const reviewPreview = r.review ? (r.review.length > 50 ? r.review.substring(0, 50) + '...' : r.review) : '—';

        return `
            <tr>
                <td><strong>${r.user_name || 'Anonymous'}</strong></td>
                <td><span style="color:#f39c12;font-size:1.1rem;">${stars}</span></td>
                <td>${workspaceName}</td>
                <td>${hubName}</td>
                <td style="max-width:300px;" title="${r.review || ''}">${reviewPreview}</td>
                <td>${r.booking_id ? `<a href="booking-details-admin.html?booking_id=${r.booking_id}" style="color:var(--primary);">#${r.booking_id}</a>` : '—'}</td>
                <td>${date}</td>
                <td>
                    <button class="btn btn-sm btn-outline" onclick="viewRatingDetails(${r.id})" title="View Details">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="deleteRating(${r.id})" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

function viewRatingDetails(ratingId) {
    const rating = allRatings.find(r => r.id === ratingId);
    if (!rating) return;

    const stars = '★'.repeat(rating.rating) + '☆'.repeat(5 - rating.rating);

    alert(`Rating Details

User: ${rating.user_name || 'Anonymous'}
Email: ${rating.user_email || 'N/A'}
Rating: ${stars} (${rating.rating}/5)
Workspace: ${rating.workspaces?.name || rating.workspace_name || 'N/A'}
Booking ID: ${rating.booking_id || 'N/A'}
Date: ${rating.created_at ? formatDateTime(rating.created_at) : 'N/A'}

Review:
${rating.review || 'No review text provided.'}`);
}

async function deleteRating(ratingId) {
    if (!confirm('Are you sure you want to delete this review? This action cannot be undone.')) return;

    try {
        const res = await fetch(`${API_URL}/ratings/${ratingId}`, {
            method: 'DELETE'
        });

        if (!res.ok) throw new Error('Failed to delete');

        showToast('Review deleted successfully', 'success');

        // Remove from localStorage if present
        const localRatings = JSON.parse(localStorage.getItem('ratings') || '[]');
        const updated = localRatings.filter(r => r.id !== ratingId);
        localStorage.setItem('ratings', JSON.stringify(updated));

        // Reload ratings
        await loadRatings();
    } catch (err) {
        console.error('Delete rating error:', err);
        showToast('Failed to delete review', 'error');
    }
}
