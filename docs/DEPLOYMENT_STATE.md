# Status deployment YPIA — 31 Oktober 2026

Target: YPIA / BelajarLMS1, branch `main`, project `foauntgtmhnhqlspgtoc`.

## Database

Seluruh **69 migration berversi** pada repo telah tercakup dalam baseline database hingga `202610310014`. Audit memeriksa 110 definisi fungsi terbaru menurut signature, 73 tabel, serta 88 kolom tambahan. Tidak ditemukan fungsi, tabel, atau kolom wajib yang tertinggal setelah deployment Helpdesk.

| Versi | Status |
| --- | --- |
| Migration awal sampai `202608200004` | Schema sudah tersedia; diadopsi sebagai baseline, tanpa menjalankan ulang seed/perubahan akun |
| `202610310001`–`202610310013` | Sudah diterapkan sebelumnya; diverifikasi ulang |
| `202610310014` Helpdesk | Diterapkan dan diverifikasi pada 31 Oktober 2026 |

Helpdesk: 14/14 hash fungsi cocok, RLS aktif pada keempat tabel, direct mutations browser ditolak, operation privat. Jumlah tiket/pesan/event/operation tetap 0. Tidak mengirim pesan atau membuat tiket nyata.

Verifikasi lintas modul mencakup Pendaftaran, Penilaian, Sertifikat, Keuangan, Pengumuman dan Pengaturan. Seluruh hash pada paket verifikasi cocok. Fingerprint Pengaturan dan data lama Helpdesk tetap sama. Data operasional tetap: 1.064 enrollment, 0 progres materi, 3 transaksi, 2 sertifikat dan 9 audit.

Fungsi lama sebagian memakai CRLF. Pencocokan baseline hanya menormalkan CRLF menjadi LF, tidak mengabaikan isi SQL. Hotfix produksi pada `admin_reset_user_password` yang mempertahankan konfirmasi email ketika reset diminta secara eksplisit tetap dipertahankan; fungsi tidak dipanggil dan tidak mengubah sandi saat rekonsiliasi. Overload lama sembilan argumen tidak dianggap sebagai pengganti fungsi peserta sepuluh argumen yang dipakai aplikasi.

## Riwayat migration

Riwayat CLI sebelumnya belum tersedia karena perubahan diterapkan melalui SQL Editor. Skrip `supabase/maintenance/20261031_reconcile_migration_history.sql` telah dijalankan untuk mencatat 69 versi setelah guard schema/fungsi lolos. Metadata menyimpan nama dan SHA256 sumber pada komentar baseline; SQL historis tidak dieksekusi ulang.

Struktur riwayat mengikuti [implementasi resmi Supabase CLI](https://github.com/supabase/cli/blob/pkg/v1.2.3/pkg/migration/history.go). Schema/tabel riwayat bersifat administratif: RLS aktif dan anon/authenticated/service_role tidak memperoleh akses. Akun database pemilik digunakan untuk operasi migration berikutnya.

- Untuk deployment berikutnya, bandingkan migration lokal dan remote terlebih dahulu, lalu hanya terapkan versi baru.
- Jangan melakukan reset database produksi atau menghapus baseline agar seed lama dijalankan ulang.
- `supabase/migrations/emergency_fix.sql` adalah skrip troubleshooting manual tanpa nomor versi, bukan migration otomatis. Tidak dijalankan dalam deployment ini. Field nullable milik Auth tidak diubah secara massal.
- Skrip rekonsiliasi khusus baseline ini bukan migration aplikasi baru dan tidak perlu dijalankan di database baru yang riwayat CLI-nya sudah benar.

## Verifikasi aplikasi dan bukti

Pengujian snapshot kode yang telah di-merge melalui PR #2: 23 berkas tes lulus, lint 0 error dengan 5 warning lama, typecheck/build berhasil. Deployment ini tidak mengubah kode frontend atau dependency aplikasi.

Hasil SQL, metadata preflight, receipt, hash dan emergency disable disimpan di folder `../backups` pada workspace lokal, tidak dipublikasikan ke Git. Bukti utama: `../ypia-helpdesk-migration-success.png`, `../ypia-helpdesk-verification.png`, `../ypia-migrations-reconciled.png`.

Unggah/unduh Contabo positif dan alur tulis dengan pesan/pembayaran peserta nyata tidak dijalankan dalam tugas migration ini; pengujian tersebut sebelumnya memakai fixture terisolasi.
