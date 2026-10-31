# Pengumpulan dan revisi tugas

Paket lokal 2026-10-31: frontend, migration `202610310022_assignment_workflow` dan Edge Function `assignment-documents`. Sudah diterapkan setelah persetujuan pengguna. Deployment YPIA / BelajarLMS1, `foauntgtmhnhqlspgtoc`, branch main.

## Alur yang terhubung

| Portal | Tindakan | Keterhubungan |
| --- | --- | --- |
| Admin / system | Buat atau atur tugas melalui wizard dua langkah; filter pengumpulan; minta revisi atau finalkan nilai | Program → kurikulum → tugas → penilaian → progres |
| Pengajar program | Mengatur tugas di program yang ditugaskan, membaca kiriman, memberi umpan balik/nilai | Ruang mengajar, menu Tugas, Penilaian, kurikulum |
| Pengajar kelas | Meninjau kiriman peserta di kelas aktif yang ditugaskan | Tidak mengubah instruksi bersama untuk seluruh program |
| Peserta | Mulai, simpan draf, kumpulkan, revisi, kirim ulang, lihat nilai/riwayat | Beranda → Tugas & revisi; menu Tugas; materi tugas; Program & progres |

Rute daftar/detail: `/system/tugas`, `/admin/tugas`, `/teacher/tugas`, `/learner/tugas` dan `/:portal/tugas/:lessonId`. Filter program, status, pencarian dan halaman disimpan pada URL. Penilai memakai parameter enrollment yang divalidasi server, bukan sebagai bukti izin.

## Aturan produk

- Jenis jawaban wajib: teks, dokumen/gambar, atau checklist. Catatan dan lampiran tambahan tetap tersedia. Maksimal 50.000 karakter, lima lampiran per kiriman, PDF/JPG/PNG/WebP maksimal 5 MB per berkas. Audio/video dan berkas Office tidak diterima oleh workflow tugas ini.
- Status: belum dikerjakan → draf → menunggu penilaian → perlu revisi → draf berikutnya → menunggu penilaian → nilai final.
- Draf bersifat privat. Tombol **Simpan draf** menyimpan ke server; belum ada autosave. Peringatan tampil untuk perubahan lokal dan saat menutup/memuat ulang tab; navigasi SPA lewat menu lain belum diblokir. Simpan sebelum berpindah halaman.
- Pengumpulan mengunci versi jawaban. Permintaan revisi wajib menyertakan umpan balik. Revisi menyalin jawaban serta referensi berkas ke versi baru, tanpa menimpa kiriman lama.
- Rilis, prasyarat, status kepesertaan/program/akun, tenggat dan kepemilikan diperiksa di server. Tenggat berlaku pada pengumpulan pertama; revisi yang diminta penilai tetap dapat dikirim setelah tenggat. Draf pertama yang terlambat tetap dapat disimpan, tetapi tidak dikumpulkan bila aturan terlambat nonaktif.
- Nilai final wajib 0–100, hanya untuk kiriman terbaru. Penilai tidak dapat menilai dirinya sendiri. Finalisasi menulis `lesson_progresses` dalam transaksi yang sama, sehingga portal peserta, laporan pengajar/admin dan perhitungan kelulusan memakai progres yang sama. Nilai final bukan keputusan lulus otomatis.
- Hasil tugas lama tidak ditimpa atau dikonversi otomatis. Materi tugas lama tanpa pengaturan baru ditandai **Belum diatur**.
- Pengaturan jawaban/instruksi terkunci setelah draf pertama. Wizard menyalin instruksi ke `lessons.content_body` sebagai `plain_text` agar pratinjau Review Konten tetap relevan. Form kurikulum mengarahkan perubahan instruksi ke Ruang Tugas; metadata/jadwal materi masih dikelola kurikulum. Snapshot instruksi/judul/tenggat disimpan saat pengumpulan.
- Versi lama dilipat agar kiriman terbaru dan tindakan penilai mudah ditemukan. Tidak mengirim email/WA atau menerbitkan pengumuman otomatis.

