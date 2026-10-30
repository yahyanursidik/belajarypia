-- Completion is owned by the signed-in participant. Assessment scores remain server graded.
create or replace function public.complete_learning_lesson(p_lesson_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lesson public.lessons%rowtype;
  v_enrollment public.enrollments%rowtype;
  v_progress_id uuid;
begin
  if auth.uid() is null then raise exception 'Silakan masuk kembali.'; end if;
  select l.* into v_lesson from public.lessons l where l.id = p_lesson_id;
  if not found or v_lesson.visibility_status <> 'published'
    or (v_lesson.release_at is not null and v_lesson.release_at > now()) then
    raise exception 'Materi belum tersedia.';
  end if;
  if v_lesson.lesson_type not in ('content', 'board', 'text', 'document', 'pdf', 'link', 'video', 'audio') then
    raise exception 'Penyelesaian aktivitas ini mengikuti penilaian atau presensi.';
  end if;
  select e.* into v_enrollment from public.enrollments e
  join public.participants p on p.id = e.participant_id
  join public.program_modules pm on pm.program_id = e.program_id
  join public.programs pr on pr.id = e.program_id and pr.status = 'active'
  where pm.id = v_lesson.module_id and p.user_id = auth.uid()
    and p.status = 'active' and e.enrollment_status = 'active'
  order by e.created_at desc limit 1 for update of e;
  if not found then raise exception 'Anda belum terdaftar aktif pada program ini.'; end if;
  if not public.can_access_lesson(p_lesson_id) then raise exception 'Anda tidak memiliki akses ke materi ini.'; end if;
  if exists (
    select 1 from public.lesson_prerequisites lp
    where lp.lesson_id = p_lesson_id and not exists (
      select 1 from public.lesson_progresses pr
      where pr.enrollment_id = v_enrollment.id
        and pr.lesson_id = lp.prerequisite_lesson_id and pr.status = 'completed'
    )
  ) then raise exception 'Selesaikan materi prasyarat terlebih dahulu.'; end if;

  insert into public.lesson_progresses(enrollment_id, participant_id, lesson_id, status, completed_at)
  values(v_enrollment.id, v_enrollment.participant_id, p_lesson_id, 'completed', now())
  on conflict(enrollment_id, lesson_id) do update
  set status = 'completed', completed_at = coalesce(lesson_progresses.completed_at, excluded.completed_at), updated_at = now()
  returning id into v_progress_id;
  insert into public.audit_logs(user_id, action, entity_type, entity_id, details)
  values(auth.uid(), 'lesson.completed', 'lesson_progresses', v_progress_id,
    jsonb_build_object('lesson_id', p_lesson_id, 'enrollment_id', v_enrollment.id));
  return v_progress_id;
end;
$$;
revoke all on function public.complete_learning_lesson(uuid) from public, anon;
grant execute on function public.complete_learning_lesson(uuid) to authenticated;
