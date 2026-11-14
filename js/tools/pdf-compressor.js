// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.10.377/pdf.worker.min.js';

const pdfFileInput = document.getElementById('pdfFile');
const dropArea = document.getElementById('dropArea');
const compressBtn = document.getElementById('compressBtn');
const statusP = document.getElementById('status');
const progressBarFill = document.getElementById('progressBarFill');
const downloadLink = document.getElementById('downloadLink');
const resetBtn = document.getElementById('resetBtn');
const retryBtn = document.getElementById('retryBtn');

const step2Div = document.getElementById('step2');
const fileInfoDiv = document.getElementById('fileInfo');
const progressContainer = document.getElementById('progressContainer');
const resultInfoDiv = document.getElementById('resultInfo');

const fileNameSpan = document.getElementById('fileName');
const fileSizeSpan = document.getElementById('fileSize');
const filePagesSpan = document.getElementById('filePages');
const originalSizeSpan = document.getElementById('originalSize');
const newSizeSpan = document.getElementById('newSize');
const sizeSavingsSpan = document.getElementById('sizeSavings');

let originalFile = null;
const MAX_FILE_SIZE = 100 * 1024 * 1024;

let fileValidatorReady = false;

function waitForFileValidator() {
    return new Promise((resolve) => {
        if (window.FileValidator) {
            fileValidatorReady = true;
            resolve();
            return;
        }
        const checkInterval = setInterval(() => {
            if (window.FileValidator) {
                fileValidatorReady = true;
                clearInterval(checkInterval);
                resolve();
            }
        }, 100);
        setTimeout(() => {
            clearInterval(checkInterval);
            resolve();
        }, 3000);
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    await waitForFileValidator();
});

function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function resetUI() {
    if (retryBtn) retryBtn.style.display = 'none';
    step2Div.style.display = 'none';
    compressBtn.style.display = 'none';
    fileInfoDiv.style.display = 'none';
    progressContainer.style.display = 'none';
    resultInfoDiv.style.display = 'none';
    compressBtn.disabled = false;
    progressBarFill.style.width = '0%';
}

function basicValidateFile(file) {
    const errors = [];
    if (!file || !(file instanceof File)) {
        errors.push('File tidak valid');
        return { valid: false, errors };
    }
    if (file.type !== 'application/pdf') {
        errors.push('File harus berformat PDF');
    }
    if (file.size > MAX_FILE_SIZE) {
        errors.push(`Ukuran file terlalu besar (max ${formatBytes(MAX_FILE_SIZE)})`);
    }
    return { valid: errors.length === 0, errors: errors };
}

async function processFile(file) {
    let validation;
    if (fileValidatorReady && window.FileValidator) {
        validation = await window.FileValidator.validateFile(file);
    } else {
        validation = basicValidateFile(file);
    }
    
    if (!validation.valid) {
        if (window.Toast) window.Toast.error('File tidak valid: ' + validation.errors.join(', '));
        else alert('❌ File tidak valid!\n\n' + validation.errors.join('\n'));
        pdfFileInput.value = '';
        return;
    }

    originalFile = file;
    resetUI();

    let displayName = file.name;
    if (fileValidatorReady && window.FileValidator) {
        displayName = window.FileValidator.sanitizeFileName(file.name);
    }
    
    fileNameSpan.textContent = displayName;
    fileSizeSpan.textContent = formatBytes(originalFile.size);
    fileInfoDiv.style.display = 'block';
    step2Div.style.display = 'block';
    compressBtn.style.display = 'flex';

    const fileReader = new FileReader();
    fileReader.readAsArrayBuffer(originalFile);
    fileReader.onload = async (event) => {
        try {
            const pdfData = new Uint8Array(event.target.result);
            const pdfDoc = await pdfjsLib.getDocument({ data: pdfData }).promise;
            
            if (pdfDoc.numPages > 500) {
                if (window.Toast) window.Toast.warning('PDF terlalu banyak halaman (max 500 halaman)');
                else alert('⚠️ PDF terlalu banyak halaman (max 500 halaman)');
                resetUI();
                return;
            }
            filePagesSpan.textContent = pdfDoc.numPages;
        } catch (error) {
            filePagesSpan.textContent = 'Tidak dapat membaca halaman';
        }
    };
}

// Global Drag & Drop Prevention (Mencegah file terbuka langsung di browser)
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    document.body.addEventListener(eventName, preventDefaults, false);
});

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

