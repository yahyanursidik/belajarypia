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
  enrollment_id uuid;
  template_id uuid;
  actor_id uuid := auth.uid();
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

  generated_enrollment_number := 'ENR-' || to_char(now(), 'YYYY') || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);

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
  returning id into enrollment_id;

  insert into public.enrollment_status_logs (
    enrollment_id,
    old_status,
    new_status,
    reason,
    changed_by
  )
  values (enrollment_id, null, 'active', 'Direct Enrollment via Dashboard', actor_id);

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
  values (target_participant_id, enrollment_id, template_id, 'not_started')
  on conflict (enrollment_id) do nothing;

  insert into public.onboarding_step_progresses (onboarding_progress_id, step_key)
  select op.id, os.step_key
  from public.onboarding_progresses op
  join public.onboarding_steps os on os.template_id = op.template_id
  where op.enrollment_id = enrollment_id
  on conflict do nothing;

  return jsonb_build_object(
    'participant_id', target_participant_id,
    'enrollment_id', enrollment_id
  );
end;
$$;
