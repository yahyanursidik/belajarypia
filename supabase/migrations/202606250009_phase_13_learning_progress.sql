-- Migration: Tracking Learning Progress & Quiz Attempts

create table if not exists public.lesson_progresses (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.enrollments(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  status text not null default 'started' check (status in ('started', 'completed')),
  score numeric, -- Optional, if lesson is a quiz
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(enrollment_id, lesson_id)
);

create table if not exists public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.enrollments(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  attempt_number int not null default 1,
  score numeric,
  status text not null default 'ongoing' check (status in ('ongoing', 'submitted', 'abandoned')),
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.quiz_attempt_answers (
  id uuid primary key default gen_random_uuid(),
  quiz_attempt_id uuid not null references public.quiz_attempts(id) on delete cascade,
  question_id uuid not null references public.quiz_questions(id) on delete cascade,
  selected_option text,
  is_correct boolean,
  points_earned numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(quiz_attempt_id, question_id)
);

create index if not exists lesson_progresses_enrollment_id_idx on public.lesson_progresses(enrollment_id);
create index if not exists lesson_progresses_participant_id_idx on public.lesson_progresses(participant_id);
create index if not exists quiz_attempts_enrollment_id_idx on public.quiz_attempts(enrollment_id);
create index if not exists quiz_attempt_answers_attempt_id_idx on public.quiz_attempt_answers(quiz_attempt_id);

alter table public.lesson_progresses enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.quiz_attempt_answers enable row level security;

-- Policies
create policy "progress_select_admin" on public.lesson_progresses for select to authenticated
using (public.has_role('admin') or public.is_super_admin());

create policy "quiz_attempts_select_admin" on public.quiz_attempts for select to authenticated
using (public.has_role('admin') or public.is_super_admin());

create policy "quiz_answers_select_admin" on public.quiz_attempt_answers for select to authenticated
using (public.has_role('admin') or public.is_super_admin());
