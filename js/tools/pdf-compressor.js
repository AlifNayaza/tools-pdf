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
const resetBtn = document.getElementById('resetBtn');

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
        }, 3000);
    });
}

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
    return { valid: errors.length === 0, errors: errors };
}

async function processFile(file) {
    let validation;
    if (fileValidatorReady && window.FileValidator) {
        validation = await window.FileValidator.validateFile(file);
    } else {
        validation = basicValidateFile(file);
    }
    
    if (!validation.valid) {
        if (window.Toast) window.Toast.error('File tidak valid: ' + validation.errors.join(', '));
        else alert('❌ File tidak valid!\n\n' + validation.errors.join('\n'));
        pdfFileInput.value = '';
        return;
    }

    originalFile = file;
    resetUI();

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
                if (window.Toast) window.Toast.warning('PDF terlalu banyak halaman (max 500 halaman)');
                else alert('⚠️ PDF terlalu banyak halaman (max 500 halaman)');
                resetUI();
                return;
            }
            filePagesSpan.textContent = pdfDoc.numPages;
        } catch (error) {
            filePagesSpan.textContent = 'Tidak dapat membaca halaman';
        }
    };
}

// Global Drag & Drop Prevention (Mencegah file terbuka langsung di browser)
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    document.body.addEventListener(eventName, preventDefaults, false);
});

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

// Khusus efek untuk Drop Area
['dragenter', 'dragover'].forEach(eventName => {
    dropArea.addEventListener(eventName, () => dropArea.classList.add('drag-over'), false);
});

['dragleave', 'drop'].forEach(eventName => {
    dropArea.addEventListener(eventName, () => dropArea.classList.remove('drag-over'), false);
});

dropArea.addEventListener('drop', async (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    
    if (files.length > 1) {
        if (window.Toast) window.Toast.warning('Hanya bisa upload 1 file sekaligus');
        else alert('⚠️ Hanya bisa upload 1 file sekaligus');
        return;
    }
    if (files.length > 0) {
        await processFile(files[0]);
    }
}, false);

// EVENT INI DIHAPUS karena menyebabkan bentrok dengan tag <label> bawaan HTML
// dropArea.addEventListener('click', () => { pdfFileInput.click(); });

pdfFileInput.addEventListener('change', async (e) => {
    if (e.target.files.length > 0) {
        await processFile(e.target.files[0]);
        // Reset input agar file yang sama bisa dipilih ulang jika terjadi error
        e.target.value = ''; 
    }
});

function handlePdfCompressorReset() {
    resetUI();
    pdfFileInput.value = '';
    originalFile = null;
    window.scrollTo({ top: 0, behavior: 'smooth' });
}
window.handlePdfCompressorReset = handlePdfCompressorReset;

if (resetBtn) {
    resetBtn.addEventListener('click', (e) => {
        e.preventDefault();
        handlePdfCompressorReset();
    });
}

qualityInput.addEventListener('input', () => {
    let value = parseFloat(qualityInput.value);
    if (isNaN(value) || value < 0.1 || value > 1.0) {
        value = 0.7;
    }
    qualityValueSpan.textContent = value.toFixed(2);
});

compressBtn.addEventListener('click', async () => {
    if (!originalFile) {
        if (window.Toast) window.Toast.warning('Silakan pilih file terlebih dahulu!');
        else alert('Silakan pilih file terlebih dahulu!');
        return;
    }

    const quality = parseFloat(qualityInput.value);
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

                // Scale dinamis: kualitas rendah = resolusi lebih kecil → file lebih kecil
                // quality 0.1 → scale 0.4 | quality 0.7 → scale 0.76 | quality 1.0 → scale 1.0
                const renderScale = 0.3 + (quality * 0.7);
                const maxDimension = 2048;

                for (let i = 1; i <= numPages; i++) {
                    const progress = (i / numPages) * 100;
                    statusP.textContent = `Memproses halaman ${i} dari ${numPages}...`;
                    progressBarFill.style.width = `${progress}%`;

                    const page = await pdfDoc.getPage(i);
                    const baseViewport = page.getViewport({ scale: 1 });

                    // Hitung scale final agar tidak melebihi maxDimension
                    let finalScale = renderScale;
                    const maxSide = Math.max(baseViewport.width, baseViewport.height);
                    if (maxSide * finalScale > maxDimension) {
                        finalScale = maxDimension / maxSide;
                    }

                    const viewport = page.getViewport({ scale: finalScale });
                    const canvas = document.createElement('canvas');
                    const context = canvas.getContext('2d');
                    canvas.width = Math.floor(viewport.width);
                    canvas.height = Math.floor(viewport.height);

                    await page.render({ canvasContext: context, viewport }).promise;

                    const jpegBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
                    const jpegImageBytes = await jpegBlob.arrayBuffer();
                    const jpegImage = await newPdfDoc.embedJpg(jpegImageBytes);
                    const newPage = newPdfDoc.addPage([canvas.width, canvas.height]);
                    newPage.drawImage(jpegImage, { x: 0, y: 0, width: canvas.width, height: canvas.height });

                    context.clearRect(0, 0, canvas.width, canvas.height);
                }

                const newPdfBytes = await newPdfDoc.save();
                progressContainer.style.display = 'none';
                step2Div.style.display = 'none';
                compressBtn.style.display = 'none';
                resultInfoDiv.style.display = 'block';

                setTimeout(() => {
                    resultInfoDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 50);

                const originalSizeBytes = originalFile.size;
                const newSizeBytes = newPdfBytes.length;
                const savingsPercent = 100 - (newSizeBytes / originalSizeBytes * 100);

                originalSizeSpan.textContent = formatBytes(originalSizeBytes);

                let downloadName = originalFile.name;

                if (newSizeBytes >= originalSizeBytes) {
                    // Hasil kompresi malah lebih besar — kembalikan file asli
                    newSizeSpan.textContent = formatBytes(originalSizeBytes);
                    sizeSavingsSpan.textContent = `0% (File sudah optimal)`;

                    const originalBlob = new Blob([event.target.result], { type: 'application/pdf' });
                    const url = URL.createObjectURL(originalBlob);
                    downloadLink.href = url;
                    downloadLink.download = downloadName;
                } else {
                    newSizeSpan.textContent = formatBytes(newSizeBytes);
                    sizeSavingsSpan.textContent = `${savingsPercent.toFixed(2)}%`;

                    const blob = new Blob([newPdfBytes], { type: 'application/pdf' });
                    const url = URL.createObjectURL(blob);
                    downloadLink.href = url;
                    downloadLink.download = `compressed_${downloadName}`;
                }

                compressBtn.disabled = false;
                compressBtn.innerHTML = '<i class="fas fa-cogs"></i> Mulai Kompresi';

                if (window.Toast) window.Toast.success('File PDF berhasil dikompres.');
            } catch (innerError) { throw innerError; }
        };
    } catch (error) {
        if (window.Toast) window.Toast.error('Gagal mengompres PDF: ' + error.message);
        statusP.textContent = `Error: ${error.message}`;
        statusP.style.color = '#ff006e';
        progressContainer.style.display = 'block';
        compressBtn.disabled = false;
        compressBtn.innerHTML = '<i class="fas fa-cogs"></i> Coba Lagi';
    }
});