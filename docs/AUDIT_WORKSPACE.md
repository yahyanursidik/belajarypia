# Audit Sistem — `/system/audit`

Workspace hanya-baca untuk superadmin aktif. Audit menghubungkan aktivitas aplikasi dengan akun pelaku, objek yang berubah, dan modul operasional. Tidak menyediakan hapus log, pemulihan data, tanda “sudah ditinjau”, penilaian risiko otomatis, atau perubahan hak pengguna dari catatan audit.

## Review fitur dan revamp

| Bagian | Temuan sebelumnya | Perbaikan |
| --- | --- | --- |
| Ringkasan | Enam kartu termasuk halaman/filter; hitungan kategori hanya dari halaman saat ini | Empat kartu sesuai seluruh hasil filter: aktivitas, pelaku tercatat unik, akses/peran dan penghapusan |
| Kategori | Pencocokan substring tumpang tindih; VERIFY_PAYMENT tidak dikenali sebagai perubahan | Satu klasifikasi server untuk baris, filter, ringkasan dan ekspor; akses/peran diprioritaskan, token utuh menghindari salah klasifikasi `address` |
| Penelusuran | Workflow panjang mengesankan penghapusan nol berarti aman | Filter langsung, periode cepat WIB, dan wizard dua langkah pilih fokus → tinjau filter; tanpa status keamanan rekaan |
| Pencarian | `ilike` pada UUID berisiko gagal; pelaku tidak dicari | Pencarian literal nama/email pelaku, aksi, tipe/ID objek, ID audit/pelaku; karakter `%(),_` tidak diubah menjadi ekspresi query |
| Filter | Opsi distinct berasal dari unduhan tabel yang dapat terpotong; URL hanya dibaca sekali | Facet distinct server, URL penuh untuk q/category/entity/action/actor/target/from/to/page/size/event; back/forward dan tautan detail dapat dipakai kembali |
| Pagination | Respons lama dapat menimpa filter baru; detail tidak punya tautan | Urutan stabil waktu+ID, total exact, pembatalan request dan kunci filter; membuka/menutup dialog menjaga halaman |
| Detail | Modal custom tanpa focus trap, payload JSON mentah saja | Dialog lokal, tab keyboard, label manusia, perbandingan sebelum/sesudah bila tersedia, data tercatat dan navigasi terkait |
| Identitas pelaku | Profil hilang dianggap Sistem/Anonim | Dibedakan Akun tidak tersedia dan Pelaku tidak tercatat; tidak mengarang asal kejadian |
| Ekspor | Hanya baris halaman aktif; formula spreadsheet dan payload mentah ikut CSV | Satu snapshot seluruh hasil filter, batas 10.000 dengan error eksplisit, escaping/formula protection; ekspor metadata tanpa payload detail |
| Kegagalan | Angka kosong menjadi nol dan snapshot dihapus | Error persisten/retry, angka belum tersedia `—`, snapshot bertanggal untuk refresh gagal, error tanggal terbalik eksplisit |

## Keterhubungan fitur

- Dashboard mempertahankan periode saat menuju Audit; aktivitas terbarunya membuka `event` spesifik.
- Pengguna membuka riwayat target profil dengan kategori akses; Review Konten membuka riwayat lesson tertentu.
- Detail Audit dapat membuka akun pelaku dan seluruh aktivitas pelaku, atau menelusuri riwayat objek yang sama tanpa pembatasan filter sebelumnya.
- Konteks objek saat ini berasal dari relasi database: profil, peserta, enrollment, materi/progres belajar, ujian, program, pilihan pendaftaran/formulir, transaksi/tagihan, tiket dan pengumuman. Relasi yang hilang tidak diganti dengan ID tebakan.
- Tautan langsung memakai parameter tujuan yang benar: `user`, `lesson`, `choice`, `transaction`, `invoice`, `ticket`, `detail`; peserta/penilaian/program memakai route ID. Modul Keuangan/Pengaturan/Sertifikat juga dapat dibuka sebagai konteks umum yang diberi label modul, bukan klaim objek historis masih tersedia.
- Nama dan relasi objek adalah **data terkait saat ini**, bukan snapshot historis. Nilai lama hanya disajikan jika payload audit mencatatnya. Tidak merekonstruksi perubahan dari kondisi data sekarang.

## Server dan batas keamanan

Migration `202610310019_audit_workspace.sql` menambahkan:

