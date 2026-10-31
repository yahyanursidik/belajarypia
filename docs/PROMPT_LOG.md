# PROMPT_LOG.md
# Codex Prompt Log

Use this file to track Codex tasks, prompts, outputs, issues, and next actions.

---

## Template

### Task ID
Example: PHASE-0-001

### Date
YYYY-MM-DD

### Phase
Example: Phase 0 — Technical Foundation

### Prompt
Paste the exact prompt sent to Codex.

### Scope
- item 1
- item 2
- item 3

### Files Changed
- file path 1
- file path 2

### Result Summary
Write what Codex implemented.

### Commands Run
```bash
npm run lint
npm run typecheck
npm run build
```

### Issues Found
- issue 1
- issue 2

### Follow-Up Task
Write the next recommended task.

---

## PHASE-0-001

### Date
2026-06-24

### Phase
Phase 0 — Technical Foundation

### Prompt
Baca AGENTS.md dan docs/STACK.md. Kerjakan Phase 0 foundation untuk LMS YPIA. Dilanjutkan dengan migrasi ke React terbaru, Refine core v5 headless, shadcn/ui, dan Tailwind CSS.

### Scope
- Vite + React + TypeScript project foundation
- Refine provider skeleton
- shadcn/ui-style local components and Tailwind CSS theme
- Supabase client setup
- Public, auth, admin, teacher, learner, and superadmin placeholder routes
- Basic role layouts and placeholder dashboards
- env.example

### Files Changed
- package.json
- package-lock.json
- index.html
- vite.config.ts
- eslint.config.js
- tsconfig.json
- tsconfig.app.json
- tsconfig.node.json
- env.example
- src/

### Result Summary
Created Phase 0 technical foundation for YPIA LMS using React 19, Refine core v5 headless, shadcn/ui-style local components, Tailwind CSS, and Supabase client setup. Did not implement database, RLS, admission, enrollment, AI, upload, or academic modules.

### Commands Run
```bash
npm.cmd install
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run build
```

### Issues Found
- npm install reports 1 low severity audit finding. No automatic audit fix was applied.
- Vite build warned that the main JS chunk is larger than 500 kB; code splitting can be handled in a later phase.

### Follow-Up Task
Phase 1: implement Supabase Auth, profiles, roles, permissions, authProvider, accessControlProvider, protected routes, and role-based navigation.

---

## PHASE-1-001

### Date
2026-06-24

### Phase
Phase 1 — Supabase schema dasar + Auth + RBAC

### Prompt
Phase 1 — Supabase schema dasar + Auth + RBAC. Tujuan: user bisa login dan menu tampil sesuai role.

### Scope
- Supabase migration for profiles, roles, permissions, user_roles, role_permissions
- Initial RLS policies for identity/RBAC tables
- Supabase Auth login flow
- Refine authProvider and accessControlProvider
- Role-based navigation
- Protected routes
- Dashboard redirect by role

### Files Changed
- supabase/migrations/202606240001_phase_1_auth_rbac.sql
- src/lib/auth.ts
- src/lib/navigation.ts
- src/app/providers/authProvider.ts
- src/app/providers/accessControlProvider.ts
- src/app/providers/AuthSessionProvider.tsx
- src/app/providers/authSessionContext.ts
- src/routes/AppRoutes.tsx
- src/routes/ProtectedRoute.tsx
- src/routes/auth/LoginPage.tsx
- src/routes/auth/NoRolePage.tsx
- src/layouts/
- src/styles/global.css

### Result Summary
Implemented Phase 1 Auth/RBAC foundation. No registration, admission, enrollment, upload, AI, or academic module was added.

### Commands Run
```bash
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run build
```

### Issues Found
- Vite build warned that the main JS chunk is larger than 500 kB; route-level lazy loading can be added later.
- Supabase migration was authored but not applied to a remote/local Supabase project from this environment.

### Follow-Up Task
Apply the Supabase migration, create the first super_admin user role assignment, then test login/route access for each role.

---

## PHASE-2-001

### Date
2026-06-24

### Phase
Phase 2 — Organization, Unit, Program Basic

### Prompt
Phase 2 — Organization, Unit, Program basic. Tujuan: struktur yayasan → unit → program siap.

### Scope
- Supabase migration for organizations, units, unit_users, and programs
- Initial RLS policies for unit-scoped organization/program access
- Refine resources for organizations, units, and programs
- Super Admin unit governance page
- Admin program list/create page
- Program status draft/active/archived
- MVP feature flags per program

### Files Changed
- supabase/migrations/202606240002_phase_2_organization_unit_program.sql
- src/app/providers/dataProvider.ts
- src/app/providers/RefineProvider.tsx
- src/lib/auth.ts
- src/lib/navigation.ts
- src/lib/organization.ts
- src/routes/AppRoutes.tsx
- src/routes/admin/AdminProgramListPage.tsx
- src/routes/superadmin/UnitGovernancePage.tsx
- src/styles/global.css

### Result Summary
Implemented basic organization → unit → program foundation. Did not implement registration, admission, enrollment, upload, AI, or academic modules.

### Commands Run
```bash
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run build
```

### Issues Found
- Supabase migration was authored but not applied to a remote/local Supabase project from this environment.
- Admin unit assignment is supported by `unit_users` and RLS, but the UI for assigning admins to units is not yet built.

### Follow-Up Task
Apply migrations, seed or assign admins to `unit_users`, then test Super Admin unit creation and Admin program visibility per assigned unit.

---

## PHASE-3-001

### Date
2026-06-24

### Phase
Phase 3 — Registration dan Admission

### Prompt
Phase 3 — Registration dan Admission. Tujuan: calon peserta bisa daftar, admin bisa review.

### Scope
- Public active program listing
- Public program detail
- Simple dynamic registration form
- Supabase migration for registration_forms, registration_form_fields, applicants, applicant_answers, applicant_program_choices
- Admin applicant list
- Applicant detail review panel
- Applicant workflow: under_review, revision_requested, accepted, rejected

### Files Changed
- supabase/migrations/202606240003_phase_3_registration_admission.sql
- src/lib/admission.ts
- src/lib/auth.ts
- src/lib/navigation.ts
- src/app/providers/RefineProvider.tsx
- src/app/providers/accessControlProvider.ts
- src/routes/AppRoutes.tsx
- src/routes/public/ProgramCatalogPage.tsx
- src/routes/public/ProgramDetailPage.tsx
- src/routes/public/ProgramRegistrationPage.tsx
- src/routes/admin/AdminApplicantListPage.tsx
- src/styles/global.css

### Result Summary
Implemented public registration and admin admission review. Approval only changes applicant status to accepted; no participant record or participant number is created in this phase.

### Commands Run
```bash
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run build
```

### Issues Found
- Supabase migration was authored but not applied to a remote/local Supabase project from this environment.
- Registration form builder UI is not included; public form reads active registration form fields when available and falls back to default fields.

### Follow-Up Task
Apply Phase 3 migration, activate at least one program, submit a public test registration, then review it from Admin Pendaftaran.

---

## PHASE-4-001

### Date
2026-06-24

### Phase
Phase 4 — Participant ID, Enrollment, Onboarding

### Prompt
Phase 4 — Participant ID, Enrollment, Onboarding. Tujuan: applicant diterima menjadi peserta aktif.

### Scope
- participants and guardian base tables
- batches, classes, halaqahs for basic placement
- enrollments and enrollment status logs
- unique participant number generator
- approve_applicant RPC for applicant → participant + enrollment
- onboarding template/progress/checklist setup
- welcome email placeholder notification log
- WhatsApp group mapping table and learner dashboard display

### Files Changed
- supabase/migrations/202606240004_phase_4_participant_enrollment_onboarding.sql
- src/lib/enrollment.ts
- src/routes/admin/AdminApplicantListPage.tsx
- src/routes/learner/LearnerDashboardPage.tsx
- src/app/providers/RefineProvider.tsx
- supabase/migrations/202606240003_phase_3_registration_admission.sql

### Result Summary
Implemented approval-to-participant flow. Admin approval now creates participant, unique participant number, active enrollment, onboarding checklist, participant role assignment when a matching Auth profile exists, and welcome email placeholder log. Learner dashboard now shows active programs and eligible WhatsApp links.

### Commands Run
```bash
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run build
```

### Issues Found
- Supabase migration was authored but not applied to a remote/local Supabase project from this environment.
- Batch/class/halaqah tables and assignment are supported, but UI to create those placement records is still minimal/not built as a full academic structure module.

### Follow-Up Task
Apply Phase 4 migration, create placement records if needed, approve a test applicant, then login as the participant user to verify enrollment and WhatsApp visibility.

---

## PHASE-5-001

### Date
2026-06-24

### Phase
Phase 5 - Program Builder, Batch, Class, Halaqah

### Prompt
Phase 5 - Program Builder, Batch, Class, Halaqah. Tujuan: admin bisa membuat struktur akademik.

### Scope
- Supabase migration for levels, program_modules, lessons, and lesson_prerequisites
- RLS policies for academic builder access and learner lesson visibility
- Admin program builder page for batch, class, halaqah, level, module, lesson, prerequisite, and release date
- Teacher/mentor assignment fields for class and halaqah
- Refine resources and access control for academic resources
- Learner program lesson tree scoped to active enrollments

### Files Changed
- supabase/migrations/202606240005_phase_5_program_builder_academic.sql
- src/lib/academic.ts
- src/lib/auth.ts
- src/lib/navigation.ts
- src/app/providers/RefineProvider.tsx
- src/app/providers/accessControlProvider.ts
- src/routes/AppRoutes.tsx
- src/routes/admin/AdminAcademicBuilderPage.tsx
- src/routes/learner/LearnerProgramLessonsPage.tsx
- docs/PROMPT_LOG.md

### Result Summary
Implemented Phase 5 academic structure foundation. Admin can create batches, classes, halaqahs, levels, modules, and lessons with basic prerequisite and release date fields. Learners can view published/released lessons for their active program enrollments only.

### Commands Run
```bash
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run build
```

### Issues Found
- Supabase migration was authored but not applied to a remote/local Supabase project from this environment.
- Lesson content body, assignment workflows, progress tracking, and completion prerequisites are not implemented yet.

### Follow-Up Task
Apply Phase 5 migration, create test academic records from `/admin/akademik`, publish a lesson, then login as a participant to verify `/learner/program-saya`.

---

## PHASE-6-001

### Date
2026-06-24

### Phase
Phase 6 - Content dan Document Library

### Prompt
Phase 6 - Content dan Document Library. Tujuan: materi teks/dokumen bisa dikelola. Uji kecil dulu dan jangan campur dengan modul lain.

### Scope
- Lesson content editor sederhana
- document_files metadata table
- RLS for staff-managed content and enrolled learner access
- Signed upload/download Edge Function for private Contabo S3-compatible storage
- Admin/teacher content UI for text, external links, and private file upload
- Learner lesson UI for text, link, and signed file opening

### Files Changed
- supabase/migrations/202606240006_phase_6_content_document_library.sql
- supabase/functions/document-signed-url/index.ts
- env.example
- src/lib/academic.ts
- src/lib/documents.ts
- src/lib/auth.ts
- src/lib/navigation.ts
- src/app/providers/RefineProvider.tsx
- src/app/providers/accessControlProvider.ts
- src/routes/AppRoutes.tsx
- src/routes/admin/AdminAcademicBuilderPage.tsx
- src/routes/learner/LearnerProgramLessonsPage.tsx
- docs/PROMPT_LOG.md

### Result Summary
Implemented a small Phase 6 POC for content and private document library. Admin/teacher can save lesson text, external links, and upload private files through signed upload URLs. Learners can only see active lesson files through their enrollment and open files through signed download URLs.

### Commands Run
```bash
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run build
```

### Issues Found
- Supabase migration and Edge Function were authored but not deployed/applied from this environment.
- Upload cleanup for orphaned S3 objects after metadata insert failure is not implemented in this POC.
- Rich text editor, file versioning, virus scanning, transcoding, and progress/completion tracking are intentionally out of scope.

### Follow-Up Task
Apply Phase 6 migration, deploy `document-signed-url`, set Contabo S3 secrets, then test one PDF upload and one learner signed download before adding richer content features.

---

### Date
2026-08-20

### Phase
Assessment Enhancement - Essay Quiz and Manual Grading

### Prompt
Kembangkan kuis/ujian tipe esai, impor soal esai, pemeriksaan dan pemberian nilai oleh admin, serta penyesuaian portal peserta dan navigasi.

### Scope
- Soal esai pada bank soal dan kuis
- Impor teks massal dengan panduan penilaian dan bobot poin
- Submit ujian melalui RPC tervalidasi dan penilaian pilihan ganda di server
- Antrean penilaian admin, superadmin, pengajar, dan musyrif
- Nilai serta umpan balik per jawaban esai
- Draf jawaban lokal dan status menunggu penilaian di portal peserta

### Commands Run
```bash
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
```

### Result Summary
Alur kuis kini mendukung campuran pilihan ganda dan esai. Jawaban esai menunggu koreksi manual, sedangkan peserta menerima nilai final dan umpan balik setelah penilai menyimpan hasil.

### Follow-Up Task
Apply migration `202608200001_essay_quiz_manual_grading.sql` ke Supabase, lalu uji satu ujian campuran end-to-end dengan akun peserta dan akun penilai.

---

## AUTH-UX-001

### Date
2026-10-30

### Prompt
Redesign dan revamp halaman login agar lebih seamless dan menggambarkan LMS, tanpa tab peran.

