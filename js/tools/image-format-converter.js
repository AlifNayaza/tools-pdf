const imageFilesInput = document.getElementById('imageFiles');
const dropArea = document.getElementById('dropArea');
const targetFormatSelect = document.getElementById('targetFormat');
const qualityInput = document.getElementById('quality');
const qualityValueSpan = document.getElementById('qualityValue');
const convertBtn = document.getElementById('convertBtn');
const statusP = document.getElementById('status');
const progressBarFill = document.getElementById('progressBarFill');
const downloadOneByOneBtn = document.getElementById('downloadOneByOneBtn');
const downloadAllBtn = document.getElementById('downloadAllBtn');
const resetBtn = document.getElementById('resetBtn');

const fileInfoDiv = document.getElementById('fileInfo');
const step2Div = document.getElementById('step2');
const progressContainer = document.getElementById('progressContainer');
const resultInfoDiv = document.getElementById('resultInfo');

const imageCountSpan = document.getElementById('imageCount');
const fileNameSpan = document.getElementById('fileName');
const totalSizeSpan = document.getElementById('totalSize');
const convertedCountSpan = document.getElementById('convertedCount');
const outputFormatLabelSpan = document.getElementById('outputFormatLabel');

let selectedFiles = [];
let convertedResults = [];
const MAX_FILE_SIZE = 100 * 1024 * 1024;

function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function resetUI() {
    convertBtn.style.display = 'none';
    fileInfoDiv.style.display = 'none';
    step2Div.style.display = 'none';
    progressContainer.style.display = 'none';
    resultInfoDiv.style.display = 'none';
    convertBtn.disabled = false;
    progressBarFill.style.width = '0%';
    convertedResults = [];
}

async function processFiles(files) {
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/svg+xml'];
    selectedFiles = Array.from(files).filter(file => validTypes.includes(file.type) || file.name.toLowerCase().endsWith('.svg'));

    if (selectedFiles.length === 0) {
        if (window.Toast) window.Toast.error('Pilih file gambar yang valid (PNG, JPG, WEBP, atau SVG).');
        return;
    }

    const totalSize = selectedFiles.reduce((sum, file) => sum + file.size, 0);
    if (totalSize > MAX_FILE_SIZE) {
        if (window.Toast) window.Toast.error(`Ukuran file melebihi batas maksimal (${formatBytes(MAX_FILE_SIZE)}).`);
        return;
    }

    resetUI();
    if (fileNameSpan) fileNameSpan.textContent = selectedFiles.map(f => f.name).join(', ');
    imageCountSpan.textContent = selectedFiles.length;
    totalSizeSpan.textContent = formatBytes(totalSize);

    fileInfoDiv.style.display = 'block';
    step2Div.style.display = 'block';
    convertBtn.style.display = 'flex';
}

['dragenter', 'dragover', 'dragleave', 'drop'].forEach(evt => {
    dropArea.addEventListener(evt, e => { e.preventDefault(); e.stopPropagation(); });
});

['dragenter', 'dragover'].forEach(evt => dropArea.addEventListener(evt, () => dropArea.classList.add('drag-over')));
['dragleave', 'drop'].forEach(evt => dropArea.addEventListener(evt, () => dropArea.classList.remove('drag-over')));

dropArea.addEventListener('drop', (e) => {
    if (e.dataTransfer.files.length > 0) processFiles(e.dataTransfer.files);
});

dropArea.addEventListener('click', () => imageFilesInput.click());

imageFilesInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) processFiles(e.target.files);
});

function handleImageConverterReset() {
    resetUI();
    imageFilesInput.value = '';
    selectedFiles = [];
    convertedResults = [];
    window.scrollTo({ top: 0, behavior: 'smooth' });
}
window.handleImageConverterReset = handleImageConverterReset;

if (resetBtn) {
    resetBtn.addEventListener('click', (e) => {
        e.preventDefault();
        handleImageConverterReset();
    });
}

qualityInput.addEventListener('input', () => {
    qualityValueSpan.textContent = parseFloat(qualityInput.value).toFixed(2);
});

convertBtn.addEventListener('click', async () => {
    if (selectedFiles.length === 0) {
        if (window.Toast) window.Toast.warning('Pilih file gambar terlebih dahulu.');
        return;
    }

    const targetFormat = targetFormatSelect.value;
    const quality = parseFloat(qualityInput.value);

    convertBtn.disabled = true;
    convertBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Mengonversi...';
    progressContainer.style.display = 'block';

    convertedResults = [];

    try {
        for (let i = 0; i < selectedFiles.length; i++) {
            const file = selectedFiles[i];
            const progress = ((i + 1) / selectedFiles.length) * 100;
            statusP.textContent = `Mengonversi gambar ${i + 1} dari ${selectedFiles.length}...`;
            progressBarFill.style.width = `${progress}%`;

            const blob = await convertSingleImage(file, targetFormat, quality);
            const baseName = file.name.replace(/\.[^/.]+$/, '');
            const newFileName = `${baseName}.${targetFormat}`;

            convertedResults.push({ blob, fileName: newFileName });
        }

        progressContainer.style.display = 'none';
        step2Div.style.display = 'none';
        convertBtn.style.display = 'none';
        resultInfoDiv.style.display = 'block';

        setTimeout(() => {
            resultInfoDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 50);

        convertedCountSpan.textContent = convertedResults.length;
        outputFormatLabelSpan.textContent = targetFormat.toUpperCase();

        convertBtn.disabled = false;
        convertBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Konversi Gambar';

        if (window.Toast) window.Toast.success(`${convertedResults.length} gambar berhasil dikonversi ke ${targetFormat.toUpperCase()}.`);
    } catch (err) {
        if (window.Toast) window.Toast.error('Gagal mengonversi gambar: ' + err.message);
        convertBtn.disabled = false;
        convertBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Coba Lagi';
    }
});

function convertSingleImage(file, format, quality) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const reader = new FileReader();

        reader.onload = (e) => {
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = img.width;
                canvas.height = img.height;

                if (format === 'jpeg') {
                    ctx.fillStyle = '#FFFFFF';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                }

                ctx.drawImage(img, 0, 0);

                const mimeType = format === 'png' ? 'image/png' : format === 'webp' ? 'image/webp' : 'image/jpeg';
                canvas.toBlob(blob => {
                    if (blob) resolve(blob);
                    else reject(new Error('Gagal mengonversi gambar'));
                }, mimeType, quality);
            };
            img.onerror = () => reject(new Error('Gagal membaca gambar'));
            img.src = e.target.result;
        };

        reader.readAsDataURL(file);
    });
}

downloadOneByOneBtn.addEventListener('click', async () => {
    for (let i = 0; i < convertedResults.length; i++) {
        const item = convertedResults[i];
        const url = URL.createObjectURL(item.blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = item.fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        await new Promise(res => setTimeout(res, 300));
    }
});

downloadAllBtn.addEventListener('click', async () => {
    if (convertedResults.length === 0) return;
    const zip = new JSZip();
    convertedResults.forEach(item => zip.file(item.fileName, item.blob));
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `converted-images-${Date.now()}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
});
