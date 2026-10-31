-- Does not change any existing settings, images, credentials or storage policies.
create table public.system_settings_operations (
 request_key uuid primary key,
 user_id uuid not null references public.profiles(id),
 request jsonb not null,
 result jsonb not null,
 created_at timestamptz not null default now()
);
create table public.system_brand_assets (
 id uuid primary key,
 created_by uuid not null references public.profiles(id),
 object_key text not null unique,
 public_url text not null unique,
 mime_type text not null check(mime_type in ('image/png','image/jpeg','image/webp')),
 file_size integer not null check(file_size>0 and file_size<=2097152),
 created_at timestamptz not null default now()
);
alter table public.system_settings_operations enable row level security;
alter table public.system_brand_assets enable row level security;

create or replace function public.settings_can_manage() returns boolean
language sql stable security definer set search_path=public as $$
 select auth.uid() is not null and public.is_super_admin()
 and exists(select 1 from public.profiles where id=auth.uid() and status='active');
$$;
revoke all on function public.settings_can_manage() from public,anon;
grant execute on function public.settings_can_manage() to authenticated;

create or replace function public.admin_save_system_settings(p_id uuid,p_payload jsonb,p_expected_updated_at timestamptz,p_request_key uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare
 current_row public.system_settings%rowtype;
 next_row public.system_settings%rowtype;
 previous public.system_settings_operations%rowtype;
 request_value jsonb=jsonb_build_object('id',p_id,'payload',p_payload,'expected_updated_at',p_expected_updated_at);
 normalized jsonb='{}';
 pair record;
 value text;
 max_length integer;
 themes jsonb;
 changed jsonb;
 result_value jsonb;
 allowed constant text[]=array['institution_name','institution_profile','app_sidebar_title','app_sidebar_subtitle','system_header_title','system_header_subtitle','contact_email','contact_phone','address','logo_url','login_logo_url','favicon_url','portal_themes','transcript_header_text','transcript_place_date_text','transcript_official_name','transcript_official_title','transcript_signature_url'];
begin
 if not public.settings_can_manage() then raise exception 'Hanya superadmin aktif yang dapat mengubah pengaturan global.';end if;
 if p_request_key is null then raise exception 'Identitas permintaan belum tersedia.';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_request_key::text,83));
 select * into previous from public.system_settings_operations where request_key=p_request_key;
 if found then
  if previous.user_id<>auth.uid() or previous.request is distinct from request_value then raise exception 'Permintaan berbeda. Periksa kembali perubahan Anda.';end if;
  return previous.result;
 end if;
 if p_payload is null or jsonb_typeof(p_payload)<>'object' or p_payload='{}'::jsonb then raise exception 'Pilih perubahan pengaturan yang akan disimpan.';end if;
 if exists(select 1 from jsonb_object_keys(p_payload) k where not(k=any(allowed))) then raise exception 'Terdapat pilihan pengaturan yang tidak diizinkan.';end if;
 select * into current_row from public.system_settings where id=p_id for update;
 if not found then raise exception 'Pengaturan belum tersedia. Muat ulang terlebih dahulu.';end if;
 if current_row.updated_at is distinct from p_expected_updated_at then raise exception 'Pengaturan telah berubah. Muat ulang sebelum menyimpan. Isian Anda tetap tersedia.';end if;
 for pair in select e.key,e.value as raw from jsonb_each(p_payload) e loop
  if pair.key='portal_themes' then
   if jsonb_typeof(pair.raw)<>'object' or exists(select 1 from jsonb_each(pair.raw) t where t.key not in ('admin','learner','teacher','mentor','public') or jsonb_typeof(t.value)<>'string' or (t.value#>>'{}') not in ('indigo','emerald','rose','amber','slate')) then raise exception 'Pilih warna portal yang tersedia.';end if;
   themes='{"admin":"slate","learner":"emerald","teacher":"indigo","mentor":"rose","public":"amber"}'::jsonb||coalesce(current_row.portal_themes,'{}'::jsonb)||pair.raw;
   normalized=normalized||jsonb_build_object(pair.key,themes);
   continue;
  end if;
  if jsonb_typeof(pair.raw) not in ('null','string') then raise exception 'Isian pengaturan harus berupa teks.';end if;
  value=nullif(btrim(pair.raw#>>'{}'),'');
  max_length=case pair.key when 'institution_name' then 160 when 'institution_profile' then 1500 when 'app_sidebar_title' then 60 when 'app_sidebar_subtitle' then 100 when 'system_header_title' then 100 when 'system_header_subtitle' then 180 when 'contact_email' then 254 when 'contact_phone' then 32 when 'address' then 1000 when 'transcript_header_text' then 3000 when 'transcript_place_date_text' then 160 when 'transcript_official_name' then 160 when 'transcript_official_title' then 160 else 2000 end;
  if length(value)>max_length then raise exception 'Salah satu isian melebihi batas panjangnya.';end if;
  if pair.key='institution_name' and value is null then raise exception 'Isi nama lembaga.';end if;
  if pair.key='contact_email' and value is not null and value !~ '^[^[:space:]@?<>:;]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,63}$' then raise exception 'Masukkan email bantuan yang valid.';end if;
  if pair.key='contact_phone' and value is not null and regexp_replace(value,'[[:space:]()+.\-]','','g') !~ '^[0-9]{8,15}$' then raise exception 'Masukkan nomor bantuan 8 sampai 15 digit.';end if;
  if pair.key in ('logo_url','login_logo_url','favicon_url','transcript_signature_url') and value is not null then
   if value !~ '^https://[^/@[:space:]]+(/[^[:space:]]*)?$' then raise exception 'Gunakan URL gambar HTTPS tanpa kredensial.';end if;
   if value like '%/functions/v1/settings-assets?%' and not exists(select 1 from public.system_brand_assets where public_url=value) then raise exception 'Unggahan gambar belum terkonfirmasi.';end if;
  end if;
  normalized=normalized||jsonb_build_object(pair.key,value);
 end loop;
 select * into next_row from jsonb_populate_record(current_row,normalized);
 select coalesce(jsonb_agg(k order by k),'[]'::jsonb) into changed from jsonb_object_keys(normalized) k where to_jsonb(current_row)->k is distinct from to_jsonb(next_row)->k;
 if changed<>'[]'::jsonb then
  update public.system_settings set institution_name=next_row.institution_name,institution_profile=next_row.institution_profile,app_sidebar_title=next_row.app_sidebar_title,app_sidebar_subtitle=next_row.app_sidebar_subtitle,system_header_title=next_row.system_header_title,system_header_subtitle=next_row.system_header_subtitle,contact_email=next_row.contact_email,contact_phone=next_row.contact_phone,address=next_row.address,logo_url=next_row.logo_url,login_logo_url=next_row.login_logo_url,favicon_url=next_row.favicon_url,portal_themes=next_row.portal_themes,transcript_header_text=next_row.transcript_header_text,transcript_place_date_text=next_row.transcript_place_date_text,transcript_official_name=next_row.transcript_official_name,transcript_official_title=next_row.transcript_official_title,transcript_signature_url=next_row.transcript_signature_url,updated_at=now() where id=p_id returning * into next_row;
  insert into public.audit_logs(user_id,action,entity_type,entity_id,details) values(auth.uid(),'settings.updated','system_settings',p_id,jsonb_build_object('fields',changed,'previous_updated_at',current_row.updated_at));
 end if;
 result_value=to_jsonb(next_row);
 insert into public.system_settings_operations(request_key,user_id,request,result) values(p_request_key,auth.uid(),request_value,result_value);
 return result_value;
end;$$;
revoke all on function public.admin_save_system_settings(uuid,jsonb,timestamptz,uuid) from public,anon;
grant execute on function public.admin_save_system_settings(uuid,jsonb,timestamptz,uuid) to authenticated;

create or replace function public.admin_create_system_settings(p_request_key uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare row public.system_settings%rowtype;op public.system_settings_operations%rowtype;request_value jsonb='{"operation":"initialize"}';result_value jsonb;
begin
 if not public.settings_can_manage() then raise exception 'Hanya superadmin aktif yang dapat menyiapkan pengaturan global.';end if;
 if p_request_key is null then raise exception 'Identitas permintaan belum tersedia.';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_request_key::text,83));
 select * into op from public.system_settings_operations where request_key=p_request_key;
 if found then if op.user_id<>auth.uid() or op.request<>request_value then raise exception 'Permintaan berbeda.';end if;return op.result;end if;
 perform pg_advisory_xact_lock(hashtextextended('system-settings-singleton',84));
 select * into row from public.system_settings limit 1 for update;
 if row.id is null then
  insert into public.system_settings(institution_name) values('YPIA') returning * into row;
  insert into public.audit_logs(user_id,action,entity_type,entity_id,details) values(auth.uid(),'settings.created','system_settings',row.id,'{}');
 end if;
 result_value=to_jsonb(row);
 insert into public.system_settings_operations(request_key,user_id,request,result) values(p_request_key,auth.uid(),request_value,result_value);
 return result_value;
end;$$;
revoke all on function public.admin_create_system_settings(uuid) from public,anon;
grant execute on function public.admin_create_system_settings(uuid) to authenticated;

-- Only the authenticated Edge handler may register verified, immutable branding.
create or replace function public.settings_register_brand_asset(p_user uuid,p_id uuid,p_key text,p_url text,p_mime text,p_size integer) returns jsonb
language plpgsql security definer set search_path=public as $$
declare row public.system_brand_assets%rowtype;extension text;inserted_count integer;
begin
 if p_user is null or not exists(select 1 from public.profiles p join public.user_roles ur on ur.user_id=p.id join public.roles r on r.id=ur.role_id where p.id=p_user and p.status='active' and r.code='super_admin') then raise exception 'Akses unggahan tidak diizinkan.';end if;
 extension=case p_mime when 'image/png' then 'png' when 'image/jpeg' then 'jpg' when 'image/webp' then 'webp' else null end;
 if p_id is null or extension is null or p_key is distinct from 'branding/'||p_id::text||'.'||extension or p_url is null or p_url !~ '^https://[^/@[:space:]]+/functions/v1/settings-assets\?asset=[0-9a-f-]{36}$' or right(p_url,36)<>p_id::text or p_size is null or p_size<=0 or p_size>2097152 then raise exception 'Metadata gambar belum valid.';end if;
 insert into public.system_brand_assets(id,created_by,object_key,public_url,mime_type,file_size) values(p_id,p_user,p_key,p_url,p_mime,p_size) on conflict(id) do nothing;
 get diagnostics inserted_count=row_count;
 select * into row from public.system_brand_assets where id=p_id;
 if row.created_by<>p_user or row.object_key<>p_key or row.public_url<>p_url or row.mime_type<>p_mime or row.file_size<>p_size then raise exception 'Unggahan berbeda. Coba kembali.';end if;
 if inserted_count=1 then insert into public.audit_logs(user_id,action,entity_type,entity_id,details) values(p_user,'settings.brand_uploaded','system_brand_asset',p_id,jsonb_build_object('mime_type',p_mime,'file_size',p_size));end if;
 return jsonb_build_object('asset_id',row.id,'url',row.public_url);
end;$$;
revoke all on function public.settings_register_brand_asset(uuid,uuid,text,text,text,integer) from public,anon,authenticated;
grant execute on function public.settings_register_brand_asset(uuid,uuid,text,text,text,integer) to service_role;

-- Public identity remains readable; all mutations must validate role, version and audit.
drop policy if exists "Super admin can update system settings" on public.system_settings;
drop policy if exists "Super admin can insert system settings" on public.system_settings;
revoke all on public.system_settings,public.system_settings_operations,public.system_brand_assets from public,anon,authenticated;
grant select on public.system_settings to anon,authenticated;
grant select,insert on public.system_brand_assets to service_role;
