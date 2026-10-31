# Akses & Pengguna — `/system/pengguna`

Halaman mengelola penugasan peran untuk akun yang sudah tersedia. Akun peserta dan relasi wali dikelola melalui modul Peserta. Sandi dipulihkan oleh pemilik akun melalui alur “Lupa kata sandi” yang tersedia; halaman ini tidak membaca atau mengganti sandi.

## Review fitur dan perbaikan

| Fitur lama | Temuan | Revamp |
| --- | --- | --- |
| Direktori | Mengunduh seluruh profil tanpa pagination server; jumlah dapat terkena batas REST | Filter/pagination server, hitungan exact, URL yang dapat dibuka kembali |
| Ringkasan | Profil aktif dianggap siap login; nonaktif/ditahan disebut bermasalah; ambang superadmin tiga akun arbitrer | Status profil dipisahkan dari akun login/konfirmasi email; statistik global tanpa penilaian kesehatan rekaan |
| Filter | Nonaktif dan ditahan dijumlah, tetapi aksi hanya memilih nonaktif | Filter semua nonaktif, nonaktif, ditahan dan status lain konsisten |
| Peran | Checkbox mengabaikan scope dan hanya menampilkan kode peran | Daftar penugasan dengan nama peran dan unit/program, cakupan lama dan duplikasi terlihat |
| Simpan peran | Insert/delete terpisah; penghapusan berdasarkan role_id menyapu semua scope | Satu grant/revoke per transaksi, target assignment ID, pemeriksaan versi, alasan dan audit |
| Modal | Overlay custom tanpa primitive focus trap | Dialog lokal, tab dengan keyboard, wizard tiga langkah dan busy state |
| Hubungan LMS | Akun tidak terhubung ke peserta, wali, kelas atau halaqah | Detail menghubungkan ID peserta/anak, program diampu, kelas, halaqah serta keanggotaan unit |
| Ekspor | Hanya data yang sempat dimuat, cakupan hilang dan formula spreadsheet tidak dinetralisir | Seluruh hasil filter satu snapshot, scope ikut CSV, karakter formula dinetralisir, batas eksplisit 10.000 akun |
| Muat ulang | Error singkat hilang otomatis, angka awal nol | Error persisten/retry, `—` saat belum tersedia, snapshot bertanggal pada refresh gagal |

## Hubungan antarmodul

- Halaman masuk tetap satu form. Role yang dimuat oleh Auth provider menentukan menu/portal menurut prioritas yang sudah tersedia. Perubahan penugasan dibaca ulang saat sesi dimuat ulang; perubahan akun sendiri juga memanggil refresh sesi.
- **Akun:** profil, keberadaan akun login, konfirmasi email, login terakhir, pembatasan login, kontak dan tanggal profil dibuat. Status profil bukan pengganti pemblokiran Supabase Auth.
- **Peran:** penugasan tersendiri dengan scope. Penugasan lain dan relasi belajar tidak dihapus ketika satu baris dilepas. Akun superadmin sendiri tidak dapat melepaskan peran superadmin melalui workspace ini.
- **Hubungan:** peserta dan anak membuka `/system/peserta/:id`; kelas/halaqah membuka penempatan program yang sesuai; program diampu membuka kurikulumnya. Keanggotaan unit ditampilkan sebagai konteks, bukan tombol menuju halaman yang belum tersedia.
- Filter **Terhubung ke program** adalah hubungan data: enrollment peserta/anak, penugasan program/kelas/halaqah, unit dan scope yang tersimpan. Filter ini bukan simulasi seluruh izin efektif pengguna.
- **Riwayat:** sepuluh perubahan peran terbaru untuk profil ini, beserta pelaku dan alasan. Audit akses global tersedia melalui `/system/audit?category=auth`. Riwayat tidak mengarang event untuk perubahan lama yang belum diaudit.
- Tombol **Kelola peserta** membawa ke alur peserta/wali yang sudah tersedia. Tidak membuat akun staf, peserta atau enrollment otomatis ketika memberi peran.

## Cakupan yang benar-benar didukung

| Peran | Cakupan baru yang tersedia | Catatan |
| --- | --- | --- |
| Superadmin | Umum | Tata kelola seluruh sistem |
| Admin | Unit / umum | Akses akademik mengikuti unit; komunikasi pada cakupan umum dapat lebih luas |
| Helpdesk | Program / unit / umum | Tiket tetap mengikuti kebijakan scope dan penugasan petugas |
| Keuangan | Umum | `finance_can_manage` memberi akses finance lintas program; scope unit/program tidak ditawarkan seolah-olah membatasinya |
| Pengajar / mentor | Umum | Kelas/halaqah tetap ditautkan melalui penugasan akademik |
| Peserta | Data sendiri | Memerlukan profil peserta yang sudah terhubung; akses belajar mengikuti enrollment |
| Wali | Data sendiri | Memerlukan relasi wali-anak yang sudah terhubung |
| Reviewer konten | Umum | Menu dan data tetap mengikuti kebijakan program/unit/konten yang tersedia |

