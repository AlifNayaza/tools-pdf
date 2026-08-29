/**
 * Neo-Brutalist Toast Notification System
 * Drop-in replacement for browser alert() with guaranteed inline styles
 */

(function() {
    'use strict';

    class ToastManager {
        constructor() {
            this.container = null;
            this.init();
        }

        init() {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => this.createContainer());
            } else {
                this.createContainer();
            }
        }

        createContainer() {
            if (!this.container) {
                let existing = document.getElementById('toast-container');
                if (existing) {
                    this.container = existing;
                } else {
                    this.container = document.createElement('div');
                    this.container.id = 'toast-container';
                    this.container.className = 'toast-container';
                    document.body.appendChild(this.container);
                }
            }

            if (this.container) {
                this.container.style.cssText = `
                    position: fixed !important;
                    top: 84px !important;
                    right: 20px !important;
                    z-index: 999999 !important;
                    display: flex !important;
                    flex-direction: column !important;
                    gap: 10px !important;
                    width: 360px !important;
                    max-width: calc(100vw - 32px) !important;
                    pointer-events: none !important;
                    box-sizing: border-box !important;
                `;
            }
        }

        show(message, type = 'info', duration = 4000) {
            this.createContainer();

            const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

            let iconClass = 'fa-info-circle';
            let iconColor = '#0088cc';
            let borderAccent = '#00f0ff';

            if (type === 'success') {
                iconClass = 'fa-check-circle';
                iconColor = '#28a745';
                borderAccent = '#8fff00';
            } else if (type === 'error') {
                iconClass = 'fa-exclamation-triangle';
                iconColor = '#ff006e';
                borderAccent = '#ff006e';
            } else if (type === 'warning') {
                iconClass = 'fa-exclamation-circle';
                iconColor = '#ff5c00';
                borderAccent = '#ffea00';
            }

            const toast = document.createElement('div');
            toast.className = `toast-item toast-${type}`;
            toast.style.cssText = `
                pointer-events: auto !important;
                display: flex !important;
                flex-direction: row !important;
                align-items: center !important;
                justify-content: space-between !important;
                gap: 12px !important;
                padding: 14px 16px !important;
                width: 100% !important;
                box-sizing: border-box !important;
                background: ${isDark ? '#1e293b' : '#ffffff'} !important;
                color: ${isDark ? '#f8fafc' : '#000000'} !important;
                border: 3px solid ${isDark ? '#00f0ff' : '#000000'} !important;
                border-left: 8px solid ${borderAccent} !important;
                box-shadow: 6px 6px 0px ${isDark ? '#00f0ff' : '#000000'} !important;
                font-family: 'DM Sans', sans-serif !important;
                font-weight: 700 !important;
                font-size: 0.9rem !important;
                transition: all 0.2s ease !important;
            `;

            toast.innerHTML = `
                <div class="toast-icon" style="font-size: 1.4rem; color: ${iconColor}; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0;"><i class="fas ${iconClass}"></i></div>
                <div class="toast-message" style="flex: 1 1 auto; min-width: 0; width: auto; max-width: 100%; line-height: 1.4; word-wrap: break-word; overflow-wrap: anywhere; white-space: normal; color: ${isDark ? '#f8fafc' : '#000000'}; font-family: sans-serif;">${this.escapeHTML(message)}</div>
                <span class="toast-close" role="button" aria-label="Close" style="background: transparent !important; border: none !important; box-shadow: none !important; width: auto !important; height: auto !important; font-size: 1.4rem !important; font-weight: bold !important; cursor: pointer !important; color: ${isDark ? '#f8fafc' : '#000000'} !important; padding: 0 4px !important; margin: 0 !important; flex-shrink: 0 !important; line-height: 1 !important; display: inline-block !important;">&times;</span>
            `;

            const closeBtn = toast.querySelector('.toast-close');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => this.dismiss(toast));
            }

            this.container.appendChild(toast);

            if (duration > 0) {
                setTimeout(() => {
                    this.dismiss(toast);
                }, duration);
            }

            return toast;
        }

        dismiss(toast) {
            if (!toast || toast.classList.contains('toast-hiding')) return;
            toast.classList.add('toast-hiding');
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }

        success(message, duration) { return this.show(message, 'success', duration); }
        error(message, duration) { return this.show(message, 'error', duration); }
        warning(message, duration) { return this.show(message, 'warning', duration); }
        info(message, duration) { return this.show(message, 'info', duration); }

        escapeHTML(str) {
            if (typeof str !== 'string') return str;
            return str.replace(/[&<>'"]/g, 
                tag => ({
                    '&': '&amp;',
                    '<': '&lt;',
                    '>': '&gt;',
                    "'": '&#39;',
                    '"': '&quot;'
                }[tag] || tag)
            );
        }
    }

    const toastManager = new ToastManager();
    window.Toast = toastManager;
    window.showToast = (msg, type, dur) => toastManager.show(msg, type, dur);
})();
