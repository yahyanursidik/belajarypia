-- Private supporting files for essay answers. Files are stored in the existing
-- private S3 bucket and can only be reached through a short-lived signed URL.

create table if not exists public.quiz_attempt_answer_files (
  id uuid primary key default gen_random_uuid(),
  quiz_attempt_id uuid not null references public.quiz_attempts(id) on delete cascade,
  question_id uuid not null references public.quiz_questions(id) on delete cascade,
  storage_provider text not null default 'contabo_s3',
  bucket_name text not null,
  object_key text not null unique,
  display_name text not null,
  mime_type text not null,
  file_size_bytes bigint not null check (file_size_bytes > 0 and file_size_bytes <= 10485760),
  uploaded_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists quiz_attempt_answer_files_attempt_question_idx
on public.quiz_attempt_answer_files(quiz_attempt_id, question_id, created_at);

alter table public.quiz_attempt_answer_files enable row level security;

drop policy if exists "quiz_attempt_answer_files_select_own_or_reviewer" on public.quiz_attempt_answer_files;
create policy "quiz_attempt_answer_files_select_own_or_reviewer"
on public.quiz_attempt_answer_files
for select
to authenticated
using (
  exists (
    select 1
    from public.quiz_attempts attempt
    join public.enrollments enrollment on enrollment.id = attempt.enrollment_id
    join public.participants participant on participant.id = enrollment.participant_id
    where attempt.id = quiz_attempt_answer_files.quiz_attempt_id
      and participant.user_id = auth.uid()
  )
  or public.can_review_program_learning((
    select attempt.lesson_id
    from public.quiz_attempts attempt
    where attempt.id = quiz_attempt_answer_files.quiz_attempt_id
  ))
);

create or replace function public.authorize_quiz_answer_file_upload(
  p_attempt_id uuid,
  p_question_id uuid,
  p_file_name text,
  p_mime_type text,
  p_file_size_bytes bigint
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_allowed_extensions constant text[] := array['txt', 'pdf', 'doc', 'docx'];
  v_allowed_mime_types constant text[] := array[
    'text/plain',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];
  v_extension text;
begin
  if auth.uid() is null then
    raise exception 'Sesi peserta tidak ditemukan.';
  end if;

  if p_file_size_bytes is null or p_file_size_bytes < 1 or p_file_size_bytes > 10485760 then
    raise exception 'Ukuran lampiran harus antara 1 byte dan 10 MB.';
  end if;

  v_extension := lower(substring(coalesce(p_file_name, '') from '\.([a-z0-9]+)$'));
  if v_extension is null or not (v_extension = any(v_allowed_extensions)) then
    raise exception 'Format lampiran harus .txt, .pdf, .doc, atau .docx.';
  end if;

  if lower(coalesce(p_mime_type, '')) <> any(v_allowed_mime_types) then
    raise exception 'Jenis file lampiran tidak didukung.';
  end if;

  if not exists (
    select 1
    from public.quiz_attempts attempt
    join public.enrollments enrollment on enrollment.id = attempt.enrollment_id
    join public.participants participant on participant.id = enrollment.participant_id
    join public.quiz_questions question on question.id = p_question_id
      and question.lesson_id = attempt.lesson_id
      and question.question_type = 'essay'
    where attempt.id = p_attempt_id
      and attempt.status = 'ongoing'
      and participant.user_id = auth.uid()
  ) then
    raise exception 'Lampiran hanya dapat ditambahkan ke jawaban esai pada ujian yang masih berlangsung.';
  end if;

  if (
    select count(*)
    from public.quiz_attempt_answer_files file
    where file.quiz_attempt_id = p_attempt_id
      and file.question_id = p_question_id
  ) >= 5 then
    raise exception 'Maksimal lima lampiran untuk setiap jawaban esai.';
  end if;
end;
$$;

create or replace function public.register_quiz_answer_file(
  p_attempt_id uuid,
  p_question_id uuid,
  p_bucket_name text,
  p_object_key text,
  p_display_name text,
  p_mime_type text,
  p_file_size_bytes bigint
)
returns public.quiz_attempt_answer_files
language plpgsql
security definer
set search_path = public
as $$
declare
  v_file public.quiz_attempt_answer_files;
  v_expected_prefix text;
begin
  perform public.authorize_quiz_answer_file_upload(
    p_attempt_id,
    p_question_id,
    p_display_name,
    p_mime_type,
    p_file_size_bytes
  );

  v_expected_prefix := format('quiz-answers/%s/%s/%s/', auth.uid(), p_attempt_id, p_question_id);
  if left(coalesce(p_object_key, ''), length(v_expected_prefix)) <> v_expected_prefix then
    raise exception 'Lokasi penyimpanan lampiran tidak valid.';
  end if;

  insert into public.quiz_attempt_answer_files (
    quiz_attempt_id, question_id, bucket_name, object_key, display_name,
    mime_type, file_size_bytes, uploaded_by
  )
  values (
    p_attempt_id, p_question_id, p_bucket_name, p_object_key, left(trim(p_display_name), 255),
    lower(p_mime_type), p_file_size_bytes, auth.uid()
  )
  returning * into v_file;

  return v_file;
end;
$$;

create or replace function public.get_quiz_answer_file_for_download(p_file_id uuid)
returns table (object_key text, display_name text, mime_type text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Sesi pengguna tidak ditemukan.';
  end if;

  return query
  select file.object_key, file.display_name, file.mime_type
  from public.quiz_attempt_answer_files file
  join public.quiz_attempts attempt on attempt.id = file.quiz_attempt_id
  join public.enrollments enrollment on enrollment.id = attempt.enrollment_id
  join public.participants participant on participant.id = enrollment.participant_id
  where file.id = p_file_id
    and (
      participant.user_id = auth.uid()
      or public.can_review_program_learning(attempt.lesson_id)
    );

  if not found then
    raise exception 'Anda tidak memiliki akses ke lampiran jawaban ini.';
  end if;
end;
$$;

create or replace function public.delete_quiz_answer_file(p_file_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_object_key text;
begin
  if auth.uid() is null then
    raise exception 'Sesi peserta tidak ditemukan.';
  end if;

  select file.object_key
  into v_object_key
  from public.quiz_attempt_answer_files file
  join public.quiz_attempts attempt on attempt.id = file.quiz_attempt_id
  join public.enrollments enrollment on enrollment.id = attempt.enrollment_id
  join public.participants participant on participant.id = enrollment.participant_id
  where file.id = p_file_id
    and attempt.status = 'ongoing'
    and participant.user_id = auth.uid()
  for update of file;

  if v_object_key is null then
    raise exception 'Lampiran tidak ditemukan atau ujian sudah dikumpulkan.';
  end if;

  delete from public.quiz_attempt_answer_files where id = p_file_id;
  return v_object_key;
end;
$$;

revoke all on function public.authorize_quiz_answer_file_upload(uuid, uuid, text, text, bigint) from public;
revoke all on function public.register_quiz_answer_file(uuid, uuid, text, text, text, text, bigint) from public;
revoke all on function public.get_quiz_answer_file_for_download(uuid) from public;
revoke all on function public.delete_quiz_answer_file(uuid) from public;
grant execute on function public.authorize_quiz_answer_file_upload(uuid, uuid, text, text, bigint) to authenticated;
grant execute on function public.register_quiz_answer_file(uuid, uuid, text, text, text, text, bigint) to authenticated;
grant execute on function public.get_quiz_answer_file_for_download(uuid) to authenticated;
grant execute on function public.delete_quiz_answer_file(uuid) to authenticated;