// Khusus efek untuk Drop Area
['dragenter', 'dragover'].forEach(eventName => {
    dropArea.addEventListener(eventName, () => dropArea.classList.add('drag-over'), false);
});

['dragleave', 'drop'].forEach(eventName => {
    dropArea.addEventListener(eventName, () => dropArea.classList.remove('drag-over'), false);
});

dropArea.addEventListener('drop', async (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    
    if (files.length > 1) {
        if (window.Toast) window.Toast.warning('Hanya bisa upload 1 file sekaligus');
        else alert('⚠️ Hanya bisa upload 1 file sekaligus');
        return;
    }
    if (files.length > 0) {
        await processFile(files[0]);
    }
}, false);

// EVENT INI DIHAPUS karena menyebabkan bentrok dengan tag <label> bawaan HTML
// dropArea.addEventListener('click', () => { pdfFileInput.click(); });

pdfFileInput.addEventListener('change', async (e) => {
    if (e.target.files.length > 0) {
        await processFile(e.target.files[0]);
        // Reset input agar file yang sama bisa dipilih ulang jika terjadi error
        e.target.value = ''; 
    }
});

function handlePdfCompressorReset() {
    resetUI();
    pdfFileInput.value = '';
    originalFile = null;
    window.scrollTo({ top: 0, behavior: 'smooth' });
}
window.handlePdfCompressorReset = handlePdfCompressorReset;

if (resetBtn) {
    resetBtn.addEventListener('click', (e) => {
        e.preventDefault();
        handlePdfCompressorReset();
    });
}


// ============================================================
// KOMPRESI STRUKTURAL
// Teks, font, dan vektor TIDAK di-rasterisasi (tetap tajam).
// Hanya gambar di dalam PDF yang di-downscale ke DPI target
// (tidak pernah di-upscale) lalu di-encode ulang sebagai JPEG.
// ============================================================

const MIN_IMAGE_BYTES = 8 * 1024;       // gambar lebih kecil dari ini dilewati
const MIN_FLATE_BYTES = 40 * 1024;      // gambar Flate (lossless) hanya dikonversi bila cukup besar

// Tingkat kompresi. "maksimal" = pilihan 3: gambar diperkecil ~15% + kualitas JPEG diturunkan
// (tidak pernah lebih tinggi dari kualitas JPEG aslinya, supaya file tidak malah membesar).
const LEVELS = {
    ringan:   { label: 'Ringan',   dpi: 220, jpegQuality: 0.85, flateQuality: 0.85, relScale: 1 },
    seimbang: { label: 'Seimbang', dpi: 150, jpegQuality: 0.72, flateQuality: 0.8,  relScale: 1 },
    maksimal: { label: 'Maksimal', dpi: 110, jpegQuality: 0.5,  flateQuality: 0.7,  relScale: 0.85 }
};

function getSelectedLevel() {
    const checked = document.querySelector('input[name="level"]:checked');
    return checked && LEVELS[checked.value] ? checked.value : 'seimbang';
}

function getSettings(level) {
    return LEVELS[level] || LEVELS.seimbang;
}

// Perkirakan kualitas JPEG (0..1) dari tabel kuantisasi luma pertama (skala IJG)
const STD_LUMA_SUM = [
    16,11,10,16,24,40,51,61, 12,12,14,19,26,58,60,55, 14,13,16,24,40,57,69,56, 14,17,22,29,51,87,80,62,
    18,22,37,56,68,109,103,77, 24,35,55,64,81,104,113,92, 49,64,78,87,103,121,120,101, 72,92,95,98,112,100,103,99
].reduce((a, b) => a + b, 0);

function estimateJpegQuality(bytes) {
    try {
        let i = 2;
        while (i + 4 < bytes.length) {
            if (bytes[i] !== 0xFF) { i++; continue; }
            const marker = bytes[i + 1];
            if (marker === 0xDA) break; // mulai data gambar
            const len = (bytes[i + 2] << 8) | bytes[i + 3];
            if (marker === 0xDB) {
                let p = i + 4;
                const end = i + 2 + len;
                while (p < end) {
                    const precision = bytes[p] >> 4, id = bytes[p] & 15;
                    p++;
                    if (precision !== 0) return 1;   // 16-bit: abaikan
                    if (id === 0) {
                        let sum = 0;
                        for (let k = 0; k < 64; k++) sum += bytes[p + k];
                        const scale = sum * 100 / STD_LUMA_SUM;
                        const q = scale <= 100 ? (200 - scale) / 2 : 5000 / scale;
                        return Math.min(1, Math.max(0.05, q / 100));
                    }
                    p += 64;
                }
            }
            i += 2 + len;
        }
    } catch (e) { /* abaikan */ }
    return 1;
}

