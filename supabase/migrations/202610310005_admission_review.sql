-- Review decisions belong to one application/program, not every choice of an applicant.
alter table public.applicant_program_choices
  add column if not exists review_status text,
  add column if not exists review_updated_at timestamptz,
  add column if not exists participant_id uuid references public.participants(id),
  add column if not exists enrollment_id uuid references public.enrollments(id);
update public.applicant_program_choices c set review_status=a.status
from public.applicants a where a.id=c.applicant_id and c.review_status is null;
alter table public.applicant_program_choices alter column review_status set default 'submitted',alter column review_status set not null;
alter table public.applicant_program_choices add constraint applicant_choice_review_status_check
  check (review_status in ('draft','submitted','under_review','revision_requested','accepted','rejected'));
create index if not exists applicant_choices_review_status_idx on public.applicant_program_choices(program_id,review_status);

create or replace function public.admin_review_application(
  p_choice_id uuid,p_status text,p_notes text,p_expected_status text,p_expected_updated_at timestamptz default null
) returns jsonb language plpgsql security definer set search_path=public as $$
declare c public.applicant_program_choices%rowtype;
begin
  if auth.uid() is null or not (public.is_super_admin() or public.has_role('admin')) then raise exception 'Hanya administrator yang dapat meninjau pendaftaran.'; end if;
  select * into c from public.applicant_program_choices where id=p_choice_id;
  if not found or not public.can_access_program(c.program_id) then raise exception 'Pendaftaran tidak tersedia dalam cakupan Anda.'; end if;
  perform id from public.applicants where id=c.applicant_id for update;
  select * into c from public.applicant_program_choices where id=p_choice_id for update;
  if c.review_status is distinct from p_expected_status or c.review_updated_at is distinct from p_expected_updated_at then raise exception 'Pendaftaran sudah berubah. Muat ulang sebelum melanjutkan.'; end if;
  if p_status is null or (p_status not in ('under_review','revision_requested','rejected','accepted') and p_status<>c.review_status) then raise exception 'Keputusan tidak valid.'; end if;
  if c.review_status='accepted' and p_status<>'accepted' then raise exception 'Pendaftaran sudah diterima. Kelola enrollment melalui profil peserta.'; end if;
  if p_status='accepted' and c.review_status<>'accepted' then raise exception 'Gunakan alur penerimaan untuk membuat peserta dan enrollment.'; end if;
  if c.review_status='rejected' and p_status not in ('under_review','rejected') then raise exception 'Buka kembali review sebelum mengubah keputusan akhir.'; end if;
  if p_status in ('revision_requested','rejected') and nullif(btrim(p_notes),'') is null then raise exception 'Catatan keputusan wajib diisi.'; end if;
  if length(coalesce(p_notes,''))>4000 then raise exception 'Catatan maksimal 4.000 karakter.'; end if;
  update public.applicant_program_choices set review_status=p_status,notes=nullif(btrim(p_notes),''),review_updated_at=clock_timestamp() where id=c.id returning * into c;
  -- Keep the old aggregate compatible only when all choices agree. Public status uses the choice below.
  update public.applicants set status=p_status where id=c.applicant_id and not exists(select 1 from public.applicant_program_choices where applicant_id=c.applicant_id and review_status<>p_status);
  insert into public.audit_logs(user_id,action,entity_type,entity_id,details) values(auth.uid(),'admission.review','applicant_program_choice',c.id,jsonb_build_object('program_id',c.program_id,'previous_status',p_expected_status,'status',p_status));
  return jsonb_build_object('choice_id',c.id,'status',c.review_status,'review_updated_at',c.review_updated_at,'participant_id',c.participant_id,'enrollment_id',c.enrollment_id);
end;
$$;

create or replace function public.admin_accept_application(
 p_choice_id uuid,p_notes text,p_expected_status text,p_expected_updated_at timestamptz default null,
 p_batch_id uuid default null,p_class_id uuid default null,p_halaqah_id uuid default null
) returns jsonb language plpgsql security definer set search_path=public as $$
declare
 c public.applicant_program_choices%rowtype;
 a public.applicants%rowtype;
 person public.participants%rowtype;
 account_id uuid;
 account_count integer;
 result jsonb;
 enrollment_action text;
 profile_count integer;
