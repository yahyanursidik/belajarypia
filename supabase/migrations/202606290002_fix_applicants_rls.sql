-- Fix SELECT policy on public.applicants table to allow applicants to query their own data (necessary for RETURNING/select() during insert)
drop policy if exists "applicants_admin_select_scoped" on public.applicants;

create policy "applicants_authenticated_select"
on public.applicants
for select
to authenticated
using (
  lower(email) = lower(auth.jwt() ->> 'email')
  or public.can_access_applicant(id)
);

drop policy if exists "applicants_anon_select" on public.applicants;
create policy "applicants_anon_select"
on public.applicants
for select
to anon
using (status = 'submitted');
