# Pengaturan Global — review dan hubungan fitur

31 Oktober 2026. Halaman: `/system/pengaturan`, khusus superadmin.

## Review fitur dan subfitur

| Bagian | Temuan | Implementasi |
| --- | --- | --- |
| Ikhtisar | Persentase kelengkapan mengulang informasi; metrik menyebut 4 portal padahal ada 5 | Kartu ringkas menuju identitas, aset dan warna; jumlah aset yang benar; lima portal; checklist yang dapat dibuka; waktu simpan |
| Identitas | Nama/profil tersimpan tetapi pengaruh ke halaman lain tidak jelas | Nama wajib, batas panjang, profil singkat; terhubung ke judul browser, login dan pembaca dokumen |
| Teks tampilan | Judul sidebar berfungsi; subjudul sistem belum terlihat di beranda yang memakai layout ringkas | Empat field teks, pratinjau dan penggunaan subjudul pada beranda pusat kendali |
| Kontak bantuan | Nomor 08… belum dinormalisasi untuk WhatsApp; kontak kosong memakai nomor/email contoh | Validasi email/nomor, konversi nomor Indonesia 08… menjadi 628… pada tautan; tombol kontak dinonaktifkan jika tidak tersedia; tiket bantuan tetap dapat digunakan |
| Logo utama | Form mengklaim sidebar memakai logo, tetapi layout menampilkan ikon tetap | Logo dipakai pada sidebar desktop/mobile, dengan fallback ikon bila URL tidak tersedia/gagal |
| Logo login | Sudah dibaca login, fallback ke logo utama | Tetap dipertahankan; pratinjau publik memakai logo login/utama dan konteks login |
| Favicon | Field tersimpan tanpa penerapan pada tab browser | Link favicon dibaca dari pengaturan; saat dikosongkan kembali ke `/favicon.svg` |
| Berkas branding | Upload lama langsung ke bucket Supabase publik tanpa batas server | Upload baru lewat `settings-assets` ke Contabo: PNG/JPG/WebP, maksimal 2 MB, periksa ekstensi/MIME/signature, batas body; browser memeriksa decode dan dimensi 4.096 px; objek diberi ACL private; server mendaftarkan key immutable |
| Ganti/kosongkan/URL | Belum ada pelepasan aset yang jelas; URL tidak divalidasi | Pilih/ganti gambar, kosongkan pilihan, URL HTTPS opsional; perubahan ditinjau sebelum tersimpan; gagal unggah mempertahankan pilihan lama dengan pesan eksplisit |
| Tema | Lima konfigurasi, angka ringkasan empat; tema publik belum tersambung penuh ke aksen login | Preset Biru/Hijau/Merah hangat/Emas/Abu-abu untuk admin-operasional, peserta-wali, pengajar, musyrif, publik; aksen login dan layout publik memakai tema publik; preview per portal |
| Simpan | Mutasi langsung; tidak ada pemeriksaan versi/audit atomik; pengiriman ulang dapat mengulang operasi | RPC khusus superadmin aktif, whitelist field, validasi server, timestamp versi, idempotensi, audit dan receipt satu transaksi; hanya field yang berubah dikirim |
| Draf/error | Gagal baca dianggap belum ada konfigurasi; error menghilang; kehilangan draft saat navigasi | Bedakan error baca dan data kosong; error tetap terlihat; isian tidak hilang saat gagal; draft per akun/record/versi di sessionStorage 24 jam; konfirmasi sebelum memuat ulang/membuang isian |
| Panduan | Form panjang tanpa alur lintas bagian | Identitas → Tampilan → Tema → Tinjau; validasi tiap langkah, ringkasan lama/baru, tombol simpan eksplisit |
| Pembaruan portal | Hook berulang mengambil pengaturan sendiri | Snapshot bersama, satu request aktif, event setelah simpan, BroadcastChannel untuk pengaturan utama, refresh saat kembali/fokus; form yang sedang diedit tidak ditimpa versi server baru |
| Data awal | Insert langsung dari browser bisa dipicu saat pembacaan gagal | Hanya tersedia ketika pembacaan berhasil dan record benar-benar kosong; RPC singleton, role aktif dan idempotensi; tidak dipanggil saat migration |
| Template transkrip | Global setting dan template berbagi satu record | Tautan editor yang sudah ada; pemeriksaan versi saat menyimpan template; patch identitas/warna tidak menimpa kop, nama pejabat, jabatan atau tanda tangan |

