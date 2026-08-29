// js/shared/pwa.js - Service Worker Registration & PWA install handling

(function() {
    'use strict';

    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js')
                .then((registration) => {
                    console.log('✅ ServiceWorker registered with scope:', registration.scope);
                })
                .catch((error) => {
                    console.warn('❌ ServiceWorker registration failed:', error);
                });
        });
    }

    let deferredPrompt;
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        showInstallPromotion();
    });

    function showInstallPromotion() {
        const installBtn = document.getElementById('pwaInstallBtn');
        if (installBtn) {
            installBtn.style.display = 'inline-flex';
            installBtn.addEventListener('click', async () => {
                if (deferredPrompt) {
                    deferredPrompt.prompt();
                    const { outcome } = await deferredPrompt.userChoice;
                    console.log(`User response to install prompt: ${outcome}`);
                    deferredPrompt = null;
                    installBtn.style.display = 'none';
                }
            });
        }
    }
})();
