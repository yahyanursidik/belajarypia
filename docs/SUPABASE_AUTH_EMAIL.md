# Supabase Auth Email

Dokumen ini menjelaskan konfigurasi email konfirmasi pendaftaran LMS Ihsanul Adab pada Supabase hosted.

## Perbedaan alur

- **Daftar dengan Google**: verifikasi identitas dilakukan oleh Google. Supabase tidak mengirim email konfirmasi pendaftaran.
- **Daftar dengan email dan kata sandi**: Supabase mengirim tautan konfirmasi apabila `Confirm email` aktif.

## Template email

Sumber template tersimpan di:

- `supabase/templates/confirmation.html` untuk **Confirm signup**.
- `supabase/templates/invite.html` untuk **Invite user**.
- `supabase/templates/magic_link.html` untuk **Magic link or OTP**.
- `supabase/templates/email_change.html` untuk **Change email address**.
- `supabase/templates/recovery.html` untuk **Reset password / Recovery**.
- `supabase/templates/reauthentication.html` untuk **Reauthentication**.

## Subject yang dipakai

| Menu Supabase | Subject | File template |
| --- | --- | --- |
| Confirm sign up | `Konfirmasi pendaftaran akun Belajar YPIA` | `supabase/templates/confirmation.html` |
| Invite user | `Undangan akun LMS Ihsanul Adab` | `supabase/templates/invite.html` |
| Magic link or OTP | `Tautan masuk akun Belajar YPIA` | `supabase/templates/magic_link.html` |
| Change email address | `Konfirmasi perubahan email akun Belajar YPIA` | `supabase/templates/email_change.html` |
| Reset password | `Reset kata sandi akun Belajar YPIA` | `supabase/templates/recovery.html` |
| Reauthentication | `{{ .Token }} adalah kode verifikasi LMS Anda` | `supabase/templates/reauthentication.html` |

Untuk memasangnya pada project Supabase hosted:

1. Buka **Supabase Dashboard > Authentication > Email Templates**.
2. Buka satu menu template.
3. Isi subject sesuai tabel di atas.
4. Salin seluruh isi file HTML terkait ke body template.
5. Simpan, lalu ulangi untuk template lain.

Template menggunakan variabel resmi Supabase seperti `{{ .ConfirmationURL }}`, `{{ .Token }}`, `{{ .Email }}`, dan `{{ .NewEmail }}`. Jangan mengganti `{{ .ConfirmationURL }}` dengan URL statis.

## Custom SMTP Kerjamail

Konfigurasi ini dilakukan di **Supabase Dashboard > Project Settings > Authentication > SMTP Settings**:

| Field | Value |
| --- | --- |
| Enable Custom SMTP | Aktif |
| Sender email | `ahlan@yahyanursidik.my.id` |
| Sender name | `LMS Ihsanul Adab` |
| Host | `mx.kerjamail.co` |
| Port | `587` |
| Username | `ahlan@yahyanursidik.my.id` |
| Password | Kata sandi mailbox, disimpan hanya di Supabase Dashboard |

Gunakan port `587` terlebih dahulu karena konfigurasi pada gambar memakai SMTP STARTTLS. Jika pengiriman gagal karena TLS/handshake dari provider, coba port `465` untuk SMTPS/SSL.

Checklist keamanan:

1. Jangan menyimpan password SMTP di `.env`, frontend, migration, atau repository.
2. Setelah konfigurasi berhasil, ganti password mailbox karena pernah dibagikan di chat.
3. Pastikan SPF, DKIM, dan DMARC domain `yahyanursidik.my.id` aktif di DNS agar email tidak mudah masuk spam.
4. Untuk production volume besar, pertimbangkan provider transactional email khusus seperti Resend, Postmark, SendGrid, atau AWS SES.

## URL dan pengujian

Di **Authentication > URL Configuration**:

- Site URL production: `https://hub.ihsanuladab.or.id/learner`.
- Tambahkan `http://127.0.0.1:5173/learner/auth/callback` untuk development.
- Tambahkan `http://127.0.0.1:5173/auth/update-password` untuk reset password development.
- Tambahkan URL callback production: `https://hub.ihsanuladab.or.id/learner/auth/callback`.
- Tambahkan URL reset password production: `https://hub.ihsanuladab.or.id/auth/update-password`.

Di environment production hosting, set:

```text
VITE_AUTH_REDIRECT_ORIGIN=https://hub.ihsanuladab.or.id
```

Variable ini memastikan email konfirmasi akun, Google OAuth callback, dan lupa password tidak mengambil origin lokal seperti `http://127.0.0.1:5173`.

Setelah SMTP dan template disimpan:

1. Daftar dengan satu alamat email uji baru.
2. Pastikan pengirim tampil sebagai `LMS Ihsanul Adab <ahlan@yahyanursidik.my.id>`.
3. Uji tombol konfirmasi dan tautan cadangan.
4. Dari halaman login portal, klik **Lupa kata sandi?** dan pastikan email reset masuk.
5. Periksa **Authentication > Logs** bila email tidak diterima.
6. Periksa folder spam dan status SPF, DKIM, serta DMARC domain.

Jangan menonaktifkan email confirmation hanya untuk melewati masalah pengiriman email.