### Result Summary
- Satu form email/kata sandi untuk seluruh peran; dashboard mengikuti peran akun yang telah ditetapkan.
- Seluruh URL login lama tetap membuka form yang sama, dengan `/auth/login` sebagai pintu masuk utama.
- Tampilan dua kolom dengan pengenalan pembelajaran, halaqah, tugas, dan progres; tampilan ringkas di ponsel.
- Pendaftaran peserta melalui tautan, tanpa tab masuk/daftar. Google tetap khusus alur peserta.
- CAPTCHA, reset sandi, dan backend authorization tetap menggunakan implementasi yang tersedia.
- Akun dengan beberapa peran mengikuti prioritas primaryRole yang sudah ada; pemilih ruang kerja setelah login tidak termasuk perubahan ini.

### Files Changed
- src/routes/auth/LoginPage.tsx
- src/routes/AppRoutes.tsx
- src/styles/global.css
- docs/PROMPT_LOG.md

### Validation
- `npm run lint`: berhasil, 0 error; 11 warning pada file lain.
- `npm run typecheck`: berhasil.
- `npm run build`: berhasil.
- Preview desktop dan perpindahan masuk/daftar/lupa sandi diperiksa melalui browser.
- Login end-to-end belum diuji: konfigurasi Supabase dan Turnstile lokal belum tersedia.

## AUTH-LOCAL-002 — 2026-10-30
- Permintaan: nonaktifkan Turnstile untuk login localhost.
- Menambahkan `VITE_DISABLE_TURNSTILE`, berlaku hanya pada Vite development dan hostname loopback.
- `.env.local` mengaktifkan opsi tersebut; build produksi tetap mewajibkan CAPTCHA.
- Form masuk, daftar, dan reset sandi tidak mengirim token CAPTCHA saat opsi lokal aktif.
- Browser localhost diverifikasi: panel CAPTCHA hilang dan tombol Masuk aktif.
- Lint: 0 error, 11 warning sebelumnya. Build mencakup typecheck.
- Konfigurasi CAPTCHA Supabase tidak diubah; anon key masih perlu diisi untuk autentikasi sungguhan.

## AUTH-LOCAL-003 — 2026-10-30
- Permintaan: lengkapi konfigurasi Supabase untuk admin dan peserta di localhost.
- URL proyek dan anon key dicocokkan dengan konfigurasi frontend publik aplikasi YPIA yang berjalan.
- `.env.local` diisi dengan anon key (role JWT `anon`, project ref sesuai); tidak menggunakan service_role di frontend.
- Redirect origin localhost dan penonaktifan Turnstile lokal dipertahankan.
- `.env.local` dipastikan diabaikan Git.

## ADMIN-UX-001

### Date
2026-10-31

### Prompt
Implementasi hasil review UI/UX portal admin: navigasi ringkas, warna fungsional, komponen bersama, dan wizard mudah tanpa teks dekoratif berlebihan.

### Result Summary
- Sidebar admin disederhanakan menjadi kelompok Utama, Akademik, dan Operasional; submenu duplikat diganti navigasi lokal ringkas.
- Memperbaiki highlight submenu berbasis query dan perilaku buka/tutup submenu aktif.
- Header workspace mengikuti modul aktif. Dialog menu seluler mendukung focus containment, Escape, serta pengembalian fokus.
- Dashboard membaca jumlah pendaftar untuk review, program draf/aktif, dan transaksi pending sesuai peran pengguna. Kegagalan query ditampilkan sebagai data belum tersedia, bukan nol.
- Halaman pendaftaran/peserta membuka daftar kerja secara default; ringkasan tetap tersedia melalui query tab=overview.
- Header halaman peserta, program, dan pendaftaran dipadatkan dengan komponen PageHeader/SectionNav bersama.
- Detail program menggunakan breadcrumb dan navigasi ringkas menggantikan sidebar kedua dan banner berulang.
- Wizard buat/edit program: Identitas → Pembelajaran → Pengaturan → Tinjau. Pembuatan awal menyimpan draf; unit, field wajib, dan nominal SPP divalidasi.
- Dialog program memakai native modal dialog dengan Escape/fokus keyboard. Fitur terlarang dan konfigurasi non-boolean tidak muncul sebagai checkbox.
- Tautan program, laporan program, serta detail peserta mengikuti konteks admin atau superadmin.
- Preview desktop dan seluler dijalankan dengan fixture lokal terisolasi; fixture dihapus setelah pengujian. Tidak ada perubahan data Supabase atau bypass login aplikasi.

### Validation
- Lint: 0 error, 11 warning yang sudah ada.
- Empat pengujian navigasi lulus: root dashboard, batas path, query submenu, dan route alternatif.
- Browser fixture: direktori default, wizard 4 langkah, validasi field wajib, penyimpanan contoh, pemulihan fokus, menu seluler + Escape, dan layout empty state seluler.
- Perintah test: `node --experimental-strip-types tests/navigation.test.mjs` (Node 22).
- Integrasi database dan login nyata belum dapat diverifikasi karena endpoint Supabase belum tersedia.
- `npm run build` berhasil (mencakup TypeScript typecheck), 2931 modul ditransformasi.
- Server aplikasi utama dijalankan kembali pada localhost:5173. Screenshot fixture: ../admin-dashboard-preview.png.

## LEARNER-UX-001

### Date
2026-10-31

### Prompt
Implementasikan revamp portal peserta sesuai hasil review, mulai dari progres belajar, layout ujian, navigasi, dan beranda.

### Result Summary
- RPC `complete_learning_lesson` memvalidasi pengguna, peserta/enrollment/program aktif, materi terbit dan waktu rilis, serta prasyarat. Menyimpan progres secara idempoten dan mencatat audit. Penilaian/presensi tidak bisa dilewati melalui RPC ini.
- Tombol penyelesaian materi menunggu hasil RPC sebelum melanjutkan. Jika gagal, tetap pada halaman materi. Urutan materi mengikuti modul dan prasyarat; semua materi selesai mengarah ke hasil, bukan materi pertama.
- Ringkasan progres dipakai bersama oleh beranda dan daftar program. Kegagalan membaca progres tidak dianggap sebagai progres nol.
- Beranda memprioritaskan program aktif/materi berikutnya; pengumuman dibuka seperlunya dan katalog ditempatkan dalam bagian terlipat.
- Identitas peserta simulasi dihapus; akun yang belum terhubung diarahkan ke pendaftaran/bantuan.
- Navigasi mobile: Beranda, Program, Pembayaran, Akun. Layanan pendaftaran/bantuan tetap tersedia di menu dan halaman akun.
- Layout fokus ujian menyembunyikan sidebar/header/navigasi bawah aplikasi sehingga tidak menutupi tombol kirim.
- Percobaan baru menunggu konfirmasi Mulai; percobaan berjalan dilanjutkan dengan sisa waktu berdasarkan waktu mulai server.
- Konfirmasi kirim/keluar memakai dialog; ada indikator penyimpanan draf dan peringatan saat menutup halaman.
- Memperbaiki race autosave yang sebelumnya dapat menimpa draf kosong sebelum pemulihan selesai. Pemulihan pilihan ganda dan esai diuji melalui keluar/masuk kembali.
- Timer yang sudah habis saat membuka kembali percobaan memicu pengumpulan satu kali. Kegagalan kirim ditampilkan tanpa menghapus draf.
- Komponen progres memiliki atribut aksesibilitas dan batas nilai 0–100.

### Validation
- Enam tes learning progress lulus: urutan modul, hitungan unik/lingkup program, prasyarat, program kosong, status started, serta pengecualian assessment/presensi.
- Browser fixture desktop/mobile: beranda, progres 33% → 67% setelah menyelesaikan materi, navigasi 4 item, persiapan ujian tanpa membuat attempt, pengisian draf, keluar dan pemulihan jawaban/waktu, konfirmasi kirim, serta status menunggu penilaian esai.
- Fixture menggunakan endpoint dan identitas lokal terisolasi. Berkas entry preview telah dihapus; autentikasi aplikasi utama tidak diubah.
- Lint: 0 error, 11 warning lama. Typecheck lulus.

### Deployment / Remaining Verification
- Terapkan `supabase/migrations/202610310001_complete_learning_lesson.sql` pada proyek YPIA yang aktif sebelum menggunakan penyimpanan progres materi.
- Migration dan aturan server belum dijalankan terhadap PostgreSQL/Supabase nyata karena endpoint proyek belum tersedia. Uji ownership, enrollment hold/inactive, materi draft/future, prasyarat, dan RPC idempotensi pada database sesudah deployment.
- Pemeriksaan akhir `npm run build` berhasil, termasuk TypeScript; 2934 modul ditransformasi. `git diff --check` bersih.


## PARTICIPANT-WORKSPACE-001

### Date
2026-10-31

### Prompt
Review hubungan setiap fitur/subfitur `/system/peserta` dengan modul lain dan implementasikan revamp UI/UX, navigasi, layout, serta wizard yang ringkas dan mudah dipahami.

### Review dan hubungan fitur
| Fitur/subfitur | Hubungan dan hasil revamp |
| --- | --- |
| Direktori, pencarian, filter, pagination | Satu daftar kerja utama; pencarian nama/NIS, status peserta, program aktif, dan kondisi akun tersimpan di URL. Kembali dari detail/transkrip memulihkan filter dan halaman. |
| Ringkasan seluruh peserta | Empat kartu berwarna menjadi filter nyata: semua, aktif, belum ada akun, tanpa enrollment aktif. Status akun tidak disamakan dengan status peserta. Kegagalan membaca angka ditampilkan —. |
| Profil dan biodata | Identitas/kontak/jenis peserta tetap memakai data peserta dan profil akun. Edit biodata tetap tersedia di detail. Field tanggal lahir pada pembuatan dihapus karena RPC yang ada tidak menerima field tersebut; tidak lagi mengumpulkan data yang tidak tersimpan. |
| Akun dan akses | Akun terhubung menampilkan pengelolaan akses lewat RPC reset yang sudah ada; peserta tanpa user_id tidak mendapat tombol reset aktif. Akun/peran diarahkan ke `/system/pengguna`; konteks admin biasa ke bantuan, tanpa tautan pengguna yang tidak tersedia. |
| Aktivitas login | RPC aktivitas tetap dipakai; kegagalan membaca ditampilkan Belum tersedia, akun tidak terhubung sebagai Belum ada akun. |
| Program dan akademik | Nama program pada direktori menuju peserta program; detail akademik menunjukkan enrollment, status, penempatan, dan transkrip. Pemilihan program meneruskan NIS ke dialog tambah peserta program yang sudah ada; tidak otomatis mendaftarkan atau mengaktifkan ulang enrollment lama. |
| Kelas/angkatan/halaqah | Kebutuhan penempatan mengikuti curriculum_model program. Tindak lanjut mengarah ke pengaturan penempatan program; program mandiri tidak dipaksa memiliki kelas. |
| Wali | Tautan ringkas ditampilkan untuk peserta anak; dialog tautkan/buat wali tetap tersedia di detail. Kelengkapan wali hanya diwajibkan bagi anak. Penghapusan hanya melepas relasi wali sesuai perilaku sebelumnya. |
| Kontak | Kartu kontak tetap memakai data nyata; tindakan kontak manual tetap tersedia. Tidak ada pesan yang dikirim dalam pengujian. |
| Tambah peserta | Wizard Profil → Akun & program → Tinjau. Pilihan program memakai nama/kode aktif, program opsional. Validasi dan payload sama dengan impor; RPC pembuatan yang sudah ada tetap digunakan. Respons tanpa participant_id tidak dianggap berhasil. |
| Impor CSV | Unggah → Periksa → Impor → Hasil; batas 2 MB/1.000 baris, deteksi header/format/duplikat, validasi baris sebelum simpan. Hasil membedakan akun baru/lama/gagal, bisa membuka detail hasil, mengunduh laporan tanpa sandi, dan mengulang baris gagal saja. |
| Transkrip per enrollment | Diakses dari akademik, tombol kembali eksplisit ke peserta dan mempertahankan konteks direktori. |
| Template transkrip | Alat & dokumen → template global → identitas/tanda tangan/pratinjau. Perilaku penyimpanan pengaturan dan upload tanda tangan lama dipertahankan; tipe/ukuran gambar dibatasi, dialog serta label diringkas. |
| Admisi | Ringkasan/alat menyediakan tautan review pendaftar. Pendaftaran tetap dikelola di modul admisi, terhubung ke alur profil → program → nilai/transkrip. |
| Navigasi dan seluler | Sidebar hanya satu entri Peserta; navigasi bagian menggunakan komponen bersama. Detail tidak lagi memakai sidebar kedua/banner besar. Tabel berubah menjadi kartu berlabel pada layar kecil, modal mendukung Escape dan pemulihan fokus. |

### Result Summary
- Komponen tambah, impor, akses, template transkrip, dan pemilih program dipisah dari halaman direktori agar alur dapat dirawat terpisah.
- Request direktori memakai cancellation dan detail mengabaikan respons usang agar perpindahan peserta tidak menampilkan data sebelumnya.
- Peserta tidak aktif tidak mendapat tindakan tambah program aktif. Kelengkapan memperhitungkan enrollment aktif dan penempatan setiap program terjadwal.
- Kata sandi tidak ditampilkan pada tinjauan atau laporan impor. Pencarian membuang separator PostgREST; nomor induk otomatis memakai UUID.
- Tidak menambah dependency, schema, migration, atau mengubah autentikasi/otorisasi pada pekerjaan ini. RPC dan mekanisme upload yang telah ada dipertahankan.

### Validation
- Lint lulus: 0 error, 9 warning lama. `npm run build` lulus, termasuk TypeScript typecheck; 2940 modul. `git diff --check` bersih.
- Empat tes navigasi juga lulus; total 10 tes.
- Enam tes `tests/participant-directory.test.mjs` lulus: program opsional, duplikat CSV, program tidak aktif, normalisasi email/preservasi sandi, pagination tidak valid, dan sanitasi pencarian.
- Browser dengan fixture lokal terisolasi: filter akun belum terhubung, reset dinonaktifkan, query detail/kembali, pagination halaman kedua, wizard tambah, template transkrip, pemilih program hingga dialog program dengan NIS yang sesuai.
- Tampilan desktop dan seluler 390 px diperiksa; screenshot tersimpan di luar repo: `../system-participants-preview.png` dan `../system-participants-mobile.png`. Angka/identitas screenshot adalah contoh lokal.
- Fixture entry dan server pengujian dibersihkan setelah QA; autentikasi aplikasi utama tidak dibypass.

