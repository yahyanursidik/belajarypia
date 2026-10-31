# Audit stack dan alur portal — 31 Oktober 2026

## Keputusan teknologi

Pertahankan React SPA, Refine headless, Supabase Auth/PostgreSQL/RLS/Edge Functions,
Tailwind dan komponen lokal. Tidak ada kebutuhan produk yang membenarkan migrasi
framework total. Upgrade berikut memilih rilis stabil yang tersedia pada tanggal
audit; package-lock.json adalah acuan instalasi yang dapat diulang.

| Komponen | Versi lock sebelumnya | Versi terpasang |
| --- | --- | --- |
| Node untuk pengembangan | 22 | 24.22.1 LTS |
| React / React DOM | 19.2.7 | 19.3.1 |
| React Router DOM | 6.30.4 | 7.18.5 |
| Vite | 7.3.5 | 8.3.5 |
| Plugin React Vite | 4.7.0 | 6.1.2 |
| TypeScript | 5.8.3 | 6.0.3 |
| ESLint | 9.39.4 | 10.14.0 |
| typescript-eslint | 8.62.0 | 8.72.1 |
| Supabase JS | 2.108.2 | 2.118.0 |
| Tailwind CSS / plugin Vite | 4.3.1 | 4.3.3 |
| Lucide React | 0.469.0 | 1.66.0 |
| Radix UI / React Slot | 1.6.1 / 1.3.0 | 1.8.1 / 1.5.0 |
| PapaParse | 5.5.4 | 5.7.0 |
| Refine core | 5.0.12 | 5.0.12, tetap mutakhir |

TypeScript 7 belum dipilih: typescript-eslint mendukung TS <6.1 dan fixture Edge
Function membutuhkan API `transpileModule`. Ini keputusan kompatibilitas,
bukan klaim bahwa TS 6 merupakan versi npm paling baru. React Compiler tidak
diaktifkan. Aturan hooks yang sudah dipakai tetap berlaku.

Konfigurasi Vite menggunakan Rolldown `output.codeSplitting`; objek manualChunks
lama dihapus. Alias Vite memakai import.meta.dirname. Alias TypeScript memakai
paths relatif tanpa baseUrl. React Router tetap menggunakan paket kompatibilitas
react-router-dom; seluruh route absolut dan guard peran dipertahankan.

PGlite ditambahkan sebagai devDependency agar pengujian SQL bisa berjalan tanpa
instalasi tambahan di /tmp. Test runner menyediakan pemilahan unit/SQL, menjalankan
file secara serial, serta mengaktifkan VM modules untuk fixture Deno.

## Menjalankan proyek

Gunakan Node 24.22.1 sesuai .nvmrc/.node-version (contoh: `nvm install && nvm use`).
Tidak perlu memasang service-role key untuk menjalankan frontend.

```bash
npm ci
npm run check
npm run test:sql
npm run dev -- --host 0.0.0.0 --port 5173 --strictPort
```

`npm run check` menjalankan lint, typecheck, unit test dan build. `npm test`
menjalankan semua unit dan SQL test. SQL test menggunakan database sementara
PGlite, bukan proyek Supabase produksi. Build hosting juga harus memakai Node 24;
versi minimum dibatasi di engines. Pemasangan runtime pengujian lokal tidak
mengganti Node sistem pengguna.

## Audit keamanan dependensi

- Sebelum: 24 temuan (7 high, 16 moderate, 1 low).
- Sesudah upgrade dan patch transitif kompatibel: 12 moderate, 0 high/critical.
- `npm audit --omit=dev`: **0 temuan** pada paket produksi.
- Sisa 12 entri adalah rantai tooling ESLint/typescript-eslint yang memakai
  minimatch 10.2.6. Akar advisori GHSA-g3hv-75wg-m249 diperbaiki di 11.0.1,
  di luar rentang mayor dependensi induk. Tidak menggunakan audit fix --force
  yang menawarkan downgrade tidak relevan, atau override major tanpa dukungan.
