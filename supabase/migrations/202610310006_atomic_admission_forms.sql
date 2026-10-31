-- Save form, questions, program admission mode and audit in one transaction.
create or replace function public.admin_save_admission_form(
 p_program_id uuid,p_form_id uuid,p_expected_updated_at timestamptz,p_payload jsonb,p_fields jsonb
) returns jsonb language plpgsql security definer set search_path=public as $$
declare
 f public.registration_forms%rowtype;
 program_record public.programs%rowtype;
 field jsonb;
 settings jsonb;
 bucket text;
 group_item jsonb;
 claim record;
 field_id uuid;
 field_ids uuid[]:='{}';
 position integer:=0;
 open_at timestamptz;
 close_at timestamptz;
 new_status text;
 direct_mode boolean;
begin
 if auth.uid() is null or not (public.is_super_admin() or public.has_role('admin')) or not public.can_access_program(p_program_id) then raise exception 'Anda tidak memiliki akses ke pengaturan pendaftaran ini.'; end if;
 select * into program_record from public.programs where id=p_program_id for update;
 if not found then raise exception 'Program tidak ditemukan.'; end if;
 select * into f from public.registration_forms where program_id=p_program_id order by created_at desc,id desc limit 1 for update;
 if p_form_id is null and f.id is not null then raise exception 'Formulir sudah dibuat. Muat ulang sebelum menyimpan.'; end if;
 if p_form_id is not null and (f.id is distinct from p_form_id or f.updated_at is distinct from p_expected_updated_at) then raise exception 'Formulir sudah berubah. Muat ulang dan periksa kembali isian Anda.'; end if;
 if p_payload is null or jsonb_typeof(p_payload)<>'object' or nullif(btrim(p_payload->>'title'),'') is null then raise exception 'Judul formulir wajib diisi.'; end if;
 if length(p_payload->>'title')>180 or length(coalesce(p_payload->>'description',''))>4000 then raise exception 'Judul maksimal 180 dan instruksi maksimal 4.000 karakter.'; end if;
 if p_fields is null or jsonb_typeof(p_fields)<>'array' or jsonb_array_length(p_fields)>100 then raise exception 'Daftar pertanyaan tidak valid (maksimal 100).'; end if;
 direct_mode:=coalesce((p_payload->>'direct')::boolean,false);
 new_status:=case when direct_mode then 'draft' else p_payload->>'status' end;
 if new_status is null or new_status not in ('draft','active','archived') then raise exception 'Status formulir tidak valid.'; end if;
 if new_status='active' and program_record.status<>'active' then raise exception 'Aktifkan program sebelum membuka formulir.'; end if;
 open_at:=nullif(p_payload->>'registration_open_at','')::timestamptz;
 close_at:=nullif(p_payload->>'registration_close_at','')::timestamptz;
 if open_at is not null and close_at is not null and close_at<=open_at then raise exception 'Waktu tutup harus setelah waktu buka.'; end if;
 settings:=p_payload->'group_settings';
 if settings is null or jsonb_typeof(settings)<>'object' or coalesce(settings->>'platform','') not in ('none','whatsapp','telegram') then raise exception 'Pengaturan grup tidak valid.'; end if;
 foreach bucket in array array['ikhwan_groups','akhwat_groups','general_groups'] loop
  if jsonb_typeof(settings->bucket) is distinct from 'array' or jsonb_array_length(settings->bucket)>100 then raise exception 'Daftar tautan grup tidak valid.'; end if;
  if settings->>'platform'<>'none' and (coalesce((settings->>'separated_gender')::boolean,false) or bucket='general_groups') then
  for group_item in select value from jsonb_array_elements(settings->bucket) loop
   if nullif(btrim(group_item->>'name'),'') is null or coalesce(group_item->>'link','') !~* '^https?://[^[:space:]/]+[.]?[^[:space:]]*$' then raise exception 'Lengkapi nama dan tautan HTTP/HTTPS grup.'; end if;
   if coalesce(group_item->>'click_limit','') !~ '^[0-9]{1,9}$' then raise exception 'Batas pemakaian grup harus bilangan bulat mulai dari 0.'; end if;
  end loop;
  end if;
 end loop;
 if settings->>'platform'<>'none' then
  if coalesce((settings->>'separated_gender')::boolean,false) then
   if jsonb_array_length(settings->'ikhwan_groups')+jsonb_array_length(settings->'akhwat_groups')+jsonb_array_length(settings->'general_groups')=0 then raise exception 'Tambahkan tautan grup atau pilih Tanpa grup.'; end if;
  elsif jsonb_array_length(settings->'general_groups')=0 then raise exception 'Tambahkan tautan grup umum atau pilih Tanpa grup.'; end if;
 end if;
 -- Existing claims address a bucket/index. Keep these links at the same index to preserve limits and assignments.
 if f.id is not null then
  for claim in select distinct group_bucket,group_index from public.registration_group_link_claims where form_id=f.id loop
   if (settings->claim.group_bucket->claim.group_index->>'link') is distinct from (f.group_settings->claim.group_bucket->claim.group_index->>'link') then raise exception 'Tautan yang sudah dipakai tidak dapat dipindah atau diganti. Tambahkan tautan baru di akhir daftar.'; end if;
  end loop;
 end if;
 if exists(select 1 from jsonb_array_elements(p_fields) x group by x->>'field_key' having count(*)>1) then raise exception 'Kode pertanyaan ganda.'; end if;
 for field in select value from jsonb_array_elements(p_fields) loop
  if coalesce(field->>'field_key','') !~ '^[a-zA-Z0-9_-]{1,100}$' or nullif(btrim(field->>'label'),'') is null or coalesce(field->>'field_type','') not in ('text','textarea','email','phone','select','file') then raise exception 'Judul atau jenis pertanyaan tidak valid.'; end if;
  if field->>'field_type'='select' then
   if jsonb_typeof(field->'options_json') is distinct from 'array' or jsonb_array_length(field->'options_json')<2 then raise exception 'Pertanyaan pilihan membutuhkan minimal dua jawaban.'; end if;
   if exists(select 1 from jsonb_array_elements_text(field->'options_json') option_value where btrim(option_value)='') or (select count(*)<>count(distinct lower(btrim(option_value))) from jsonb_array_elements_text(field->'options_json') option_value) then raise exception 'Pilihan jawaban harus berbeda dan tidak boleh kosong.'; end if;
  end if;
  field_id:=nullif(field->>'id','')::uuid;
  if field_id is not null and not exists(select 1 from public.registration_form_fields where id=field_id and form_id=f.id and field_key=field->>'field_key') then raise exception 'Pertanyaan bukan milik formulir ini atau kodenya berubah.'; end if;
 end loop;
 if f.id is null then
  insert into public.registration_forms(program_id,title,status) values(p_program_id,btrim(p_payload->>'title'),'draft') returning * into f;
 end if;
 update public.registration_forms set title=btrim(p_payload->>'title'),description=nullif(btrim(p_payload->>'description'),''),status=new_status,registration_open_at=open_at,registration_close_at=close_at,group_settings=settings,updated_at=clock_timestamp() where id=f.id returning * into f;
 update public.registration_forms set status='archived' where program_id=p_program_id and id<>f.id and status='active';
 for field in select value from jsonb_array_elements(p_fields) loop
  field_id:=nullif(field->>'id','')::uuid;
  if field_id is null then
   insert into public.registration_form_fields(form_id,field_key,label,field_type,is_required,options_json,order_no)
   values(f.id,field->>'field_key',btrim(field->>'label'),field->>'field_type',coalesce((field->>'is_required')::boolean,false),case when field->>'field_type'='select' then field->'options_json' else null end,position) returning id into field_id;
  else
   update public.registration_form_fields set label=btrim(field->>'label'),field_type=field->>'field_type',is_required=coalesce((field->>'is_required')::boolean,false),options_json=case when field->>'field_type'='select' then field->'options_json' else null end,order_no=position where id=field_id and form_id=f.id;
  end if;
  field_ids:=array_append(field_ids,field_id);position:=position+1;
 end loop;
 delete from public.registration_form_fields where form_id=f.id and not(id=any(field_ids));
 update public.programs set feature_flags=coalesce(feature_flags,'{}'::jsonb)||jsonb_build_object('use_direct_enrollment',direct_mode) where id=p_program_id;
 insert into public.audit_logs(user_id,action,entity_type,entity_id,details) values(auth.uid(),'admission.form.save','registration_form',f.id,jsonb_build_object('program_id',p_program_id,'status',new_status,'direct',direct_mode,'questions',position));
 return jsonb_build_object('form_id',f.id,'updated_at',f.updated_at,'status',f.status,'program_id',p_program_id,'feature_flags',program_record.feature_flags||jsonb_build_object('use_direct_enrollment',direct_mode));
end;
$$;
revoke all on function public.admin_save_admission_form(uuid,uuid,timestamptz,jsonb,jsonb) from public,anon;
grant execute on function public.admin_save_admission_form(uuid,uuid,timestamptz,jsonb,jsonb) to authenticated;
