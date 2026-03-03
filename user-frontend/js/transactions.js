// transactions.js – Transaction history & payment records

let allTransactions = [];

document.addEventListener('DOMContentLoaded', () => {
    loadTransactions();
});

async function loadTransactions() {
    try {
        const response = await fetch(`${API_URL}/transactions`);
        const result = await response.json();
        
        if (result.success) {
            // Map backend data to frontend format
            allTransactions = result.data.map(txn => ({
                id: txn.transaction_id || `TXN${txn.id}`,
                workspace_name: txn.workspace,
                user_name: txn.user,
                amount: txn.amount,
                status: txn.status,
                method: txn.payment_method.toLowerCase(),
                date: txn.date
            }));
            
            renderStats(allTransactions);
            displayTransactions(allTransactions);
        } else {
            console.error('Failed to load transactions:', result.error);
            showError('Failed to load transactions. Please try again.');
        }
    } catch (error) {
        console.error('Error loading transactions:', error);
        showError('Network error. Please check your connection.');
    }
}

function renderStats(txns) {
    const successful = txns.filter(t => t.status === 'success');
    document.getElementById('total-transactions').textContent    = txns.length;
    document.getElementById('successful-transactions').textContent = successful.length;
    document.getElementById('total-spent').textContent           =
        formatCurrency(successful.reduce((s, t) => s + Number(t.amount), 0));
}

function displayTransactions(txns) {
    const container = document.getElementById('transactions-list');
    if (!txns.length) {
        container.innerHTML = noDataHTML('fa-receipt', 'No transactions yet', 'Your payment history will appear here.');
        return;
    }

    container.innerHTML = txns.map(t => `
        <div class="transaction-card">
            <div class="transaction-header">
                <div>
                    <div class="transaction-id">${t.id}</div>
                    <p style="color:var(--text-light);font-size:.875rem;margin-top:.2rem;">${t.workspace_name}</p>
                </div>
                <span class="transaction-status ${t.status}">
                    ${t.status === 'success' ? 'Success' : 'Failed'}
                </span>
            </div>
            <div class="transaction-info">
                <div class="detail-item"><i class="fas fa-user"></i><span>${t.user_name}</span></div>
                <div class="detail-item"><i class="fas fa-calendar"></i><span>${formatDateTime(t.date)}</span></div>
                <div class="detail-item"><i class="fas fa-credit-card"></i><span>${formatPaymentMethod(t.method)}</span></div>
                <div class="transaction-amount">${formatCurrency(t.amount)}</div>
            </div>
        </div>
    `).join('');
}

function filterTransactions() {
    const search = document.getElementById('search-transactions').value.toLowerCase();
    const filtered = allTransactions.filter(t =>
        t.id.toLowerCase().includes(search) ||
        t.workspace_name.toLowerCase().includes(search) ||
        t.user_name.toLowerCase().includes(search)
    );
    displayTransactions(filtered);
}

function showError(message) {
    const container = document.getElementById('transactions-list');
    container.innerHTML = `
        <div class="error-message" style="text-align: center; padding: 2rem; color: var(--danger);">
            <i class="fas fa-exclamation-triangle" style="font-size: 2rem; margin-bottom: 1rem; display: block;"></i>
            <h3>Error Loading Transactions</h3>
            <p>${message}</p>
            <button onclick="loadTransactions()" style="margin-top: 1rem; padding: 0.5rem 1rem; background: var(--accent); color: white; border: none; border-radius: 4px; cursor: pointer;">
                <i class="fas fa-refresh"></i> Retry
            </button>
        </div>
    `;
}
