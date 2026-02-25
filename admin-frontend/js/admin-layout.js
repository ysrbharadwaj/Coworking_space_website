// admin-layout.js – Injects consistent admin sidebar & marks active nav link

(function injectAdminLayout() {
    // Check authentication (skip for login page)
    if (!window.location.pathname.includes('login.html')) {
        const adminAuth = localStorage.getItem('adminAuth');
        if (!adminAuth) {
            window.location.href = 'login.html';
            return;
        }
    }

    const sidebarHTML = `
<aside class="admin-sidebar" id="admin-sidebar">
    <div class="sidebar-brand">
        <i class="fas fa-building"></i>
        <span>WorkSpace</span>
    </div>
    <nav class="sidebar-nav">
        <a href="admin-dashboard.html" data-page="admin-dashboard">
            <i class="fas fa-chart-line"></i> Dashboard
        </a>
        <a href="hubs-list.html" data-page="hubs-list">
            <i class="fas fa-building"></i> Hubs
        </a>
        <a href="workspaces-list.html" data-page="workspaces-list">
            <i class="fas fa-door-open"></i> Workspaces
        </a>
        <a href="resources-list.html" data-page="resources-list">
            <i class="fas fa-boxes"></i> Resources
        </a>
        <a href="users-list.html" data-page="users-list">
            <i class="fas fa-users"></i> Users
        </a>
        <a href="ratings-list.html" data-page="ratings-list">
            <i class="fas fa-star"></i> Reviews
        </a>
        <a href="pricing-rules-list.html" data-page="pricing-rules-list">
            <i class="fas fa-tags"></i> Pricing
        </a>
        <a href="transactions-list.html" data-page="transactions-list">
            <i class="fas fa-calendar-check"></i> Bookings & Transactions
        </a>
        <a href="financial-reports.html" data-page="financial-reports">
            <i class="fas fa-chart-bar"></i> Reports
        </a>
        <a href="database-viewer.html" data-page="database-viewer">
            <i class="fas fa-database"></i> Database Viewer
        </a>
        
        <div style="margin-top:auto;padding:1rem;border-top:1px solid var(--border);">
            <button onclick="handleLogout()" style="width:100%;padding:.75rem;background:white;color:var(--danger);border:1px solid var(--danger);cursor:pointer;font-weight:600;transition:all .15s;">
                <i class="fas fa-sign-out-alt"></i> Logout
            </button>
        </div>
    </nav>
</aside>`;

    // Insert sidebar before first child of body
    document.body.insertAdjacentHTML('afterbegin', sidebarHTML);

    // Mark active link based on file name
    const page = location.pathname.split('/').pop().replace('.html', '');
    const link = document.querySelector(`.sidebar-nav [data-page="${page}"]`);
    if (link) link.classList.add('active');
})();

// Logout handler
function handleLogout() {
    if (confirm('Are you sure you want to logout?')) {
        localStorage.removeItem('adminAuth');
        window.location.href = 'login.html';
    }
}
