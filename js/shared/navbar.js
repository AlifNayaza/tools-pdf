// js/shared/navbar.js - COMPLETE 12-IN-1 TOOLS NAVBAR WITH DROPDOWN CATEGORIES

(function() {
    'use strict';

    // Apply saved theme immediately before render to avoid flash
    const savedTheme = localStorage.getItem('theme') || 'light';
    if (savedTheme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
    } else {
        document.documentElement.removeAttribute('data-theme');
    }

    document.addEventListener('DOMContentLoaded', function() {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        
        const navbarHTML = `
            <nav class="navbar">
                <div class="navbar-container">
                    <a href="/" class="navbar-logo">
                        <div class="navbar-logo-icon"><i class="fas fa-bolt"></i></div>
                        <span>TOOLS</span>
                    </a>
                    
                    <div class="navbar-right">
                        <button id="pwaInstallBtn" class="pwa-install-btn" title="Install Aplikasi">
                            <i class="fas fa-download"></i> <span>INSTALL</span>
                        </button>

                        <button id="themeToggleBtn" class="theme-toggle-btn" title="Ganti Tema">
                            <i class="fas ${isDark ? 'fa-sun' : 'fa-moon'}"></i>
                            <span class="theme-label">${isDark ? 'LIGHT' : 'DARK'}</span>
                        </button>

                        <button class="navbar-toggle" id="navbarToggle" aria-label="Toggle Navigation">
                            <span></span><span></span><span></span>
                        </button>

                        <ul class="navbar-menu" id="navbarMenu">
                            <li class="navbar-item">
                                <a href="/" class="navbar-link">
                                    <i class="fas fa-home"></i>
                                    <span>HOME</span>
                                </a>
                            </li>

                            <!-- CATEGORY 1: PDF TOOLS -->
                            <li class="navbar-item navbar-dropdown">
                                <button class="navbar-dropdown-btn">
                                    <i class="fas fa-file-pdf"></i> <span>PDF TOOLS</span> <i class="fas fa-chevron-down" style="font-size: 10px;"></i>
                                </button>
                                <div class="navbar-dropdown-content">
                                    <a href="/pdf-compressor"><i class="fas fa-compress"></i> KOMPRES PDF</a>
                                    <a href="/pdf-merge"><i class="fas fa-object-group"></i> GABUNG PDF</a>
                                    <a href="/pdf-split"><i class="fas fa-cut"></i> PISAH PDF</a>
                                    <a href="/pdf-rotate"><i class="fas fa-redo"></i> PUTAR PDF</a>
                                    <a href="/pdf-to-images"><i class="fas fa-images"></i> PDF KE GAMBAR</a>
                                    <a href="/pdf-to-text"><i class="fas fa-file-alt"></i> PDF KE TEKS</a>
                                    <a href="/pdf-to-long-image"><i class="fas fa-scroll"></i> PDF KE GAMBAR PANJANG</a>
                                </div>
                            </li>

                            <!-- CATEGORY 2: CONVERT & MORE -->
                            <li class="navbar-item navbar-dropdown">
                                <button class="navbar-dropdown-btn">
                                    <i class="fas fa-exchange-alt"></i> <span>KONVERSI & LAINNYA</span> <i class="fas fa-chevron-down" style="font-size: 10px;"></i>
                                </button>
                                <div class="navbar-dropdown-content">
                                    <a href="/image-to-pdf"><i class="fas fa-file-image"></i> GAMBAR KE PDF</a>
                                    <a href="/image-compressor"><i class="fas fa-image"></i> KOMPRES GAMBAR</a>
                                    <a href="/image-resizer"><i class="fas fa-expand-arrows-alt"></i> UBAH UKURAN GAMBAR</a>
                                    <a href="/image-format-converter"><i class="fas fa-sync-alt"></i> KONVERSI FORMAT GAMBAR</a>
                                    <a href="/html-to-pdf"><i class="fas fa-code"></i> HTML / RICH TEXT KE PDF</a>
                                </div>
                            </li>
                        </ul>
                    </div>
                </div>
            </nav>
        `;

        const canvas = document.getElementById('backgroundCanvas');
        if (canvas && canvas.nextSibling) {
            canvas.insertAdjacentHTML('afterend', navbarHTML);
        } else {
            document.body.insertAdjacentHTML('afterbegin', navbarHTML);
        }

        initNavbar();
        initThemeToggle();
    });

    function initNavbar() {
        const navbarToggle = document.getElementById('navbarToggle');
        const navbarMenu = document.getElementById('navbarMenu');

        if (navbarToggle && navbarMenu) {
            navbarToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                navbarToggle.classList.toggle('active');
                navbarMenu.classList.toggle('active');
            });

            document.addEventListener('click', (e) => {
                if (!e.target.closest('.navbar-container')) {
                    navbarToggle.classList.remove('active');
                    navbarMenu.classList.remove('active');
                }
            });
        }

        const currentPath = window.location.pathname;
        const normalizedPath = currentPath.replace(/\.html$/, '').replace(/\/$/, '') || '/';

        document.querySelectorAll('.navbar-link, .navbar-dropdown-content a').forEach(link => {
            const href = link.getAttribute('href');
            const normalizedHref = href ? (href.replace(/\/$/, '') || '/') : '';

            if (normalizedPath === normalizedHref) {
                link.classList.add('active');
                const parentDropdown = link.closest('.navbar-dropdown');
                if (parentDropdown) {
                    const dropdownBtn = parentDropdown.querySelector('.navbar-dropdown-btn');
                    if (dropdownBtn) dropdownBtn.classList.add('active');
                }
            }

            link.addEventListener('click', () => {
                if (navbarToggle && navbarMenu) {
                    navbarToggle.classList.remove('active');
                    navbarMenu.classList.remove('active');
                }
            });
        });
    }

    function initThemeToggle() {
        const themeBtn = document.getElementById('themeToggleBtn');
        if (!themeBtn) return;

        themeBtn.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme');
            let newTheme = 'dark';
            
            if (currentTheme === 'dark') {
                newTheme = 'light';
                document.documentElement.removeAttribute('data-theme');
            } else {
                document.documentElement.setAttribute('data-theme', 'dark');
            }

            localStorage.setItem('theme', newTheme);

            const icon = themeBtn.querySelector('i');
            const label = themeBtn.querySelector('.theme-label');
            if (icon && label) {
                if (newTheme === 'dark') {
                    icon.className = 'fas fa-sun';
                    label.textContent = 'LIGHT';
                } else {
                    icon.className = 'fas fa-moon';
                    label.textContent = 'DARK';
                }
            }

            window.dispatchEvent(new CustomEvent('theme:changed', { detail: { theme: newTheme } }));
            if (window.Toast) {
                window.Toast.info(`Mode tema diubah ke ${newTheme.toUpperCase()}`);
            }
        });
    }
})();