### Remaining Verification
- Endpoint Supabase YPIA yang dikonfigurasi sebelumnya belum tersedia. Operasi tulis nyata (buat/impor/reset, wali, enrollment, pengaturan/tanda tangan) tidak dijalankan.
- Periksa query anti-join enrollment aktif, hitungan/filter, relasi dan cakupan RLS pada proyek aktif; lanjutkan uji RPC dan upload terhadap data uji sesudah koneksi Supabase pulih.


## PARTICIPANT-WORKSPACE-002

### Date
2026-10-31

### Prompt
Lanjutkan review dan implementasi halaman peserta, termasuk pemeriksaan integrasi dan alur simpan.

### Findings and Changes
- Supabase YPIA kembali merespons. `/auth/v1/health` dan `/auth/v1/settings` mengembalikan HTTP 200 memakai anon key yang dikonfigurasi. Relasi direktori dan anti-join enrollment aktif diterima PostgREST (HTTP 200, `limit=0`, tanpa membaca baris pribadi). Temuan ini memperbarui kendala koneksi pada catatan sebelumnya, tetapi belum membuktikan sesi admin atau cakupan data nyata.
- Dashboard proyek meminta login; sesi dashboard belum tersedia untuk menerapkan migration atau memverifikasi data dengan peran admin.
- Fungsi pembuatan/impor sebelumnya selalu memanggil direct enrollment, yang dapat mengosongkan kelas/angkatan/halaqah dan mengaktifkan kembali enrollment hold/completed/cancelled. Migration `202610310002_preserve_participant_enrollment.sql` mempertahankan enrollment yang sudah ada, menormalisasi email, memvalidasi input/program aktif, memeriksa akses program, mengunci akun/peserta untuk pengulangan, memastikan role peserta, dan mencatat audit tanpa sandi.
- Migration yang sama memperbaiki direct enrollment: hanya admin dengan cakupan program atau superadmin, peserta/program aktif, dan penempatan yang cocok. Enrollment yang sudah ada dikembalikan sebagai unchanged; tidak dipakai sebagai jalur edit status/penempatan. Enrollment baru tetap membuat nomor, onboarding dan log status. Kunci baris peserta dipakai bersama oleh impor dan direct enrollment.
- Hasil tambah/impor menunjukkan apakah program ditambahkan atau enrollment/penempatan lama dipertahankan. Hasil penambahan peserta di program membedakan Ditambahkan, Sudah terdaftar, dan Gagal, serta menunggu konfirmasi enrollment_id.
- Perubahan wali sebelumnya terdiri dari beberapa request; pergantian utama bisa berhenti setelah semua wali dibuat nonutama. Migration `202610310003_atomic_participant_guardians.sql` menyediakan RPC transaksi attach/primary/detach dengan pemeriksaan admin/cakupan, relasi milik peserta, profil aktif, dan larangan memakai akun peserta sendiri sebagai wali.
- Tautan wali bersifat idempoten; melepas wali utama mempromosikan wali tersisa tanpa menghapus akun/rekaman wali. Audit dicatat dalam transaksi yang sama. Policy baca wali yang sebelumnya tidak tersedia ditambahkan untuk superadmin/admin dalam cakupan, tanpa membuka write langsung.
- Detail peserta memakai RPC wali dan dialog konfirmasi lokal untuk melepas tautan. Tidak ada kata sandi yang diubah, akun nyata yang dibuat, enrollment nyata yang diubah, maupun migration yang diterapkan ke proyek jauh dalam sesi ini.

### Validation
- Tujuh tes helper peserta lulus, termasuk interpretasi hasil save dan penolakan respons tanpa konfirmasi.
- Tujuh tes transaksi PostgreSQL terisolasi lulus: preservasi lima status enrollment beserta penempatan/sandi, provisioning/identity/role/onboarding/audit, penolakan program/role tidak sah, idempotensi relasi wali, pergantian/penghapusan wali utama, rollback kegagalan dan penolakan relasi lintas peserta, RLS/cakupan admin, serta direct enrollment yang tidak mengaktifkan kembali enrollment batal.
- Engine tes PostgreSQL WASM (`@electric-sql/pglite`) dipasang di `/tmp/ypia-sql-check`, bukan dependency aplikasi. Fixture menggantikan helper konteks auth/cakupan dan pgcrypto; tes tidak memverifikasi hashing atau layanan Supabase Auth nyata. Tabel/kontrak minimal tidak menggantikan pengujian migration penuh di Supabase staging.
- Menjalankan tes SQL: `PGLITE_MODULE=/tmp/ypia-sql-check/node_modules/@electric-sql/pglite/dist/index.js node tests/participant-transactions.test.mjs` setelah memasang paket tersebut di lokasi tes sementara.
- Lint: 0 error dan 9 warning lama. Build berhasil (2940 modul); typecheck akhir dan pemeriksaan whitespace dijalankan setelah perubahan terakhir.
- Server aplikasi tersedia di localhost:5173; halaman login dapat dibuka melalui browser.

### Deployment / Remaining Verification
- Terapkan kedua migration baru secara berurutan pada Supabase staging/proyek yang benar sebelum memakai pengelolaan wali baru. Jangan menjalankan ulang migration lama yang berisi reset sandi massal.
- Setelah tersedia sesi dashboard/admin: periksa data/filter/count di bawah JWT dan RLS nyata, uji akun uji tambah/impor dan penempatan, edit wali, reset sandi, template serta upload tanda tangan. Pemeriksaan `limit=0` hanya membuktikan schema/query diterima, bukan hasil atau akses admin.


## PARTICIPANT-WORKSPACE-003 — Supabase deployment

### Date
2026-10-31 (Asia/Jakarta)

### Authorization and target
- Pengguna masuk ke dashboard dan menyetujui secara eksplisit: “Terapkan dua migration”. Persetujuan diminta tepat sebelum perubahan hak akses wali dijalankan.
- Organisasi **YPIA**, proyek **BelajarLMS1**, branch **main**, ref `foauntgtmhnhqlspgtoc`; cocok dengan endpoint `.env.local`, status Healthy.

### Preflight and deployment
- Schema tabel terkait dan seluruh helper fungsi yang diperlukan telah diperiksa melalui SQL read-only pada proyek nyata.
- Memastikan tidak ada policy pada guardians/guardian_participants sebelum penerapan. Mencadangkan tiga definisi fungsi lama (termasuk overload pembuat peserta 9 argumen) dan ACL yang terpasang.
- Menjalankan `202610310002_preserve_participant_enrollment.sql` dan `202610310003_atomic_participant_guardians.sql` melalui SQL Editor dalam satu transaksi dengan lock_timeout 5 detik, statement_timeout 60 detik, dan notifikasi reload schema PostgREST.
- Hasil dashboard: **Success. No rows returned**. Tidak membuat akun uji, tidak mengubah sandi, tidak menjalankan ulang migration lama atau reset sandi massal.
- Penerapan dilakukan manual melalui SQL Editor; riwayat Supabase CLI migrations tidak diubah. Jangan menjalankan seluruh migration lama dengan db push tanpa rekonsiliasi riwayat karena ada migration lama dengan reset sandi massal.

### Production verification
- **10 pemeriksaan lulus** melalui query read-only setelah commit.
- Hash isi ketiga fungsi target identik dengan file lokal; ketiganya tetap SECURITY DEFINER dengan pemeriksaan role/cakupan di dalam fungsi.
- Role anon tidak dapat mengeksekusi ketiga fungsi target; authenticated mendapat EXECUTE dengan pembatasan admin/cakupan di server. Overload lama 9 argumen tidak diubah pada pekerjaan ini.
- Kedua policy SELECT wali tersedia untuk authenticated, dan RLS tetap aktif pada kedua tabel.
- Jumlah data sebelum/sesudah sama: **523 peserta, 1.064 enrollment, 1 wali, 2 tautan wali, 552 akun Auth**.
- Bukti fungsi asli, ACL, paket penerapan, skrip rollback, SQL/JSON verifikasi dan receipt disimpan di `../backups/ypia-participant-*-20261031.*` (di luar Git). Screenshot hasil: `../ypia-migration-success.png`.
- Satu query verifikasi sempat mengalami kesalahan sintaks akibat penggantian isi editor yang menyisakan teks lama. Query read-only tersebut diperbaiki melalui select-all/paste dan diverifikasi melalui clipboard sebelum dijalankan ulang; tidak mengubah data.

### Remaining verification
- Penerapan backend sudah selesai. Uji alur aplikasi dengan login admin/peserta nyata serta pengujian tulis terhadap akun/data uji belum dilakukan pada sesi penerapan ini. Pengujian transaksi lokal terdahulu tetap menjadi bukti perilaku; tidak disamakan dengan pengujian menyeluruh aplikasi produksi.


## PROGRAM-WORKSPACE-001 — Review, revamp, dan integrasi program

### Date / scope
2026-10-31 (Asia/Jakarta). Permintaan pengguna: meninjau setiap fitur `/system/program`, menghubungkan alur antarfitur, dan menerapkan UI ringkas, berwarna, mudah dipahami serta wizard yang jelas. Perubahan peserta yang sudah ada dipertahankan; tidak melakukan push/merge pada pekerjaan ini.

### Review fitur dan hubungan
| Area | Subfitur dan kaitan | Temuan / hasil revamp |
| --- | --- | --- |
| Direktori | Pencarian, status, model, unit, urutan, kartu/tabel, pagination, ekspor, arsip/pulihkan | Filter dan posisi halaman disimpan di URL; tautan detail membawa konteks kembali. Metrik menjadi filter; hitungan enrollment aktif berbeda dari total enrollment. Ekspor memakai hasil filter dan escape formula CSV. Pulihkan kembali ke draf. |
| Identitas | Unit, kode, nama, deskripsi, pengampu, status | Form buat/edit bersama dalam empat langkah: Identitas → Pembelajaran → Fitur & biaya → Tinjau. Nama/kode/unit wajib, kegagalan tidak menutup atau menghapus isian. Program baru berstatus draf. |
| Model dan fitur | Mandiri/terjadwal, daring/luring/gabungan, SPP/gratis, pendaftaran, sertifikat | Pembayaran dinormalisasi agar flag dan nominal konsisten; tidak menambahkan payment gateway. Toggle yang tidak mempunyai consumer fungsional di aplikasi tidak dipromosikan di wizard; nilai lama tetap dipertahankan. Larangan AI/audio/video upload MVP tetap berlaku. |
| Ringkasan | Profil, materi terbit, evaluasi, enrollment aktif, kelas, kelengkapan pengaturan | Setiap metrik dan daftar kelengkapan mengarah ke bagian terkait. Persentase menunjukkan kelengkapan pengaturan, bukan jaminan kelayakan publikasi/kelulusan. |
| Silabus | Editor, template, pratinjau, simpan | Lebih ringkas; konfirmasi sebelum menimpa dengan template; draf per pengguna/program bertahan saat navigasi SPA. |
| Struktur belajar | Level, mata pelajaran/modul, materi, urutan, publikasi | Form terkelompok memakai dialog native. Materi baru draf; kuis baru dibawa ke pengelolaan soal dan tidak bisa langsung diterbitkan tanpa soal. Modul dapat dibuka dengan keyboard. |
| Materi dan ujian | Jenis materi, sumber eksternal, lampiran dokumen, jadwal, skor lulus, durasi, kesempatan, acak, pembatasan tab | Wizard tiga langkah dengan validasi angka, URL dan file; waktu lokal benar. Retry setelah kegagalan lampiran mempertahankan ID materi/sumber agar tidak membuat materi duplikat; dokumen lama tidak dihapus sebelum sumber baru terkonfirmasi. Upload audio/video ditolak. |
| Bank soal | Bank, soal pilihan ganda/esai, edit, hapus, impor teks, impor ke kuis | Tombol edit berfungsi di bank maupun kuis. Mendukung opsi A–E, opsi berbeda, kunci yang benar-benar ada, bobot positif; impor memakai pemeriksaan sama. Pengambilan bank dibatasi program aktif yang dikelola. Penghapusan memakai dialog konfirmasi. |
| Pendaftaran | Form/direk, judul, periode, pertanyaan, grup komunitas, tautan publik, antrean pendaftar | Ditambahkan ke workspace program; tautan review memilih program yang sama. Membuka halaman tidak otomatis membuat record. Periode dan grup dalam panel lipat; teks teknis/dekoratif dikurangi; field dokumen tidak menjanjikan audio. Validasi judul/periode/pilihan pertanyaan sebelum simpan. |
| Angkatan, kelas, halaqah | Buat/edit, tanggal, kapasitas, pengajar/mentor, status | Relasi angkatan → kelas → halaqah jelas; edit tersedia untuk ketiganya. Kelas lama tetap terlihat walaupun model program kemudian mandiri. |
| Peserta program | Cari/filter status, tambah enrollment, detail, transkrip, penempatan, CSV | Metrik ringkas menjadi filter. Penempatan ditampilkan langsung dalam roster; tombol Atur kelas terhubung ke wizard dan kembali memperbarui daftar. Tambah enrollment memakai RPC yang mempertahankan enrollment lama (migration peserta sebelumnya). |
| Penempatan | Pilih peserta → pilih angkatan/kelas/halaqah → tinjau | RPC transaksi khusus, bukan re-enrollment. Hanya admin/superadmin dalam cakupan; validasi status, hierarki, kapasitas dan audit. Status, nomor enrollment, pembayaran, dan progres tidak direset. Tautan dari detail peserta `placeEnrollment` terhubung ke wizard ini. |
| Laporan belajar | Progres materi terbit, rata-rata evaluasi selesai, predikat, filter, transkrip, ekspor | Perhitungan helper bersama dengan kelulusan. Draf/lesson asing dan evaluasi belum selesai tidak menaikkan skor. Nilai 0 dibedakan dari belum dinilai. Error pemuatan tidak ditampilkan sebagai data nol. |
| Kelulusan | Kriteria, rubrik, kelayakan, konfirmasi lulus, detail peserta | Kriteria dilipat ketika sudah ada; penetapan dinonaktifkan saat data gagal/masih dimuat/kriteria belum disimpan. Progress diambil dalam batch. Peserta nonaktif, enrollment hold/pending, dan materi/evaluasi belum memenuhi syarat tidak dapat ditetapkan lewat UI. Nilai dan predikat hasil kelulusan yang sudah disimpan dipertahankan. |
| Sertifikat dan lintas menu | Program → kelulusan → kelayakan sertifikat; peserta → akademik/transkrip; pendaftaran → review | Program diteruskan sebagai query dan dipilih setelah metadata siap. Menekan tautan sertifikat tidak menerbitkan sertifikat otomatis. Navigasi baru pendaftaran/laporan/pengaturan/penempatan tidak ditawarkan pada workspace pengajar. |

