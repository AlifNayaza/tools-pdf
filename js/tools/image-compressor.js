const imageFileInput = document.getElementById('imageFile');
const dropArea = document.getElementById('dropArea');
const qualityInput = document.getElementById('quality');
const qualityValueSpan = document.getElementById('qualityValue');
const compressBtn = document.getElementById('compressBtn');
const statusP = document.getElementById('status');
const progressBarFill = document.getElementById('progressBarFill');
const downloadLink = document.getElementById('downloadLink');
const resetBtn = document.getElementById('resetBtn');
const previewImage = document.getElementById('previewImage');
const resultImage = document.getElementById('resultImage');

const step2Div = document.getElementById('step2');
const fileInfoDiv = document.getElementById('fileInfo');
const previewArea = document.getElementById('previewArea');
const progressContainer = document.getElementById('progressContainer');
const resultInfoDiv = document.getElementById('resultInfo');

const fileNameSpan = document.getElementById('fileName');
const fileSizeSpan = document.getElementById('fileSize');
const imageDimensionsSpan = document.getElementById('imageDimensions');
const originalSizeSpan = document.getElementById('originalSize');
const newSizeSpan = document.getElementById('newSize');
const sizeSavingsSpan = document.getElementById('sizeSavings');

let originalFile = null;
let originalImage = null;
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB in bytes

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
    previewArea.style.display = 'none';
    progressContainer.style.display = 'none';
    resultInfoDiv.style.display = 'none';
    compressBtn.disabled = false;
    progressBarFill.style.width = '0%';
}

async function processFile(file) {
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!file || !validTypes.includes(file.type)) {
        if (window.Toast) window.Toast.error('Pilih file gambar JPG atau PNG yang valid.');
        else alert('Pilih file gambar JPG atau PNG yang valid.');
        return;
    }
    
    if (file.size > MAX_FILE_SIZE) {
        if (window.Toast) window.Toast.error(`Ukuran file melebihi batas maksimal (${formatBytes(MAX_FILE_SIZE)}).`);
        else alert(`Ukuran file melebihi batas maksimal (${formatBytes(MAX_FILE_SIZE)}).`);
        return;
    }
    
    originalFile = file;
    resetUI();

    fileNameSpan.textContent = originalFile.name;
    fileSizeSpan.textContent = formatBytes(originalFile.size);
    fileInfoDiv.style.display = 'block';

    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            originalImage = img;
            previewImage.src = e.target.result;
            imageDimensionsSpan.textContent = `${img.width} × ${img.height} px`;
            
            previewArea.style.display = 'block';
            step2Div.style.display = 'block';
            compressBtn.style.display = 'flex';
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(originalFile);
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

dropArea.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files.length > 0) {
        processFile(files[0]);
    }
}, false);

dropArea.addEventListener('click', () => {
    imageFileInput.click();
});

imageFileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        processFile(e.target.files[0]);
    }
});

function handleImageCompressorReset() {
    resetUI();
    imageFileInput.value = '';
    originalFile = null;
    originalImage = null;
    window.scrollTo({ top: 0, behavior: 'smooth' });
}
window.handleImageCompressorReset = handleImageCompressorReset;

if (resetBtn) {
    resetBtn.addEventListener('click', (e) => {
        e.preventDefault();
        handleImageCompressorReset();
    });
}

qualityInput.addEventListener('input', () => {
    qualityValueSpan.textContent = qualityInput.value;
});

