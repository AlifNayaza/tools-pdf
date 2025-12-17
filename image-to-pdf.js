const imageFilesInput = document.getElementById('imageFiles');
const dropArea = document.getElementById('dropArea');
const convertBtn = document.getElementById('convertBtn');
const statusP = document.getElementById('status');
const progressBarFill = document.getElementById('progressBarFill');
const downloadLink = document.getElementById('downloadLink');
const pageSizeSelect = document.getElementById('pageSize');

const fileInfoDiv = document.getElementById('fileInfo');
const previewContainer = document.getElementById('previewContainer');
const imagePreviewList = document.getElementById('imagePreviewList');
const step2Div = document.getElementById('step2');
const progressContainer = document.getElementById('progressContainer');
const resultInfoDiv = document.getElementById('resultInfo');

const imageCountSpan = document.getElementById('imageCount');
const totalSizeSpan = document.getElementById('totalSize');
const pageCountSpan = document.getElementById('pageCount');
const pdfSizeSpan = document.getElementById('pdfSize');

let selectedFiles = [];
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
    previewContainer.style.display = 'none';
    step2Div.style.display = 'none';
    progressContainer.style.display = 'none';
    resultInfoDiv.style.display = 'none';
    convertBtn.disabled = false;
    progressBarFill.style.width = '0%';
    imagePreviewList.innerHTML = '';
}

async function processFiles(files) {
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    selectedFiles = Array.from(files).filter(file => validTypes.includes(file.type));
    
    if (selectedFiles.length === 0) {
        alert('Silakan pilih file gambar yang valid (JPG atau PNG)!');
        return;
    }
    
    // Hitung total size
    const totalSize = selectedFiles.reduce((sum, file) => sum + file.size, 0);
    
    if (totalSize > MAX_FILE_SIZE) {
        alert(`Total ukuran file terlalu besar! Maksimal ${formatBytes(MAX_FILE_SIZE)}`);
        return;
    }
    
    resetUI();
    
    imageCountSpan.textContent = selectedFiles.length;
    totalSizeSpan.textContent = formatBytes(totalSize);
    fileInfoDiv.style.display = 'block';

    // Buat preview untuk setiap gambar
    imagePreviewList.innerHTML = '';
    for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        const reader = new FileReader();
        
        reader.onload = (e) => {
            const previewDiv = document.createElement('div');
            previewDiv.style.cssText = 'position: relative; border: 2px solid #ddd; border-radius: 8px; overflow: hidden; background: #f9f9f9;';
            
            const img = document.createElement('img');
            img.src = e.target.result;
            img.style.cssText = 'width: 100%; height: 150px; object-fit: cover;';
            
            const info = document.createElement('div');
            info.style.cssText = 'padding: 8px; font-size: 11px; text-align: center; background: white;';
            info.innerHTML = `<strong>Hal ${i + 1}</strong><br>${file.name.substring(0, 20)}${file.name.length > 20 ? '...' : ''}`;
            
            previewDiv.appendChild(img);
            previewDiv.appendChild(info);
            imagePreviewList.appendChild(previewDiv);
        };
        
        reader.readAsDataURL(file);
    }
    
    previewContainer.style.display = 'block';
    step2Div.style.display = 'block';
    convertBtn.style.display = 'flex';
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
        processFiles(files);
    }
}, false);

dropArea.addEventListener('click', () => {
    imageFilesInput.click();
});

imageFilesInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        processFiles(e.target.files);
    }
});

convertBtn.addEventListener('click', async () => {
    if (selectedFiles.length === 0) {
        alert('Silakan pilih gambar terlebih dahulu!');
        return;
    }

    const pageSize = pageSizeSelect.value;

    convertBtn.disabled = true;
    convertBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Mengonversi...';
    progressContainer.style.display = 'block';
    statusP.textContent = 'Membuat dokumen PDF...';
    progressBarFill.style.width = '10%';

    try {
        const pdfDoc = await PDFLib.PDFDocument.create();
        
        for (let i = 0; i < selectedFiles.length; i++) {
            const progress = 10 + ((i / selectedFiles.length) * 80);
            statusP.textContent = `Memproses gambar ${i + 1} dari ${selectedFiles.length}...`;
            progressBarFill.style.width = `${progress}%`;

            const file = selectedFiles[i];
            const arrayBuffer = await file.arrayBuffer();
            
            // Embed gambar berdasarkan tipe
            let image;
            if (file.type === 'image/png') {
                image = await pdfDoc.embedPng(arrayBuffer);
            } else {
                image = await pdfDoc.embedJpg(arrayBuffer);
            }
            
            const imgWidth = image.width;
            const imgHeight = image.height;
            
            // Tentukan ukuran halaman
            let pageWidth, pageHeight;
            
            if (pageSize === 'fit') {
                // Sesuaikan dengan ukuran gambar
                pageWidth = imgWidth;
                pageHeight = imgHeight;
            } else if (pageSize === 'a4') {
                // A4: 595 x 842 points
                pageWidth = 595;
                pageHeight = 842;
            } else {
                // Letter: 612 x 792 points
                pageWidth = 612;
                pageHeight = 792;
            }
            
            const page = pdfDoc.addPage([pageWidth, pageHeight]);
            
            if (pageSize === 'fit') {
                // Gambar penuh pada halaman
                page.drawImage(image, {
                    x: 0,
                    y: 0,
                    width: pageWidth,
                    height: pageHeight
                });
            } else {
                // Fit gambar ke dalam halaman dengan mempertahankan aspect ratio
                const scale = Math.min(
                    (pageWidth - 40) / imgWidth,
                    (pageHeight - 40) / imgHeight
                );
                
                const scaledWidth = imgWidth * scale;
                const scaledHeight = imgHeight * scale;
                
                // Center gambar
                const x = (pageWidth - scaledWidth) / 2;
                const y = (pageHeight - scaledHeight) / 2;
                
                page.drawImage(image, {
                    x: x,
                    y: y,
                    width: scaledWidth,
                    height: scaledHeight
                });
            }
        }

        statusP.textContent = 'Menyimpan PDF...';
        progressBarFill.style.width = '95%';

        const pdfBytes = await pdfDoc.save();
        
        progressBarFill.style.width = '100%';

        setTimeout(() => {
            progressContainer.style.display = 'none';
            resultInfoDiv.style.display = 'block';

            pageCountSpan.textContent = selectedFiles.length;
            pdfSizeSpan.textContent = formatBytes(pdfBytes.length);

            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            downloadLink.href = url;
            
            const timestamp = new Date().getTime();
            downloadLink.download = `images-to-pdf-${timestamp}.pdf`;

            convertBtn.disabled = false;
            convertBtn.innerHTML = '<i class="fas fa-file-pdf"></i> Konversi ke PDF';
        }, 300);

    } catch (error) {
        console.error('Error:', error);
        alert('Error saat konversi: ' + error.message);
        statusP.textContent = `Error: ${error.message}`;
        progressContainer.style.display = 'none';
        convertBtn.disabled = false;
        convertBtn.innerHTML = '<i class="fas fa-file-pdf"></i> Coba Lagi';
    }
});