### Backend deployment
- Pengguna secara eksplisit menyetujui “Terapkan migration penempatan” setelah paket siap ditinjau. Target diverifikasi: **YPIA / BelajarLMS1 / main**, ref `foauntgtmhnhqlspgtoc`.
- Preflight read-only: fungsi penempatan belum ada; helper dan kolom terkait tersedia; 523 peserta, 1.064 enrollment, 2 kelas, 2 halaqah.
- `202610310004_enrollment_placement.sql` diterapkan melalui SQL Editor dalam satu transaksi, lock timeout 5 detik, statement timeout 60 detik, reload schema PostgREST. Hasil: **Success. No rows returned**.
- Sembilan pemeriksaan live lulus: MD5 prosrc sama (`2de0f7ccc9bb27fe16a98a92ea54fb3f`), SECURITY DEFINER/search_path tepat, EXECUTE anon ditolak, authenticated tersedia dengan pemeriksaan admin/cakupan di fungsi, dua indeks tersedia, serta seluruh hitungan di atas tetap sama. Tidak menempatkan peserta nyata atau mengubah sandi/akun/progres.
- Paket apply, rollback, preflight, verifikasi dan receipt berada di `../backups/ypia-program-*-20261031.*`; screenshot commit `../ypia-program-placement-success.png`. Riwayat Supabase CLI tidak diubah karena penerapan manual; jangan menjalankan seluruh migration lama dengan db push sebelum rekonsiliasi (terdapat migration lama yang mereset sandi massal).

### Validation
- 7 tes helper Program lulus: konteks navigasi aman, normalisasi fitur/biaya, checklist, validasi materi/file, progres/score nol, dan impor soal.
- 5 tes transaksi PostgreSQL terisolasi lulus: lifecycle/idempotensi, role/cakupan/hierarki, enrollment historis, kapasitas kelas/halaqah dan rollback audit. Pending/hold memakan kursi, completed tidak; perubahan dalam kelas sama tidak menghabiskan kursi baru. Engine PGlite hanya di `/tmp`, bukan dependency aplikasi.
- Tes regresi helper progres belajar, navigasi, serta direktori peserta dijalankan dan lulus.
- QA browser memakai fixture lokal tanpa bypass auth aplikasi utama: navigasi dan konteks kembali, draf silabus lintas bagian, kegagalan simpan wizard, retry materi parsial, edit soal kuis, edit angkatan, penempatan dan refresh roster dengan status hold tetap, no-write sebelum Buat formulir, pembedaan skor nol/belum dinilai di laporan dan kelulusan.
- Layout responsif diperiksa pada lebar 390 dan 1280 piksel. Screenshot di `../system-program-*.png` memakai data contoh, bukan data pribadi produksi.

### Limits / follow-up verification
- QA UI memakai data contoh; login admin dengan JWT nyata, upload Contabo nyata, dan pengujian tulis terhadap data uji di Supabase belum dilakukan. Verifikasi live di atas membuktikan deployment/schema/ACL, bukan seluruh workflow aplikasi dalam sesi admin nyata.
- Rumus dan otorisasi RPC kelulusan yang sudah ada tidak diganti: backend masih menerima skor/progres yang dikirim admin. Revamp menghitung konsisten dan menambah guard UI; tidak mengklaim perhitungan ulang kelayakan di server.
- Simpan form pendaftaran beserta pertanyaan, serta materi beserta sumber/file, tetap memakai beberapa request; kegagalan parsial dilaporkan dan data untuk retry dipertahankan, bukan transaksi lintas storage.
- Query metadata/enrollment lama masih mengikuti batas baris PostgREST; progress laporan/kelulusan diambil dalam batch. Uji dataset sangat besar dan pembatasan server diperlukan sebelum menganggap semua data berskala besar terwakili.

### Final checks
- `npm run typecheck`: lulus. `npm run build`: lulus, 2.946 modul. `npm run lint`: 0 error, 8 warning lama di luar implementasi Program baru. `git diff --check`: bersih.
- Entry/server fixture dan tab pratinjau sementara sudah dibersihkan; viewport dikembalikan. Tidak menambah dependency, mengubah konfigurasi autentikasi, atau memasukkan fixture ke aplikasi utama. Localhost:5173 merespons HTTP 200 dan halaman login terpadu dapat dibuka; sesi admin nyata belum tersedia untuk QA tulis aplikasi.

## ADMISSION-WORKSPACE-001 — Review dan revamp Pendaftaran

### Date / scope
2026-10-31 (Asia/Jakarta). Meninjau dan mengimplementasikan `/system/pendaftaran`, formulir dalam Program, serta hubungan pendaftar → pilihan program → peserta → enrollment. Perubahan Program/Peserta sebelumnya dipertahankan.

### Review fitur dan hubungan
| Area | Temuan / implementasi |
| --- | --- |
| Ringkasan | Metrik dapat ditekan untuk membuka antrean yang sesuai; jumlah pilihan program dibedakan dari jumlah orang. Satu filter Program berlaku di ringkasan, antrean, dan formulir. |
| Antrean | Pencarian, status, urutan, pagination dan detail tersimpan di URL. Data dibaca per 500 baris dengan pembatalan request. Kegagalan tidak disajikan sebagai angka nol. CSV mengikuti filter dan mengamankan formula spreadsheet. |
| Identitas dan jawaban | Drawer dibuka berdasarkan ID pilihan program, bukan ID orang. Jawaban memakai label pertanyaan; pertanyaan arsip diberi fallback yang jelas. Unduhan dokumen memakai URL bertanda tangan 60 detik. |
| Review | Catatan internal dapat disimpan terpisah. Wizard keputusan mewajibkan alasan revisi/tolak, memeriksa versi data, serta menampilkan konfirmasi. Tidak mengirim catatan internal melalui email/WhatsApp. |
| Penerimaan dan penempatan | Program terjadwal memakai pilihan angkatan → kelas → halaqah. RPC memeriksa cakupan, hierarki, kapasitas dan audit dalam transaksi. Enrollment lama termasuk hold/completed/cancelled dipertahankan; tidak mereset progres atau penempatan. |
| Identitas akun | Pencocokan berdasarkan email yang tervalidasi, bukan nama. Penerimaan tidak membuat Auth user atau mengubah sandi. Peserta tanpa akun diberi informasi bahwa penautan akun masih diperlukan. Hasil diterima mengarah ke profil akademik peserta/enrollment yang tepat. |
| Formulir dan undangan | Editor bersama di Pendaftaran dan Program: Pengaturan → Pertanyaan → Grup → Tinjau. Tidak ada penulisan saat membuka halaman. Validasi periode, jenis pertanyaan, opsi, URL dan kapasitas; draf lokal per pengguna/program; urutan pertanyaan dan penandaan wajib. Tautan grup yang sudah diklaim dilindungi dari penggantian/pergeseran indeks. |
| Publik dan peserta | Pemilihan formulir efektif mengikuti RPC submit: formulir program terbuka, global terbuka, lalu jadwal aktif yang sesuai. Formulir aktif lama tetap terlihat bila versi terbaru masih draf. Lookup publik memerlukan nomor telepon penuh; lookup peserta hanya boleh membaca identitas sendiri. Audio/video ditolak di form publik. |

### Backend deployment
- Pengguna menyetujui **“Terapkan dua migration Pendaftaran”** untuk `202610310005_admission_review.sql` dan `202610310006_atomic_admission_forms.sql`. Target **YPIA / BelajarLMS1 / main**, ref `foauntgtmhnhqlspgtoc`.
- Cadangan definisi fungsi/ACL dan pemeriksaan helper 002/004 dilakukan sebelum penerapan. Paket dijalankan sebagai satu transaksi dengan timeout dan reload PostgREST; dashboard mengonfirmasi **Success. No rows returned**.
- Pilihan program mendapat status review sendiri dengan backfill identik status lama. Simpan formulir beserta pertanyaan, flag dan audit menjadi satu transaksi; menyimpan versi aktif mengarsipkan versi aktif program lainnya.
- Migration pendamping `202610310007_owned_admission_status.sql` memperbaiki fungsi lookup yang sudah ada: `auth.uid()` wajib cocok dengan pengguna dan email profil sendiri. Tidak menambah akses; anon tetap ditolak.
- Hash fungsi, SECURITY DEFINER/search_path, ACL, RLS dan backfill diverifikasi read-only. Jumlah data tetap: **46 pendaftar, 50 pilihan program, 523 peserta, 1.064 enrollment, 62 formulir, 1 pertanyaan, 1 klaim grup**. Tidak menerima pendaftar nyata, membuat akun, mengubah sandi atau enrollment pada saat deployment.
- Bukti apply, cadangan, verifikasi dan receipt: `../backups/ypia-admission-*-20261031.*`; screenshot `../ypia-admission-migration-success.png`. Penerapan manual tidak memperbarui riwayat Supabase CLI; rekonsiliasikan sebelum db push, jangan menjalankan migration lama yang mereset sandi massal.

### Validation / limits
- 5 tes helper dan 10 tes transaksi PostgreSQL terisolasi mencakup keputusan per pilihan, stale update, role/cakupan, identitas tidak digabung karena nama, idempotensi, pelestarian lifecycle, rollback kapasitas/audit, atomic form, klaim grup dan lookup sendiri.
- QA browser memakai fixture lokal: keputusan gagal tetap menyimpan isian; revisi dan penerimaan contoh; draf formulir dipulihkan lintas navigasi SPA; urutan pertanyaan, grup terkunci, kegagalan simpan dan retry; editor bersama di Program; tautan kembali dan mobile 390px tanpa luapan horizontal.
- Bukti visual `../system-admission-*.png` menggunakan data contoh. JWT admin nyata dan unduhan Contabo positif belum diuji end-to-end. Pengiriman pemberitahuan serta pembuatan akun bukan bagian dari transaksi penerimaan.
- Entri Program di atas mencatat batas implementasi pada saat itu; penyimpanan formulir kini sudah digantikan RPC atomik dan pengambilan data Pendaftaran sudah dipaginasi.

## ASSESSMENT-WORKSPACE-001 — Review dan revamp Penilaian

### Date / scope
2026-10-31 (Asia/Jakarta). Permintaan pengguna meninjau seluruh fitur `/system/penilaian` dan hubungan lintas menu, lalu menerapkan UI ringkas dan wizard. Komponen yang sama juga melayani admin dan pengajar dengan tautan sesuai peran.

### Review fitur dan hubungan
| Area | Temuan / implementasi |
| --- | --- |
| Antrean | Status lama bergantung pada skor kosong sehingga skor parsial dapat menyembunyikan ujian belum dikoreksi. Kini `pending_review` menentukan antrean; skor 0 tetap nilai. Metrik Semua/Perlu dinilai/Di bawah batas dapat ditekan, rata-rata memakai percobaan final terbaru per enrollment/materi. |
| Filter dan ekspor | Program, materi, jenis, status, pencarian, urutan, ukuran dan halaman di URL. Tombol Mulai koreksi menuju ujian tertua dalam cakupan filter. Pengambilan dipaginasi 500 baris, error/retry jelas, ekspor sesuai filter dan escape formula. |
| Progres tugas | Penyelesaian tugas tidak lagi diperlakukan sebagai antrean esai. Ditampilkan sebagai progres tercatat dengan tautan profil/laporan. Tidak membuat fitur pengumpulan/koreksi tugas palsu karena tabel submission belum tersedia dalam alur aplikasi ini. |
| Koreksi esai | Wizard Nilai esai → Umpan balik → Tinjau & finalisasi; satu esai dalam fokus, navigasi nomor, rubrik lipat, jawaban, dokumen, poin dan feedback. Poin kosong wajib diisi, 0 eksplisit, batas sesuai bobot soal. Skor pratinjau menggabungkan poin otomatis dan esai secara berbobot. |
| Draf dan kegagalan | Draf sessionStorage per penilai/attempt berisi poin/feedback, tidak menyalin jawaban peserta atau URL dokumen. Draf dipulihkan setelah navigasi, kegagalan simpan tidak menutup konfirmasi/menghapus draf. Kelengkapan jawaban/lampiran, bobot serta relasi program diperiksa sebelum koreksi. |
| Finalisasi | Ringkasan menampilkan poin setiap soal dan feedback sebelum konfirmasi. Nilai final ditampilkan hanya-baca. RPC yang disiapkan memvalidasi payload lengkap/unik/angka, cakupan penilai, audit atomik, idempotensi, larangan menimpa hasil final, serta progres dari percobaan final terbaru. |
| Lintas menu | Antrean ↔ detail mempertahankan filter. Detail → profil akademik, laporan program, transkrip; laporan program → antrean Penilaian terfilter program yang sama. Tautan pengajar menuju workspace program yang sesuai. Dokumen melalui helper download bertanda tangan yang sudah ada. |
| Layout | Kartu metrik berwarna lembut, status konsisten, tabel menjadi kartu pada ponsel, navigasi soal dan footer wizard responsif. Penjelasan teknis/dekoratif dikurangi. |