- Pantau patch kompatibel ESLint/typescript-eslint. Hindari pola glob tidak
  tepercaya pada tool lint. Hasil audit adalah snapshot, bukan jaminan keamanan
  aplikasi atau audit menyeluruh backend.

## Keterhubungan fitur dan kekurangan

Pemeriksaan mencakup route, navigasi, halaman, helper data, migration dan tests.
Status kode tidak otomatis membuktikan semua fungsi sudah terpasang di server.

| Alur | Admin | Peserta | Pengajar | Temuan / tindak lanjut |
| --- | --- | --- | --- | --- |
| Akses dan profil | Peran/cakupan, profil sendiri | Wizard profil dan kepesertaan | Profil sendiri, kelas penugasan | Sudah ada; guard frontend harus tetap didampingi RLS/RPC |
| Admisi → enrollment → kelas | Review, terima, penempatan | Pendaftaran, status, pembayaran | Daftar kelas dan peserta | Sudah terhubung; verifikasi transaksi melalui fixture SQL |
| Program → materi → progres | Kurikulum dan laporan | Prasyarat, lanjut belajar, progres | Materi dan progres peserta | Sudah ada; denominator progres hanya materi yang dapat diakses |
| Rilis/tenggat → materi | Agenda baru | Agenda baru dan tautan beranda | Agenda baru dan tautan kelas | Diimplementasikan pada putaran ini |
| Ujian → koreksi → hasil | Penilaian dan audit | Percobaan, status koreksi, transkrip | Review esai | Sudah ada; tidak disamakan dengan tugas berkas |
| Tugas → pengumpulan → revisi | Frontend lokal dan backend 022 sudah diterapkan | Draf, pengumpulan, revisi, lampiran privat dan riwayat | Wizard tugas, antrean scoped, umpan balik dan nilai final atomik ke progres | Rincian dan batas: ASSIGNMENT_WORKSPACE.md; rubrik multi-kriteria/notifikasi masih backlog |
| Pertemuan → presensi | Belum ada rekap presensi native | Belum ada jadwal sesi native/check-in | Belum ada input presensi per sesi | Prioritas P1: live_sessions, attendance, catatan, batas cakupan, laporan; agenda materi bukan presensi |
| Keuangan → bukti → verifikasi | Tagihan, kanal rekening/QR, jurnal | Bayar manual, bukti privat | Tidak perlu akses finansial | Sudah ada; tidak menambahkan payment gateway |
| Kelulusan → sertifikat | Kelayakan, antrean, proses | Hasil dan unduhan | Progres dan nilai menjadi input | Sudah ada; tidak mengubah kelulusan nyata saat pengujian |
| Pengumuman / helpdesk | Publikasi bertarget dan tindak lanjut | Kotak pengumuman dan bantuan | Kotak pengumuman dan bantuan | Sudah ada; reminder otomatis dari agenda belum tersedia |
| Target Qur'an | Data fondasi dan modul mentor | Tampilan target/umpan balik lintas program perlu dilengkapi | Peran mentor terpisah | P2: audit khusus alur Qur'an; jangan memindahkan akses mentor ke semua pengajar |
| Kegagalan halaman / jaringan | Recovery bersama | Recovery bersama | Recovery bersama | Diimplementasikan; indikator offline tidak mengklaim menyimpan jawaban offline |

Implementasi tahap ini menutup agenda lintas portal dan ketahanan navigasi.
Rubrik tugas lanjutan, presensi, reminder dan pemeriksaan Qur'an di atas tetap backlog
yang nyata; belum diklaim selesai. Detail fase produk tetap mengikuti ROADMAP.

## Agenda dan batas akses

Sumber delapan Edge Function dan helper sertifikat kini memakai Supabase JS
2.118.0. Pemeriksaan Deno menemukan tipe BufferSource pada penandatanganan
document-signed-url; typed array disalin ke ArrayBuffer seperti helper S3 yang
sudah ada. Algoritme HMAC tetap sama dan diuji dengan vektor RFC 4231, termasuk
subarray dengan offset. Deno check dijalankan memakai Deno 2.5.4 yang tersedia
lokal. Runtime Edge Supabase dikelola layanan dan tidak dinaikkan oleh perubahan
package.json. Sumber fungsi yang baru **belum dideploy ulang** ke proyek remote.

