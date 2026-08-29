/**
 * Standalone File Validator
 * Load this BEFORE other scripts that need validation
 */

(function() {
    'use strict';
    
    class FileValidator {
        constructor() {
            // Magic bytes untuk validasi tipe file
            this.magicBytes = {
                pdf: [0x25, 0x50, 0x44, 0x46], // %PDF
                jpg: [0xFF, 0xD8, 0xFF],
                png: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]
            };

            this.maxFileSize = 100 * 1024 * 1024; // 100MB
        }

        /**
         * Validasi file secara mendalam
         */
        async validateFile(file) {
            const errors = [];

            // 1. Basic validation
            if (!file || !(file instanceof File)) {
                errors.push('File tidak valid');
                return { valid: false, errors };
            }

            // 2. File size validation
            if (file.size > this.maxFileSize) {
                errors.push(`Ukuran file terlalu besar (max ${this.formatBytes(this.maxFileSize)})`);
            }

            if (file.size === 0) {
                errors.push('File kosong');
            }

            // 3. File name validation
            if (!this.validateFileName(file.name)) {
                errors.push('Nama file tidak valid atau mengandung karakter berbahaya');
            }

            // 4. MIME type validation
            if (!this.validateMimeType(file.type)) {
                errors.push('Tipe file tidak diizinkan');
            }

            // 5. Magic bytes validation (deep check)
            try {
                const isValidMagicBytes = await this.validateMagicBytes(file);
                if (!isValidMagicBytes) {
                    errors.push('File tidak sesuai dengan tipe yang dideklarasikan');
                }
            } catch (e) {
                // Non-critical, skip
            }

            return {
                valid: errors.length === 0,
                errors: errors,
                fileInfo: {
                    name: file.name,
                    size: file.size,
                    type: file.type,
                    lastModified: new Date(file.lastModified)
                }
            };
        }

        /**
         * Validasi nama file
         */
        validateFileName(fileName) {
            if (fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
                return false;
            }

            if (fileName.includes('\0')) {
                return false;
            }

            const validPattern = /^[a-zA-Z0-9._\- ]+$/;
            if (!validPattern.test(fileName)) {
                return false;
            }

            const allowedExtensions = ['.pdf', '.jpg', '.jpeg', '.png'];
            const extension = fileName.toLowerCase().substring(fileName.lastIndexOf('.'));
            
            if (!allowedExtensions.includes(extension)) {
                return false;
            }

            return true;
        }

        /**
         * Validasi MIME type
         */
        validateMimeType(mimeType) {
            const allowedTypes = [
                'application/pdf',
                'image/jpeg',
                'image/jpg',
                'image/png'
            ];

            return allowedTypes.includes(mimeType.toLowerCase());
        }

        /**
         * Validasi magic bytes (file signature)
         */
        async validateMagicBytes(file) {
            try {
                const blob = file.slice(0, 8);
                const arrayBuffer = await blob.arrayBuffer();
                const bytes = new Uint8Array(arrayBuffer);

                const extension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));

                if (extension === '.pdf') {
                    return this.checkMagicBytes(bytes, this.magicBytes.pdf);
                } else if (extension === '.jpg' || extension === '.jpeg') {
                    return this.checkMagicBytes(bytes, this.magicBytes.jpg);
                } else if (extension === '.png') {
                    return this.checkMagicBytes(bytes, this.magicBytes.png);
                }

                return false;
            } catch (e) {
                return true; // Allow if check fails
            }
        }

        checkMagicBytes(fileBytes, expectedBytes) {
            for (let i = 0; i < expectedBytes.length; i++) {
                if (fileBytes[i] !== expectedBytes[i]) {
                    return false;
                }
            }
            return true;
        }

        /**
         * Sanitize file name
         */
        sanitizeFileName(fileName) {
            let sanitized = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
            
            const extension = sanitized.toLowerCase().substring(sanitized.lastIndexOf('.'));
            const allowedExtensions = ['.pdf', '.jpg', '.jpeg', '.png'];
            
            if (!allowedExtensions.includes(extension)) {
                sanitized += '.safe';
            }

            return sanitized;
        }

        /**
         * Format bytes untuk display
         */
        formatBytes(bytes, decimals = 2) {
            if (bytes === 0) return '0 Bytes';
            const k = 1024;
            const dm = decimals < 0 ? 0 : decimals;
            const sizes = ['Bytes', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
        }

        /**
         * Validate multiple files
         */
        async validateFiles(files) {
            const results = [];
            const totalSize = Array.from(files).reduce((sum, file) => sum + file.size, 0);

            if (totalSize > this.maxFileSize) {
                return {
                    valid: false,
                    errors: ['Total ukuran file melebihi batas maksimum'],
                    results: []
                };
            }

            for (const file of files) {
                const result = await this.validateFile(file);
                results.push({
                    file: file,
                    ...result
                });
            }

            const allValid = results.every(r => r.valid);
            const allErrors = results.flatMap(r => r.errors);

            return {
                valid: allValid,
                errors: allErrors,
                results: results
            };
        }
    }

    // Export to global scope immediately
    window.FileValidator = new FileValidator();
    
    // Also dispatch ready event
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            window.dispatchEvent(new CustomEvent('filevalidator:ready'));
        });
    } else {
        window.dispatchEvent(new CustomEvent('filevalidator:ready'));
    }

})();