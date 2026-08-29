// js/tools/image-resizer.js - Image Resizer Tool
const imageFileInput = document.getElementById('imageFile');
const dropArea = document.getElementById('dropArea');
const fileInfoDiv = document.getElementById('fileInfo');
const previewArea = document.getElementById('previewArea');
const imagePreview = document.getElementById('imagePreview');
const step2Div = document.getElementById('step2');

const resizeWidthInput = document.getElementById('resizeWidth');
const resizeHeightInput = document.getElementById('resizeHeight');
const ratioLockBtn = document.getElementById('ratioLockBtn');
const outputFormatSelect = document.getElementById('outputFormat');
const resizeBtn = document.getElementById('resizeBtn');

const progressContainer = document.getElementById('progressContainer');
const progressBarFill = document.getElementById('progressBarFill');
const statusP = document.getElementById('status');

const resultInfoDiv = document.getElementById('resultInfo');
const resultImage = document.getElementById('resultImage');
const downloadLink = document.getElementById('downloadLink');
const copyImageBtn = document.getElementById('copyImageBtn');
const resetBtn = document.getElementById('resetBtn');

const fileNameSpan = document.getElementById('fileName');
const fileSizeSpan = document.getElementById('fileSize');
const originalDimensionsSpan = document.getElementById('originalDimensions');
const resOrigDimSpan = document.getElementById('resOrigDim');
const resNewDimSpan = document.getElementById('resNewDim');
const resNewSizeSpan = document.getElementById('resNewSize');

let originalFile = null;
let originalImage = null;
let isRatioLocked = true;
let currentBlobResult = null;
const MAX_FILE_SIZE = 50 * 1024 * 1024;

function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function resetUI() {
    fileInfoDiv.style.display = 'none';
    previewArea.style.display = 'none';
    step2Div.style.display = 'none';
    progressContainer.style.display = 'none';
    resultInfoDiv.style.display = 'none';
    imagePreview.src = '';
    resultImage.src = '';
    originalFile = null;
    originalImage = null;
    currentBlobResult = null;
    progressBarFill.style.width = '0%';
    if (imageFileInput) imageFileInput.value = '';
}

window.handleImageResizerReset = function() {
    resetUI();
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

if (resetBtn) {
    resetBtn.addEventListener('click', (e) => {
        e.preventDefault();
        window.handleImageResizerReset();
    });
}

// Drag & Drop
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropArea.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
    }, false);
});

['dragenter', 'dragover'].forEach(eventName => {
    dropArea.addEventListener(eventName, () => dropArea.classList.add('drag-over'), false);
});

['dragleave', 'drop'].forEach(eventName => {
    dropArea.addEventListener(eventName, () => dropArea.classList.remove('drag-over'), false);
});

dropArea.addEventListener('drop', (e) => {
    const files = e.dataTransfer.files;
    if (files.length > 0) processFile(files[0]);
}, false);

dropArea.addEventListener('click', () => imageFileInput.click());

imageFileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) processFile(e.target.files[0]);
});

