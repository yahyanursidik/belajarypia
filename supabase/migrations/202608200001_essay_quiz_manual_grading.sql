-- Essay quiz support, secure participant submission, and manual grading workflow.

alter table public.question_bank_items
add column if not exists grading_guide text;

alter table public.quiz_questions
add column if not exists grading_guide text;

alter table public.quiz_attempt_answers
add column if not exists essay_answer text,
add column if not exists grader_feedback text,
add column if not exists graded_by uuid references public.profiles(id) on delete set null,
add column if not exists graded_at timestamptz;

alter table public.quiz_attempts
add column if not exists graded_by uuid references public.profiles(id) on delete set null,
add column if not exists graded_at timestamptz,
add column if not exists grader_feedback text;

do $$
declare
  constraint_name text;
begin
  select conname into constraint_name
  from pg_constraint
  where conrelid = 'public.quiz_attempts'::regclass
    and contype = 'c'
    and conname = 'quiz_attempts_status_check';

  if constraint_name is not null then
    execute format('alter table public.quiz_attempts drop constraint %I', constraint_name);
  end if;

  alter table public.quiz_attempts
  add constraint quiz_attempts_status_check
  check (status in ('ongoing', 'submitted', 'pending_review', 'graded', 'abandoned'));
end $$;

create index if not exists quiz_attempts_review_queue_idx
on public.quiz_attempts(status, submitted_at desc)
where status in ('pending_review', 'graded');

