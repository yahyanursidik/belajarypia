create role service_role;
alter table programs add column name text default 'Program contoh';
alter table programs add column grading_rubric jsonb default '[]';
alter table enrollments add column ended_at timestamptz;
alter table enrollments add column updated_at timestamptz default now();
create function public.set_updated_at() returns trigger language plpgsql as $$begin new.updated_at=now();return new;end;$$;
create table program_modules(id uuid primary key default gen_random_uuid(),program_id uuid references programs);
create table lessons(id uuid primary key default gen_random_uuid(),module_id uuid references program_modules,lesson_type text,visibility_status text,passing_grade numeric);
create table lesson_progresses(id uuid primary key default gen_random_uuid(),enrollment_id uuid references enrollments,lesson_id uuid references lessons,status text,score numeric,unique(enrollment_id,lesson_id));