Scope program untuk admin belum didukung konsisten oleh `can_access_program`; wizard baru tidak menawarkannya. Scope lama tetap ditampilkan dengan perhatian dan dapat dilepas per baris. Tidak menormalisasi atau memperluas akses lama secara otomatis.

Migration 018 mengenali penugasan peserta/wali `own` dengan ID pemilik yang sesuai, serta penugasan pribadi global lama, sebagai **Data sendiri**. Peran pribadi yang sama tidak dapat ditambahkan lagi melalui workspace walaupun bentuk scope berbeda. Penugasan lama tidak ditulis ulang.

## Server dan batas keamanan

Migration `202610310017_users_workspace.sql` menambahkan helper privat `system_user_assignments` dan tiga RPC khusus superadmin aktif: `system_users_list`, `system_user_detail`, `system_user_role_change`.

- Daftar/detail hanya memproyeksikan metadata Auth yang diperlukan; tidak mengembalikan hash sandi, token, identitas OAuth mentah atau metadata kredensial.
- Grant/revoke memeriksa aktor, target, alasan, role/scope, kelayakan profil peserta/wali, duplikasi dan fingerprint versi. Profile/user_roles dikunci selama transaksi singkat. Gagal audit membatalkan penugasan.
- Pemberian baru memerlukan profil aktif dan akun login yang tidak diblokir. Pelepasan superadmin sendiri ditolak; pelepasan superadmin lain memerlukan superadmin aktif lainnya.
- RPC ini menjalankan kontrol transaksional untuk workspace baru. DML langsung yang sudah ada tetap mengikuti RLS superadmin agar klien produksi lama dan RPC enrollment/signup tetap kompatibel. Ini bukan perubahan seluruh jalur penulisan historis menjadi RPC-only. Hak TRUNCATE anon/authenticated dicabut tanpa mengubah policy baca/tulis per baris.
- Penghapusan peran bukan penghapusan akun, pemblokiran Auth atau pembatalan enrollment. Kebijakan kepemilikan data dan akses modul tetap berlaku.

## Status deployment

**Migration 017 dan koreksi 018 sudah diterapkan dan diverifikasi**, setelah pengguna menyetujui masing-masing paket secara eksplisit. Riwayat remote berjumlah 73 versi sampai `202610310018`; hash sumber dan keempat body fungsi cocok. Helper privat tidak dapat dieksekusi anon/authenticated; tiga RPC publik menolak anonim dan memvalidasi superadmin aktif di server.

Preflight YPIA / BelajarLMS1 / main (`foauntgtmhnhqlspgtoc`) berisi 552 profil, 552 akun Auth, 546 penugasan, 523 peserta, 1.064 enrollment dan 10 audit. Jumlah serta fingerprint profil/penugasan dan policy RLS sebelum/sesudah identik. Perubahan ACL hanya pencabutan TRUNCATE anon/authenticated pada 017; 018 tidak mengubah ACL. SQL apply, verifikasi, manifest hash dan emergency disable tersedia pada `../backups/ypia-users-*-20261031.*`, tidak dipublikasikan. Receipt akhir: `ypia-users-own-verification-20261031.json`; bukti layar `../ypia-users-verification.png`.

## Validasi

Sebelas skenario PostgreSQL terisolasi lulus: filter/hitungan, metadata privat, scope terpisah, duplikasi, stale version, peserta/wali, superadmin sendiri, target nonaktif/diblokir, scope lama, rollback audit, otorisasi, pagination/ekspor >1.200 baris, RLS yang tersedia, kompatibilitas RPC terpercaya dan scope pribadi `own`. Hak TRUNCATE diuji khusus setelah penambahannya. Empat helper serta regresi navigasi dan direktori peserta lulus. Build/typecheck berhasil; lint 0 error dengan empat warning lama.

Browser dengan data contoh: pelepasan satu unit menjaga unit lain; grant Helpdesk program tertentu masuk riwayat; superadmin sendiri tidak bisa dilepas; CSV memuat 64 baris dan scope; hubungan wali membuka profil anak; root dan dialog viewport 390px tidak overflow. Perubahan hak akun YPIA nyata tidak dijalankan.

Sesi superadmin YPIA nyata: direktori memuat 552 akun; kartu **Tanpa peran** menghasilkan tepat 26 akun; peserta hasil signup tampil **Data sendiri**. Akun tanpa peran hanya ditampilkan untuk ditinjau, tidak diberi akses otomatis. Bukti tampilan: `../system-users-revamp.png`.
