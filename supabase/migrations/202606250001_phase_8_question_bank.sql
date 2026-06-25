create table if not exists public.question_banks (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.question_bank_items (
  id uuid primary key default gen_random_uuid(),
  question_bank_id uuid not null references public.question_banks(id) on delete cascade,
  question_type text not null default 'multiple_choice',
  question_text text not null,
  options jsonb default '[]'::jsonb,
  correct_answer text,
  explanation text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  question_type text not null default 'multiple_choice',
  question_text text not null,
  options jsonb default '[]'::jsonb,
  correct_answer text,
  explanation text,
  order_no int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists question_banks_program_id_idx on public.question_banks(program_id);
create index if not exists question_bank_items_question_bank_id_idx on public.question_bank_items(question_bank_id);
create index if not exists quiz_questions_lesson_id_idx on public.quiz_questions(lesson_id);

alter table public.question_banks enable row level security;
alter table public.question_bank_items enable row level security;
alter table public.quiz_questions enable row level security;

-- Policies for question_banks
drop policy if exists "question_banks_select_accessible" on public.question_banks;
create policy "question_banks_select_accessible"
on public.question_banks for select to authenticated
using (
  public.has_role('admin') or public.has_role('teacher') or public.has_role('mentor') or public.is_super_admin()
);

drop policy if exists "question_banks_manage" on public.question_banks;
create policy "question_banks_manage"
on public.question_banks for all to authenticated
using (
  public.can_access_program(program_id)
  and (public.has_role('admin') or public.has_role('teacher') or public.has_role('mentor') or public.is_super_admin())
)
with check (
  public.can_access_program(program_id)
  and (public.has_role('admin') or public.has_role('teacher') or public.has_role('mentor') or public.is_super_admin())
);

-- Policies for question_bank_items
drop policy if exists "question_bank_items_select_accessible" on public.question_bank_items;
create policy "question_bank_items_select_accessible"
on public.question_bank_items for select to authenticated
using (
  public.has_role('admin') or public.has_role('teacher') or public.has_role('mentor') or public.is_super_admin()
);

drop policy if exists "question_bank_items_manage" on public.question_bank_items;
create policy "question_bank_items_manage"
on public.question_bank_items for all to authenticated
using (
  exists (
    select 1 from public.question_banks qb
    where qb.id = question_bank_items.question_bank_id
    and public.can_access_program(qb.program_id)
    and (public.has_role('admin') or public.has_role('teacher') or public.has_role('mentor') or public.is_super_admin())
  )
)
with check (
  exists (
    select 1 from public.question_banks qb
    where qb.id = question_bank_items.question_bank_id
    and public.can_access_program(qb.program_id)
    and (public.has_role('admin') or public.has_role('teacher') or public.has_role('mentor') or public.is_super_admin())
  )
);

-- Policies for quiz_questions
drop policy if exists "quiz_questions_select_accessible" on public.quiz_questions;
create policy "quiz_questions_select_accessible"
on public.quiz_questions for select to authenticated
using (public.can_access_lesson(lesson_id));

drop policy if exists "quiz_questions_manage" on public.quiz_questions;
create policy "quiz_questions_manage"
on public.quiz_questions for all to authenticated
using (
  exists (
    select 1 from public.lessons l
    join public.program_modules pm on pm.id = l.module_id
    where l.id = quiz_questions.lesson_id
      and public.can_access_program(pm.program_id)
      and (public.has_role('admin') or public.has_role('teacher') or public.has_role('mentor') or public.is_super_admin())
  )
)
with check (
  exists (
    select 1 from public.lessons l
    join public.program_modules pm on pm.id = l.module_id
    where l.id = quiz_questions.lesson_id
      and public.can_access_program(pm.program_id)
      and (public.has_role('admin') or public.has_role('teacher') or public.has_role('mentor') or public.is_super_admin())
  )
);
