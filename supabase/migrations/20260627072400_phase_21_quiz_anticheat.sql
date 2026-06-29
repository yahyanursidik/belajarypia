-- Migration: Fitur Anti-Cheat Kuis & Ujian (Strict Mode)

-- Tambah kolom konfigurasi Strict Mode ke dalam pengaturan lessons
alter table public.lessons add column if not exists is_strict_mode boolean not null default false;
alter table public.lessons add column if not exists max_tab_switches int not null default 3;