function nameOf(obj) {
    return obj instanceof PDFLib.PDFName ? obj.decodeText() : null;
}

function getFilters(dict) {
    const f = dict.lookup(PDFLib.PDFName.of('Filter'));
    if (!f) return [];
    if (f instanceof PDFLib.PDFName) return [nameOf(f)];
    if (f instanceof PDFLib.PDFArray) {
        return f.asArray().map(x => nameOf(dict.context.lookup(x)));
    }
    return [null];
}

// Jumlah komponen warna: 1 (gray), 3 (rgb), 4 (cmyk) atau 0 (tidak didukung, mis. Indexed/Separation)
function getComponents(dict) {
    const ctx = dict.context;
    const cs = dict.lookup(PDFLib.PDFName.of('ColorSpace'));
    if (cs instanceof PDFLib.PDFName) {
        const n = nameOf(cs);
        if (n === 'DeviceGray' || n === 'CalGray') return 1;
        if (n === 'DeviceRGB' || n === 'CalRGB') return 3;
        if (n === 'DeviceCMYK') return 4;
        return 0;
    }
    if (cs instanceof PDFLib.PDFArray && cs.size() >= 2) {
        const kind = nameOf(ctx.lookup(cs.get(0)));
        if (kind === 'ICCBased') {
            const prof = ctx.lookup(cs.get(1));
            const n = prof && prof.dict ? prof.dict.lookup(PDFLib.PDFName.of('N')) : null;
            return n && typeof n.asNumber === 'function' ? n.asNumber() : 0;
        }
        if (kind === 'CalGray') return 1;
        if (kind === 'CalRGB') return 3;
    }
    return 0;
}

function numberOf(dict, key) {
    const v = dict.lookup(PDFLib.PDFName.of(key));
    return v && typeof v.asNumber === 'function' ? v.asNumber() : null;
}

async function inflate(bytes) {
    const ds = new DecompressionStream('deflate');
    const stream = new Blob([bytes]).stream().pipeThrough(ds);
    return new Uint8Array(await new Response(stream).arrayBuffer());
}

// Balikkan filter PNG predictor (Predictor >= 10)
function unpredictPng(data, columns, colors) {
    const bpp = colors;                   // 8 bit per komponen
    const rowBytes = columns * colors;
    const rows = Math.floor(data.length / (rowBytes + 1));
    const out = new Uint8Array(rows * rowBytes);
    for (let y = 0; y < rows; y++) {
        const ft = data[y * (rowBytes + 1)];
        const src = y * (rowBytes + 1) + 1;
        const dst = y * rowBytes;
        const prev = dst - rowBytes;
        for (let x = 0; x < rowBytes; x++) {
            const raw = data[src + x];
            const a = x >= bpp ? out[dst + x - bpp] : 0;
            const b = y > 0 ? out[prev + x] : 0;
            const c = (x >= bpp && y > 0) ? out[prev + x - bpp] : 0;
            let v;
            switch (ft) {
                case 0: v = raw; break;
                case 1: v = raw + a; break;
                case 2: v = raw + b; break;
                case 3: v = raw + ((a + b) >> 1); break;
                case 4: {
                    const p = a + b - c;
                    const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
                    v = raw + (pa <= pb && pa <= pc ? a : (pb <= pc ? b : c));
                    break;
                }
                default: v = raw;
            }
            out[dst + x] = v & 255;
        }
    }
    return out;
}

