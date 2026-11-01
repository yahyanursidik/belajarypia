# Portal pendamping dan layanan — 1 November 2026

Audit ini melanjutkan perubahan admin, pengajar dan peserta ke wali, musyrif, petugas keuangan/helpdesk, reviewer serta katalog publik. Migration Pendampingan 202611010001 sudah diterapkan di YPIA setelah persetujuan pengguna. Source frontend masuk paket publikasi Git revamp portal pendamping. Deployment hosting frontend belum diverifikasi.

## Temuan dan hubungan fitur

| Portal / fitur | Temuan | Hasil implementasi / hubungan |
| --- | --- | --- |
| Wali — beranda dan Anak Saya | Halaman peserta tidak cocok untuk akun wali | Ruang Wali memakai snapshot milik wali, pilihan anak/program di URL, progres berbobot materi tersedia, kelas/halaqah, bantuan dengan konteks kepesertaan |
| Wali — tugas | Pengumpulan/revisi belum tampak pada portal pendamping | Tenggat, kiriman terakhir non-draf, perlu revisi dan nilai final. Jawaban, lampiran dan umpan balik privat tidak dibagikan |
| Wali — Qur’an | Catatan musyrif belum tersambung | Lima catatan terakhir, tiga nilai, catatan dan target latihan; hanya program dengan fitur wali dan Qur’an aktif |
| Wali — profil, pengumuman, bantuan | Profil peserta dan tautan materi/pembayaran tidak tepat | Profil sendiri dengan tinjauan sebelum simpan; CTA pengumuman menuju Anak Saya atau bantuan pembayaran; server helpdesk memvalidasi relasi anak |
| Peserta — Qur’an | Belum tersedia riwayat setoran sendiri | Perjalanan Qur’an, pilihan kepesertaan, paginasi, skor nol dibedakan dari belum dinilai, target latihan, tautan program dan bantuan |
| Peserta — program/silabus | Hubungan pendampingan kurang terlihat | Navigasi program menampilkan Qur’an saat fitur aktif; tugas, agenda, progres, pembayaran, profil dan pendaftaran tetap memakai workspace yang sudah ada |
| Musyrif — beranda/halaqah | Ringkasan terpisah dan progres dapat memasukkan arsip | Pembacaan paginasi/chunk, ringkasan halaqah/peserta/progres, hanya materi terbit yang sudah rilis, penghitung setoran harian WIB |
| Musyrif — setoran | Input langsung, nol dianggap kosong, konteks kurang jelas | Tautan halaqah/peserta mengisi konteks, validasi tanggal/ayat/skor, langkah tinjau, riwayat terpaginasikan dan kegagalan baca terlihat |
| Musyrif — materi/silabus/penilaian | Tautan kembali dan konteks program tidak konsisten | Kembali ke halaqah, parameter program pada silabus, review ujian existing dipertahankan. Review tugas baru tidak ditawarkan karena RPC tugas tidak mengizinkan mentor |
| Keuangan — beranda | Dashboard umum bukan pintu kerja petugas | Fokus verifikasi pembayaran, tagihan, rekening/QR, bantuan pembayaran, pengumuman dan profil; tanpa statistik pembayaran palsu |
| Helpdesk — beranda | Antrean operasional kurang langsung | Tiket aktif, belum ditugaskan dan menunggu pelapor dari RPC existing; tautan menuju filter antrean |
| Reviewer — beranda/akses | Menu review menuju RPC khusus superadmin dan gagal | Batas akses yang jelas serta bantuan. Moderasi mandiri reviewer masih memerlukan pengembangan cakupan backend |
| Publik — katalog | Katalog belum terhubung ke rute utama | `/katalog`, alias `/program`, pencarian/paginasi, kartu program aktif, detail program, cek pendaftaran dan login |

## Aturan data dan keamanan

`guardian_learning_workspace()` hanya menerima wali aktif dan tidak diblokir. Anak harus terhubung; data akademik memerlukan anak/program aktif, enrollment active/completed dan `use_parent_portal`. Tugas memerlukan `use_assignment`; Qur’an memerlukan `use_quran_engine`. Progres menghitung materi terbit yang sudah rilis. Daftar tugas maksimal 20 dengan total sebenarnya. Tidak ada operasi pengumpulan, penilaian atau pembayaran dari portal wali.

`learner_quran_history(uuid, integer)` memeriksa peserta aktif, kepemilikan enrollment dan fitur Qur’an; halaman berisi 10 catatan. Kedua RPC STABLE SECURITY DEFINER dengan search_path tetap. Execute anon/public dicabut; authenticated harus lulus pemeriksaan internal. Policy dan ACL tabel lama tidak diubah.

Hook membatalkan permintaan lama dan memisahkan hasil berdasarkan akun/argumen. Kegagalan tidak disajikan sebagai nol. Pada preflight produksi belum ada program dengan fitur wali atau Qur’an aktif; deployment tidak mengaktifkannya. Pengelola perlu memilih program dan mengaktifkan fitur yang ingin digunakan melalui pengaturan program.

## Verifikasi

- SHA-256 migration: `588db4d96cfcdd6840a44608a0367fba95c423e877b26a3fbe278723d833d378`.
- YPIA/BelajarLMS1, project `foauntgtmhnhqlspgtoc`, main: dua body fungsi cocok, authenticated execute aktif, anon ditolak, search_path sesuai.
- Fingerprint sebelum/sesudah identik: profil, relasi wali, enrollment, progres, kiriman tugas, fitur program dan policy.
- RPC wali nyata dengan ROLE authenticated dalam transaksi READ ONLY + ROLLBACK mengembalikan dua anak terhubung; tanpa perubahan sesi login/data bisnis.
- Tujuh skenario SQL: deduplikasi/isolasi anak, fitur/status, kiriman terbaru, relasi dicabut, akun/role/anon, kepemilikan/paginasi Qur’an, tidak ada mutasi data.
- 25 berkas unit lulus; typecheck/build lulus; lint 0 error dan empat warning lama.
- Browser data contoh: pergantian anak, progres tanpa denominator, skor nol, tinjau profil lalu batal, konteks halaqah/setoran dan tinjau lalu batal, beranda keuangan/helpdesk/reviewer, kondisi kosong/gagal, katalog dan ponsel 390 px. Fixture terpisah dan tidak terkoneksi Supabase.
- Bukti SQL, manifest, emergency disable dan screenshot di `../backups/companion-portals/`. Data contoh tidak menyatakan adanya data akademik produksi yang fitur programnya masih nonaktif.

## Batas yang masih perlu dikembangkan

1. Moderasi mandiri content_reviewer memerlukan RPC, penugasan cakupan dan audit; penerbitan saat ini melalui superadmin.
2. Mentor belum menjadi penilai tugas berkas/revisi pada migration 022; alur tersebut tetap peserta–pengajar/admin. Review ujian mentor yang sudah didukung tetap tersedia.
3. Presensi native, pengingat otomatis, forum diskusi dan gamifikasi belum tersedia. Agenda rilis/tenggat merupakan agenda, bukan presensi.
4. Setoran Qur’an memakai insert/RLS existing ditambah validasi/tinjauan UI; paket ini tidak menambahkan idempotensi atau transaksi audit baru untuk penulisan setoran.
5. Wali tidak mendapat akun peserta, lampiran tugas, bukti pembayaran atau unduhan sertifikat melalui RPC ini. Pengumpulan/revisi dan pembayaran tetap dilakukan peserta yang berhak.