## Akses dan penyimpanan

Tiga tabel baru memakai RLS. Browser tidak memiliki DML langsung atau TRUNCATE; `assignment_files` hanya dapat dibaca melalui policy milik sendiri atau lampiran terpilih pada kiriman yang boleh dinilai. Semua perubahan memakai RPC `SECURITY DEFINER` dengan search_path tetap dan pemeriksaan aktor/cakupan. Enam helper internal tetap privat; sembilan RPC/wrapper diberikan eksplisit kepada authenticated. Fungsi penyelesaian berkas hanya untuk `service_role`.

Edge Function memverifikasi JWT, mengizinkan staging upload melalui RPC, memeriksa ukuran aktual/MIME/signature berkas, lalu menyalin byte ke object key privat baru sebelum menandai siap. Signed PUT staging tidak dapat menimpa versi final. Penyelesaian kembali memeriksa draf, pemilik dan akun/kepesertaan aktif. Unduhan meminta otorisasi serta audit sebelum membuat signed GET. Tidak ada rahasia Contabo dalam browser. Pemeriksaan signature bukan pemindai malware.

Audit menyimpan ID, nomor kiriman dan keputusan/nilai, tanpa isi jawaban, kontak atau teks umpan balik. Kegagalan audit membatalkan transaksi nilai/progres. Konflik revision UUID ditolak tanpa menimpa jawaban pengguna lain.

Batas staging: 20 percobaan unggah per draf untuk membatasi penyalahgunaan; berkas gagal/tidak dipilih masih memakan kuota ini. Pembersihan berkas yatim belum otomatis. Signed URL memiliki masa berlaku terbatas; buka/unduh ulang jika kedaluwarsa.

## Pengujian dan deployment

- Delapan skenario transaksi PostgreSQL terisolasi (PGlite): siklus lengkap, cakupan, draf privat, konflik versi, tenggat/prasyarat/akun, checklist, berkas/revisi dan rollback audit/hasil lama; termasuk daftar/paginasi dan pembuatan tugas oleh admin.
- Empat skenario Edge Function: autentikasi/owner, pemeriksaan byte dan sealing key, kegagalan ukuran/MIME/storage, idempotensi dan penolakan download saat audit gagal.
- Pengujian browser memakai UI asli + RPC SQL asli pada fixture lokal port 5195: admin membuat tugas → peserta menyimpan dan mengirim → pengajar meminta revisi → peserta mengirim versi kedua → pengajar finalkan 90 → peserta melihat hasil dan riwayat. Tidak menggunakan data atau akun operasional.
- Tampilan sempit yang benar-benar dilaporkan browser: 599 px, tanpa overflow horizontal. Permintaan viewport 390 px tidak diterapkan oleh lingkungan browser, sehingga 390 px belum diklaim terverifikasi.
- Paket `npm run check`: lint, typecheck, 24 berkas tes unit, build. Empat warning lint lama berada di luar perubahan tugas.
- Deno check sumber dan bundle Edge Function berhasil. Uji positif Contabo dengan akun nyata selesai pada tindak lanjut 2026-11-01; rincian di bawah.

Preflight READ ONLY Supabase: 76 migration sampai 021, belum ada tabel/fungsi tugas, tidak ada policy tulis langsung `lesson_progresses`. Baseline: 552 profil, 546 penugasan, 523 peserta, 1.064 enrollment, 80 materi, 0 progres, 10 audit. Berkas preflight, apply dengan guard history/dependency hash, verify, manifest SHA256/body MD5, bundle Edge dan emergency disable ada di `../backups/ypia-assignment-*-20261031.*`.

