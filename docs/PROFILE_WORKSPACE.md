# Profil Saya — `/system/profil`

Halaman mengelola identitas akun yang sedang masuk. Komponen yang sama digunakan pada `/admin/profil`; halaman peserta dan pengajar tetap memakai workspace masing-masing. Semua label berbahasa Indonesia, tanpa dependency baru.

## Review fitur dan subfitur

| Bagian | Temuan lama | Hasil revamp |
| --- | --- | --- |
| Identitas | Hero besar dengan teks dekoratif; nama/email/status tersebar | Identitas ringkas dengan inisial, email masuk, status profil dan jumlah penugasan |
| Nama | Disimpan langsung; nama pada menu tidak dibaca ulang | Patch kolom berubah saja, tinjau sebelum/sesudah, simpan atomik lalu refresh sesi |
| Telepon | State selalu kosong karena pengisian dari server dikomentari; simpan nama dapat menghapus telepon | Memuat nilai tersimpan; patch nama tidak mengirim telepon; pengosongan disengaja tampil “Dikosongkan” pada tinjauan |
| Email | Hanya membaca email profil | Email masuk berasal dari akun Auth dan hanya-baca; perbedaan dengan email profil ditampilkan tanpa sinkronisasi diam-diam |
| Status | Selalu hijau dan default “AKTIF” walaupun data belum tersedia | Status profil nyata, konfirmasi email dan pembatasan login dipisahkan; form tidak tersedia saat gagal muat awal |
| Peran | Hanya primaryRole tanpa scope | Seluruh penugasan dengan nama/cakupan, duplikasi/cakupan lama terlihat; akses dapat dikelola melalui menu Pengguna bagi superadmin aktif |
| Simpan | Berhasil meski tidak memeriksa baris yang diperbarui; alert browser; tanpa versi/audit | RPC own-only, whitelist nama/telepon, pemeriksaan revision, lock row, audit field-only dalam transaksi dan hasil tersimpan yang tervalidasi |
| Draf | Reload/data provider berpotensi mengganti input tanpa tinjauan | Draf lokal di memori; reload dengan perubahan memerlukan konfirmasi, stale save tidak menghapus draf; tombol batal/reset jelas |
| Sandi | Form permanen, minimal enam karakter, tanpa autocomplete dan tinjauan | Dialog dua langkah, minimal delapan karakter sesuai alur reset yang sudah tersedia, konfirmasi sama, tampil/sembunyi dan autocomplete `new-password` |
| Keamanan | Status profil disamakan dengan kesehatan akun | Email terkonfirmasi, profil dibuat, terakhir masuk, pembatasan login dan metode masuk yang tercatat; tidak mengarang status MFA, perangkat atau waktu ganti sandi |
| Riwayat | Tidak ada | Lima perubahan profil terbaru, nama kolom dan waktu WIB; audit lengkap bagi superadmin |
| Navigasi | Header profil jatuh ke judul aplikasi generik | Header Profil Saya; tautan Beranda, Pengguna, Audit profil/aktivitas sendiri, dan Helpdesk sesuai portal |

## Hubungan antarmodul

- **Sesi/menu:** nama akun dibaca dari `profiles.full_name`; refresh setelah simpan dan muat ulang menyelaraskan nama serta peran pada shell. Kegagalan refresh sesi tidak dilaporkan sebagai kegagalan penyimpanan profil yang sudah berhasil.
- **Akses & Pengguna:** membuka akun sendiri melalui `?user=<id>`, bukan membuat atau mengubah penugasan otomatis dari Profil. Cakupan yang ditampilkan adalah penugasan tersimpan, bukan simulasi seluruh izin efektif.
- **Audit:** `profile.updated` dikategorikan sebagai perubahan dan diberi label Profil diperbarui; payload hanya daftar kolom (`full_name`, `phone`), tanpa nilai kontak/nama/sandi. Riwayat profil memfilter target sendiri; aktivitas saya memfilter actor sendiri. Policy Audit tetap menentukan siapa yang dapat membaca audit lengkap.
- **Helpdesk:** membuka modul bantuan sesuai `/system` atau `/admin`; tidak mengirim tiket/pesan otomatis.
- **Peserta/sertifikat:** identitas akun tidak menulis ulang `participants.display_name`, enrollment atau snapshot dokumen. Identitas akademik tetap dikelola melalui Peserta dan alur dokumen yang tersedia.
- **Sandi:** tetap melalui Supabase Auth untuk akun yang masuk; status/kebijakan Auth server menentukan hasil. Error weak/same password, sesi berakhir, rate limit dan kebutuhan verifikasi ulang memiliki pesan ringkas. Jika server meminta verifikasi ulang, pengguna diarahkan lewat pesan untuk keluar dan masuk kembali; tidak melemahkan pengaturan keamanan proyek.