create or replace function public.start_quiz_attempt(p_lesson_id uuid)
returns table (attempt_id uuid, attempt_started_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_enrollment_id uuid;
  v_max_attempts int;
  v_attempt_number int;
  v_existing public.quiz_attempts%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Sesi peserta tidak ditemukan.';
  end if;

  if not public.can_access_lesson(p_lesson_id) then
    raise exception 'Anda tidak memiliki akses ke ujian ini.';
  end if;

  select e.id, l.max_attempts
  into v_enrollment_id, v_max_attempts
  from public.lessons l
  join public.program_modules pm on pm.id = l.module_id
  join public.enrollments e on e.program_id = pm.program_id and e.enrollment_status = 'active'
  join public.participants p on p.id = e.participant_id and p.user_id = auth.uid()
  where l.id = p_lesson_id
    and l.lesson_type in ('quiz', 'exam')
  limit 1;

  if v_enrollment_id is null then
    raise exception 'Enrollment aktif untuk ujian ini tidak ditemukan.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_enrollment_id::text || ':' || p_lesson_id::text, 0));

  select * into v_existing
  from public.quiz_attempts
  where enrollment_id = v_enrollment_id
    and lesson_id = p_lesson_id
    and status = 'ongoing'
  order by created_at desc
  limit 1;

  if found then
    attempt_id := v_existing.id;
    attempt_started_at := v_existing.started_at;
    return next;
    return;
  end if;

  if exists (
    select 1 from public.quiz_attempts
    where enrollment_id = v_enrollment_id
      and lesson_id = p_lesson_id
      and status = 'pending_review'
  ) then
    raise exception 'Jawaban esai Anda masih menunggu penilaian.';
  end if;

  select count(*)::int + 1 into v_attempt_number
  from public.quiz_attempts
  where enrollment_id = v_enrollment_id
    and lesson_id = p_lesson_id
    and status in ('submitted', 'pending_review', 'graded');

  if v_max_attempts is not null and v_max_attempts > 0 and v_attempt_number > v_max_attempts then
    raise exception 'Batas percobaan ujian sudah tercapai.';
  end if;

  insert into public.quiz_attempts (enrollment_id, lesson_id, attempt_number, status)
  values (v_enrollment_id, p_lesson_id, v_attempt_number, 'ongoing')
  returning id, started_at into attempt_id, attempt_started_at;

  return next;
end;
$$;

create or replace function public.submit_quiz_attempt(p_attempt_id uuid, p_answers jsonb)
returns table (attempt_status text, final_score numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt public.quiz_attempts%rowtype;
  v_expected_count int;
  v_has_essay boolean;
  v_score numeric;
  v_participant_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Sesi peserta tidak ditemukan.';
  end if;

  select qa.* into v_attempt
  from public.quiz_attempts qa
  join public.enrollments e on e.id = qa.enrollment_id
  join public.participants p on p.id = e.participant_id
  where qa.id = p_attempt_id
    and p.user_id = auth.uid()
  for update of qa;

  if not found then
    raise exception 'Percobaan ujian tidak ditemukan.';
  end if;

  if v_attempt.status <> 'ongoing' then
    raise exception 'Ujian ini sudah dikumpulkan.';
  end if;

  if p_answers is null or jsonb_typeof(p_answers) <> 'array' then
    raise exception 'Format jawaban tidak valid.';
  end if;

  select case
    when l.randomized_questions_count is not null and l.randomized_questions_count > 0
      then least(l.randomized_questions_count, count(q.id)::int)
    else count(q.id)::int
  end
  into v_expected_count
  from public.lessons l
  left join public.quiz_questions q on q.lesson_id = l.id
  where l.id = v_attempt.lesson_id
  group by l.randomized_questions_count;

  if jsonb_array_length(p_answers) <> coalesce(v_expected_count, 0) then
    raise exception 'Jumlah jawaban tidak sesuai dengan soal ujian.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_answers) answer
    left join public.quiz_questions question
      on question.id = (answer ->> 'question_id')::uuid
      and question.lesson_id = v_attempt.lesson_id
    where question.id is null
  ) then
    raise exception 'Jawaban memuat soal yang tidak valid.';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_answers) answer
    group by answer ->> 'question_id'
    having count(*) > 1
  ) then
    raise exception 'Jawaban ganda terdeteksi.';
  end if;

  delete from public.quiz_attempt_answers where quiz_attempt_id = p_attempt_id;

  insert into public.quiz_attempt_answers (
    quiz_attempt_id,
    question_id,
    selected_option,
    essay_answer,
    is_correct,
    points_earned
  )
  select
    p_attempt_id,
    question.id,
    case when question.question_type = 'essay' then null else nullif(answer ->> 'answer_text', '') end,
    case when question.question_type = 'essay' then nullif(trim(answer ->> 'answer_text'), '') else null end,
    case when question.question_type = 'essay' then null else coalesce(answer ->> 'answer_text', '') = question.correct_answer end,
    case
      when question.question_type = 'essay' then 0
      when coalesce(answer ->> 'answer_text', '') = question.correct_answer then question.points
      else 0
    end
  from jsonb_array_elements(p_answers) answer
  join public.quiz_questions question on question.id = (answer ->> 'question_id')::uuid;

  select exists (
    select 1
    from public.quiz_attempt_answers answer
    join public.quiz_questions question on question.id = answer.question_id
    where answer.quiz_attempt_id = p_attempt_id
      and question.question_type = 'essay'
  ) into v_has_essay;

  select case when sum(question.points) > 0
    then round(sum(answer.points_earned) / sum(question.points) * 100, 2)
    else 0 end
  into v_score
  from public.quiz_attempt_answers answer
  join public.quiz_questions question on question.id = answer.question_id
  where answer.quiz_attempt_id = p_attempt_id;

  update public.quiz_attempts
  set status = case when v_has_essay then 'pending_review' else 'graded' end,
      score = case when v_has_essay then null else v_score end,
      submitted_at = now(),
      updated_at = now()
  where id = p_attempt_id;

  if not v_has_essay then
    select e.participant_id into v_participant_id
    from public.enrollments e where e.id = v_attempt.enrollment_id;

    insert into public.lesson_progresses (enrollment_id, participant_id, lesson_id, status, score, completed_at)
    values (v_attempt.enrollment_id, v_participant_id, v_attempt.lesson_id, 'completed', v_score, now())
    on conflict (enrollment_id, lesson_id) do update
    set status = 'completed', score = excluded.score, completed_at = now(), updated_at = now();
  end if;

  attempt_status := case when v_has_essay then 'pending_review' else 'graded' end;
  final_score := case when v_has_essay then null else v_score end;
  return next;
end;
$$;

