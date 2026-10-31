# Pengumuman — review dan alur kerja

31 Oktober 2026. Halaman pengelolaan: `/system/pengumuman` dan `/admin/pengumuman`.

## Temuan dan implementasi

| Bagian | Temuan | Hasil revamp |
| --- | --- | --- |
| Daftar | Hero dan tiga tab memisahkan tugas; belum ada pagination atau filter yang bertahan | Header singkat, ringkasan status berwarna yang dapat difilter, pencarian, filter cakupan/status/peran/sumber/tanggal, pagination; parameter URL mempertahankan konteks saat membuka detail |
| Pembuatan | Form baru langsung memilih publikasi | Wizard Pesan → Penerima → Tinjau; pilihan awal draf, pratinjau, batas panjang dan perkiraan jumlah akun penerima |
| Penerima | Filter program hanya di browser; policy lama tidak memeriksa peran/program | RPC dan RLS memeriksa profil aktif, peran, enrollment, hubungan wali dan penugasan pengajar/musyrif; kelas harus berada dalam program |
| Waktu | Produksi memiliki `visible_from` dan `visible_until` yang tidak ada di migration awal repo | Migration mengganti nama kolom ke `publish_at` dan `expires_at`, mempertahankan nilai, isi, status dan `updated_at`; input wizard menggunakan WIB |
| Perubahan | Belum ada edit; hapus permanen | Edit pesan/jadwal manual, salin ke draf, tarik ke draf, arsip dan pulihkan sebagai draf; publikasi/penarikan/arsip memakai konfirmasi; tanpa hapus permanen |
| Ketahanan form | Error sementara mudah hilang | Error tetap terlihat, isian tetap ada saat gagal, request key mencegah simpan ganda; draf sementara per akun dan versi tersimpan pada sessionStorage maksimal 24 jam |
| Pembaca | Beranda peserta memakai INSERT realtime tanpa validasi status; perubahan/penarikan tidak ikut | Kotak masuk terpusat untuk setiap peran; semua event hanya memicu muat ulang dari server; polling halaman terlihat 60 detik dan refresh saat kembali/fokus |
| Riwayat baca | Tidak tersedia | Tombol eksplisit “Tandai sudah dibaca”; terikat akun dan revisi, revisi baru kembali belum dibaca; jumlah baca bukan bukti pengiriman email/WA |
| Materi baru | Pengumuman otomatis tidak menyimpan sumber dan bisa berulang saat materi diterbitkan ulang | Satu sumber unik per materi baru, tautan materi/kurikulum, mengikuti rilis dan penarikan materi; materi hilang/tidak terbit tidak tampil; arsip tetap dipertahankan |
| Akses operasional | Mutasi langsung dan cakupan admin terlalu luas | RPC atomik dengan role/scope, validasi server, optimistic concurrency, audit; browser tidak boleh insert/update/delete/truncate langsung |
| Ponsel | Form dan pengumuman sulit ditinjau dalam satu alur | Kartu ringkas, dua kolom ringkasan status, filter membungkus, wizard dan pembaca responsif |

## Hubungan fitur

| Dari | Ke | Perilaku |
| --- | --- | --- |
| Program → Pengumuman | Daftar pengumuman | Membawa filter program; wizard mewarisi konteks tersebut |
| Pengumuman → Program/Kelas | Workspace program | Admin dapat meninjau peserta, penempatan kelas dan kurikulum yang relevan |
| Penerima | Peserta, enrollment, wali, kelas, halaqah, program/unit | Sasaran dihitung server; admin biasa wajib memilih program sesuai cakupan, siaran lintas program khusus superadmin |
| Tombol tindakan | Program, pembayaran, bantuan, materi | Tautan internal mengikuti portal peran; tombol yang tujuannya belum didukung peran tersebut tidak ditampilkan |
| Beranda peserta/pengajar/musyrif | Kotak masuk | Tiga informasi terbaru/disematkan dan tautan lihat semua; tidak otomatis menandai dibaca |
| Menu pengumuman | Pengelolaan / Untuk Saya | Pengelolaan hanya admin/superadmin; peran lain memiliki pembaca tanpa akses tulis |
| Penerbitan materi/kuis/ujian baru | Pengumuman peserta | Trigger menyimpan sumber, mematuhi waktu rilis dan mencegah duplikasi |
| Simpan/publikasi/arsip/sinkronisasi materi | Audit | Perubahan dan audit satu transaksi; kegagalan audit membatalkan perubahan |

## Cakupan dan batas

