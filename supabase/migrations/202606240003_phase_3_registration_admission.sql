create table if not exists public.registration_forms (
  id uuid primary key default gen_random_uuid(),
  program_id uuid references public.programs(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.registration_form_fields (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.registration_forms(id) on delete cascade,
  field_key text not null,
  label text not null,
  field_type text not null default 'text' check (field_type in ('text', 'textarea', 'email', 'phone', 'select')),
  is_required boolean not null default false,
  options_json jsonb,
  order_no int not null default 0,
  created_at timestamptz not null default now(),
  unique (form_id, field_key)
);

create table if not exists public.applicants (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null,
  phone text not null,
  city text,
  gender text,
  birth_date date,
  source_channel text,
  status text not null default 'submitted' check (
    status in ('draft', 'submitted', 'under_review', 'revision_requested', 'accepted', 'rejected')
  ),
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.applicant_program_choices (
  id uuid primary key default gen_random_uuid(),
  applicant_id uuid not null references public.applicants(id) on delete cascade,
  program_id uuid not null references public.programs(id) on delete restrict,
  preferred_batch_id uuid,
  preferred_schedule text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.applicant_answers (
  id uuid primary key default gen_random_uuid(),
  applicant_id uuid not null references public.applicants(id) on delete cascade,
  form_field_key text not null,
  value_text text,
  value_json jsonb,
  created_at timestamptz not null default now()
);

create index if not exists registration_forms_program_id_idx on public.registration_forms(program_id);
create index if not exists registration_form_fields_form_id_idx on public.registration_form_fields(form_id);
create index if not exists applicants_status_idx on public.applicants(status);
create index if not exists applicants_email_idx on public.applicants(email);
create index if not exists applicant_program_choices_applicant_id_idx on public.applicant_program_choices(applicant_id);
create index if not exists applicant_program_choices_program_id_idx on public.applicant_program_choices(program_id);
create index if not exists applicant_answers_applicant_id_idx on public.applicant_answers(applicant_id);

drop trigger if exists registration_forms_set_updated_at on public.registration_forms;
create trigger registration_forms_set_updated_at
before update on public.registration_forms
for each row execute function public.set_updated_at();

drop trigger if exists applicants_set_updated_at on public.applicants;
create trigger applicants_set_updated_at
before update on public.applicants
for each row execute function public.set_updated_at();

create or replace function public.can_access_program(target_program_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin()
    or exists (
      select 1
      from public.programs p
      where p.id = target_program_id
        and public.has_unit_access(p.unit_id)
    );
$$;

create or replace function public.can_access_applicant(target_applicant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin()
    or exists (
      select 1
      from public.applicant_program_choices apc
      where apc.applicant_id = target_applicant_id
        and public.can_access_program(apc.program_id)
    );
$$;

insert into public.permissions (code, name, module)
values
  ('admission.manage', 'Mengelola pendaftaran', 'admission')
on conflict (code) do update
set name = excluded.name,
    module = excluded.module;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code = 'admission.manage'
where r.code in ('super_admin', 'admin')
on conflict do nothing;

alter table public.registration_forms enable row level security;
alter table public.registration_form_fields enable row level security;
alter table public.applicants enable row level security;
alter table public.applicant_program_choices enable row level security;
alter table public.applicant_answers enable row level security;

drop policy if exists "programs_select_public_active" on public.programs;
create policy "programs_select_public_active"
on public.programs
for select
to anon
using (status = 'active');

drop policy if exists "registration_forms_select_public_active" on public.registration_forms;
create policy "registration_forms_select_public_active"
on public.registration_forms
for select
to anon, authenticated
using (
  status = 'active'
  and (
    program_id is null
    or exists (
      select 1 from public.programs p
      where p.id = registration_forms.program_id
        and p.status = 'active'
    )
  )
);

drop policy if exists "registration_forms_manage_super_admin_or_admin" on public.registration_forms;
create policy "registration_forms_manage_super_admin_or_admin"
on public.registration_forms
for all
to authenticated
using (public.is_super_admin() or public.has_role('admin'))
with check (public.is_super_admin() or public.has_role('admin'));

drop policy if exists "registration_form_fields_select_public_active" on public.registration_form_fields;
create policy "registration_form_fields_select_public_active"
on public.registration_form_fields
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.registration_forms rf
    where rf.id = registration_form_fields.form_id
      and rf.status = 'active'
  )
);

drop policy if exists "registration_form_fields_manage_super_admin_or_admin" on public.registration_form_fields;
create policy "registration_form_fields_manage_super_admin_or_admin"
on public.registration_form_fields
for all
to authenticated
using (public.is_super_admin() or public.has_role('admin'))
with check (public.is_super_admin() or public.has_role('admin'));

drop policy if exists "applicants_public_insert" on public.applicants;
create policy "applicants_public_insert"
on public.applicants
for insert
to anon, authenticated
with check (status = 'submitted');

drop policy if exists "applicants_admin_select_scoped" on public.applicants;
create policy "applicants_admin_select_scoped"
on public.applicants
for select
to authenticated
using (public.can_access_applicant(id));

drop policy if exists "applicants_admin_update_scoped" on public.applicants;
create policy "applicants_admin_update_scoped"
on public.applicants
for update
to authenticated
using (public.can_access_applicant(id))
with check (public.can_access_applicant(id));

drop policy if exists "applicant_program_choices_public_insert" on public.applicant_program_choices;
create policy "applicant_program_choices_public_insert"
on public.applicant_program_choices
for insert
to anon, authenticated
with check (
  exists (
    select 1 from public.programs p
    where p.id = applicant_program_choices.program_id
      and p.status = 'active'
  )
);

drop policy if exists "applicant_program_choices_admin_select_scoped" on public.applicant_program_choices;
create policy "applicant_program_choices_admin_select_scoped"
on public.applicant_program_choices
for select
to authenticated
using (public.can_access_program(program_id));

drop policy if exists "applicant_answers_public_insert" on public.applicant_answers;
create policy "applicant_answers_public_insert"
on public.applicant_answers
for insert
to anon, authenticated
with check (true);

drop policy if exists "applicant_answers_admin_select_scoped" on public.applicant_answers;
create policy "applicant_answers_admin_select_scoped"
on public.applicant_answers
for select
to authenticated
using (public.can_access_applicant(applicant_id));
