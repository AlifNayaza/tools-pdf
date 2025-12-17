// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.10.377/pdf.worker.min.js';

const pdfFileInput = document.getElementById('pdfFile');
const dropArea = document.getElementById('dropArea');
const qualityInput = document.getElementById('quality');
const qualityValueSpan = document.getElementById('qualityValue');
const compressBtn = document.getElementById('compressBtn');
const statusP = document.getElementById('status');
const progressBarFill = document.getElementById('progressBarFill');
const downloadLink = document.getElementById('downloadLink');

const step2Div = document.getElementById('step2');
const fileInfoDiv = document.getElementById('fileInfo');
const progressContainer = document.getElementById('progressContainer');
const resultInfoDiv = document.getElementById('resultInfo');

const fileNameSpan = document.getElementById('fileName');
const fileSizeSpan = document.getElementById('fileSize');
const filePagesSpan = document.getElementById('filePages');
const originalSizeSpan = document.getElementById('originalSize');
const newSizeSpan = document.getElementById('newSize');
const sizeSavingsSpan = document.getElementById('sizeSavings');

let originalFile = null;
const MAX_FILE_SIZE = 100 * 1024 * 1024;

// Wait for FileValidator to load
let fileValidatorReady = false;

function waitForFileValidator() {
    return new Promise((resolve) => {
        if (window.FileValidator) {
            fileValidatorReady = true;
            resolve();
            return;
        }
        
        const checkInterval = setInterval(() => {
            if (window.FileValidator) {
                fileValidatorReady = true;
                clearInterval(checkInterval);
                resolve();
            }
        }, 100);
        
        setTimeout(() => {
            clearInterval(checkInterval);
            resolve();
        }, 5000);
    });
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    await waitForFileValidator();
});

function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function resetUI() {
    step2Div.style.display = 'none';
    compressBtn.style.display = 'none';
    fileInfoDiv.style.display = 'none';
    progressContainer.style.display = 'none';
    resultInfoDiv.style.display = 'none';
    compressBtn.disabled = false;
    progressBarFill.style.width = '0%';
}

// Basic file validation (fallback)
function basicValidateFile(file) {
    const errors = [];
    
    if (!file || !(file instanceof File)) {
        errors.push('File tidak valid');
        return { valid: false, errors };
    }
    
    if (file.type !== 'application/pdf') {
        errors.push('File harus berformat PDF');
    }
    
    if (file.size > MAX_FILE_SIZE) {
        errors.push(`Ukuran file terlalu besar (max ${formatBytes(MAX_FILE_SIZE)})`);
    }
    
    if (file.size === 0) {
        errors.push('File kosong');
    }
    
    if (file.name.includes('..') || file.name.includes('/') || file.name.includes('\\')) {
        errors.push('Nama file tidak valid');
    }
    
    return {
        valid: errors.length === 0,
        errors: errors
    };
}

async function processFile(file) {
    // Validation dengan fallback
    let validation;
    
    if (fileValidatorReady && window.FileValidator) {
        validation = await window.FileValidator.validateFile(file);
    } else {
        validation = basicValidateFile(file);
    }
    
    if (!validation.valid) {
        alert('❌ File tidak valid!\n\n' + validation.errors.join('\n'));
        pdfFileInput.value = '';
        return;
    }

    // Additional basic checks
    if (!file || file.type !== 'application/pdf') {
        alert('Silakan pilih file PDF yang valid!');
        pdfFileInput.value = '';
        return;
    }
    
    if (file.size > MAX_FILE_SIZE) {
        alert(`Ukuran file terlalu besar! Maksimal ${formatBytes(MAX_FILE_SIZE)}`);
        pdfFileInput.value = '';
        return;
    }
    
    originalFile = file;
    resetUI();

    // Sanitize filename
    let displayName = file.name;
    if (fileValidatorReady && window.FileValidator) {
        displayName = window.FileValidator.sanitizeFileName(file.name);
    }
    
    fileNameSpan.textContent = displayName;
    fileSizeSpan.textContent = formatBytes(originalFile.size);
    fileInfoDiv.style.display = 'block';
    
    step2Div.style.display = 'block';
    compressBtn.style.display = 'flex';

    const fileReader = new FileReader();
    fileReader.readAsArrayBuffer(originalFile);
    fileReader.onload = async (event) => {
        try {
            const pdfData = new Uint8Array(event.target.result);
            const pdfDoc = await pdfjsLib.getDocument({ data: pdfData }).promise;
            
            if (pdfDoc.numPages > 500) {
                alert('⚠️ PDF terlalu banyak halaman (max 500 halaman)');
                resetUI();
                return;
            }
            
            filePagesSpan.textContent = pdfDoc.numPages;
        } catch (error) {
            filePagesSpan.textContent = 'Tidak dapat membaca halaman';
        }
    };
}

// Drag and Drop Events
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropArea.addEventListener(eventName, preventDefaults, false);
});

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

['dragenter', 'dragover'].forEach(eventName => {
    dropArea.addEventListener(eventName, () => {
        dropArea.classList.add('drag-over');
    }, false);
});

['dragleave', 'drop'].forEach(eventName => {
    dropArea.addEventListener(eventName, () => {
        dropArea.classList.remove('drag-over');
    }, false);
});

dropArea.addEventListener('drop', async (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    
    if (files.length > 1) {
        alert('⚠️ Hanya bisa upload 1 file sekaligus');
        return;
    }
    
    if (files.length > 0) {
        await processFile(files[0]);
    }
}, false);

