-- Fix missing identities and roles for mass-uploaded participants

-- 1. Create missing auth.identities
do $$
declare
  r record;
begin
  for r in 
    select u.id, u.email 
    from auth.users u
    join public.participants p on p.user_id = u.id
    left join auth.identities i on i.user_id = u.id
    where i.id is null
  loop
    insert into auth.identities (
      id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), r.id, jsonb_build_object('sub', r.id::text, 'email', r.email, 'email_verified', true), 'email', r.id::text, now(), now(), now()
    );

    update auth.users
    set email_confirmed_at = coalesce(email_confirmed_at, now())
    where id = r.id;
  end loop;
end;
$$;

-- 2. Create missing roles (participant)
do $$
declare
  r record;
begin
  for r in 
    select p.user_id
    from public.participants p
    left join public.user_roles ur on ur.user_id = p.user_id
    where ur.id is null
  loop
    insert into public.user_roles (user_id, role_id)
    select r.user_id, id from public.roles where code = 'participant'
    on conflict do nothing;
  end loop;
end;
$$;

-- 3. Replace the function to include these fixes for future mass uploads
create or replace function public.admin_create_participant_with_user(
  p_email text,
  p_password text,
  p_display_name text,
  p_phone text,
  p_nis text,
  p_gender text,
  p_participant_type text,
  p_city text,
  p_education text,
  p_program_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  is_admin boolean;
  new_user_id uuid;
  new_participant_id uuid;
  target_program_id uuid;
  action_status text;
begin
  select (public.has_role('admin') or public.has_role('super_admin')) into is_admin;
  if not is_admin then
    raise exception 'Unauthorized: Only administrators can create users.';
  end if;

  if length(p_password) < 6 then
    raise exception 'Password must be at least 6 characters long.';
  end if;

  if p_program_code is not null and trim(p_program_code) != '' then
    select id into target_program_id from public.programs where upper(code) = upper(trim(p_program_code)) limit 1;
    if target_program_id is null then
      raise exception 'Program dengan kode % tidak ditemukan.', p_program_code;
    end if;
  end if;

  -- Check if user already exists
  select id into new_user_id from auth.users where email = p_email limit 1;

  if new_user_id is not null then
    -- User already exists! Set status
    action_status := 'enrolled_existing';
    
    -- Check if they already have a participant profile
    select id into new_participant_id from public.participants where user_id = new_user_id limit 1;
    
    -- If they have an auth account but somehow no participant profile, create one
    if new_participant_id is null then
      insert into public.participants (
        user_id,
        global_participant_number,
        display_name,
        gender,
        participant_type,
        city,
        education_level,
        phone,
        status
      ) values (
        new_user_id,
        p_nis,
        p_display_name,
        p_gender,
        p_participant_type,
        p_city,
        p_education,
        p_phone,
        'active'
      ) returning id into new_participant_id;
    end if;

  else
    -- User does not exist, create new one
    action_status := 'created';
    new_user_id := gen_random_uuid();

    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, 
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data, 
      created_at, updated_at
    ) values (
      '00000000-0000-0000-0000-000000000000', new_user_id, 'authenticated', 'authenticated', p_email, 
      extensions.crypt(p_password, extensions.gen_salt('bf')),
      now(), '{"provider":"email","providers":["email"]}', 
      jsonb_build_object('full_name', p_display_name, 'phone', p_phone),
      now(), now()
    );

    insert into auth.identities (
      id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), new_user_id, jsonb_build_object('sub', new_user_id::text, 'email', p_email, 'email_verified', true), 'email', new_user_id::text, now(), now(), now()
    );

    -- Insert into public.participants
    insert into public.participants (
      user_id,
      global_participant_number,
      display_name,
      gender,
      participant_type,
      city,
      education_level,
      phone,
      status
    ) values (
      new_user_id,
      p_nis,
      p_display_name,
      p_gender,
      p_participant_type,
      p_city,
      p_education,
      p_phone,
      'active'
    ) returning id into new_participant_id;

    -- Assign 'participant' role
    insert into public.user_roles (user_id, role_id)
    select new_user_id, id from public.roles where code = 'participant'
    on conflict do nothing;
  end if;

  -- Enroll the participant if a program code was provided
  if target_program_id is not null then
    perform public.direct_enroll_participant(new_participant_id, target_program_id);
  end if;

  return jsonb_build_object(
    'participant_id', new_participant_id,
    'status', action_status
  );
end;
$$;

-- 4. Reset password untuk SEMUA peserta menjadi 'ahlan1447H'
update auth.users
set 
  encrypted_password = extensions.crypt('ahlan1447H', extensions.gen_salt('bf', 10)),
  updated_at = now()
from public.participants p
where p.user_id = auth.users.id;
