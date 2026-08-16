-- Harden public admission submission so all related rows are created atomically.
-- Apply this migration after the existing admission migrations.

alter table public.applicants
add column if not exists submitted_by_user_id uuid references public.profiles(id) on delete set null;

create index if not exists applicants_submitted_by_user_id_idx
on public.applicants(submitted_by_user_id);

create or replace function public.normalize_admission_phone(value text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  normalized text := regexp_replace(coalesce(value, ''), '[^0-9+]', '', 'g');
begin
  if left(normalized, 1) = '+' then
    normalized := substring(normalized from 2);
  end if;

  if left(normalized, 1) = '0' then
    normalized := '62' || substring(normalized from 2);
  end if;

  if normalized !~ '^62[0-9]{8,13}$' then
    raise exception 'Nomor WhatsApp tidak valid. Gunakan nomor Indonesia, misalnya 0812xxxxxx atau +62812xxxxxx.';
  end if;

  return '+' || normalized;
end;
$$;

create or replace function public.submit_program_application(
  p_program_id uuid,
  p_full_name text,
  p_email text,
  p_phone text,
  p_city text default null,
  p_gender text default null,
  p_birth_date date default null,
  p_answers jsonb default '[]'::jsonb,
  p_submitter_id uuid default null,
  p_submitter_email text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_applicant_id uuid;
  v_actor_id uuid := coalesce(auth.uid(), p_submitter_id);
  v_actor_email text := lower(coalesce(nullif(auth.jwt() ->> 'email', ''), nullif(trim(p_submitter_email), '')));
  v_email text := lower(trim(coalesce(p_email, '')));
  v_full_name text := trim(coalesce(p_full_name, ''));
  v_phone text;
  v_form_id uuid;
  v_field record;
begin
  if p_program_id is null or not exists (
    select 1 from public.programs where id = p_program_id and status = 'active'
  ) then
    raise exception 'Program pendaftaran tidak tersedia.';
  end if;

  select rf.id
  into v_form_id
  from public.registration_forms rf
  where rf.status = 'active'
    and (rf.program_id = p_program_id or rf.program_id is null)
    and (rf.registration_open_at is null or now() >= rf.registration_open_at)
    and (rf.registration_close_at is null or now() <= rf.registration_close_at)
  order by (rf.program_id = p_program_id) desc, rf.created_at desc
  limit 1;

  if v_form_id is null then
    raise exception 'Pendaftaran belum dibuka atau sudah ditutup.';
  end if;

  if v_full_name = '' or char_length(v_full_name) < 3 then
    raise exception 'Nama lengkap minimal 3 karakter.';
  end if;

  if v_actor_email is not null then
    v_email := v_actor_email;
  end if;

  if v_email !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'Email aktif tidak valid.';
  end if;

  v_phone := public.normalize_admission_phone(p_phone);

  if p_answers is null or jsonb_typeof(p_answers) <> 'array' then
    raise exception 'Jawaban formulir tidak valid.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_answers) answer
    left join public.registration_form_fields field
      on field.form_id = v_form_id
      and field.field_key = answer ->> 'field_key'
    where coalesce(answer ->> 'field_key', '') = ''
      or field.id is null
  ) then
    raise exception 'Formulir berisi pertanyaan yang tidak tersedia.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_answers) answer
    group by answer ->> 'field_key'
    having count(*) > 1
  ) then
    raise exception 'Formulir memuat jawaban ganda yang tidak valid.';
  end if;

  for v_field in
    select field_key, label
    from public.registration_form_fields
    where form_id = v_form_id and is_required
  loop
    if not exists (
      select 1
      from jsonb_array_elements(p_answers) answer
      where answer ->> 'field_key' = v_field.field_key
        and (
          nullif(trim(answer ->> 'value_text'), '') is not null
          or nullif(answer -> 'value_json', 'null'::jsonb) is not null
        )
    ) then
      raise exception 'Isian "%" wajib diisi.', v_field.label;
    end if;
  end loop;

  -- A transaction-scoped lock prevents two concurrent requests for the same email/program.
  perform pg_advisory_xact_lock(hashtextextended(v_email || ':' || p_program_id::text, 0));

  if exists (
    select 1
    from public.applicants applicant
    join public.applicant_program_choices choice on choice.applicant_id = applicant.id
    where lower(applicant.email) = v_email
      and choice.program_id = p_program_id
      and applicant.status in ('submitted', 'under_review', 'revision_requested', 'accepted')
  ) then
    raise exception 'Pendaftaran untuk program ini sudah tercatat dan sedang diproses.';
  end if;

  insert into public.applicants (
    full_name,
    email,
    phone,
    city,
    gender,
    birth_date,
    status,
    submitted_by_user_id
  )
  values (
    v_full_name,
    v_email,
    v_phone,
    nullif(trim(coalesce(p_city, '')), ''),
    nullif(trim(coalesce(p_gender, '')), ''),
    p_birth_date,
    'submitted',
    v_actor_id
  )
  returning id into v_applicant_id;

  insert into public.applicant_program_choices (applicant_id, program_id)
  values (v_applicant_id, p_program_id);

  insert into public.applicant_answers (applicant_id, form_field_key, value_text, value_json)
  select
    v_applicant_id,
    answer ->> 'field_key',
    nullif(answer ->> 'value_text', ''),
    case when answer ? 'value_json' then nullif(answer -> 'value_json', 'null'::jsonb) else null end
  from jsonb_array_elements(p_answers) answer;

  if v_actor_id is not null then
    update public.profiles
    set
      full_name = v_full_name,
      phone = v_phone,
      updated_at = now()
    where id = v_actor_id;
  end if;

  return v_applicant_id;
end;
$$;

revoke all on function public.submit_program_application(uuid, text, text, text, text, text, date, jsonb, uuid, text) from public;
grant execute on function public.submit_program_application(uuid, text, text, text, text, text, date, jsonb, uuid, text) to service_role;

-- Public inserts now go through the validated function above. This also removes
-- the former anonymous SELECT policy, which exposed every submitted applicant.
drop policy if exists "applicants_public_insert" on public.applicants;
drop policy if exists "applicants_anon_select" on public.applicants;
drop policy if exists "applicant_program_choices_public_insert" on public.applicant_program_choices;
drop policy if exists "applicant_answers_public_insert" on public.applicant_answers;

-- Admission evidence remains private and is only visible to admission administrators.
drop policy if exists "Authenticated users can read admission documents" on storage.objects;
create policy "Admission admins can read admission documents"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'admission_documents'
  and (public.is_super_admin() or public.has_role('admin'))
);

drop policy if exists "Authenticated users can delete admission documents" on storage.objects;
create policy "Admission admins can delete admission documents"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'admission_documents'
  and (public.is_super_admin() or public.has_role('admin'))
);

drop policy if exists "Anon can upload admission documents" on storage.objects;
create policy "Public can upload approved admission document types"
on storage.objects
for insert
to anon, authenticated
with check (
  bucket_id = 'admission_documents'
  and lower(storage.extension(name)) in ('pdf', 'docx', 'xlsx', 'pptx', 'jpg', 'jpeg', 'png', 'webp')
);
