-- Migration: Add teacher_user_id to programs for direct program-level teacher assignment
-- Phase 25: Program Teacher Assignment

alter table public.programs add column if not exists teacher_user_id uuid references public.profiles(id) on delete set null;

-- Update the can_teach_program function to also check the programs table directly
create or replace function public.can_teach_program(target_program_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.programs p
    where p.id = target_program_id
      and p.teacher_user_id = auth.uid()
  )
  or exists (
    select 1
    from public.classes c
    where c.program_id = target_program_id
      and c.teacher_user_id = auth.uid()
      and c.status = 'active'
  )
  or exists (
    select 1
    from public.halaqahs h
    join public.classes c on c.id = h.class_id
    where c.program_id = target_program_id
      and h.mentor_user_id = auth.uid()
      and h.status = 'active'
  );
$$;
