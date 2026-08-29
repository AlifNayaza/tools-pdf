// js/tools/pdf-rotate.js - PDF Page Rotation Tool
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.10.377/pdf.worker.min.js';

const pdfFileInput = document.getElementById('pdfFile');
const dropArea = document.getElementById('dropArea');
const fileInfoDiv = document.getElementById('fileInfo');
const rotateEditorContainer = document.getElementById('rotateEditorContainer');
const rotateGrid = document.getElementById('rotateGrid');
const rotateAllCWBtn = document.getElementById('rotateAllCWBtn');
const rotateAllCCWBtn = document.getElementById('rotateAllCCWBtn');
const resetRotationBtn = document.getElementById('resetRotationBtn');
const savePdfBtn = document.getElementById('savePdfBtn');

const progressContainer = document.getElementById('progressContainer');
const progressBarFill = document.getElementById('progressBarFill');
const statusP = document.getElementById('status');
const resultInfoDiv = document.getElementById('resultInfo');
const downloadLink = document.getElementById('downloadLink');
const resetBtn = document.getElementById('resetBtn');

const fileNameSpan = document.getElementById('fileName');
const fileSizeSpan = document.getElementById('fileSize');
const filePagesSpan = document.getElementById('filePages');
const resFileNameSpan = document.getElementById('resFileName');
const resFileSizeSpan = document.getElementById('resFileSize');
const resPageCountSpan = document.getElementById('resPageCount');

let originalFile = null;
let pdfDocProxy = null;
let pageRotations = []; // Array of added degrees [0, 90, 180, 270]
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
    fileInfoDiv.style.display = 'none';
    rotateEditorContainer.style.display = 'none';
    progressContainer.style.display = 'none';
    resultInfoDiv.style.display = 'none';
    rotateGrid.innerHTML = '';
    pageRotations = [];
    originalFile = null;
    pdfDocProxy = null;
    progressBarFill.style.width = '0%';
    if (pdfFileInput) pdfFileInput.value = '';
}

window.handlePdfRotateReset = function() {
    resetUI();
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

if (resetBtn) {
    resetBtn.addEventListener('click', (e) => {
        e.preventDefault();
        window.handlePdfRotateReset();
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

dropArea.addEventListener('click', () => pdfFileInput.click());

pdfFileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) processFile(e.target.files[0]);
});

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
    fileNameSpan.textContent = file.name;
    fileSizeSpan.textContent = formatBytes(file.size);
    fileInfoDiv.style.display = 'block';

    progressContainer.style.display = 'block';
    statusP.textContent = 'Memuat halaman PDF...';
    progressBarFill.style.width = '30%';

    try {
        const arrayBuffer = await file.arrayBuffer();
        pdfDocProxy = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        
        const numPages = pdfDocProxy.numPages;
        filePagesSpan.textContent = `${numPages} Halaman`;
        pageRotations = new Array(numPages).fill(0);

        rotateGrid.innerHTML = '';
        progressBarFill.style.width = '50%';

        // Render thumbnails for each page
        for (let pageNum = 1; pageNum <= numPages; pageNum++) {
            const page = await pdfDocProxy.getPage(pageNum);
            const viewport = page.getViewport({ scale: 0.35 });

            const card = document.createElement('div');
            card.className = 'rotate-card';
            card.dataset.pageNum = pageNum;

            const thumbWrap = document.createElement('div');
            thumbWrap.className = 'rotate-card-thumb-wrap';

            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = viewport.width;
            canvas.height = viewport.height;

            await page.render({ canvasContext: ctx, viewport: viewport }).promise;
            thumbWrap.appendChild(canvas);

            const numberLabel = document.createElement('div');
            numberLabel.className = 'rotate-card-number';
            numberLabel.textContent = `Halaman ${pageNum}`;

            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'rotate-card-actions';

            const leftBtn = document.createElement('button');
            leftBtn.type = 'button';
            leftBtn.innerHTML = '<i class="fas fa-undo"></i> 90°';
            leftBtn.title = 'Putar Kiri 90°';
            leftBtn.onclick = () => rotatePage(pageNum - 1, -90, canvas);

            const rightBtn = document.createElement('button');
            rightBtn.type = 'button';
            rightBtn.innerHTML = '<i class="fas fa-redo"></i> 90°';
            rightBtn.title = 'Putar Kanan 90°';
            rightBtn.onclick = () => rotatePage(pageNum - 1, 90, canvas);

            actionsDiv.appendChild(leftBtn);
            actionsDiv.appendChild(rightBtn);

            card.appendChild(thumbWrap);
            card.appendChild(numberLabel);
            card.appendChild(actionsDiv);

            rotateGrid.appendChild(card);

            progressBarFill.style.width = `${50 + (pageNum / numPages) * 50}%`;
        }

        progressContainer.style.display = 'none';
        rotateEditorContainer.style.display = 'block';

        if (window.Toast) window.Toast.success(`${numPages} halaman PDF siap dirotasi.`);
    } catch (err) {
        console.error(err);
        progressContainer.style.display = 'none';
        if (window.Toast) window.Toast.error('Gagal membuka file PDF: ' + err.message);
    }
}

