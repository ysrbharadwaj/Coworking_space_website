/* admin-frontend/js/transactions-list.js */
let allTransactions = [];

document.addEventListener('DOMContentLoaded', loadTransactions);

// Auto-refresh every 15 seconds to show new transactions immediately
setInterval(loadTransactions, 15000);

// Refresh when returning to this page
window.addEventListener('pageshow', (event) => {
    if (event.persisted || performance.navigation.type === 2) {
        loadTransactions();
    }
});

async function loadTransactions() {
    try {
        // Fetch bookings with full details
        const res = await fetch(`${API_URL}/bookings`);
        const json = await res.json();
        allTransactions = json.data || json;

        // Fetch QR codes
        const qrRes = await fetch(`${API_URL}/qr`);
        const qrJson = await qrRes.json();
        const qrCodes = qrJson.data || qrJson;

        // Map QR codes and generate transaction_id if missing
        if (Array.isArray(qrCodes)) {
            allTransactions.forEach(txn => {
                const qr = qrCodes.find(q => q.booking_id === txn.id);
                if (qr) {
                    txn.qr_code = qr;
                }
                // Generate transaction_id if not present
                if (!txn.transaction_id && txn.created_at) {
                    const dateStr = new Date(txn.created_at).toISOString().slice(0, 19).replace(/[-:T]/g, '').slice(0, 14);
                    txn.transaction_id = `TXN-${dateStr}`;
                } else if (!txn.transaction_id) {
                    txn.transaction_id = `TXN-${txn.id}`;
                }
            });
        }

        // Merge with localStorage transactions (for backward compatibility)
        const localTxns = getTransactions();
        if (localTxns && localTxns.length > 0) {
            // Add local transactions that don't exist in backend
            localTxns.forEach(lt => {
                if (!allTransactions.find(t => t.id === lt.booking_id)) {
                    allTransactions.push({
                        ...lt,
                        id: lt.booking_id,
                        user_name: lt.user_name || lt.guest_name,
                        total_price: lt.amount,
                        transaction_id: lt.id
                    });
                }
            });
        }

        renderStats(allTransactions);
        renderTransactions(allTransactions);
        updateTimestamp();
    } catch (err) {
        console.error('Failed to load transactions:', err);
        // Fallback to localStorage
        allTransactions = getTransactions();
        renderStats(allTransactions);
        renderTransactions(allTransactions);
        updateTimestamp();
    }
}

function updateTimestamp() {
    const el = document.getElementById('last-updated');
    if (el) el.textContent = 'Updated: ' + new Date().toLocaleTimeString();
}

function renderStats(txns) {
    const totalEl = document.getElementById('total-count');
    const successEl = document.getElementById('success-count');
    const failedEl = document.getElementById('failed-count');
    const revenueEl = document.getElementById('total-revenue');

    if (totalEl) totalEl.textContent = txns.length;
    if (successEl) successEl.textContent = txns.filter(t => t.status === 'confirmed' || t.status === 'completed' || t.status === 'checked_in').length;
    if (failedEl) failedEl.textContent = txns.filter(t => t.status === 'cancelled').length;
    if (revenueEl) revenueEl.textContent = formatCurrency(
        txns.filter(t => t.status !== 'cancelled').reduce((s, t) => s + (parseFloat(t.total_price || t.amount) || 0), 0)
    );
}

function filterTransactions() {
    const q = (document.getElementById('search')?.value || '').toLowerCase();
    const status = document.getElementById('filter-status')?.value || '';
    const method = document.getElementById('filter-method')?.value || '';
    const filtered = allTransactions.filter(t => {
        const matchQ = !q || String(t.id || '').toLowerCase().includes(q) || (t.user_name || t.guest_name || '').toLowerCase().includes(q) || (t.user_email || t.guest_email || '').toLowerCase().includes(q);
        const matchStatus = !status || t.status === status;
        const matchMethod = !method || t.payment_method === method;
        return matchQ && matchStatus && matchMethod;
    });
    renderTransactions(filtered);
}

function renderTransactions(txns) {
    const tbody = document.getElementById('transactions-table');
    if (!txns.length) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">No transactions found.</td></tr>';
        return;
    }
    tbody.innerHTML = txns.map(t => {
        const bookingId = `BOOK-${t.id}`;
        const txnId = t.transaction_id || `TXN-${t.id}`;
        const statusBadgeClass = statusBadge(t.status);

        return `
        <tr>
            <td><strong>${bookingId}</strong></td>
            <td><strong>${txnId}</strong></td>
            <td>${t.user_name || t.guest_name || '—'}</td>
            <td><strong>${formatCurrency(t.total_price || t.amount || 0)}</strong></td>
            <td><span class="badge ${statusBadgeClass}">${t.status || '—'}</span></td>
            <td>${formatDateTime(t.date || t.created_at)}</td>
            <td>
                <a href="booking-details-admin.html?booking_id=${t.id}" class="btn btn-sm btn-outline">
                    <i class="fas fa-eye"></i> View
                </a>
            </td>
        </tr>
        `;
    }).join('');
}

function statusBadge(s) {
    const map = { confirmed: 'badge-success', cancelled: 'badge-danger', pending: 'badge-warning', completed: 'badge-info', checked_in: 'badge-info' };
    return map[s] || 'badge-secondary';
}
