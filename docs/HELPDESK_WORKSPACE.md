# Helpdesk LMS

## Temuan dan hasil revamp

| Area | Temuan lama | Implementasi |
| --- | --- | --- |
| Antrean | Angka dari tiket yang sedang dimuat; kegagalan tampak kosong | Pagination, pencarian literal, filter status/kategori/prioritas/program/petugas, ringkasan seluruh cakupan di server, error dan retry |
| Percakapan | Draf dapat terbawa ke tiket lain; Enter langsung mengirim | Draf per akun/tiket/jenis pesan, tombol kirim atau Ctrl/Cmd+Enter, balasan publik terpisah dari catatan internal |
| Pembuatan | Tiket dan pesan awal ditulis terpisah | Wizard Masalah → Konteks → Tinjau, transaksi tiket + pesan + audit |
| Penanganan | Status dan balasan tidak atomik; penugasan belum dipakai | Petugas aktif sesuai cakupan, prioritas, jadwal tindak lanjut WIB, status, ringkasan penyelesaian publik, kontrol versi |
| Pemulihan | Kesalahan kirim tidak jelas | Request key dan versi asli disimpan per tab; retry kiriman yang belum terkonfirmasi tidak menggandakan pesan |
| Keterkaitan | Tiket tanpa konteks program/pembayaran | Program → tiket terfilter; program/tagihan peserta → konteks wizard; tiket → program, peserta, atau tagihan sesuai peran |
| Navigasi | Bantuan pengajar/mentor/keuangan tidak lengkap | `/teacher/bantuan` untuk tiket sendiri; keuangan mendapat `/admin/helpdesk` khusus pembayaran sesuai cakupan |
| Tampilan | Area terkunci, dekorasi dan tombol lampiran tidak berfungsi | Layout dua panel desktop, fokus percakapan pada ponsel, warna status fungsional, panduan/kontak ringkas dari pengaturan |

## Hak akses

- Profil aktif wajib untuk seluruh RPC pengguna. Pelapor hanya membaca tiket sendiri dan pesan publik.
- Superadmin melihat dan menangani seluruh tiket. Admin mengikuti program/unit atau penugasan global pada `user_roles`.
- Helpdesk mengikuti scope dan tiket yang ditugaskan kepadanya atau antrean aktif yang belum ditugaskan. Tiket yang ditugaskan ke petugas lain tidak terbuka otomatis.
- Finance menggunakan aturan antrean yang sama, hanya kategori `billing`; konteks tagihan tidak membuka dokumen keuangan atau rekening melalui Helpdesk.
- Kandidat petugas aktif divalidasi ulang di server. Pemindahan program harus sesuai scope petugas dan hubungan pelapor dengan program/enrollment/tagihan.
- Wali boleh memilih enrollment anak yang terhubung. Pemilihan tagihan tetap milik akun peserta; tidak memperluas akses keuangan wali.
- Riwayat dan catatan internal hanya untuk petugas berwenang. Nama/email pelapor tidak dibuka sebagai direktori pengguna global.
- Tulis langsung tabel, termasuk TRUNCATE, dicabut dari anon/authenticated. Semua mutasi memakai RPC bertransaksi dan audit; idempotency operations privat.

## Batas fitur

- Jadwal tindak lanjut adalah pengingat pada antrean, tanpa cron, SLA otomatis, email atau WA otomatis.
- Lampiran Helpdesk belum ditambahkan. Bukti transfer tetap melalui Keuangan; tombol lampiran dekoratif lama dihapus.
- Draf menggunakan sessionStorage tab browser, bukan sinkronisasi antar perangkat. Kegagalan cache ditampilkan.
- Tidak ada perubahan akun, sandi, CAPTCHA, status enrollment atau pembayaran dari Helpdesk.
- Tiket lama tetap disimpan tanpa menebak program atau mengubah status. Petugas global dapat melengkapi konteksnya.

## Deployment

Migration `202610310014_helpdesk_workspace.sql` disiapkan untuk YPIA / BelajarLMS1 / main (`foauntgtmhnhqlspgtoc`). **Belum diterapkan; menunggu konfirmasi perubahan akses kategori pembayaran untuk finance.** Tidak ada Edge Function baru.

Paket penerapan, preflight policy/fungsi/ACL, manifest hash, verifikasi 14 fungsi, dan emergency disable tersedia pada folder `../backups/ypia-helpdesk-*-20261031.*` di workspace lokal. Cadangan tidak dimasukkan ke Git. Preflight: 0 tiket, 0 pesan; tidak ada komunikasi nyata yang dikirim saat audit.

Jangan menjalankan seluruh migration historis dengan `supabase db push`: beberapa seed lama mereset kredensial. Database sebelumnya menerima migration 002–013 melalui SQL Editor; riwayat CLI perlu direkonsiliasi tersendiri sebelum deployment otomatis.

## Validasi

- Pengujian PostgreSQL terisolasi: nomor tiket, transaksi/audit rollback, idempotensi, membership dan tagihan, scope/assignment, privasi catatan lewat RPC/RLS, konflik versi, resolusi/reopen, filter/pagination dan penolakan anon/inaktif.
- Tes helper: validasi, tautan sesuai peran, WIB dan identitas kiriman tertunda.
- Browser data contoh: pergantian tiket tanpa kebocoran draf, retry sesudah reload menghasilkan satu pesan, pengelolaan prioritas/penugasan, wizard konteks tagihan sampai kirim, peserta tanpa catatan internal, dan ponsel tanpa overflow horizontal.
- Pemeriksaan akhir: 23 berkas tes gabungan lulus, lint 0 error/5 warning lama, typecheck dan build lulus, diff check bersih. Helpdesk memiliki 9 skenario PostgreSQL + 4 helper. Hasil dicatat di PROMPT_LOG.