- `system_audit_category(text)` dan `system_audit_redact(jsonb)`: helper privat, tidak SECURITY DEFINER, tidak dapat dipanggil anon/authenticated.
- `system_audit_list(jsonb)` dan `system_audit_detail(uuid)`: baca khusus superadmin dengan profil aktif, SECURITY DEFINER dan search_path tetap; anonim ditolak. Tidak menambah akses untuk admin/teacher/peserta/wali.

List tidak memuat payload detail. Detail menyamarkan key kredensial yang dikenali secara rekursif serta string Bearer/JWT/URL bertanda tangan yang dikenali, tanpa menulis ulang log. Ini bukan jaminan bahwa setiap secret dalam teks bebas historis dapat dikenali. Policy/grant tabel audit yang sudah ada tetap dipertahankan; penyamaran ini berlaku pada proyeksi workspace baru, bukan perubahan seluruh jalur database lama. Tidak mengakses atau mengirim Supabase Auth platform logs, email, WA maupun dokumen privat.

Audit aplikasi bukan inventaris seluruh aksi yang pernah terjadi. Hanya fungsi/alur yang mencatat audit menghasilkan event; log lama tanpa actor/payload/before-after tetap terlihat sesuai data yang tersedia. Tidak menambahkan log LOGIN secara rekaan atau mengganti sejarah saat deployment.

## Deployment

Pengguna menyetujui **Terapkan migration Audit**. Paket diterapkan pada YPIA / BelajarLMS1 / main (`foauntgtmhnhqlspgtoc`), riwayat 74 versi sampai `202610310019`. Hash sumber dan 4/4 body fungsi cocok; privilege helper/RPC sesuai paket.

Preflight dan sesudah deployment identik: **10 audit, 552 profil, 546 penugasan, 523 peserta, 1.064 enrollment**. Fingerprint audit `6c65a5df93d5eb585f149b2a3abf9a18`, RLS, policy dan ACL tabel audit tidak berubah. Distribusi lama: LOGIN 3, UPDATE_SETTINGS 3, VERIFY_PAYMENT 3, settings.updated 1.

SQL apply/verify, preflight, manifest dan emergency disable tersedia lokal pada `../backups/ypia-audit-*-20261031.*`; receipt `ypia-audit-verification-20261031.json`. Bukti deployment `../ypia-audit-migration-success.png`, `../ypia-audit-verification.png`.

## Validasi

Tujuh skenario PostgreSQL terisolasi: klasifikasi/filter/pencarian UUID/pelaku literal; batas tanggal WIB dan validasi; pagination stabil/facet lengkap/ekspor >1.200 dan penolakan >10.000; redaksi rekursif dan before-after; konteks relasional/ID hilang; penolakan anonim/non-superadmin/inaktif serta helper privat; pelestarian data/policy/grant sebelum/sesudah baca dan migration.

Empat tes helper mencakup URL/validasi, perbandingan null/false/nol/missing, tautan yang tervalidasi dan CSV tanpa payload/formula. Regresi helper dashboard, pengguna, konten dan navigasi ikut dijalankan. Build mencakup typecheck; lint 0 error dengan empat warning lama.

Browser fixture memakai fungsi SQL sebenarnya pada PostgreSQL terisolasi: 64 event, wizard akses menghasilkan 16 hasil, riwayat enrollment menghasilkan 8 hasil, kredensial contoh disamarkan, perbandingan kelas/halaqah dan tautan peserta tepat. Lebar 390px: root serta dialog tidak overflow. Bukti contoh: `../audit-workspace-example.png`, `../audit-explore-example.png`, `../audit-changes-example.png`, `../audit-mobile-example.png`. Pengujian tidak membuat event atau mengubah objek nyata.

Pemeriksaan lanjutan browser: error awal menampilkan `—`, empty state sah menampilkan nol, refresh gagal mempertahankan 64 event dengan label snapshot dan retry berhasil. Membuka/menutup detail pada halaman dua menjaga `page=2`. Sesi superadmin YPIA nyata memuat 10 aktivitas, dua pelaku, tiga aktivitas akses; filter akses menghasilkan tiga baris. Pencarian UUID objek menghasilkan satu catatan Pengaturan dan detailnya memiliki tautan `/system/pengaturan`, tanpa mengubah konfigurasi. Screenshot akhir `../system-audit-revamp.png`.
