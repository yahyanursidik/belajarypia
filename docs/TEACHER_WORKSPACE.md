# Portal pengajar — review dan revamp 31 Oktober 2026

## Temuan dan perbaikan

| Area | Temuan | Hasil |
| --- | --- | --- |
| Beranda | Pendaftaran mendominasi; error query dapat tampil sebagai nol; tidak ada pintasan progres | Fokus penilaian/progres, angka program/kelas/kepesertaan dari data yang berhasil dimuat, error dan retry eksplisit |
| Program dan kelas | Sumber terpisah, program dari penugasan kelas tidak tampil dalam daftar program | Direktori bersama dari program diampu dan kelas ditugaskan; pencarian URL, kartu berwarna, tautan detail/progres/penilaian |
| Progres peserta | Belum ada direktori lintas kelas | Halaman `/teacher/progres`, filter program/kelas/nama/nomor, pagination 20, tautan penilaian dengan program dan nomor enrollment |
| Ruang kelas | Peserta menuju seluruh program, review kehilangan konteks | Tautan peserta menuju progres kelas; penilaian menerima program yang bersangkutan |
| Profil | Update langsung, alert browser dan formulir sandi lama | Memakai editor Profil sendiri yang sudah tersedia: isi → tinjau perubahan → simpan atomik melalui migration 020, pemeriksaan versi, audit, metadata login dan dialog sandi |
| Materi | Beberapa status memakai bahasa Inggris | Terbit/Draf/Terkunci/Diarsipkan; alur dokumen, soal dan papan belajar yang ada dipertahankan |
| Silabus | Editor, pratinjau dan template sudah tersedia | Tetap terhubung dari direktori/detail program dan layanan beranda; tidak mengubah silabus nyata |
| Penilaian | Antrean dan penilaian esai sudah tersedia dengan validasi server | Alur lama dipertahankan, pintasan pending dari beranda dan pencarian peserta dari progres |
| Pengumuman dan Helpdesk | Modul bersama sudah menyediakan penerima/tiket | Tautan layanan tetap tersedia; profil pengajar menuju `/teacher/bantuan`, bukan helpdesk admin |
| Navigasi | Progres tidak ditemukan dalam menu | Progres menjadi menu utama dan tersedia pada navigasi cepat ponsel; materi/silabus tetap pada drawer/sidebar |

## Data dan batas akses

`teacherData.ts` membaca melalui Supabase client dengan RLS yang sudah ada. Program diampu ditentukan oleh programs.teacher_user_id, kelas oleh classes.teacher_user_id. Program dari penugasan kelas ditambahkan sebagai konteks; filter aplikasi membatasi enrollment pada kelas tersebut ketika pengajar bukan pengampu program. RLS tetap penentu akses server, tidak ada service role, bypass, policy atau migration baru.

Semua pembacaan koleksi memakai pagination stabil 500 baris, dengan kelompok ID 100 agar daftar besar tidak terpotong oleh batas REST. Data permintaan lama dibatalkan, disimpan bersama identitas pengguna, dan kegagalan ditampilkan eksplisit. Pembacaan beberapa tabel ini bukan transaksi snapshot; perubahan bersamaan bisa terlihat setelah muat ulang. Penugasan berbasis kolom pengampu mengikuti alur pengajar yang sudah ada; penugasan role scoped tanpa kolom pengampu belum otomatis dianggap pengampu oleh direktori ini.

Progres menghitung ID materi published yang release_at-nya sudah tiba, untuk program enrollment aktif dan data yang dapat dibaca. Satu penyelesaian hanya dihitung sekali dan dibatasi enrollment yang dipilih. Started, draft, materi masa depan atau progres milik enrollment lain tidak menambah persentase. Pembagi nol ditampilkan “—”. Persentase bukan kelulusan, tingkat penguasaan atau kehadiran. Kepesertaan aktif bukan jumlah orang unik lintas program.

Profil yang diedit adalah profil akun pengajar sendiri. Identitas murid tidak diubah melalui wizard profil pengajar. Kemampuan penilaian akhir tetap divalidasi fungsi server yang sudah tersedia. Tidak menambah hak pengajar ke data peserta atau mengubah nilai nyata.

## Batas fitur

Jadwal/presensi dalam ruang kelas masih merupakan fitur belum tersedia dan tombol lama tetap nonaktif. Belum ada kalender sesi native atau alur penyerahan tugas native lengkap; label jenis assignment tidak berarti seluruh modul tugas sudah selesai. Portal musyrif/halaqah/setoran Qur'an ditinjau sebagai jalur terpisah dan tidak direvamp pada pekerjaan ini. Fitur pendaftaran operasional tetap berada dalam detail program; ringkasan pendaftaran dipindahkan dari fokus beranda pengajar.

## Validasi

Tes helper memeriksa release/draft, duplikasi penyelesaian, isolasi enrollment, started dan pembagi nol; regresi Profil, navigasi serta progres belajar dijalankan. Browser dengan data contoh terisolasi memuat satu program/kelas/peserta dan membuktikan progres 1/2=50%, tautan penilaian membawa program+nomor, serta tampilan 390 px tanpa overflow horizontal. Screenshot `../teacher-home-example.png` dan `../teacher-progress-mobile-example.png` memakai data contoh, bukan data pengajaran nyata.

Tidak menjalankan perubahan nilai/profil/sandi, pendaftaran, unggahan atau mutasi operasional pada produksi. Sesi pengajar nyata belum dipakai untuk validasi end-to-end; pengujian browser memakai fixture, sedangkan aturan server tetap memakai implementasi yang sudah terpasang. Tidak ada deployment database atau push/merge pada pekerjaan ini.

Validasi akhir: build/typecheck berhasil; lint 0 error dengan 4 warning lama. Empat berkas tes (teacher workspace, Profil, navigasi, learning progress) lulus. Pencarian tanpa hasil dan pemulihan hasil dengan nomor enrollment diperiksa di browser. Log tersedia pada `../backups/teacher-*.log`. Halaman progres dimuat secara lazy agar bundle awal portal lain tidak ikut membesar.


## Catatan uji nyata 2026-11-01

Ruang Tugas berhasil menerima, mengunduh, meminta revisi dan menilai kiriman peserta melalui RPC yang memeriksa penugasan program/kelas. Ringkasan dashboard pengajar pada akun uji masih menampilkan 0 kepesertaan aktif meskipun kiriman program dapat ditinjau; pembacaan direktori/progres umum masih mengikuti RLS enrollment lama dan perlu pemeriksaan cakupan tersendiri. Uji tugas ini tidak memperluas policy direktori peserta.
