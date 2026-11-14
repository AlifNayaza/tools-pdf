// js/shared/tool-ui.js - elemen UI seragam untuk semua halaman alat:
// langkah cara pakai, catatan privasi, dan tautan alat terkait.
(function () {
    'use strict';

    const TOOLS = {
        '/pdf-compressor': ['Kompres PDF', 'fa-compress'],
        '/pdf-merge': ['Gabung PDF', 'fa-object-group'],
        '/pdf-split': ['Pisah PDF', 'fa-cut'],
        '/pdf-rotate': ['Putar PDF', 'fa-redo'],
        '/pdf-to-word': ['PDF ke Word', 'fa-file-word'],
        '/pdf-to-images': ['PDF ke Gambar', 'fa-images'],
        '/pdf-to-long-image': ['PDF ke Gambar Panjang', 'fa-scroll'],
        '/pdf-to-text': ['PDF ke Teks', 'fa-file-alt'],
        '/image-to-pdf': ['Gambar ke PDF', 'fa-file-image'],
        '/html-to-pdf': ['HTML ke PDF', 'fa-code'],
        '/image-compressor': ['Kompres Gambar', 'fa-compress-arrows-alt'],
        '/image-resizer': ['Ubah Ukuran Gambar', 'fa-expand-arrows-alt'],
        '/image-format-converter': ['Konversi Format Gambar', 'fa-sync-alt']
    };

    // Alat yang biasanya dipakai berurutan
    const RELATED = {
        '/pdf-compressor': ['/pdf-merge', '/pdf-split', '/image-to-pdf'],
        '/pdf-merge': ['/pdf-compressor', '/pdf-split', '/pdf-rotate'],
        '/pdf-split': ['/pdf-merge', '/pdf-compressor', '/pdf-rotate'],
        '/pdf-rotate': ['/pdf-merge', '/pdf-split', '/pdf-compressor'],
        '/pdf-to-word': ['/pdf-to-text', '/pdf-compressor', '/pdf-split'],
        '/pdf-to-images': ['/image-compressor', '/image-resizer', '/pdf-to-long-image'],
        '/pdf-to-long-image': ['/pdf-to-images', '/image-compressor', '/image-resizer'],
        '/pdf-to-text': ['/pdf-to-word', '/pdf-split', '/pdf-compressor'],
        '/image-to-pdf': ['/pdf-compressor', '/image-compressor', '/pdf-merge'],
        '/html-to-pdf': ['/pdf-compressor', '/pdf-merge', '/pdf-split'],
        '/image-compressor': ['/image-resizer', '/image-format-converter', '/image-to-pdf'],
        '/image-resizer': ['/image-compressor', '/image-format-converter', '/image-to-pdf'],
        '/image-format-converter': ['/image-compressor', '/image-resizer', '/image-to-pdf']
    };

    function currentPath() {
        return window.location.pathname.replace(/index\.html$/, '').replace(/\.html$/, '').replace(/\/$/, '') || '/';
    }

    function stepsFor(card) {
        if (card.querySelector('#htmlEditor')) {
            return ['Tulis atau tempel HTML', 'Cek pratinjau', 'Unduh PDF'];
        }
        const hasOptions = !!card.querySelector('#step2');
        return hasOptions
            ? ['Pilih file', 'Atur pilihan', 'Proses &amp; unduh']
            : ['Pilih file', 'Klik proses', 'Unduh hasil'];
    }

    document.addEventListener('DOMContentLoaded', function () {
        const card = document.querySelector('.card');
        if (!card || !document.body.classList.contains('tool-page')) return;

        // 1. Langkah cara pakai di bawah deskripsi
        const header = card.querySelector('.card-header');
        if (header && !header.querySelector('.how-steps')) {
            const ol = document.createElement('ol');
            ol.className = 'how-steps';
            ol.setAttribute('aria-label', 'Cara pakai');
            ol.innerHTML = stepsFor(card).map((t, i) => `<li><span>${i + 1}</span> ${t}</li>`).join('');
            header.appendChild(ol);
        }

        // 2. Catatan privasi di bawah area unggah
        const step1 = card.querySelector('#step1');
        if (step1 && !card.querySelector('.privacy-note')) {
            const p = document.createElement('p');
            p.className = 'privacy-note';
            p.innerHTML = '<i class="fas fa-lock"></i> File diproses di perangkat Anda dan tidak diunggah ke server.';
            step1.appendChild(p);
        }

        // 3. Alat terkait di bawah kartu
        const path = currentPath();
        const related = RELATED[path];
        if (related && !document.querySelector('.related-tools')) {
            const nav = document.createElement('nav');
            nav.className = 'related-tools';
            nav.setAttribute('aria-label', 'Alat terkait');
            nav.innerHTML = '<h2>Alat lain yang sering dipakai</h2><div class="related-list">' +
                related.map(h => `<a href="${h}"><i class="fas ${TOOLS[h][1]}"></i> ${TOOLS[h][0]}</a>`).join('') +
                '</div>';
            card.insertAdjacentElement('afterend', nav);
        }
    });
})();
