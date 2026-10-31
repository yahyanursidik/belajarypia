-- The signed-in status check must follow per-program decisions and only read the caller's identity.
create or replace function public.check_user_program_registration(p_user_id uuid,p_email text,p_program_id uuid)
returns table(already_enrolled boolean,enrollment_status text,already_applied boolean,application_status text)
language plpgsql security definer set search_path=public as $$
declare v_enroll_status text; v_app_status text; v_email text;
begin
 if auth.uid() is null or p_user_id is distinct from auth.uid() then raise exception 'Status pendaftaran hanya tersedia untuk akun Anda sendiri.'; end if;
 select lower(btrim(email)) into v_email from public.profiles where id=auth.uid();
 if v_email is null then raise exception 'Profil akun belum tersedia.'; end if;
 if p_email is not null and lower(btrim(p_email))<>v_email then raise exception 'Email tidak sesuai dengan akun yang masuk.'; end if;
 select e.enrollment_status into v_enroll_status from public.enrollments e join public.participants p on p.id=e.participant_id
 where p.user_id=auth.uid() and e.program_id=p_program_id and e.enrollment_status<>'cancelled' order by e.started_at desc nulls last,e.id limit 1;
 select c.review_status into v_app_status from public.applicants a join public.applicant_program_choices c on c.applicant_id=a.id
 where lower(btrim(a.email))=v_email and c.program_id=p_program_id and c.review_status in ('submitted','under_review','revision_requested','accepted') order by a.created_at desc,c.created_at desc,c.id desc limit 1;
 return query select v_enroll_status is not null,coalesce(v_enroll_status,''),v_app_status is not null,coalesce(v_app_status,'');
end;
$$;
revoke all on function public.check_user_program_registration(uuid,text,uuid) from public,anon;
grant execute on function public.check_user_program_registration(uuid,text,uuid) to authenticated;
