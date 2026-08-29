pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.10.377/pdf.worker.min.js';

const pdfFileInput = document.getElementById('pdfFile');
const dropArea = document.getElementById('dropArea');
const extractBtn = document.getElementById('extractBtn');
const statusP = document.getElementById('status');
const progressBarFill = document.getElementById('progressBarFill');
const fileInfoDiv = document.getElementById('fileInfo');
const progressContainer = document.getElementById('progressContainer');
const resultInfoDiv = document.getElementById('resultInfo');
const extractedTextArea = document.getElementById('extractedTextArea');
const copyBtn = document.getElementById('copyBtn');
const downloadTxtBtn = document.getElementById('downloadTxtBtn');
const downloadMdBtn = document.getElementById('downloadMdBtn');
const resetBtn = document.getElementById('resetBtn');

const fileNameSpan = document.getElementById('fileName');
const filePagesSpan = document.getElementById('filePages');

let originalFile = null;
let extractedText = '';
const MAX_FILE_SIZE = 100 * 1024 * 1024;

function resetUI() {
    extractBtn.style.display = 'none';
    fileInfoDiv.style.display = 'none';
    progressContainer.style.display = 'none';
    resultInfoDiv.style.display = 'none';
    extractBtn.disabled = false;
    progressBarFill.style.width = '0%';
    extractedText = '';
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
    extractBtn.style.display = 'flex';

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const pdfData = new Uint8Array(e.target.result);
            const pdfDoc = await pdfjsLib.getDocument({ data: pdfData }).promise;
            filePagesSpan.textContent = pdfDoc.numPages;
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
    if (e.target.files.length > 0) {
        processFile(e.target.files[0]);
    }
});

function handlePdfToTextReset() {
    resetUI();
    pdfFileInput.value = '';
    originalFile = null;
    extractedTextArea.value = '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
}
window.handlePdfToTextReset = handlePdfToTextReset;

if (resetBtn) {
    resetBtn.addEventListener('click', (e) => {
        e.preventDefault();
        handlePdfToTextReset();
    });
}

extractBtn.addEventListener('click', async () => {
    if (!originalFile) return;

    extractBtn.disabled = true;
    extractBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Mengekstrak...';
    progressContainer.style.display = 'block';

    try {
        const reader = new FileReader();
        reader.onload = async (e) => {
            const pdfData = new Uint8Array(e.target.result);
            const pdfDoc = await pdfjsLib.getDocument({ data: pdfData }).promise;
            const numPages = pdfDoc.numPages;

            let textBuilder = [];
            textBuilder.push(`# ${originalFile.name.replace('.pdf', '')}\n\n`);

            for (let i = 1; i <= numPages; i++) {
                const progress = (i / numPages) * 100;
                statusP.textContent = `Mengekstrak teks halaman ${i} dari ${numPages}...`;
                progressBarFill.style.width = `${progress}%`;

                const page = await pdfDoc.getPage(i);
                const textContent = await page.getTextContent();
                const pageText = textContent.items.map(item => item.str).join(' ');

                textBuilder.push(`--- HALAMAN ${i} ---\n\n${pageText}\n\n`);
            }

            extractedText = textBuilder.join('');
            extractedTextArea.value = extractedText;

            progressContainer.style.display = 'none';
            extractBtn.style.display = 'none';
            resultInfoDiv.style.display = 'block';

            setTimeout(() => {
                resultInfoDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 50);

            extractBtn.disabled = false;
            extractBtn.innerHTML = '<i class="fas fa-quote-left"></i> Ekstrak Teks';

            if (window.Toast) window.Toast.success(`Teks dari ${numPages} halaman berhasil diekstrak.`);
        };
        reader.readAsArrayBuffer(originalFile);
    } catch (err) {
        if (window.Toast) window.Toast.error('Gagal mengekstrak teks: ' + err.message);
        extractBtn.disabled = false;
        extractBtn.innerHTML = '<i class="fas fa-quote-left"></i> Coba Lagi';
    }
});

copyBtn.addEventListener('click', () => {
    if (!extractedText) return;
    navigator.clipboard.writeText(extractedText);
    if (window.Toast) window.Toast.success('Teks berhasil disalin.');
});

downloadTxtBtn.addEventListener('click', () => {
    if (!extractedText) return;
    const blob = new Blob([extractedText], { type: 'text/plain;charset=utf-8' });
    downloadBlob(blob, `${originalFile.name.replace('.pdf', '')}.txt`);
});

downloadMdBtn.addEventListener('click', () => {
    if (!extractedText) return;
    const blob = new Blob([extractedText], { type: 'text/markdown;charset=utf-8' });
    downloadBlob(blob, `${originalFile.name.replace('.pdf', '')}.md`);
});

function downloadBlob(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