## Hubungan menu dan batas pengaruh

| Pengaturan | Digunakan oleh / tautan |
| --- | --- |
| Nama lembaga dan profil | Login, judul browser, pratinjau identitas, pembaca transkrip; dokumen yang sudah diterbitkan tidak dibuat ulang otomatis |
| Judul/subjudul sidebar, logo utama | Shell admin, superadmin, peserta, pengajar dan musyrif; navigasi desktop dan mobile |
| Judul/subjudul pusat kendali | Beranda sistem; label modul pada header halaman tetap mengikuti modul aktif |
| Logo login dan tema publik | Login terpadu, pemulihan sandi, aksen halaman publik/pendaftaran yang memakai token tema |
| Email dan WhatsApp | Bantuan peserta; tidak mengirim pesan otomatis |
| Lima tema portal | Token aksen/sidebar/tombol per portal; warna status/kategori tetap mengikuti semantiknya |
| Program & pembelajaran | `/system/program`: kurikulum, kelas, fitur program, kelulusan |
| Form pendaftaran | `/system/pendaftaran?tab=settings`: periode, pertanyaan, grup |
| Rekening & QR | `/system/keuangan?tab=channels`: biaya kelas, donasi, wakaf |
| Sertifikat | `/system/sertifikat`: desain dan nomor; pengaturan lembaga tidak menerbitkan sertifikat |
| Template transkrip | Editor kop dan penandatangan yang sama dengan modul Peserta; perubahan global harus disimpan/dikembalikan sebelum membuka editor |
| Akun/peran dan audit | `/system/pengguna`, `/system/audit`; tidak menambah role, mengubah sandi, mengaktifkan CAPTCHA atau menyimpan secret di pengaturan publik |

## Akses dan storage

- Pengaturan identitas publik tetap dapat dibaca seperti sebelumnya. Mutasi melalui RPC hanya superadmin dengan profil aktif. Admin biasa, peserta dan anon tidak dapat menyimpan, termasuk lewat API langsung.
- Upload POST pada Edge memverifikasi JWT dengan `getUser`, lalu memeriksa role aktif. Service role hanya dipakai di server untuk registrasi metadata yang telah diverifikasi. Browser tidak boleh membaca registry atau operation receipt.
- GET gambar publik hanya mengizinkan ID yang sedang dipakai pada `logo_url`, `login_logo_url`, atau `favicon_url`. Tidak menerima object key dari pengunjung, tidak melayani dokumen keuangan, sertifikat, tanda tangan atau berkas lain. GET mengarahkan ke URL Contabo bertempo; redirect tidak di-cache.
- Endpoint perlu `verify_jwt=false` agar elemen gambar publik dapat dimuat tanpa header login. POST tetap memverifikasi JWT dan role di handler; registry/fungsi internal dibatasi service role. Perubahan akses endpoint ini masuk paket persetujuan deployment.
- Logo dan tanda tangan lama tidak dipindah atau dihapus. Bucket Supabase lama dan policy-nya tidak diubah. Editor tanda tangan transkrip lama masih memakai mekanisme unggah yang telah ada; paket ini memindahkan unggahan branding baru ke Contabo.
- Upload gagal setelah object disimpan dapat meninggalkan object private yang belum direferensikan; tidak dihapus otomatis. Penggantian/kosongkan pilihan tidak menghapus object lama. URL bertempo yang sudah terbit tetap berlaku sampai kedaluwarsa.
- Preview berkas baru memakai object URL lokal. Setelah halaman dimuat ulang dan draft dipulihkan, preview upload yang belum dipilih sebagai branding aktif dapat belum tersedia sampai disimpan. Metadata dan pilihan isian tetap dipertahankan.
- SessionStorage bukan draft server atau sinkronisasi lintas perangkat. Versi server yang berubah saat form diedit memerlukan muat ulang dengan konfirmasi; penggabungan perubahan otomatis tidak dilakukan.

