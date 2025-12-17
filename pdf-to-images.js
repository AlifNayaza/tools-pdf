pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.10.377/pdf.worker.min.js';

const pdfFileInput = document.getElementById('pdfFile');
const dropArea = document.getElementById('dropArea');
const convertBtn = document.getElementById('convertBtn');
const statusP = document.getElementById('status');
const progressBarFill = document.getElementById('progressBarFill');
const downloadAllBtn = document.getElementById('downloadAllBtn');
const imageFormatSelect = document.getElementById('imageFormat');
const qualityInput = document.getElementById('quality');
const qualityValueSpan = document.getElementById('qualityValue');

const fileInfoDiv = document.getElementById('fileInfo');
const step2Div = document.getElementById('step2');
const progressContainer = document.getElementById('progressContainer');
const previewContainer = document.getElementById('previewContainer');
const imageResultList = document.getElementById('imageResultList');
const resultInfoDiv = document.getElementById('resultInfo');

const fileNameSpan = document.getElementById('fileName');
const fileSizeSpan = document.getElementById('fileSize');
const filePagesSpan = document.getElementById('filePages');
const originalNameSpan = document.getElementById('originalName');
const imageCountSpan = document.getElementById('imageCount');

let originalFile = null;
let generatedImages = [];
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
    convertBtn.style.display = 'none';
    fileInfoDiv.style.display = 'none';
    step2Div.style.display = 'none';
    progressContainer.style.display = 'none';
    previewContainer.style.display = 'none';
    resultInfoDiv.style.display = 'none';
    convertBtn.disabled = false;
    progressBarFill.style.width = '0%';
    imageResultList.innerHTML = '';
    generatedImages = [];
}

