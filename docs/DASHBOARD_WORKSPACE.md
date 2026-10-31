# Dashboard sistem

Halaman `/system` memakai `system_dashboard_summary(uuid, integer)` untuk satu snapshot data superadmin aktif. Panel menekankan pekerjaan yang perlu ditangani, progres belajar, dan jalur ke modul terkait.

## Hasil review dan perbaikan

| Masalah sebelumnya | Perilaku baru |
| --- | --- |
| Query gagal berisiko tampil sebagai nol | Awal gagal tampil `—` dan retry; refresh gagal mempertahankan snapshot bertanggal |
| Tab/tautan lama tidak sesuai halaman tujuan | Tautan membawa program, status, jenis antrean, dan tanggal yang didukung tujuan |
| Status kesehatan “Normal” tanpa pemeriksaan layanan | Dihapus; kegagalan notifikasi bersumber dari log, tanpa klaim kesehatan infrastruktur |
| Banyak pintasan, antrean akademik/keuangan terlewat | Antrean pendaftaran, esai, pembayaran, sertifikat, Helpdesk, tagihan, dan kurikulum |
| Ringkasan kurang menjelaskan perjalanan belajar | Progres materi tersedia, onboarding tercatat, distribusi status pilihan program |

## Definisi data

- Peserta aktif adalah profil peserta aktif; jika program dipilih, wajib memiliki enrollment aktif di program itu. Bukan jumlah enrollment.
- Jumlah program aktif, pilihan pendaftaran, antrean, progres, dan onboarding adalah kondisi saat ini. Pilihan pendaftaran dihitung per pilihan program dengan `review_status`, bukan status global pendaftar.
- Periode 7/30/90 hari memakai tanggal kalender WIB, termasuk hari ini. Grafik menghitung pilihan/enrollment baru dan nominal transaksi terverifikasi. Pembayaran memakai `paid_at` (tanggal pembayaran) atau tanggal dibuat dalam WIB jika kosong; bukan tanggal verifikasi.
- Progres = aktivitas selesai / (enrollment belajar aktif × materi terbit yang sudah dirilis). Enrollment, peserta, dan program wajib aktif; progres wajib cocok peserta, enrollment, dan program materi. Denominator kosong ditampilkan `—`.
- Onboarding hanya membandingkan catatan yang sudah ada pada enrollment tidak dibatalkan; tidak menganggap catatan yang belum dibuat sebagai selesai.
- Tiket perlu balasan melihat pesan publik terakhir dari pelapor; catatan internal tidak dianggap balasan. Antrean dapat beririsan dan tidak dijumlah sebagai total pekerjaan unik.
- Akun, unit, audit, dan kegagalan notifikasi ditandai **Global**. Audit/notifikasi mengikuti periode, bukan program. Tidak menampilkan isi pesan, error privat, atau detail audit mentah.

## Hubungan modul

| Panel/aksi | Tujuan |
| --- | --- |
| Peserta/program | Direktori peserta aktif / detail atau daftar program |
| Pendaftaran | Antrean status pilihan program, formulir dan undangan |
| Esai | Penilaian `kind=quiz`, status pending |
| Pembayaran/tagihan | Transaksi pending/verified atau tagihan overdue |
| Sertifikat | Batch gagal di antrean penerbitan |
| Helpdesk | Antrean perlu balasan atau lewat tindak lanjut |
| Kurikulum | Program aktif tanpa modul, atau kurikulum program terpilih |
| Grafik | Daftar dengan batas tanggal WIB; Pendaftaran/Keuangan menerima filter ini |
| Aktivitas/audit akses | Audit dengan periode dan kategori auth bila relevan |

“Mulai pekerjaan” memiliki dua langkah: pilih pekerjaan lalu program. Aksi membuka wizard yang sudah ada untuk formulir, tagihan, atau pengumuman. “Buat program” memakai wizard program empat langkah lalu membuka kurikulum. Membuka launcher tidak membuat data.

## Keandalan dan aksesibilitas

RPC STABLE/baca, SECURITY DEFINER dengan search_path tetap, menolak anonim, non-superadmin, dan profil tidak aktif. Aggregate tidak bergantung batas pagination REST. UI membatalkan request filter lama, menyembunyikan snapshot filter berbeda, memperbarui setiap 60 detik saat terlihat, dan ketika tab aktif kembali. Tidak ada dependency baru.

Grafik menyediakan tabel, label pembaca layar, satu titik Tab dan navigasi panah/Home/End. Layout diuji desktop serta ponsel 390px tanpa overflow horizontal. Dialog memakai primitive focus trap yang tersedia.

## Deployment dan verifikasi

Migration `202610310015_system_dashboard.sql` diterapkan ke YPIA / BelajarLMS1 / main (`foauntgtmhnhqlspgtoc`) pada 31 Oktober 2026. Hash sumber dan body fungsi cocok; riwayat menjadi 70 versi. Tidak mengubah data bisnis, akun, CAPTCHA, atau RLS modul.

Snapshot sebelum/sesudah: 1.064 enrollment, 0 progres, 3 transaksi, 2 sertifikat, 10 audit, 0 tiket. Snapshot lama Helpdesk mencatat 9 audit; preflight dashboard sudah 10 sebelum deployment.

Pengujian SQL terisolasi mencakup otorisasi, batas WIB, status per pilihan, transaksi terverifikasi, materi tersedia, pesan internal Helpdesk, >1.200 baris, dan tidak adanya mutasi. Helper mencakup URL/filter, tanggal dan denominator kosong. Browser fixture mencakup filter, grafik/tabel/keyboard, tanggal tujuan, wizard tagihan, refresh gagal/retry, awal gagal, kosong, dan ponsel. Browser nyata memeriksa data ringkasan dan daftar transaksi pending; tidak memverifikasi pembayaran atau membuat program/pesan/tagihan nyata.

Receipt, SQL preflight/apply/verify, manifest hash, emergency disable dan log tes disimpan di `../backups`, tidak dipublikasikan. Dashboard merangkum data LMS yang tercatat, bukan monitoring uptime atau analitik lintas sistem.

Hasil akhir: 25/25 berkas tes regresi lulus (0 gagal), typecheck dan build berhasil; lint 0 error dengan 5 warning lama. Browser nyata juga mencocokkan 36 baris pendaftaran pending dan 1 transaksi pending dengan kartu antrean, serta filter audit menghasilkan 1 log dalam periode yang sama.
