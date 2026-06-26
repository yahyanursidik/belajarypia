-- Add phone and education_level to participants
alter table public.participants
add column if not exists phone text,
add column if not exists education_level text;
