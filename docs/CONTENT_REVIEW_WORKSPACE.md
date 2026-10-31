# Review Konten — `/system/konten`

Halaman mengawasi materi lintas program untuk superadmin aktif. Draf adalah status penyusunan, bukan bukti pengajuan persetujuan formal dari pengajar.

## Hasil review

| Temuan | Perbaikan |
| --- | --- |
| Semua draf disebut menunggu persetujuan | Label Draf akurat; empat kartu ringkas dan enam filter status |
| Gagal query tampak seperti antrean kosong | Error/retry berbeda dari hasil kosong; snapshot lama bertanggal dipertahankan pada refresh gagal |
| Materi tidak memiliki konteks navigasi | Program/modul, editor materi spesifik, kurikulum, progres, pengumuman dan penilaian terkait |
| Ujian hanya menampilkan placeholder | Soal, pilihan, bobot, panduan esai dan kunci yang dibuka sesuai permintaan; pagination 10 soal |
| File privat tanpa aksi | Signed URL melalui fungsi dokumen yang tersedia, kedaluwarsa dan dapat disiapkan ulang |
| Status langsung berubah tanpa peninjauan | Wizard keputusan dua langkah, catatan, versi sumber, transaksi dan audit |
| Pratinjau menurunkan seluruh URL menjadi huruf kecil | URL mempertahankan path/query; HTTP/HTTPS tanpa kredensial saja |
| HTML/material campuran sulit diperiksa | HTML terisolasi tanpa skrip, teks, tautan, dokumen dan kartu papan belajar |

## Fitur dan hubungan

- Kartu Draf/Terbit/Terjadwal/Perlu dilengkapi dapat memfilter daftar. Hitungan mengikuti program, jenis dan pencarian; status/kelengkapan mempersempit daftar, bukan denominator kartu.
- Filter tersimpan di URL: `program`, `kind`, `status`, `q`, `attention`, `page`, `size`, `lesson`. Pagination server 10/20/50 baris; statistik tidak terkena batas 1.000 baris REST. Pencarian literal aman terhadap tanda `%`, koma dan kurung.
- Panel **Isi & sumber** menampilkan sumber aktif, membedakan akses peserta dan khusus pengelola. Kunci jawaban tidak ditampilkan pada pembukaan awal. Papan menampilkan kartu/kolom, gambar diminta melalui signed URL privat yang tersedia.
- Panel **Pemeriksaan** memuat data wajib, jadwal WIB, sumber peserta, soal/kartu dan prasyarat. Prasyarat dapat dibuka dalam review yang sama.
- Panel **Riwayat** menampilkan 10 keputusan terbaru melalui halaman ini, pelaku, waktu dan catatan. Riwayat tidak mengarang keputusan untuk status lama. Audit sistem dapat dibuka.
- **Ubah materi** membuka wizard editor untuk lesson yang tepat, lalu tersedia tautan kembali dengan konteks filter. Program Builder juga menyediakan pintasan Review Konten per program. Tidak membuat salinan materi.
- Kurikulum, laporan/progres, Pengumuman dan Penilaian memakai ID program yang sama. Publikasi memakai trigger Pengumuman yang sudah ada: waktu rilis dihormati, status tersembunyi menyembunyikan pengumuman, bukan menghapus progres.

## Keputusan dan keamanan

Empat fungsi pada migration `202610310016_content_review_workspace.sql`:

1. `system_content_snapshot(uuid)` — helper privat, kelengkapan dan fingerprint lesson/sumber/soal/papan/prasyarat/konteks.
2. `system_content_review_list(jsonb)` — daftar terfilter, jumlah dan pilihan program.
3. `system_content_review_detail(uuid)` — pratinjau dan riwayat.
4. `system_content_review_decide(uuid,text,text,text)` — perubahan status atomik dan audit.