function processFile(file) {
    if (!file || !file.type.startsWith('image/')) {
        if (window.Toast) window.Toast.error('Pilih file gambar yang valid (JPG, PNG, WEBP).');
        return;
    }

    if (file.size > MAX_FILE_SIZE) {
        if (window.Toast) window.Toast.error('Ukuran file melebihi batas maksimal (50MB).');
        return;
    }

    originalFile = file;
    fileNameSpan.textContent = file.name;
    fileSizeSpan.textContent = formatBytes(file.size);

    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            originalImage = img;
            originalDimensionsSpan.textContent = `${img.width} × ${img.height} px`;
            
            resizeWidthInput.value = img.width;
            resizeHeightInput.value = img.height;

            imagePreview.src = e.target.result;
            fileInfoDiv.style.display = 'block';
            previewArea.style.display = 'block';
            step2Div.style.display = 'block';

            if (window.Toast) window.Toast.success('Gambar berhasil dimuat.');
        };
        img.onerror = () => {
            if (window.Toast) window.Toast.error('Gagal memuat format gambar.');
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

// Aspect Ratio Toggle
ratioLockBtn.addEventListener('click', () => {
    isRatioLocked = !isRatioLocked;
    if (isRatioLocked) {
        ratioLockBtn.classList.add('active');
        ratioLockBtn.innerHTML = '<i class="fas fa-lock"></i> KUNCI RASIO ASPEK (ASPECT RATIO)';
    } else {
        ratioLockBtn.classList.remove('active');
        ratioLockBtn.innerHTML = '<i class="fas fa-unlock"></i> RASIO BEBAS (TIDAK TERKUNCI)';
    }
});

// Dimension inputs sync
resizeWidthInput.addEventListener('input', () => {
    if (!originalImage || !isRatioLocked) return;
    const w = parseInt(resizeWidthInput.value, 10);
    if (w > 0 && originalImage.width > 0) {
        const ratio = originalImage.height / originalImage.width;
        resizeHeightInput.value = Math.round(w * ratio);
    }
});

resizeHeightInput.addEventListener('input', () => {
    if (!originalImage || !isRatioLocked) return;
    const h = parseInt(resizeHeightInput.value, 10);
    if (h > 0 && originalImage.height > 0) {
        const ratio = originalImage.width / originalImage.height;
        resizeWidthInput.value = Math.round(h * ratio);
    }
});

// Presets
document.querySelectorAll('.preset-chip').forEach(btn => {
    btn.addEventListener('click', () => {
        const preset = btn.getAttribute('data-preset');
        if (!originalImage) return;

        switch (preset) {
            case 'pas-foto-2x3':
                resizeWidthInput.value = 236;
                resizeHeightInput.value = 354;
                break;
            case 'pas-foto-3x4':
                resizeWidthInput.value = 354;
                resizeHeightInput.value = 472;
                break;
            case 'pas-foto-4x6':
                resizeWidthInput.value = 472;
                resizeHeightInput.value = 709;
                break;
            case 'ig-square':
                resizeWidthInput.value = 1080;
                resizeHeightInput.value = 1080;
                break;
            case 'full-hd':
                resizeWidthInput.value = 1920;
                resizeHeightInput.value = 1080;
                break;
        }

        if (window.Toast) window.Toast.info(`Preset diterapkan: ${btn.textContent}`);
    });
});

// Resize Action
resizeBtn.addEventListener('click', async () => {
    if (!originalImage) return;

    const targetWidth = parseInt(resizeWidthInput.value, 10);
    const targetHeight = parseInt(resizeHeightInput.value, 10);

    if (!targetWidth || targetWidth <= 0 || !targetHeight || targetHeight <= 0) {
        if (window.Toast) window.Toast.warning('Masukkan lebar dan tinggi yang valid.');
        return;
    }

    resizeBtn.disabled = true;
    resizeBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Mengubah Ukuran...';
    progressContainer.style.display = 'block';
    statusP.textContent = 'Memproses resolusi baru...';
    progressBarFill.style.width = '60%';

    try {
        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext('2d');

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        let format = outputFormatSelect.value;
        if (format === 'original') {
            format = originalFile.type || 'image/jpeg';
        }

        if (format === 'image/jpeg') {
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, targetWidth, targetHeight);
        }

        ctx.drawImage(originalImage, 0, 0, targetWidth, targetHeight);

        progressBarFill.style.width = '90%';

        const blob = await new Promise((resolve, reject) => {
            canvas.toBlob((b) => {
                if (b) resolve(b);
                else reject(new Error('Gagal menghasilkan file gambar'));
            }, format, 0.92);
        });

        currentBlobResult = blob;
        const url = URL.createObjectURL(blob);

        progressContainer.style.display = 'none';
        step2Div.style.display = 'none';
        previewArea.style.display = 'none';
        resultInfoDiv.style.display = 'block';

        setTimeout(() => {
            resultInfoDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 50);

        resOrigDimSpan.textContent = `${originalImage.width} × ${originalImage.height} px`;
        resNewDimSpan.textContent = `${targetWidth} × ${targetHeight} px`;
        resNewSizeSpan.textContent = formatBytes(blob.size);

        resultImage.src = url;
        downloadLink.href = url;

        const ext = format === 'image/png' ? '.png' : format === 'image/webp' ? '.webp' : '.jpg';
        const baseName = originalFile.name.replace(/\.[^/.]+$/, '');
        downloadLink.download = `resized_${baseName}_${targetWidth}x${targetHeight}${ext}`;

        resizeBtn.disabled = false;
        resizeBtn.innerHTML = '<i class="fas fa-expand-arrows-alt"></i> UBAH UKURAN GAMBAR';

        if (window.Toast) window.Toast.success('Ukuran gambar berhasil diubah.');
    } catch (err) {
        console.error(err);
        progressContainer.style.display = 'none';
        resizeBtn.disabled = false;
        resizeBtn.innerHTML = '<i class="fas fa-expand-arrows-alt"></i> Coba Lagi';
        if (window.Toast) window.Toast.error('Gagal mengubah ukuran gambar: ' + err.message);
    }
});

// Copy to Clipboard
if (copyImageBtn) {
    copyImageBtn.addEventListener('click', async () => {
        if (!currentBlobResult) return;

        try {
            // Clipboard API standard requires PNG for image data
            let copyBlob = currentBlobResult;
            if (currentBlobResult.type !== 'image/png') {
                const canvas = document.createElement('canvas');
                canvas.width = resultImage.naturalWidth || 500;
                canvas.height = resultImage.naturalHeight || 500;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(resultImage, 0, 0);
                copyBlob = await new Promise(r => canvas.toBlob(r, 'image/png'));
            }

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
