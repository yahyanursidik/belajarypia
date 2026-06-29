-- Migration: Add Participant RLS policies for Quiz Attempts & Answers

-- Policies for quiz_attempts
create policy "quiz_attempts_select_participant" on public.quiz_attempts 
for select to authenticated
using (
  exists (
    select 1 from public.enrollments e
    join public.participants p on p.id = e.participant_id
    where e.id = quiz_attempts.enrollment_id
    and p.user_id = auth.uid()
  )
);

create policy "quiz_attempts_insert_participant" on public.quiz_attempts 
for insert to authenticated
with check (
  exists (
    select 1 from public.enrollments e
    join public.participants p on p.id = e.participant_id
    where e.id = enrollment_id
    and p.user_id = auth.uid()
  )
);

create policy "quiz_attempts_update_participant" on public.quiz_attempts 
for update to authenticated
using (
  exists (
    select 1 from public.enrollments e
    join public.participants p on p.id = e.participant_id
    where e.id = quiz_attempts.enrollment_id
    and p.user_id = auth.uid()
  )
);

-- Policies for quiz_attempt_answers
create policy "quiz_answers_select_participant" on public.quiz_attempt_answers 
for select to authenticated
using (
  exists (
    select 1 from public.quiz_attempts qa
    join public.enrollments e on e.id = qa.enrollment_id
    join public.participants p on p.id = e.participant_id
    where qa.id = quiz_attempt_answers.quiz_attempt_id
    and p.user_id = auth.uid()
  )
);

create policy "quiz_answers_insert_participant" on public.quiz_attempt_answers 
for insert to authenticated
with check (
  exists (
    select 1 from public.quiz_attempts qa
    join public.enrollments e on e.id = qa.enrollment_id
    join public.participants p on p.id = e.participant_id
    where qa.id = quiz_attempt_id
    and p.user_id = auth.uid()
  )
);

create policy "quiz_answers_update_participant" on public.quiz_attempt_answers 
for update to authenticated
using (
  exists (
    select 1 from public.quiz_attempts qa
    join public.enrollments e on e.id = qa.enrollment_id
    join public.participants p on p.id = e.participant_id
    where qa.id = quiz_attempt_answers.quiz_attempt_id
    and p.user_id = auth.uid()
  )
);

-- Policies for lesson_progresses
create policy "progress_select_participant" on public.lesson_progresses 
for select to authenticated
using (
  exists (
    select 1 from public.participants p
    where p.id = lesson_progresses.participant_id
    and p.user_id = auth.uid()
  )
);

create policy "progress_insert_participant" on public.lesson_progresses 
for insert to authenticated
with check (
  exists (
    select 1 from public.participants p
    where p.id = participant_id
    and p.user_id = auth.uid()
  )
);

create policy "progress_update_participant" on public.lesson_progresses 
for update to authenticated
using (
  exists (
    select 1 from public.participants p
    where p.id = lesson_progresses.participant_id
    and p.user_id = auth.uid()
  )
);
