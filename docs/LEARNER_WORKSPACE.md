# Portal peserta — review dan implementasi 31 Oktober 2026

## Temuan dan hasil

Sebelumnya beranda/direktori hanya membaca enrollment aktif, progres tersebar pada kartu program, dan profil disimpan melalui dua operasi terpisah. Outline program dan ringkasan memakai pembacaan REST terpisah yang dapat terpotong pada batas jumlah baris. Konten HTML materi dirender pada origin aplikasi. Perubahan ini menyatukan sumber progres, mempertahankan riwayat enrollment dan mengarahkan peserta ke tindakan berikutnya tanpa menambahkan metrik rekaan.

| Fitur / subfitur | Implementasi dan hubungan antarmenu |
| --- | --- |
| Beranda | Lanjutkan program dengan aktivitas tercatat terbaru, progres materi tersedia, empat metrik faktual, agenda tenggat WIB, pengumuman dan layanan peserta |
| Program saya | Semua status enrollment, pencarian nama/nomor, filter URL; aktif → materi, selesai → transkrip, ditahan/menunggu pembayaran → Keuangan, kendala akses → Helpdesk berkonteks program/enrollment |
| Jelajahi program | Katalog terpisah dari data belajar; alur formulir lama dipertahankan, pendaftaran langsung memerlukan konfirmasi; seluruh program yang sudah memiliki enrollment disembunyikan untuk mencegah reaktivasi tidak sengaja |
| Detail program | Satu outline server untuk modul, level, materi rilis, prasyarat, progres dan percobaan ujian terbaru; navigasi Materi → Tentang program → Progres → Hasil; bantuan menyertakan konteks |
| Materi / bacaan | Lebar teks terbatas dan tinggi baris nyaman, ukuran huruf 16–24 px; HTML di iframe sandbox tanpa script, dengan CSP dan no-referrer; identitas komponen direset ketika ID materi berganti |
| Dokumen / papan belajar | Pemuat dokumen dan signed URL serta papan belajar lama dipertahankan; tidak menambahkan unggah media atau mengubah otorisasi dokumen |
| Kuis / ujian | Alur fokus, mulai eksplisit, pemulihan/autosave dan submit lama dipertahankan; kartu menautkan percobaan terbaru yang sedang dinilai; nilai percobaan belum final disamarkan pada proyeksi baru; tidak membuat percobaan melalui kunjungan beranda |
| Progres (baru) | Agregat berbobot jumlah materi tersedia, filter program di URL, aktivitas 7 hari WIB, daftar menunggu nilai dan riwayat maksimal 10 penyelesaian materi yang masih tersedia |
| Agenda | Tenggat lesson.due_at dari materi tersedia yang belum selesai; prasyarat belum selesai mengarah ke outline, percobaan submitted/pending_review dikeluarkan dari daftar pekerjaan |
| Profil belajar | Identitas ringkas, kontak, NIS baca saja, metadata akun, wizard Identitas → Kontak → Tinjau; simpan patch atomik, pemeriksaan versi, nilai opsional tidak menghalangi belajar |
| Keamanan akun | Email login baca saja, metadata konfirmasi/terakhir masuk dari Auth; dialog sandi dari modul Profil dipakai kembali; tidak mengubah kredensial dalam pengujian |
| Transkrip / syahadah | Hasil memakai enrollment yang tepat, program selesai tetap mempunyai tautan hasil; bagian sertifikat mengikuti use_certificate; penerbitan tetap mengikuti validasi kelulusan server yang sudah ada |
| Pembayaran | Layanan dan enrollment tertahan menuju Keuangan dengan filter program; alur tagihan/bukti/rekening/QR dan verifikasi lama dipertahankan |
| Pengumuman | Highlight beranda dan menu menuju ruang pengumuman dengan aturan penerima/jadwal/tanda baca yang sudah ada |
| Bantuan | Tersedia dari navigasi, layanan profil dan konteks akademik; akun belum terhubung menuju kategori account dan cek pendaftaran |
| Navigasi responsif | Belajar / Akun / Informasi pada sidebar; lima menu cepat ponsel: Beranda, Program, Progres, Pembayaran, Akun; menu tambahan lewat drawer |