### Backend deployment
- Diterapkan `202610310008_final_quiz_review.sql` untuk mengganti fungsi `grade_quiz_attempt` yang sudah ada. Tidak menambah role/akses; finalisasi hanya `pending_review`, pengajar/mentor sesuai penugasan, admin sesuai program. Nilai final tidak dapat diubah dari halaman koreksi.
- Preflight read-only mengonfirmasi definisi lama sesuai repo serta schema pendukung tersedia. Jumlah awal **3 attempt (2 ongoing, 1 pending_review), 2 jawaban, 0 progres materi, 9 audit**. Tidak ada essay legacy berstatus submitted.
- Peninjauan persetujuan otomatis semula menolak tombol Run karena migration Penilaian belum disetujui secara eksplisit. Eksekusi dihentikan; pengguna kemudian menyetujui **“Terapkan migration Penilaian”** untuk paket konkret 008 pada **YPIA / BelajarLMS1 / main**, ref `foauntgtmhnhqlspgtoc`.
- Preflight ulang memastikan definisi lama masih sama setelah normalisasi whitespace dan jumlah data tidak berubah. Isi editor dicocokkan persis dengan paket yang disetujui melalui clipboard sebelum Run. Penerapan satu transaksi dengan lock timeout 5 detik, statement timeout 60 detik serta reload PostgREST menghasilkan **Success. No rows returned**.
- Verifikasi read-only: hash prosrc cocok (`88fd1bc54ea6c5aa46f48767b9771cb1`), SECURITY DEFINER/search_path benar, EXECUTE anon ditolak, authenticated tersedia dengan pemeriksaan role/cakupan dalam fungsi. Jumlah tetap **3 attempt, 2 jawaban, 0 progres materi, 9 audit**. Tidak memanggil RPC penilaian terhadap peserta nyata.
- Paket apply, definisi/ACL lama, emergency disable, predeploy, verifikasi dan receipt tersimpan di `../backups/ypia-assessment-*-20261031.*`; bukti visual `../ypia-assessment-migration-success.png` dan `../ypia-assessment-verification.png`.
- Penerapan manual SQL Editor tidak memperbarui riwayat migration Supabase CLI. Rekonsiliasi diperlukan sebelum db push; jangan menjalankan seluruh migration lama yang mencakup reset sandi massal.

### Validation / limits
- 3 tes helper dan 6 tes PostgreSQL terisolasi: status/skor 0, latest average, poin kosong/weighted score, safe return URL; finalisasi atomik/idempotensi, payload duplikat/asing/null/range, admin/teacher scope, older attempt tidak menimpa progres terbaru, rollback audit dan anon ditolak. Engine uji hanya di `/tmp`, bukan dependency aplikasi.
- QA browser terisolasi: koreksi dua esai 10/20 dan 30/60 + otomatis 20 menghasilkan **60/100**; blank ditolak; kegagalan finalisasi mempertahankan draf; draf pulih dari antrean; retry berhasil dan hasil menjadi hanya-baca. Filter Program bertahan saat kembali. Pemeriksaan mobile 390px tanpa luapan horizontal.
- Screenshot data contoh: `../system-assessment-queue.png`, `../system-assessment-review.png`, `../system-assessment-final.png`, `../system-assessment-mobile.png`, `../system-assessment-mobile-result.png`.
- Tidak mengubah nilai peserta nyata. Belum melakukan QA tulis dengan JWT admin nyata atau unduhan Contabo positif. Snapshot versi soal dan workflow koreksi ulang nilai final belum tersedia; perubahan ini tidak mengklaim keduanya. RLS baca lama tidak diubah oleh revamp.
- Fixture entry/server/tab sementara dibersihkan; autentikasi aplikasi utama tetap dipakai dan viewport dikembalikan. Tidak menambah dependency dan tidak melakukan push/merge.

### Final checks (Pendaftaran + Penilaian)
- `npm run typecheck` lulus; `npm run build` lulus (2.953 modul). `npm run lint`: 0 error, 7 warning lama. `git diff --check` bersih.
- 32 tes helper lintas Pendaftaran, Penilaian, Program, Peserta, progres belajar dan navigasi lulus. Kedua berkas tes transaksi Pendaftaran/Penilaian juga lulus pada engine PostgreSQL terisolasi.
- Localhost:5173 `/system/penilaian` merespons HTTP 200; route tetap dilindungi autentikasi utama. Screenshot pengujian berasal dari fixture terisolasi, bukan sesi admin nyata.

## CERTIFICATE-WORKSPACE-001 — Review dan revamp Sertifikat

### Date / scope
2026-10-31 (Asia/Jakarta). Review seluruh `/system/sertifikat` dan implementasi UI ringkas, navigasi antarmenu, template, kelayakan, antrean, dokumen serta sisi peserta. Permintaan Keuangan yang masuk ketika QA berlangsung dilanjutkan setelah paket Sertifikat siap ditinjau. Tidak melakukan push/merge.

### Review fitur dan hubungan
| Area | Temuan / hasil implementasi |
| --- | --- |
| Navigasi | Hero dan panel workflow dekoratif diganti header ringkas dan navigasi Template → Kelayakan → Antrean & dokumen. Program/angkatan diteruskan antarhalaman, pencarian/status/halaman tercatat di URL. |
| Template | Direktori kartu berwarna, metrik sebagai filter, pencarian, status aktif/arsip dan pagination. Arsip mempertahankan riwayat. Pembukaan editor tidak menulis data. |
| Editor template | Wizard Identitas → Tata letak → Tinjau; form angka menggantikan JSON mentah. Kontrak posisi/ukuran nama serta nomor sesuai renderer PDF. Koordinat 0 tidak menjadi fallback. Mendukung migrasi label koordinat lama, preview posisi A4, PDF latar opsional, validasi batas/angka/path, draf per admin/template dan konfirmasi menutup. HTML tidak dipromosikan sebagai kemampuan renderer karena worker tidak merender HTML. |
| Kelayakan | Wizard Pilih program → Pilih peserta → Tinjau antrean, pilihan peserta eksplisit (tidak otomatis pilih semua). Alasan berbahasa Indonesia terhubung ke kelulusan, pengaturan program, akademik atau antrean. Pencarian, filter, pagination, pilih halaman ini dan CSV sesuai filter dengan perlindungan formula. |
| Kelulusan | Kelayakan lama hanya menerima active/completed. Paket baru memerlukan keputusan graduated yang tersimpan, enrollment completed, peserta aktif, flag sertifikat, administrasi bila kriteria mewajibkan, serta belum ada sertifikat terbit/pekerjaan berjalan. Tidak menganggap enrollment completed lama sebagai keputusan lulus otomatis. |
| Antrean baru | Konfirmasi terakhir dan pemeriksaan ulang server; pembuatan batch + seluruh pekerjaan + audit satu transaksi. Mengunci enrollment dan mencegah permintaan duplikat; retry memakai request key yang sama. Template dan identitas disalin sebagai snapshot untuk antrean baru. |
| Pemantauan | Metrik menunggu/diproses, selesai, gagal dan terbit menjadi filter. Drawer merinci peserta, status, jumlah percobaan, pesan gagal, profil akademik dan transkrip. Semua pengambilan daftar dipaginasi 500 baris dan UI memiliki halaman. |
| Pemulihan gagal | Konfirmasi jadwal ulang hanya pekerjaan gagal. Kelayakan diperiksa lagi; tata letak terbaru dari template aktif dipakai tanpa mengubah dokumen yang sudah terbit. Audit dan counter batch dalam transaksi. |
| Pemrosesan | Tombol Proses antrean memiliki konfirmasi. Maksimal lima dokumen per proses; admin hanya dapat mengklaim batch dalam cakupannya. Worker service dapat menjalankan antrean; normal user tidak dapat memanggil penyelesaian job. Lease/klaim mencegah worker lama menyelesaikan klaim baru. |
| PDF dan data | Nama program benar, nomor stabil per job, koordinat 0, hanya PDF latar A4 mendatar, validasi ukuran/teks melampaui halaman, tidak fallback diam-diam bila latar gagal. Key file unik per klaim mencegah worker usang menimpa file final. Sertifikat + job + counter + audit diselesaikan atomik setelah upload berhasil. |
| Dokumen | Daftar dokumen terbit/dicabut terhubung peserta. Hanya status issued dengan object key dapat diunduh melalui URL bertanda tangan dan pencatatan unduhan. Tidak membuat tautan verifikasi publik fiktif: kode verifikasi tersedia dalam data, portal verifikasi publik belum ada. |
| Portal peserta | Memilih dokumen issued terbaru sehingga multiple record lama tidak menyebabkan maybeSingle gagal. Status/error/retry jelas; sertifikat dicabut tidak ditawarkan sebagai dokumen aktif. Unduhan memakai helper bersama dan tidak memakai alert/popup setelah await. |

### Production preflight (read-only)
- Target **YPIA / BelajarLMS1 / main**, ref `foauntgtmhnhqlspgtoc`. Data awal **1 template, 0 batch, 0 job, 2 sertifikat, 0 log unduhan, 9 audit**. RLS aktif pada keempat tabel utama.
- Ditemukan `program_graduation_results`, `programs.graduation_settings` dan RPC finalisasi kelulusan belum tersedia. Paket 009 menambahkan fondasi tersebut tanpa membentuk keputusan lulus lama. RPC finalisasi yang kompatibel dengan UI Program menghitung ulang progres/skor/predikat dari data tersimpan, memvalidasi role/cakupan, pembayaran bila diwajibkan dan stale hasil; tidak percaya skor kiriman browser.
- Dashboard hanya menampilkan satu Edge Function (`document-signed-url`). Empat fungsi Sertifikat dari repo belum dideploy. Tidak ada schema cron. Nama konfigurasi S3 yang diperlukan tersedia di Secrets; nilai tidak dibuka atau disalin. Keberadaan nama secret bukan bukti koneksi storage berhasil.
- Paket `202610310009_certificate_workspace.sql` memuat fondasi kelulusan, RPC transaksi, snapshot/klaim, audit dan RLS admin sesuai program serta akses milik peserta. Direct write browser untuk tabel sertifikat diganti operasi server. Dua sertifikat lama tidak diubah.
- Empat bundle Edge mandiri (eligibility, create batch, process queue, download) disiapkan untuk dashboard dengan verifikasi JWT tetap aktif. Scope admin ditegakkan oleh RPC untuk penerbitan, sementara URL unduhan mengikuti kepemilikan/RLS dan menolak revoked.
- Apply SQL, backup policy/schema/helper, hash fungsi/bundle, verifikasi dan emergency disable writes ada di `../backups/ypia-certificate-*-20261031.*` serta `../backups/ypia-certificate-edge-20261031/`. Pengguna menyetujui **“Terapkan paket Sertifikat”**. Migration 009 dan keempat Edge Function telah diterapkan pada target tersebut; verifikasi JWT tetap aktif. Hash 11 fungsi SQL cocok, anon ditolak, helper internal/penyelesaian worker tidak dapat dijalankan authenticated, serta RLS aktif. Jumlah tetap 1 template, 0 batch, 0 job, 2 sertifikat, 0 unduhan, 0 keputusan kelulusan dan 9 audit. Bukti deployment terakhir `../ypia-certificate-edge-success.png`; receipt `../backups/ypia-certificate-edge-deployments-20261031.json`. Tidak menetapkan lulus, mengantrekan atau menerbitkan sertifikat peserta nyata.

### Validation
- 9 tes transaksi PostgreSQL terisolasi lulus: keputusan kelulusan/pembayaran/status, request idempotency, snapshot, rollback audit, scope, stale template, RLS direct writes, klaim eksklusif, counter akurat, lease recovery, retry layout, validasi ulang sebelum terbit, skor usulan tidak dipercaya, dan pemrosesan admin per batch.
- 5 tes worker lulus dengan SDK/PDF/storage tiruan: anon/user ditolak, scope batch admin, koordinat 0, file per klaim, gagal upload tidak finalisasi, dan regresi HMAC RFC 4231 untuk ArrayBuffer/typed array. Tidak menyamakan mock ini dengan rendering atau transfer Contabo nyata.
- 35 tes helper lintas modul lulus, termasuk 3 tes Sertifikat. Empat source Edge Function lulus `deno check` pada Deno 2.5.4 terisolasi di `/tmp`. Perbaikan buffer penandatangan S3 mempertahankan signature (dibuktikan vektor HMAC), tanpa menambah dependency aplikasi.
- Browser QA fixture terisolasi: filter program/pagination; draf template pulih setelah tutup editor; gagal simpan dan retry; koordinat 0; wizard pilih dua peserta; gagal antrean lalu retry dengan request key sama; detail pekerjaan; gagal jadwal ulang dan retry; konfirmasi proses gagal, muat ulang, lalu sukses; dokumen revoked tidak dapat diunduh. Navigasi program/angkatan bertahan.
- Desktop 1280px dan mobile 390px diperiksa; lebar halaman mobile 375px tanpa luapan horizontal. Bukti data contoh `../system-certificate-templates.png`, `../system-certificate-template-editor.png`, `../system-certificate-eligibility.png`, `../system-certificate-job-detail.png`, `../system-certificate-queue.png`, `../system-certificate-mobile.png`.

