-- Final grading validates the complete answer set, preserves finalized attempts and derives progress from the latest graded attempt.
create or replace function public.grade_quiz_attempt(p_attempt_id uuid,p_grades jsonb,p_feedback text default null)
returns numeric language plpgsql security definer set search_path=public as $$
declare
 v_attempt public.quiz_attempts%rowtype;
 v_latest public.quiz_attempts%rowtype;
 v_grade jsonb;
 v_answer public.quiz_attempt_answers%rowtype;
 v_max_points numeric;
 v_score numeric;
 v_program_id uuid;
 v_participant_id uuid;
 v_same boolean;
begin
 if auth.uid() is null then raise exception 'Sesi penilai tidak tersedia.'; end if;
 select * into v_attempt from public.quiz_attempts where id=p_attempt_id for update;
 if not found then raise exception 'Percobaan ujian tidak ditemukan.'; end if;
 select pm.program_id,e.participant_id into v_program_id,v_participant_id from public.lessons l join public.program_modules pm on pm.id=l.module_id join public.enrollments e on e.id=v_attempt.enrollment_id and e.program_id=pm.program_id where l.id=v_attempt.lesson_id;
 if not found then raise exception 'Program dan enrollment ujian tidak sesuai.'; end if;
 if not (public.is_super_admin() or (public.has_role('admin') and public.can_access_program(v_program_id)) or ((public.has_role('teacher') or public.has_role('mentor')) and exists(
  select 1 from public.enrollments e join public.programs p on p.id=e.program_id left join public.classes c on c.id=e.class_id left join public.halaqahs h on h.id=e.halaqah_id
  where e.id=v_attempt.enrollment_id and (p.teacher_user_id=auth.uid() or c.teacher_user_id=auth.uid() or h.mentor_user_id=auth.uid())
 ))) then raise exception 'Anda tidak memiliki akses untuk menilai ujian ini.'; end if;
 if v_attempt.status not in ('pending_review','graded') then raise exception 'Percobaan ini belum dikumpulkan.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(v_attempt.enrollment_id::text||':'||v_attempt.lesson_id::text,0));
 if p_grades is null or jsonb_typeof(p_grades)<>'array' then raise exception 'Format penilaian tidak valid.'; end if;
 if length(coalesce(p_feedback,''))>6000 then raise exception 'Catatan akhir maksimal 6.000 karakter.'; end if;
 perform q.id from public.quiz_questions q join public.quiz_attempt_answers a on a.question_id=q.id where a.quiz_attempt_id=p_attempt_id order by q.id for share of q;
 if exists(select 1 from public.quiz_attempt_answers a left join public.quiz_questions q on q.id=a.question_id where a.quiz_attempt_id=p_attempt_id and (q.id is null or q.lesson_id<>v_attempt.lesson_id or q.points is null or q.points<=0)) then raise exception 'Data soal ujian tidak lengkap atau bobotnya tidak valid.'; end if;
 if exists(select 1 from public.quiz_attempt_answers a join public.quiz_questions q on q.id=a.question_id where a.quiz_attempt_id=p_attempt_id and q.question_type='multiple_choice' and (a.points_earned is null or a.points_earned<0 or a.points_earned>q.points)) then raise exception 'Poin otomatis belum valid. Periksa jawaban pilihan ganda.'; end if;
 if (select count(*) from public.quiz_attempt_answers a join public.quiz_questions q on q.id=a.question_id where a.quiz_attempt_id=p_attempt_id and q.question_type='essay')=0 then raise exception 'Percobaan ini tidak memerlukan penilaian esai.'; end if;
 if (select count(*) from public.quiz_attempt_answers a join public.quiz_questions q on q.id=a.question_id where a.quiz_attempt_id=p_attempt_id and q.question_type='essay')<>jsonb_array_length(p_grades) then raise exception 'Semua jawaban esai harus dinilai.'; end if;
 if exists(select 1 from jsonb_array_elements(p_grades) g group by g->>'answer_id' having count(*)>1) then raise exception 'Jawaban esai dinilai lebih dari satu kali.'; end if;
 for v_grade in select value from jsonb_array_elements(p_grades) loop
  select a.* into v_answer from public.quiz_attempt_answers a join public.quiz_questions q on q.id=a.question_id where a.id=(v_grade->>'answer_id')::uuid and a.quiz_attempt_id=p_attempt_id and q.question_type='essay';
  if not found then raise exception 'Jawaban esai bukan milik percobaan ini.'; end if;
  select points into v_max_points from public.quiz_questions where id=v_answer.question_id;
  if jsonb_typeof(v_grade->'points') is distinct from 'number' or (v_grade->>'points')::numeric<0 or (v_grade->>'points')::numeric>v_max_points then raise exception 'Poin esai wajib berupa angka 0 sampai %.',v_max_points; end if;
  if length(coalesce(v_grade->>'feedback',''))>4000 then raise exception 'Umpan balik per soal maksimal 4.000 karakter.'; end if;
 end loop;
 if v_attempt.status='graded' then
  select coalesce(bool_and(a.points_earned=(g->>'points')::numeric and coalesce(a.grader_feedback,'')=coalesce(nullif(btrim(g->>'feedback'),''),'')),false) into v_same from jsonb_array_elements(p_grades) g join public.quiz_attempt_answers a on a.id=(g->>'answer_id')::uuid;
  if v_same and coalesce(v_attempt.grader_feedback,'')=coalesce(nullif(btrim(p_feedback),''),'') then return v_attempt.score; end if;
  raise exception 'Nilai sudah final dan tidak dapat ditimpa dari halaman koreksi.';
 end if;
 for v_grade in select value from jsonb_array_elements(p_grades) loop
  update public.quiz_attempt_answers set points_earned=(v_grade->>'points')::numeric,grader_feedback=nullif(btrim(v_grade->>'feedback'),''),graded_by=auth.uid(),graded_at=now(),updated_at=now() where id=(v_grade->>'answer_id')::uuid;
 end loop;
 select round(sum(a.points_earned)/sum(q.points)*100,2) into v_score from public.quiz_attempt_answers a join public.quiz_questions q on q.id=a.question_id where a.quiz_attempt_id=p_attempt_id;
 if v_score is null or v_score<0 or v_score>100 then raise exception 'Nilai akhir tidak valid. Periksa poin otomatis dan bobot soal.'; end if;
 update public.quiz_attempts set status='graded',score=v_score,graded_by=auth.uid(),graded_at=now(),grader_feedback=nullif(btrim(p_feedback),''),updated_at=now() where id=p_attempt_id;
 select * into v_latest from public.quiz_attempts where enrollment_id=v_attempt.enrollment_id and lesson_id=v_attempt.lesson_id and status='graded' order by attempt_number desc,submitted_at desc nulls last,id desc limit 1;
 insert into public.lesson_progresses(enrollment_id,participant_id,lesson_id,status,score,completed_at)
 values(v_attempt.enrollment_id,v_participant_id,v_attempt.lesson_id,'completed',v_latest.score,coalesce(v_latest.graded_at,v_latest.submitted_at,now()))
 on conflict(enrollment_id,lesson_id) do update set status='completed',score=excluded.score,completed_at=excluded.completed_at,updated_at=now()
 where public.lesson_progresses.score is distinct from excluded.score or public.lesson_progresses.status<>'completed';
 insert into public.audit_logs(user_id,action,entity_type,entity_id,details) values(auth.uid(),'quiz_attempt.graded','quiz_attempt',p_attempt_id,jsonb_build_object('score',v_score,'progress_attempt_id',v_latest.id));
 return v_score;
end;
$$;
revoke all on function public.grade_quiz_attempt(uuid,jsonb,text) from public,anon;
grant execute on function public.grade_quiz_attempt(uuid,jsonb,text) to authenticated;
