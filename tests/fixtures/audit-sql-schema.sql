-- Isolated read-only audit contract; no production credentials.
create table public.program_modules(id uuid primary key,program_id uuid references programs);
create table public.lessons(id uuid primary key,module_id uuid references program_modules,title text);
create table public.quiz_attempts(id uuid primary key,enrollment_id uuid references enrollments,lesson_id uuid references lessons);
create table public.applicant_program_choices(id uuid primary key,program_id uuid references programs);
create table public.transactions(id uuid primary key);
create table public.finance_invoices(id uuid primary key,program_id uuid references programs);
create table public.helpdesk_tickets(id uuid primary key);
create table public.announcements(id uuid primary key,title text);
alter table public.audit_logs enable row level security;
create policy existing_audit_read on public.audit_logs for select to authenticated using(public.is_super_admin());
grant select on public.audit_logs to authenticated;

create table public.lesson_progresses(id uuid primary key,enrollment_id uuid references enrollments,lesson_id uuid references lessons);
create table public.registration_forms(id uuid primary key,program_id uuid references programs,title text);
