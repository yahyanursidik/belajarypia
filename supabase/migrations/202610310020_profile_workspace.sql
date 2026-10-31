-- Self-service profile workspace. Deployment does not update account or business rows.
create or replace function public.my_profile_workspace() returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare actor uuid:=auth.uid(); p public.profiles%rowtype; login_value jsonb;
begin
 if actor is null then raise exception 'Silakan masuk kembali.' using errcode='42501';end if;
 select * into p from public.profiles where id=actor;
 if not found then raise exception 'Profil akun belum tersedia. Hubungi pengelola.';end if;
 select jsonb_build_object('email',a.email,'email_confirmed',a.email_confirmed_at is not null,'last_sign_in_at',a.last_sign_in_at,'login_blocked',coalesce(a.banned_until>now(),false),'password_enabled',coalesce(a.encrypted_password<>'',false),'providers',coalesce((select jsonb_agg(distinct i.provider order by i.provider) from auth.identities i where i.user_id=actor),'[]')) into login_value from auth.users a where a.id=actor;
 if login_value is null then raise exception 'Akun login tidak tersedia. Silakan masuk kembali.' using errcode='42501';end if;
 return jsonb_build_object('generated_at',statement_timestamp(),'profile',jsonb_build_object('id',p.id,'full_name',p.full_name,'phone',p.phone,'email',p.email,'status',p.status,'created_at',p.created_at,'updated_at',p.updated_at),
 'revision',md5(jsonb_build_array(p.id,p.full_name,p.phone,p.email,p.status,p.updated_at)::text),'login',login_value,'assignments',public.system_user_assignments(actor),
 'history',coalesce((select jsonb_agg(to_jsonb(h) order by h.created_at desc,h.id desc) from(select id,created_at,details->'fields' as fields from public.audit_logs where user_id=actor and entity_type='profile' and entity_id=actor and action='profile.updated' order by created_at desc,id desc limit 5) h),'[]'));
end;$$;

create or replace function public.my_profile_update(p_revision text,p_changes jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare actor uuid:=auth.uid(); p public.profiles%rowtype; next_name text; next_phone text; changed text[]:='{}'; item record;
begin
 if actor is null then raise exception 'Silakan masuk kembali.' using errcode='42501';end if;
 if p_changes is null or jsonb_typeof(p_changes)<>'object' then raise exception 'Perubahan profil tidak valid.';end if;
 for item in select key,value from jsonb_each(p_changes) loop
  if item.key not in ('full_name','phone') then raise exception 'Kolom profil tidak diizinkan.';end if;
  if (item.key='full_name' and jsonb_typeof(item.value)<>'string') or (item.key='phone' and jsonb_typeof(item.value) not in ('string','null')) then raise exception 'Format data profil tidak valid.';end if;
 end loop;
 select * into p from public.profiles where id=actor for update;
 if not found then raise exception 'Profil akun belum tersedia.';end if;
 if p.status<>'active' or not exists(select 1 from auth.users where id=actor and not coalesce(banned_until>now(),false)) then raise exception 'Profil tidak aktif atau login dibatasi. Hubungi pengelola.' using errcode='42501';end if;
 if p_revision is distinct from md5(jsonb_build_array(p.id,p.full_name,p.phone,p.email,p.status,p.updated_at)::text) then raise exception 'Profil sudah berubah. Muat data terbaru sebelum menyimpan.' using errcode='40001';end if;
 next_name=p.full_name;next_phone=p.phone;
 if p_changes?'full_name' then
  next_name=btrim(p_changes->>'full_name');
  if length(next_name)<2 or length(next_name)>160 or next_name ~ '[[:cntrl:]]' then raise exception 'Nama harus 2–160 karakter tanpa baris baru.';end if;
 end if;
 if p_changes?'phone' then
  next_phone=nullif(btrim(p_changes->>'phone'),'');
  if next_phone is not null and (length(next_phone)>32 or next_phone !~ '^\+?[0-9() .-]+$' or length(regexp_replace(next_phone,'[^0-9]','','g')) not between 7 and 20) then raise exception 'Nomor telepon harus berisi 7–20 digit; tanda +, spasi, kurung dan tanda hubung diperbolehkan.';end if;
 end if;
 if next_name is distinct from p.full_name then changed=array_append(changed,'full_name');end if;
 if next_phone is distinct from p.phone then changed=array_append(changed,'phone');end if;
 if cardinality(changed)=0 then return public.my_profile_workspace()||jsonb_build_object('saved',false);end if;
 update public.profiles set full_name=next_name,phone=next_phone,updated_at=clock_timestamp() where id=actor;
 insert into public.audit_logs(user_id,action,entity_type,entity_id,details) values(actor,'profile.updated','profile',actor,jsonb_build_object('fields',changed));
 return public.my_profile_workspace()||jsonb_build_object('saved',true);
end;$$;
revoke all on function public.my_profile_workspace(),public.my_profile_update(text,jsonb) from public,anon;
grant execute on function public.my_profile_workspace(),public.my_profile_update(text,jsonb) to authenticated;
