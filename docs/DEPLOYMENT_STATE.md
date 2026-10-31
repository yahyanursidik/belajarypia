# Status deployment YPIA — 31 Oktober 2026

Target: YPIA / BelajarLMS1, branch `main`, project `foauntgtmhnhqlspgtoc`.

## Database

Seluruh **76 migration berversi** pada repo telah tercakup hingga `202610310021`. Baseline 69 versi memeriksa 110 definisi fungsi terbaru menurut signature, 73 tabel, serta 88 kolom tambahan. Migration dashboard menambahkan satu fungsi baca, Review Konten empat fungsi, dan Pengguna empat fungsi (119 definisi terbaru). Koreksi 018 mengganti dua fungsi Pengguna. Audit 019 menambahkan empat fungsi, lalu Profil 020 menambahkan dua fungsi. Portal Peserta 021 menambahkan empat fungsi (total 129 definisi terbaru), tanpa tabel atau kolom baru.

| Versi | Status |
| --- | --- |
| Migration awal sampai `202608200004` | Schema sudah tersedia; diadopsi sebagai baseline, tanpa menjalankan ulang seed/perubahan akun |
| `202610310001`–`202610310013` | Sudah diterapkan sebelumnya; diverifikasi ulang |
| `202610310014` Helpdesk | Diterapkan dan diverifikasi pada 31 Oktober 2026 |
| `202610310015` Dashboard sistem | Diterapkan dan diverifikasi pada 31 Oktober 2026; hash sumber/body cocok |
| `202610310016` Review Konten | Diterapkan dan diverifikasi pada 31 Oktober 2026; 4/4 hash fungsi cocok |
| `202610310017` Akses & Pengguna | Diterapkan sesuai persetujuan eksplisit; empat fungsi dan pembatasan TRUNCATE browser |
| `202610310018` Cakupan pribadi Pengguna | Diterapkan sesuai persetujuan eksplisit; empat hash terbaru cocok, tanpa perubahan akun/penugasan/ACL |
| `202610310019` Audit Sistem | Diterapkan sesuai persetujuan eksplisit; 4/4 hash cocok, helper privat dan RPC baca superadmin aktif |
| `202610310020` Profil Saya | Diterapkan sesuai persetujuan eksplisit; 2/2 hash cocok, RPC own-only dan audit perubahan nama/telepon |
| `202610310021` Portal Peserta | Diterapkan sesuai persetujuan eksplisit; 4/4 hash cocok, snapshot belajar milik sendiri dan profil atomik |

Helpdesk: 14/14 hash fungsi cocok, RLS aktif pada keempat tabel, direct mutations browser ditolak, operation privat. Jumlah tiket/pesan/event/operation tetap 0. Tidak mengirim pesan atau membuat tiket nyata.

Verifikasi lintas modul mencakup Pendaftaran, Penilaian, Sertifikat, Keuangan, Pengumuman dan Pengaturan. Seluruh hash pada paket verifikasi cocok. Fingerprint Pengaturan dan data lama Helpdesk tetap sama. Data operasional tetap: 1.064 enrollment, 0 progres materi, 3 transaksi, 2 sertifikat dan 9 audit.

Fungsi lama sebagian memakai CRLF. Pencocokan baseline hanya menormalkan CRLF menjadi LF, tidak mengabaikan isi SQL. Hotfix produksi pada `admin_reset_user_password` yang mempertahankan konfirmasi email ketika reset diminta secara eksplisit tetap dipertahankan; fungsi tidak dipanggil dan tidak mengubah sandi saat rekonsiliasi. Overload lama sembilan argumen tidak dianggap sebagai pengganti fungsi peserta sepuluh argumen yang dipakai aplikasi.

Dashboard: superadmin aktif saja; anonim ditolak. Riwayat 70 versi, source/body hash cocok, search_path tetap. Snapshot preflight dan sesudah deployment sama: 1.064 enrollment, 0 progres, 3 transaksi, 2 sertifikat, 10 audit, 0 tiket. Kenaikan audit dari snapshot Helpdesk sudah ada sebelum deployment dashboard. Lihat `DASHBOARD_WORKSPACE.md`.

## Riwayat migration

Riwayat CLI sebelumnya belum tersedia karena perubahan diterapkan melalui SQL Editor. Skrip `supabase/maintenance/20261031_reconcile_migration_history.sql` telah dijalankan untuk mencatat 69 versi setelah guard schema/fungsi lolos. Metadata menyimpan nama dan SHA256 sumber pada komentar baseline; SQL historis tidak dieksekusi ulang. Migration baru `202610310015` diterapkan dalam transaksi dan dicatat terpisah; skrip baseline tidak dijalankan ulang.