begin
 if auth.uid() is null or not (public.is_super_admin() or public.has_role('admin')) then raise exception 'Hanya administrator yang dapat menerima pendaftaran.'; end if;
 select * into c from public.applicant_program_choices where id=p_choice_id;
 if not found or not public.can_access_program(c.program_id) then raise exception 'Pendaftaran tidak tersedia dalam cakupan Anda.'; end if;
 select * into a from public.applicants where id=c.applicant_id for update;
 select * into c from public.applicant_program_choices where id=p_choice_id for update;
 if c.review_status='accepted' and c.participant_id is not null and c.enrollment_id is not null then
   return jsonb_build_object('choice_id',c.id,'status','accepted','participant_id',c.participant_id,'enrollment_id',c.enrollment_id,'enrollment_action','unchanged');
 end if;
 if c.review_status is distinct from p_expected_status or c.review_updated_at is distinct from p_expected_updated_at then raise exception 'Pendaftaran sudah berubah. Muat ulang sebelum melanjutkan.'; end if;
 if c.review_status not in ('submitted','under_review','revision_requested') then raise exception 'Pendaftaran harus berada dalam antrean review sebelum diterima.'; end if;
 if length(coalesce(p_notes,''))>4000 then raise exception 'Catatan maksimal 4.000 karakter.'; end if;
 if not exists(select 1 from public.programs where id=c.program_id and status='active') then raise exception 'Program belum aktif.'; end if;
 -- Serialize approvals for one email. Never match identity by a person's name.
 perform pg_advisory_xact_lock(hashtextextended(lower(btrim(a.email)),0));
 select count(*),min(id::text)::uuid into account_count,account_id from public.profiles where lower(btrim(email))=lower(btrim(a.email));
 if account_count>1 then raise exception 'Ada beberapa profil dengan email yang sama. Periksa identitas melalui menu Peserta.'; end if;
 if account_id is not null and not exists(select 1 from public.profiles where id=account_id and status='active') then raise exception 'Akun peserta tidak aktif.'; end if;
 if account_id is not null then
   select count(*) into profile_count from public.participants where user_id=account_id;
   if profile_count>1 then raise exception 'Akun terhubung ke beberapa profil peserta. Periksa identitas melalui menu Peserta.'; end if;
   select * into person from public.participants where user_id=account_id for update;
 else
   select p.* into person from public.participants p join public.applicant_program_choices previous on previous.participant_id=p.id where previous.applicant_id=a.id order by previous.created_at limit 1 for update of p;
 end if;
 if person.id is null then
   insert into public.participants(user_id,global_participant_number,display_name,gender,birth_date,city,phone,status)
   values(account_id,public.next_participant_number(),a.full_name,a.gender,a.birth_date,a.city,a.phone,'active') returning * into person;
 elsif person.status<>'active' then raise exception 'Peserta tidak aktif. Periksa profil sebelum menerima program.';
 elsif lower(btrim(person.display_name))<>lower(btrim(a.full_name)) or (person.birth_date is not null and a.birth_date is not null and person.birth_date<>a.birth_date) then
   raise exception 'Identitas pendaftar berbeda dari profil yang terhubung. Periksa melalui menu Peserta.';
 end if;
 if account_id is not null then
   insert into public.user_roles(user_id,role_id) select account_id,id from public.roles where code='participant' on conflict do nothing;
 end if;
 -- Existing enrollment is preserved by the shared enrollment function, including hold/completed/cancelled.
 result:=public.direct_enroll_participant(person.id,c.program_id);
 if result->>'enrollment_id' is null then raise exception 'Enrollment belum terkonfirmasi.'; end if;
 enrollment_action:=result->>'enrollment_action';
 if enrollment_action='created' then
   perform public.admin_update_enrollment_placement((result->>'enrollment_id')::uuid,p_batch_id,p_class_id,p_halaqah_id);
   -- Finalize the custom number against the chosen batch after validated placement.
   if p_batch_id is not null and exists(select 1 from public.programs where id=c.program_id and coalesce((feature_flags->>'use_custom_enrollment_number')::boolean,false)) then
     update public.enrollments set enrollment_number=public.generate_enrollment_number(c.program_id,p_batch_id,person.gender) where id=(result->>'enrollment_id')::uuid;
   end if;
 end if;
 update public.applicant_program_choices set review_status='accepted',notes=nullif(btrim(p_notes),''),review_updated_at=clock_timestamp(),participant_id=person.id,enrollment_id=(result->>'enrollment_id')::uuid where id=c.id returning * into c;
 update public.applicants set status='accepted' where id=a.id and not exists(select 1 from public.applicant_program_choices where applicant_id=a.id and review_status<>'accepted');
 insert into public.audit_logs(user_id,action,entity_type,entity_id,details) values(auth.uid(),'admission.accept','applicant_program_choice',c.id,jsonb_build_object('program_id',c.program_id,'participant_id',person.id,'enrollment_id',c.enrollment_id,'enrollment_action',enrollment_action));
 return jsonb_build_object('choice_id',c.id,'status','accepted','participant_id',person.id,'enrollment_id',c.enrollment_id,'enrollment_action',enrollment_action,'account_linked',account_id is not null,'review_updated_at',c.review_updated_at);
