-- Migration: Penambahan field syllabus pada tabel programs
alter table public.programs add column if not exists syllabus text;
