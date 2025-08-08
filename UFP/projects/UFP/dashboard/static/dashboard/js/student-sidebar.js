// Student Dashboard Sidebar JavaScript
document.addEventListener('DOMContentLoaded', function() {
    const sidebar = document.getElementById('studentSidebar');
    const sidebarToggleBtn = document.getElementById('sidebarToggleBtn');
    const sidebarBackdrop = document.getElementById('sidebarBackdrop');
    
    // Check if we're on mobile
    function isMobile() {
        return window.innerWidth <= 991.98;
    }
    
    // Close sidebar on mobile
    function closeSidebarMobile() {
        sidebar.classList.remove('mobile-visible');
        sidebarBackdrop.classList.remove('mobile-visible');
        document.body.classList.remove('sidebar-open');
    }
    
    // Toggle sidebar
    sidebarToggleBtn.addEventListener('click', function() {
        if (isMobile()) {
            // Mobile behavior: overlay sidebar
            sidebar.classList.toggle('mobile-visible');
            sidebarBackdrop.classList.toggle('mobile-visible');
            document.body.classList.toggle('sidebar-open');
        } else {
            // Desktop behavior: 
            // First click: expand (remove collapsed)
            // Second click: collapse (add collapsed)
            if (sidebar.classList.contains('collapsed')) {
                sidebar.classList.remove('collapsed'); // Expand
            } else {
                sidebar.classList.add('collapsed'); // Collapse
            }
        }
    });
    
    // Close sidebar when clicking backdrop
    sidebarBackdrop.addEventListener('click', closeSidebarMobile);
    
    // Handle window resize
    window.addEventListener('resize', function() {
        if (!isMobile()) {
            // Reset mobile state when switching to desktop
            closeSidebarMobile();
            sidebar.classList.remove('mobile-visible');
            sidebarBackdrop.classList.remove('mobile-visible');
            document.body.classList.remove('sidebar-open');
            // Ensure sidebar is expanded (not collapsed) when switching to desktop
            sidebar.classList.remove('collapsed');
        }
    });
    
    // Add data-title attributes for tooltips on collapsed sidebar
    const navLinks = sidebar.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        const text = link.querySelector('.sidebar-text');
        if (text) {
            link.setAttribute('data-title', text.textContent.trim());
        }
    });
    
    // Close sidebar when clicking on a link (mobile only)
    navLinks.forEach(link => {
        link.addEventListener('click', function() {
            if (isMobile()) {
                closeSidebarMobile();
            }
        });
    });
    
    // Initialize sidebar state - always expanded on desktop, never collapsed by default
    if (!isMobile()) {
        sidebar.classList.remove('collapsed');
    }
});