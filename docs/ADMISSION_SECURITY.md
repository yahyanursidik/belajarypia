# Pendaftaran Publik yang Aman

Pendaftaran program memakai Cloudflare Turnstile dan Supabase Edge Function `submit-admission`. Nomor WhatsApp tidak disimpan saat pengguna mengetik. Data disimpan hanya setelah tombol kirim ditekan, Turnstile tervalidasi di server, dan seluruh data formulir lolos validasi database.

## Aktivasi

1. Terapkan migration `supabase/migrations/202608160001_harden_admission_submission.sql` di Supabase SQL Editor.
2. Pastikan `VITE_TURNSTILE_SITE_KEY` tersedia di environment frontend Vercel dan situs `hub.ihsanuladab.or.id` sudah diizinkan dalam widget Cloudflare Turnstile.
3. Tambahkan secret server-side di Supabase:

```bash
supabase secrets set TURNSTILE_SECRET_KEY=nilai-secret-dari-cloudflare
```

4. Deploy function tanpa JWT gateway karena pendaftaran publik memang belum login. Keamanannya ditangani oleh verifikasi Turnstile server-side.

```bash
supabase functions deploy submit-admission --no-verify-jwt
```

Jangan menaruh `TURNSTILE_SECRET_KEY` pada Vercel atau variabel `VITE_*`.

## Perubahan Perilaku

- Nomor WhatsApp selalu dapat diedit pada formulir pendaftaran.
- Untuk pengguna yang sudah login, email mengikuti akun aktif dan tidak dapat diganti dari formulir.
- Nama serta nomor WhatsApp pengguna yang sudah login diperbarui ke profil hanya setelah pendaftaran berhasil disimpan.
- Pendaftaran aktif dengan email yang sama untuk program yang sama ditolak untuk mencegah duplikasi.
- Data pendaftar, pilihan program, dan jawaban formulir dibuat dalam satu transaksi.
- Unggahan formulir dibatasi ke PDF, dokumen Office, JPG, PNG, dan WebP hingga 10MB. Audio dan video ditolak.
