// navbar.js - Clean URLs version
document.addEventListener('DOMContentLoaded', function() {
    // Create navbar HTML
    const navbarHTML = `
        <nav class="navbar">
            <div class="navbar-container">
                <a href="/" class="navbar-logo">
                    <div class="navbar-logo-icon"><i class="fas fa-bolt"></i></div>
                    <span>TOOLS</span>
                </a>
                <button class="navbar-toggle" id="navbarToggle">
                    <span></span><span></span><span></span>
                </button>
                <ul class="navbar-menu" id="navbarMenu">
                    <li class="navbar-item">
                        <a href="/" class="navbar-link">
                            <i class="fas fa-home"></i>
                            <span>HOME</span>
                        </a>
                    </li>
                    <li class="navbar-item">
                        <a href="/pdf-compressor.html" class="navbar-link">
                            <i class="fas fa-compress"></i>
                            <span>KOMPRES PDF</span>
                        </a>
                    </li>
                    <li class="navbar-item">
                        <a href="/pdf-merge.html" class="navbar-link">
                            <i class="fas fa-object-group"></i>
                            <span>GABUNG PDF</span>
                        </a>
                    </li>
                    <li class="navbar-item">
                        <a href="/pdf-split.html" class="navbar-link">
                            <i class="fas fa-cut"></i>
                            <span>PISAH PDF</span>
                        </a>
                    </li>
                    <li class="navbar-item">
                        <a href="/pdf-to-images.html" class="navbar-link">
                            <i class="fas fa-images"></i>
                            <span>PDF→IMG</span>
                        </a>
                    </li>
                    <li class="navbar-item">
                        <a href="/image-to-pdf.html" class="navbar-link">
                            <i class="fas fa-file-pdf"></i>
                            <span>IMG→PDF</span>
                        </a>
                    </li>
                    <li class="navbar-item">
                        <a href="/image-compressor.html" class="navbar-link">
                            <i class="fas fa-image"></i>
                            <span>KOMPRES IMG</span>
                        </a>
                    </li>
                </ul>
            </div>
        </nav>
    `;

    // Insert navbar after canvas (or at beginning of body if no canvas)
    const canvas = document.getElementById('backgroundCanvas');
    if (canvas && canvas.nextSibling) {
        canvas.insertAdjacentHTML('afterend', navbarHTML);
    } else {
        document.body.insertAdjacentHTML('afterbegin', navbarHTML);
    }

    // Initialize navbar functionality
    initNavbar();
});

function initNavbar() {
    const navbarToggle = document.getElementById('navbarToggle');
    const navbarMenu = document.getElementById('navbarMenu');
    
    // Toggle menu on mobile
    navbarToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        navbarToggle.classList.toggle('active');
        navbarMenu.classList.toggle('active');
    });
    
    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.navbar-container')) {
            navbarToggle.classList.remove('active');
            navbarMenu.classList.remove('active');
        }
    });
    
    // Auto highlight active page
    const currentPath = window.location.pathname;
    const isHomePage = currentPath === '/' || currentPath === '/index.html';
    
    document.querySelectorAll('.navbar-link').forEach(link => {
        const href = link.getAttribute('href');
        
        // Check if it's the home page
        if (isHomePage && href === '/') {
            link.classList.add('active');
        } 
        // Check if it's other pages
        else if (!isHomePage && currentPath.includes(href) && href !== '/') {
            link.classList.add('active');
        }
    });

    // Close menu when clicking a link
    document.querySelectorAll('.navbar-link').forEach(link => {
        link.addEventListener('click', () => {
            navbarToggle.classList.remove('active');
            navbarMenu.classList.remove('active');
        });
    });
}