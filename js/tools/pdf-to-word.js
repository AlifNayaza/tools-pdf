// js/tools/pdf-to-word.js - antarmuka konversi PDF -> Word (.docx)
// Mesin konversi ada di pdf-to-word-core.js

(function () {
    'use strict';

    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.10.377/pdf.worker.min.js';

    const $ = id => document.getElementById(id);
    const pdfFileInput = $('pdfFile'), dropArea = $('dropArea'), convertBtn = $('convertBtn');
    const statusP = $('status'), progressBarFill = $('progressBarFill'), progressBar = $('progressBar');
    const step2 = $('step2'), fileInfo = $('fileInfo'), progressContainer = $('progressContainer'), resultInfo = $('resultInfo');
    const downloadLink = $('downloadLink'), resetBtn = $('resetBtn'), retryBtn = $('retryBtn');

    const MAX_FILE_SIZE = 100 * 1024 * 1024;
    const MAX_PAGES = 300;
    let originalFile = null;
    let busy = false;

    const tick = () => new Promise(r => setTimeout(r, 0));   // beri kesempatan browser menggambar ulang

    function formatBytes(bytes) {
        if (!bytes) return '0 Bytes';
        const k = 1024, sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    function notify(type, msg) {
        if (window.Toast && window.Toast[type]) window.Toast[type](msg);
        else alert(msg);
    }

    function setProgress(pct, text) {
        progressBarFill.style.width = pct + '%';
        progressBar.setAttribute('aria-valuenow', String(Math.round(pct)));
        if (text) statusP.textContent = text;
    }

    function resetUI() {
        step2.style.display = 'none';
        convertBtn.style.display = 'none';
        fileInfo.style.display = 'none';
        progressContainer.style.display = 'none';
        resultInfo.style.display = 'none';
        convertBtn.disabled = false;
        convertBtn.innerHTML = '<i class="fas fa-file-word" aria-hidden="true"></i> Konversi ke Word';
        setProgress(0);
    }

    function validate(file) {
        const errors = [];
        if (!file || !(file instanceof File)) errors.push('File tidak valid');
        else {
            if (file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name)) errors.push('File harus berformat PDF');
            if (file.size > MAX_FILE_SIZE) errors.push(`Ukuran file terlalu besar (maks ${formatBytes(MAX_FILE_SIZE)})`);
        }
        return { valid: errors.length === 0, errors };
    }

    async function processFile(file) {
        let validation = validate(file);
        if (validation.valid && window.FileValidator && window.FileValidator.validateFile) {
            try { validation = await window.FileValidator.validateFile(file); } catch (e) { /* pakai validasi dasar */ }
        }
        if (!validation.valid) {
            notify('error', 'File tidak valid: ' + validation.errors.join(', '));
            pdfFileInput.value = '';
            return;
        }

        originalFile = file;
        resetUI();
        let displayName = file.name;
        if (window.FileValidator && window.FileValidator.sanitizeFileName) displayName = window.FileValidator.sanitizeFileName(file.name);
        $('fileName').textContent = displayName;
        $('fileSize').textContent = formatBytes(file.size);
        $('filePages').textContent = '...';
        fileInfo.style.display = 'block';
        step2.style.display = 'block';
        convertBtn.style.display = 'flex';

        try {
            const data = new Uint8Array(await file.arrayBuffer());
            const doc = await pdfjsLib.getDocument({ data, disableFontFace: true }).promise;
            $('filePages').textContent = doc.numPages;
            if (doc.numPages > MAX_PAGES) {
                notify('warning', `PDF terlalu banyak halaman (maks ${MAX_PAGES} halaman)`);
                resetUI();
                originalFile = null;
            }
            doc.destroy();
        } catch (err) {
            $('filePages').textContent = 'Tidak dapat dibaca';
            if (/password/i.test(err && err.message)) notify('error', 'PDF diproteksi password. Buka proteksinya lebih dulu.');
        }
    }

    // ---- hooks gambar (butuh DOM/canvas) ----
    function imageToRGBA(img) {
        const w = img.width, h = img.height;
        const out = new Uint8ClampedArray(w * h * 4);
        const d = img.data;
        if (img.kind === 3 || (d.length === w * h * 4)) {            // RGBA
            out.set(d.subarray(0, out.length));
        } else if (img.kind === 2 || (d.length === w * h * 3)) {     // RGB
            for (let i = 0, j = 0; i < w * h; i++, j += 3) {
                out[i * 4] = d[j]; out[i * 4 + 1] = d[j + 1]; out[i * 4 + 2] = d[j + 2]; out[i * 4 + 3] = 255;
            }
        } else {                                                      // grayscale 1 bit
            const stride = (w + 7) >> 3;
            for (let y = 0; y < h; y++) {
                for (let x = 0; x < w; x++) {
                    const bit = (d[y * stride + (x >> 3)] >> (7 - (x & 7))) & 1;
                    const v = bit ? 255 : 0, o = (y * w + x) * 4;
                    out[o] = out[o + 1] = out[o + 2] = v; out[o + 3] = 255;
                }
            }
        }
        return new ImageData(out, w, h);
    }

    function canvasBytes(canvas, type, quality) {
        return new Promise((resolve, reject) => {
            canvas.toBlob(async b => {
                if (!b) return reject(new Error('Gagal membuat gambar'));
                resolve(new Uint8Array(await b.arrayBuffer()));
            }, type, quality);
        });
    }

    const imageCache = new Map();
    async function encodeImage(img) {
        if (imageCache.has(img)) return imageCache.get(img);
        let result = null;
        try {
            let src;
            if (img.bitmap) {
                src = document.createElement('canvas');
                src.width = img.bitmap.width; src.height = img.bitmap.height;
                src.getContext('2d').drawImage(img.bitmap, 0, 0);
            } else {
                src = document.createElement('canvas');
                src.width = img.width; src.height = img.height;
                src.getContext('2d').putImageData(imageToRGBA(img), 0, 0);
            }
            // perkecil gambar sangat besar agar file Word tidak membengkak
            const MAX = 2400;
            let canvas = src;
            const longest = Math.max(src.width, src.height);
            if (longest > MAX) {
                const f = MAX / longest;
                canvas = document.createElement('canvas');
                canvas.width = Math.round(src.width * f); canvas.height = Math.round(src.height * f);
                const cx = canvas.getContext('2d');
                cx.imageSmoothingQuality = 'high';
                cx.drawImage(src, 0, 0, canvas.width, canvas.height);
            }
            const px = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
            let hasAlpha = false;
            for (let i = 3; i < px.length; i += 4 * 17) if (px[i] < 250) { hasAlpha = true; break; }
            if (hasAlpha) result = { bytes: await canvasBytes(canvas, 'image/png'), ext: 'png' };
            else result = { bytes: await canvasBytes(canvas, 'image/jpeg', 0.9), ext: 'jpg' };
        } catch (e) {
            console.warn('Gambar dilewati:', e);
        }
        imageCache.set(img, result);
        return result;
    }

    async function renderPage(page, W, H) {
        try {
            const scale = Math.min(2.2, 2200 / Math.max(W, H));
            const viewport = page.getViewport({ scale });
            const canvas = document.createElement('canvas');
            canvas.width = Math.floor(viewport.width); canvas.height = Math.floor(viewport.height);
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
            await page.render({ canvasContext: ctx, viewport }).promise;
            return { bytes: await canvasBytes(canvas, 'image/jpeg', 0.85), ext: 'jpg' };
        } catch (e) {
            console.warn('Halaman scan gagal dirender:', e);
            return null;
        }
    }

    // ---- konversi ----
    async function convert() {
        if (!originalFile || busy) return;
        busy = true;
        const options = {
            pageBreaks: $('optPageBreaks').checked,
            removeHeaderFooter: $('optHeaderFooter').checked,
            includeImages: $('optImages').checked
        };

        convertBtn.disabled = true;
        convertBtn.innerHTML = '<i class="fas fa-spinner fa-spin" aria-hidden="true"></i> Mengonversi...';
        progressContainer.style.display = 'block';
        statusP.style.color = '';
        setProgress(2, 'Membaca PDF...');
        imageCache.clear();

        try {
            const data = new Uint8Array(await originalFile.arrayBuffer());
            const doc = await pdfjsLib.getDocument({ data, disableFontFace: true }).promise;
            const n = doc.numPages;
            const raw = [];
            for (let i = 1; i <= n; i++) {
                setProgress(2 + (i / n) * 60, `Membaca halaman ${i} dari ${n}...`);
                const page = await doc.getPage(i);
                raw.push(await PdfToWordCore.collectPage(page, pdfjsLib, options.includeImages ? { encodeImage: true } : {}));
                await tick();
            }

            setProgress(66, 'Menyusun paragraf, daftar, dan tabel...');
            await tick();
            const model = PdfToWordCore.buildModel(raw, options);

            setProgress(78, 'Membuat file Word...');
            await tick();
            const title = originalFile.name.replace(/\.pdf$/i, '');
            const bytes = await PdfToWordCore.buildDocx(model, JSZip, {
                title,
                encodeImage: options.includeImages ? encodeImage : null,
                renderPage: options.includeImages ? renderPage : null
            });
            setProgress(100, 'Selesai');

            const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
            if (downloadLink.dataset.url) URL.revokeObjectURL(downloadLink.dataset.url);
            const url = URL.createObjectURL(blob);
            downloadLink.href = url;
            downloadLink.dataset.url = url;
            downloadLink.download = title + '.docx';

            const st = model.stats;
            $('resPages').textContent = n;
            const parts = [`${st.paragraphs} paragraf`];
            if (st.tables) parts.push(`${st.tables} tabel`);
            if (st.images) parts.push(`${st.images} gambar`);
            $('resContent').textContent = parts.join(', ');
            $('resSize').textContent = formatBytes(bytes.length);

            const notes = [];
            const totalChars = raw.reduce((a, r) => a + r.charCount, 0);
            if (totalChars < 20 * n && st.scannedPages === 0) {
                notes.push('PDF ini hampir tidak berisi teks yang bisa dibaca. Kemungkinan hasil scan; fitur pengenalan teks (OCR) belum tersedia.');
            }
            if (st.scannedPages > 0) {
                notes.push(`${st.scannedPages} halaman berupa gambar hasil scan dimasukkan sebagai gambar, bukan teks yang bisa diedit (belum ada OCR).`);
            }
            notes.push('Periksa hasilnya di Word. Warna teks, kotak teks, dan rumus tidak ikut dibawa.');
            $('resNote').textContent = notes.join(' ');

            progressContainer.style.display = 'none';
            step2.style.display = 'none';
            convertBtn.style.display = 'none';
            resultInfo.style.display = 'block';
            setTimeout(() => resultInfo.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
            notify('success', 'PDF berhasil diubah ke Word.');
            doc.destroy();
        } catch (error) {
            console.error(error);
            const msg = /password/i.test(error.message) ? 'PDF diproteksi password' : error.message;
            statusP.textContent = 'Error: ' + msg;
            statusP.style.color = '#d10052';
            notify('error', 'Gagal mengonversi: ' + msg);
            convertBtn.disabled = false;
            convertBtn.innerHTML = '<i class="fas fa-file-word" aria-hidden="true"></i> Coba lagi';
        } finally {
            busy = false;
        }
    }

    // ---- event ----
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(ev => document.body.addEventListener(ev, e => { e.preventDefault(); e.stopPropagation(); }, false));
    ['dragenter', 'dragover'].forEach(ev => dropArea.addEventListener(ev, () => dropArea.classList.add('drag-over'), false));
    ['dragleave', 'drop'].forEach(ev => dropArea.addEventListener(ev, () => dropArea.classList.remove('drag-over'), false));
    dropArea.addEventListener('drop', async e => {
        const files = e.dataTransfer.files;
        if (files.length > 1) return notify('warning', 'Hanya bisa upload 1 file sekaligus');
        if (files.length) await processFile(files[0]);
    }, false);

    pdfFileInput.addEventListener('change', async e => {
        if (e.target.files.length) {
            await processFile(e.target.files[0]);
            e.target.value = '';
        }
    });

    convertBtn.addEventListener('click', convert);

    retryBtn.addEventListener('click', () => {
        if (!originalFile) return;
        resultInfo.style.display = 'none';
        step2.style.display = 'block';
        convertBtn.style.display = 'flex';
        convertBtn.disabled = false;
        convertBtn.innerHTML = '<i class="fas fa-file-word" aria-hidden="true"></i> Konversi ke Word';
        setProgress(0);
        step2.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });

    resetBtn.addEventListener('click', () => {
        resetUI();
        pdfFileInput.value = '';
        originalFile = null;
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
})();
