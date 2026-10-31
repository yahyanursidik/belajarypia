create role service_role;
alter table auth.users add column banned_until timestamptz;
alter table programs add column name text default 'Program contoh',add column teacher_user_id uuid references profiles;
alter table classes add column teacher_user_id uuid references profiles;
create table program_modules(id uuid primary key,program_id uuid references programs,title text,order_no int default 0);
create table lessons(id uuid primary key default gen_random_uuid(),module_id uuid references program_modules,code text,title text,content_body text,content_format text,lesson_type text,order_no int default 0,visibility_status text,release_at timestamptz,due_at timestamptz);
create table lesson_prerequisites(lesson_id uuid references lessons,prerequisite_lesson_id uuid references lessons);
create table lesson_progresses(id uuid primary key default gen_random_uuid(),enrollment_id uuid references enrollments,participant_id uuid references participants,lesson_id uuid references lessons,status text check(status in ('started','completed')),score numeric,completed_at timestamptz,updated_at timestamptz default now(),unique(enrollment_id,lesson_id));
