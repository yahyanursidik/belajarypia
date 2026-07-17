alter table public.programs
  add column if not exists graduation_settings jsonb not null default '{
    "minimum_final_score": 65,
    "minimum_completion_percent": 100,
    "require_all_assessments_passed": true,
    "require_payment_clearance": false
  }'::jsonb;

create table if not exists public.program_graduation_results (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete cascade,
  enrollment_id uuid not null references public.enrollments(id) on delete cascade,
  final_score numeric(5,2),
  completion_percent numeric(5,2) not null default 0,
  predicate text,
  status text not null default 'eligible' check (status in ('eligible', 'graduated', 'revision')),
  notes text,
  decided_by uuid references public.profiles(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (enrollment_id)
);

create index if not exists program_graduation_results_program_id_idx
  on public.program_graduation_results(program_id, status);

drop trigger if exists program_graduation_results_set_updated_at on public.program_graduation_results;
create trigger program_graduation_results_set_updated_at
before update on public.program_graduation_results
for each row execute function public.set_updated_at();

alter table public.program_graduation_results enable row level security;

drop policy if exists "graduation_results_manage_staff" on public.program_graduation_results;
create policy "graduation_results_manage_staff"
on public.program_graduation_results
for all
to authenticated
using (
  exists (
    select 1
    from public.programs p
    where p.id = program_graduation_results.program_id
      and public.has_unit_access(p.unit_id)
  )
)
with check (
  exists (
    select 1
    from public.programs p
    where p.id = program_graduation_results.program_id
      and public.has_unit_access(p.unit_id)
  )
);

drop policy if exists "graduation_results_select_participant" on public.program_graduation_results;
create policy "graduation_results_select_participant"
on public.program_graduation_results
for select
to authenticated
using (
  exists (
    select 1
    from public.enrollments e
    join public.participants pt on pt.id = e.participant_id
    where e.id = program_graduation_results.enrollment_id
      and pt.user_id = auth.uid()
  )
);

create or replace function public.finalize_program_graduation(
  target_enrollment_id uuid,
  target_final_score numeric,
  target_completion_percent numeric,
  target_predicate text,
  target_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_program_id uuid;
  target_unit_id uuid;
  old_enrollment_status text;
  result_id uuid;
begin
  select e.program_id, p.unit_id, e.enrollment_status
    into target_program_id, target_unit_id, old_enrollment_status
  from public.enrollments e
  join public.programs p on p.id = e.program_id
  where e.id = target_enrollment_id;

  if target_program_id is null then
    raise exception 'Enrollment tidak ditemukan';
  end if;

  if not public.has_unit_access(target_unit_id) then
    raise exception 'Anda tidak memiliki akses untuk menetapkan kelulusan';
  end if;

  insert into public.program_graduation_results (
    program_id,
    enrollment_id,
    final_score,
    completion_percent,
    predicate,
    status,
    notes,
    decided_by,
    decided_at
  ) values (
    target_program_id,
    target_enrollment_id,
    target_final_score,
    target_completion_percent,
    nullif(trim(target_predicate), ''),
    'graduated',
    nullif(trim(target_notes), ''),
    auth.uid(),
    now()
  )
  on conflict (enrollment_id) do update set
    final_score = excluded.final_score,
    completion_percent = excluded.completion_percent,
    predicate = excluded.predicate,
    status = 'graduated',
    notes = excluded.notes,
    decided_by = auth.uid(),
    decided_at = now()
  returning id into result_id;

  update public.enrollments
  set enrollment_status = 'completed', ended_at = coalesce(ended_at, now()), updated_at = now()
  where id = target_enrollment_id;

  if old_enrollment_status is distinct from 'completed' then
    insert into public.enrollment_status_logs (enrollment_id, old_status, new_status, reason, changed_by)
    values (
      target_enrollment_id,
      old_enrollment_status,
      'completed',
      'Kelulusan program ditetapkan melalui workflow akademik',
      auth.uid()
    );
  end if;

  return result_id;
end;
$$;

grant execute on function public.finalize_program_graduation(uuid, numeric, numeric, text, text) to authenticated;