## Pengujian

- 8 tes PostgreSQL terisolasi: patch menjaga field transkrip, idempotensi/kunci berbeda, stale write, validasi field/URL/email/tema, role/profil aktif, ACL dan direct writes, audit rollback, lima preset, singleton, registrasi gambar, penolakan registry untuk browser, serta migration tidak mengubah record/audit lama.
- 5 tes helper: tema legacy, payload parsial dan pelepasan field, kontak Indonesia/kontak kosong, URL aman dan validasi isian, tipe/ukuran berkas.
- 4 tes Edge dengan SDK/storage tiruan: autentikasi dan role, media/bytes/ukuran salah, upload immutable/private dan kegagalan storage/audit, GET hanya logo aktif.
- Browser fixture terisolasi: field wajib dan perpindahan langkah, preview, ringkasan perubahan, gagal simpan lalu retry, pemulihan draft setelah komponen dimuat ulang, gambar contoh berhasil dipilih lewat layanan tiruan, MP4 ditolak, konfirmasi pemulihan versi tersimpan, tautan terkait dan tampilan 390 px tanpa luapan horizontal. Tidak menyimpan pengaturan atau mengunggah gambar pada proyek nyata.
- TypeScript dan build lulus (2.149 modul); lint 0 error dengan 7 warning lama; diff check bersih. Source dan bundle Edge lulus Deno check. Pengujian unggah/unduh Contabo positif memakai kredensial produksi belum dilakukan; pengujian storage di atas menggunakan tiruan.

## Paket penerapan

Migration `202610310013_settings_workspace.sql` dan satu Edge Function `settings-assets`. Paket tidak mengubah record konfigurasi, preset aktif, kontak, logo, password, role atau policy bucket lama saat deployment.

Preflight YPIA / BelajarLMS1 / branch main (`foauntgtmhnhqlspgtoc`): 1 record pengaturan, 9 audit dan 3 objek di bucket lama. Fingerprint konfigurasi tetap sama setelah seluruh pemeriksaan lokal. Metadata/policy lama, paket transaksi (timeout lock 5s / statement 60s), hash empat fungsi, bundle mandiri, verifikasi dan emergency disable berada di `../backups/ypia-settings-*-20261031.*` dan `../backups/ypia-settings-edge-20261031/`.

Status: **diterapkan pada 31 Oktober 2026 setelah pengguna menyetujui “Terapkan paket Pengaturan”**. SQL Editor mengembalikan Success. No rows returned. Empat hash fungsi cocok, RLS aktif pada tiga tabel, browser tidak memiliki direct writes atau akses registry/receipt. Fingerprint konfigurasi tetap sama; jumlah akhir 1 pengaturan, 9 audit, 3 aset legacy, 0 aset branding baru dan 0 operation. Kode Edge tersimpan cocok persis dengan bundle; gateway JWT hanya fungsi ini nonaktif sesuai persetujuan, POST tanpa auth menghasilkan 401, GET ID tidak terdaftar menghasilkan 404, dan GET langsung dari browser tanpa auth mencapai handler yang sama. Wizard sesi nyata melalui keempat langkah tanpa perubahan; tombol simpan tetap nonaktif. Receipt `../backups/ypia-settings-deployment-20261031.json`. Emergency disable mencabut RPC dan pembacaan registry oleh Edge tanpa menghapus data atau memulihkan jalur mutasi langsung. Riwayat CLI telah direkonsiliasi bersama 69 migration pada 31 Oktober 2026 tanpa menjalankan ulang seed; lihat [status deployment](DEPLOYMENT_STATE.md).
