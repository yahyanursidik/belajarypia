-- Create database RPC to securely check user registration status bypassing RLS
create or replace function public.check_user_program_registration(p_user_id uuid, p_email text, p_program_id uuid)
returns table (
  already_enrolled boolean,
  enrollment_status text,
  already_applied boolean,
  application_status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_participant_id uuid;
  v_enroll_status text;
  v_app_status text;
  v_search_email text;
begin
  -- Resolve the email to search for applications
  if p_user_id is not null then
    select email into v_search_email from public.profiles where id = p_user_id;
  end if;
  
  if v_search_email is null then
    v_search_email := p_email;
  end if;

  -- 1. Check enrollment
  if p_user_id is not null then
    select id into v_participant_id
    from public.participants
    where user_id = p_user_id
    limit 1;
  end if;

  if v_participant_id is not null then
    select public.enrollments.enrollment_status into v_enroll_status
    from public.enrollments
    where public.enrollments.participant_id = v_participant_id
      and public.enrollments.program_id = p_program_id
      and public.enrollments.enrollment_status != 'cancelled'
    limit 1;
  end if;

  -- 2. Check application
  if v_search_email is not null and v_search_email != '' then
    select a.status into v_app_status
    from public.applicants a
    join public.applicant_program_choices c on c.applicant_id = a.id
    where lower(a.email) = lower(v_search_email)
      and c.program_id = p_program_id
      and a.status in ('submitted', 'under_review', 'accepted', 'revision_requested')
    order by a.created_at desc
    limit 1;
  end if;

  return query select 
    coalesce((v_enroll_status is not null), false) as already_enrolled,
    coalesce(v_enroll_status, '') as enrollment_status,
    coalesce((v_app_status is not null), false) as already_applied,
    coalesce(v_app_status, '') as application_status;
end;
$$;