Tidak ada migration database baru pada tahap ini; fitur agenda memakai skema
dan RPC yang sudah tersedia. Tidak ada push/merge atau deployment hosting.

- Route /system/agenda, /admin/agenda, /teacher/agenda, /learner/agenda.
- Filter bulan/program/jenis tersimpan di URL, 30 kegiatan per halaman, waktu WIB,
  pengurutan berdasarkan timestamp, status kosong/error/retry, layout mobile.
- Hanya materi published dengan tanggal rilis/tenggat. Materi tanpa tanggal
  tetap ditemukan di kurikulum. Draft/arsip tidak menjadi kegiatan agenda.
- Peserta memakai RPC learner_portal_workspace milik sendiri, hanya enrollment
  aktif; prasyarat mengarah kembali ke program, selesai/menunggu nilai dibedakan.
  Materi rilis masa depan yang disembunyikan RPC tetap tidak diungkap.
- Pengajar membaca program yang ditugaskan langsung atau melalui kelas; admin
  membaca cakupan yang diberikan RLS. Query dipaginasi, ID dibagi batch.
- Agenda membaca data saja. Tidak menandai selesai, mengubah jadwal, merekam
  presensi, mengirim reminder, atau menyimpan perubahan ke Supabase.
- Tombol pengajar/admin membuka kurikulum program terkait; peserta membuka
  materi atau prasyarat. Kartu lama “Jadwal & Presensi” yang tidak memiliki
  fungsi presensi diganti menjadi “Agenda Pembelajaran”.
- RouteRecovery menangkap kegagalan render/lazy load di area isi portal;
  sidebar tetap tersedia. Pesan generik tidak membocorkan exception/credential.

## Sumber keputusan

- https://nodejs.org/en/blog/release/v24.22.1
- https://vite.dev/blog/announcing-vite8
- https://vite.dev/guide/migration
- https://rolldown.rs/in-depth/manual-code-splitting
- https://typescript-eslint.io/users/dependency-versions/
- https://eslint.org/docs/latest/use/migrate-to-10.0.0
- https://reactrouter.com/changelog
- https://github.com/advisories/GHSA-g3hv-75wg-m249
- Versi exact dan waktu terbit paket diperiksa melalui registry npm pada tanggal audit.

## Hasil verifikasi

- Lint seluruh repo: 0 error, 4 warning lama pada TranscriptView, tabs, AdmissionPortalPage dan AdmissionStatusPage.
- Typecheck dan production build Vite 8 lulus.
- Unit: 23 berkas lulus; SQL PGlite: 15 berkas lulus. Termasuk isolasi cakupan, konflik versi, transaksi, dokumen privat, HMAC dan agenda WIB.
- Deno check delapan Edge Function lulus. Ini pemeriksaan tipe lokal, bukan tes integrasi fungsi remote yang baru.
- Browser fixture memverifikasi agenda pengajar/admin/peserta, filter jenis dan bulan kosong, URL tujuan materi, status selesai/prasyarat, serta lebar 390 px tanpa overflow horizontal. Fixture memakai data contoh dan endpoint lokal; tidak menggantikan pengujian login/RLS dengan akun nyata.
- Halaman login dev localhost dan bundle produksi dapat dirender tanpa console error. Form dev aktif. Pada preview produksi lokal, form email/sandi tetap dinonaktifkan oleh aturan Turnstile lama karena site key tidak tersedia. Konfigurasi CAPTCHA hosting perlu diperiksa sebelum deployment; tidak mengubah perlindungan login pada tahap upgrade ini.
- Tidak melakukan login ulang sebagai pengguna nyata, submit jawaban, menyimpan profil, verifikasi pembayaran, pengiriman pengumuman, atau penerbitan sertifikat.
- Bukti lokal: ../agenda-pengajar-contoh.png dan ../agenda-peserta-mobile-contoh.png.