dropArea.addEventListener('click', () => {
    pdfFileInput.click();
});

pdfFileInput.addEventListener('change', async (e) => {
    if (e.target.files.length > 0) {
        await processFile(e.target.files[0]);
    }
});

qualityInput.addEventListener('input', () => {
    let value = parseFloat(qualityInput.value);
    if (isNaN(value) || value < 0.1 || value > 1.0) {
        value = 0.7;
        qualityInput.value = 0.7;
    }
    qualityValueSpan.textContent = value.toFixed(2);
});

compressBtn.addEventListener('click', async () => {
    if (!originalFile) {
        alert('Silakan pilih file terlebih dahulu!');
        return;
    }

    const quality = parseFloat(qualityInput.value);
    if (isNaN(quality) || quality < 0.1 || quality > 1.0) {
        alert('⚠️ Nilai kualitas tidak valid');
        return;
    }

    compressBtn.disabled = true;
    compressBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Mengompres...';
    progressContainer.style.display = 'block';

    try {
        const fileReader = new FileReader();
        fileReader.readAsArrayBuffer(originalFile);
        
        fileReader.onload = async (event) => {
            try {
                const pdfData = new Uint8Array(event.target.result);
                const pdfDoc = await pdfjsLib.getDocument({ data: pdfData }).promise;
                const newPdfDoc = await PDFLib.PDFDocument.create();
                const numPages = pdfDoc.numPages;

                if (numPages > 500) {
                    throw new Error('Terlalu banyak halaman');
                }

                for (let i = 1; i <= numPages; i++) {
                    const progress = (i / numPages) * 100;
                    statusP.textContent = `Memproses halaman ${i} dari ${numPages}...`;
                    progressBarFill.style.width = `${progress}%`;

                    const page = await pdfDoc.getPage(i);
                    const viewport = page.getViewport({ scale: 1.5 });
                    const canvas = document.createElement('canvas');
                    const context = canvas.getContext('2d');
                    
                    // Limit canvas size
                    const maxDimension = 4096;
                    if (viewport.width > maxDimension || viewport.height > maxDimension) {
                        const scale = Math.min(maxDimension / viewport.width, maxDimension / viewport.height);
                        const newViewport = page.getViewport({ scale: scale });
                        canvas.width = newViewport.width;
                        canvas.height = newViewport.height;
                        await page.render({ canvasContext: context, viewport: newViewport }).promise;
                    } else {
                        canvas.height = viewport.height;
                        canvas.width = viewport.width;
                        await page.render({ canvasContext: context, viewport: viewport }).promise;
                    }

                    // Convert canvas to blob directly (avoid data URL fetch)
                    const jpegBlob = await new Promise(resolve => {
                        canvas.toBlob(resolve, 'image/jpeg', quality);
                    });
                    const jpegImageBytes = await jpegBlob.arrayBuffer();
                    const jpegImage = await newPdfDoc.embedJpg(jpegImageBytes);
                    const newPage = newPdfDoc.addPage([jpegImage.width, jpegImage.height]);
                    newPage.drawImage(jpegImage, { 
                        x: 0, 
                        y: 0, 
                        width: jpegImage.width, 
                        height: jpegImage.height 
                    });

                    // Clear canvas
                    context.clearRect(0, 0, canvas.width, canvas.height);
                }

                const newPdfBytes = await newPdfDoc.save();

                progressContainer.style.display = 'none';
                resultInfoDiv.style.display = 'block';

                const originalSizeBytes = originalFile.size;
                const newSizeBytes = newPdfBytes.length;
                const savingsPercent = 100 - (newSizeBytes / originalSizeBytes * 100);

                originalSizeSpan.textContent = formatBytes(originalSizeBytes);
                newSizeSpan.textContent = formatBytes(newSizeBytes);
                sizeSavingsSpan.textContent = `${savingsPercent.toFixed(2)}%`;

                // Sanitize filename
                let downloadName = originalFile.name;
                if (fileValidatorReady && window.FileValidator) {
                    downloadName = window.FileValidator.sanitizeFileName(originalFile.name);
                }
                
                const blob = new Blob([newPdfBytes], { type: 'application/pdf' });
                const url = URL.createObjectURL(blob);
                downloadLink.href = url;
                downloadLink.download = `compressed_${downloadName}`;

                // Auto revoke URL after download
                downloadLink.addEventListener('click', () => {
                    setTimeout(() => {
                        URL.revokeObjectURL(url);
                    }, 100);
                }, { once: true });

                compressBtn.disabled = false;
                compressBtn.innerHTML = '<i class="fas fa-cogs"></i> Mulai Kompresi';
                
            } catch (innerError) {
                throw innerError;
            }
        };

        fileReader.onerror = () => {
            throw new Error('Gagal membaca file');
        };
        
    } catch (error) {
        statusP.textContent = `Error: ${error.message}`;
        statusP.style.color = '#ff006e';
        progressContainer.style.display = 'block';
        compressBtn.disabled = false;
        compressBtn.innerHTML = '<i class="fas fa-cogs"></i> Coba Lagi';
        
        if (originalFile) {
            originalFile = null;
        }
    }
});

// Clear data on page unload
window.addEventListener('beforeunload', () => {
    if (originalFile) {
        originalFile = null;
    }
    
    if (downloadLink.href && downloadLink.href.startsWith('blob:')) {
        URL.revokeObjectURL(downloadLink.href);
    }
});