function rotatePage(pageIndex, angleDelta, canvas) {
    pageRotations[pageIndex] = (pageRotations[pageIndex] + angleDelta) % 360;
    if (pageRotations[pageIndex] < 0) pageRotations[pageIndex] += 360;

    canvas.style.transform = `rotate(${pageRotations[pageIndex]}deg)`;
}

// Bulk Controls
rotateAllCWBtn.addEventListener('click', () => {
    const canvases = rotateGrid.querySelectorAll('canvas');
    canvases.forEach((canvas, idx) => {
        rotatePage(idx, 90, canvas);
    });
});

rotateAllCCWBtn.addEventListener('click', () => {
    const canvases = rotateGrid.querySelectorAll('canvas');
    canvases.forEach((canvas, idx) => {
        rotatePage(idx, -90, canvas);
    });
});

resetRotationBtn.addEventListener('click', () => {
    const canvases = rotateGrid.querySelectorAll('canvas');
    pageRotations.fill(0);
    canvases.forEach(canvas => {
        canvas.style.transform = 'rotate(0deg)';
    });
});

// Save Rotated PDF using pdf-lib
savePdfBtn.addEventListener('click', async () => {
    if (!originalFile) return;

    savePdfBtn.disabled = true;
    savePdfBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menyimpan PDF...';
    progressContainer.style.display = 'block';
    statusP.textContent = 'Menerapkan rotasi halaman...';
    progressBarFill.style.width = '50%';

    try {
        const fileBuffer = await originalFile.arrayBuffer();
        const pdfDoc = await PDFLib.PDFDocument.load(fileBuffer);
        const pages = pdfDoc.getPages();

        pages.forEach((page, idx) => {
            const addedAngle = pageRotations[idx] || 0;
            if (addedAngle !== 0) {
                const currentRotation = page.getRotation().angle;
                const newRotation = (currentRotation + addedAngle) % 360;
                page.setRotation(PDFLib.degrees(newRotation));
            }
        });

        progressBarFill.style.width = '85%';
        statusP.textContent = 'Menyusun berkas PDF akhir...';

        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);

        progressContainer.style.display = 'none';
        rotateEditorContainer.style.display = 'none';
        resultInfoDiv.style.display = 'block';

        setTimeout(() => {
            resultInfoDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 50);

        resFileNameSpan.textContent = originalFile.name;
        resFileSizeSpan.textContent = formatBytes(pdfBytes.length);
        resPageCountSpan.textContent = `${pages.length} Halaman`;

        downloadLink.href = url;
        const baseName = originalFile.name.replace(/\.[^/.]+$/, '');
        downloadLink.download = `rotated_${baseName}.pdf`;

        savePdfBtn.disabled = false;
        savePdfBtn.innerHTML = '<i class="fas fa-save"></i> SIMPAN PDF BARU';

        if (window.Toast) window.Toast.success('Halaman PDF berhasil dirotasi.');
    } catch (err) {
        console.error(err);
        progressContainer.style.display = 'none';
        savePdfBtn.disabled = false;
        savePdfBtn.innerHTML = '<i class="fas fa-save"></i> Coba Lagi';
        if (window.Toast) window.Toast.error('Gagal menyimpan rotasi PDF: ' + err.message);
    }
});
