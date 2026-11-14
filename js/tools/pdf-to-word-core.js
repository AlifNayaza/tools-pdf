// js/tools/pdf-to-word-core.js
// Mesin konversi PDF -> DOCX yang berjalan penuh di browser (tanpa server).
//
// Alur:  collectPage()  : baca teks, font, gambar, dan tautan dari satu halaman PDF.js
//        buildModel()   : susun baris -> paragraf, judul, daftar, tabel, gambar (model dokumen)
//        buildDocx()    : tulis model ke file .docx (OOXML) memakai JSZip
//
// Modul ini sengaja tidak menyentuh DOM, kecuali lewat "hooks" yang diberikan pemanggil
// (encodeImage, renderPage), sehingga bisa diuji di Node.

(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.PdfToWordCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    /* ------------------------------------------------------------------ */
    /* Utilitas kecil                                                      */
    /* ------------------------------------------------------------------ */

    const LINE_FACTOR = 1.15;   // tinggi baris single Word untuk Times New Roman / Arial
    const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
    const round1 = v => Math.round(v * 10) / 10;
    const twips = pt => Math.round(pt * 20);
    const emu = pt => Math.round(pt * 12700);

    const LIGATURES = { 'ﬀ': 'ff', 'ﬁ': 'fi', 'ﬂ': 'fl', 'ﬃ': 'ffi', 'ﬄ': 'ffl', 'ﬅ': 'st', 'ﬆ': 'st' };
    // Bullet dari font Symbol/Wingdings muncul sebagai karakter area pribadi
    const PRIVATE_BULLETS = { '': '•', '': '▪', '': '➢', '': '❖', '': '✓', '': '○', '': '–' };

    function cleanText(s) {
        let out = '';
        for (const ch of s) {
            if (LIGATURES[ch]) out += LIGATURES[ch];
            else if (PRIVATE_BULLETS[ch]) out += PRIVATE_BULLETS[ch];
            else if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/.test(ch)) continue;
            else out += ch;
        }
        return out.replace(/ /g, ' ');
    }

    function esc(s) {
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    /** Nama font PDF (mis. "BCDEEE+TimesNewRomanPS-BoldMT") -> nama font Word ("Times New Roman"). */
    function normalizeFontName(name, family) {
        let n = String(name || '');
        n = n.replace(/^[A-Z]{6}\+/, '');
        n = n.replace(/(PS)?MT$/i, '');
        n = n.replace(/[,\-_ ]*(Bold|Italic|Oblique|Regular|Semibold|SemiBold|Demi|Black|Light|Medium|BoldItalic|BoldOblique|It|Bd)+$/i, '');
        n = n.replace(/[,\-_ ]*(Bold|Italic|Oblique)+$/i, '');
        n = n.replace(/PS$/i, '');
        n = n.replace(/[,\-_]+$/, '');
        n = n.replace(/([a-z])([A-Z])/g, '$1 $2');
        n = n.replace(/\s+/g, ' ').trim();
        const generic = /^(g_d\d|f\d+$|font|undefined|Type3)/i.test(n) || n.length < 3;
        if (!n || generic) {
            const fam = String(family || '').toLowerCase();
            if (fam.includes('mono') || fam.includes('courier')) return 'Courier New';
            if (fam.includes('sans')) return 'Arial';
            return 'Times New Roman';
        }
        const map = {
            'Times New Roman': 'Times New Roman', 'TimesNewRoman': 'Times New Roman', 'Times': 'Times New Roman',
            'Arial': 'Arial', 'Helvetica': 'Arial', 'Courier New': 'Courier New', 'Courier': 'Courier New',
            'Symbol': 'Symbol', 'Cambria Math': 'Cambria Math', 'Calibri': 'Calibri', 'Cambria': 'Cambria'
        };
        for (const k of Object.keys(map)) if (n.toLowerCase() === k.toLowerCase()) return map[k];
        return n;
    }

    /** Margin kiri = x terkecil yang dipakai cukup banyak baris (bukan hasil indentasi daftar). */
    function robustLeft(xs, fallback) {
        if (!xs.length) return fallback;
        const m = new Map();
        xs.forEach(x => { const k = Math.round(x / 3) * 3; m.set(k, (m.get(k) || 0) + 1); });
        const need = Math.max(2, Math.ceil(xs.length * 0.1));
        const keys = Array.from(m.keys()).sort((a, b) => a - b);
        for (const k of keys) if (m.get(k) >= need) return k;
        return Math.min(...xs);
    }

    function median(arr) {
        if (!arr.length) return 0;
        const a = arr.slice().sort((x, y) => x - y);
        return a[Math.floor(a.length / 2)];
    }

    /** Nilai yang paling sering muncul (dengan pembulatan ke `bin`), diurutkan berdasar bobot. */
    function modeOf(values, bin, weights) {
        const m = new Map();
        values.forEach((v, i) => {
            const k = Math.round(v / bin) * bin;
            m.set(k, (m.get(k) || 0) + (weights ? weights[i] : 1));
        });
        let best = null, bw = -1;
        m.forEach((w, k) => { if (w > bw) { bw = w; best = k; } });
        return best;
    }

    /* ------------------------------------------------------------------ */
    /* 1. Ambil data mentah satu halaman dari PDF.js                       */
    /* ------------------------------------------------------------------ */

    async function collectPage(page, pdfjsLib, hooks) {
        hooks = hooks || {};
        const viewport = page.getViewport({ scale: 1 });
        const W = viewport.width, H = viewport.height;
        const Util = pdfjsLib.Util, OPS = pdfjsLib.OPS;

        const tc = await page.getTextContent({ normalizeWhitespace: false });
        let opList = null;
        try { opList = await page.getOperatorList(); } catch (e) { /* lanjut tanpa gambar/font */ }

        // Info font (nama asli, tebal, miring)
        const fontCache = {};
        function fontInfo(fontName) {
            if (fontCache[fontName]) return fontCache[fontName];
            let name = '', bold = false, italic = false;
            try {
                if (page.commonObjs.has(fontName)) {
                    const f = page.commonObjs.get(fontName);
                    name = f.name || f.fallbackName || '';
                    bold = !!f.bold; italic = !!f.italic;
                }
            } catch (e) { /* font belum termuat */ }
            const style = tc.styles && tc.styles[fontName] ? tc.styles[fontName] : {};
            if (/bold|black|heavy|semibold|demi/i.test(name)) bold = true;
            if (/italic|oblique/i.test(name)) italic = true;
            return (fontCache[fontName] = {
                family: normalizeFontName(name, style.fontFamily),
                bold, italic
            });
        }

        const items = [];
        for (const it of tc.items) {
            if (typeof it.str !== 'string' || it.str === '') continue;
            const m = Util.transform(viewport.transform, it.transform);
            const size = Math.hypot(m[0], m[1]);
            if (size < 1) continue;
            // teks vertikal/miring tajam tidak dipetakan ke aliran paragraf
            if (Math.abs(m[1]) > Math.abs(m[0]) * 0.5) continue;
            const fi = fontInfo(it.fontName);
            const w = Math.abs(it.width) || 0;
            items.push({
                str: cleanText(it.str), x: m[4], y: m[5], w, x1: m[4] + w, size,
                family: fi.family, bold: fi.bold, italic: fi.italic, link: null
            });
        }

        // Tautan
        const links = [];
        try {
            const anns = await page.getAnnotations();
            for (const a of anns) {
                if (a.subtype === 'Link' && a.url && a.rect) {
                    const r = viewport.convertToViewportRectangle(a.rect);
                    links.push({
                        x0: Math.min(r[0], r[2]), x1: Math.max(r[0], r[2]),
                        y0: Math.min(r[1], r[3]), y1: Math.max(r[1], r[3]), url: a.url
                    });
                }
            }
        } catch (e) { /* abaikan */ }
        for (const it of items) {
            const cx = it.x + it.w / 2, cy = it.y - it.size * 0.3;
            const l = links.find(k => cx >= k.x0 && cx <= k.x1 && cy >= k.y0 && cy <= k.y1);
            if (l) it.link = l.url;
        }

        // Gambar (dengan posisi dari CTM)
        const images = [];
        if (opList && hooks.encodeImage) {
            let ctm = [1, 0, 0, 1, 0, 0];
            const stack = [];
            for (let i = 0; i < opList.fnArray.length; i++) {
                const fn = opList.fnArray[i], args = opList.argsArray[i];
                if (fn === OPS.save) stack.push(ctm.slice());
                else if (fn === OPS.restore) { if (stack.length) ctm = stack.pop(); }
                else if (fn === OPS.transform) ctm = Util.transform(ctm, args);
                else if (fn === OPS.paintImageXObject || fn === OPS.paintJpegXObject || fn === OPS.paintInlineImageXObject) {
                    const full = Util.transform(viewport.transform, ctm);
                    const xs = [], ys = [];
                    [[0, 0], [1, 0], [0, 1], [1, 1]].forEach(([u, v]) => {
                        xs.push(full[0] * u + full[2] * v + full[4]);
                        ys.push(full[1] * u + full[3] * v + full[5]);
                    });
                    const box = {
                        x: Math.min(...xs), y: Math.min(...ys),
                        w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys)
                    };
                    if (box.w < 12 || box.h < 12) continue;
                    let imgObj = null;
                    try {
                        if (fn === OPS.paintInlineImageXObject) imgObj = args[0];
                        else if (page.objs.has(args[0])) imgObj = page.objs.get(args[0]);
                    } catch (e) { /* belum tersedia */ }
                    if (imgObj) images.push({ box, img: imgObj, id: fn === OPS.paintInlineImageXObject ? 'inline' + i : args[0] });
                }
            }
        }

        // Garis horizontal/vertikal (untuk garis pemisah dan bingkai tabel)
        const hrules = [], vrules = [];
        if (opList) {
            let ctm2 = [1, 0, 0, 1, 0, 0];
            const stack2 = [];
            let lineWidth = 1;
            let pending = [];
            const toView = (x, y) => {
                const f = Util.transform(viewport.transform, ctm2);
                return [f[0] * x + f[2] * y + f[4], f[1] * x + f[3] * y + f[5]];
            };
            const addRule = (xa, ya, xb, yb, thick) => {
                const dx = Math.abs(xb - xa), dy = Math.abs(yb - ya);
                if (dy <= Math.max(0.8, thick) && dx >= 30) hrules.push({ x0: Math.min(xa, xb), x1: Math.max(xa, xb), y: (ya + yb) / 2, t: Math.max(0.5, thick) });
                else if (dx <= Math.max(0.8, thick) && dy >= 14) vrules.push({ x: (xa + xb) / 2, y0: Math.min(ya, yb), y1: Math.max(ya, yb), t: Math.max(0.5, thick) });
            };
            for (let i = 0; i < opList.fnArray.length; i++) {
                const fn = opList.fnArray[i], args = opList.argsArray[i];
                if (fn === OPS.save) stack2.push(ctm2.slice());
                else if (fn === OPS.restore) { if (stack2.length) ctm2 = stack2.pop(); }
                else if (fn === OPS.transform) ctm2 = Util.transform(ctm2, args);
                else if (fn === OPS.setLineWidth) lineWidth = args[0];
                else if (fn === OPS.constructPath) {
                    const ops = args[0], co = args[1];
                    let ci = 0, cx = 0, cy = 0;
                    for (const op of ops) {
                        if (op === OPS.moveTo) { cx = co[ci++]; cy = co[ci++]; }
                        else if (op === OPS.lineTo) {
                            const nx = co[ci++], ny = co[ci++];
                            const a = toView(cx, cy), b = toView(nx, ny);
                            pending.push({ kind: 'line', a, b, w: lineWidth });
                            cx = nx; cy = ny;
                        } else if (op === OPS.rectangle) {
                            const rx = co[ci++], ry = co[ci++], rw = co[ci++], rh = co[ci++];
                            const p1 = toView(rx, ry), p2 = toView(rx + rw, ry + rh);
                            pending.push({ kind: 'rect', a: p1, b: p2 });
                        } else if (op === OPS.curveTo) ci += 6;
                        else if (op === OPS.curveTo2 || op === OPS.curveTo3) ci += 4;
                    }
                } else if (fn === OPS.stroke || fn === OPS.closeStroke || fn === OPS.fill || fn === OPS.eoFill || fn === OPS.fillStroke || fn === OPS.eoFillStroke || fn === OPS.closeFillStroke || fn === OPS.closeEOFillStroke) {
                    const sc = Math.hypot(ctm2[0], ctm2[1]) || 1;
                    pending.forEach(seg => {
                        if (seg.kind === 'line') addRule(seg.a[0], seg.a[1], seg.b[0], seg.b[1], seg.w * sc);
                        else {
                            const bw = Math.abs(seg.b[0] - seg.a[0]), bh = Math.abs(seg.b[1] - seg.a[1]);
                            const x0 = Math.min(seg.a[0], seg.b[0]), y0 = Math.min(seg.a[1], seg.b[1]);
                            if (bh <= 2.6 && bw >= 30) hrules.push({ x0, x1: x0 + bw, y: y0 + bh / 2, t: Math.max(0.5, bh) });
                            else if (bw <= 2.6 && bh >= 14) vrules.push({ x: x0 + bw / 2, y0, y1: y0 + bh, t: Math.max(0.5, bw) });
                            else if (fn !== OPS.fill && fn !== OPS.eoFill && bw >= 30 && bh >= 14) {
                                // kotak bergaris: empat sisi
                                hrules.push({ x0, x1: x0 + bw, y: y0, t: 0.75 }, { x0, x1: x0 + bw, y: y0 + bh, t: 0.75 });
                                vrules.push({ x: x0, y0, y1: y0 + bh, t: 0.75 }, { x: x0 + bw, y0, y1: y0 + bh, t: 0.75 });
                            }
                        }
                    });
                    pending = [];
                } else if (fn === OPS.endPath) pending = [];
            }
        }

        const charCount = items.reduce((n, it) => n + it.str.trim().length, 0);
        return { W, H, items, images, hrules, vrules, charCount, page };
    }

    /* ------------------------------------------------------------------ */
    /* 2. Baris, segmen, paragraf, tabel                                   */
    /* ------------------------------------------------------------------ */

    function styleKey(r) { return [r.family, r.size, r.bold ? 1 : 0, r.italic ? 1 : 0, r.link || ''].join('|'); }

    function pushRun(runs, text, it) {
        if (!text) return;
        const last = runs[runs.length - 1];
        const r = { text, family: it.family, size: round1(it.size), bold: it.bold, italic: it.italic, link: it.link || null };
        if (last && styleKey(last) === styleKey(r)) last.text += text;
        else runs.push(r);
    }

    function buildLines(items) {
        const sorted = items.slice().sort((a, b) => a.y - b.y || a.x - b.x);
        const lines = [];
        for (const it of sorted) {
            let line = null;
            for (let k = lines.length - 1; k >= Math.max(0, lines.length - 3); k--) {
                const L = lines[k];
                const tol = Math.max(L.size, it.size) * 0.32;
                if (Math.abs(L.y - it.y) <= tol) { line = L; break; }
            }
            if (!line) { line = { y: it.y, size: it.size, items: [] }; lines.push(line); }
            line.items.push(it);
        }

        for (const L of lines) {
            // y rata-rata (bobot panjang teks), ukuran dominan
            let sy = 0, sw = 0;
            const bySize = new Map();
            for (const it of L.items) {
                const w = Math.max(1, it.str.length);
                sy += it.y * w; sw += w;
                const k = Math.round(it.size * 2) / 2;
                bySize.set(k, (bySize.get(k) || 0) + w);
            }
            L.y = sy / sw;
            let best = 0, bw = -1;
            bySize.forEach((w, k) => { if (w > bw) { bw = w; best = k; } });
            L.size = best;
            L.items.sort((a, b) => a.x - b.x);
            L.segs = buildSegments(L);
            if (!L.segs.length) { L.empty = true; L.text = ''; continue; }
            L.x0 = L.segs[0].x0;
            L.x1 = L.segs[L.segs.length - 1].x1;
            L.text = L.segs.map(s => s.text).join('\t');
        }
        return lines.filter(L => !L.empty && L.text.trim().length > 0).sort((a, b) => a.y - b.y);
    }

    function buildSegments(L) {
        const segs = [];
        let seg = null, prev = null;
        for (const it of L.items) {
            if (seg && prev) {
                const sz = Math.max(prev.size, it.size);
                const gap = it.x - prev.x1;
                // duplikat tumpang tindih (efek tebal buatan)
                if (it.str === prev.str && Math.abs(it.x - prev.x) < sz * 0.15 && Math.abs(it.y - prev.y) < sz * 0.2) continue;
                if (gap > sz * 2.0) {
                    segs.push(seg); seg = null;
                } else if (gap > sz * 0.14 && !/\s$/.test(seg.text) && !/^\s/.test(it.str)) {
                    pushRun(seg.runs, ' ', prev);
                    seg.text += ' ';
                }
            }
            if (!seg) seg = { x0: it.x, x1: it.x1, runs: [], text: '' };
            pushRun(seg.runs, it.str, it);
            seg.text += it.str;
            seg.x1 = Math.max(seg.x1, it.x1);
            prev = it;
        }
        if (seg) segs.push(seg);
        // pangkas spasi di tepi segmen
        for (const s of segs) {
            while (s.runs.length && /^\s+$/.test(s.runs[0].text)) s.runs.shift();
            if (s.runs.length) s.runs[0].text = s.runs[0].text.replace(/^\s+/, '');
            while (s.runs.length && /^\s+$/.test(s.runs[s.runs.length - 1].text)) s.runs.pop();
            if (s.runs.length) s.runs[s.runs.length - 1].text = s.runs[s.runs.length - 1].text.replace(/\s+$/, '');
            s.text = s.runs.map(r => r.text).join('');
        }
        return segs.filter(s => s.runs.length);
    }

    // ---- tabel ----
    function detectTables(lines, ctx) {
        const tables = [];
        const used = new Array(lines.length).fill(false);
        let i = 0;
        while (i < lines.length) {
            if (lines[i].segs.length < 2) { i++; continue; }
            // perluas ke bawah: baris multi-segmen, atau baris 1 segmen yang rapat (lanjutan sel)
            let j = i;
            while (j + 1 < lines.length) {
                const cur = lines[j], nx = lines[j + 1];
                const gapY = nx.y - cur.y;
                if (gapY > Math.max(cur.size, nx.size) * 3.4) break;
                if (nx.segs.length >= 2) { j++; continue; }
                if (gapY <= nx.size * 1.45 && nx.x0 > ctx.leftMargin - 2 && nx.x1 < cur.x1 + 2) { j++; continue; }
                break;
            }
            const region = lines.slice(i, j + 1);
            const multi = region.filter(l => l.segs.length >= 2);
            if (multi.length < 2) { i++; continue; }

            // kolom = klaster posisi x0 segmen
            const xs = [];
            multi.forEach(l => l.segs.forEach(s => xs.push(s.x0)));
            xs.sort((a, b) => a - b);
            const tol = Math.max(7, multi[0].size * 0.9);
            const clusters = [];
            xs.forEach(x => {
                const c = clusters[clusters.length - 1];
                if (c && x - c.max <= tol) { c.items.push(x); c.max = x; }
                else clusters.push({ items: [x], max: x });
            });
            const anchors = clusters
                .filter(c => c.items.length >= Math.min(2, multi.length))
                .map(c => median(c.items));
            if (anchors.length < 2) { i++; continue; }

            // Pastikan sebagian besar baris multi-segmen cocok dengan jangkar (bukan teks acak)
            const fit = multi.filter(l => l.segs.every(s => anchors.some(a => Math.abs(a - s.x0) <= tol * 1.6))).length;
            if (fit < multi.length * 0.7) { i++; continue; }

            tables.push({ from: i, to: j, anchors, tol });
            for (let k = i; k <= j; k++) used[k] = true;
            i = j + 1;
        }
        return { tables, used };
    }

    function colIndex(anchors, x, tol) {
        let best = 0, bd = Infinity;
        anchors.forEach((a, idx) => { const d = Math.abs(a - x); if (d < bd) { bd = d; best = idx; } });
        // segmen yang mulai jauh di kanan anjangkar terdekat tetap masuk kolom di kirinya
        for (let k = anchors.length - 1; k >= 0; k--) if (x >= anchors[k] - tol) { return k; }
        return best;
    }

    function buildTable(region, tbl, ctx) {
        const { anchors, tol } = tbl;
        const rows = [];
        let prevY = null, prevSize = 0;
        const rules = (ctx.hrules || []).filter(r => r.y >= region[0].y - region[0].size * 1.5 && r.y <= region[region.length - 1].y + region[0].size);
        for (const l of region) {
            const ruleBetween = prevY !== null && rules.some(r => r.y > prevY - 1 && r.y < l.y - l.size * 0.5);
            const startNew = prevY === null || ruleBetween || (rules.length < 2 && (l.y - prevY) > Math.max(prevSize, l.size) * 1.28);
            const cells = new Array(anchors.length).fill(null);
            l.segs.forEach(s => {
                const c = colIndex(anchors, s.x0, tol);
                cells[c] = cells[c] ? { runs: cells[c].runs.concat([{ text: ' ', family: s.runs[0].family, size: s.runs[0].size, bold: false, italic: false, link: null }], s.runs), x0: cells[c].x0, x1: s.x1 } : { runs: s.runs.slice(), x0: s.x0, x1: s.x1 };
            });
            if (startNew || !rows.length) {
                rows.push({ cells: cells.map(c => c ? [c] : []), y: l.y, size: l.size });
            } else {
                const row = rows[rows.length - 1];
                cells.forEach((c, k) => { if (c) row.cells[k].push(c); });
                row.y = l.y;
            }
            prevY = l.y; prevSize = l.size;
        }
        // gabung potongan sel menjadi paragraf per sel (baris yang membungkus digabung dengan spasi)
        const outRows = rows.map(r => r.cells.map(parts => {
            if (!parts.length) return { runs: [] };
            const runs = [];
            parts.forEach((p, idx) => {
                if (idx > 0 && runs.length) {
                    const last = runs[runs.length - 1];
                    if (!/\s$/.test(last.text)) last.text += ' ';
                }
                p.runs.forEach(r => {
                    const last = runs[runs.length - 1];
                    if (last && styleKey(last) === styleKey(r)) last.text += r.text; else runs.push(Object.assign({}, r));
                });
            });
            return { runs };
        }));

        // lebar kolom
        let right = 0;
        region.forEach(l => { right = Math.max(right, l.x1); });
        const widths = anchors.map((a, k) => (k < anchors.length - 1 ? anchors[k + 1] - a : Math.max(36, right - a + 6)));
        const textLen = [];
        outRows.forEach(r => r.forEach(c => textLen.push(c.runs.map(x => x.text).join('').length)));
        const avgLen = textLen.length ? textLen.reduce((a, b) => a + b, 0) / textLen.length : 0;

        return {
            type: 'table', top: region[0].y - region[0].size,
            left: anchors[0], widths, rows: outRows,
            bottom: region[region.length - 1].y,
            right: right,
            borders: null,
            avgLen
        };
    }

    // ---- daftar (list) ----
    const BULLET_CHARS = '•●○◦▪■□▫–—-*·➢❖✓➤►▸';

    function detectListMarker(line) {
        const first = line.segs[0];
        if (!first || !first.runs.length) return null;
        const t = first.text;
        let m = new RegExp('^([' + BULLET_CHARS.replace(/[-\]\\^]/g, '\\$&') + '])(\\s+|$)').exec(t);
        if (m) {
            if (m[1] === '-' && t.length > 1 && t[1] !== ' ') return null;
            return { kind: 'bullet', marker: m[1], suffix: '', len: m[0].length };
        }
        m = /^(\(?)(\d{1,3})([.)])\s+(?!\d)/.exec(t);
        if (m) return { kind: 'decimal', marker: m[0].trim(), num: parseInt(m[2], 10), suffix: m[3], paren: m[1] === '(', len: m[0].length };
        m = /^(\(?)([a-z])([.)])\s+/.exec(t);
        if (m) return { kind: 'lowerLetter', marker: m[0].trim(), num: m[2].charCodeAt(0) - 96, suffix: m[3], paren: m[1] === '(', len: m[0].length };
        m = /^(\(?)([A-Z])([.)])\s+/.exec(t);
        if (m) return { kind: 'upperLetter', marker: m[0].trim(), num: m[2].charCodeAt(0) - 64, suffix: m[3], paren: m[1] === '(', len: m[0].length };
        m = /^(\(?)([ivxl]{1,5})([.)])\s+/.exec(t);
        if (m && romanToInt(m[2])) return { kind: 'lowerRoman', marker: m[0].trim(), num: romanToInt(m[2]), suffix: m[3], paren: m[1] === '(', len: m[0].length };
        return null;
    }

    function romanToInt(s) {
        const map = { i: 1, v: 5, x: 10, l: 50 };
        let n = 0;
        s = s.toLowerCase();
        for (let i = 0; i < s.length; i++) {
            const v = map[s[i]]; const nx = map[s[i + 1]];
            if (!v) return 0;
            n += nx && nx > v ? -v : v;
        }
        return n;
    }

    function stripMarker(line, len) {
        const segs = line.segs.map(s => ({ x0: s.x0, x1: s.x1, runs: s.runs.map(r => Object.assign({}, r)) }));
        let left = len;
        const first = segs[0];
        while (left > 0 && first.runs.length) {
            const r = first.runs[0];
            if (r.text.length <= left) { left -= r.text.length; first.runs.shift(); }
            else { r.text = r.text.slice(left); left = 0; }
        }
        if (first.runs.length) first.runs[0].text = first.runs[0].text.replace(/^\s+/, '');
        if (!first.runs.length) segs.shift();
        return segs;
    }

    // ---- paragraf ----
    function lineRuns(line, joiner) {
        const runs = [];
        line.segs.forEach((s, idx) => {
            if (idx > 0) runs.push({ text: '\t', family: s.runs[0].family, size: s.runs[0].size, bold: false, italic: false, link: null });
            s.runs.forEach(r => {
                const last = runs[runs.length - 1];
                if (last && styleKey(last) === styleKey(r)) last.text += r.text; else runs.push(Object.assign({}, r));
            });
        });
        return runs;
    }

    function appendRuns(target, runs) {
        // spasi antar baris; sambung kata yang terpotong tanda hubung
        const lastRun = target[target.length - 1];
        if (lastRun) {
            const first = runs[0];
            if (/[A-Za-zÀ-ɏ]-$/.test(lastRun.text) && first && /^[a-zß-ɏ]/.test(first.text)) {
                lastRun.text = lastRun.text.slice(0, -1);
            } else if (!/\s$/.test(lastRun.text) && !(first && /^\s/.test(first.text))) {
                lastRun.text += ' ';
            }
        }
        runs.forEach(r => {
            const last = target[target.length - 1];
            if (last && styleKey(last) === styleKey(r)) last.text += r.text; else target.push(Object.assign({}, r));
        });
    }

    function runsText(runs) { return runs.map(r => r.text).join(''); }

    function isBoldLine(line) {
        const runs = [].concat(...line.segs.map(s => s.runs)).filter(r => r.text.trim());
        return runs.length > 0 && runs.every(r => r.bold);
    }

    function buildParagraphs(lines, ctx) {
        const blocks = [];
        let cur = null;
        let prevBlockLastY = null, prevBlockPitch = 0;

        function flush() {
            if (!cur) return;
            finalizeParagraph(cur, ctx);
            blocks.push(cur);
            prevBlockLastY = cur.lastY;
            prevBlockPitch = cur.pitch || cur.size * LINE_FACTOR;
            cur = null;
        }

        for (let i = 0; i < lines.length; i++) {
            const L = lines[i];
            const headCandidate = isHeadingLine(L, ctx);
            const list = headCandidate ? null : detectListMarker(L);
            const isHead = !list && headCandidate;

            let continues = false;
            if (cur && !list) {
                const gapY = L.y - cur.lastY;
                const limit = cur.pitch ? Math.max(cur.pitch * 1.3, L.size * 1.55) : L.size * 1.75;
                const sameSize = Math.abs(L.size - cur.size) <= 1;
                const leftRef = cur.list ? cur.list.textX : cur.contLeft;
                const alignedLeft = Math.abs(L.x0 - leftRef) <= Math.max(8, L.size * 0.8);
                // baris sebelumnya pendek -> paragraf berakhir
                const prevShort = cur.lastX1 < ctx.rightMargin - Math.max(ctx.colWidth * 0.22, L.size * 3);
                const kindOK = cur.heading ? (isHead && L.size === cur.size) : !isHead;
                if (gapY <= limit && sameSize && (cur.lines === 1 ? (alignedLeft || Math.abs(L.x0 - cur.firstX0) <= 8 || (cur.firstX0 > L.x0 && L.x0 >= ctx.leftMargin - 4))
                    : alignedLeft) && !prevShort && kindOK) {
                    continues = true;
                }
                // judul panjang multi-baris
                if (cur.heading && isHead && Math.abs(L.size - cur.size) <= 0.6 && gapY <= L.size * 1.6) continues = true;
            }

            if (continues) {
                const gapY = L.y - cur.lastY;
                if (cur.lines === 1) { cur.pitch = gapY; cur.contLeft = L.x0; }
                appendRuns(cur.runs, lineRuns(L));
                cur.lastY = L.y; cur.lastX1 = L.x1; cur.lines++; cur.rights.push(L.x1); cur.lefts.push(L.x0);
                continue;
            }

            flush();

            const gapBefore = prevBlockLastY === null ? 0 : L.y - prevBlockLastY;
            let runs, firstX0 = L.x0;
            const block = {
                type: 'para', top: L.y - L.size, y: L.y, lastY: L.y, size: L.size, lines: 1, pitch: 0,
                firstX0, contLeft: L.x0, lastX1: L.x1, rights: [L.x1], lefts: [L.x0],
                heading: false, list: null, gapBefore, prevPitch: prevBlockPitch
            };
            if (list) {
                const segs = stripMarker(L, list.len);
                const textX = segs.length ? segs[0].x0 : L.x0 + L.size * 1.2;
                const fake = { segs };
                runs = lineRuns(fake);
                block.list = { kind: list.kind, num: list.num, suffix: list.suffix, paren: list.paren, markerX: L.x0, textX: Math.max(textX, L.x0 + L.size * 0.8), marker: list.marker };
                block.contLeft = block.list.textX;
            } else {
                runs = lineRuns(L);
                if (isHead) block.heading = true;
            }
            block.runs = runs.length ? runs : [{ text: '', family: ctx.bodyFamily, size: L.size, bold: false, italic: false, link: null }];
            block.x0 = L.x0;
            block.x1 = L.x1;
            cur = block;
        }
        flush();
        return blocks;
    }

    function isHeadingLine(L, ctx) {
        const text = L.text.trim();
        if (!text) return false;
        if (L.size >= ctx.bodySize * 1.2 && text.length < 160) return true;
        if (isBoldLine(L) && L.size >= ctx.bodySize * 0.95 && text.length < 90 && L.x1 < ctx.rightMargin - ctx.colWidth * 0.12
            && !/[,;]$/.test(text)) return true;
        return false;
    }

    function finalizeParagraph(b, ctx) {
        const width = ctx.pageW;
        const colL = ctx.leftMargin, colR = ctx.rightMargin;
        const left = b.list ? b.list.textX : Math.min(...b.lefts);
        const right = Math.max(...b.rights);
        const centerX = (b.x0 + right) / 2;
        const pageCenter = (colL + colR) / 2;

        let align = 'left';
        const indentFromLeft = b.x0 - colL;
        if (!b.list && b.lines <= 6 && Math.abs(centerX - pageCenter) < ctx.colWidth * 0.04 && indentFromLeft > ctx.colWidth * 0.06 && right < colR - ctx.colWidth * 0.06) align = 'center';
        else if (!b.list && b.lines <= 3 && Math.abs(right - colR) < ctx.colWidth * 0.025 && indentFromLeft > ctx.colWidth * 0.25) align = 'right';
        else if (b.lines >= 3 && !b.list) {
            // rata kiri-kanan: baris tengah berakhir di sisi kanan yang sama
            const mids = b.rights.slice(0, -1);
            const maxR = Math.max(...mids);
            if (mids.every(r => Math.abs(r - maxR) <= 2.2) && Math.abs(maxR - colR) < ctx.colWidth * 0.06) align = 'both';
        }
        b.align = align;

        // indentasi
        b.indentLeft = 0; b.firstLine = 0; b.hanging = 0;
        if (b.list) {
            const markerIndent = Math.max(0, b.list.markerX - colL);
            const minHang = b.list.kind === 'bullet' ? 14 : Math.min(40, (b.list.marker || '').length * b.size * 0.55 + 6);
            b.hanging = Math.max(minHang, b.list.textX - b.list.markerX);
            b.indentLeft = markerIndent + b.hanging;
        } else if (align === 'left' || align === 'both') {
            const contL = b.lines > 1 ? Math.min(...b.lefts.slice(1)) : b.x0;
            b.indentLeft = Math.max(0, contL - colL);
            if (b.indentLeft < 3) b.indentLeft = 0;
            const first = b.x0 - contL;
            if (b.lines > 1 && Math.abs(first) > 6) {
                if (first > 0) b.firstLine = first; else b.hanging = -first;
            }
        } else if (align === 'right' || align === 'center') {
            b.indentLeft = 0;
        }

        // spasi
        const pitch = b.pitch || 0;
        b.lineMult = pitch ? clamp(Math.round(pitch / (b.size * LINE_FACTOR) * 20) / 20, 0.85, 2.6) : 1;
        const prevAdvance = b.prevPitch || b.size * LINE_FACTOR;
        b.spaceBefore = b.gapBefore ? clamp(b.gapBefore - prevAdvance, 0, 72) : 0;
        if (b.spaceBefore < 1.5) b.spaceBefore = 0;
        if (b.heading) b.keepNext = true;
    }

    /* ------------------------------------------------------------------ */
    /* 3. Model dokumen                                                    */
    /* ------------------------------------------------------------------ */

    /** Ubah sekumpulan baris menjadi blok (tabel + paragraf). */
    function linesToBlocks(lines, ctx, stats) {
        const blocks = [];
        const { tables, used } = detectTables(lines, ctx);
        const tableAt = new Map();
        tables.forEach(t => tableAt.set(t.from, t));
        let buffer = [];
        const flushBuf = () => {
            if (buffer.length) { blocks.push(...buildParagraphs(buffer, ctx)); buffer = []; }
        };
        for (let i = 0; i < lines.length; i++) {
            if (tableAt.has(i)) {
                flushBuf();
                const t = tableAt.get(i);
                const tb = buildTable(lines.slice(t.from, t.to + 1), t, ctx);
                tb.docLeft = (ctx.pageLeft != null ? ctx.pageLeft : ctx.leftMargin) + (tb.left - ctx.leftMargin);
                blocks.push(tb);
                stats.tables++;
                i = t.to;
            } else if (!used[i]) buffer.push(lines[i]);
        }
        flushBuf();
        return blocks;
    }

    /**
     * Deteksi tata letak 2 kolom teks. Hasil: daftar grup berurutan sesuai urutan baca
     * (baris selebar halaman, lalu kolom kiri, lalu kolom kanan, dst).
     * Halaman satu kolom (atau tabel) mengembalikan satu grup saja.
     */
    function splitColumns(lines, ctx) {
        const single = [{ kind: 'flow', lines, ctx }];
        const long = lines.filter(l => l.text.length >= 15);
        if (long.length < 12) return single;

        const bins = new Map();
        long.forEach(l => l.segs.forEach(sg => {
            if (sg.text.length >= 10) { const k = Math.round(sg.x0 / 4) * 4; bins.set(k, (bins.get(k) || 0) + 1); }
        }));
        const anchors = Array.from(bins.entries()).filter(e => e[1] >= 5).map(e => e[0]).sort((a, b) => a - b);
        if (anchors.length < 2) return single;
        const second = anchors.find(a => a > ctx.leftMargin + ctx.colWidth * 0.3 && a < ctx.leftMargin + ctx.colWidth * 0.72);
        if (second == null) return single;
        const g = second - 7;

        const crosses = l => l.segs.some(sg => sg.x0 < g - 3 && sg.x1 > g + 3);
        const crossing = lines.filter(crosses).length;
        if (crossing > lines.length * 0.25) return single;

        let nl = 0, nr = 0, lenSum = 0, lenN = 0;
        lines.forEach(l => { if (!crosses(l)) l.segs.forEach(sg => {
            if (sg.x1 <= g + 3) { nl++; lenSum += sg.text.length; lenN++; }
            else if (sg.x0 >= g) { nr++; lenSum += sg.text.length; lenN++; }
        }); });
        if (nl < 5 || nr < 5 || lenSum / Math.max(1, lenN) < 28) return single;   // pendek-pendek = tabel, bukan kolom

        const mk = (l, segs) => ({
            y: l.y, size: l.size, segs, x0: segs[0].x0, x1: segs[segs.length - 1].x1,
            text: segs.map(x => x.text).join('\t')
        });
        const groups = [];
        let run = [];
        const flushRun = () => {
            if (!run.length) return;
            const L = [], R = [];
            run.forEach(l => {
                const ls = l.segs.filter(sg => sg.x1 <= g + 3), rs = l.segs.filter(sg => sg.x0 >= g);
                if (ls.length) L.push(mk(l, ls));
                if (rs.length) R.push(mk(l, rs));
            });
            if (L.length) groups.push({ kind: 'col', lines: L });
            if (R.length) groups.push({ kind: 'col', lines: R });
            run = [];
        };
        for (const l of lines) {
            if (crosses(l)) {
                flushRun();
                const last = groups[groups.length - 1];
                if (last && last.kind === 'flow') last.lines.push(l); else groups.push({ kind: 'flow', lines: [l] });
            } else run.push(l);
        }
        flushRun();

        groups.forEach(gr => {
            if (gr.kind === 'flow') { gr.ctx = ctx; return; }
            const xs0 = gr.lines.map(l => l.x0), xs1 = gr.lines.map(l => l.x1);
            const left = robustLeft(xs0, Math.min(...xs0));
            const right = Math.max(...xs1);
            gr.ctx = Object.assign({}, ctx, { leftMargin: left, rightMargin: right, colWidth: Math.max(50, right - left), pageLeft: ctx.leftMargin });
        });
        gr_xRange(groups);
        return groups;
    }

    function gr_xRange(groups) {
        groups.forEach(gr => {
            gr.x0 = Math.min(...gr.lines.map(l => l.x0));
            gr.x1 = Math.max(...gr.lines.map(l => l.x1));
            gr.y0 = Math.min(...gr.lines.map(l => l.y));
            gr.y1 = Math.max(...gr.lines.map(l => l.y));
        });
    }

    function normalizeHF(text) { return text.toLowerCase().replace(/\d+/g, '#').replace(/\s+/g, ' ').trim(); }

    function buildModel(rawPages, options) {
        options = Object.assign({ pageBreaks: true, removeHeaderFooter: true, includeImages: true }, options || {});
        const stats = { paragraphs: 0, headings: 0, lists: 0, tables: 0, images: 0, scannedPages: 0 };

        // baris per halaman
        const pageLines = rawPages.map(rp => buildLines(rp.items));

        // header / footer berulang + nomor halaman
        if (options.removeHeaderFooter && rawPages.length > 1) {
            const counts = new Map();
            pageLines.forEach((lines, pi) => {
                const seen = new Set();
                lines.forEach(L => {
                    const H = rawPages[pi].H;
                    if (L.y < H * 0.09 || L.y > H * 0.91) {
                        const k = normalizeHF(L.text);
                        if (k && !seen.has(k)) { seen.add(k); counts.set(k, (counts.get(k) || 0) + 1); }
                    }
                });
            });
            const need = Math.max(2, Math.ceil(rawPages.length * 0.5));
            pageLines.forEach((lines, pi) => {
                const H = rawPages[pi].H;
                pageLines[pi] = lines.filter(L => {
                    if (!(L.y < H * 0.09 || L.y > H * 0.91)) return true;
                    const k = normalizeHF(L.text);
                    if (/^(halaman|hal\.?|page|h\.)?\s*#\s*(\/|dari|of)?\s*#?$/.test(k)) return false;
                    if (/^[-–—\s]*#[-–—\s]*$/.test(k)) return false;
                    return (counts.get(k) || 0) < need;
                });
            });
        }

        // statistik global
        const sizes = [], sizeWeights = [], lefts = [], rights = [];
        const leftW = [], rightW = [];
        pageLines.forEach(lines => lines.forEach(L => {
            sizes.push(L.size); sizeWeights.push(L.text.length);
            if (L.text.length >= 25) { lefts.push(L.x0); rights.push(L.x1); leftW.push(L.text.length); rightW.push(L.text.length); }
        }));
        const bodySize = sizes.length ? modeOf(sizes, 0.5, sizeWeights) : 11;
        const famWeights = new Map();
        rawPages.forEach(rp => rp.items.forEach(it => famWeights.set(it.family, (famWeights.get(it.family) || 0) + it.str.length)));
        let bodyFamily = 'Times New Roman', bf = -1;
        famWeights.forEach((w, f) => { if (w > bf) { bf = w; bodyFamily = f; } });

        const allLefts = [];
        pageLines.forEach(lines => lines.forEach(L => { if (L.text.length >= 12) allLefts.push(L.x0); }));
        const docLeft = robustLeft(allLefts, null);
        const docRight = rights.length ? modeOf(rights, 3, rightW) : null;

        // ukuran judul -> level
        const headSizes = Array.from(new Set(sizes.filter(s => s >= bodySize * 1.2).map(s => Math.round(s)))).sort((a, b) => b - a);

        const pagesOut = [];
        let listCounter = 0;
        let prevList = null;

        rawPages.forEach((rp, pi) => {
            const lines = pageLines[pi];
            const W = rp.W, H = rp.H;
            const pageLefts = lines.filter(L => L.text.length >= 12).map(L => L.x0);
            const pageRights = lines.filter(L => L.text.length >= 25).map(L => L.x1);
            const leftMargin = robustLeft(pageLefts, docLeft || W * 0.1);
            const rightMargin = pageRights.length >= 4
                ? Math.max(...pageRights.filter(r => r > leftMargin + 50))
                : (docRight || W * 0.9);
            const ctx = {
                hrules: rp.hrules || [], vrules: rp.vrules || [],
                pageW: W, pageH: H, bodySize, bodyFamily,
                leftMargin: leftMargin || W * 0.1, rightMargin: rightMargin || W * 0.9,
                colWidth: Math.max(50, (rightMargin || W * 0.9) - (leftMargin || W * 0.1))
            };

            const scanned = options.includeImages !== false && rp.charCount < 15 && rp.images.length > 0 &&
                rp.images.some(im => im.box.w * im.box.h > W * H * 0.4);
            const blocks = [];

            if (scanned) {
                stats.scannedPages++;
                blocks.push({ type: 'scanpage', top: 0, rp });
            } else {
                const groups = splitColumns(lines, ctx);
                if (groups.length > 1) stats.columnPages = (stats.columnPages || 0) + 1;
                groups.forEach(gr => { gr.blocks = linesToBlocks(gr.lines, gr.ctx, stats); });

                if (options.includeImages !== false) {
                    if (groups.length === 1 && !groups[0].lines.length) groups[0].y0 = groups[0].y1 = 0;
                    rp.images.forEach(im => {
                        const area = im.box.w * im.box.h;
                        // latar belakang penuh halaman di bawah teks: lewati
                        if (area > W * H * 0.8 && rp.charCount > 40) return;
                        const blk = { type: 'image', top: im.box.y, y: im.box.y + im.box.h, box: im.box, img: im.img, id: im.id, rp };
                        const cx = im.box.x + im.box.w / 2, cy = im.box.y + im.box.h / 2;
                        let target = groups.length === 1 ? groups[0] : null;
                        if (!target) {
                            const cands = groups.filter(gr => gr.kind === 'col' && cx >= gr.x0 - 10 && cx <= gr.x1 + 10 && cy >= gr.y0 - 60 && cy <= gr.y1 + 60);
                            target = cands[0] || groups.filter(gr => gr.kind === 'flow').sort((a, b) => Math.abs((a.y0 + a.y1) / 2 - cy) - Math.abs((b.y0 + b.y1) / 2 - cy))[0] || groups[0];
                        }
                        target.blocks.push(blk);
                    });
                }
                groups.forEach(gr => gr.blocks.sort((a, b) => a.top - b.top));
                blocks.push(...[].concat(...groups.map(gr => gr.blocks)));

                // judul -> level; daftar -> nomor
                blocks.forEach(b => {
                    if (b.type !== 'para') return;
                    if (b.heading) {
                        const sr = Math.round(b.size);
                        const idx = headSizes.indexOf(sr);
                        b.headLevel = idx < 0 ? (b.size > bodySize * 1.05 ? 2 : 3) : Math.min(idx + 1, 3);
                        stats.headings++;
                    }
                });


                // bingkai tabel dari garis vektor (cadangan: teks pendek = tabel berbingkai)
                const hr = rp.hrules || [], vr = rp.vrules || [];
                blocks.forEach(b => {
                    if (b.type !== 'table') return;
                    const inside = hr.filter(r => r.y >= b.top - 6 && r.y <= b.bottom + 10 && (Math.min(r.x1, b.right + 10) - Math.max(r.x0, b.left - 10)) >= (b.right - b.left) * 0.5);
                    const inV = vr.filter(r => r.x >= b.left - 10 && r.x <= b.right + 10 && r.y1 >= b.top - 6 && r.y0 <= b.bottom + 10);
                    b.borders = (inside.length >= 2 || inV.length >= 2) ? true : (hr.length + vr.length > 0 ? false : b.avgLen < 70);
                    b.usedRules = inside;
                });

                // garis pemisah antar paragraf -> border paragraf
                const tableRules = new Set();
                blocks.forEach(b => { if (b.type === 'table' && b.usedRules) b.usedRules.forEach(r => tableRules.add(r)); });
                hr.forEach(r => {
                    if (tableRules.has(r)) return;
                    if (r.x1 - r.x0 < ctx.colWidth * 0.45 || r.x0 > ctx.leftMargin + ctx.colWidth * 0.3) return;
                    for (const b of blocks) {
                        if (b.type !== 'para') continue;
                        if (r.y >= b.lastY - 1 && r.y <= b.lastY + b.size * 1.2 + 3 && !b.borderBottom) { b.borderBottom = Math.max(4, Math.min(24, Math.round(r.t * 8))); return; }
                    }
                    for (const b of blocks) {
                        if (b.type !== 'para') continue;
                        if (r.y <= b.top + 2 && r.y >= b.top - b.size * 0.9 - 3 && !b.borderTop) { b.borderTop = Math.max(4, Math.min(24, Math.round(r.t * 8))); return; }
                    }
                });
            }

            // nomor daftar
            blocks.forEach(b => {
                if (b.type === 'para' && b.list) {
                    const key = b.list.kind + b.list.suffix + (b.list.paren ? 'p' : '');
                    const contiguous = prevList && prevList.key === key && prevList.page === pi &&
                        (b.list.kind === 'bullet' || b.list.num === prevList.num + 1 || b.list.num === prevList.num);
                    if (!contiguous) { listCounter++; prevList = { key, num: b.list.num, id: listCounter, start: b.list.num, page: pi }; }
                    else prevList.num = b.list.num;
                    b.list.id = prevList.id; b.list.start = prevList.start;
                    stats.lists++;
                } else if (b.type === 'para') {
                    prevList = null;
                } else if (b.type !== 'para') prevList = null;
                if (b.type === 'para') stats.paragraphs++;
            });

            // margin halaman
            const tops = blocks.filter(b => b.type === 'para' || b.type === 'table' || b.type === 'image').map(b => b.top);
            const bottoms = lines.map(L => L.y);
            const margins = {
                left: clamp(ctx.leftMargin, 28, 180),
                right: clamp(W - ctx.rightMargin, 28, 180),
                top: clamp(tops.length ? Math.min(...tops) : 54, 28, 120),
                bottom: clamp((bottoms.length ? H - Math.max(...bottoms) - 4 : 54) * 0.55, 28, 90)
            };
            if (scanned) { margins.left = margins.right = margins.top = margins.bottom = 18; }
            pagesOut.push({ W, H, blocks, margins, ctx, scanned });
        });

        return { pages: pagesOut, bodySize, bodyFamily, options, stats };
    }

    /* ------------------------------------------------------------------ */
    /* 4. Tulis DOCX                                                       */
    /* ------------------------------------------------------------------ */

    function rPrXml(r, opts) {
        opts = opts || {};
        let x = '';
        const fam = r.family || 'Times New Roman';
        x += `<w:rFonts w:ascii="${esc(fam)}" w:hAnsi="${esc(fam)}" w:cs="${esc(fam)}" w:eastAsia="${esc(fam)}"/>`;
        if (r.bold || opts.bold) x += '<w:b/><w:bCs/>';
        if (r.italic) x += '<w:i/><w:iCs/>';
        if (r.link) x += '<w:rStyle w:val="Hyperlink"/>';
        const hp = Math.max(2, Math.round(r.size * 2));
        x += `<w:sz w:val="${hp}"/><w:szCs w:val="${hp}"/>`;
        return `<w:rPr>${x}</w:rPr>`;
    }

    function textRunXml(r, ctx) {
        const parts = String(r.text).split('\t');
        let inner = '';
        parts.forEach((p, i) => {
            if (i > 0) inner += '<w:tab/>';
            if (p) inner += `<w:t xml:space="preserve">${esc(p)}</w:t>`;
        });
        if (!inner) return '';
        const run = `<w:r>${rPrXml(r)}${inner}</w:r>`;
        if (r.link) {
            const id = ctx.linkId(r.link);
            return `<w:hyperlink r:id="${id}" w:history="1">${run}</w:hyperlink>`;
        }
        return run;
    }

    function numFormat(kind) { return { decimal: 'decimal', lowerLetter: 'lowerLetter', upperLetter: 'upperLetter', lowerRoman: 'lowerRoman', upperRoman: 'upperRoman' }[kind] || 'decimal'; }

    function paraXml(b, ctx, extra) {
        extra = extra || {};
        let ppr = '';
        if (b.heading && b.headLevel) ppr += `<w:pStyle w:val="Heading${b.headLevel}"/>`;
        if (b.keepNext) ppr += '<w:keepNext/>';
        if (extra.pageBreakBefore) ppr += '<w:pageBreakBefore/>';
        if (b.list) {
            const numId = ctx.numberingFor(b.list);
            ppr += `<w:numPr><w:ilvl w:val="0"/><w:numId w:val="${numId}"/></w:numPr>`;
        }
        if (b.borderTop || b.borderBottom) {
            ppr += '<w:pBdr>' +
                (b.borderTop ? `<w:top w:val="single" w:sz="${b.borderTop}" w:space="4" w:color="000000"/>` : '') +
                (b.borderBottom ? `<w:bottom w:val="single" w:sz="${b.borderBottom}" w:space="4" w:color="000000"/>` : '') +
                '</w:pBdr>';
        }
        const before = twips(b.spaceBefore || 0);
        const line = Math.round((b.lineMult || 1) * 240);
        ppr += `<w:spacing w:before="${before}" w:after="0" w:line="${line}" w:lineRule="auto"/>`;
        const ind = [];
        if (b.indentLeft || b.hanging || b.firstLine) {
            ind.push(`w:left="${twips(b.indentLeft)}"`);
            if (b.hanging) ind.push(`w:hanging="${twips(b.hanging)}"`);
            else if (b.firstLine) ind.push(`w:firstLine="${twips(b.firstLine)}"`);
            ppr += `<w:ind ${ind.join(' ')}/>`;
        }
        const jc = { left: null, center: 'center', right: 'right', both: 'both' }[b.align];
        if (jc) ppr += `<w:jc w:val="${jc}"/>`;
        if (extra.sectPr) ppr += extra.sectPr;
        const runs = (b.runs || []).map(r => textRunXml(r, ctx)).join('');
        return `<w:p><w:pPr>${ppr}</w:pPr>${runs}</w:p>`;
    }

    function tableXml(t, ctx, pageMargins, pageW) {
        const textW = pageW - pageMargins.left - pageMargins.right;
        let widths = t.widths.slice();
        let total = widths.reduce((a, b) => a + b, 0);
        const maxW = textW - ((t.docLeft != null ? t.docLeft : t.left) - pageMargins.left);
        if (total > maxW && maxW > 50) { const f = maxW / total; widths = widths.map(w => w * f); total = maxW; }
        const ind = Math.max(0, (t.docLeft != null ? t.docLeft : t.left) - pageMargins.left);
        const bd = t.borders
            ? ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(s => `<w:${s} w:val="single" w:sz="4" w:space="0" w:color="808080"/>`).join('')
            : ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(s => `<w:${s} w:val="nil"/>`).join('');
        let x = `<w:tbl><w:tblPr><w:tblW w:w="${twips(total)}" w:type="dxa"/><w:tblInd w:w="${twips(ind)}" w:type="dxa"/>` +
            `<w:tblBorders>${bd}</w:tblBorders><w:tblLayout w:type="fixed"/>` +
            `<w:tblCellMar><w:top w:w="30" w:type="dxa"/><w:left w:w="80" w:type="dxa"/><w:bottom w:w="30" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tblCellMar></w:tblPr>`;
        x += '<w:tblGrid>' + widths.map(w => `<w:gridCol w:w="${twips(w)}"/>`).join('') + '</w:tblGrid>';
        t.rows.forEach(row => {
            x += '<w:tr><w:trPr><w:cantSplit/></w:trPr>';
            row.forEach((cell, k) => {
                const runs = (cell.runs || []);
                const size = runs.length ? runs[0].size : ctx.bodySize;
                const para = `<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/></w:pPr>${runs.map(r => textRunXml(r, ctx)).join('')}</w:p>`;
                x += `<w:tc><w:tcPr><w:tcW w:w="${twips(widths[k])}" w:type="dxa"/></w:tcPr>${para}</w:tc>`;
            });
            x += '</w:tr>';
        });
        x += '</w:tbl>';
        return x;
    }

    function imageXml(img, ctx, align) {
        const id = ctx.nextDocPrId();
        const rid = ctx.mediaRel(img);
        const cx = emu(img.wPt), cy = emu(img.hPt);
        const jc = align && align !== 'left' ? `<w:jc w:val="${align}"/>` : '';
        const drawing =
            `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/>` +
            `<wp:docPr id="${id}" name="Gambar ${id}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr>` +
            `<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
            `<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${id}" name="Gambar ${id}"/><pic:cNvPicPr/></pic:nvPicPr>` +
            `<pic:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
            `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic>` +
            `</a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
        return `<w:p><w:pPr><w:spacing w:before="60" w:after="60" w:line="240" w:lineRule="auto"/>${jc}</w:pPr>${drawing}</w:p>`;
    }

    function sectPrXml(page, last) {
        const m = page.margins;
        return `<w:sectPr>${last ? '' : '<w:type w:val="nextPage"/>'}<w:pgSz w:w="${twips(page.W)}" w:h="${twips(page.H)}"${page.W > page.H ? ' w:orient="landscape"' : ''}/>` +
            `<w:pgMar w:top="${twips(m.top)}" w:right="${twips(m.right)}" w:bottom="${twips(m.bottom)}" w:left="${twips(m.left)}" w:header="${twips(18)}" w:footer="${twips(18)}" w:gutter="0"/></w:sectPr>`;
    }

    async function buildDocx(model, JSZip, hooks) {
        hooks = hooks || {};
        const zip = new JSZip();
        const rels = [];                 // relasi dokumen
        let relCounter = 10;
        const linkMap = new Map();
        const media = [];                // {name, bytes, ext}
        const numDefs = new Map();       // key -> abstractNum idx
        const numInst = new Map();       // list id -> numId
        const abstract = [];
        const nums = [];
        let docPr = 0;

        const ctxBase = {
            bodySize: model.bodySize,
            linkId(url) {
                if (!linkMap.has(url)) {
                    const id = 'rId' + (++relCounter);
                    linkMap.set(url, id);
                    rels.push(`<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${esc(url)}" TargetMode="External"/>`);
                }
                return linkMap.get(url);
            },
            nextDocPrId() { return ++docPr; },
            mediaRel(img) {
                if (!img._rid) {
                    const id = 'rId' + (++relCounter);
                    const name = `image${media.length + 1}.${img.ext}`;
                    media.push({ name, bytes: img.bytes });
                    rels.push(`<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${name}"/>`);
                    img._rid = id;
                }
                return img._rid;
            },
            numberingFor(list) {
                if (list.kind === 'bullet') {
                    if (!numDefs.has('bullet')) {
                        numDefs.set('bullet', abstract.length);
                        abstract.push(`<w:abstractNum w:abstractNumId="${abstract.length}"><w:multiLevelType w:val="singleLevel"/><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:lvlJc w:val="left"/><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/></w:rPr></w:lvl></w:abstractNum>`);
                    }
                    const k = 'b';
                    if (!numInst.has(k)) { nums.push(`<w:num w:numId="${nums.length + 1}"><w:abstractNumId w:val="${numDefs.get('bullet')}"/></w:num>`); numInst.set(k, nums.length); }
                    return numInst.get(k);
                }
                const fk = list.kind + '|' + list.suffix + '|' + (list.paren ? 1 : 0);
                if (!numDefs.has(fk)) {
                    numDefs.set(fk, abstract.length);
                    const text = (list.paren ? '(' : '') + '%1' + list.suffix;
                    abstract.push(`<w:abstractNum w:abstractNumId="${abstract.length}"><w:multiLevelType w:val="singleLevel"/><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="${numFormat(list.kind)}"/><w:lvlText w:val="${esc(text)}"/><w:lvlJc w:val="left"/></w:lvl></w:abstractNum>`);
                }
                const ik = 'n' + list.id;
                if (!numInst.has(ik)) {
                    nums.push(`<w:num w:numId="${nums.length + 1}"><w:abstractNumId w:val="${numDefs.get(fk)}"/><w:lvlOverride w:ilvl="0"><w:startOverride w:val="${Math.max(1, list.start || 1)}"/></w:lvlOverride></w:num>`);
                    numInst.set(ik, nums.length);
                }
                return numInst.get(ik);
            }
        };

        // kelompokkan halaman berurutan dengan ukuran/margin serupa menjadi satu bagian (section)
        const sameSection = (a, b) => Math.abs(a.W - b.W) < 2 && Math.abs(a.H - b.H) < 2 && a.scanned === b.scanned &&
            Math.abs(a.margins.left - b.margins.left) < 6 && Math.abs(a.margins.top - b.margins.top) < 8;

        let body = '';
        const pages = model.pages;
        for (let pi = 0; pi < pages.length; pi++) {
            const page = pages[pi];
            const first = pi === 0 || !sameSection(pages[pi - 1], page);
            const pageBreak = !first && model.options.pageBreaks;
            let pendingBreak = pageBreak;
            const textW = page.W - page.margins.left - page.margins.right;

            const emitBreakParagraph = () => {
                body += '<w:p><w:pPr><w:pageBreakBefore/><w:spacing w:before="0" w:after="0" w:line="20" w:lineRule="exact"/></w:pPr></w:p>';
                pendingBreak = false;
            };

            for (const b of page.blocks) {
                if (b.type === 'para') {
                    if (b.runs.length === 1 && !b.runs[0].text.trim()) continue;
                    body += paraXml(b, ctxBase, { pageBreakBefore: pendingBreak });
                    pendingBreak = false;
                } else if (b.type === 'table') {
                    if (pendingBreak) emitBreakParagraph();
                    body += tableXml(b, ctxBase, page.margins, page.W);
                    body += '<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="120" w:lineRule="exact"/></w:pPr></w:p>';
                } else if (b.type === 'image' && hooks.encodeImage) {
                    const enc = await hooks.encodeImage(b.img);
                    if (!enc) continue;
                    let w = b.box.w, h = b.box.h;
                    if (w > textW) { h = h * textW / w; w = textW; }
                    const cx = b.box.x + b.box.w / 2;
                    const align = Math.abs(cx - page.W / 2) < page.W * 0.04 ? 'center' : (b.box.x > page.W * 0.55 ? 'right' : 'left');
                    if (pendingBreak) {
                        // gambar sebagai blok pertama: pakai paragraf kosong bertanda page break
                        emitBreakParagraph();
                    }
                    body += imageXml({ bytes: enc.bytes, ext: enc.ext, wPt: w, hPt: h }, ctxBase, align);
                    model.stats.images++;
                } else if (b.type === 'scanpage' && (hooks.renderPage || hooks.encodeImage)) {
                    // Halaman hasil scan: pakai gambar aslinya bila satu gambar menutupi hampir seluruh halaman
                    // (lebih tajam dan lebih kecil daripada merender ulang halaman), jika tidak render halaman.
                    let enc = null;
                    const big = (b.rp.images || []).filter(im => im.box.w * im.box.h > page.W * page.H * 0.85)
                        .sort((a, c) => c.box.w * c.box.h - a.box.w * a.box.h)[0];
                    if (big && hooks.encodeImage) enc = await hooks.encodeImage(big.img);
                    if (!enc && hooks.renderPage) enc = await hooks.renderPage(b.rp.page, page.W, page.H);
                    if (!enc) continue;
                    const maxW = page.W - 36, maxH = page.H - 36 - 8;
                    const f = Math.min(maxW / page.W, maxH / page.H);
                    if (pendingBreak) emitBreakParagraph();
                    body += imageXml({ bytes: enc.bytes, ext: enc.ext, wPt: page.W * f, hPt: page.H * f }, ctxBase, 'center');
                    model.stats.images++;
                }
            }

            // akhir bagian: paragraf kosong pembawa sectPr bila halaman berikutnya berbeda
            const next = pages[pi + 1];
            if (next && !sameSection(page, next)) {
                body += `<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="20" w:lineRule="exact"/>${sectPrXml(page, false)}</w:pPr></w:p>`;
            }
        }
        const lastPage = pages[pages.length - 1] || { W: 595, H: 842, margins: { top: 56, right: 56, bottom: 56, left: 56 } };
        if (!body) body = '<w:p/>';
        body += sectPrXml(lastPage, true);

        const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ' +
            'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
            'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"';
        const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${NS}><w:body>${body}</w:body></w:document>`;

        const bodyHp = Math.max(2, Math.round(model.bodySize * 2));
        const fam = esc(model.bodyFamily);
        const headStyle = (n, mult) => `<w:style w:type="paragraph" w:styleId="Heading${n}"><w:name w:val="heading ${n}"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:uiPriority w:val="9"/><w:qFormat/><w:pPr><w:keepNext/><w:outlineLvl w:val="${n - 1}"/></w:pPr></w:style>`;
        const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">` +
            `<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="${fam}" w:hAnsi="${fam}" w:cs="${fam}" w:eastAsia="${fam}"/><w:sz w:val="${bodyHp}"/><w:szCs w:val="${bodyHp}"/><w:lang w:val="id-ID" w:eastAsia="id-ID" w:bidi="ar-SA"/></w:rPr></w:rPrDefault>` +
            `<w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>` +
            `<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>` +
            headStyle(1) + headStyle(2) + headStyle(3) +
            `<w:style w:type="character" w:styleId="Hyperlink"><w:name w:val="Hyperlink"/><w:uiPriority w:val="99"/><w:rPr><w:color w:val="0563C1"/><w:u w:val="single"/></w:rPr></w:style>` +
            `<w:style w:type="table" w:default="1" w:styleId="TableNormal"><w:name w:val="Normal Table"/><w:tblPr><w:tblInd w:w="0" w:type="dxa"/><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="108" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style>` +
            `</w:styles>`;

        const numberingXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">${abstract.join('')}${nums.join('')}</w:numbering>`;
        const settingsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:zoom w:percent="100"/><w:defaultTabStop w:val="720"/><w:characterSpacingControl w:val="doNotCompress"/><w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat></w:settings>`;

        const exts = new Set(media.map(m => m.name.split('.').pop()));
        const ctypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
            `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>` +
            (exts.has('png') ? '<Default Extension="png" ContentType="image/png"/>' : '') +
            (exts.has('jpg') ? '<Default Extension="jpg" ContentType="image/jpeg"/>' : '') +
            `<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>` +
            `<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>` +
            `<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>` +
            `<Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>` +
            `<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>` +
            `<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`;

        const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
            `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>` +
            `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>` +
            `<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`;

        const docRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
            `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
            `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>` +
            `<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>` +
            rels.join('') + `</Relationships>`;

        const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
        const core = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${esc(hooks.title || 'Dokumen')}</dc:title><dc:creator>PDF &amp; Image Tools</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`;
        const app = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>PDF &amp; Image Tools</Application></Properties>`;

        zip.file('[Content_Types].xml', ctypes);
        zip.file('_rels/.rels', rootRels);
        zip.file('word/document.xml', documentXml);
        zip.file('word/styles.xml', stylesXml);
        zip.file('word/numbering.xml', numberingXml);
        zip.file('word/settings.xml', settingsXml);
        zip.file('word/_rels/document.xml.rels', docRels);
        zip.file('docProps/core.xml', core);
        zip.file('docProps/app.xml', app);
        media.forEach(m => zip.file('word/media/' + m.name, m.bytes));

        return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', compressionOptions: { level: 6 } });
    }

    return { collectPage, buildModel, buildDocx, buildLines, detectTables, normalizeFontName, detectListMarker };
});