### Limits / deployment
- Belum ada pengujian tulis dengan JWT admin nyata, rendering PDF akhir dan unduhan/unggah Contabo nyata. Font standar renderer belum mendukung seluruh aksara Arab/Unicode; gagal encoding dilaporkan, tidak menerbitkan dokumen cacat.
- Latar opsional masih dipilih dari PDF yang sudah berada di penyimpanan; tidak menambahkan upload latar baru. Preview menunjukkan posisi teks, bukan render PDF latar.
- Penerbitan manual dari portal telah tersedia setelah deployment; tidak dijalankan terhadap peserta nyata. Scheduler otomatis tidak ditambahkan. Tidak menambah payment gateway, AI, audio/video upload atau komunikasi ke pihak lain.
- Enrollment lama berstatus completed tanpa keputusan resmi memerlukan rekonsiliasi akademik oleh pengelola. Tidak dilakukan kelulusan massal atau penimpaan dokumen lama.
- Penerapan manual perlu direkonsiliasi dengan riwayat Supabase CLI. Jangan menjalankan seluruh migration lama yang mengandung reset sandi massal.
- Referensi teknis: [Supabase Edge authentication](https://supabase.com/docs/guides/functions/auth) dan [pdf-lib PDFFont](https://pdf-lib.js.org/docs/api/classes/pdffont).

## FINANCE-WORKSPACE-001 — Review dan revamp Keuangan

### Date / scope
2026-10-31 (Asia/Jakarta). `/system/keuangan`, `/admin/keuangan` dan pembayaran peserta. Biaya kelas sekali/bulanan/pendaftaran, donasi/wakaf manual melalui rekening atau QR resmi, bukti, verifikasi dan pembukuan. Tidak melakukan push/merge.

### Review fitur dan hubungan
| Area | Temuan → implementasi |
| --- | --- |
| Beranda & navigasi | Hero/panel penjelasan panjang diganti header ringkas, enam menu, metrik berwarna sebagai filter, daftar pekerjaan dan akses cepat. Filter program, peserta, pencarian, jenis penerimaan, status, tanggal dan halaman berada di URL. Navigasi menu membersihkan filter yang tidak relevan. |
| Tagihan kelas | Sebelumnya belum ada tabel/alur tagihan. Wizard Program/peserta → Rincian biaya → Tinjau; pilihan eksplisit maksimal 200 enrollment, cari/pagination/pilih halaman. Biaya sekali bayar, bulanan dengan periode unik, atau pendaftaran. Partial payment, nominal menunggu dan sisa dibedakan. Tagihan belum dibayar bisa dibatalkan dengan alasan. |
| Peserta & Program | Tagihan mengarah profil/enrollment dan program. Profil peserta serta header Program memiliki tautan balik ke tagihan/pembayaran dengan konteks peserta/program. Detail tagihan mengarah ke riwayat transaksi; transaksi mengarah tagihan/jurnal. |
| Pembayaran | Pencatatan lama langsung verified diganti wizard Tujuan → Rekening/QR → Bukti → Tinjau. Pengiriman selalu pending, referensi duplikat ditolak, rekening disalin sebagai snapshot, kapasitas pembayaran memperhitungkan verified + pending. Request key menjaga retry tanpa duplikasi. Tidak membuat pembayaran tunai dari portal peserta. |
| Rekening & QR | Tambah/edit/aktif/nonaktif sesuai cakupan program; tujuan kelas/donasi/keduanya dan akun kas terkait. Gambar QR ditampilkan, rekening dapat disalin, nama penerima tidak dinormalisasi/diubah otomatis. Nomor placeholder nol tidak ditawarkan untuk membayar. QR diunggah dari gambar resmi, tidak dibuat sebagai QRIS/pembayaran gateway fiktif. Kanal global hanya superadmin/finance. |
| Bukti privat | PDF/JPG/PNG/WebP maksimal 5 MB, tolak audio/video. Signed upload staging → periksa ukuran/MIME/signature berkas aktual → salin ke key privat berbeda → tandai ready oleh service. Tautan PUT staging tidak menimpa bukti final. Dokumen hanya pemilik atau petugas berwenang; QR aktif/historis yang terkait pembayaran tetap dapat dibuka. Download bukti dicatat. |
| Verifikasi | Detail pembayar, tujuan, snapshot penerima, bukti, catatan, tagihan, profil dan jurnal. Verifikasi/tolak/batal dengan konfirmasi; alasan penolakan/pembatalan wajib, data stale ditolak. Jurnal, saldo tagihan, payment_status dan audit satu transaksi. Aktivasi enrollment hanya bila admin mencentang dan seluruh tagihan lunas. Tidak mengubah status belajar otomatis saat membuat tagihan atau membatalkan pembayaran. |
| Legacy | Transaksi kelas lama dapat dihubungkan eksplisit ke tagihan orang/program yang sama tanpa menduplikasi penerimaan. Pending tanpa bukti bisa ditambahkan bukti milik pengunggah. Tidak menebak alokasi atau mengubah status transaksi lama saat migration. |
| Donatur rutin | Wizard identitas donatur (baru/tersimpan/peserta LMS), komitmen/jadwal dan tinjauan. Donatur+komitmen atomik/idempotent, status aktif/jeda/selesai, tanggal 1–28 dan detail wakaf. Komitmen dipisah dari penerimaan uang; tombol pembayaran dan riwayat terkait. Tindak lanjut berupa catatan internal + jadwal; tidak menampilkan klaim pengiriman WA/email. |
| Jurnal & laporan | Pembuatan header/baris yang terpisah diganti jurnal seimbang atomik. Pembatalan verified membuat jurnal pembalik, bukan menghapus jejak atau mengirim refund. Detail asal, bagan akun/saldo normal, debit-kredit dan ekspor CSV sesuai filter. Semua query daftar dipaginasi, bukan header terbatas 100 sementara baris tidak terbatas. Rekonsiliasi manual jurnal lama: header kosong dapat dilengkapi tanpa duplikasi; rincian salah/sebagian ditolak untuk ditinjau, tidak ditimpa diam-diam. |
| Portal peserta | Tagihan pribadi, sisa/pending, riwayat dan pemeriksaan status. Wizard konfirmasi langsung di portal, rekening/QR yang sesuai tujuan, unggah bukti dan tautan bantuan. Pembayaran parsial didukung; status belum lunas tidak langsung berubah hanya karena bukti dikirim. |
| Ketahanan form | Error/retry tidak menghilangkan isian; konfirmasi menutup form dan beforeunload untuk isian belum disimpan, busy mencegah submit ganda, acknowledgment server harus tersedia. CSV melindungi formula spreadsheet. |

### Production preflight dan paket
- Target **YPIA / BelajarLMS1 / main**, ref `foauntgtmhnhqlspgtoc`. Metadata baca saja mengonfirmasi tujuh tabel legacy tersedia, belum ada invoice/proof atau RPC Keuangan. Policy lama memberi mutasi langsung luas; paket menggantinya dengan RPC validasi role/cakupan serta akses baca scoped/milik peserta.
- Jumlah awal **3 transaksi, 6 kanal, 0 donatur, 0 komitmen, 9 akun, 1 jurnal, 2 baris jurnal, 9 audit**. Tidak membaca nilai nominal, detail rekening atau bukti peserta produksi.
- Paket migration **202610310010_finance_workspace.sql**, 23 fungsi SQL, RLS/privilege, dan satu Edge Function **finance-documents** disiapkan. Migration menambah schema/default pending, tidak membuat tagihan/akun pembayaran/donatur, tidak memverifikasi pembayaran, tidak mengaktifkan enrollment, dan tidak mengubah data penerima lama.
- Apply transaksi (lock timeout 5 detik/statement timeout 60 detik), metadata/policy backup, jumlah awal, hash 23 fungsi, verifikasi, bundle Edge mandiri dengan JWT aktif dan emergency disable ada di `../backups/ypia-finance-*-20261031.*` dan `../backups/ypia-finance-edge-20261031/`. Pengguna menyetujui **“Terapkan paket Keuangan”** pada 2026-10-31. Isi editor dicocokkan persis dengan paket yang disetujui. Migration diterapkan dalam satu transaksi; hasil **Success. No rows returned**. Edge Function **finance-documents** berhasil dideploy dengan verifikasi JWT tetap aktif.
- Pemeriksaan ulang sebelum Run memastikan schema tagihan belum tersedia dan seluruh jumlah awal tetap sama. Verifikasi sesudah migration: **23/23 hash fungsi cocok**, SECURITY DEFINER/search_path benar, anon ditolak, keenam helper internal tidak dapat dijalankan authenticated, **RLS aktif pada 10 tabel**, dan privilege mutasi langsung browser ditolak. Jumlah tetap **3 transaksi, 6 kanal, 0 donatur/komitmen, 9 akun, 1 jurnal, 2 baris jurnal, 9 audit**; tabel invoice/dokumen/operation masing-masing **0**. Tidak menjalankan RPC keuangan terhadap data peserta nyata.
- Receipt hasil akhir `../backups/ypia-finance-deployment-20261031.json`, verifikasi SQL `../backups/ypia-finance-verify-20261031.json`, receipt Edge `../backups/ypia-finance-edge-deployments-20261031.json`. Bukti visual `../ypia-finance-migration-success.png`, `../ypia-finance-verification.png` dan `../ypia-finance-edge-success.png`.
- Penerapan SQL Editor perlu rekonsiliasi migration history CLI. Jangan db push seluruh migration lama yang mengandung reset sandi massal.

### Validation / limits
- **12 tes PostgreSQL terisolasi**: idempotensi tagihan/transaksi, duplikasi periode/ref, pembayaran parsial/reservasi, aktivasi eksplisit, jurnal/pembalik, rollback audit, ACL/RLS milik peserta, scope/stale data, dokumen asing/reuse, alokasi legacy, pembatalan/baseline, rekonsiliasi header kosong dan penolakan jurnal salah, donor atomik, serta tindak lanjut internal.
- **3 tes helper Keuangan**: nominal/balance, kanal/tujuan/program/URL aman, file/media/ukuran dan tanggal tindak lanjut. **4 tes Edge dengan storage/SDK tiruan**: autentikasi/kepemilikan, validasi bytes/ukuran, sealing file privat, kegagalan salin tidak menandai ready, idempotensi dan kegagalan audit tidak mengembalikan URL.
- Source serta bundle finance-documents lulus Deno 2.5.4 check. 38 tes helper lintas modul lulus. Typecheck terpisah dan build lulus (2.138 modul); lint 0 error, 7 warning lama; diff check bersih. Tidak menambah dependency aplikasi.
- Browser fixture lokal terisolasi: wizard 15 peserta, gagal simpan mempertahankan pilihan, retry sama request key; verifikasi gagal mempertahankan catatan lalu berhasil; nominal berlebih ditolak; rekening dipilih dan bukti gambar contoh dikirim, riwayat pending; catatan tindak lanjut; kanal placeholder dapat dinonaktifkan. Rekening/QR terlihat sebagai data contoh, bukan tujuan bayar nyata.
- Desktop dan layar 390px ditinjau. Bukti: `../system-finance-overview.png`, `../system-finance-invoice-wizard.png`, `../system-finance-review.png`, `../system-finance-channels.png`, `../system-finance-mobile.png`, `../learner-finance-payment-wizard.png`, `../learner-finance-mobile.png`. Entry/server fixture dihapus/dihentikan, viewport dipulihkan, autentikasi aplikasi utama tetap dipakai.
- Belum ada QA tulis menggunakan JWT admin/peserta nyata atau unggahan/unduhan Contabo positif. CORS S3 untuk PUT dari localhost harus sesuai konfigurasi bucket yang ada. File staging/hasil salin yang tidak terpakai tidak dihapus otomatis; cleanup terjadwal belum ditambahkan.
- Rekening dan gambar QR nyata masih perlu diisi melalui menu Rekening & QR oleh pengelola. Pembayaran QR/rekening diperiksa manual; tidak ada gateway, deteksi transfer otomatis, refund uang, pengiriman pesan, pajak, pengeluaran atau ERP akuntansi lengkap.

## AUTH-FINANCE-FOLLOWUP-001 — Login nyata dan pemeriksaan lanjutan Keuangan

2026-10-31 (Asia/Jakarta). Melanjutkan review Keuangan setelah deployment 010, lalu memprioritaskan masalah login yang dilaporkan pengguna. Tidak melakukan push/merge.

### Login
- Tab localhost menunjukkan error verifikasi keamanan. `.env.local` mengarah ke proyek YPIA yang benar, anon key tersedia, `VITE_DISABLE_TURNSTILE=true`, site key lokal kosong. Pengaturan dashboard **Attack Protection → Enable Captcha protection** ternyata masih aktif (Turnstile), sehingga penonaktifan UI lokal belum cukup.
- Sebelum mengubah pengaturan proyek, pengguna diberi tahu bahwa cakupannya mencakup seluruh domain/produksi dan menyetujui **“Nonaktifkan CAPTCHA proyek YPIA”**. Toggle dinonaktifkan dan Save changes berhasil; tidak mengubah sandi, role, RLS, rate limit atau konfigurasi autentikasi lain. Secret tidak dibuka/disalin. Pesan error lokal diperjelas agar tidak meminta pengguna mengulang challenge yang tidak ditampilkan.
- Pengguna mengonfirmasi **“Berhasil masuk”**; sesi nyata teramati membuka `/system/keuangan?tab=recurring` tanpa error pemuatan data. Tidak mengambil isi sandi. Form sempat kosong akibat refresh aplikasi, dan pengguna mengisi kredensial sendiri.
- Bukti `../ypia-auth-captcha-before.png`, `../ypia-auth-captcha-disabled.png`; receipt `../backups/ypia-auth-captcha-resolution-20261031.json`. Referensi mekanisme verifikasi server: [Supabase CAPTCHA](https://supabase.com/docs/guides/auth/auth-captcha).

### Temuan dan perbaikan
| Kasus | Hasil |
| --- | --- |
| Cicilan desimal | `0.3 - 0.1` sebelumnya menghasilkan sisa pecahan floating point yang dapat menolak pembayaran `0.2`. Perhitungan saldo sekarang memakai satuan sen; minimum input sesuai validasi server (0,01). |
| Identitas donasi peserta | Penerimaan donasi yang dicatat admin untuk donatur peserta sebelumnya tidak mewarisi participant_id. Identitas sekarang diambil dari profil donatur yang telah diperiksa server; payload tidak dapat mengaitkan peserta lain secara bebas. Transaksi baru tampil pada riwayat pemilik melalui policy yang sudah ada. Tidak melakukan backfill transaksi lama. |
| Pembatalan jurnal lama | Keseimbangan debit/kredit saja belum cukup. Pembatalan sekarang juga memastikan total jurnal sama dengan nominal transaksi, dan membatalkan seluruh operasi bila tidak cocok. |
| Alokasi data legacy | Pembayaran bernilai nol/negatif ditolak sebelum dihubungkan ke tagihan, sehingga tidak dapat mengurangi saldo pembayaran secara keliru. |
| Alokasi bersamaan dengan review | Review dan alokasi memperoleh advisory lock transaksi yang sama sebelum membaca hubungan invoice; review juga menolak hubungan tagihan yang berubah. Tidak mengklaim uji concurrency multi-koneksi PostgreSQL dari engine PGlite satu koneksi. |
| Penggantian file bukti/QR | Jika pengganti tidak valid, file lama dibersihkan dari pilihan. Form tidak diam-diam memakai file sebelumnya. Tidak mengunggah audio/video, dan tidak mengubah dokumen yang sudah terlampir pada transaksi nyata. |

### Deployment dan verifikasi
- Migration **202610310011_finance_integrity_followup.sql** memperbarui empat implementasi fungsi yang sudah ada: create_transaction, reverse_journal, review_transaction, allocate_transaction. Tidak menambah GRANT/REVOKE, role, policy RLS, atau memanggil operasi bisnis. Migration 010 yang telah diterapkan tetap dipertahankan.
- Preflight membaca definisi/ACL empat fungsi dan jumlah data; hash fungsi lama cocok dengan paket 010 sebelum penerapan. Backup fungsi lama dan rollback implementasi tersedia. Isi editor dicocokkan persis; penerapan satu transaksi timeout 5s/60s menghasilkan **Success. No rows returned**.
- Verifikasi gabungan seluruh **23 fungsi** cocok dengan keadaan akhir (19 tetap + 4 diperbarui); anon ditolak, RLS aktif dan direct browser writes ditolak. Jumlah tetap **3 transaksi, 6 kanal, 9 akun, 1 jurnal, 2 baris jurnal, 9 audit**; tagihan/dokumen/donatur/komitmen/operation tetap **0**. Tidak membuat tagihan, mengirim pembayaran, memverifikasi penerimaan, mengubah rekening atau mengaktifkan enrollment nyata.
- Paket apply, backup live, rollback, hash, verifikasi dan receipt `../backups/ypia-finance-followup-*-20261031.*`. Bukti `../ypia-finance-followup-migration-success.png` dan `../ypia-finance-followup-verification.png`. Riwayat SQL Editor masih perlu direkonsiliasi sebelum Supabase CLI db push; jangan menjalankan reset sandi migration lama.

### Pengujian dan batas
- Tiga regresi database dan satu regresi nominal berhasil direproduksi sebelum perbaikan, lalu seluruh **15 tes PostgreSQL Keuangan** dan **39 tes helper lintas modul** lulus sesudahnya. ACL/RLS, rollback audit, partial payment, jurnal/pembalik, identitas donor, scope dan stale state ikut diuji.
- Browser fixture terisolasi: tagihan contoh 0,3 dengan pembayaran 0,1 dapat melanjutkan sisa tepat 0,2; pemilihan bukti PNG lalu diganti MP4 menghapus file lama dan tetap tertahan pada langkah bukti. Tidak menekan kirim konfirmasi; endpoint fixture memakai localhost terpisah. Bukti `../finance-followup-proof-validation.png`. Entry/server/tab pengujian dibersihkan; autentikasi aplikasi utama tetap dipakai.
- Pemeriksaan akhir: TypeScript melalui build lulus; build 2.138 modul lulus; lint 0 error dengan 7 warning lama; git diff --check bersih. Tidak ada dependency baru.
- Pengaturan rekening/QR resmi masih diisi pengelola. Unggah/unduh Contabo positif dengan berkas nyata belum dilakukan; pengujian dokumen sebelumnya menggunakan storage/SDK tiruan. Pengujian ini tidak mengklaim deteksi transfer otomatis, refund uang atau pengiriman pesan.

## ANNOUNCEMENT-WORKSPACE-001 — Review dan revamp Pengumuman

2026-10-31 (Asia/Jakarta). Permintaan pengguna: analisis seluruh fitur/subfitur `/system/pengumuman`, hubungan antar menu, revamp ringkas, berwarna, ramah pengguna, dan wizard sederhana. Rincian review, matriks hubungan, perilaku dan batas di `docs/ANNOUNCEMENT_WORKSPACE.md`. Tidak melakukan push/merge.

### Temuan dan perubahan
- Daftar lama memisahkan ringkasan/pengelolaan/pembuatan, form awal memilih published, tidak ada edit atau pagination, dan mutasi/hapus langsung dari browser. Revamp menjadi daftar dengan ringkasan status yang dapat difilter, pencarian serta filter URL, pagination, detail dan wizard Pesan → Penerima → Tinjau. Default draf, pratinjau, batas isian, estimasi akun penerima, WIB, pin, tautan tindakan internal, salin, tarik, arsip/pulihkan. Error tetap terlihat dan request key mencegah simpan ganda; draf sementara dipisah per akun/salinan/versi, pulih saat dibuka kembali.
- Pembaca lama di beranda peserta mengambil semua published lalu memfilter program di JavaScript. Realtime hanya INSERT, mengabaikan perubahan/penarikan dan dapat menerima draf. Pembaca baru mengambil RPC yang memeriksa akses server; event hanya memicu reload, ditambah polling 60s saat terlihat dan reload saat fokus. Semua peran memperoleh kotak masuk; admin/superadmin memiliki pengelolaan terpisah. Beranda peserta/pengajar/musyrif menampilkan tiga pesan teratas. Tidak menandai dibaca otomatis; tombol baca eksplisit dan revisi baru kembali unread.
- Program → Pengumuman membawa konteks program; detail memiliki tautan program/kelas/materi. Tombol program, materi, pembayaran, bantuan mengikuti portal yang mendukung peran tersebut. Belum membangun ulang fitur belajar/pembayaran wali; CTA yang belum didukung tidak ditampilkan.
- Sumber otomatis materi/kuis/ujian baru unik per lesson, mengikuti release/unpublish, menjaga arsip, dan tautan langsung ke materi/kurikulum. Tidak menebak hubungan lesson dari teks pengumuman lama. Penarikan/sinkronisasi ikut diaudit.

### Preflight dan paket backend
- Proyek nyata YPIA / BelajarLMS1 / branch main / `foauntgtmhnhqlspgtoc` diperiksa melalui SQL Editor. Terdapat **24 pengumuman published, seluruhnya telah berakhir**. Policy produksi berbeda dari migration awal repo: memakai `visible_from`/`visible_until`, tetapi masih mengabaikan sasaran peran/program. Kedua kolom wajib dengan default now / now +14 hari. Function trigger lama dan policy dicadangkan.
- Migration **202610310012_announcement_workspace.sql** mempertahankan nilai jadwal lama melalui rename kolom, tanpa update isi/status/updated_at. Menambah kelas, pin, CTA, sumber materi, revisi, tanda baca dan operation idempotent. Sebelas fungsi memeriksa profil aktif, role/scope, kelas-program, enrollment, wali dan penugasan; mutasi dan audit atomik, stale edit ditolak, browser tidak memiliki direct writes. Helper kandidat penerima dan trigger tidak dapat dipanggil authenticated, anon tidak dapat menjalankan fungsi.
- Paket transaksi (lock timeout 5s / statement timeout 60s), metadata/fungsi lama, hash 11 fungsi, manifest SHA256, SQL verifikasi dan emergency disable tersedia pada `../backups/ypia-announcements-*-20261031.*`. Apply memeriksa fingerprint 24 pesan dan policy sebelum perubahan; verifikasi merekonstruksi fingerprint lama untuk memastikan isi/status/jadwal/updated_at tetap sama. Emergency disable mempertahankan data dan RLS; bukan pengembalian otomatis ke policy lama yang terlalu luas. Tidak membuat pesan atau read receipt saat deploy.
- Paket disiapkan sebelum persetujuan; pengguna kemudian menyetujui **“Terapkan migration Pengumuman”**. Migration diterapkan ke target yang sama dalam satu transaksi; SQL Editor mengembalikan **Success. No rows returned**. Penerapan melalui SQL Editor perlu rekonsiliasi migration history CLI; jangan menjalankan migration lama yang mereset sandi.

### Validasi dan batas
- **10 tes PostgreSQL terisolasi** lulus: draft/publication/withdrawal; peran/program/kelas/wali/penugasan; admin scope; foreign/stale edits; idempotensi dan audit rollback; schedule/expiry/archive; revisi tanda baca; count akun aktif; FK kelas tidak memperluas audience; trigger lesson rilis/unpublish/delete; pelestarian jadwal/updated_at produksi; policy/RLS/ACL langsung. Dua tes jadwal dan sumber materi diulang setelah perbaikan validasi publikasi dan lulus.
- **6 tes helper** lulus: status dan batas waktu, input WIB/tanggal tidak valid, validasi/payload, unread/pagination, CTA sesuai peran, urutan pin. Build termasuk TypeScript lulus; lint 0 error, 7 warning lama; diff check bersih. Tidak menambah dependensi aplikasi.
- Browser fixture lokal terisolasi: wizard tiga langkah, sasaran program/kelas/peran, estimasi penerima, default draf, gagal simpan mempertahankan isian lalu retry berhasil, konfirmasi publikasi, tutup/pulihkan draf lokal, reader peserta dan tanda baca eksplisit. Desktop dan lebar390 px ditinjau tanpa horizontal overflow. Bukti `../system-announcements-overview.png`, `../system-announcements-wizard.png`, `../system-announcements-mobile.png`, `../learner-announcements-reader-mobile.png`. Entry/server/tab fixture dibersihkan. Tidak memublikasikan pengumuman nyata atau membuat receipt akun nyata.
- Tidak ada email/WA/SMS/push atau cron baru. Jadwal diputuskan waktu server, tampilan terbuka dapat menunggu polling/fokus. Estimasi/read count bukan bukti pengiriman. Tidak mengklaim pengujian multi-koneksi concurrency atau semua JWT peran nyata.

### Penerapan Pengumuman 012 — hasil akhir
- Isi SQL dicocokkan persis dengan paket yang disetujui; manifest empat berkas cocok. Guard baseline 24 pesan/policy lolos sebelum DDL. Penerapan dalam satu transaksi berhasil pada YPIA / BelajarLMS1, branch main, `foauntgtmhnhqlspgtoc`.
- **11/11 hash fungsi cocok**, seluruh SECURITY DEFINER/search_path benar; anon ditolak, helper kandidat penerima dan trigger tidak dapat dieksekusi authenticated. RLS aktif pada announcements, announcement_reads dan announcement_operations. Dua policy akhir hanya scoped read dan receipt milik sendiri; tidak ada policy operasi untuk browser. INSERT/UPDATE/DELETE/TRUNCATE langsung ditolak.
- Fingerprint legacy setelah rename **cocok persis**: isi, status, created/updated_at, pembuat, sasaran dan batas waktu 24 pesan tetap sama. Jumlah **24 published dan expired**, read receipt **0**, operation **0**. Tidak memanggil RPC publikasi/arsip/simpan/tandai baca terhadap akun nyata; tidak mengirim pesan atau email/WA.
- Receipt dan hasil SQL: `../backups/ypia-announcements-deployment-20261031.json`, `../backups/ypia-announcements-verify-20261031.json`. Bukti `../ypia-announcements-migration-success.png` dan `../ypia-announcements-verification.png`. Riwayat CLI masih perlu direkonsiliasi; jangan db push migration lama yang mereset sandi.

- Pemeriksaan sesi nyata setelah deployment: `/system/pengumuman` memuat 24 pesan berakhir dan pilihan program tanpa error layanan; `/system/informasi` memuat 0 pesan aktif. Tautan Untuk saya → Kelola pengumuman berhasil. Tidak membuat/mengubah pesan atau receipt nyata. Bukti `../system-announcements-live.png` dan `../system-announcements-inbox-live.png`.

## SETTINGS-WORKSPACE-001 — Review dan revamp Pengaturan Global

2026-10-31 (Asia/Jakarta). Permintaan pengguna: review setiap fitur/subfitur `/system/pengaturan`, keterkaitan antar menu, revamp ringkas, berwarna, user friendly dan wizard mudah. Rincian di `docs/SETTINGS_WORKSPACE.md`. Tidak melakukan push/merge atau mengubah kredensial.

### Temuan dan implementasi
- Ikhtisar lama mengulang persentase dan menyebut 4 portal sementara terdapat 5. Navigasi dan form panjang, save langsung dan error sementara. Revamp menjadi Ikhtisar, Identitas & kontak, Tampilan & logo, Warna portal dan Pengaturan terkait; navigasi samping desktop, pemilih bagian pada ponsel, kartu pastel yang dapat dibuka, checklist, waktu simpan dan footer tinjau perubahan.
- Wizard **Identitas → Tampilan → Tema → Tinjau**, validasi per langkah, ringkasan nilai lama/baru, save eksplisit. Error tetap tampil; draft per akun/record/versi disimpan di sessionStorage 24 jam, validasi shape saat pemulihan; isian tetap saat gagal simpan, retry memakai request key sama. Konfirmasi sebelum membuang isian/memuat versi server; perubahan server tidak menimpa form yang diedit.
- Logo utama kini dipakai sidebar desktop/mobile, favicon dan nama lembaga pada identitas browser, logo login tetap memakai fallback utama. Lima preset portal dinormalisasi dari JSON legacy; aksen login dan public layout mengikuti tema publik. Preview publik memakai konteks login, preview portal lain memakai shell. Subjudul pusat kendali sebelumnya tidak terlihat; kini dibaca beranda sistem.
- Bantuan peserta tidak lagi memakai kontak contoh saat kosong. Nomor Indonesia 08… diubah menjadi 628… pada tautan WA; kontak salah/kosong menonaktifkan tombol dan tiket tetap tersedia. Tidak mengirim pesan.
- Snapshot pengaturan bersama mencegah request hook berulang, ada reload setelah save, BroadcastChannel dan refresh fokus/visibilitas. Read error dibedakan dari record yang benar-benar kosong; inisialisasi tidak ditawarkan karena network error. Tidak menulis saat membuka halaman.
- Tautan terkait menuju Program, Form Pendaftaran, Rekening & QR, Sertifikat, Akun/Peran dan Audit. Template transkrip memakai editor yang sudah ada; general patch tidak menimpa kop, pejabat atau tanda tangan. Editor transkrip ikut mengirim expected_updated_at melalui RPC agar tidak menimpa versi lain.

### Fondasi server dan preflight
- Preflight YPIA / BelajarLMS1 / main / `foauntgtmhnhqlspgtoc`: 1 record system_settings, 3 policy (baca publik, superadmin insert/update), singleton index, 9 audit dan 3 objek pada bucket lama. Bucket system_assets publik tanpa size/MIME restriction. Metadata, policy, trigger dan fingerprint dicadangkan; nilai secret tidak dibuka. Pemeriksaan berikutnya memastikan fingerprint sama; service_role memiliki bypass RLS untuk registry server.
- Migration **202610310013_settings_workspace.sql** berisi empat fungsi: settings_can_manage, admin_save_system_settings, admin_create_system_settings dan settings_register_brand_asset. Membatasi superadmin aktif, whitelist dan panjang/type/URL/email/tema, optimistic concurrency, update field yang berubah, idempotensi dan audit atomik. Mencabut direct browser writes; pengaturan publik tetap dapat dibaca. Operation/asset registry ber-RLS tanpa izin baca browser, registrasi hanya service role.
- Edge **settings-assets** memeriksa JWT dan superadmin aktif pada POST. Upload PNG/JPG/WebP maksimal 2 MB, bounded body, MIME/ekstensi/header bytes, key immutable dan ACL private. Browser memeriksa decode dan dimensi 4.096 px. GET publik hanya ID yang dipilih pada logo utama/login/favicon saat ini, tidak melayani object key bebas atau dokumen lain; URL Contabo bertempo. Endpoint perlu verify_jwt=false untuk GET gambar, POST tetap mengautentikasi di handler. Logo/tanda tangan lama dan policy bucket lama tidak dimigrasi/dihapus.
- Paket transaksi, preflight, hash 4 fungsi, manifest SHA256, verifikasi dan emergency disable di `../backups/ypia-settings-*-20261031.*`; bundle mandiri dan konfigurasi Edge di `../backups/ypia-settings-edge-20261031/`. Guard count/fingerprint/policy menghindari penerapan atas baseline yang berubah; lock timeout5s/statement60s. Emergency disable mempertahankan data dan menutup RPC/registry server, bukan memulihkan mutasi langsung.
- Pengguna menyetujui **“Terapkan paket Pengaturan”**; penerapan dilakukan pada proyek/branch yang sama setelah seluruh paket dan hash disiapkan. Deployment tidak mengubah konfigurasi, tema, kontak, gambar lama, role, password atau CAPTCHA. SQL Editor memerlukan rekonsiliasi migration history sebelum CLI db push; jangan menjalankan migration lama yang mereset sandi.

### Validasi dan batas
- **8 tes PostgreSQL** lulus: migration menjaga record/audit awal, patch menjaga transkrip, idempotensi, stale data, validasi, role/profil aktif, ACL/direct writes, audit rollback, lima tema, singleton dan registrasi aset.
- **5 tes helper** lulus: tema legacy, payload parsial/pelepasan field, WA/email/kontak kosong, URL/field, format dan ukuran file. **4 tes Edge** lulus dengan SDK/storage tiruan: auth/role, media/bytes/size, key immutable/private dan storage/audit failure, GET hanya logo aktif.
- Source serta bundle Edge lulus Deno check. Typecheck terpisah dan build **2.149 modul** lulus; lint **0 error, 7 warning lama**; diff check bersih. Tidak menambah dependency aplikasi.
- Browser fixture terisolasi: field wajib, wizard empat langkah, preview dan tinjauan, gagal simpan lalu retry, draft dipulihkan setelah komponen dimuat ulang, unggahan PNG contoh berhasil lewat mock, MP4 ditolak dan pilihan sebelumnya dijelaskan, konfirmasi kembali ke versi tersimpan. Desktop/390px ditinjau tanpa luapan horizontal. Entry/server/tab fixture dibersihkan dan viewport dipulihkan.
- Bukti: `../system-settings-before.png`, `../system-settings-overview.png`, `../system-settings-wizard-review.png`, `../system-settings-upload-validation.png`, `../system-settings-mobile.png`, `../system-settings-mobile-review.png`. Sesi admin nyata membaca konfigurasi lama, logo yang berhasil dimuat, judul browser dan favicon; preview publik mengikuti konfigurasi tersimpan. Bukti `../system-settings-live.png`, `../system-settings-public-preview.png`. Tidak menyimpan draft atau mengunggah aset ke proyek nyata.
- Unggah/unduh Contabo positif memakai kredensial produksi belum diuji. Object private yang tidak terpakai tidak dihapus otomatis; URL bertempo yang sudah terbit berlaku sampai expiry. Preview blob baru tidak lintas perangkat; metadata pilihan tetap tersimpan pada draft lokal. Editor tanda tangan transkrip lama tetap memakai upload Supabase yang sudah ada. Tidak menambah pengelolaan secret, SMTP, AI, gateway, pengiriman pesan atau regenerasi dokumen otomatis.

### Hasil penerapan Pengaturan 013
- SQL dicocokkan persis dengan paket yang disetujui, guard baseline lolos, transaksi berhasil: **Success. No rows returned**. Pemeriksaan setelah SQL dan setelah deployment Edge tetap **4/4 hash cocok**, seluruh fungsi SECURITY DEFINER/search_path benar, anon ditolak, registrasi tidak dapat dipanggil authenticated, RLS pada tiga tabel, direct mutations dan pembacaan registry/operation oleh browser ditolak.
- Fingerprint konfigurasi **cocok persis**. Jumlah akhir: **1 record pengaturan, 9 audit, 3 objek lama**, **0 registry branding baru dan 0 operation**. Tidak mengubah nilai konfigurasi, tema, kontak, logo lama, password, role atau CAPTCHA; tidak mengunggah berkas nyata.
- **settings-assets** berhasil dideploy melalui editor dengan bundle mandiri; kode dibaca kembali dari Code dan **cocok persis (9.929 karakter)**. Gateway JWT fungsi ini dinonaktifkan dan perubahan tersimpan sesuai persetujuan. POST tetap memakai getUser dan settings_can_manage; metadata service role hanya di server. Tidak mengubah konfigurasi fungsi lain.
- Probes nyata tanpa auth: **POST401** dengan pesan “Silakan masuk kembali.”; **GET404** pada UUID yang tidak terdaftar dengan pesan “Gambar tidak tersedia.”. GET langsung dari tab browser tanpa header auth juga mencapai handler dan ditolak untuk ID tersebut. Tidak memakai atau menampilkan nilai key.
- Sesi superadmin nyata memuat konfigurasi dan logo lama, judul/favicon browser, preview publik; wizard berhasil melewati keempat langkah tanpa perubahan, tinjauan menyatakan tidak ada perubahan dan simpan nonaktif. Tidak memanggil save/upload nyata untuk pengujian. Unggah/unduh Contabo positif tetap belum diuji pada produksi; pengujian storage positif menggunakan tiruan.
- Receipt: `../backups/ypia-settings-deployment-20261031.json`, `../backups/ypia-settings-edge-deployment-20261031.json`, hasil SQL `../backups/ypia-settings-verify-20261031.json`. Bukti `../ypia-settings-migration-success.png`, `../ypia-settings-verification.png`, `../ypia-settings-edge-success.png`, `../ypia-settings-edge-auth-check.png`, `../ypia-settings-edge-read-check.png`, `../system-settings-live.png`, `../system-settings-wizard-live.png`. Riwayat SQL Editor tetap perlu rekonsiliasi CLI; jangan db push migration lama yang mereset sandi.

## HELPDESK-UX-001 — 2026-10-31

### Permintaan dan hasil
- Review/revamp `/system/helpdesk` beserta alur peserta dan keterkaitannya dengan program, peserta, dan pembayaran; pengguna juga meminta push Git dan merge.
- Mengganti dua halaman Helpdesk lama dengan workspace bersama: antrean berpaginasi, pencarian literal, filter URL, statistik server sesuai cakupan, error/retry, dan detail percakapan.
- Wizard tiga langkah Masalah → Konteks → Tinjau. Program dan tagihan peserta mengisi konteks bantuan; detail tiket menyediakan tautan sesuai peran ke program, peserta dan tagihan. Bantuan ditambahkan pada portal pengajar/mentor; finance memperoleh rute antrean pembayaran sesuai scope setelah migration disetujui.
- Balasan publik dan catatan internal terpisah. Draf mengikuti akun/tiket/jenis pesan. Enter menambah baris; kirim melalui tombol atau Ctrl/Cmd+Enter. Request key dan versi asli dipertahankan saat acknowledgement terputus, termasuk setelah reload tab.
- Pengelolaan petugas aktif, prioritas, status, jadwal tindak lanjut WIB dan ringkasan penyelesaian publik; pelapor dapat membuka kembali tiket dengan konfirmasi balasan. Tampilan desktop dua panel, ponsel fokus ke percakapan, status berwarna dan panduan/kontak ringkas.
- Menghapus tombol lampiran dekoratif. Bukti transfer tetap di Keuangan. Jadwal adalah daftar tindak lanjut, tanpa cron/email/WA otomatis. Tidak menambah dependency aplikasi.

### Server dan penerapan
- Migration `202610310014_helpdesk_workspace.sql`: 14 fungsi/proyeksi termasuk pengganti trigger nomor/timestamp, sequence nomor unik, konteks program/enrollment/tagihan, riwayat, idempotency privat, mutasi atomik dan audit, penguncian versi, role/scope/assignment server, RLS dan pencabutan direct writes/TRUNCATE.
- Pelapor hanya melihat tiket sendiri dan pesan publik; admin mengikuti scope, Helpdesk hanya penugasan sendiri/antrean aktif tanpa petugas, finance hanya pembayaran dengan aturan scope yang sama. Wali tidak diberi akses tagihan anak melalui Helpdesk.
- Preflight nyata: 0 tiket, 0 pesan, 9 policy lama. Definisi fungsi, ACL, policy dan fingerprint disimpan di workspace lokal; paket apply/verify/hash/manifest/emergency disable di `../backups/ypia-helpdesk-*-20261031.*`.
- **Migration 014 belum diterapkan.** Konfirmasi perubahan akses finance telah diminta dan belum dijawab saat catatan ini ditulis. Tidak membuat atau membalas tiket nyata selama audit. Modul baru memerlukan migration 014 sebelum operasional; kegagalan RPC ditampilkan sebagai pembaruan server belum tersedia.
- Migration 002–013 modul sebelumnya sudah diterapkan melalui SQL Editor sesuai persetujuan sebelumnya. Jangan menjalankan migration historis/seed yang mereset kredensial; rekonsiliasi migration history CLI secara terpisah.

### Validasi
- Seluruh **23 berkas tes** gabungan lulus, 0 gagal, mencakup modul Peserta/Program/Pendaftaran/Penilaian/Sertifikat/Keuangan/Pengumuman/Pengaturan/Helpdesk serta navigasi dan progres belajar.
- Helpdesk: 9 skenario PostgreSQL + 4 helper, termasuk rollback audit, retry idempoten, konteks/ownership tagihan, scope/assignment, RLS catatan internal, stale version, resolusi/reopen, pagination/filter dan penolakan anon/inaktif.
- Browser fixture lokal terisolasi: draf pertama kembali saat berpindah tiket, tiket kedua kosong; koneksi putus setelah simpan lalu reload/retry menghasilkan tepat satu pesan; pengelolaan prioritas/petugas; wizard konteks tagihan sampai kirim; kontrol/catatan internal tidak muncul pada peserta; ponsel tanpa overflow horizontal. Sumber fixture tidak dimasukkan ke Git.
- Pemeriksaan akhir: lint **0 error, 5 warning lama**; typecheck dan build lulus; diff check bersih. Pemindaian pola kredensial pada perubahan tidak menemukan secret; `.env*` tidak dilacak.
- Bukti lokal: `../system-helpdesk-conversation-example.png`, `../helpdesk-create-review-example.png`, `../helpdesk-learner-mobile-example.png`. Screenshot berisi data contoh. Aplikasi nyata kembali berjalan pada localhost:5173; sesi admin berhasil dibaca, migration belum tersedia di server.

### Paket Git
- Branch `revamp/lms-helpdesk-workspaces` memuat perubahan Helpdesk dan seluruh revamp modul sebelumnya yang belum dipublikasikan dan saling bergantung sejak PR #1. Backup, konfigurasi lokal, hasil build dan fixture sementara dikecualikan.