Deployment menambah RPC/policy untuk data tugas secara persisten; pengguna menyetujui penerapan paket melalui konfirmasi tindakan dashboard browser. Migration tidak membuat tugas, mengumpulkan jawaban, memberi nilai, mengubah akun, atau memperbarui progres nyata. Emergency disable mencabut akses fitur baru tanpa menghapus jawaban, berkas atau nilai yang sudah tersimpan. Setelah deployment, cocokkan hash, ACL/RLS, jumlah tabel baru dan fingerprint materi/progres/policy lama; jangan reset atau mengulang migration historis.

Belum tercakup: rubrik multi-kriteria, penilaian massal, pembukaan ulang nilai final, tenggat khusus per peserta, autosave/offline, notifikasi push/email dan pembersihan staging otomatis. Ini bukan prasyarat untuk siklus pengumpulan–revisi yang diimplementasikan.

## Hasil penerapan Supabase

Migration 022 berhasil, riwayat menjadi 77 versi. Hash body 16/16 fungsi cocok; enam helper privat, sembilan RPC/wrapper authenticated dan penyelesaian berkas service_role sesuai rancangan. RLS aktif pada tiga tabel, DML/TRUNCATE browser ditolak, tabel baru kosong. Jumlah serta fingerprint materi/progres/policy/ACL lama identik dengan preflight.

Fungsi assignment-documents sudah terpasang; sumber yang dibaca kembali dari dashboard identik dengan bundle SHA256. Gateway Verify JWT tetap aktif dan fungsi juga memverifikasi pengguna. Uji endpoint tanpa sesi menghasilkan 401 “Silakan masuk kembali.” Pemeriksaan READ ONLY + ROLE authenticated memanggil workspace admin dan peserta pada data nyata: 18 pilihan modul admin, 0 tugas/antrean, tanpa menulis data.

Receipt: `../backups/ypia-assignment-deployment-receipt-20261031.json`. Bukti UI: `../assignment-final-contoh.png` (data contoh), `../ypia-assignment-verification.png`, `../ypia-assignment-edge-test.png`. Frontend tersedia di localhost. Publikasi Git dikerjakan pada tindak lanjut 2026-11-01; status merge dilacak melalui riwayat PR repository.

## Uji integrasi nyata — 2026-11-01

Menggunakan akun peserta dan pengajar uji yang sudah ada di Supabase serta dua PNG sintetis berukuran 252 byte. Tidak mereset sandi, membuat akun, atau mengubah peran. Tugas berlabel UJI SISTEM dibuat melalui wizard pengajar pada program yang sudah diikuti peserta.

1. Peserta mengunggah v1 ke Contabo dan mengumpulkan kiriman pertama.
2. Pengajar membuka antrean dan mengunduh v1; SHA256 hasil unduhan identik dengan file asal.
3. Pengajar meminta revisi. Peserta menerima umpan balik, melepas pilihan lampiran salinan, mengunggah v2 dan mengumpulkan kiriman kedua.
4. Pengajar mengunduh v2; checksum identik. Peserta mengunduh v1 dari riwayat; checksum lama tetap identik.
5. Nilai uji teknis 100 difinalkan dan terlihat pada peserta; progres program teramati 1/13.
6. Tugas diarsipkan melalui kurikulum. Pilihan Diarsipkan ditambahkan ke form yang sebelumnya hanya menawarkan draf/terbit/terkunci. Setelah muat ulang, materi aktif kembali 12 dan progres 0/12; riwayat tugas uji tetap tersimpan.

Hasil positif mencakup CORS unggahan browser, signed PUT/GET, sealing file, kepemilikan, pembacaan pengajar, revisi dan riwayat. Jenis berkas yang diuji nyata adalah PNG; PDF/JPG/WebP diperiksa melalui validasi/tes lokal, bukan seluruhnya diunggah dalam uji nyata ini.

Receipt, berkas asal/unduhan dan screenshot disimpan lokal di `../backups/assignment-live/`, tidak dimasukkan ke Git. Seluruh 40 berkas regresi dan Deno check sembilan Edge Function lulus. Pemeriksaan lint/typecheck/unit/build diulang setelah penambahan opsi arsip.
