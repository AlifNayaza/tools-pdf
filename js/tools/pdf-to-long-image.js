pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.10.377/pdf.worker.min.js';

const pdfFileInput = document.getElementById('pdfFile');
const dropArea = document.getElementById('dropArea');
const imageFormatSelect = document.getElementById('imageFormat');
const convertBtn = document.getElementById('convertBtn');
const statusP = document.getElementById('status');
const progressBarFill = document.getElementById('progressBarFill');
const downloadLink = document.getElementById('downloadLink');
const resetBtn = document.getElementById('resetBtn');

const fileInfoDiv = document.getElementById('fileInfo');
const step2Div = document.getElementById('step2');
const progressContainer = document.getElementById('progressContainer');
const resultInfoDiv = document.getElementById('resultInfo');
const resultLongImage = document.getElementById('resultLongImage');

const fileNameSpan = document.getElementById('fileName');
const filePagesSpan = document.getElementById('filePages');
const longImageDimensionsSpan = document.getElementById('longImageDimensions');
const longImageSizeSpan = document.getElementById('longImageSize');

let originalFile = null;
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
}

async function processFile(file) {
    if (!file || file.type !== 'application/pdf') {
        if (window.Toast) window.Toast.error('Pilih file PDF yang valid.');
        return;
    }

    if (file.size > MAX_FILE_SIZE) {
        if (window.Toast) window.Toast.error('Ukuran file melebihi batas maksimal (100MB).');
        return;
    }

    originalFile = file;
    resetUI();

    fileNameSpan.textContent = originalFile.name;
    fileInfoDiv.style.display = 'block';

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const pdfData = new Uint8Array(e.target.result);
            const pdfDoc = await pdfjsLib.getDocument({ data: pdfData }).promise;
            filePagesSpan.textContent = pdfDoc.numPages;

            step2Div.style.display = 'block';
            convertBtn.style.display = 'flex';
        } catch (err) {
            filePagesSpan.textContent = 'Tidak dapat membaca';
        }
    };
    reader.readAsArrayBuffer(originalFile);
}

['dragenter', 'dragover', 'dragleave', 'drop'].forEach(evt => {
    dropArea.addEventListener(evt, e => { e.preventDefault(); e.stopPropagation(); });
});

['dragenter', 'dragover'].forEach(evt => dropArea.addEventListener(evt, () => dropArea.classList.add('drag-over')));
['dragleave', 'drop'].forEach(evt => dropArea.addEventListener(evt, () => dropArea.classList.remove('drag-over')));

dropArea.addEventListener('drop', (e) => {
    if (e.dataTransfer.files.length > 0) processFile(e.dataTransfer.files[0]);
});

dropArea.addEventListener('click', () => pdfFileInput.click());

pdfFileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) processFile(e.target.files[0]);
});

function handlePdfToLongImageReset() {
    resetUI();
    pdfFileInput.value = '';
    originalFile = null;
    resultLongImage.src = '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
}
window.handlePdfToLongImageReset = handlePdfToLongImageReset;

if (resetBtn) {
    resetBtn.addEventListener('click', (e) => {
        e.preventDefault();
        handlePdfToLongImageReset();
    });
}

convertBtn.addEventListener('click', async () => {
    if (!originalFile) return;

    const format = imageFormatSelect.value;

    convertBtn.disabled = true;
    convertBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menggabungkan...';
    progressContainer.style.display = 'block';

    try {
        const reader = new FileReader();
        reader.onload = async (e) => {
            const pdfData = new Uint8Array(e.target.result);
            const pdfDoc = await pdfjsLib.getDocument({ data: pdfData }).promise;
            const numPages = pdfDoc.numPages;

            const scale = 1.5;
            const pageCanvases = [];
            let totalHeight = 0;
            let maxWidth = 0;

            for (let i = 1; i <= numPages; i++) {
                const progress = (i / numPages) * 70;
                statusP.textContent = `Rendering halaman ${i} dari ${numPages}...`;
                progressBarFill.style.width = `${progress}%`;

                const page = await pdfDoc.getPage(i);
                const viewport = page.getViewport({ scale: scale });

                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = Math.floor(viewport.width);
                canvas.height = Math.floor(viewport.height);

                await page.render({ canvasContext: ctx, viewport: viewport }).promise;

                pageCanvases.push(canvas);
                totalHeight += canvas.height;
                if (canvas.width > maxWidth) maxWidth = canvas.width;
            }

            statusP.textContent = 'Menyusun ke dalam 1 gambar vertikal...';
            progressBarFill.style.width = '85%';

            const masterCanvas = document.createElement('canvas');
            const masterCtx = masterCanvas.getContext('2d');
            masterCanvas.width = maxWidth;
            masterCanvas.height = totalHeight;

            // Fill white background for JPEG
            if (format === 'jpeg') {
                masterCtx.fillStyle = '#FFFFFF';
                masterCtx.fillRect(0, 0, masterCanvas.width, masterCanvas.height);
            }

            let currentY = 0;
            for (let c = 0; c < pageCanvases.length; c++) {
                const cv = pageCanvases[c];
                const xOffset = (maxWidth - cv.width) / 2;
                masterCtx.drawImage(cv, xOffset, currentY);
                currentY += cv.height;
            }

            progressBarFill.style.width = '95%';

            const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
            masterCanvas.toBlob((blob) => {
                progressBarFill.style.width = '100%';
                progressContainer.style.display = 'none';
                step2Div.style.display = 'none';
                convertBtn.style.display = 'none';
                resultInfoDiv.style.display = 'block';

                setTimeout(() => {
                    resultInfoDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 50);

                longImageDimensionsSpan.textContent = `${masterCanvas.width} × ${masterCanvas.height} px`;
                longImageSizeSpan.textContent = formatBytes(blob.size);

                const dataUrl = masterCanvas.toDataURL(mimeType, 0.9);
                resultLongImage.src = dataUrl;

                const url = URL.createObjectURL(blob);
                downloadLink.href = url;
                downloadLink.download = `${originalFile.name.replace('.pdf', '')}-long-image.${format}`;

                convertBtn.disabled = false;
                convertBtn.innerHTML = '<i class="fas fa-scroll"></i> Gabung Jadi Gambar Panjang';

                if (window.Toast) window.Toast.success('Halaman PDF berhasil digabung menjadi gambar.');
            }, mimeType, 0.9);
        };
        reader.readAsArrayBuffer(originalFile);
    } catch (err) {
        if (window.Toast) window.Toast.error('Gagal membuat gambar panjang: ' + err.message);
        convertBtn.disabled = false;
        convertBtn.innerHTML = '<i class="fas fa-scroll"></i> Coba Lagi';
    }
});