// Bytes JPEG/Flate -> sumber gambar yang bisa digambar ke canvas
async function loadSource(stream, dict, filters, comps, width, height) {
    if (filters[0] === 'DCTDecode') {
        const blob = new Blob([stream.contents], { type: 'image/jpeg' });
        let bmp;
        try { bmp = await createImageBitmap(blob, { imageOrientation: 'none' }); }
        catch (e) { bmp = await createImageBitmap(blob); }
        return { source: bmp, w: bmp.width, h: bmp.height };
    }

    // FlateDecode (lossless) -> piksel mentah
    let raw = await inflate(stream.contents);
    const parms = dict.lookup(PDFLib.PDFName.of('DecodeParms'));
    const parmDict = parms instanceof PDFLib.PDFDict ? parms : null;
    const predictor = parmDict ? (numberOf(parmDict, 'Predictor') || 1) : 1;
    if (predictor >= 10) {
        const columns = numberOf(parmDict, 'Columns') || width;
        const colors = numberOf(parmDict, 'Colors') || comps;
        raw = unpredictPng(raw, columns, colors);
    } else if (predictor !== 1) {
        return null; // TIFF predictor tidak didukung
    }
    if (raw.length < width * height * comps) return null;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(width, height);
    const d = img.data;
    const n = width * height;
    if (comps === 3) {
        for (let i = 0, s = 0, o = 0; i < n; i++, s += 3, o += 4) {
            d[o] = raw[s]; d[o + 1] = raw[s + 1]; d[o + 2] = raw[s + 2]; d[o + 3] = 255;
        }
    } else {
        for (let i = 0, o = 0; i < n; i++, o += 4) {
            const g = raw[i];
            d[o] = g; d[o + 1] = g; d[o + 2] = g; d[o + 3] = 255;
        }
    }
    ctx.putImageData(img, 0, 0);
    return { source: canvas, w: width, h: height };
}

// Downscale bertahap (halving) agar hasil tajam dan tidak aliasing
function resample(source, w, h, tw, th) {
    let cur = source, cw = w, ch = h;
    while (cw / 2 >= tw && ch / 2 >= th) {
        const nw = Math.max(1, Math.round(cw / 2)), nh = Math.max(1, Math.round(ch / 2));
        const c = document.createElement('canvas');
        c.width = nw; c.height = nh;
        const x = c.getContext('2d');
        x.imageSmoothingEnabled = true;
        x.imageSmoothingQuality = 'high';
        x.drawImage(cur, 0, 0, nw, nh);
        cur = c; cw = nw; ch = nh;
    }
    const out = document.createElement('canvas');
    out.width = tw; out.height = th;
    const ox = out.getContext('2d');
    ox.fillStyle = '#fff';
    ox.fillRect(0, 0, tw, th);
    ox.imageSmoothingEnabled = true;
    ox.imageSmoothingQuality = 'high';
    ox.drawImage(cur, 0, 0, tw, th);
    return out;
}

function canvasToJpeg(canvas, q) {
    return new Promise((resolve, reject) => {
        canvas.toBlob(async (b) => {
            if (!b) return reject(new Error('Gagal encode JPEG'));
            resolve(new Uint8Array(await b.arrayBuffer()));
        }, 'image/jpeg', q);
    });
}

// Peta: ref gambar -> ukuran sisi terpanjang halaman terbesar yang memakainya (dalam pt)
function mapImagePageSizes(pdfDoc) {
    const { PDFName, PDFDict, PDFRef } = PDFLib;
    const map = new Map();
    let docMax = 0;
    for (const page of pdfDoc.getPages()) {
        const { width, height } = page.getSize();
        const longSide = Math.max(width, height);
        docMax = Math.max(docMax, longSide);
        const res = page.node.Resources();
        const xo = res ? res.lookupMaybe(PDFName.of('XObject'), PDFDict) : undefined;
        if (!xo) continue;
        for (const [, val] of xo.entries()) {
            if (val instanceof PDFRef) {
                const k = val.toString();
                map.set(k, Math.max(map.get(k) || 0, longSide));
            }
        }
    }
    return { map, docMax: docMax || 842 };
}

