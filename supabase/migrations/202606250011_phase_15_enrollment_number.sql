create table if not exists public.enrollment_sequences (
  id uuid primary key default gen_random_uuid(),
  program_id uuid references public.programs(id) on delete cascade,
  batch_id uuid references public.batches(id) on delete cascade,
  gender text not null,
  current_value integer not null default 0
);

create unique index if not exists enrollment_sequences_unique_idx 
on public.enrollment_sequences (program_id, coalesce(batch_id, '00000000-0000-0000-0000-000000000000'::uuid), gender);

create or replace function public.generate_enrollment_number(
  p_program_id uuid,
  p_batch_id uuid,
  p_gender text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_program_code text;
  v_batch_code text;
  v_gender_code text;
  v_seq integer;
begin
  select code into v_program_code from public.programs where id = p_program_id;
  if v_program_code is null then
    v_program_code := 'PRG';
  end if;

  if p_batch_id is not null then
    select code into v_batch_code from public.batches where id = p_batch_id;
  end if;
  if v_batch_code is null then
    v_batch_code := '00';
  end if;

  if lower(p_gender) in ('male', 'ikhwan', 'l', 'laki-laki') then
    v_gender_code := '1';
  elsif lower(p_gender) in ('female', 'akhwat', 'p', 'perempuan') then
    v_gender_code := '2';
  else
    v_gender_code := '0';
  end if;

  insert into public.enrollment_sequences (program_id, batch_id, gender, current_value)
  values (p_program_id, p_batch_id, lower(coalesce(p_gender, 'unknown')), 1)
  on conflict (program_id, coalesce(batch_id, '00000000-0000-0000-0000-000000000000'::uuid), gender)
  do update set current_value = public.enrollment_sequences.current_value + 1
  returning current_value into v_seq;

  return v_program_code || '-' || v_batch_code || '-' || v_gender_code || '-' || lpad(v_seq::text, 3, '0');
end;
$$;

create or replace function public.approve_applicant(
  target_applicant_id uuid,
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
  applicant_record public.applicants%rowtype;
  applicant_user_id uuid;
  participant_role_id uuid;
  participant_id uuid;
  generated_participant_number text;
  generated_enrollment_number text;
  enrollment_id uuid;
  template_id uuid;
  actor_id uuid := auth.uid();
  v_use_custom boolean;
begin
  if not public.can_access_applicant(target_applicant_id) then
    raise exception 'Tidak memiliki akses ke applicant ini.';
  end if;

  if not public.can_access_program(target_program_id) then
    raise exception 'Tidak memiliki akses ke program ini.';
  end if;

  select * into applicant_record
  from public.applicants
  where id = target_applicant_id
  for update;

  if not found then
    raise exception 'Applicant tidak ditemukan.';
  end if;

  select id into applicant_user_id
  from public.profiles
  where lower(email) = lower(applicant_record.email)
  limit 1;

  select p.id into participant_id
  from public.participants p
  where p.user_id = applicant_user_id
     or lower(p.display_name) = lower(applicant_record.full_name)
  limit 1;

  if participant_id is null then
    generated_participant_number := public.next_participant_number();

    insert into public.participants (
      user_id,
      global_participant_number,
      display_name,
      gender,
      birth_date,
      city,
      status
    )
    values (
      applicant_user_id,
      generated_participant_number,
      applicant_record.full_name,
      applicant_record.gender,
      applicant_record.birth_date,
      applicant_record.city,
      'active'
    )
    returning id into participant_id;
  end if;

  select coalesce((feature_flags->>'use_custom_enrollment_number')::boolean, false)
  into v_use_custom
  from public.programs
  where id = target_program_id;

  if v_use_custom then
     generated_enrollment_number := public.generate_enrollment_number(target_program_id, target_batch_id, applicant_record.gender);
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
    participant_id,
    target_program_id,
    target_batch_id,
    target_class_id,
    target_halaqah_id,
    generated_enrollment_number,
    'active',
    'not_required',
    now()
  )
  on conflict (participant_id, program_id) do update
  set batch_id = excluded.batch_id,
      class_id = excluded.class_id,
      halaqah_id = excluded.halaqah_id,
      enrollment_status = 'active',
      started_at = coalesce(public.enrollments.started_at, now())
  returning id into enrollment_id;

  insert into public.enrollment_status_logs (
    enrollment_id,
    old_status,
    new_status,
    reason,
    changed_by
  )
  values (enrollment_id, null, 'active', 'Applicant approved', actor_id);

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
  values (participant_id, enrollment_id, template_id, 'not_started')
  on conflict (enrollment_id) do nothing;

  insert into public.onboarding_step_progresses (onboarding_progress_id, step_key)
  select op.id, os.step_key
  from public.onboarding_progresses op
  join public.onboarding_steps os on os.template_id = op.template_id
  where op.enrollment_id = enrollment_id
  on conflict do nothing;

  update public.applicants
  set status = 'accepted'
  where id = target_applicant_id;

  return jsonb_build_object(
    'participant_id', participant_id,
    'enrollment_id', enrollment_id
  );
end;
$$;


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
  if not public.can_access_participant(target_participant_id) then
    raise exception 'Tidak memiliki akses ke participant ini.';
  end if;

  select * into participant_record
  from public.participants
  where id = target_participant_id;

  if not found then
    raise exception 'Participant tidak ditemukan.';
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
  on conflict (participant_id, program_id) do update
  set batch_id = excluded.batch_id,
      class_id = excluded.class_id,
      halaqah_id = excluded.halaqah_id,
      enrollment_status = 'active',
      started_at = coalesce(public.enrollments.started_at, now())
  returning id into v_enrollment_id;

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

  return jsonb_build_object(
    'participant_id', target_participant_id,
    'enrollment_id', v_enrollment_id
  );
end;
$$;
