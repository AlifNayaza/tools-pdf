const htmlEditor = document.getElementById('htmlEditor');
const htmlPreview = document.getElementById('htmlPreview');
const convertBtn = document.getElementById('convertBtn');
const statusP = document.getElementById('status');
const progressBarFill = document.getElementById('progressBarFill');
const downloadLink = document.getElementById('downloadLink');
const resetBtn = document.getElementById('resetBtn');

const progressContainer = document.getElementById('progressContainer');
const resultInfoDiv = document.getElementById('resultInfo');
const pdfResultSizeSpan = document.getElementById('pdfResultSize');

function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function resetUI() {
    resultInfoDiv.style.display = 'none';
    progressContainer.style.display = 'none';
    convertBtn.style.display = 'flex';
    convertBtn.disabled = false;
    progressBarFill.style.width = '0%';
}

function handleHtmlReset() {
    resetUI();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}
window.handleHtmlReset = handleHtmlReset;

if (resetBtn) {
    resetBtn.addEventListener('click', (e) => {
        e.preventDefault();
        handleHtmlReset();
    });
}

// Initial sample content
htmlEditor.value = `<h1 style="color: #1e3a8a; text-align: center;">Laporan & Catatan PDF</h1>
<p style="font-size: 14px; line-height: 1.6; color: #334155;">Dokumen ini dibuat langsung dari editor HTML / Rich Text secara instan dan 100% presisi.</p>
<hr style="border: 1px solid #cbd5e1; margin: 16px 0;"/>
<h3 style="color: #1e40af;">Fitur Utama:</h3>
<ul style="line-height: 1.8; color: #1e293b;">
    <li>Mendukung tag HTML, judul, & styling CSS lengkap</li>
    <li>Menjaga format tabel, gambar, & warna teks</li>
    <li>Proses konversi langsung di browser</li>
</ul>`;

function updatePreview() {
    htmlPreview.innerHTML = htmlEditor.value;
}

htmlEditor.addEventListener('input', updatePreview);
updatePreview();

convertBtn.addEventListener('click', async () => {
    const content = htmlEditor.value.trim();
    if (!content) {
        if (window.Toast) window.Toast.warning('Masukkan teks atau kode HTML terlebih dahulu.');
        return;
    }

    convertBtn.disabled = true;
    convertBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Membuat PDF...';
    progressContainer.style.display = 'block';
    progressBarFill.style.width = '40%';
    statusP.textContent = 'Menyusun tampilan PDF...';

    try {
        const renderWrapper = document.createElement('div');
        renderWrapper.style.cssText = `
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            z-index: -99999 !important;
            width: 794px !important;
            padding: 48px 56px !important;
            background: #ffffff !important;
            color: #0f172a !important;
            font-family: 'Calibri', 'Segoe UI', Arial, sans-serif !important;
            box-sizing: border-box !important;
            opacity: 1 !important;
            pointer-events: none !important;
        `;
        renderWrapper.innerHTML = content;
        document.body.appendChild(renderWrapper);

        await new Promise(resolve => setTimeout(resolve, 300));

        progressBarFill.style.width = '75%';
        statusP.textContent = 'Merender file PDF presisi...';

        if (window.html2pdf) {
            const opt = {
                margin: [10, 10, 10, 10],
                filename: 'dokumen.pdf',
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true, logging: false },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
                pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
            };

            const pdfBlob = await window.html2pdf().set(opt).from(renderWrapper).output('blob');
            document.body.removeChild(renderWrapper);

            progressBarFill.style.width = '100%';
            progressContainer.style.display = 'none';
            convertBtn.style.display = 'none';
            resultInfoDiv.style.display = 'block';

            setTimeout(() => {
                resultInfoDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 50);

            pdfResultSizeSpan.textContent = formatBytes(pdfBlob.size);

            const url = URL.createObjectURL(pdfBlob);
            downloadLink.href = url;
            downloadLink.download = 'dokumen.pdf';

            convertBtn.disabled = false;
            convertBtn.innerHTML = '<i class="fas fa-file-pdf"></i> Konversi ke PDF';

            if (window.Toast) window.Toast.success('Dokumen PDF berhasil dibuat.');
        } else {
            document.body.removeChild(renderWrapper);
            throw new Error('Pustaka html2pdf belum dimuat.');
        }
    } catch (err) {
        console.error('HTML to PDF error:', err);
        if (window.Toast) window.Toast.error('Gagal membuat PDF: ' + err.message);
        convertBtn.disabled = false;
        convertBtn.innerHTML = '<i class="fas fa-file-pdf"></i> Coba Lagi';
    }
});