async function optimizeImages(pdfDoc, level, onProgress) {
    const { PDFName, PDFRawStream, PDFNumber } = PDFLib;
    const settings = getSettings(level);
    const { map: pageSizes, docMax } = mapImagePageSizes(pdfDoc);
    const ctx = pdfDoc.context;

    const targets = [];
    for (const [ref, obj] of ctx.enumerateIndirectObjects()) {
        if (!(obj instanceof PDFRawStream)) continue;
        const d = obj.dict;
        if (nameOf(d.lookup(PDFName.of('Subtype'))) !== 'Image') continue;
        targets.push([ref, obj]);
    }

    let optimized = 0;
    for (let i = 0; i < targets.length; i++) {
        const [ref, stream] = targets[i];
        onProgress(i + 1, targets.length);
        await new Promise(r => setTimeout(r, 0));   // beri browser kesempatan memperbarui progress bar
        try {
            const dict = stream.dict;
            const filters = getFilters(dict);
            if (filters.length !== 1 || (filters[0] !== 'DCTDecode' && filters[0] !== 'FlateDecode')) continue;
            if (dict.lookup(PDFName.of('ImageMask')) === PDFLib.PDFBool.True) continue;
            if (dict.has(PDFName.of('Decode')) || dict.has(PDFName.of('Mask'))) continue;

            const isJpeg = filters[0] === 'DCTDecode';
            const origSize = stream.contents.length;
            if (origSize < (isJpeg ? MIN_IMAGE_BYTES : MIN_FLATE_BYTES)) continue;

            const comps = getComponents(dict);
            if (comps !== 1 && comps !== 3) continue; // CMYK / Indexed / dll dilewati
            const width = numberOf(dict, 'Width');
            const height = numberOf(dict, 'Height');
            const bpc = numberOf(dict, 'BitsPerComponent') || 8;
            if (!width || !height || bpc !== 8) continue;

            // Resolusi target: jangan melebihi DPI target pada halaman tempat gambar dipakai
            const pageLong = pageSizes.get(ref.toString()) || docMax;
            const maxPx = Math.max(64, Math.round(pageLong * settings.dpi / 72));
            const longSide = Math.max(width, height);
            const ratio = Math.min(longSide > maxPx ? maxPx / longSide : 1, settings.relScale);
            const tw = Math.max(1, Math.round(width * ratio));
            const th = Math.max(1, Math.round(height * ratio));

            const src = await loadSource(stream, dict, filters, comps, width, height);
            if (!src) continue;

            let canvas;
            if (ratio < 1 || !isJpeg) {
                canvas = resample(src.source, src.w, src.h, tw, th);
            } else {
                canvas = document.createElement('canvas');
                canvas.width = src.w; canvas.height = src.h;
                canvas.getContext('2d').drawImage(src.source, 0, 0);
            }
            if (src.source.close) src.source.close();

            // Gambar lossless (screenshot/diagram) dijaga kualitasnya lebih tinggi
            const q = isJpeg
                ? Math.min(settings.jpegQuality, Math.max(0.15, estimateJpegQuality(stream.contents)))
                : settings.flateQuality;
            const jpeg = await canvasToJpeg(canvas, q);

            // Ganti hanya jika benar-benar lebih kecil
            const limit = ratio < 1 ? 0.95 : (isJpeg ? 0.85 : 0.7);
            if (jpeg.length >= origSize * limit) continue;

            const newDict = ctx.obj({
                Type: 'XObject',
                Subtype: 'Image',
                Width: canvas.width,
                Height: canvas.height,
                ColorSpace: 'DeviceRGB',
                BitsPerComponent: 8,
                Filter: 'DCTDecode'
            });
            // pertahankan transparansi (SMask) dan Interpolate bila ada
            const smask = dict.get(PDFName.of('SMask'));
            if (smask) newDict.set(PDFName.of('SMask'), smask);
            const interp = dict.get(PDFName.of('Interpolate'));
            if (interp) newDict.set(PDFName.of('Interpolate'), interp);

            ctx.assign(ref, PDFRawStream.of(newDict, jpeg));
            optimized++;
        } catch (e) {
            console.warn('Gambar dilewati:', e);
        }
    }
    return { optimized, total: targets.length };
}

