-- Fix SELECT policy on public.applicant_program_choices table to allow applicants to query their own program choices
drop policy if exists "applicant_program_choices_self_select" on public.applicant_program_choices;

create policy "applicant_program_choices_self_select"
on public.applicant_program_choices
for select
to authenticated
using (
  exists (
    select 1
    from public.applicants a
    where a.id = applicant_program_choices.applicant_id
      and lower(a.email) = lower(auth.jwt() ->> 'email')
  )
);
