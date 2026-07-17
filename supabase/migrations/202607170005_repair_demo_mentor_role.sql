-- Keep the demo mentor role linked even when Supabase Auth generates a new user UUID.
insert into public.user_roles (user_id, role_id)
select profile.id, role.id
from public.profiles as profile
cross join public.roles as role
where lower(profile.email) = 'mentor@lmsypia.com'
  and role.code = 'mentor'
  and not exists (
    select 1
    from public.user_roles as existing_role
    where existing_role.user_id = profile.id
      and existing_role.role_id = role.id
  );