## Server dan batas keamanan

Migration `202610310020_profile_workspace.sql` menambahkan dua RPC SECURITY DEFINER dengan search_path tetap:

1. `my_profile_workspace()`: tanpa parameter target; hanya profil `auth.uid()`, metadata login minimal, peran/cakupan sendiri dan lima audit perubahan profil sendiri. Tidak mengembalikan hash sandi, token, OAuth identity mentah atau metadata kredensial.
2. `my_profile_update(text,jsonb)`: target selalu `auth.uid()`; hanya nama/telepon, menolak ID/email/status/role/field lain. Memerlukan profil aktif, akun Auth tersedia dan tidak diblokir. Validasi panjang/type/kontrol/format telepon, optimistic concurrency serta row lock. Kegagalan audit membatalkan profil; no-op tidak mengubah waktu atau menambah audit.

Policy/grant tabel lama dipertahankan untuk kompatibilitas; validasi RPC ini melindungi jalur Profil baru, bukan mengganti seluruh akses tulis historis menjadi RPC-only. Data Auth, akun lain, peran, avatar dan data akademik tidak ditulis oleh fungsi profil. Audit public tidak dipakai untuk mengklaim perubahan sandi; operasi sandi berlangsung pada Auth.

Nama/telepon draf dan sandi hanya berada di memori komponen, tidak disimpan ke localStorage/URL. Sandi tidak dicetak pada langkah tinjauan, log atau audit. Dialog sandi dilepas saat ditutup; nilai dikosongkan ketika berhasil. Refresh/tab close diberi peringatan browser bila ada draf; navigasi global SPA yang berada di luar halaman tidak ditambahkan guard baru.

## Deployment

Pengguna menyetujui **Terapkan migration Profil**. Diterapkan pada YPIA / BelajarLMS1 / main (`foauntgtmhnhqlspgtoc`). Riwayat remote **75 versi sampai 202610310020**, hash sumber dan **2/2 body fungsi cocok**. Anonim tidak dapat mengeksekusi; authenticated harus mengikuti pemeriksaan own-only di server.

Preflight dan verifikasi setelah penerapan identik: **552 profil, 552 akun Auth, 546 penugasan, 523 peserta, 1.064 enrollment, 10 audit**. Fingerprint profil, email/kredensial/konfirmasi/pembatasan Auth, penugasan serta policy/ACL/RLS profil cocok. Tidak menjalankan save atau ganti sandi akun YPIA nyata untuk pengujian.

Paket SQL, preflight, manifest, verifikasi dan emergency disable: `../backups/ypia-profile-*-20261031.*`, tidak dipublikasikan. Receipt akhir `ypia-profile-verification-20261031.json`; screenshot `../ypia-profile-migration-success.png` dan `../ypia-profile-verification.png`.

## Validasi

- **Tujuh skenario PostgreSQL terisolasi:** own-only/metadata privat, preservasi telepon/trim/no-op/audit field-only, stale/whitelist/type/format, profil tidak aktif/banned/missing actor, rollback audit, privilege authenticated/anon/helper privat, pelestarian baris/grant/policy saat deployment.
- **Tiga helper:** pemuatan telepon/patch, validasi kontak dan sandi/error tanpa menggemakan secret. Regresi helper Pengguna, Audit serta navigasi ikut lulus.
- **Browser dengan PostgreSQL fixture:** nama-only save mengirim hanya `full_name`; menu dan riwayat langsung berubah; draf stale ditolak dan tetap terlihat; konfirmasi memuat versi server; reload menyelaraskan nama menu; dialog sandi kosong menonaktifkan Tinjau. Tidak mengisi atau mengirim kredensial melalui browser otomatis.
- **390px:** root lebar/scroll 375/375 dan dialog 356/356, tanpa overflow. Bukti contoh `../profile-workspace-example.png`, `../profile-review-example.png`, `../profile-mobile-example.png`.
- Build/typecheck berhasil; lint 0 error dengan empat warning lama. Penggantian sandi nyata dan pengiriman email pemulihan tidak diuji dalam task ini.

Sesi superadmin YPIA nyata berhasil memuat peran/cakupan, status profil, metadata login serta tautan Pengguna/Audit/Helpdesk tanpa memanggil save. Nama profil masih kosong sehingga identitas menampilkan “Nama belum diisi”, sementara email tetap menjadi email masuk; tidak mengarang nama atau mengubahnya otomatis. Tombol tinjau nonaktif sebelum perubahan. Error awal pada fixture tidak merender form kosong yang bisa disimpan. Screenshot akhir `../system-profile-revamp.png`.
