-- Preserve existing enrollment/placement when participants are created or imported again.
-- This migration does not reset credentials or modify existing participant records.
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
  existing_enrollment public.enrollments%rowtype;
  enrollment_action text := 'none';
  normalized_email text := lower(btrim(p_email));
begin
  select (public.has_role('admin') or public.has_role('super_admin')) into is_admin;
  if auth.uid() is null or not coalesce(is_admin, false) then
    raise exception 'Hanya administrator yang dapat menyimpan peserta.';
  end if;

  if normalized_email is null or normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
    raise exception 'Email tidak valid.';
  end if;
  if p_display_name is null or btrim(p_display_name) = '' then
    raise exception 'Nama wajib diisi.';
  end if;
  if p_password is null or length(p_password) < 6 then
    raise exception 'Kata sandi minimal 6 karakter.';
  end if;
  if p_nis is null or btrim(p_nis) = '' then
    raise exception 'Nomor induk wajib diisi.';
  end if;
  if p_gender is null or p_gender not in ('Laki-laki', 'Perempuan') or p_participant_type is null or p_participant_type not in ('adult', 'child') then
    raise exception 'Jenis kelamin atau tipe peserta tidak valid.';
  end if;

  -- Serialize retries/import rows for this account; never change an existing password.
  perform pg_advisory_xact_lock(hashtextextended(normalized_email, 0));

  if p_program_code is not null and trim(p_program_code) != '' then
    select id into target_program_id from public.programs where upper(code) = upper(trim(p_program_code)) and status = 'active' limit 1 for share;
    if target_program_id is null then
      raise exception 'Program tidak ditemukan atau tidak aktif.';
    end if;
    if not public.can_access_program(target_program_id) then
      raise exception 'Anda tidak memiliki akses ke program ini.';
    end if;
  end if;

  -- Check if user already exists
  select id into new_user_id from auth.users where lower(email) = normalized_email limit 1;

  if new_user_id is not null then
    -- User already exists! Set status
    action_status := 'enrolled_existing';
    
    -- Check if they already have a participant profile
    select id into new_participant_id from public.participants where user_id = new_user_id limit 1 for update;
    
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
        btrim(p_nis),
        btrim(p_display_name),
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
      '00000000-0000-0000-0000-000000000000', new_user_id, 'authenticated', 'authenticated', normalized_email, 
      extensions.crypt(p_password, extensions.gen_salt('bf')),
      now(), '{"provider":"email","providers":["email"]}', 
      jsonb_build_object('full_name', p_display_name, 'phone', p_phone),
      now(), now()
    );

    insert into auth.identities (
      id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), new_user_id, jsonb_build_object('sub', new_user_id::text, 'email', normalized_email, 'email_verified', true), 'email', new_user_id::text, now(), now(), now()
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
      btrim(p_nis),
      btrim(p_display_name),
      p_gender,
      p_participant_type,
      p_city,
      p_education,
      p_phone,
      'active'
    ) returning id into new_participant_id;

  end if;

  -- Existing Auth accounts may not yet have the participant role.
  insert into public.user_roles (user_id, role_id)
  select new_user_id, id from public.roles where code = 'participant'
  on conflict do nothing;

  -- An import is not a placement/status change. Preserve every existing enrollment.
  if target_program_id is not null then
    if exists (select 1 from public.participants where id = new_participant_id and status <> 'active') then
      raise exception 'Aktifkan peserta melalui profil sebelum menambahkan program.';
    end if;
    select * into existing_enrollment from public.enrollments
    where participant_id = new_participant_id and program_id = target_program_id for update;
    if found then
      enrollment_action := 'unchanged';
    else
      perform public.direct_enroll_participant(new_participant_id, target_program_id);
      enrollment_action := 'created';
    end if;
  end if;

  insert into public.audit_logs(user_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'participant.save', 'participant', new_participant_id,
    jsonb_build_object('account_status', action_status, 'program_id', target_program_id, 'enrollment_action', enrollment_action));

  return jsonb_build_object(
    'participant_id', new_participant_id,
    'status', action_status,
    'enrollment_action', enrollment_action
  );
end;
$$;

revoke all on function public.admin_create_participant_with_user(text,text,text,text,text,text,text,text,text,text) from public, anon;
grant execute on function public.admin_create_participant_with_user(text,text,text,text,text,text,text,text,text,text) to authenticated;

