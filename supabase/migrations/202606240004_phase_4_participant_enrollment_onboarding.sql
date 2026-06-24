create sequence if not exists public.participant_number_seq start 1;

create table if not exists public.participants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  global_participant_number text not null unique,
  display_name text not null,
  gender text,
  birth_date date,
  city text,
  participant_type text not null default 'adult',
  status text not null default 'active' check (status in ('active', 'inactive', 'archived')),
  joined_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.guardians (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  relation_type text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.guardian_participants (
  id uuid primary key default gen_random_uuid(),
  guardian_id uuid not null references public.guardians(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete cascade,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  unique (guardian_id, participant_id)
);

create table if not exists public.batches (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete cascade,
  code text not null,
  name text not null,
  start_date date,
  end_date date,
  enrollment_open_at timestamptz,
  enrollment_close_at timestamptz,
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  created_at timestamptz not null default now(),
  unique (program_id, code)
);

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete cascade,
  batch_id uuid references public.batches(id) on delete set null,
  code text not null,
  name text not null,
  capacity int,
  teacher_user_id uuid references public.profiles(id) on delete set null,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  unique (program_id, code)
);

create table if not exists public.halaqahs (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  code text not null,
  name text not null,
  capacity int,
  mentor_user_id uuid references public.profiles(id) on delete set null,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  unique (class_id, code)
);

create table if not exists public.enrollments (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.participants(id) on delete cascade,
  program_id uuid not null references public.programs(id) on delete restrict,
  batch_id uuid references public.batches(id) on delete set null,
  class_id uuid references public.classes(id) on delete set null,
  halaqah_id uuid references public.halaqahs(id) on delete set null,
  level_id uuid,
  track_id uuid,
  enrollment_number text not null unique,
  enrollment_status text not null default 'active' check (enrollment_status in ('pending', 'active', 'hold', 'completed', 'cancelled')),
  payment_status text not null default 'not_required',
  started_at timestamptz default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (participant_id, program_id)
);

create table if not exists public.enrollment_status_logs (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.enrollments(id) on delete cascade,
  old_status text,
  new_status text not null,
  reason text,
  changed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.onboarding_templates (
  id uuid primary key default gen_random_uuid(),
  program_id uuid references public.programs(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now()
);

create table if not exists public.onboarding_steps (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.onboarding_templates(id) on delete cascade,
  step_key text not null,
  title text not null,
  description text,
  order_no int not null default 0,
  is_required boolean not null default true,
  created_at timestamptz not null default now(),
  unique (template_id, step_key)
);

create table if not exists public.onboarding_progresses (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.participants(id) on delete cascade,
  enrollment_id uuid not null references public.enrollments(id) on delete cascade,
  template_id uuid references public.onboarding_templates(id) on delete set null,
  status text not null default 'not_started' check (status in ('not_started', 'in_progress', 'completed')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (enrollment_id)
);

create table if not exists public.onboarding_step_progresses (
  id uuid primary key default gen_random_uuid(),
  onboarding_progress_id uuid not null references public.onboarding_progresses(id) on delete cascade,
  step_key text not null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (onboarding_progress_id, step_key)
);

create table if not exists public.whatsapp_groups (
  id uuid primary key default gen_random_uuid(),
  scope_type text not null check (scope_type in ('program', 'batch', 'class', 'halaqah')),
  scope_id uuid not null,
  group_name text not null,
  invite_link text not null,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notification_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  event_type text not null,
  status text not null default 'pending',
  error_message text,
  metadata_json jsonb,
  created_at timestamptz not null default now()
);

create index if not exists participants_user_id_idx on public.participants(user_id);
create index if not exists batches_program_id_idx on public.batches(program_id);
create index if not exists classes_program_id_idx on public.classes(program_id);
create index if not exists classes_batch_id_idx on public.classes(batch_id);
create index if not exists halaqahs_class_id_idx on public.halaqahs(class_id);
create index if not exists enrollments_participant_id_idx on public.enrollments(participant_id);
create index if not exists enrollments_program_id_idx on public.enrollments(program_id);
create index if not exists onboarding_progresses_enrollment_id_idx on public.onboarding_progresses(enrollment_id);
create index if not exists whatsapp_groups_scope_idx on public.whatsapp_groups(scope_type, scope_id);
create index if not exists notification_logs_user_id_idx on public.notification_logs(user_id);

drop trigger if exists participants_set_updated_at on public.participants;
create trigger participants_set_updated_at
before update on public.participants
for each row execute function public.set_updated_at();

drop trigger if exists enrollments_set_updated_at on public.enrollments;
create trigger enrollments_set_updated_at
before update on public.enrollments
for each row execute function public.set_updated_at();

drop trigger if exists onboarding_progresses_set_updated_at on public.onboarding_progresses;
create trigger onboarding_progresses_set_updated_at
before update on public.onboarding_progresses
for each row execute function public.set_updated_at();

drop trigger if exists whatsapp_groups_set_updated_at on public.whatsapp_groups;
create trigger whatsapp_groups_set_updated_at
before update on public.whatsapp_groups
for each row execute function public.set_updated_at();

create or replace function public.next_participant_number()
returns text
language sql
volatile
security definer
set search_path = public
as $$
  select 'YPIA-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.participant_number_seq')::text, 6, '0');
$$;

create or replace function public.can_access_participant(target_participant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin()
    or exists (
      select 1
      from public.participants p
      where p.id = target_participant_id
        and p.user_id = auth.uid()
    )
    or exists (
      select 1
      from public.enrollments e
      where e.participant_id = target_participant_id
        and public.can_access_program(e.program_id)
    );
$$;

create or replace function public.can_access_enrollment(target_enrollment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin()
    or exists (
      select 1
      from public.enrollments e
      join public.participants p on p.id = e.participant_id
      where e.id = target_enrollment_id
        and (p.user_id = auth.uid() or public.can_access_program(e.program_id))
    );
$$;

create or replace function public.approve_applicant(
  target_applicant_id uuid,
  target_program_id uuid,
  target_batch_id uuid default null,
  target_class_id uuid default null,
  target_halaqah_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  applicant_record public.applicants%rowtype;
  applicant_user_id uuid;
  participant_role_id uuid;
  participant_id uuid;
  generated_participant_number text;
  generated_enrollment_number text;
  enrollment_id uuid;
  template_id uuid;
  actor_id uuid := auth.uid();
begin
  if not public.can_access_applicant(target_applicant_id) then
    raise exception 'Tidak memiliki akses ke applicant ini.';
  end if;

  if not public.can_access_program(target_program_id) then
    raise exception 'Tidak memiliki akses ke program ini.';
  end if;

  select * into applicant_record
  from public.applicants
  where id = target_applicant_id
  for update;

  if not found then
    raise exception 'Applicant tidak ditemukan.';
  end if;

  select id into applicant_user_id
  from public.profiles
  where lower(email) = lower(applicant_record.email)
  limit 1;

  select p.id into participant_id
  from public.participants p
  where p.user_id = applicant_user_id
     or lower(p.display_name) = lower(applicant_record.full_name)
  limit 1;

  if participant_id is null then
    generated_participant_number := public.next_participant_number();

    insert into public.participants (
      user_id,
      global_participant_number,
      display_name,
      gender,
      birth_date,
      city,
      status
    )
    values (
      applicant_user_id,
      generated_participant_number,
      applicant_record.full_name,
      applicant_record.gender,
      applicant_record.birth_date,
      applicant_record.city,
      'active'
    )
    returning id into participant_id;
  end if;

  generated_enrollment_number := 'ENR-' || to_char(now(), 'YYYY') || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);

  insert into public.enrollments (
    participant_id,
    program_id,
    batch_id,
    class_id,
    halaqah_id,
    enrollment_number,
    enrollment_status,
    payment_status,
    started_at
  )
  values (
    participant_id,
    target_program_id,
    target_batch_id,
    target_class_id,
    target_halaqah_id,
    generated_enrollment_number,
    'active',
    'not_required',
    now()
  )
  on conflict (participant_id, program_id) do update
  set batch_id = excluded.batch_id,
      class_id = excluded.class_id,
      halaqah_id = excluded.halaqah_id,
      enrollment_status = 'active',
      started_at = coalesce(public.enrollments.started_at, now())
  returning id into enrollment_id;

  insert into public.enrollment_status_logs (
    enrollment_id,
    old_status,
    new_status,
    reason,
    changed_by
  )
  values (enrollment_id, null, 'active', 'Applicant approved', actor_id);

  select id into template_id
  from public.onboarding_templates
  where status = 'active'
    and (program_id = target_program_id or program_id is null)
  order by program_id nulls last
  limit 1;

  if template_id is null then
    insert into public.onboarding_templates (program_id, title, description)
    values (target_program_id, 'Onboarding Peserta', 'Checklist awal sebelum belajar.')
    returning id into template_id;

    insert into public.onboarding_steps (template_id, step_key, title, description, order_no)
    values
      (template_id, 'complete_profile', 'Lengkapi Profil', 'Pastikan data profil sudah benar.', 1),
      (template_id, 'read_program_guide', 'Baca Panduan Program', 'Pahami alur belajar dan adab kelas.', 2),
      (template_id, 'join_whatsapp_group', 'Gabung Grup WhatsApp', 'Gabung jika program menyediakan grup WhatsApp.', 3);
  end if;

  insert into public.onboarding_progresses (
    participant_id,
    enrollment_id,
    template_id,
    status
  )
  values (participant_id, enrollment_id, template_id, 'not_started')
  on conflict (enrollment_id) do nothing;

  insert into public.onboarding_step_progresses (onboarding_progress_id, step_key)
  select op.id, os.step_key
  from public.onboarding_progresses op
  join public.onboarding_steps os on os.template_id = op.template_id
  where op.enrollment_id = enrollment_id
  on conflict do nothing;

  update public.applicants
  set status = 'accepted'
  where id = target_applicant_id;

  if applicant_user_id is not null then
    select id into participant_role_id from public.roles where code = 'participant';

    insert into public.user_roles (user_id, role_id, scope_type, scope_id)
    values (applicant_user_id, participant_role_id, 'own', participant_id)
    on conflict do nothing;
  end if;

  insert into public.notification_logs (user_id, event_type, status, metadata_json)
  values (
    applicant_user_id,
    'welcome_email_placeholder',
    'pending',
    jsonb_build_object(
      'applicant_id', target_applicant_id,
      'participant_id', participant_id,
      'enrollment_id', enrollment_id,
      'program_id', target_program_id,
      'note', 'Email welcome belum dikirim; placeholder log untuk Phase 4.'
    )
  );

  return jsonb_build_object(
    'participant_id', participant_id,
    'enrollment_id', enrollment_id
  );
end;
$$;

alter table public.participants enable row level security;
alter table public.guardians enable row level security;
alter table public.guardian_participants enable row level security;
alter table public.batches enable row level security;
alter table public.classes enable row level security;
alter table public.halaqahs enable row level security;
alter table public.enrollments enable row level security;
alter table public.enrollment_status_logs enable row level security;
alter table public.onboarding_templates enable row level security;
alter table public.onboarding_steps enable row level security;
alter table public.onboarding_progresses enable row level security;
alter table public.onboarding_step_progresses enable row level security;
alter table public.whatsapp_groups enable row level security;
alter table public.notification_logs enable row level security;

drop policy if exists "participants_select_accessible" on public.participants;
create policy "participants_select_accessible"
on public.participants for select to authenticated
using (public.can_access_participant(id));

drop policy if exists "participants_manage_super_admin" on public.participants;
create policy "participants_manage_super_admin"
on public.participants for all to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

drop policy if exists "batches_select_accessible" on public.batches;
create policy "batches_select_accessible"
on public.batches for select to authenticated
using (public.can_access_program(program_id));

drop policy if exists "classes_select_accessible" on public.classes;
create policy "classes_select_accessible"
on public.classes for select to authenticated
using (public.can_access_program(program_id));

drop policy if exists "halaqahs_select_accessible" on public.halaqahs;
create policy "halaqahs_select_accessible"
on public.halaqahs for select to authenticated
using (
  exists (
    select 1 from public.classes c
    where c.id = halaqahs.class_id
      and public.can_access_program(c.program_id)
  )
);

drop policy if exists "enrollments_select_accessible" on public.enrollments;
create policy "enrollments_select_accessible"
on public.enrollments for select to authenticated
using (public.can_access_enrollment(id));

drop policy if exists "enrollments_manage_super_admin" on public.enrollments;
create policy "enrollments_manage_super_admin"
on public.enrollments for all to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

drop policy if exists "onboarding_templates_select_authenticated" on public.onboarding_templates;
create policy "onboarding_templates_select_authenticated"
on public.onboarding_templates for select to authenticated
using (true);

drop policy if exists "onboarding_steps_select_authenticated" on public.onboarding_steps;
create policy "onboarding_steps_select_authenticated"
on public.onboarding_steps for select to authenticated
using (true);

drop policy if exists "onboarding_progresses_select_accessible" on public.onboarding_progresses;
create policy "onboarding_progresses_select_accessible"
on public.onboarding_progresses for select to authenticated
using (public.can_access_enrollment(enrollment_id));

drop policy if exists "onboarding_step_progresses_select_accessible" on public.onboarding_step_progresses;
create policy "onboarding_step_progresses_select_accessible"
on public.onboarding_step_progresses for select to authenticated
using (
  exists (
    select 1 from public.onboarding_progresses op
    where op.id = onboarding_step_progresses.onboarding_progress_id
      and public.can_access_enrollment(op.enrollment_id)
  )
);

drop policy if exists "whatsapp_groups_select_eligible" on public.whatsapp_groups;
create policy "whatsapp_groups_select_eligible"
on public.whatsapp_groups for select to authenticated
using (
  public.is_super_admin()
  or exists (
    select 1
    from public.enrollments e
    join public.programs p on p.id = e.program_id
    join public.participants pt on pt.id = e.participant_id
    where e.enrollment_status = 'active'
      and coalesce((p.feature_flags->>'use_whatsapp_group')::boolean, false) = true
      and pt.user_id = auth.uid()
      and (
        (whatsapp_groups.scope_type = 'program' and whatsapp_groups.scope_id = e.program_id)
        or (whatsapp_groups.scope_type = 'batch' and whatsapp_groups.scope_id = e.batch_id)
        or (whatsapp_groups.scope_type = 'class' and whatsapp_groups.scope_id = e.class_id)
        or (whatsapp_groups.scope_type = 'halaqah' and whatsapp_groups.scope_id = e.halaqah_id)
      )
  )
);

drop policy if exists "notification_logs_select_own_or_admin" on public.notification_logs;
create policy "notification_logs_select_own_or_admin"
on public.notification_logs for select to authenticated
using (user_id = auth.uid() or public.is_super_admin() or public.has_role('admin'));