Struktur riwayat mengikuti [implementasi resmi Supabase CLI](https://github.com/supabase/cli/blob/pkg/v1.2.3/pkg/migration/history.go). Schema/tabel riwayat bersifat administratif: RLS aktif dan anon/authenticated/service_role tidak memperoleh akses. Akun database pemilik digunakan untuk operasi migration berikutnya.

- Untuk deployment berikutnya, bandingkan migration lokal dan remote terlebih dahulu, lalu hanya terapkan versi baru.
- Jangan melakukan reset database produksi atau menghapus baseline agar seed lama dijalankan ulang.
- `supabase/migrations/emergency_fix.sql` adalah skrip troubleshooting manual tanpa nomor versi, bukan migration otomatis. Tidak dijalankan dalam deployment ini. Field nullable milik Auth tidak diubah secara massal.
- Skrip rekonsiliasi khusus baseline ini bukan migration aplikasi baru dan tidak perlu dijalankan di database baru yang riwayat CLI-nya sudah benar.

## Verifikasi aplikasi dan bukti

Pengujian snapshot kode yang telah di-merge melalui PR #2: 23 berkas tes lulus, lint 0 error dengan 5 warning lama, typecheck/build berhasil. Deployment ini tidak mengubah kode frontend atau dependency aplikasi.

Hasil SQL, metadata preflight, receipt, hash dan emergency disable disimpan di folder `../backups` pada workspace lokal, tidak dipublikasikan ke Git. Bukti utama: `../ypia-helpdesk-migration-success.png`, `../ypia-helpdesk-verification.png`, `../ypia-migrations-reconciled.png`.

Unggah/unduh Contabo positif dan alur tulis dengan pesan/pembayaran peserta nyata tidak dijalankan dalam tugas migration ini; pengujian tersebut sebelumnya memakai fixture terisolasi.

Revamp dashboard (migration 015): 25/25 berkas tes regresi lulus, typecheck/build berhasil, lint 0 error (5 warning lama). Browser fixture dan sesi superadmin YPIA memverifikasi filter, antrean, wizard, tanggal WIB, keadaan gagal/kosong dan responsif. Bukti tambahan: `../ypia-dashboard-revamp.png`, `../ypia-dashboard-migration-success.png`, `../ypia-dashboard-verification.png`.

Review Konten: riwayat menjadi 71 versi. Akses hanya superadmin aktif; helper snapshot privat dan anonim tidak dapat mengeksekusi fungsi. Source/body hash cocok. Fingerprint 80 materi serta 24 pengumuman sebelum/sesudah identik; 3 soal, 1.064 enrollment, 0 progres, 3 transaksi dan 10 audit tetap sama. Tidak menerbitkan, mengunci, mengarsipkan atau mengubah materi nyata. Bukti dan definisi pemeriksaan: `CONTENT_REVIEW_WORKSPACE.md`; receipt pada `../backups/ypia-content-review-*-20261031.*`, screenshot `../ypia-content-review-verification.png`.

## Akses & Pengguna

Migration 017 dan koreksi 018 diterapkan setelah masing-masing persetujuan pengguna. Riwayat menjadi 73 versi sampai 018; hash sumber/body dan privilege fungsi sesuai paket. Snapshot tetap 552 profil/akun Auth, 546 penugasan, 523 peserta, 1.064 enrollment dan 10 audit. Fingerprint profil/peran/policy RLS tidak berubah; hanya hak TRUNCATE anon/authenticated dicabut pada 017. DML/RLS lama dipertahankan untuk kompatibilitas signup/enrollment dan klien lama. Koreksi 018 mengenali scope pribadi `own` serta menolak duplikasi peran pribadi, tanpa mengubah penugasan.

Sesi nyata memuat direktori 552 akun dan filter Tanpa peran tepat 26 hasil; scope peserta ditampilkan Data sendiri. Sebelas skenario SQL, empat helper, regresi navigasi/direktori peserta dan build/typecheck lulus; lint 0 error/4 warning lama. Source/apply/verify/hash/emergency disable berada di `../backups/ypia-users-*-20261031.*`. Receipt akhir `../backups/ypia-users-own-verification-20261031.json`, screenshot `../ypia-users-verification.png` dan `../system-users-revamp.png`. Status dan batas validasi: `USERS_WORKSPACE.md`.

## Audit Sistem

Migration 019 diterapkan setelah persetujuan pengguna. Riwayat 74 versi, hash sumber dan keempat body fungsi cocok. Dua helper privat tidak dapat dipanggil anon/authenticated; dua RPC baca memvalidasi superadmin aktif. Fingerprint 10 audit, policy/ACL/RLS tabel, 552 profil, 546 penugasan, 523 peserta dan 1.064 enrollment sebelum/sesudah identik. Tidak mengubah akun, catatan audit atau objek operasional. Tujuh skenario SQL serta helper/regresi terkait lulus; rincian dan batas: `AUDIT_WORKSPACE.md`. Receipt `../backups/ypia-audit-verification-20261031.json`, screenshot `../ypia-audit-verification.png`.

## Profil Saya

Migration 020 diterapkan setelah persetujuan pengguna. Riwayat 75 versi; hash sumber serta kedua body fungsi cocok, anonim ditolak dan target RPC selalu akun sendiri. Fingerprint profil, kredensial/metadata login yang diperiksa, penugasan dan policy/ACL/RLS profil sebelum/sesudah identik. Jumlah tetap 552 profil/akun Auth, 546 penugasan, 523 peserta, 1.064 enrollment dan 10 audit. Tidak menyimpan profil, mengirim email atau mengganti sandi akun nyata saat pengujian. Detail implementasi/batas: `PROFILE_WORKSPACE.md`; receipt `../backups/ypia-profile-verification-20261031.json`, bukti `../ypia-profile-verification.png`.

## Portal Peserta

Migration 021 diterapkan setelah persetujuan pengguna. Riwayat 76 versi, source/body hash 4/4 cocok, anon ditolak, RPC memvalidasi pemilik dari auth.uid(). Fingerprint profil, peserta, enrollment dan seluruh policy/ACL/RLS tabel sebelum/sesudah identik; jumlah tetap 552 profil/Auth, 546 penugasan, 523 peserta, 1.064 enrollment, 0 progres, 3 percobaan, 2 sertifikat dan 10 audit. Pemeriksaan READ ONLY + ROLLBACK dengan ROLE authenticated memverifikasi kepemilikan dua enrollment dan profil peserta nyata, tanpa login browser atau mutasi data.

Delapan skenario SQL serta lima berkas tes helper/regresi terkait lulus; typecheck/build berhasil dan lint 0 error/4 warning lama. Browser data contoh memverifikasi progres, outline/prasyarat, seluruh status program, wizard profil atomik/konflik, ponsel 390 px dan sandbox bacaan. Detail temuan, hubungan fitur dan batas produk: `LEARNER_WORKSPACE.md`. Receipt `../backups/ypia-learner-verification-20261031.json`, screenshot `../ypia-learner-verification.png`. Tidak melakukan enrollment, submit ujian, penerbitan sertifikat, pembayaran atau perubahan akun peserta nyata.

Pemeriksaan sesi peserta localhost yang sudah tersedia juga berhasil: 4 program aktif, 49 materi tersedia, filter satu program 33 materi dan profil dapat dibaca. Tidak menyimpan profil atau menyelesaikan materi. Bukti `../learner-portal-localhost.png` dan `../learner-progress-localhost.png`.


## 2026-10-31 — Paket stack dan agenda (lokal)

Frontend diperbarui ke React 19.3.1/Router 7.18.5/Vite 8.3.5 dan SDK 2.118.0, Node pengembangan 24.22.1. Agenda lintas portal memakai tabel/RPC lama; tidak menambahkan migration. Import SDK pada delapan sumber Edge Function dan helper sertifikat naik dari 2.50.0 ke 2.118.0; document-signed-url menormalkan key HMAC ke ArrayBuffer. Perubahan Edge Function ini belum diterapkan remote. Jangan menyamakan hasil build/check lokal dengan deployment Supabase/Vercel. Rincian: STACK_AUDIT_20261031.md.


## 2026-10-31 — Pengumpulan dan revisi tugas

Migration 022 dan Edge Function assignment-documents sudah diterapkan setelah persetujuan pengguna. UI empat portal, wizard tugas, draf/revisi, berkas privat dan penilaian atomik ke progres sudah diimplementasikan. Preflight READ ONLY di YPIA memverifikasi 76 versi sampai 021, tidak ada objek tugas baru atau policy tulis progres. Baseline 552 profil, 523 peserta, 1.064 enrollment, 80 materi, 0 progres, 10 audit. Paket apply/hash/verify/emergency disable dan bundle siap di ../backups. Detail: ASSIGNMENT_WORKSPACE.md. Pengujian UI memakai database SQL terisolasi; tidak mengumpulkan atau menilai peserta nyata.

Verifikasi akhir Tugas: 77 versi migration, body hash 16/16 cocok, RLS/grant sesuai paket, tiga tabel baru kosong, baseline bisnis dan fingerprint policy/ACL lama identik. Sumber Edge Function terpasang sama dengan bundle; endpoint tanpa sesi ditolak 401. Gateway JWT tetap aktif. Workspace admin/peserta berhasil dipanggil dengan ROLE authenticated dalam transaksi READ ONLY + ROLLBACK, tanpa data pribadi pada keluaran. Receipt ../backups/ypia-assignment-deployment-receipt-20261031.json. 24 berkas unit dan delapan skenario SQL lulus; build/typecheck dan Deno check berhasil; lint 0 error/4 warning lama. Pengujian positif Contabo produksi belum dilakukan.


## 2026-11-01 — Uji Contabo dengan akun nyata

Uji pengumpulan dan revisi melalui UI peserta/pengajar berhasil pada Supabase/Contabo nyata. PNG v1/v2 berhasil diunggah; unduhan pengajar v1/v2 serta unduhan riwayat v1 oleh peserta identik dengan checksum asal. Nilai final uji memperbarui progres 1/13. Tugas uji kemudian diarsipkan, materi aktif/progres kembali 0/12. Tidak menghapus riwayat, mereset sandi atau mengubah akun/peran. Bukti lokal: ../backups/assignment-live/live-receipt.json dan participant-final.png. Pilihan Diarsipkan dilengkapi pada form kurikulum. Seluruh 40 berkas regresi dan pemeriksaan sembilan Edge Function lulus.