Semua memeriksa sesi, superadmin dan profil aktif pada server. Helper tidak dapat dipanggil browser; tiga RPC hanya dapat dieksekusi authenticated dan masih memeriksa superadmin. Tidak menambah hak admin program, reviewer konten, guru atau peserta. RLS dan alur editor yang tersedia tidak diubah.

Keputusan menolak fingerprint lama, mengunci lesson dan tabel sumber terkait selama transaksi singkat, lalu memvalidasi kelengkapan di server. Catatan 3–1.500 karakter wajib untuk draf/kunci/arsip, opsional untuk terbit. Arsip hanya dibuka kembali sebagai draf. Gagal audit membatalkan perubahan status dan efek pengumuman.

Penerbitan melalui workspace ini memeriksa judul/kode, jadwal, sumber peserta, URL, jenis unggahan, soal/pilihan/kunci/bobot, pengaturan ujian, papan serta prasyarat lintas program/diri sendiri/siklus. Jadwal mendatang, program belum aktif dan prasyarat belum terbit ditampilkan sebagai perhatian. Pemeriksaan adalah kelengkapan data; isi tautan, keberadaan objek storage dan mutu pedagogis tetap diperiksa pengelola.

Ini bukan mesin persetujuan wajib untuk seluruh editor. Program Builder tetap mengelola konten sesuai akses yang tersedia. Mengubah isi setelah review membuat fingerprint baru; riwayat keputusan tetap menunjukkan versi yang diperiksa.

## Pengujian dan deployment

Sembilan skenario PostgreSQL terisolasi mencakup hak akses, pagination >1.200 baris, draf/terjadwal, sumber privat dan staff-only, URL, ujian, papan, siklus prasyarat, konflik versi, catatan, transisi arsip, rollback audit, sinkronisasi pengumuman dan progres tetap tersimpan. Empat helper dan regresi Program Workspace, navigasi serta progres belajar diperiksa terpisah.

Browser fixture mencakup pratinjau HTML tanpa eksekusi skrip, sumber privat, kunci soal/pagination, wizard/riwayat, konflik versi, kelengkapan, dan tampilan ponsel. Semua keputusan tulis memakai data contoh terisolasi. Tidak menerbitkan, mengunci atau mengarsipkan materi YPIA nyata selama pengujian.

SQL preflight/apply/verify, source/body hash, fingerprint bisnis, emergency disable dan log pengujian disimpan di `../backups` (tidak dipublikasikan). Migration baru dicatat terpisah; migration historis/seed tidak dijalankan ulang.

Migration 016 diterapkan pada YPIA / BelajarLMS1 / main (`foauntgtmhnhqlspgtoc`), 31 Oktober 2026. Verifikasi 4/4 body hash dan SHA256 sumber cocok; riwayat 71 versi. Fingerprint 80 materi dan 24 pengumuman identik sebelum/sesudah. Tetap 3 soal, 1.064 enrollment, 0 progres, 3 transaksi, 10 audit. Sesi nyata memuat 3 draf/77 terbit dan 26 materi perlu dilengkapi; editor Kuis 1 terbuka sesuai pilihan dan ditutup tanpa simpan.

Jenis materi lama di luar enum editor ditandai belum didukung pada pemeriksaan. Tidak mengubah jenis, isi, soal atau status lama secara otomatis. Signed URL positif diuji dengan fixture; keberadaan/unduhan file Contabo nyata tidak diuji ulang dalam tugas ini.

Pemeriksaan akhir: typecheck/build berhasil, lint 0 error dengan 4 warning lama. Sembilan skenario SQL dan empat tes helper lulus; empat berkas regresi (helper Review Konten, Program Workspace, navigasi, progres belajar) juga lulus. Browser tambahan membedakan awal gagal/hasil kosong, mempertahankan snapshot saat refresh gagal lalu pulih lewat retry, serta menampilkan papan belajar pada viewport 390px tanpa overflow horizontal. Stylesheet cache pada dev server disegarkan dan tampilan nyata diverifikasi ulang.
