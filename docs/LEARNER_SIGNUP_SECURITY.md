# Keamanan Auth dan Pendaftaran Mandiri Peserta

Seluruh login password dan pendaftaran mandiri menggunakan Cloudflare Turnstile yang diverifikasi oleh Supabase Auth. CAPTCHA matematika atau pencocokan teks buatan sendiri tidak dipakai sebagai kontrol utama karena dapat dilewati dengan memanggil endpoint Auth secara langsung.

## Alur perlindungan

1. Widget Turnstile menghasilkan token sekali pakai di browser.
2. Frontend mengirim token melalui parameter `captchaToken` pada `supabase.auth.signInWithPassword` atau `supabase.auth.signUp`.
3. Supabase Auth memverifikasi token menggunakan secret key yang tersimpan di Supabase.
4. Login atau signup ditolak bila token hilang, tidak valid, sudah digunakan, atau kedaluwarsa.

Karena toggle CAPTCHA Supabase Auth berlaku pada endpoint Auth yang dilindungi, widget harus tersedia pada login Admin, Pengajar, Musyrif, Peserta, serta pendaftaran Peserta. Google OAuth tetap mengikuti perlindungan dan verifikasi dari Google.

Secret key Turnstile tidak boleh berada di Vite env, source code, migration, atau repository.

## Aktivasi

Urutan aktivasi penting agar pendaftaran tidak terputus.

1. Buat widget **Managed Turnstile** di Cloudflare.
2. Masukkan domain production aplikasi ke daftar hostname widget.
3. Tambahkan site key publik ke environment frontend:

   ```env
   VITE_TURNSTILE_SITE_KEY=site-key-dari-cloudflare
   ```

4. Build dan deploy frontend sampai widget tampil di mode **Daftar Peserta**.
5. Buka **Supabase Dashboard > Authentication > Settings > Bot and Abuse Protection**.
6. Aktifkan CAPTCHA, pilih **Cloudflare Turnstile**, lalu masukkan secret key.
7. Uji signup berhasil, token kedaluwarsa, percobaan tanpa token, dan percobaan berulang.

Untuk development, gunakan testing site key resmi Cloudflare atau tambahkan hostname development sesuai konfigurasi widget.

## Lapisan keamanan tambahan

- Pertahankan konfirmasi email sebelum akun dapat digunakan.
- Atur Auth rate limits di Supabase sesuai volume pendaftaran.
- Aktifkan RLS dan batasi fungsi database dengan pemeriksaan `auth.uid()`.
- Jangan menggunakan service-role key di frontend.
- Validasi panjang dan format setiap input pada server atau fungsi database.
- Pantau Auth logs, lonjakan signup, dan kegagalan CAPTCHA.
- Tambahkan WAF/rate limiting pada domain production jika serangan meningkat.

Turnstile mengurangi bot dan abuse, tetapi tidak menggantikan RLS, validasi database, CSP, audit log, dan pembatasan hak akses.
