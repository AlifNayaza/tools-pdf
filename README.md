# PDF & Image Tools Suite

Aplikasi web statis modern (Neo-Brutalist design) untuk mengelola dokumen PDF dan file gambar langsung di browser secara gratis, cepat, dan aman tanpa perlu mengunggah file ke server luar.

---

## 🚀 Cara Running / Menjalankan Proyek

Aplikasi ini menggunakan **Clean Routing** (misalnya `/pdf-compressor`, `/image-to-pdf`), sehingga disarankan dijalankan menggunakan **Web Server lokal** agar navigasi dan eksekusi skrip berjalan sempurna.

### Metode 1: Menggunakan Node.js (`npx serve` atau `npx http-server`) — *Direkomendasikan*

1. Pastikan Anda sudah menginstal Node.js di komputer.
2. Buka terminal/PowerShell di direktori proyek ini.
3. Jalankan perintah berikut:
   ```bash
   npx serve .
   ```
   *atau*
   ```bash
   npx http-server -p 3000
   ```
4. Buka browser dan akses alamat yang ditampilkan (contoh: `http://localhost:3000`).

---

### Metode 2: Menggunakan Python (Tanpa Install Node.js)

Jika komputer Anda memiliki Python:

```bash
python -m http.server 8000
```
Buka browser lalu akses `http://localhost:8000`.

---

### Metode 3: Live Server (VS Code Extension)

1. Buka folder proyek di **VS Code**.
2. Install ekstensi **Live Server** (oleh Ritwick Dey).
3. Klik kanan pada `index.html` -> Pilih **Open with Live Server**.

---

### Metode 4: Netlify CLI (Testing Lokal)

Jika ingin menguji konfigurasi Netlify secara lokal:
```bash
npx netlify-cli dev
```

---

## 🌐 Cara Deploy ke Netlify

Anda dapat mempublikasikan website ini ke **Netlify** secara gratis dengan 3 cara mudah berikut:

### 🌟 Opsi A: Menggunakan Netlify CLI (Paling Cepat & Langsung dari Terminal)

1. Buka terminal/PowerShell di folder proyek ini (`Tools PDF`).
2. Pastikan Anda sudah login ke akun Netlify:
   ```bash
   npx netlify login
   ```
   *(Browser akan terbuka untuk konfirmasi otorisasi login).*
3. Untuk melakukan deploy langsung ke **Production (Live)**:
   ```bash
   npx netlify deploy --prod --dir .
   ```
4. Jika ditanya:
   - *Create & configure a new site* -> Pilih **Yes** atau pilih site yang sudah ada.
   - *Publish directory* -> Ketik `.` (titik) lalu tekan **Enter**.
5. Selesai! URL website live Anda (misal: `https://pdf-image-tools.netlify.app`) akan langsung diberikan di terminal.

---

### 🚀 Opsi B: Menggunakan GitHub / GitLab (Otomatis / CI-CD)

Jika proyek Anda terhubung ke repository Git (GitHub/GitLab):

