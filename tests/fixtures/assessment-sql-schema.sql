alter table public.programs add column teacher_user_id uuid;
alter table public.classes add column teacher_user_id uuid;
alter table public.halaqahs add column mentor_user_id uuid;
create table public.program_modules(id uuid primary key,program_id uuid references programs,title text);
create table public.lessons(id uuid primary key,module_id uuid references program_modules,title text,passing_grade numeric,lesson_type text);
create table public.quiz_questions(id uuid primary key,lesson_id uuid references lessons,question_type text,points numeric,question_text text,correct_answer text,grading_guide text,order_no integer);
create table public.quiz_attempts(id uuid primary key default gen_random_uuid(),lesson_id uuid references lessons,enrollment_id uuid references enrollments,attempt_number integer,status text,score numeric,graded_by uuid,graded_at timestamptz,grader_feedback text,submitted_at timestamptz,updated_at timestamptz default now());
create table public.quiz_attempt_answers(id uuid primary key,quiz_attempt_id uuid references quiz_attempts,question_id uuid references quiz_questions,points_earned numeric,grader_feedback text,graded_by uuid,graded_at timestamptz,updated_at timestamptz default now());
create table public.lesson_progresses(id uuid primary key default gen_random_uuid(),enrollment_id uuid references enrollments,participant_id uuid references participants,lesson_id uuid references lessons,status text,score numeric,completed_at timestamptz,updated_at timestamptz default now(),unique(enrollment_id,lesson_id));
