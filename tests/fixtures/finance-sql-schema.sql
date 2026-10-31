create role service_role;
alter table public.programs add column name text default 'Program contoh';
alter table public.enrollments add column updated_at timestamptz not null default now();
create function public.set_updated_at() returns trigger language plpgsql as $$begin new.updated_at=now();return new;end;$$;