create or replace function public.grade_quiz_attempt(
  p_attempt_id uuid,
  p_grades jsonb,
  p_feedback text default null
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt public.quiz_attempts%rowtype;
  v_grade jsonb;
  v_answer public.quiz_attempt_answers%rowtype;
  v_max_points numeric;
  v_score numeric;
  v_participant_id uuid;
begin
  select * into v_attempt
  from public.quiz_attempts
  where id = p_attempt_id
  for update;

  if not found or not public.can_review_program_learning(v_attempt.lesson_id) then
    raise exception 'Anda tidak memiliki akses untuk menilai ujian ini.';
  end if;

  if v_attempt.status not in ('pending_review', 'graded') then
    raise exception 'Percobaan ini belum siap dinilai.';
  end if;

  if p_grades is null or jsonb_typeof(p_grades) <> 'array' then
    raise exception 'Format penilaian tidak valid.';
  end if;

  if (
    select count(*)
    from public.quiz_attempt_answers answer
    join public.quiz_questions question on question.id = answer.question_id
    where answer.quiz_attempt_id = p_attempt_id and question.question_type = 'essay'
  ) <> jsonb_array_length(p_grades) then
    raise exception 'Semua jawaban esai harus dinilai sebelum disimpan.';
  end if;

  for v_grade in select value from jsonb_array_elements(p_grades)
  loop
    select answer.*
    into v_answer
    from public.quiz_attempt_answers answer
    join public.quiz_questions question on question.id = answer.question_id
    where answer.id = (v_grade ->> 'answer_id')::uuid
      and answer.quiz_attempt_id = p_attempt_id
      and question.question_type = 'essay';

    if not found then
      raise exception 'Jawaban esai tidak ditemukan.';
    end if;

    select points into v_max_points
    from public.quiz_questions
    where id = v_answer.question_id;

    if (v_grade ->> 'points')::numeric < 0 or (v_grade ->> 'points')::numeric > v_max_points then
      raise exception 'Nilai esai harus berada antara 0 dan %.', v_max_points;
    end if;

    update public.quiz_attempt_answers
    set points_earned = (v_grade ->> 'points')::numeric,
        grader_feedback = nullif(trim(v_grade ->> 'feedback'), ''),
        graded_by = auth.uid(),
        graded_at = now(),
        updated_at = now()
    where id = v_answer.id;
  end loop;

  select case when sum(question.points) > 0
    then round(sum(answer.points_earned) / sum(question.points) * 100, 2)
    else 0 end
  into v_score
  from public.quiz_attempt_answers answer
  join public.quiz_questions question on question.id = answer.question_id
  where answer.quiz_attempt_id = p_attempt_id;

  update public.quiz_attempts
  set status = 'graded', score = v_score, graded_by = auth.uid(), graded_at = now(),
      grader_feedback = nullif(trim(p_feedback), ''), updated_at = now()
  where id = p_attempt_id;

  select e.participant_id into v_participant_id
  from public.enrollments e where e.id = v_attempt.enrollment_id;

  insert into public.lesson_progresses (enrollment_id, participant_id, lesson_id, status, score, completed_at)
  values (v_attempt.enrollment_id, v_participant_id, v_attempt.lesson_id, 'completed', v_score, now())
  on conflict (enrollment_id, lesson_id) do update
  set status = 'completed', score = excluded.score, completed_at = now(), updated_at = now();

  insert into public.audit_logs (user_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'quiz_attempt.graded', 'quiz_attempt', p_attempt_id, jsonb_build_object('score', v_score));

  return v_score;
end;
$$;

revoke all on function public.start_quiz_attempt(uuid) from public;
revoke all on function public.submit_quiz_attempt(uuid, jsonb) from public;
revoke all on function public.grade_quiz_attempt(uuid, jsonb, text) from public;
grant execute on function public.start_quiz_attempt(uuid) to authenticated;
grant execute on function public.submit_quiz_attempt(uuid, jsonb) to authenticated;
grant execute on function public.grade_quiz_attempt(uuid, jsonb, text) to authenticated;

-- Participants use the validated RPCs above for writes. Direct answer/score tampering is disabled.
drop policy if exists "quiz_attempts_insert_participant" on public.quiz_attempts;
drop policy if exists "quiz_attempts_update_participant" on public.quiz_attempts;
drop policy if exists "quiz_answers_insert_participant" on public.quiz_attempt_answers;
drop policy if exists "quiz_answers_update_participant" on public.quiz_attempt_answers;
drop policy if exists "progress_insert_participant" on public.lesson_progresses;
drop policy if exists "progress_update_participant" on public.lesson_progresses;
