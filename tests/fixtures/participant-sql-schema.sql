-- Minimal isolated contract fixture; no production credentials or personal data.
create role anon;
create role authenticated;
create schema auth;
create schema extensions;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('test.actor', true), '')::uuid;
$$;
create function public.has_role(code text) returns boolean language sql stable as $$
  select coalesce(current_setting('test.role', true) = code, false);
$$;
create function public.is_super_admin() returns boolean language sql stable as $$
  select public.has_role('super_admin');
$$;
create function public.can_access_participant(id uuid) returns boolean language sql stable as $$
  select coalesce(current_setting('test.scope', true) = id::text, false);
$$;
-- Hashing is outside these transaction tests; Supabase supplies pgcrypto in production.
create function extensions.gen_salt(text) returns text language sql as $$ select 'fixture'; $$;
create function extensions.crypt(text,text) returns text language sql as $$ select 'fixture:' || $1; $$;
create table auth.users (
  instance_id uuid, id uuid primary key, aud text, role text, email text unique,
  encrypted_password text, email_confirmed_at timestamptz,
  raw_app_meta_data jsonb, raw_user_meta_data jsonb, created_at timestamptz, updated_at timestamptz
);
create table auth.identities (
  id uuid primary key, user_id uuid references auth.users, identity_data jsonb,
  provider text, provider_id text, last_sign_in_at timestamptz, created_at timestamptz, updated_at timestamptz
);
create table public.profiles (
  id uuid primary key references auth.users, full_name text, email text, status text default 'active'
);
create function public.fixture_profile() returns trigger language plpgsql as $$
begin
  insert into public.profiles(id,email,full_name) values (new.id,new.email,new.raw_user_meta_data->>'full_name');
  return new;
end;
$$;
create trigger fixture_profile after insert on auth.users for each row execute function public.fixture_profile();
create table public.roles (id uuid primary key default gen_random_uuid(), code text unique);
insert into public.roles(code) values ('participant');
create table public.user_roles (user_id uuid references auth.users, role_id uuid references public.roles, unique(user_id,role_id));
create table public.programs (id uuid primary key default gen_random_uuid(), code text unique, status text default 'active', feature_flags jsonb default '{}');
create function public.can_access_program(id uuid) returns boolean language sql stable as $$
  select public.is_super_admin() or coalesce(current_setting('test.program', true) = id::text, false);
$$;
create function public.generate_enrollment_number(uuid,uuid,text) returns text language sql as $$ select gen_random_uuid()::text; $$;
create table public.batches (id uuid primary key,program_id uuid references programs,status text default 'active');
create table public.classes (id uuid primary key,program_id uuid references programs,batch_id uuid references batches,status text default 'active');
create table public.halaqahs (id uuid primary key,class_id uuid references classes,status text default 'active');
create table public.participants (
  id uuid primary key default gen_random_uuid(), user_id uuid references public.profiles,
  global_participant_number text not null unique, display_name text not null,
  gender text, participant_type text default 'adult', city text, education_level text, phone text,
  status text default 'active'
);
create table public.enrollments (
  id uuid primary key default gen_random_uuid(), participant_id uuid references public.participants,
  program_id uuid references public.programs, enrollment_status text default 'active',
  batch_id uuid, class_id uuid, halaqah_id uuid, enrollment_number text unique, payment_status text, started_at timestamptz, unique(participant_id,program_id)
);
create table public.guardians (
  id uuid primary key default gen_random_uuid(), user_id uuid references public.profiles, created_at timestamptz default now()
);
create table public.guardian_participants (
  id uuid primary key default gen_random_uuid(), guardian_id uuid references public.guardians,
  participant_id uuid references public.participants, is_primary boolean default false,
  created_at timestamptz default now(), unique(guardian_id,participant_id)
);
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(), user_id uuid references auth.users,
  action text, entity_type text, entity_id uuid, details jsonb
);
create table public.enrollment_status_logs (
  id uuid primary key default gen_random_uuid(), enrollment_id uuid references enrollments,
  old_status text,new_status text,reason text,changed_by uuid references profiles
);
create table public.onboarding_templates (
  id uuid primary key default gen_random_uuid(),program_id uuid references programs,title text,description text,status text default 'active'
);
create table public.onboarding_steps (
  template_id uuid references onboarding_templates,step_key text,title text,description text,order_no int,unique(template_id,step_key)
);
create table public.onboarding_progresses (
  id uuid primary key default gen_random_uuid(),participant_id uuid references participants,
  enrollment_id uuid unique references enrollments,template_id uuid references onboarding_templates,status text
);
create table public.onboarding_step_progresses (
  onboarding_progress_id uuid references onboarding_progresses,step_key text,unique(onboarding_progress_id,step_key)
);
alter table public.guardians enable row level security;
alter table public.guardian_participants enable row level security;
grant usage on schema auth to authenticated;
grant select on public.participants, public.guardians, public.guardian_participants to authenticated;
