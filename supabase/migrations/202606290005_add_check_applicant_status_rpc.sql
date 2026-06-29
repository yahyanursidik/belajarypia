-- Create database RPC to securely lookup applicant status bypassing RLS
create or replace function public.check_applicant_status(p_email text, p_phone text)
returns table (
  id uuid,
  full_name text,
  status text,
  program_name text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select 
    a.id,
    a.full_name,
    a.status,
    p.name as program_name
  from public.applicants a
  join public.applicant_program_choices c on c.applicant_id = a.id
  join public.programs p on p.id = c.program_id
  where lower(a.email) = lower(p_email)
    and (
      a.phone = p_phone 
      or right(a.phone, 8) = right(p_phone, 8)
      or replace(a.phone, '+', '') = replace(p_phone, '+', '')
    )
  order by a.created_at desc;
end;
$$;