## Definisi progres dan batas produk

- Pembagi progres hanya lesson published yang release_at-nya sudah tiba, pada program/enrollment aktif yang dapat dibaca peserta. Materi terarsip/draft/masa depan tidak dihitung. Jika materi bertambah, persentase dapat berubah.
- Penyelesaian dihitung dengan ID materi unik. Materi kosong ditampilkan “—”, tidak dianggap 100%. Progres tidak berarti lulus atau syahadah diterbitkan.
- Snapshot program selesai tetap menyimpan tautan transkrip, tetapi outline materi aktif tidak dibuka ulang secara implisit. Status hold/pending/cancelled tidak menawarkan tombol masuk materi.
- Tujuh hari menghitung penyelesaian tercatat dalam WIB; tidak ada streak, XP, ranking, waktu belajar rekaan atau estimasi kehadiran.
- Data tambahan profil (demografi) opsional. Wizard tidak mengubah NIS, status peserta, email/sandi Auth, role, penempatan, enrollment atau dokumen akademik. Tidak membuat profil peserta saat akun belum terhubung.
- Agenda bukan kalender kelas langsung. Repo belum menyediakan modul native live_sessions/kalender atau alur penyerahan tugas terpisah yang lengkap. Jenis aktivitas yang belum mempunyai alur tersebut tidak dinyatakan selesai melalui tombol bacaan; penilaian/kehadiran tetap mengikuti modul server yang tersedia.
- Portal wali/Anak Saya tidak direvamp pada pekerjaan ini. Menu dan alur wali lama tetap terpisah dari editor identitas peserta sendiri.

## Sumber data, transaksi dan akses

Migration `202610310021_learner_workspace.sql` menambahkan empat RPC dengan target dari auth.uid(), SECURITY DEFINER dan search_path tetap public. Anon/PUBLIC tidak dapat menjalankannya. Tidak ada parameter untuk memilih peserta lain dan tidak ada override superadmin untuk membaca outline peserta lain.

`learner_portal_workspace()` mengembalikan seluruh enrollment milik sendiri dan outline aktif yang memenuhi status akun/peserta/program. `learner_program_outline(uuid)` memberikan metadata eksplisit dan array utuh tanpa batas 1.000 baris REST; tidak membawa konten materi, soal, jawaban atau panduan penilaian. Percobaan terbaru dipilih per lesson dengan nomor/waktu/ID deterministik. Metadata kelas/angkatan/halaqah/level juga dicocokkan dengan program atau kelasnya. Progress prasyarat yang materinya sudah disembunyikan tetap tersedia sebagai status untuk membuka tahapan berikutnya.

`learner_profile_workspace()` menggunakan metadata akun sendiri dari migration 020, proyeksi peserta yang dibatasi dan revision gabungan. Pemetaan peserta ganda menghasilkan error, bukan memilih identitas pertama. `learner_profile_update(text,jsonb)` mengunci akun lalu peserta, memvalidasi whitelist, tipe, panjang, nomor telepon, gender dan tanggal lahir; patch nama/telepon akun memakai validator 020 dalam transaksi yang sama. Kegagalan validasi, konflik versi atau audit menggagalkan kedua perubahan. Telepon yang tidak diedit tetap terjaga; edit telepon eksplisit menyelaraskan kedua tabel. Nilai gender lama tidak dinormalisasi ketika tidak disentuh. Audit hanya nama kolom berubah, tanpa nilai kontak.

Frontend menyimpan snapshot terkait user, membatalkan permintaan lama dan menyediakan retry. Refresh gagal mempertahankan snapshot yang sudah terbaca beserta pesan gagal. Draf profil tidak ditaruh pada localStorage. Ini bukan perubahan global terhadap seluruh policy/ACL lama: direct DML/RLS yang sudah ada dipertahankan untuk kompatibilitas. Prasyarat dikunci pada navigasi dan validasi penyelesaian server lama; aturan baca lesson RLS lama tidak diperluas dalam migration ini.

