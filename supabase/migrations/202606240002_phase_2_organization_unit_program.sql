create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  legal_name text,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.units (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null,
  name text not null,
  description text,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);

create table if not exists public.unit_users (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role_in_unit text not null default 'admin',
  created_at timestamptz not null default now(),
  unique (unit_id, user_id, role_in_unit)
);

create table if not exists public.programs (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id) on delete cascade,
  code text not null,
  name text not null,
  description text,
  program_type text not null default 'general',
  curriculum_model text not null default 'cohort',
  delivery_mode text not null default 'online',
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  feature_flags jsonb not null default '{
    "use_payment": false,
    "use_whatsapp_group": false,
    "use_quran_engine": false,
    "use_forum": false,
    "use_certificate": false,
    "use_live_session": false,
    "use_parent_portal": false,
    "use_assignment": false,
    "use_attendance": false,
    "use_document_upload": false,
    "use_ai_assist": false,
    "use_audio_submission": false,
    "use_video_submission": false
  }'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (unit_id, code),
  constraint programs_mvp_forbidden_flags_false check (
    coalesce((feature_flags->>'use_ai_assist')::boolean, false) = false
    and coalesce((feature_flags->>'use_audio_submission')::boolean, false) = false
    and coalesce((feature_flags->>'use_video_submission')::boolean, false) = false
  )
);

create index if not exists units_organization_id_idx on public.units(organization_id);
create index if not exists unit_users_unit_id_idx on public.unit_users(unit_id);
create index if not exists unit_users_user_id_idx on public.unit_users(user_id);
create index if not exists programs_unit_id_idx on public.programs(unit_id);
create index if not exists programs_status_idx on public.programs(status);

drop trigger if exists organizations_set_updated_at on public.organizations;
create trigger organizations_set_updated_at
before update on public.organizations
for each row execute function public.set_updated_at();

drop trigger if exists units_set_updated_at on public.units;
create trigger units_set_updated_at
before update on public.units
for each row execute function public.set_updated_at();

drop trigger if exists programs_set_updated_at on public.programs;
create trigger programs_set_updated_at
before update on public.programs
for each row execute function public.set_updated_at();

create or replace function public.has_unit_access(target_unit_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin()
    or exists (
      select 1
      from public.unit_users uu
      where uu.unit_id = target_unit_id
        and uu.user_id = auth.uid()
    )
    or exists (
      select 1
      from public.user_roles ur
      join public.roles r on r.id = ur.role_id
      where ur.user_id = auth.uid()
        and r.code = 'admin'
        and ur.scope_type = 'unit'
        and ur.scope_id = target_unit_id
    );
$$;

insert into public.permissions (code, name, module)
values
  ('organizations.manage', 'Mengelola organisasi dan unit', 'organization'),
  ('units.manage', 'Mengelola unit', 'organization')
on conflict (code) do update
set name = excluded.name,
    module = excluded.module;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code in ('organizations.manage', 'units.manage')
where r.code = 'super_admin'
on conflict do nothing;

alter table public.organizations enable row level security;
alter table public.units enable row level security;
alter table public.unit_users enable row level security;
alter table public.programs enable row level security;

drop policy if exists "organizations_select_visible" on public.organizations;
create policy "organizations_select_visible"
on public.organizations
for select
to authenticated
using (
  public.is_super_admin()
  or exists (
    select 1
    from public.units u
    where u.organization_id = organizations.id
      and public.has_unit_access(u.id)
  )
);

drop policy if exists "organizations_manage_super_admin" on public.organizations;
create policy "organizations_manage_super_admin"
on public.organizations
for all
to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

drop policy if exists "units_select_visible" on public.units;
create policy "units_select_visible"
on public.units
for select
to authenticated
using (public.has_unit_access(id));

drop policy if exists "units_manage_super_admin" on public.units;
create policy "units_manage_super_admin"
on public.units
for all
to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

drop policy if exists "unit_users_select_visible" on public.unit_users;
create policy "unit_users_select_visible"
on public.unit_users
for select
to authenticated
using (public.is_super_admin() or user_id = auth.uid() or public.has_unit_access(unit_id));

drop policy if exists "unit_users_manage_super_admin" on public.unit_users;
create policy "unit_users_manage_super_admin"
on public.unit_users
for all
to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

drop policy if exists "programs_select_visible" on public.programs;
create policy "programs_select_visible"
on public.programs
for select
to authenticated
using (public.has_unit_access(unit_id));

drop policy if exists "programs_insert_assigned_admin_or_super_admin" on public.programs;
create policy "programs_insert_assigned_admin_or_super_admin"
on public.programs
for insert
to authenticated
with check (public.is_super_admin() or (public.has_role('admin') and public.has_unit_access(unit_id)));

drop policy if exists "programs_update_assigned_admin_or_super_admin" on public.programs;
create policy "programs_update_assigned_admin_or_super_admin"
on public.programs
for update
to authenticated
using (public.is_super_admin() or (public.has_role('admin') and public.has_unit_access(unit_id)))
with check (public.is_super_admin() or (public.has_role('admin') and public.has_unit_access(unit_id)));

drop policy if exists "programs_delete_super_admin" on public.programs;
create policy "programs_delete_super_admin"
on public.programs
for delete
to authenticated
using (public.is_super_admin());
