pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.10.377/pdf.worker.min.js';

const pdfFilesInput = document.getElementById('pdfFiles');
const dropArea = document.getElementById('dropArea');
const pdfList = document.getElementById('pdfList');
const fileListContainer = document.getElementById('fileListContainer');
const addMoreBtn = document.getElementById('addMoreBtn');
const mergeBtn = document.getElementById('mergeBtn');
const statusP = document.getElementById('status');
const progressBarFill = document.getElementById('progressBarFill');
const downloadLink = document.getElementById('downloadLink');
const resetBtn = document.getElementById('resetBtn');

const fileInfo = document.getElementById('fileInfo');
const progressContainer = document.getElementById('progressContainer');
const resultInfo = document.getElementById('resultInfo');

const fileNameSpan = document.getElementById('fileName');
const pdfCountSpan = document.getElementById('pdfCount');
const totalSizeSpan = document.getElementById('totalSize');
const totalPagesSpan = document.getElementById('totalPages');
const mergedCountSpan = document.getElementById('mergedCount');
const mergedPagesSpan = document.getElementById('mergedPages');
const mergedSizeSpan = document.getElementById('mergedSize');

let pdfFiles = [];
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function resetUI() {
    const step1 = document.getElementById('step1');
    if (step1) step1.style.display = 'block';
    fileListContainer.style.display = 'none';
    fileInfo.style.display = 'none';
    mergeBtn.style.display = 'none';
    progressContainer.style.display = 'none';
    resultInfo.style.display = 'none';
    mergeBtn.disabled = false;
    mergeBtn.innerHTML = '<i class="fas fa-object-group"></i> GABUNG SEMUA PDF';
    progressBarFill.style.width = '0%';
    pdfFiles = [];
    pdfList.innerHTML = '';
    if (pdfFilesInput) pdfFilesInput.value = '';
}

window.handlePdfMergeReset = function() {
    resetUI();
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

async function getPdfPageCount(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const pdfData = new Uint8Array(e.target.result);
                const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;
                resolve(pdf.numPages);
            } catch (error) {
                resolve(0);
            }
        };
        reader.readAsArrayBuffer(file);
    });
}

async function generateThumbnail(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const pdfData = new Uint8Array(e.target.result);
                const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;
                const page = await pdf.getPage(1);
                const viewport = page.getViewport({ scale: 0.5 });
                
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                canvas.height = viewport.height;
                canvas.width = viewport.width;
                
                await page.render({ canvasContext: context, viewport: viewport }).promise;
                resolve(canvas.toDataURL());
            } catch (error) {
                resolve(null);
            }
        };
        reader.readAsArrayBuffer(file);
    });
}

async function addPdfFiles(files) {
    const validFiles = Array.from(files).filter(f => f.type === 'application/pdf');
    
    if (validFiles.length === 0) {
        if (window.Toast) window.Toast.error('Silakan pilih file PDF yang valid!');
        else alert('Silakan pilih file PDF yang valid!');
        return;
    }
    
    // Check total size
    const currentTotalSize = pdfFiles.reduce((sum, f) => sum + f.file.size, 0);
    const newTotalSize = validFiles.reduce((sum, f) => sum + f.size, 0);
    
    if (currentTotalSize + newTotalSize > MAX_FILE_SIZE) {
        if (window.Toast) window.Toast.error(`Total ukuran file terlalu besar! Maksimal ${formatBytes(MAX_FILE_SIZE)}`);
        else alert(`Total ukuran file terlalu besar! Maksimal ${formatBytes(MAX_FILE_SIZE)}`);
        return;
    }
    
    // Add new files
    for (const file of validFiles) {
        const pageCount = await getPdfPageCount(file);
        const thumbnail = await generateThumbnail(file);
        
        pdfFiles.push({
            id: Date.now() + Math.random(),
            file: file,
            pageCount: pageCount,
            thumbnail: thumbnail
        });
    }
    
    renderPdfList();
    updateStats();
    
    fileListContainer.style.display = 'block';
    fileInfo.style.display = 'block';
    mergeBtn.style.display = 'flex';
}

function renderPdfList() {
    pdfList.innerHTML = '';
    
    pdfFiles.forEach((pdfData, index) => {
        const item = document.createElement('div');
        item.className = 'pdf-item';
        item.draggable = true;
        item.dataset.id = pdfData.id;
        
        item.innerHTML = `
            <i class="fas fa-grip-vertical drag-handle"></i>
            <div class="pdf-preview">
                ${pdfData.thumbnail ? `<img src="${pdfData.thumbnail}" style="width: 100%; height: 100%; object-fit: cover;">` : '<i class="fas fa-file-pdf"></i>'}
            </div>
            <div class="pdf-info">
                <h4>${pdfData.file.name}</h4>
                <p>${formatBytes(pdfData.file.size)} • ${pdfData.pageCount} halaman</p>
            </div>
            <button class="remove-btn" onclick="removePdf(${index})">
                <i class="fas fa-trash"></i>
            </button>
        `;
        
        // Drag events
        item.addEventListener('dragstart', handleDragStart);
        item.addEventListener('dragend', handleDragEnd);
        item.addEventListener('dragover', handleDragOver);
        item.addEventListener('drop', handleDrop);
        
        pdfList.appendChild(item);
    });
}

