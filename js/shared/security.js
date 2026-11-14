/**
 * Security Library - Proteksi terhadap serangan cyber
 * Load script ini SEBELUM script lainnya di semua halaman
 */

class SecurityManager {
    constructor() {
        this.init();
    }

    init() {
        this.setupCSRFProtection();
        this.sanitizeInputs();
        this.ratelimitRequests();
        this.secureFileUpload();
        this.preventClickjacking();
    }

    // 1. CSRF Protection
    setupCSRFProtection() {
        if (!sessionStorage.getItem('csrf_token')) {
            const token = this.generateToken();
            sessionStorage.setItem('csrf_token', token);
        }
    }

    generateToken() {
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    }

    getCSRFToken() {
        return sessionStorage.getItem('csrf_token');
    }

    // 2. Input Sanitization (Skip file, range, checkbox, radio inputs to prevent DOM errors)
    sanitizeInputs() {
        document.addEventListener('input', (e) => {
            const target = e.target;
            if (!target) return;
            if (target.tagName === 'INPUT') {
                const type = (target.type || '').toLowerCase();
                if (['file', 'checkbox', 'radio', 'range', 'hidden', 'button', 'submit'].includes(type)) {
                    return;
                }
                target.value = this.sanitizeString(target.value);
            } else if (target.tagName === 'TEXTAREA') {
                // Textarea sanitization if needed
            }
        });
    }

    sanitizeString(str) {
        if (typeof str !== 'string') return '';
        const map = {
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#x27;',
        };
        return str.replace(/[<>"']/g, char => map[char] || char);
    }

    // 3. Rate Limiting
    ratelimitRequests() {
        this.requestCounts = new Map();
        this.maxRequests = 100;
        this.timeWindow = 60000;

        const originalFetch = window.fetch;
        window.fetch = (...args) => {
            if (!this.checkRateLimit()) {
                return Promise.reject(new Error('Rate limit exceeded'));
            }
            return originalFetch.apply(window, args);
        };
    }

    checkRateLimit() {
        const now = Date.now();
        const minuteAgo = now - this.timeWindow;
        
        for (const [timestamp] of this.requestCounts) {
            if (timestamp < minuteAgo) {
                this.requestCounts.delete(timestamp);
            }
        }
        
        if (this.requestCounts.size >= this.maxRequests) {
            console.warn('Rate limit exceeded');
            return false;
        }
        
        this.requestCounts.set(now, true);
        return true;
    }

    // 4. File Upload Security
    secureFileUpload() {
        document.addEventListener('change', (e) => {
            if (e.target && e.target.type === 'file') {
                const files = e.target.files;
                if (!files || files.length === 0) return;

                for (let file of files) {
                    if (!this.validateFile(file)) {
                        if (window.Toast) {
                            window.Toast.error(`File "${file.name}" tidak diizinkan atau tidak valid!`);
                        } else {
                            alert(`File "${file.name}" tidak diizinkan atau tidak valid!`);
                        }
                        try {
                            e.target.value = ''; // Clear file input on invalid file
                        } catch (err) {}
                        break;
                    }
                }
            }
        });
    }

    validateFile(file) {
        if (!file) return false;

        // Validasi ukuran (max 100MB)
        const maxSize = 100 * 1024 * 1024;
        if (file.size > maxSize) {
            console.error('File terlalu besar');
            return false;
        }

        // Validasi ekstensi file
        const allowedExtensions = [
            '.pdf', '.jpg', '.jpeg', '.png', '.webp', '.svg', 
            '.docx', '.txt', '.xlsx', '.xls', '.csv'
        ];

        const nameLower = file.name.toLowerCase();
        const hasValidExt = allowedExtensions.some(ext => nameLower.endsWith(ext));

        if (!hasValidExt) {
            console.error('Ekstensi file tidak diizinkan:', file.name);
            return false;
        }

        // Validasi nama file (prevent path traversal)
        if (file.name.includes('..') || file.name.includes('/') || file.name.includes('\\')) {
            console.error('Nama file tidak valid');
            return false;
        }

        return true;
    }

    // 5. Clickjacking Prevention
    preventClickjacking() {
        if (window.self !== window.top) {
            window.top.location = window.self.location;
        }
    }

    // 7. Global Clipboard Paste Support (Ctrl+V for images and files)
    setupClipboardPasteHandler() {
        window.addEventListener('paste', (e) => {
            if (!e.clipboardData || !e.clipboardData.items) return;
            
            // Ignore if active element is text input/textarea
            const activeTag = (document.activeElement && document.activeElement.tagName) || '';
            if (activeTag === 'TEXTAREA' || (activeTag === 'INPUT' && ['text', 'number', 'search'].includes(document.activeElement.type))) {
                return;
            }

            const items = e.clipboardData.items;
            const files = [];

            for (let i = 0; i < items.length; i++) {
                if (items[i].kind === 'file') {
                    const file = items[i].getAsFile();
                    if (file) files.push(file);
                }
            }

            if (files.length === 0) return;

            // Look for file input on active page
            const fileInput = document.querySelector('input[type="file"]');
            if (fileInput) {
                try {
                    const dataTransfer = new DataTransfer();
                    files.forEach(f => dataTransfer.items.add(f));
                    fileInput.files = dataTransfer.files;
                    fileInput.dispatchEvent(new Event('change', { bubbles: true }));
                    if (window.Toast) window.Toast.success(`${files.length} file berhasil dimuat dari clipboard.`);
                } catch (err) {
                    console.warn('Clipboard paste handling fallback:', err);
                }
            }
        });
    }
}

// Initialize Security Manager
const security = new SecurityManager();
security.setupClipboardPasteHandler();
window.SecurityManager = security;

console.log('%c🔐 Security Manager & Clipboard Handler Initialized', 'color: #00f0ff; font-weight: bold; font-size: 13px;');