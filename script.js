// Konfigurasi PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.10.377/pdf.worker.min.js';

// Ambil semua elemen UI
const pdfFileInput = document.getElementById('pdfFile');
const fileLabel = document.querySelector('.file-label');
const qualityInput = document.getElementById('quality');
const qualityValueSpan = document.getElementById('qualityValue');
const compressBtn = document.getElementById('compressBtn');
const statusP = document.getElementById('status');
const progressBarFill = document.getElementById('progressBarFill');
const downloadLink = document.getElementById('downloadLink');

// Elemen Kontainer
const step1Div = document.getElementById('step1');
const step2Div = document.getElementById('step2');
const fileInfoDiv = document.getElementById('fileInfo');
const progressContainer = document.getElementById('progressContainer');
const resultInfoDiv = document.getElementById('resultInfo');

// Elemen untuk menampilkan info
const fileNameSpan = document.getElementById('fileName');
const fileSizeSpan = document.getElementById('fileSize');
const filePagesSpan = document.getElementById('filePages');
const originalSizeSpan = document.getElementById('originalSize');
const newSizeSpan = document.getElementById('newSize');
const sizeSavingsSpan = document.getElementById('sizeSavings');

let originalFile = null;

// Helper function untuk format ukuran byte
function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Reset UI ke keadaan awal
function resetUI() {
    step2Div.style.display = 'none';
    compressBtn.style.display = 'none';
    fileInfoDiv.style.display = 'none';
    progressContainer.style.display = 'none';
    resultInfoDiv.style.display = 'none';
    compressBtn.disabled = false;
    progressBarFill.style.width = '0%';
}

// Event listener saat file dipilih
pdfFileInput.addEventListener('change', async (e) => {
    if (e.target.files.length === 0) {
        resetUI();
        return;
    }
    
    originalFile = e.target.files[0];
    resetUI();

    // Tampilkan info file
    fileNameSpan.textContent = originalFile.name;
    fileSizeSpan.textContent = formatBytes(originalFile.size);
    fileInfoDiv.style.display = 'block';
    
    // Tampilkan langkah selanjutnya
    step2Div.style.display = 'block';
    compressBtn.style.display = 'flex';

    // Baca PDF untuk mendapatkan jumlah halaman
    const fileReader = new FileReader();
    fileReader.readAsArrayBuffer(originalFile);
    fileReader.onload = async (event) => {
        try {
            const pdfData = new Uint8Array(event.target.result);
            const pdfDoc = await pdfjsLib.getDocument({ data: pdfData }).promise;
            filePagesSpan.textContent = pdfDoc.numPages;
        } catch (error) {
            filePagesSpan.textContent = 'Tidak dapat membaca halaman';
        }
    };
});

// Update nilai kualitas slider
qualityInput.addEventListener('input', () => {
    qualityValueSpan.textContent = qualityInput.value;
});

// Event listener utama untuk tombol kompres
compressBtn.addEventListener('click', async () => {
    if (!originalFile) {
        alert('Silakan pilih file terlebih dahulu!');
        return;
    }

    const quality = parseFloat(qualityInput.value);

    // Siapkan UI untuk proses kompresi
    compressBtn.disabled = true;
    compressBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Mengompres...';
    progressContainer.style.display = 'block';

    try {
        const fileReader = new FileReader();
        fileReader.readAsArrayBuffer(originalFile);
        
        fileReader.onload = async (event) => {
            const pdfData = new Uint8Array(event.target.result);
            const pdfDoc = await pdfjsLib.getDocument({ data: pdfData }).promise;
            const newPdfDoc = await PDFLib.PDFDocument.create();
            const numPages = pdfDoc.numPages;

            // Loop setiap halaman
            for (let i = 1; i <= numPages; i++) {
                const progress = (i / numPages) * 100;
                statusP.textContent = `Memproses halaman ${i} dari ${numPages}...`;
                progressBarFill.style.width = `${progress}%`;

                const page = await pdfDoc.getPage(i);
                const viewport = page.getViewport({ scale: 1.5 });
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                canvas.height = viewport.height;
                canvas.width = viewport.width;

                await page.render({ canvasContext: context, viewport: viewport }).promise;

                const jpegDataUrl = canvas.toDataURL('image/jpeg', quality);
                const jpegImageBytes = await fetch(jpegDataUrl).then(res => res.arrayBuffer());
                const jpegImage = await newPdfDoc.embedJpg(jpegImageBytes);
                const newPage = newPdfDoc.addPage([jpegImage.width, jpegImage.height]);
                newPage.drawImage(jpegImage, { x: 0, y: 0, width: jpegImage.width, height: jpegImage.height });
            }

            // Simpan PDF baru
            const newPdfBytes = await newPdfDoc.save();

            // Tampilkan hasil
            progressContainer.style.display = 'none';
            resultInfoDiv.style.display = 'block';

            const originalSizeBytes = originalFile.size;
            const newSizeBytes = newPdfBytes.length;
            const savingsPercent = 100 - (newSizeBytes / originalSizeBytes * 100);

            originalSizeSpan.textContent = formatBytes(originalSizeBytes);
            newSizeSpan.textContent = formatBytes(newSizeBytes);
            sizeSavingsSpan.textContent = `${savingsPercent.toFixed(2)}%`;

            // Buat link unduhan
            const blob = new Blob([newPdfBytes], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            downloadLink.href = url;
            downloadLink.download = `terkompresi_${originalFile.name}`;

            // Reset tombol
            compressBtn.disabled = false;
            compressBtn.innerHTML = '<i class="fas fa-cogs"></i> Mulai Kompresi';
        };
    } catch (error) {
        console.error(error);
        statusP.textContent = `Error: ${error.message}`;
        compressBtn.disabled = false;
        compressBtn.innerHTML = '<i class="fas fa-cogs"></i> Coba Lagi';
    }
});