// js/shared/navbar.js - navbar 12 alat dengan 3 kategori (Edit PDF, Konversi, Gambar).
// Aksesibel: skip link, disclosure menu (aria-expanded), navigasi keyboard, aria-current,
// focus trap + kunci scroll pada menu mobile, dan tombol tema dengan label jelas.

(function () {
    'use strict';

    // Terapkan tema tersimpan sebelum render agar tidak berkedip
    let savedTheme = 'light';
    try { savedTheme = localStorage.getItem('theme') || 'light'; } catch (e) { /* abaikan */ }
    if (savedTheme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
    } else {
        document.documentElement.removeAttribute('data-theme');
    }

    const MOBILE_QUERY = '(max-width: 900px)';

    const GROUPS = [
        {
            id: 'edit', icon: 'fa-file-pdf', label: 'Edit PDF',
            items: [
                ['/pdf-compressor', 'fa-compress', 'Kompres PDF'],
                ['/pdf-merge', 'fa-object-group', 'Gabung PDF'],
                ['/pdf-split', 'fa-cut', 'Pisah PDF'],
                ['/pdf-rotate', 'fa-redo', 'Putar PDF']
            ]
        },
        {
            id: 'konversi', icon: 'fa-exchange-alt', label: 'Konversi',
            items: [
                ['/pdf-to-word', 'fa-file-word', 'PDF ke Word'],
                ['/pdf-to-images', 'fa-images', 'PDF ke Gambar'],
                ['/pdf-to-long-image', 'fa-scroll', 'PDF ke Gambar Panjang'],
                ['/pdf-to-text', 'fa-file-alt', 'PDF ke Teks'],
                ['/image-to-pdf', 'fa-file-image', 'Gambar ke PDF'],
                ['/html-to-pdf', 'fa-code', 'HTML ke PDF'],
                ['/image-format-converter', 'fa-sync-alt', 'Konversi Format Gambar']
            ]
        },
        {
            id: 'gambar', icon: 'fa-image', label: 'Gambar',
            items: [
                ['/image-compressor', 'fa-compress-arrows-alt', 'Kompres Gambar'],
                ['/image-resizer', 'fa-expand-arrows-alt', 'Ubah Ukuran Gambar'],
                ['/image-format-converter', 'fa-sync-alt', 'Konversi Format Gambar']
            ]
        }
    ];

    function currentPath() {
        return window.location.pathname.replace(/index\.html$/, '').replace(/\.html$/, '').replace(/\/$/, '') || '/';
    }

    function themeLabel(isDark) {
        return isDark ? 'Mode terang' : 'Mode gelap';
    }

    function buildNavbar(isDark) {
        const groups = GROUPS.map(g => `
                            <li class="navbar-item navbar-dropdown" data-group="${g.id}">
                                <button type="button" class="navbar-dropdown-btn" aria-expanded="false" aria-controls="navmenu-${g.id}">
                                    <i class="fas ${g.icon}" aria-hidden="true"></i>
                                    <span>${g.label}</span>
                                    <i class="fas fa-chevron-down navbar-chevron" aria-hidden="true"></i>
                                </button>
                                <ul class="navbar-dropdown-content" id="navmenu-${g.id}">
                                    ${g.items.map(([href, icon, text]) =>
                                        `<li><a href="${href}"><i class="fas ${icon}" aria-hidden="true"></i> <span>${text}</span></a></li>`).join('')}
                                </ul>
                            </li>`).join('');

        return `
        <a class="skip-link" href="#main-content">Lewati ke konten utama</a>
        <header class="site-header">
            <nav class="navbar" aria-label="Navigasi utama">
                <div class="navbar-container">
                    <a href="/" class="navbar-logo" aria-label="Tools PDF dan Gambar, ke beranda">
                        <span class="navbar-logo-icon" aria-hidden="true"><i class="fas fa-bolt"></i></span>
                        <span>TOOLS</span>
                    </a>

                    <div class="navbar-right">
                        <ul class="navbar-menu" id="navbarMenu">
                            <li class="navbar-item">
                                <a href="/" class="navbar-link"><i class="fas fa-home" aria-hidden="true"></i> <span>Beranda</span></a>
                            </li>${groups}
                        </ul>

                        <div class="navbar-actions">
                            <button type="button" id="pwaInstallBtn" class="pwa-install-btn">
                                <i class="fas fa-download" aria-hidden="true"></i> <span class="nav-label">Pasang aplikasi</span>
                            </button>
                            <button type="button" id="themeToggleBtn" class="theme-toggle-btn">
                                <i class="fas ${isDark ? 'fa-sun' : 'fa-moon'}" aria-hidden="true"></i>
                                <span class="nav-label theme-label">${themeLabel(isDark)}</span>
                            </button>
                            <button type="button" class="navbar-toggle" id="navbarToggle"
                                    aria-label="Buka menu navigasi" aria-expanded="false" aria-controls="navbarMenu">
                                <span></span><span></span><span></span>
                            </button>
                        </div>
                    </div>
                </div>
            </nav>
        </header>`;
    }

    document.addEventListener('DOMContentLoaded', function () {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

        const canvas = document.getElementById('backgroundCanvas');
        if (canvas) canvas.setAttribute('aria-hidden', 'true');

        if (canvas && canvas.nextSibling) {
            canvas.insertAdjacentHTML('afterend', buildNavbar(isDark));
        } else {
            document.body.insertAdjacentHTML('afterbegin', buildNavbar(isDark));
        }

        // Target skip link: elemen <main> pertama (atau konten utama beranda)
        const main = document.getElementById('main-content') || document.querySelector('main');
        if (main) {
            if (!main.id) main.id = 'main-content';
            if (!main.hasAttribute('tabindex')) main.setAttribute('tabindex', '-1');
        }

        initNavbar();
        initThemeToggle();
    });

    function initNavbar() {
        const nav = document.querySelector('.navbar');
        const toggle = document.getElementById('navbarToggle');
        const menu = document.getElementById('navbarMenu');
        const dropdowns = Array.from(document.querySelectorAll('.navbar-dropdown'));
        const mobile = window.matchMedia(MOBILE_QUERY);
        const hoverCapable = window.matchMedia('(hover: hover) and (pointer: fine)');
        if (!nav || !toggle || !menu) return;

        // ---- Tandai halaman aktif ----
        const path = currentPath();
        nav.querySelectorAll('.navbar-link, .navbar-dropdown-content a').forEach(link => {
            const href = (link.getAttribute('href') || '').replace(/\/$/, '') || '/';
            if (href === path) {
                link.setAttribute('aria-current', 'page');
                const dd = link.closest('.navbar-dropdown');
                if (dd) dd.querySelector('.navbar-dropdown-btn').classList.add('active');
            }
        });

        // ---- Dropdown ----
        function setDropdown(dd, open) {
            dd.classList.toggle('open', open);
            dd.querySelector('.navbar-dropdown-btn').setAttribute('aria-expanded', String(open));
        }

        function closeDropdowns(except) {
            dropdowns.forEach(dd => { if (dd !== except) setDropdown(dd, false); });
        }

        dropdowns.forEach(dd => {
            const btn = dd.querySelector('.navbar-dropdown-btn');
            const links = () => Array.from(dd.querySelectorAll('.navbar-dropdown-content a'));
            let hoverTimer;

            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const willOpen = !dd.classList.contains('open');
                closeDropdowns(dd);
                setDropdown(dd, willOpen);
            });

            btn.addEventListener('keydown', (e) => {
                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    closeDropdowns(dd);
                    setDropdown(dd, true);
                    links()[0].focus();
                } else if (e.key === 'Escape' && dd.classList.contains('open')) {
                    e.stopPropagation();
                    setDropdown(dd, false);
                }
            });

            dd.querySelector('.navbar-dropdown-content').addEventListener('keydown', (e) => {
                const items = links();
                const i = items.indexOf(document.activeElement);
                if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length].focus(); }
                else if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
                else if (e.key === 'Home') { e.preventDefault(); items[0].focus(); }
                else if (e.key === 'End') { e.preventDefault(); items[items.length - 1].focus(); }
                else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setDropdown(dd, false); btn.focus(); }
            });

            // Buka saat hover (hanya mouse di desktop)
            dd.addEventListener('mouseenter', () => {
                if (mobile.matches || !hoverCapable.matches) return;
                clearTimeout(hoverTimer);
                closeDropdowns(dd);
                setDropdown(dd, true);
            });
            dd.addEventListener('mouseleave', () => {
                if (mobile.matches || !hoverCapable.matches) return;
                hoverTimer = setTimeout(() => setDropdown(dd, false), 150);
            });

            // Tutup saat fokus keluar dari grup
            dd.addEventListener('focusout', (e) => {
                if (!e.relatedTarget || !dd.contains(e.relatedTarget)) setDropdown(dd, false);
            });
        });

        document.addEventListener('click', (e) => {
            if (!e.target.closest('.navbar-dropdown')) closeDropdowns();
            if (!e.target.closest('.navbar')) setMenu(false);
        });

        // ---- Menu mobile ----
        function setMenu(open, returnFocus) {
            const isOpen = menu.classList.contains('active');
            if (open === isOpen) return;
            menu.classList.toggle('active', open);
            toggle.setAttribute('aria-expanded', String(open));
            toggle.setAttribute('aria-label', open ? 'Tutup menu navigasi' : 'Buka menu navigasi');
            document.documentElement.classList.toggle('nav-open', open);
            if (!open) {
                closeDropdowns();
                if (returnFocus) toggle.focus();
            }
        }

        function onBreakpointChange() {
            // Pindah ke layout desktop: pastikan keadaan menu mobile bersih
            if (!mobile.matches) setMenu(false);
        }

        toggle.addEventListener('click', (e) => {
            e.stopPropagation();
            const willOpen = !menu.classList.contains('active');
            setMenu(willOpen);
            if (willOpen) {
                const first = menu.querySelector('a, button');
                if (first) first.focus();
            }
        });

        menu.addEventListener('click', (e) => {
            if (e.target.closest('a')) setMenu(false);
        });

        // Escape menutup menu; Tab dikunci di dalam navbar selama menu mobile terbuka
        document.addEventListener('keydown', (e) => {
            if (!menu.classList.contains('active')) return;
            if (e.key === 'Escape') {
                setMenu(false, true);
                return;
            }
            if (e.key === 'Tab') {
                const focusables = Array.from(nav.querySelectorAll('a[href], button:not([disabled])'))
                    .filter(el => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden');
                if (!focusables.length) return;
                const first = focusables[0];
                const last = focusables[focusables.length - 1];
                if (e.shiftKey && document.activeElement === first) {
                    e.preventDefault();
                    last.focus();
                } else if (!e.shiftKey && document.activeElement === last) {
                    e.preventDefault();
                    first.focus();
                }
            }
        });

        if (mobile.addEventListener) mobile.addEventListener('change', onBreakpointChange);
        else if (mobile.addListener) mobile.addListener(onBreakpointChange);
    }

    function initThemeToggle() {
        const themeBtn = document.getElementById('themeToggleBtn');
        if (!themeBtn) return;

        themeBtn.addEventListener('click', () => {
            const wasDark = document.documentElement.getAttribute('data-theme') === 'dark';
            const newTheme = wasDark ? 'light' : 'dark';

            if (wasDark) document.documentElement.removeAttribute('data-theme');
            else document.documentElement.setAttribute('data-theme', 'dark');

            try { localStorage.setItem('theme', newTheme); } catch (e) { /* abaikan */ }

            const icon = themeBtn.querySelector('i');
            const label = themeBtn.querySelector('.theme-label');
            if (icon) icon.className = `fas ${newTheme === 'dark' ? 'fa-sun' : 'fa-moon'}`;
            if (label) label.textContent = themeLabel(newTheme === 'dark');

            window.dispatchEvent(new CustomEvent('theme:changed', { detail: { theme: newTheme } }));
            if (window.Toast) {
                window.Toast.info(newTheme === 'dark' ? 'Mode gelap aktif' : 'Mode terang aktif');
            }
        });
    }
})();