let draggedElement = null;

function handleDragStart(e) {
    draggedElement = this;
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
}

function handleDragEnd(e) {
    this.classList.remove('dragging');
}

function handleDragOver(e) {
    if (e.preventDefault) {
        e.preventDefault();
    }
    e.dataTransfer.dropEffect = 'move';
    return false;
}

function handleDrop(e) {
    if (e.stopPropagation) {
        e.stopPropagation();
    }
    
    if (draggedElement !== this) {
        const draggedId = draggedElement.dataset.id;
        const targetId = this.dataset.id;
        
        const draggedIndex = pdfFiles.findIndex(p => p.id == draggedId);
        const targetIndex = pdfFiles.findIndex(p => p.id == targetId);
        
        // Swap positions
        const temp = pdfFiles[draggedIndex];
        pdfFiles[draggedIndex] = pdfFiles[targetIndex];
        pdfFiles[targetIndex] = temp;
        
        renderPdfList();
    }
    
    return false;
}

function removePdf(index) {
    pdfFiles.splice(index, 1);
    
    if (pdfFiles.length === 0) {
        resetUI();
    } else {
        renderPdfList();
        updateStats();
    }
}

function updateStats() {
    const totalSize = pdfFiles.reduce((sum, p) => sum + p.file.size, 0);
    const totalPages = pdfFiles.reduce((sum, p) => sum + p.pageCount, 0);
    
    if (fileNameSpan) fileNameSpan.textContent = pdfFiles.map(p => p.file.name).join(', ');
    pdfCountSpan.textContent = pdfFiles.length;
    totalSizeSpan.textContent = formatBytes(totalSize);
    totalPagesSpan.textContent = totalPages;
}

function resetUI() {
    fileListContainer.style.display = 'none';
    fileInfo.style.display = 'none';
    mergeBtn.style.display = 'none';
    progressContainer.style.display = 'none';
    resultInfo.style.display = 'none';
    pdfFiles = [];
    pdfList.innerHTML = '';
}

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
        addPdfFiles(files);
    }
}, false);

dropArea.addEventListener('click', () => {
    pdfFilesInput.click();
});

pdfFilesInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        addPdfFiles(e.target.files);
        e.target.value = ''; // Reset input
    }
});

if (resetBtn) {
    resetBtn.addEventListener('click', (e) => {
        e.preventDefault();
        window.handlePdfMergeReset();
    });
}

addMoreBtn.addEventListener('click', () => {
    pdfFilesInput.click();
});

mergeBtn.addEventListener('click', async () => {
    if (pdfFiles.length < 2) {
        if (window.Toast) window.Toast.warning('Pilih minimal 2 file PDF untuk digabungkan.');
        else alert('Pilih minimal 2 file PDF untuk digabungkan.');
        return;
    }
    
    mergeBtn.disabled = true;
    mergeBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menggabungkan...';
    progressContainer.style.display = 'block';
    
    try {
        const mergedPdf = await PDFLib.PDFDocument.create();
        let totalPages = 0;
        
        for (let i = 0; i < pdfFiles.length; i++) {
            const progress = ((i + 1) / pdfFiles.length) * 100;
            statusP.textContent = `Memproses PDF ${i + 1} dari ${pdfFiles.length}...`;
            progressBarFill.style.width = `${progress}%`;
            
            const pdfData = pdfFiles[i];
            const arrayBuffer = await pdfData.file.arrayBuffer();
            const pdf = await PDFLib.PDFDocument.load(arrayBuffer);
            
            const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
            copiedPages.forEach((page) => {
                mergedPdf.addPage(page);
                totalPages++;
            });
        }
        
        statusP.textContent = 'Menyimpan PDF gabungan...';
        const mergedPdfBytes = await mergedPdf.save();
        
        progressContainer.style.display = 'none';
        fileListContainer.style.display = 'none';
        mergeBtn.style.display = 'none';
        resultInfo.style.display = 'block';

        setTimeout(() => {
            resultInfo.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 50);
        
        mergedCountSpan.textContent = pdfFiles.length;
        mergedPagesSpan.textContent = totalPages;
        mergedSizeSpan.textContent = formatBytes(mergedPdfBytes.length);
        
        const blob = new Blob([mergedPdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        downloadLink.href = url;
        downloadLink.download = `merged-pdf-${Date.now()}.pdf`;
        
        mergeBtn.disabled = false;
        mergeBtn.innerHTML = '<i class="fas fa-object-group"></i> Gabung Semua PDF';
        
        if (window.Toast) window.Toast.success('File PDF berhasil digabungkan.');
    } catch (error) {
        console.error(error);
        if (window.Toast) window.Toast.error('Gagal menggabungkan PDF: ' + error.message);
        else alert('Gagal menggabungkan PDF: ' + error.message);
        statusP.textContent = `Error: ${error.message}`;
        progressContainer.style.display = 'none';
        mergeBtn.disabled = false;
        mergeBtn.innerHTML = '<i class="fas fa-object-group"></i> Coba Lagi';
    }
});