-- Direct enrollment creates a new enrollment only; placement/status edits use their own workflow.
create or replace function public.direct_enroll_participant(
  target_participant_id uuid,
  target_program_id uuid,
  target_batch_id uuid default null,
  target_class_id uuid default null,
  target_halaqah_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  participant_record public.participants%rowtype;
  generated_enrollment_number text;
  v_enrollment_id uuid;
  template_id uuid;
  actor_id uuid := auth.uid();
  v_use_custom boolean;
begin
  if auth.uid() is null or not (
    public.is_super_admin() or (public.has_role('admin') and public.can_access_program(target_program_id))
  ) then
    raise exception 'Anda tidak memiliki akses untuk mendaftarkan peserta ke program ini.';
  end if;

  select * into participant_record
  from public.participants
  where id = target_participant_id for update;

  if not found then
    raise exception 'Peserta tidak ditemukan.';
  end if;

  if participant_record.status <> 'active' then
    raise exception 'Peserta tidak aktif.';
  end if;
  if not exists (select 1 from public.programs where id = target_program_id and status = 'active') then
    raise exception 'Program tidak ditemukan atau tidak aktif.';
  end if;
  if target_batch_id is not null and not exists (
    select 1 from public.batches where id = target_batch_id and program_id = target_program_id and status = 'active'
  ) then raise exception 'Angkatan tidak sesuai dengan program.'; end if;
  if target_class_id is not null and not exists (
    select 1 from public.classes where id = target_class_id and program_id = target_program_id
    and status = 'active' and (target_batch_id is null or batch_id = target_batch_id)
  ) then raise exception 'Kelas tidak sesuai dengan program atau angkatan.'; end if;
  if target_halaqah_id is not null and not exists (
    select 1 from public.halaqahs h join public.classes c on c.id = h.class_id
    where h.id = target_halaqah_id and h.status = 'active' and c.status = 'active'
    and c.program_id = target_program_id
    and (target_class_id is null or c.id = target_class_id)
    and (target_batch_id is null or c.batch_id = target_batch_id)
  ) then raise exception 'Halaqah tidak sesuai dengan program, kelas, atau angkatan.'; end if;

  select id into v_enrollment_id from public.enrollments
  where participant_id = target_participant_id and program_id = target_program_id;
  if found then
    return jsonb_build_object('participant_id', target_participant_id, 'enrollment_id', v_enrollment_id, 'enrollment_action', 'unchanged');
  end if;

  select coalesce((feature_flags->>'use_custom_enrollment_number')::boolean, false)
  into v_use_custom
  from public.programs
  where id = target_program_id;

  if v_use_custom then
     generated_enrollment_number := public.generate_enrollment_number(target_program_id, target_batch_id, participant_record.gender);
  else
     generated_enrollment_number := 'ENR-' || to_char(now(), 'YYYY') || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
  end if;

  insert into public.enrollments (
    participant_id,
    program_id,
    batch_id,
    class_id,
    halaqah_id,
    enrollment_number,
    enrollment_status,
    payment_status,
    started_at
  )
  values (
    target_participant_id,
    target_program_id,
    target_batch_id,
    target_class_id,
    target_halaqah_id,
    generated_enrollment_number,
    'active',
    'not_required',
    now()
  )
  on conflict (participant_id, program_id) do nothing
  returning id into v_enrollment_id;

  if v_enrollment_id is null then
    select id into v_enrollment_id from public.enrollments
    where participant_id = target_participant_id and program_id = target_program_id;
    return jsonb_build_object('participant_id', target_participant_id, 'enrollment_id', v_enrollment_id, 'enrollment_action', 'unchanged');
  end if;

  insert into public.enrollment_status_logs (
    enrollment_id,
    old_status,
    new_status,
    reason,
    changed_by
  )
  values (v_enrollment_id, null, 'active', 'Direct Enrollment via Dashboard', actor_id);

  select id into template_id
  from public.onboarding_templates
  where status = 'active'
    and (program_id = target_program_id or program_id is null)
  order by program_id nulls last
  limit 1;

  if template_id is null then
    insert into public.onboarding_templates (program_id, title, description)
    values (target_program_id, 'Onboarding Peserta', 'Checklist awal sebelum belajar.')
    returning id into template_id;

    insert into public.onboarding_steps (template_id, step_key, title, description, order_no)
    values
      (template_id, 'complete_profile', 'Lengkapi Profil', 'Pastikan data profil sudah benar.', 1),
      (template_id, 'read_program_guide', 'Baca Panduan Program', 'Pahami alur belajar dan adab kelas.', 2),
      (template_id, 'join_whatsapp_group', 'Gabung Grup WhatsApp', 'Gabung jika program menyediakan grup WhatsApp.', 3);
  end if;

  insert into public.onboarding_progresses (
    participant_id,
    enrollment_id,
    template_id,
    status
  )
  values (target_participant_id, v_enrollment_id, template_id, 'not_started')
  on conflict (enrollment_id) do nothing;

  insert into public.onboarding_step_progresses (onboarding_progress_id, step_key)
  select op.id, os.step_key
  from public.onboarding_progresses op
  join public.onboarding_steps os on os.template_id = op.template_id
  where op.enrollment_id = v_enrollment_id
  on conflict do nothing;

  insert into public.audit_logs(user_id, action, entity_type, entity_id, details)
  values (actor_id, 'participant.enroll', 'enrollment', v_enrollment_id,
    jsonb_build_object('participant_id', target_participant_id, 'program_id', target_program_id));

  return jsonb_build_object(
    'participant_id', target_participant_id,
    'enrollment_id', v_enrollment_id,
    'enrollment_action', 'created'
  );
end;
$$;

revoke all on function public.direct_enroll_participant(uuid,uuid,uuid,uuid,uuid) from public, anon;
grant execute on function public.direct_enroll_participant(uuid,uuid,uuid,uuid,uuid) to authenticated;
