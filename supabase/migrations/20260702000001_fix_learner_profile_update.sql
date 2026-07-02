-- Allow participants to update their own profile data
-- This is necessary so they can edit their profile in the Learner Dashboard.
-- We only allow them to update specific fields by relying on the client, 
-- but at the RLS level we grant update access to their own row.

drop policy if exists "participants_update_own" on public.participants;

create policy "participants_update_own"
  on public.participants for update
  using ( auth.uid() = user_id )
  with check ( auth.uid() = user_id );