1. Unggah kode proyek ini ke repository GitHub Anda (`git push origin main`).
2. Buka dashboard [Netlify](https://app.netlify.com/) dan login.
3. Klik tombol **"Add new site"** -> Pilih **"Import an existing project"**.
4. Pilih penyedia Git Anda (**GitHub**).
5. Pilih repository proyek Anda.
6. Pada bagian **Build settings**:
   - **Build command**: *(kosongkan saja)*
   - **Publish directory**: `.` *(atau biarkan kosong)*
7. Klik **"Deploy site"**. Netlify akan otomatis mendeploy dan setiap kali Anda melakukan `git push`, website akan otomatis ter-update!

---

### 📦 Opsi C: Drag & Drop ke Netlify Drop (Tanpa Perintah / Tanpa Git)

1. Buka browser dan kunjungi [Netlify Drop](https://app.netlify.com/drop).
2. Login ke akun Netlify Anda.
3. Seret (*drag & drop*) seluruh folder proyek `Tools PDF` langsung ke area upload di halaman browser tersebut.
4. Tunggu beberapa detik hingga proses selesai dan website Anda langsung siap diakses!

---

## 🛠️ Fitur Utama Tools (12-in-1 Suite)

1. **⚡ Kompres PDF** — Mengurangi ukuran file PDF tanpa menurunkan kualitas visual secara drastis.
2. **📑 Gabung PDF** — Menggabungkan beberapa file PDF menjadi satu file utuh dengan fitur drag & drop urutan.
3. **✂️ Pisah PDF** — Memisahkan halaman PDF berdasarkan rentang atau pilihan halaman individual (output berupa ZIP).
4. **🔄 Putar / Rotasi PDF** — Memperbaiki orientasi halaman PDF yang miring/terbalik (90°, 180°, 270°) per halaman atau serentak.
5. **📷 PDF ke Gambar** — Ekstrak halaman PDF menjadi gambar JPG/PNG resolusi tinggi.
6. **📄 Gambar ke PDF** — Konversi banyak gambar menjadi satu dokumen PDF dengan pilihan ukuran halaman (A4, Letter, Fit).
7. **🖼️ Kompres Gambar** — Kompresi gambar JPG dan PNG dengan pengaturan slider kualitas interaktif.
8. **📐 Ubah Ukuran Gambar** — Ubah dimensi piksel atau rasio aspek foto dengan preset instan (Pas Foto, Sosmed, Full HD).
9. **🔄 Konversi Format Gambar** — Konversi instan antar format `WEBP ↔ PNG ↔ JPG ↔ SVG`.
10. **📄 PDF ke Teks & MD** — Ekstrak isi tulisan dari file PDF per halaman ke file `.txt` atau Markdown (`.md`).
11. **📜 PDF ke Gambar Panjang** — Menggabungkan semua halaman PDF menjadi 1 file gambar vertikal panjang (Infografis/Katalog).
12. **🌐 HTML / Rich Text ke PDF** — Meng-export catatan Rich Text atau kode HTML menjadi dokumen PDF A4.

---

## 📁 Struktur Proyek (Terorganisir)

```
Tools PDF/
├── index.html              # Halaman utama (Tools Grid 12-in-1 dengan Live Search)
├── README.md               # Dokumentasi proyek
├── netlify.toml            # Konfigurasi deployment & redirects Netlify
├── manifest.json           # PWA Web App Manifest
├── icon.svg                # PWA Vector Icon
├── sw.js                   # Service Worker Offline Pre-caching (v32)
├── css/
│   └── style.css           # Styling utama & design system
├── js/
│   ├── shared/             # Skrip bersama/shared modules
│   │   ├── canvas-animation.js # Background animasi partikel
│   │   ├── file-validator.js   # Validasi file & magic bytes
│   │   ├── navbar.js           # Injection & logika navbar
│   │   ├── pwa.js              # Registrasi SW & Install prompt
│   │   ├── security.js         # Security & Global Clipboard Paste (Ctrl+V)
│   │   └── toast.js            # Toast Notification Neo-Brutalist
│   └── tools/              # Logika spesifik per tool (12 Tools)
│       ├── html-to-pdf.js
│       ├── image-compressor.js
│       ├── image-format-converter.js
│       ├── image-resizer.js
│       ├── image-to-pdf.js
│       ├── pdf-compressor.js
│       ├── pdf-merge.js
│       ├── pdf-rotate.js
│       ├── pdf-split.js
│       ├── pdf-to-images.js
│       ├── pdf-to-long-image.js
│       └── pdf-to-text.js
├── html-to-pdf/
├── image-compressor/
├── image-format-converter/
├── image-resizer/
├── image-to-pdf/
├── pdf-compressor/
├── pdf-merge/
├── pdf-rotate/
├── pdf-split/
├── pdf-to-images/
├── pdf-to-long-image/
└── pdf-to-text/
```

---

## 🔐 Keamanan & Privasi

- **Client-Side Processing**: Seluruh pemrosesan PDF dan gambar dilakukan 100% di browser pengguna (menggunakan `pdf-lib`, `pdf.js`, `mammoth.js`, `SheetJS`, dan Canvas API). File Anda **tidak pernah diunggah ke server mana pun**.
- **Security Protections**: Dilengkapi dengan `security.js` dan `file-validator.js` untuk proteksi input, MIME type check, magic bytes check, serta proteksi XSS/Clickjacking.

---

## 📄 Lisensi

Bebas digunakan untuk penggunaan personal maupun komersial.