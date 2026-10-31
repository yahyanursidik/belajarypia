-- Read-only superadmin dashboard. Existing data, roles and RLS are unchanged.
create or replace function public.system_dashboard_summary(p_program_id uuid default null,p_days integer default 30)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare today_wib date=(now() at time zone 'Asia/Jakarta')::date;from_day date;result_value jsonb;
begin
 if auth.uid() is null or not coalesce(public.is_super_admin(),false) or not exists(select 1 from public.profiles where id=auth.uid() and status='active') then raise exception 'Dashboard sistem hanya tersedia untuk superadmin aktif.';end if;
 if p_days is null or p_days not in (7,30,90) then raise exception 'Pilih periode 7, 30, atau 90 hari.';end if;
 if p_program_id is not null and not exists(select 1 from public.programs where id=p_program_id) then raise exception 'Program tidak ditemukan. Pilih program lain.';end if;
 from_day=today_wib-(p_days-1);
 with
 programs_scope as materialized(select p.* from public.programs p where p_program_id is null or p.id=p_program_id),
 enrollments_scope as materialized(select e.* from public.enrollments e join programs_scope p on p.id=e.program_id),
 active_enrollments as materialized(select e.* from enrollments_scope e join public.participants part on part.id=e.participant_id join programs_scope p on p.id=e.program_id where e.enrollment_status='active' and part.status='active' and p.status='active'),
 lessons_scope as materialized(select l.*,m.program_id from public.lessons l join public.program_modules m on m.id=l.module_id join programs_scope p on p.id=m.program_id),
 available_lessons as materialized(select * from lessons_scope where visibility_status='published' and (release_at is null or release_at<=now())),
 choices_scope as materialized(select c.* from public.applicant_program_choices c join programs_scope p on p.id=c.program_id),
 payments_scope as materialized(select t.*,coalesce(t.paid_at,(t.created_at at time zone 'Asia/Jakarta')::date) as activity_day from public.transactions t where p_program_id is null or t.program_id=p_program_id),
 payments_period as materialized(select * from payments_scope where status='verified' and activity_day between from_day and today_wib),
 tickets_scope as materialized(select t.* from public.helpdesk_tickets t where p_program_id is null or t.target_program_id=p_program_id),
 tickets_reply as materialized(select t.* from tickets_scope t where t.status not in ('resolved','closed') and (select sender_id=t.reporter_id from public.helpdesk_messages m where m.ticket_id=t.id and not m.is_internal_note order by m.created_at desc,m.id desc limit 1)),
 onboarding_scope as materialized(select o.* from public.onboarding_progresses o join enrollments_scope e on e.id=o.enrollment_id where e.enrollment_status<>'cancelled'),
 program_stats as materialized(select p.id,p.code,p.name,p.status,
 (select count(*) from active_enrollments e where e.program_id=p.id) as active_enrollments,
 (select count(*) from available_lessons l where l.program_id=p.id) as released_lessons,
 (select count(*) from public.program_modules m where m.program_id=p.id) as modules,
 (select count(*) from public.lesson_progresses lp join active_enrollments e on e.id=lp.enrollment_id join available_lessons l on l.id=lp.lesson_id and l.program_id=e.program_id where e.program_id=p.id and lp.participant_id=e.participant_id and lp.status='completed') as completed_activities
 from programs_scope p),
 daily as(select d::date as day,
 (select count(*) from choices_scope c where (c.created_at at time zone 'Asia/Jakarta')::date=d::date) as applications,
 (select count(*) from enrollments_scope e where (e.created_at at time zone 'Asia/Jakarta')::date=d::date) as enrollments,
 (select coalesce(sum(amount),0) from payments_period t where t.activity_day=d::date) as verified_amount
 from generate_series(from_day::timestamp,today_wib::timestamp,'1 day'::interval) d),
 audit_period as materialized(select a.* from public.audit_logs a where a.created_at>=from_day::timestamp at time zone 'Asia/Jakarta' and a.created_at<(today_wib+1)::timestamp at time zone 'Asia/Jakarta'),
 notification_period as materialized(select n.* from public.notification_logs n where n.status='failed' and n.created_at>=from_day::timestamp at time zone 'Asia/Jakarta' and n.created_at<(today_wib+1)::timestamp at time zone 'Asia/Jakarta')
 select jsonb_build_object(
 'generated_at',now(),'period',jsonb_build_object('days',p_days,'from',from_day,'to',today_wib),
 'programs',coalesce((select jsonb_agg(jsonb_build_object('id',id,'code',code,'name',name,'status',status) order by case status when 'active' then 0 when 'draft' then 1 else 2 end,name,id) from public.programs),'[]'::jsonb),
 'summary',jsonb_build_object(
  'active_participants',(select count(*) from public.participants p where p.status='active' and (p_program_id is null or exists(select 1 from public.enrollments e where e.participant_id=p.id and e.program_id=p_program_id and e.enrollment_status='active'))),
  'active_programs',(select count(*) from programs_scope where status='active'),
  'application_choices',(select count(*) from choices_scope),
  'verified_amount',(select coalesce(sum(amount),0) from payments_period),
  'verified_payments',(select count(*) from payments_period),
  'new_choices',(select count(*) from choices_scope where created_at>=from_day::timestamp at time zone 'Asia/Jakarta' and created_at<(today_wib+1)::timestamp at time zone 'Asia/Jakarta'),
  'new_enrollments',(select count(*) from enrollments_scope where created_at>=from_day::timestamp at time zone 'Asia/Jakarta' and created_at<(today_wib+1)::timestamp at time zone 'Asia/Jakarta')),
 'queues',jsonb_build_object(
  'admission',(select count(*) from choices_scope where review_status in ('submitted','under_review','revision_requested')),
  'assessment',(select count(*) from public.quiz_attempts q join enrollments_scope e on e.id=q.enrollment_id join lessons_scope l on l.id=q.lesson_id and l.program_id=e.program_id where q.status='pending_review'),
  'payments',(select count(*) from payments_scope where status='pending'),
  'certificates',(select count(*) from public.certificate_issuance_batches b where b.status='failed' and (p_program_id is null or b.program_id=p_program_id)),
  'helpdesk',(select count(*) from tickets_reply),
  'helpdesk_overdue',(select count(*) from tickets_scope where status not in ('resolved','closed') and follow_up_at<now()),
  'invoices_overdue',(select count(*) from public.finance_invoices i where i.status='open' and i.due_date<today_wib and (p_program_id is null or i.program_id=p_program_id)),
  'programs_empty',(select count(*) from program_stats where status='active' and modules=0)),
 'admission',jsonb_build_object('draft',(select count(*) from choices_scope where review_status='draft'),'submitted',(select count(*) from choices_scope where review_status='submitted'),'under_review',(select count(*) from choices_scope where review_status='under_review'),'revision_requested',(select count(*) from choices_scope where review_status='revision_requested'),'accepted',(select count(*) from choices_scope where review_status='accepted'),'rejected',(select count(*) from choices_scope where review_status='rejected')),
 'onboarding',jsonb_build_object('total',(select count(*) from onboarding_scope),'completed',(select count(*) from onboarding_scope where status='completed')),
 'learning',jsonb_build_object('active_enrollments',(select count(*) from active_enrollments),'completed',(select coalesce(sum(completed_activities),0) from program_stats),'expected',(select coalesce(sum(active_enrollments*released_lessons),0) from program_stats)),
 'program_activity',coalesce((select jsonb_agg(to_jsonb(p)||jsonb_build_object('expected_activities',p.active_enrollments*p.released_lessons) order by p.active_enrollments desc,p.name,p.id) from program_stats p),'[]'::jsonb),
 'daily',coalesce((select jsonb_agg(to_jsonb(d) order by day) from daily d),'[]'::jsonb),
 'global',jsonb_build_object('users',(select count(*) from public.profiles),'units',(select count(*) from public.units),'failed_notifications',(select count(*) from notification_period),'access_events',(select count(*) from audit_period where lower(action) like any(array['%auth%','%login%','%logout%','%role%']))),
 'notification_failures',coalesce((select jsonb_agg(to_jsonb(n) order by n.created_at desc,n.id) from (select id,event_type,status,created_at from notification_period order by created_at desc,id limit 6) n),'[]'::jsonb),
 'recent_audit',coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at desc,a.id) from (select a.id,a.action,a.entity_type,a.created_at,coalesce(p.full_name,'Sistem') as actor_name from audit_period a left join public.profiles p on p.id=a.user_id order by a.created_at desc,a.id limit 6) a),'[]'::jsonb)
 ) into result_value;
 return result_value;
end;$$;
revoke all on function public.system_dashboard_summary(uuid,integer) from public,anon;
grant execute on function public.system_dashboard_summary(uuid,integer) to authenticated;
