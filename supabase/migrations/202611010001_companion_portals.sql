-- Read-only companion views. No table policies, enrollments, scores or roles change.
begin;
create function public.guardian_learning_workspace() returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if auth.uid() is null or not public.has_role('guardian') or not exists (
   select 1 from profiles p join auth.users u on u.id=p.id
   where p.id=auth.uid() and p.status='active' and not coalesce(u.banned_until>now(),false)
 ) then raise exception 'Akses wali tidak tersedia.' using errcode='42501'; end if;
 return jsonb_build_object('generated_at',statement_timestamp(),'children',coalesce((
 select jsonb_agg(jsonb_build_object('id',child.id,'name',child.display_name,'number',child.global_participant_number,'status',child.status,
 'enrollments',coalesce((select jsonb_agg(jsonb_build_object(
 'id',e.id,'program_id',pr.id,'program_name',pr.name,'number',e.enrollment_number,'status',e.enrollment_status,
 'class_name',c.name,'halaqah_name',h.name,
 'total',(select count(*) from lessons l join program_modules m on m.id=l.module_id where m.program_id=pr.id and l.visibility_status='published' and (l.release_at is null or l.release_at<=now())),
 'completed',(select count(distinct lp.lesson_id) from lesson_progresses lp join lessons l on l.id=lp.lesson_id join program_modules m on m.id=l.module_id where lp.enrollment_id=e.id and lp.status='completed' and m.program_id=pr.id and l.visibility_status='published' and (l.release_at is null or l.release_at<=now())),
 'tasks',coalesce((select jsonb_agg(to_jsonb(t) order by t.due_at nulls last,t.id) from (
   select l.id,l.title,l.due_at,
     coalesce(s.status,'not_submitted') status,case when s.status='accepted' then s.score end score
   from lessons l join program_modules m on m.id=l.module_id
   left join lateral (select a.status,a.score from assignment_submissions a where a.enrollment_id=e.id and a.lesson_id=l.id and a.status<>'draft' order by a.attempt_number desc limit 1) s on true
   where m.program_id=pr.id and pr.feature_flags->>'use_assignment'='true' and l.lesson_type='assignment' and l.visibility_status='published' and (l.release_at is null or l.release_at<=now())
   order by l.due_at nulls last,l.id limit 20
 ) t),'[]'::jsonb),
 'task_total',(select count(*) from lessons l join program_modules m on m.id=l.module_id where m.program_id=pr.id and pr.feature_flags->>'use_assignment'='true' and l.lesson_type='assignment' and l.visibility_status='published' and (l.release_at is null or l.release_at<=now())),
 'quran',case when pr.feature_flags->>'use_quran_engine'='true' then coalesce((select jsonb_agg(to_jsonb(q) order by q.assessment_date desc,q.id desc) from (
 select id,assessment_date,submission_type,surah_name,ayah_from,ayah_to,fluency_score,tajwid_score,memorization_score,notes,next_target
 from quran_submissions where enrollment_id=e.id order by assessment_date desc,created_at desc,id desc limit 5
 )q),'[]'::jsonb) else '[]'::jsonb end
 ) order by pr.name,e.id) from enrollments e join programs pr on pr.id=e.program_id
 left join classes c on c.id=e.class_id left join halaqahs h on h.id=e.halaqah_id
 where e.participant_id=child.id and child.status='active' and pr.feature_flags->>'use_parent_portal'='true'
 and e.enrollment_status in ('active','completed') and pr.status='active'),'[]'::jsonb)
 ) order by child.display_name,child.id) from participants child where exists(
 select 1 from guardians g join guardian_participants gp on gp.guardian_id=g.id where g.user_id=auth.uid() and gp.participant_id=child.id
 )), '[]'::jsonb));
end;$$;
revoke all on function public.guardian_learning_workspace() from public,anon;
grant execute on function public.guardian_learning_workspace() to authenticated;

create function public.learner_quran_history(p_enrollment uuid,p_page integer default 1) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare page_value integer:=greatest(1,least(coalesce(p_page,1),100000)); total_value bigint;
begin
 if auth.uid() is null or not public.has_role('participant') or not exists(
 select 1 from profiles actor join auth.users u on u.id=actor.id
 join participants part on part.user_id=actor.id join enrollments e on e.participant_id=part.id join programs pr on pr.id=e.program_id
 where actor.id=auth.uid() and actor.status='active' and not coalesce(u.banned_until>now(),false)
 and part.status='active' and e.id=p_enrollment and e.enrollment_status in ('active','completed')
 and pr.feature_flags->>'use_quran_engine'='true'
 ) then raise exception 'Riwayat Qur’an belum tersedia untuk kepesertaan ini.' using errcode='42501';end if;
 select count(*) into total_value from quran_submissions where enrollment_id=p_enrollment;
 page_value:=least(page_value,greatest(1,ceil(total_value/10.0)::integer));
 return jsonb_build_object('total',total_value,'page',page_value,'rows',coalesce((select jsonb_agg(to_jsonb(q) order by q.assessment_date desc,q.created_at desc,q.id desc) from (
 select id,assessment_date,submission_type,surah_name,ayah_from,ayah_to,fluency_score,tajwid_score,memorization_score,notes,next_target,created_at
 from quran_submissions where enrollment_id=p_enrollment order by assessment_date desc,created_at desc,id desc limit 10 offset (page_value-1)*10
 )q),'[]'::jsonb));
end;$$;
revoke all on function public.learner_quran_history(uuid,integer) from public,anon;
grant execute on function public.learner_quran_history(uuid,integer) to authenticated;
commit;
