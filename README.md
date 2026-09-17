# CountMeasure AI — AI for Counting and Measures (Displayed with Formula)

CountMeasure AI adalah sistem Computer Vision berbasis web modern yang menggabungkan deteksi objek, estimasi dimensi (panjang, lebar, keliling, luas, volume, densitas), kalibrasi piksel ke metrik nyata, dan **penyajian formula matematis transparan (LaTeX / KaTeX)**.

Aplikasi ini dirancang dengan tema gelap elegan berdasar warna **`#1c1c1c`**, aksen kontras tinggi (*emerald green*, *cyber cyan*, *vivid amber*), serta **Visual Node Workflow (ala Langflow)** pada Stage 0 Clarification & Pipeline Orchestration sehingga baik alur AI maupun kalkulasi matematis tidak beroperasi sebagai "black box".

---

## 🌟 Fitur Utama

1. **Stage 0: Visual Node Workflow (Langflow-style)**
   - Alur klarifikasi disajikan dalam bentuk graf node interaktif (*draggable nodes*, *animated pulse edges*, *typed sockets*).
   - Menampilkan konversi dari prompt teks bebas user $\to$ ekstraksi kelas target $\to$ pemilihan mode (hitung/ukur/keduanya) $\to$ normalisasi satuan metrik $\to$ strategi kalibrasi $\to$ guardrail ambiguitas $\to$ eksekusi pipeline.
   - Pengguna dapat mengubah parameter langsung di kartu node visual tanpa perlu menyentuh kode backend.

2. **Stage 1–4: Computer Vision Core & Measurement Engine**
   - Mendeteksi dan menghitung objek dengan orientasi presisi (*Oriented Minimum-Area Bounding Box* dan *Contour Polygons*).
   - Kalibrasi otomatis menggunakan objek referensi:
     - **Koin 500 IDR (27.0 mm)** atau **US Quarter (24.26 mm)**
     - **Kartu Standar ID / Kartu Kredit ISO 7810 (85.60 mm)**
     - **ArUco Marker 4x4 (50.0 mm)**
     - **Interactive 2-Point Manual Ruler**
   - Estimasi volume 3D:
     - Model Elipsoid: $V = \frac{4}{3}\pi \cdot a \cdot b^2$ (buah, sel darah, telur)
     - Model Silinder: $V = \pi r^2 h$ (baut, kaleng, botol, kapsul)
     - Model Balok / Cuboid: $V = L \times W \times H$ (paket kardus gudang)
   - Analisis spasial: Kepadatan ($\rho = N / A$) dan jarak tetangga terdekat (*Nearest Neighbor Distance*).

3. **Stage 5: Panel Transparansi Formula KaTeX**
   - Menampilkan rumus aljabar teoritis berdampingan dengan substitusi angka riil dan satuan metrik untuk setiap objek yang diklik.
   - Dilengkapi buku panduan rumus (*formula handbook*) serta turunan rumus statistik sampel mean & standar deviasi.

4. **Stage 6 & 7: Vision Studio, Tabel Interaktif & Ekspor Laporan**
   - Studio canvas interaktif dengan pan, zoom, layer toggle (*bounding box, masks, labels, centroids, calibration*).
   - Tabel metrik yang dapat diurutkan (*sortable*), dicari (*searchable*), dan diklik untuk inspeksi sinkron.
   - Ekspor laporan audit ke **CSV**, **JSON**, dan **Laporan Cetak / PDF**.
   - Dukungan kamera langsung (**Live Webcam**) dan **Preset Demo Bawaan**.

---

## 🚀 Cara Menjalankan Aplikasi

### 1. Menjalankan Backend (FastAPI)
```bash
cd backend
python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```
API akan aktif di `http://127.0.0.1:8000` dengan dokumentasi Swagger di `http://127.0.0.1:8000/docs`.

### 2. Menjalankan Frontend (React + Vite)
```bash
cd frontend
npm run dev
```
Buka browser Anda di `http://127.0.0.1:5173`.

---

## 🚢 Deployment (Railway + Vercel)

Arsitektur hybrid: **frontend di Vercel**, **backend FastAPI di Railway**.

### Backend — Railway
- Project: **Compute** — service backend dengan root directory `backend`.
- Konfigurasi build/start: [`backend/railway.json`](backend/railway.json).
- Build memaksa **hanya** `opencv-python-headless` yang terpasang. `ultralytics`
  menarik `opencv-python` (non-headless) yang butuh `libxcb.so.1`; package itu
  dibuang saat build agar `import cv2` tidak crash di image tanpa X11.
- Health check: `GET /api/health` → `{"status":"ok"}`.
- URL backend final: **https://computation-ai-production.up.railway.app**
  (Railway → service → **Settings → Networking → Generate Domain**).

### Frontend — Vercel
- Root directory: `frontend` (Vite + React).
- Env var wajib: `VITE_API_BASE_URL` = URL backend Railway di atas, **tanpa**
  trailing slash. Dibaca oleh [`frontend/src/apiConfig.js`](frontend/src/apiConfig.js).
- Set di Vercel → Project → **Settings → Environment Variables**, lalu **Redeploy**
  (perubahan env var butuh redeploy, tidak langsung live).
- Jika `VITE_API_BASE_URL` kosong, request jadi same-origin — hanya benar untuk
  dev lokal (proxy Vite di `frontend/vite.config.js`).

> Migrasi: backend sebelumnya pernah direncanakan di Render
> (`countmeasure-backend.onrender.com`). Blueprint Render sudah dihapus dari repo.
> Jangan arahkan `VITE_API_BASE_URL` ke domain `*.onrender.com`.

---

## 📐 Rumus Matematis yang Digunakan

### 1. Rasio Skala Kalibrasi (Piksel ke Metrik)
$$S = \frac{D_{\text{real}}}{d_{\text{px}}} \quad \left[\frac{\text{unit}}{\text{px}}\right]$$

### 2. Dimensi Linear (Panjang & Lebar)
$$L = l_{\text{px}} \cdot S, \quad W = w_{\text{px}} \cdot S$$

### 3. Luas Kontur Riil
$$A = A_{\text{px}} \cdot S^2 \quad [\text{unit}^2]$$

### 4. Derajat Kebulatan (Circularity)
$$C = \frac{4\pi \cdot A_{\text{px}}}{P_{\text{px}}^2} \quad (C \in [0, 1])$$

### 5. Estimasi Volume 3D (Elipsoid Simetris)
$$V = \frac{4}{3}\pi \left(\frac{L}{2}\right) \left(\frac{W}{2}\right)^2$$

### 6. Densitas Kepadatan Spasial
$$\rho = \frac{N_{\text{total}}}{A_{\text{frame}}}$$