compressBtn.addEventListener('click', async () => {
    if (!originalFile) {
        if (window.Toast) window.Toast.warning('Silakan pilih file terlebih dahulu!');
        else alert('Silakan pilih file terlebih dahulu!');
        return;
    }

    const level = getSelectedLevel();
    compressBtn.disabled = true;
    compressBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Mengompres...';
    progressContainer.style.display = 'block';
    statusP.style.color = '';
    statusP.textContent = 'Membaca PDF...';
    progressBarFill.style.width = '5%';

    try {
        const originalBuffer = await originalFile.arrayBuffer();
        const pdfDoc = await PDFLib.PDFDocument.load(originalBuffer, { updateMetadata: false });

        const stats = await optimizeImages(pdfDoc, level, (cur, total) => {
            statusP.textContent = `Mengoptimalkan gambar ${cur} dari ${total}...`;
            progressBarFill.style.width = `${5 + (cur / total) * 85}%`;
        });

        statusP.textContent = 'Menyimpan PDF...';
        progressBarFill.style.width = '95%';
        const newPdfBytes = await pdfDoc.save({ useObjectStreams: true, addDefaultPage: false });
        progressBarFill.style.width = '100%';

        progressContainer.style.display = 'none';
        step2Div.style.display = 'none';
        compressBtn.style.display = 'none';
        resultInfoDiv.style.display = 'block';

        setTimeout(() => {
            resultInfoDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 50);

        const originalSizeBytes = originalFile.size;
        const newSizeBytes = newPdfBytes.length;
        const savingsPercent = 100 - (newSizeBytes / originalSizeBytes * 100);

        originalSizeSpan.textContent = formatBytes(originalSizeBytes);

        const downloadName = originalFile.name;
        if (downloadLink.dataset.url) URL.revokeObjectURL(downloadLink.dataset.url);

        let url;
        if (newSizeBytes >= originalSizeBytes) {
            // Tidak ada yang bisa dihemat — kembalikan file asli, jangan merusak kualitas
            newSizeSpan.textContent = formatBytes(originalSizeBytes);
            sizeSavingsSpan.textContent = '0%';
            url = URL.createObjectURL(new Blob([originalBuffer], { type: 'application/pdf' }));
            downloadLink.download = downloadName;
        } else {
            newSizeSpan.textContent = formatBytes(newSizeBytes);
            sizeSavingsSpan.textContent = `${savingsPercent.toFixed(2)}%`;
            url = URL.createObjectURL(new Blob([newPdfBytes], { type: 'application/pdf' }));
            downloadLink.download = `compressed_${downloadName}`;
        }
        downloadLink.href = url;
        downloadLink.dataset.url = url;

        const noteEl = document.getElementById('compressNote');
        const hemat = Math.max(0, savingsPercent);
        const nextLevel = level === 'ringan' ? 'seimbang' : (level === 'seimbang' ? 'maksimal' : null);
        let note;
        if (stats.total === 0) {
            note = 'PDF ini tidak berisi gambar (hanya teks, font, dan vektor), jadi tingkat kompresi tidak berpengaruh. Ukurannya sudah dekat batas minimum tanpa merusak kualitas.';
        } else if (hemat < 5) {
            note = `Ditemukan ${stats.total} gambar, tetapi hampir tidak ada yang bisa diperkecil di tingkat ${LEVELS[level].label}.`;
            note += nextLevel
                ? ` Coba tingkat ${LEVELS[nextLevel].label} (kualitas gambar sedikit berkurang).`
                : ' Gambar di PDF ini sudah terkompresi sangat kuat, jadi sudah dekat batas tanpa membuatnya blur.';
        } else {
            note = `${stats.optimized} dari ${stats.total} gambar dioptimalkan (tingkat ${LEVELS[level].label}). Teks dan vektor tidak diubah.`;
        }
        if (noteEl) noteEl.textContent = note;
        if (retryBtn) retryBtn.style.display = level === 'maksimal' && stats.total > 0 ? 'none' : 'flex';
        if (hemat < 5 && nextLevel) {
            const radio = document.querySelector(`input[name="level"][value="${nextLevel}"]`);
            if (radio) radio.checked = true;
        }

        compressBtn.disabled = false;
        compressBtn.innerHTML = '<i class="fas fa-cogs"></i> Mulai Kompresi';

        if (window.Toast) window.Toast.success('File PDF berhasil dikompres.');
    } catch (error) {
        console.error(error);
        const msg = /encrypt/i.test(error.message) ? 'PDF terenkripsi/diproteksi password' : error.message;
        if (window.Toast) window.Toast.error('Gagal mengompres PDF: ' + msg);
        statusP.textContent = `Error: ${msg}`;
        statusP.style.color = '#ff006e';
        progressContainer.style.display = 'block';
        compressBtn.disabled = false;
        compressBtn.innerHTML = '<i class="fas fa-cogs"></i> Coba Lagi';
    }
});

// Coba tingkat kompresi lain pada file yang sama
if (retryBtn) {
    retryBtn.addEventListener('click', () => {
        if (!originalFile) return;
        resultInfoDiv.style.display = 'none';
        step2Div.style.display = 'block';
        compressBtn.style.display = 'flex';
        compressBtn.disabled = false;
        progressBarFill.style.width = '0%';
        step2Div.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
}
