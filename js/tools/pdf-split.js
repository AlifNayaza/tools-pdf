pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.10.377/pdf.worker.min.js';

const pdfFileInput = document.getElementById('pdfFile');
const dropArea = document.getElementById('dropArea');
const modeSelection = document.getElementById('modeSelection');
const rangeInput = document.getElementById('rangeInput');
const pageSelector = document.getElementById('pageSelector');
const pageGrid = document.getElementById('pageGrid');
const splitBtn = document.getElementById('splitBtn');
const statusP = document.getElementById('status');
const progressBarFill = document.getElementById('progressBarFill');
const downloadAllBtn = document.getElementById('downloadAllBtn');
const resetBtn = document.getElementById('resetBtn');

const fileInfo = document.getElementById('fileInfo');
const progressContainer = document.getElementById('progressContainer');
const resultInfo = document.getElementById('resultInfo');

const fileNameSpan = document.getElementById('fileName');
const fileSizeSpan = document.getElementById('fileSize');
const filePagesSpan = document.getElementById('filePages');
const originalNameSpan = document.getElementById('originalName');
const splitCountSpan = document.getElementById('splitCount');
const startPageInput = document.getElementById('startPage');
const endPageInput = document.getElementById('endPage');
const selectionInfo = document.getElementById('selectionInfo');

let originalFile = null;
let pdfDocument = null;
let currentMode = null;
let selectedPages = new Set();
let splitResults = [];
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
    modeSelection.style.display = 'none';
    rangeInput.style.display = 'none';
    pageSelector.style.display = 'none';
    fileInfo.style.display = 'none';
    splitBtn.style.display = 'none';
    progressContainer.style.display = 'none';
    resultInfo.style.display = 'none';
    currentMode = null;
    selectedPages.clear();
    pageGrid.innerHTML = '';
    document.querySelectorAll('.mode-card').forEach(card => card.classList.remove('active'));
}

async function processFile(file) {
    if (!file || file.type !== 'application/pdf') {
        if (window.Toast) window.Toast.error('Pilih file PDF yang valid.');
        else alert('Pilih file PDF yang valid.');
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
    fileInfo.style.display = 'block';

    const fileReader = new FileReader();
    fileReader.readAsArrayBuffer(originalFile);
    fileReader.onload = async (event) => {
        try {
            const pdfData = new Uint8Array(event.target.result);
            pdfDocument = await pdfjsLib.getDocument({ data: pdfData }).promise;
            filePagesSpan.textContent = pdfDocument.numPages;
            
            startPageInput.max = pdfDocument.numPages;
            endPageInput.max = pdfDocument.numPages;
            
            modeSelection.style.display = 'block';
        } catch (error) {
            alert('Error membaca PDF: ' + error.message);
        }
    };
}

// Mode selection
document.querySelectorAll('.mode-card').forEach(card => {
    card.addEventListener('click', async () => {
        document.querySelectorAll('.mode-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        
        currentMode = card.dataset.mode;
        rangeInput.style.display = 'none';
        pageSelector.style.display = 'none';
        splitBtn.style.display = 'none';
        
        if (currentMode === 'all') {
            splitBtn.style.display = 'flex';
        } else if (currentMode === 'range') {
            rangeInput.style.display = 'block';
            splitBtn.style.display = 'flex';
        } else if (currentMode === 'custom') {
            await renderPageThumbnails();
            pageSelector.style.display = 'block';
            splitBtn.style.display = 'flex';
        }
    });
});

async function renderPageThumbnails() {
    pageGrid.innerHTML = '<p style="text-align: center; grid-column: 1/-1;">Memuat preview...</p>';
    
    const thumbnails = [];
    for (let i = 1; i <= pdfDocument.numPages; i++) {
        const page = await pdfDocument.getPage(i);
        const viewport = page.getViewport({ scale: 0.5 });
        
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        await page.render({ canvasContext: context, viewport: viewport }).promise;
        
        thumbnails.push({ pageNum: i, canvas: canvas });
    }
    
    pageGrid.innerHTML = '';
    thumbnails.forEach(({ pageNum, canvas }) => {
        const item = document.createElement('div');
        item.className = 'page-item';
        item.dataset.page = pageNum;
        
        const canvasClone = canvas.cloneNode(true);
        item.appendChild(canvasClone);
        
        const label = document.createElement('p');
        label.textContent = `Hal ${pageNum}`;
        item.appendChild(label);
        
        item.addEventListener('click', () => {
            if (selectedPages.has(pageNum)) {
                selectedPages.delete(pageNum);
                item.classList.remove('selected');
            } else {
                selectedPages.add(pageNum);
                item.classList.add('selected');
            }
            updateSelectionInfo();
        });
        
        pageGrid.appendChild(item);
    });
}

function updateSelectionInfo() {
    if (selectedPages.size === 0) {
        selectionInfo.innerHTML = '<i class="fas fa-info-circle"></i> Belum ada halaman dipilih';
    } else {
        const pages = Array.from(selectedPages).sort((a, b) => a - b);
        selectionInfo.innerHTML = `<i class="fas fa-check-circle"></i> ${selectedPages.size} halaman dipilih: ${pages.join(', ')}`;
    }
}

function selectAllPages() {
    selectedPages.clear();
    for (let i = 1; i <= pdfDocument.numPages; i++) {
        selectedPages.add(i);
    }
    document.querySelectorAll('.page-item').forEach(item => {
        item.classList.add('selected');
    });
    updateSelectionInfo();
}

function deselectAllPages() {
    selectedPages.clear();
    document.querySelectorAll('.page-item').forEach(item => {
        item.classList.remove('selected');
    });
    updateSelectionInfo();
}

// Make functions global
window.selectAllPages = selectAllPages;
window.deselectAllPages = deselectAllPages;

// Drag and Drop
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
    pdfFileInput.click();
});

pdfFileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        processFile(e.target.files[0]);
    }
});

function handlePdfSplitReset() {
    resetUI();
    pdfFileInput.value = '';
    originalFile = null;
    pdfDocument = null;
    selectedPages.clear();
    splitResults = [];
    window.scrollTo({ top: 0, behavior: 'smooth' });
}
window.handlePdfSplitReset = handlePdfSplitReset;

if (resetBtn) {
    resetBtn.addEventListener('click', (e) => {
        e.preventDefault();
        handlePdfSplitReset();
    });
}

splitBtn.addEventListener('click', async () => {
    if (!originalFile || !pdfDocument) {
        if (window.Toast) window.Toast.warning('Silakan pilih file terlebih dahulu!');
        else alert('Silakan pilih file terlebih dahulu!');
        return;
    }
    
    let pagesToSplit = [];
    
    if (currentMode === 'all') {
        for (let i = 1; i <= pdfDocument.numPages; i++) {
            pagesToSplit.push([i]);
        }
    } else if (currentMode === 'range') {
        const start = parseInt(startPageInput.value);
        const end = parseInt(endPageInput.value);
        
        if (!start || !end || start < 1 || end > pdfDocument.numPages || start > end) {
            if (window.Toast) window.Toast.warning('Rentang halaman tidak valid!');
            else alert('Rentang halaman tidak valid!');
            return;
        }
        
        const pages = [];
        for (let i = start; i <= end; i++) {
            pages.push(i);
        }
        pagesToSplit.push(pages);
    } else if (currentMode === 'custom') {
        if (selectedPages.size === 0) {
            if (window.Toast) window.Toast.warning('Silakan pilih minimal 1 halaman!');
            else alert('Silakan pilih minimal 1 halaman!');
            return;
        }
        
        selectedPages.forEach(page => {
            pagesToSplit.push([page]);
        });
    }
    
    splitBtn.disabled = true;
    splitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memisahkan...';
    progressContainer.style.display = 'block';
    
    try {
        const arrayBuffer = await originalFile.arrayBuffer();
        const sourcePdf = await PDFLib.PDFDocument.load(arrayBuffer);
        
        splitResults = [];
        
        for (let i = 0; i < pagesToSplit.length; i++) {
            const progress = ((i + 1) / pagesToSplit.length) * 100;
            statusP.textContent = `Memproses file ${i + 1} dari ${pagesToSplit.length}...`;
            progressBarFill.style.width = `${progress}%`;
            
            const newPdf = await PDFLib.PDFDocument.create();
            const pages = pagesToSplit[i];
            
            for (const pageNum of pages) {
                const [copiedPage] = await newPdf.copyPages(sourcePdf, [pageNum - 1]);
                newPdf.addPage(copiedPage);
            }
            
            const pdfBytes = await newPdf.save();
            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            
            const fileName = currentMode === 'all' || currentMode === 'custom'
                ? `page-${pages.join('-')}.pdf`
                : `pages-${pages[0]}-to-${pages[pages.length - 1]}.pdf`;
            
            splitResults.push({ blob, fileName });
        }
        
        progressContainer.style.display = 'none';
        modeSelection.style.display = 'none';
        rangeInput.style.display = 'none';
        pageSelector.style.display = 'none';
        splitBtn.style.display = 'none';
        resultInfo.style.display = 'block';

        setTimeout(() => {
            resultInfo.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 50);
        
        originalNameSpan.textContent = originalFile.name;
        splitCountSpan.textContent = splitResults.length;
        
        splitBtn.disabled = false;
        splitBtn.innerHTML = '<i class="fas fa-cut"></i> Pisahkan PDF';
        
        if (window.Toast) window.Toast.success('Halaman PDF berhasil dipisahkan.');
    } catch (error) {
        console.error(error);
        if (window.Toast) window.Toast.error('Gagal memisahkan PDF: ' + error.message);
        else alert('Gagal memisahkan PDF: ' + error.message);
        statusP.textContent = `Error: ${error.message}`;
        progressContainer.style.display = 'none';
        splitBtn.disabled = false;
        splitBtn.innerHTML = '<i class="fas fa-cut"></i> Coba Lagi';
    }
});

downloadAllBtn.addEventListener('click', async () => {
    if (splitResults.length === 0) {
        alert('Tidak ada file untuk diunduh!');
        return;
    }
    
    downloadAllBtn.disabled = true;
    downloadAllBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Membuat ZIP...';
    
    try {
        const zip = new JSZip();
        const folder = zip.folder('split-pdf');
        
        splitResults.forEach(result => {
            folder.file(result.fileName, result.blob);
        });
        
        const zipBlob = await zip.generateAsync({
            type: 'blob',
            compression: 'DEFLATE',
            compressionOptions: { level: 6 }
        });
        
        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${originalFile.name.replace('.pdf', '')}-split.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        downloadAllBtn.disabled = false;
        downloadAllBtn.innerHTML = '<i class="fas fa-download"></i> Unduh Semua (ZIP)';
    } catch (error) {
        console.error(error);
        alert('Error saat membuat ZIP: ' + error.message);
        downloadAllBtn.disabled = false;
        downloadAllBtn.innerHTML = '<i class="fas fa-download"></i> Unduh Semua (ZIP)';
    }
});