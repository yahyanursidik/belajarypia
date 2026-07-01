-- Migration: Admin Create Participant With User
-- Allows admins to create a participant and an auth user via Mass Upload
-- Handles skipping creation if user already exists (by email)

create extension if not exists pgcrypto with schema extensions;

drop function if exists public.admin_create_participant_with_user(text, text, text, text, text, text, text, text, text, text);

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

    -- Insert into auth.users (will trigger on_auth_user_created to create profile)
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