## Deployment dan validasi

Pengguna menyetujui “Terapkan migration Portal Peserta”. Migration 021 diterapkan pada YPIA / BelajarLMS1 main (`foauntgtmhnhqlspgtoc`). Riwayat menjadi 76 versi; SHA256 sumber `c978480f9e820f67237715517a31cc1c8d8a55ba98e321d1c616263dfd404e5d`, seluruh 4 body hash cocok. EXECUTE authenticated aktif, anon ditolak. Tidak mengulang migration/seeds lama.

Fingerprint profil, peserta, enrollment, policy dan ACL/RLS tabel sebelum/sesudah identik. Jumlah tetap 552 profil/Auth, 546 penugasan, 523 peserta, 1.064 enrollment, 0 progres, 3 percobaan ujian, 2 sertifikat dan 10 audit. Pengujian baca dengan ROLE authenticated dalam transaksi READ ONLY + ROLLBACK pada akun peserta yang dipilih memverifikasi kepemilikan profil dan seluruh enrollment; contoh tersebut mempunyai 2 outline aktif dan 0 materi tersedia. Ini bukan login browser peserta nyata dan tidak mengubah data.

Paket `../backups/ypia-learner-*-20261031.*` berisi SQL preflight/apply/verify, manifest hash, receipt dan emergency disable empat RPC baru. Emergency disable tidak dijalankan. Bukti `../ypia-learner-migration-success.png` dan `../ypia-learner-verification.png`.

Pengujian PostgreSQL terisolasi: 8 skenario lulus — status enrollment, kepemilikan/akun tidak aktif/ban, materi draft/future, nilai percobaan terbaru, array >1.200 materi, patch atomik dan rollback audit, stale/no-op, unlinked/duplikasi/anon serta deployment tanpa perubahan data. Enam helper peserta dan regresi learning progress, Profil, Audit dan navigasi juga lulus.

Browser data contoh memverifikasi beranda 2 program aktif/3 penyelesaian/1 menunggu nilai, progres berbobot 3/6=50%, riwayat dan tautan attempt yang sama, direktori empat status/filter, outline/prasyarat, wizard tiga langkah menyimpan nama tampilan/kota sambil mempertahankan telepon/NIS, serta navigasi dan wizard pada 390 px tanpa overflow. Konflik versi pada browser menolak simpan sambil mempertahankan draf, dan muat versi terbaru meminta konfirmasi. Keadaan koneksi gagal menampilkan retry dan enrollment kosong menampilkan ajakan memilih program. HTML uji mencoba menjalankan script pada parent; atribut uji tetap tidak ada dan sandbox kosong/no-referrer terpasang. Screenshot bertanda data contoh tidak mewakili progres peserta nyata.

Tidak melakukan pendaftaran, submit ujian, upload/download Contabo positif, pembayaran, kelulusan, penerbitan sertifikat, perubahan identitas atau sandi peserta nyata. Kuis, Helpdesk, pengumuman, Keuangan dan transkrip lama dihubungkan dan ditinjau kodenya; alur mutasinya tidak diuji ulang pada data produksi. Sesi peserta yang sudah tersedia di localhost kemudian berhasil diverifikasi secara baca saja: beranda memuat empat program aktif; Progres menunjukkan 0/49 materi, filter program menjadi 0/33; profil belajar memuat identitas dan editor tanpa error. Direktori menampilkan empat program; outline program nyata menampilkan materi serta navigasi Materi/Tentang program/Progres/Hasil tanpa error. Tidak login ulang atau menyimpan profil. Bukti `../learner-portal-localhost.png` dan `../learner-progress-localhost.png`.

Validasi akhir: `npm run lint` 0 error/4 warning lama; `npm run typecheck` dan `npm run build` berhasil. Log pemeriksaan berada pada `../backups/learner-*-20261031.log`. Tidak melakukan commit/push/merge pada pekerjaan ini.
