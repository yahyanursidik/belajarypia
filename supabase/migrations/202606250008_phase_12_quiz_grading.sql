-- Migration: Pengaturan nilai kuis & ujian (Grading Settings)

-- Tambah kolom di tabel lessons untuk pengaturan kuis
alter table public.lessons add column if not exists passing_grade int;
alter table public.lessons add column if not exists duration_minutes int;
alter table public.lessons add column if not exists max_attempts int;

-- Tambah kolom points (bobot nilai) pada soal kuis dan soal di bank soal
alter table public.quiz_questions add column if not exists points int not null default 10;
alter table public.question_bank_items add column if not exists points int not null default 10;
