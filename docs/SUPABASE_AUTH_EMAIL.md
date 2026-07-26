# Supabase Auth Email

Dokumen ini menjelaskan konfigurasi email konfirmasi pendaftaran LMS Ihsanul Adab pada Supabase hosted.

## Perbedaan alur

- **Daftar dengan Google**: verifikasi identitas dilakukan oleh Google. Supabase tidak mengirim email konfirmasi pendaftaran.
- **Daftar dengan email dan kata sandi**: Supabase mengirim tautan konfirmasi apabila `Confirm email` aktif.

## Template konfirmasi

Sumber template tersimpan di:

`supabase/templates/confirmation.html`

Untuk memasangnya pada project Supabase hosted:

1. Buka **Supabase Dashboard > Authentication > Email Templates**.
2. Pilih **Confirm signup**.
3. Isi subject dengan `Konfirmasi pendaftaran akun Belajar YPIA`.
4. Salin isi `supabase/templates/confirmation.html` ke body template.
5. Simpan perubahan.

Template menggunakan `{{ .ConfirmationURL }}` yang disediakan Supabase. Jangan menggantinya dengan URL statis.

## Custom SMTP Google Workspace

Konfigurasi ini dilakukan di **Supabase Dashboard > Project Settings > Authentication > SMTP Settings**:

| Field | Value |
| --- | --- |
| Enable Custom SMTP | Aktif |
| Sender email | `salam@ihsanuladab.or.id` |
| Sender name | `LMS Ihsanul Adab` |
| Host | `smtp.gmail.com` |
| Port | `587` |
| Username | `salam@ihsanuladab.or.id` |
| Password | App Password Google, bukan kata sandi akun |

Sebelum mengisi password:

1. Cara paling sederhana adalah memakai `salam@ihsanuladab.or.id` sebagai mailbox Google Workspace aktif.
2. Jika alamat tersebut hanya alias, aktifkan **Send mail as** pada mailbox pemilik alias dan gunakan mailbox pemilik sebagai username SMTP.
3. Aktifkan verifikasi dua langkah pada akun yang dipakai sebagai username SMTP.
4. Buat **App Password** khusus bernama `Supabase Auth`.
5. Masukkan App Password 16 karakter ke field password SMTP.
6. Jangan menyimpan App Password di `.env`, frontend, migration, atau repository.

Apabila menu App Password tidak tersedia, administrator Google Workspace perlu mengizinkannya. Untuk volume produksi yang lebih besar, gunakan provider transactional email dan verifikasi domain `ihsanuladab.or.id`; alamat From tetap dapat memakai `salam@ihsanuladab.or.id`.

## URL dan pengujian

Di **Authentication > URL Configuration**:

- Site URL production harus memakai domain aplikasi production.
- Tambahkan `http://127.0.0.1:5173/learner/auth/callback` untuk development.
- Tambahkan URL callback production, misalnya `https://domain-aplikasi/learner/auth/callback`.

Setelah SMTP dan template disimpan:

1. Daftar dengan satu alamat email uji baru.
2. Pastikan pengirim tampil sebagai `LMS Ihsanul Adab <salam@ihsanuladab.or.id>`.
3. Uji tombol konfirmasi dan tautan cadangan.
4. Periksa **Authentication > Logs** bila email tidak diterima.
5. Periksa folder spam dan status SPF, DKIM, serta DMARC domain.

Jangan menonaktifkan email confirmation hanya untuk melewati masalah pengiriman email.
