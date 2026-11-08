# 🫧 Maha Laundry POS Pro

> Sistem Kasir & Manajemen Laundry Modern, Cepat, Responsif, dan Elegan dengan Desain Glassmorphism.

![Node.js](https://img.shields.io/badge/Node.js-v18+-green.svg)
![Express](https://img.shields.io/badge/Express-v4.21-blue.svg)
![MySQL](https://img.shields.io/badge/MySQL-v8.0+-orange.svg)
![License](https://img.shields.io/badge/License-MIT-purple.svg)

---

## ✨ Fitur Utama

- **🎨 Modern Glassmorphic UI**: Antarmuka frosted-glass elegan dengan animasi ambient orbs dan Font Awesome 6 Icons.
- **📢 Running Text Ticker**: Pengumuman berjalan interaktif dengan metrik live dinamis (total transaksi & omset harian).
- **🛒 Kasir Cepat & Fleksibel**:
  - Dukungan layanan laundry kiloan (kg) dan satuan (pcs, pasang, item).
  - Pilihan metode pembayaran interaktif: **Tunai (Cash)**, **QRIS**, dan **Belum Dibayar**.
  - Kalkulasi subtotal, diskon otomatis, dan estimasi waktu selesai cucian.
- **📊 Manajemen Transaksi Lengkap**:
  - **Pemisahan Waktu**: Filter per tanggal (harian), per bulan (bulanan), dan per tahun (tahunan).
  - **Filter Pembayaran & Status**: Filter berdasarkan metode bayar (Tunai, QRIS, dll.), status lunas, dan status cucian.
  - **Quick Pay Action**: Tombol bayar cepat untuk pelunasan instan.
- **🧾 Cetak Struk Thermal & WhatsApp Share**:
  - Desain struk thermal kasir presisi (siap cetak 58mm / 80mm).
  - Satu klik kirim nota digital langsung ke WhatsApp pelanggan.
- **🏷️ Pengaturan Tarif & Master Layanan**: Tambah, ubah, dan hapus layanan laundry (Khusus Admin).
- **📈 Laporan Keuangan**: Rekap omset dan grafik pendapatan harian, mingguan, serta bulanan.
- **👥 Multi-Role & Manajemen Staf**: Hak akses bertingkat untuk Administrator dan Staf Kasir.
- **📱 100% Responsif**: Nyaman digunakan di layar komputer kasir, tablet POS, maupun smartphone (mobile drawer navigation).

---

## 🛠️ Tech Stack

- **Backend**: Node.js, Express.js
- **Database**: MySQL 8.0+ / MariaDB (`mysql2/promise`)
- **Keamanan**: JWT (JSON Web Token) HttpOnly Cookie, Bcrypt.js (Password Hashing), Helmet
- **Frontend**: Vanilla JavaScript (ES6+), Modern CSS3 Glassmorphism, Font Awesome 6, Google Fonts (DM Sans & Manrope)

---

## 🚀 Panduan Instalasi & Menjalankan

### 1. Clone Repositori
```bash
git clone https://github.com/username/laundry-pos-pro.git
cd laundry-pos-pro
```

### 2. Install Dependensi
```bash
npm install
```

### 3. Konfigurasi Environment (`.env`)
Salin file `.env.example` menjadi `.env`:
- **Windows PowerShell**: `Copy-Item .env.example .env`
- **Command Prompt**: `copy .env.example .env`
- **Linux/Mac**: `cp .env.example .env`

Buka file `.env` dan sesuaikan koneksi database MySQL Anda:
```env
PORT=3000
NODE_ENV=development
JWT_SECRET=kunci_rahasia_jwt_minimal_32_karakter_acak

DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=laundry_pos
DB_SSL=false
```

### 4. Setup Database
Buka file `database.sql` di **MySQL Workbench** / **phpMyAdmin**, lalu eksekusi (Execute).  
Skrip ini akan otomatis membuat database `laundry_pos`, semua tabel, master layanan, dan akun admin default.

*Atau jalankan inisialisasi via terminal:*
```bash
node src/seed.js
```

### 5. Jalankan Aplikasi
```bash
node src/server.js
```
*(atau untuk mode auto-reload development: `npm run dev`)*

Buka browser: **http://localhost:3000**

---

## 🔐 Akun Login Default

- **Username**: `admin`
- **Password**: `Admin123!`
- **Role**: Administrator

> *Setelah berhasil masuk pertama kali, segera buat akun staf kasir atau ubah password di menu Pengguna.*

---

## 🔒 Catatan Keamanan GitHub

File `.gitignore` telah dikonfigurasi untuk:
- Mengabaikan file `.env` (berisi password database & token rahasia).
- Mengabaikan direktori `node_modules/`.
- Hanya mengunggah template publik `.env.example`.

---

## 📄 Lisensi

Proyek ini dibuat untuk keperluan komersial & operasional laundry modern.
