create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  phone text,
  avatar_url text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.permissions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  module text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  scope_type text,
  scope_id uuid,
  created_at timestamptz not null default now(),
  unique (user_id, role_id, scope_type, scope_id)
);

create table if not exists public.role_permissions (
  id uuid primary key default gen_random_uuid(),
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (role_id, permission_id)
);

create index if not exists profiles_email_idx on public.profiles(email);
create index if not exists roles_code_idx on public.roles(code);
create index if not exists permissions_code_idx on public.permissions(code);
create index if not exists user_roles_user_id_idx on public.user_roles(user_id);
create index if not exists user_roles_role_id_idx on public.user_roles(role_id);
create index if not exists role_permissions_role_id_idx on public.role_permissions(role_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.email
  )
  on conflict (id) do update
  set email = excluded.email,
      full_name = coalesce(public.profiles.full_name, excluded.full_name);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.has_role(role_code text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid()
      and r.code = role_code
  );
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_role('super_admin');
$$;

insert into public.roles (code, name, description)
values
  ('super_admin', 'Super Admin', 'Akses governance sistem global.'),
  ('admin', 'Admin', 'Akses operasional unit/program.'),
  ('teacher', 'Pengajar', 'Akses workspace pengajar.'),
  ('mentor', 'Mentor', 'Akses workspace mentoring dan halaqah.'),
  ('participant', 'Peserta', 'Akses portal belajar peserta.'),
  ('guardian', 'Wali', 'Akses portal wali peserta.'),
  ('finance', 'Keuangan', 'Akses operasional keuangan.'),
  ('helpdesk', 'Helpdesk', 'Akses dukungan pengguna.'),
  ('content_reviewer', 'Reviewer Konten', 'Akses review konten.')
on conflict (code) do update
set name = excluded.name,
    description = excluded.description;

insert into public.permissions (code, name, module)
values
  ('dashboard.view', 'Melihat dashboard', 'dashboard'),
  ('users.manage', 'Mengelola pengguna dan role', 'identity'),
  ('programs.manage', 'Mengelola program', 'program'),
  ('classes.manage', 'Mengelola kelas', 'academic'),
  ('learning.view', 'Mengakses pembelajaran', 'learning'),
  ('finance.manage', 'Mengelola keuangan', 'finance'),
  ('helpdesk.manage', 'Mengelola helpdesk', 'helpdesk'),
  ('audit.view', 'Melihat audit', 'system')
on conflict (code) do update
set name = excluded.name,
    module = excluded.module;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code in (
  'dashboard.view',
  'users.manage',
  'programs.manage',
  'classes.manage',
  'learning.view',
  'finance.manage',
  'helpdesk.manage',
  'audit.view'
)
where r.code = 'super_admin'
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code in ('dashboard.view', 'programs.manage', 'classes.manage')
where r.code = 'admin'
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code in ('dashboard.view', 'classes.manage')
where r.code in ('teacher', 'mentor')
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code in ('dashboard.view', 'learning.view')
where r.code in ('participant', 'guardian')
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code in ('dashboard.view', 'finance.manage')
where r.code = 'finance'
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code in ('dashboard.view', 'helpdesk.manage')
where r.code = 'helpdesk'
on conflict do nothing;

alter table public.profiles enable row level security;
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.user_roles enable row level security;
alter table public.role_permissions enable row level security;

drop policy if exists "profiles_select_own_or_super_admin" on public.profiles;
create policy "profiles_select_own_or_super_admin"
on public.profiles
for select
to authenticated
using (id = auth.uid() or public.is_super_admin());

drop policy if exists "profiles_update_own_or_super_admin" on public.profiles;
create policy "profiles_update_own_or_super_admin"
on public.profiles
for update
to authenticated
using (id = auth.uid() or public.is_super_admin())
with check (id = auth.uid() or public.is_super_admin());

drop policy if exists "roles_select_authenticated" on public.roles;
create policy "roles_select_authenticated"
on public.roles
for select
to authenticated
using (true);

drop policy if exists "roles_manage_super_admin" on public.roles;
create policy "roles_manage_super_admin"
on public.roles
for all
to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

drop policy if exists "permissions_select_authenticated" on public.permissions;
create policy "permissions_select_authenticated"
on public.permissions
for select
to authenticated
using (true);

drop policy if exists "permissions_manage_super_admin" on public.permissions;
create policy "permissions_manage_super_admin"
on public.permissions
for all
to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

drop policy if exists "user_roles_select_own_or_super_admin" on public.user_roles;
create policy "user_roles_select_own_or_super_admin"
on public.user_roles
for select
to authenticated
using (user_id = auth.uid() or public.is_super_admin());

drop policy if exists "user_roles_manage_super_admin" on public.user_roles;
create policy "user_roles_manage_super_admin"
on public.user_roles
for all
to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

drop policy if exists "role_permissions_select_authenticated" on public.role_permissions;
create policy "role_permissions_select_authenticated"
on public.role_permissions
for select
to authenticated
using (true);

drop policy if exists "role_permissions_manage_super_admin" on public.role_permissions;
create policy "role_permissions_manage_super_admin"
on public.role_permissions
for all
to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());