end;
$$;

-- Preserve the legacy entrypoint while removing its name match and enrollment reset behavior.
create or replace function public.approve_applicant(target_applicant_id uuid,target_program_id uuid,target_batch_id uuid default null,target_class_id uuid default null,target_halaqah_id uuid default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare c public.applicant_program_choices%rowtype; choice_count integer;
begin
 if auth.uid() is null or not (public.is_super_admin() or public.has_role('admin')) or not public.can_access_program(target_program_id) then raise exception 'Tidak memiliki akses ke pendaftaran ini.'; end if;
 select count(*) into choice_count from public.applicant_program_choices where applicant_id=target_applicant_id and program_id=target_program_id;
 if choice_count<>1 then raise exception 'Pilihan program tidak ditemukan atau ganda. Tinjau pendaftaran melalui antrean.'; end if;
 select * into c from public.applicant_program_choices where applicant_id=target_applicant_id and program_id=target_program_id;
 return public.admin_accept_application(c.id,c.notes,c.review_status,c.review_updated_at,target_batch_id,target_class_id,target_halaqah_id);
end;
$$;
revoke all on function public.admin_review_application(uuid,text,text,text,timestamptz) from public,anon;
revoke all on function public.admin_accept_application(uuid,text,text,timestamptz,uuid,uuid,uuid) from public,anon;
revoke all on function public.approve_applicant(uuid,uuid,uuid,uuid,uuid) from public,anon;
grant execute on function public.admin_review_application(uuid,text,text,text,timestamptz),public.admin_accept_application(uuid,text,text,timestamptz,uuid,uuid,uuid),public.approve_applicant(uuid,uuid,uuid,uuid,uuid) to authenticated;

create or replace function public.check_applicant_status(p_email text,p_phone text)
returns table(id uuid,full_name text,status text,program_name text)
language plpgsql security definer set search_path=public as $$
declare normalized_phone text;
begin
 begin normalized_phone:=public.normalize_admission_phone(p_phone); exception when others then return; end;
 return query select a.id,a.full_name,c.review_status,p.name from public.applicants a
 join public.applicant_program_choices c on c.applicant_id=a.id join public.programs p on p.id=c.program_id
 where lower(btrim(a.email))=lower(btrim(p_email)) and (case when left(regexp_replace(a.phone,'[^0-9]','','g'),1)='0' then '62'||substring(regexp_replace(a.phone,'[^0-9]','','g') from 2) else regexp_replace(a.phone,'[^0-9]','','g') end)=replace(normalized_phone,'+','') order by a.created_at desc;
end;
$$;

-- Duplicate submission checks follow the decision for that program.
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
      and coalesce(choice.review_status, applicant.status) in ('submitted', 'under_review', 'revision_requested', 'accepted')
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

revoke all on function public.submit_program_application(uuid,text,text,text,text,text,date,jsonb,uuid,text) from public,anon,authenticated;
grant execute on function public.submit_program_application(uuid,text,text,text,text,text,date,jsonb,uuid,text) to service_role;