async function processFile(file) {
    if (!file || file.type !== 'application/pdf') {
        alert('Silakan pilih file PDF yang valid!');
        return;
    }
    
    if (file.size > MAX_FILE_SIZE) {
        alert(`Ukuran file terlalu besar! Maksimal ${formatBytes(MAX_FILE_SIZE)}`);
        return;
    }
    
    originalFile = file;
    resetUI();

    fileNameSpan.textContent = originalFile.name;
    fileSizeSpan.textContent = formatBytes(originalFile.size);
    fileInfoDiv.style.display = 'block';
    step2Div.style.display = 'block';
    convertBtn.style.display = 'flex';

    const fileReader = new FileReader();
    fileReader.readAsArrayBuffer(originalFile);
    fileReader.onload = async (event) => {
        try {
            const pdfData = new Uint8Array(event.target.result);
            const pdfDoc = await pdfjsLib.getDocument({ data: pdfData }).promise;
            filePagesSpan.textContent = pdfDoc.numPages;
        } catch (error) {
            filePagesSpan.textContent = 'Tidak dapat membaca';
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

qualityInput.addEventListener('input', () => {
    const quality = parseInt(qualityInput.value);
    const labels = ['Rendah', 'Sedang', 'Tinggi'];
    qualityValueSpan.textContent = labels[quality - 1];
});

convertBtn.addEventListener('click', async () => {
    if (!originalFile) {
        alert('Silakan pilih file terlebih dahulu!');
        return;
    }

    const imageFormat = imageFormatSelect.value;
    const quality = parseInt(qualityInput.value);
    const scale = quality; // 1x, 2x, atau 3x

    convertBtn.disabled = true;
    convertBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Mengonversi...';
    progressContainer.style.display = 'block';

    try {
        const fileReader = new FileReader();
        fileReader.readAsArrayBuffer(originalFile);
        
        fileReader.onload = async (event) => {
            const pdfData = new Uint8Array(event.target.result);
            const pdfDoc = await pdfjsLib.getDocument({ data: pdfData }).promise;
            const numPages = pdfDoc.numPages;

            generatedImages = [];
            imageResultList.innerHTML = '';

            for (let i = 1; i <= numPages; i++) {
                const progress = (i / numPages) * 100;
                statusP.textContent = `Mengonversi halaman ${i} dari ${numPages}...`;
                progressBarFill.style.width = `${progress}%`;

                const page = await pdfDoc.getPage(i);
                const viewport = page.getViewport({ scale: scale });
                
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                canvas.height = viewport.height;
                canvas.width = viewport.width;

                await page.render({ canvasContext: context, viewport: viewport }).promise;

                // Konversi ke format yang dipilih
                const mimeType = imageFormat === 'png' ? 'image/png' : 'image/jpeg';
                const jpegQuality = imageFormat === 'jpeg' ? 0.92 : 1.0;
                const imageDataUrl = canvas.toDataURL(mimeType, jpegQuality);
                
                // Simpan untuk download nanti
                const response = await fetch(imageDataUrl);
                const blob = await response.blob();
                const extension = imageFormat === 'png' ? 'png' : 'jpg';
                const fileName = `page-${i}.${extension}`;
                
                generatedImages.push({
                    blob: blob,
                    fileName: fileName,
                    dataUrl: imageDataUrl
                });

                // Buat preview
                const previewDiv = document.createElement('div');
                previewDiv.style.cssText = 'position: relative; border: 2px solid #ddd; border-radius: 8px; overflow: hidden; background: #f9f9f9;';
                
                const img = document.createElement('img');
                img.src = imageDataUrl;
                img.style.cssText = 'width: 100%; height: 200px; object-fit: contain; background: white;';
                
                const info = document.createElement('div');
                info.style.cssText = 'padding: 8px; font-size: 12px; text-align: center; background: white; border-top: 1px solid #ddd;';
                info.innerHTML = `<strong>Halaman ${i}</strong><br>${formatBytes(blob.size)}`;
                
                const downloadBtn = document.createElement('a');
                downloadBtn.href = imageDataUrl;
                downloadBtn.download = fileName;
                downloadBtn.innerHTML = '<i class="fas fa-download"></i>';
                downloadBtn.style.cssText = 'position: absolute; top: 10px; right: 10px; background: rgba(255,255,255,0.9); padding: 8px 12px; border-radius: 5px; color: #4A90E2; text-decoration: none; box-shadow: 0 2px 5px rgba(0,0,0,0.2);';
                
                previewDiv.appendChild(img);
                previewDiv.appendChild(info);
                previewDiv.appendChild(downloadBtn);
                imageResultList.appendChild(previewDiv);
            }

            progressContainer.style.display = 'none';
            previewContainer.style.display = 'block';
            resultInfoDiv.style.display = 'block';

            originalNameSpan.textContent = originalFile.name;
            imageCountSpan.textContent = generatedImages.length;

            convertBtn.disabled = false;
            convertBtn.innerHTML = '<i class="fas fa-images"></i> Konversi ke Gambar';
        };
    } catch (error) {
        console.error(error);
        alert('Error saat konversi: ' + error.message);
        statusP.textContent = `Error: ${error.message}`;
        progressContainer.style.display = 'none';
        convertBtn.disabled = false;
        convertBtn.innerHTML = '<i class="fas fa-images"></i> Coba Lagi';
    }
});

downloadAllBtn.addEventListener('click', async () => {
    if (generatedImages.length === 0) {
        alert('Tidak ada gambar untuk diunduh!');
        return;
    }

    downloadAllBtn.disabled = true;
    downloadAllBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Membuat ZIP...';

    try {
        const zip = new JSZip();
        const folder = zip.folder('pdf-images');

        generatedImages.forEach(img => {
            folder.file(img.fileName, img.blob);
        });

        const zipBlob = await zip.generateAsync({ 
            type: 'blob',
            compression: 'DEFLATE',
            compressionOptions: { level: 6 }
        });

        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${originalFile.name.replace('.pdf', '')}-images.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        downloadAllBtn.disabled = false;
        downloadAllBtn.innerHTML = '<i class="fas fa-download"></i> Unduh Semua Gambar (ZIP)';
    } catch (error) {
        console.error(error);
        alert('Error saat membuat ZIP: ' + error.message);
        downloadAllBtn.disabled = false;
        downloadAllBtn.innerHTML = '<i class="fas fa-download"></i> Unduh Semua Gambar (ZIP)';
    }
});