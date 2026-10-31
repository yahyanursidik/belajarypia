alter table public.profiles add column phone text,add column created_at timestamptz default now(),add column updated_at timestamptz default now();
alter table auth.users add column last_sign_in_at timestamptz,add column banned_until timestamptz;
alter table public.roles add column name text;
alter table public.user_roles drop constraint user_roles_user_id_role_id_key;
alter table public.user_roles add column id uuid primary key default gen_random_uuid(),add column scope_type text,add column scope_id uuid,add column created_at timestamptz default now();
create table public.units(id uuid primary key default gen_random_uuid(),name text,status text default 'active');
create table public.unit_users(id uuid primary key default gen_random_uuid(),unit_id uuid references units,user_id uuid references profiles,role_in_unit text);
alter table public.programs add column name text,add column unit_id uuid references units,add column teacher_user_id uuid references profiles;
alter table public.classes add column name text,add column teacher_user_id uuid references profiles;
alter table public.halaqahs add column name text,add column mentor_user_id uuid references profiles;
alter table public.audit_logs add column created_at timestamptz default now();
insert into public.roles(code,name) values ('super_admin','Superadmin'),('admin','Admin'),('teacher','Pengajar'),('mentor','Mentor'),('participant','Peserta'),('guardian','Wali'),('finance','Keuangan'),('helpdesk','Helpdesk'),('content_reviewer','Reviewer konten') on conflict(code) do update set name=excluded.name;
grant all on public.user_roles to authenticated;

alter table public.guardians add column relation_type text;

alter table public.user_roles enable row level security;
create policy existing_role_read on public.user_roles for select to authenticated using(user_id=auth.uid() or public.is_super_admin());
create policy existing_role_manage on public.user_roles for all to authenticated using(public.is_super_admin()) with check(public.is_super_admin());