compressBtn.addEventListener('click', async () => {
    if (!originalFile || !originalImage) {
        if (window.Toast) window.Toast.warning('Pilih gambar terlebih dahulu.');
        else alert('Pilih gambar terlebih dahulu.');
        return;
    }

    const quality = parseFloat(qualityInput.value);

    compressBtn.disabled = true;
    compressBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Mengompres...';
    progressContainer.style.display = 'block';
    statusP.textContent = 'Memproses gambar...';
    progressBarFill.style.width = '50%';

    try {
        // Buat canvas untuk kompresi
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        canvas.width = originalImage.width;
        canvas.height = originalImage.height;
        
        // Gambar image ke canvas
        ctx.drawImage(originalImage, 0, 0, canvas.width, canvas.height);
        
        progressBarFill.style.width = '75%';
        statusP.textContent = 'Mengompres gambar...';

        // Selalu gunakan JPEG untuk kompresi yang lebih baik, kecuali PNG dengan transparansi
        let mimeType = 'image/jpeg';
        let targetCanvas = canvas;
        
        // Check jika PNG memiliki transparansi
        if (originalFile.type === 'image/png') {
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            let hasTransparency = false;
            
            for (let i = 3; i < imageData.data.length; i += 4) {
                if (imageData.data[i] < 255) {
                    hasTransparency = true;
                    break;
                }
            }
            
            if (hasTransparency) {
                mimeType = 'image/png';
                targetCanvas = canvas;
            } else {
                // Konversi PNG tanpa transparansi ke JPEG dengan latar belakang putih
                mimeType = 'image/jpeg';
                const tempCanvas = document.createElement('canvas');
                const tempCtx = tempCanvas.getContext('2d');
                tempCanvas.width = canvas.width;
                tempCanvas.height = canvas.height;
                
                tempCtx.fillStyle = '#FFFFFF';
                tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
                tempCtx.drawImage(canvas, 0, 0);
                targetCanvas = tempCanvas;
            }
        } else {
            mimeType = 'image/jpeg';
            targetCanvas = canvas;
        }
        
        // Buat Blob langsung dari canvas tanpa fetch (menghindari CSP connect-src block)
        const blob = await new Promise((resolve, reject) => {
            targetCanvas.toBlob((b) => {
                if (b) resolve(b);
                else reject(new Error('Gagal menghasilkan file gambar'));
            }, mimeType, quality);
        });
        
        progressBarFill.style.width = '100%';
        
        // Tampilkan hasil
        setTimeout(() => {
            progressContainer.style.display = 'none';
            step2Div.style.display = 'none';
            previewArea.style.display = 'none';
            compressBtn.style.display = 'none';
            resultInfoDiv.style.display = 'block';

            setTimeout(() => {
                resultInfoDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 50);

            const originalSizeBytes = originalFile.size;
            const newSizeBytes = blob.size;
            
            // Jika ukuran tidak berkurang, berikan peringatan
            if (newSizeBytes >= originalSizeBytes) {
                statusP.textContent = 'Peringatan: Ukuran file tidak berkurang. Coba turunkan kualitas.';
                statusP.style.color = '#ff6b6b';
                progressContainer.style.display = 'block';
            }
            
            const savingsPercent = ((originalSizeBytes - newSizeBytes) / originalSizeBytes * 100);

            originalSizeSpan.textContent = formatBytes(originalSizeBytes);
            newSizeSpan.textContent = formatBytes(newSizeBytes);
            
            if (savingsPercent > 0) {
                sizeSavingsSpan.textContent = `${savingsPercent.toFixed(2)}%`;
                sizeSavingsSpan.style.color = '#28a745';
            } else {
                sizeSavingsSpan.textContent = `${Math.abs(savingsPercent).toFixed(2)}% (lebih besar)`;
                sizeSavingsSpan.style.color = '#dc3545';
            }

            const url = URL.createObjectURL(blob);
            resultImage.src = url;
            downloadLink.href = url;
            const extension = mimeType === 'image/png' ? '.png' : '.jpg';
            const baseName = originalFile.name.replace(/\.[^/.]+$/, '');
            downloadLink.download = `compressed_${baseName}${extension}`;

            compressBtn.disabled = false;
            compressBtn.innerHTML = '<i class="fas fa-compress-alt"></i> Kompres Gambar';

            if (window.Toast) window.Toast.success('Gambar berhasil dikompres.');
        }, 300);
        
    } catch (error) {
        console.error(error);
        if (window.Toast) window.Toast.error('Gagal mengompres gambar: ' + error.message);
        statusP.textContent = `Error: ${error.message}`;
        progressContainer.style.display = 'none';
        compressBtn.disabled = false;
        compressBtn.innerHTML = '<i class="fas fa-compress-alt"></i> Coba Lagi';
    }
});

const copyImageBtn = document.getElementById('copyImageBtn');
if (copyImageBtn) {
    copyImageBtn.addEventListener('click', async () => {
        if (!resultImage.src) return;

        try {
            const canvas = document.createElement('canvas');
            canvas.width = resultImage.naturalWidth || 500;
            canvas.height = resultImage.naturalHeight || 500;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(resultImage, 0, 0);
            const copyBlob = await new Promise(r => canvas.toBlob(r, 'image/png'));

            await navigator.clipboard.write([
                new ClipboardItem({ 'image/png': copyBlob })
            ]);
            if (window.Toast) window.Toast.success('Gambar berhasil disalin ke clipboard! Siap di-paste (Ctrl+V).');
        } catch (err) {
            console.warn('Clipboard write failed:', err);
            if (window.Toast) window.Toast.warning('Browser tidak mendukung penyalinan langsung gambar ke clipboard.');
        }
    });
}