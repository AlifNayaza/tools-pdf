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
        this.preventXSS();
        this.ratelimitRequests();
        this.secureFileUpload();
        this.preventClickjacking();
        this.sanitizeDOM();
    }

    // 1. CSRF Protection
    setupCSRFProtection() {
        // Generate CSRF token
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

    // 2. Input Sanitization
    sanitizeInputs() {
        document.addEventListener('input', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                e.target.value = this.sanitizeString(e.target.value);
            }
        });
    }

    sanitizeString(str) {
        if (typeof str !== 'string') return '';
        
        // Remove dangerous characters
        const map = {
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#x27;',
            '/': '&#x2F;',
        };
        
        return str.replace(/[<>"'/]/g, char => map[char] || char);
    }

    // 3. XSS Prevention
    preventXSS() {
        // Override innerHTML untuk auto-sanitize
        const originalInnerHTML = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
        
        Object.defineProperty(Element.prototype, 'innerHTML', {
            set: function(value) {
                const sanitized = this.sanitizeHTML(value);
                originalInnerHTML.set.call(this, sanitized);
            }.bind(this),
            get: originalInnerHTML.get
        });
    }

    sanitizeHTML(html) {
        if (typeof html !== 'string') return '';
        
        const temp = document.createElement('div');
        temp.textContent = html;
        return temp.innerHTML;
    }

    // 4. Rate Limiting
    ratelimitRequests() {
        this.requestCounts = new Map();
        this.maxRequests = 100; // Max 100 requests per minute
        this.timeWindow = 60000; // 1 minute

        // Intercept fetch
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
        
        // Clean old entries
        for (const [timestamp] of this.requestCounts) {
            if (timestamp < minuteAgo) {
                this.requestCounts.delete(timestamp);
            }
        }
        
        // Check limit
        if (this.requestCounts.size >= this.maxRequests) {
            console.warn('Rate limit exceeded');
            return false;
        }
        
        this.requestCounts.set(now, true);
        return true;
    }

    // 5. File Upload Security
    secureFileUpload() {
        document.addEventListener('change', (e) => {
            if (e.target.type === 'file') {
                const files = e.target.files;
                for (let file of files) {
                    if (!this.validateFile(file)) {
                        e.target.value = '';
                        alert('File tidak aman atau tidak valid!');
                        return;
                    }
                }
            }
        });
    }

    validateFile(file) {
        // Validasi ukuran (max 100MB)
        const maxSize = 100 * 1024 * 1024;
        if (file.size > maxSize) {
            console.error('File terlalu besar');
            return false;
        }

        // Validasi tipe file
        const allowedTypes = [
            'application/pdf',
            'image/jpeg',
            'image/jpg',
            'image/png'
        ];

        if (!allowedTypes.includes(file.type)) {
            console.error('Tipe file tidak diizinkan');
            return false;
        }

        // Validasi ekstensi file
        const allowedExtensions = ['.pdf', '.jpg', '.jpeg', '.png'];
        const extension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
        
        if (!allowedExtensions.includes(extension)) {
            console.error('Ekstensi file tidak diizinkan');
            return false;
        }

        // Validasi nama file (prevent path traversal)
        if (file.name.includes('..') || file.name.includes('/') || file.name.includes('\\')) {
            console.error('Nama file tidak valid');
            return false;
        }

        return true;
    }

    // 6. Clickjacking Prevention
    preventClickjacking() {
        if (window.self !== window.top) {
            window.top.location = window.self.location;
        }
    }

    // 7. DOM Sanitization
    sanitizeDOM() {
        // Scan dan hapus script tags yang mencurigakan
        setInterval(() => {
            const scripts = document.querySelectorAll('script:not([src])');
            scripts.forEach(script => {
                if (!script.hasAttribute('data-safe')) {
                    console.warn('Suspicious script detected', script);
                    // Optional: script.remove();
                }
            });
        }, 5000);
    }

    // 8. Safe URL Validation
    isValidURL(url) {
        try {
            const parsed = new URL(url);
            const allowedProtocols = ['http:', 'https:'];
            
            if (!allowedProtocols.includes(parsed.protocol)) {
                return false;
            }

            // Prevent SSRF
            const hostname = parsed.hostname.toLowerCase();
            const blockedHosts = [
                'localhost',
                '127.0.0.1',
                '0.0.0.0',
                '169.254.169.254', // AWS metadata
                '::1'
            ];

            if (blockedHosts.includes(hostname)) {
                return false;
            }

            return true;
        } catch (e) {
            return false;
        }
    }

    // 9. Secure Random Generator
    secureRandom(min, max) {
        const range = max - min;
        const array = new Uint32Array(1);
        crypto.getRandomValues(array);
        return min + (array[0] % range);
    }

    // 10. Memory Cleanup
    secureCleanup(data) {
        if (typeof data === 'string') {
            // Overwrite string data
            data = '\0'.repeat(data.length);
        } else if (data instanceof ArrayBuffer) {
            const view = new Uint8Array(data);
            view.fill(0);
        }
    }
}

// Initialize Security Manager
const security = new SecurityManager();

// Export untuk digunakan di file lain
window.SecurityManager = security;

// Log security initialization
console.log('%c🔐 Security Manager Initialized', 'color: #00ff00; font-weight: bold; font-size: 14px;');
console.log('%c⚠️ Jangan paste kode yang tidak dikenal di console!', 'color: #ff0000; font-weight: bold; font-size: 16px;');

// Prevent console manipulation attacks
(function() {
    const noop = () => {};
    
    // Backup original console methods
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;
    
    // Add warning for suspicious console usage
    let consoleWarningShown = false;
    
    ['log', 'warn', 'error', 'info', 'debug'].forEach(method => {
        const original = console[method];
        console[method] = function(...args) {
            // Check for suspicious patterns
            const suspicious = args.some(arg => 
                typeof arg === 'string' && (
                    arg.includes('eval(') ||
                    arg.includes('Function(') ||
                    arg.includes('document.cookie')
                )
            );
            
            if (suspicious && !consoleWarningShown) {
                originalWarn.call(console, '⚠️ PERINGATAN KEAMANAN: Aktivitas mencurigakan terdeteksi!');
                consoleWarningShown = true;
            }
            
            return original.apply(console, args);
        };
    });
})();