- Pembaca: `/system/informasi`, `/admin/informasi`, `/teacher/pengumuman`, `/learner/pengumuman`. Role dan scope tetap diperiksa server, termasuk untuk URL yang diketik langsung.
- Wali menerima pesan menurut peserta yang terhubung. Fitur ini tidak membangun ulang halaman belajar/pembayaran wali yang belum mendukung identitas anak; tombol program/materi/pembayaran untuk wali tidak ditampilkan. Bantuan tetap tersedia.
- Pengumuman lama tidak ditebak sebagai pengumuman materi berdasarkan judul. Migration tidak membuat pesan, menerbitkan, mengarsipkan, atau menandai pesan nyata telah dibaca.
- Jadwal memakai pemeriksaan waktu server; tab terbuka memperbarui melalui realtime, polling 60 detik atau fokus. Bukan cron/push notification, email, WhatsApp, SMS, atau notifikasi perangkat.
- Estimasi adalah jumlah akun aktif saat diperiksa, bukan daftar identitas atau jaminan pengiriman. Penerima mengikuti hubungan dan status yang berlaku saat membaca.
- Kelas yang masih menjadi sasaran pesan tidak boleh dihapus sehingga sasaran tidak berubah menjadi seluruh program secara tidak sengaja. Gunakan arsip kelas/pesan sesuai kebutuhan.
- Draf sementara berada dalam sesi browser, bukan sinkronisasi lintas perangkat. Pesan hanya menjadi draf server setelah tombol Simpan draf berhasil.
- Tidak menambah dependensi aplikasi, upload media, AI atau layanan pengiriman pesan.

## Backend dan penerapan

Migration `supabase/migrations/202610310012_announcement_workspace.sql` menambahkan pembaca, sasaran kelas, jadwal, pin, sumber materi, revisi, tanda baca, idempotensi, validasi, audit dan policy RLS.

Preflight produksi YPIA / BelajarLMS1 / branch main (`foauntgtmhnhqlspgtoc`) menemukan 24 pengumuman published, seluruh masa tayangnya sudah berakhir. Migration mempertahankan batas waktu tersebut, sehingga pesan lama tidak ditayangkan ulang.

Paket transaksi, metadata/fungsi lama, hash 11 fungsi, query verifikasi dan emergency disable disiapkan di `../backups/ypia-announcements-*-20261031.*`. Apply memeriksa fingerprint awal, jumlah pesan dan jumlah policy sebelum perubahan, serta memakai lock timeout 5 detik / statement timeout 60 detik. Emergency disable mempertahankan data dan RLS, mencabut RPC publik dan menghentikan trigger pengumuman baru; bukan pemulihan policy lama yang terlalu luas. Cadangan definisi lama tersedia untuk pemulihan terkontrol.

Status: **diterapkan pada 31 Oktober 2026 setelah pengguna menyetujui “Terapkan migration Pengumuman”**. SQL Editor mengembalikan Success. No rows returned. Verifikasi 11/11 hash fungsi cocok, SECURITY DEFINER/search_path benar, anon ditolak, dua helper internal tidak dapat dipanggil authenticated, RLS aktif pada tiga tabel dan direct writes ditolak. Fingerprint lama cocok: 24 pesan tetap published dengan masa tayang berakhir, 0 read receipt dan 0 operation. Receipt `../backups/ypia-announcements-deployment-20261031.json`. Riwayat CLI telah direkonsiliasi bersama 69 migration pada 31 Oktober 2026 tanpa menjalankan ulang seed; lihat [status deployment](DEPLOYMENT_STATE.md).

## Validasi

- 10 tes PostgreSQL terisolasi: role/program/kelas/wali/penugasan; draf/jadwal/masa berlaku/arsip; direct RLS dan ACL; stale edit; simpan ulang idempotent; audit rollback; revisi tanda baca; sumber materi/rilis/penarikan; pelestarian kolom waktu produksi dan `updated_at`; policy lama yang terlalu luas dihapus.
- 6 tes helper: batas waktu, WIB dan tanggal tidak valid, payload/validasi, revisi dibaca, pagination, tautan per peran dan urutan pin.
- Browser fixture memakai endpoint localhost terpisah dan data contoh: wizard tiga langkah, perkiraan penerima, gagal simpan lalu retry, draf lokal pulih setelah ditutup, konfirmasi publikasi, pembaca dan tanda baca eksplisit. Tidak memublikasikan pesan nyata atau menandai akun nyata sudah membaca.
- Desktop dan lebar 390 px diperiksa, tanpa luapan horizontal. Entry/server/tab fixture dibersihkan dan viewport dipulihkan. Bukti visual di `../system-announcements-overview.png`, `../system-announcements-wizard.png`, `../system-announcements-mobile.png`, `../learner-announcements-reader-mobile.png`.
- Pemeriksaan akhir: build (termasuk TypeScript) lulus; lint 0 error dengan 7 warning lama di modul lain; `git diff --check` bersih. Dua skenario jadwal/sumber materi dijalankan ulang setelah penyempurnaan validasi publikasi dan lulus.

- Pemeriksaan sesi nyata setelah deployment: `/system/pengumuman` memuat 24 pesan berakhir dan pilihan program tanpa error layanan; `/system/informasi` memuat 0 pesan aktif. Tautan Untuk saya → Kelola pengumuman berhasil. Tidak membuat/mengubah pesan atau receipt nyata. Bukti `../system-announcements-live.png` dan `../system-announcements-inbox-live.png`.
