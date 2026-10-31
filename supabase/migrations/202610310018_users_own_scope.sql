-- Display canonical learner own scope accurately; prevent redundant personal-role grants.
-- No grant/ACL changes and no account or assignment data mutations.
create or replace function public.system_user_assignments(p_user uuid)
returns jsonb language sql stable security definer set search_path=public as $$
 with assignments as(select ur.id,ur.role_id,r.code,r.name,ur.scope_type,ur.scope_id,ur.created_at,
 case when r.code in ('participant','guardian') and ((ur.scope_id is null and coalesce(ur.scope_type,'global')='global') or ur.scope_type='own' and ur.scope_id=p_user) then 'Data sendiri'
 when ur.scope_id is null and coalesce(ur.scope_type,'global')='global' then 'Umum'
 when ur.scope_type='unit' then coalesce(u.name,'Unit tidak tersedia')
 when ur.scope_type='program' then coalesce(p.name,'Program tidak tersedia')
 else 'Cakupan lama' end as scope_name,
 (ur.scope_type='own' and ur.scope_id=p_user and r.code in ('participant','guardian') or ur.scope_id is null and coalesce(ur.scope_type,'global')='global' or ur.scope_type='unit' and u.id is not null and r.code in ('admin','helpdesk') or ur.scope_type='program' and p.id is not null and r.code='helpdesk') as supported_scope,
 count(*) over(partition by ur.role_id,case when r.code in ('participant','guardian') then 'own' else coalesce(nullif(ur.scope_type,''),'global') end,case when r.code in ('participant','guardian') then p_user else ur.scope_id end) as duplicates
 from public.user_roles ur join public.roles r on r.id=ur.role_id left join public.units u on ur.scope_type='unit' and ur.scope_id=u.id left join public.programs p on ur.scope_type='program' and ur.scope_id=p.id where ur.user_id=p_user)
 select coalesce(jsonb_agg(to_jsonb(a) order by a.name,a.scope_name,a.id),'[]') from assignments a;
$$;

create or replace function public.system_user_role_change(p_user uuid,p_revision text,p_change jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare detail_value jsonb;actor_id uuid=auth.uid();operation text=p_change->>'operation';role_code text=p_change->>'role';scope_type_value text=nullif(p_change->>'scope_type','');scope_id_value uuid=nullif(p_change->>'scope_id','')::uuid;assignment_id uuid;role_id_value uuid;row_value public.user_roles%rowtype;reason_value text=btrim(coalesce(p_change->>'reason',''));target_active boolean;
begin
 if actor_id is null or not coalesce(public.is_super_admin(),false) or not exists(select 1 from public.profiles where id=actor_id and status='active') then raise exception 'Pengelolaan pengguna hanya tersedia untuk superadmin aktif.';end if;
 if operation is null or operation not in ('grant','revoke') or length(reason_value)<3 or length(reason_value)>1000 then raise exception 'Pilih tindakan dan isi alasan 3–1.000 karakter.';end if;
 perform set_config('lock_timeout','5s',true);
 lock table public.profiles in share mode;
 lock table public.user_roles in share row exclusive mode;
 detail_value=public.system_user_detail(p_user);
 if p_revision is distinct from detail_value->>'revision' then raise exception 'Data pengguna sudah berubah. Muat ulang sebelum menyimpan.';end if;
 if operation='grant' then
  target_active=detail_value->'profile'->>'status'='active' and (detail_value->'auth'->>'account_exists')::boolean and not (detail_value->'auth'->>'login_blocked')::boolean;
  if not coalesce(target_active,false) then raise exception 'Peran baru memerlukan profil aktif dan akun login yang tidak diblokir.';end if;
  if role_code is null or role_code not in ('super_admin','admin','teacher','mentor','participant','guardian','finance','helpdesk','content_reviewer') then raise exception 'Peran tidak valid.';end if;
  select id into role_id_value from public.roles where code=role_code;if role_id_value is null then raise exception 'Peran tidak ditemukan.';end if;
  if scope_type_value='global' then scope_type_value=null;end if;
  if scope_type_value is null then
   if scope_id_value is not null then raise exception 'Cakupan umum tidak memakai unit/program.';end if;
  elsif scope_type_value='unit' and role_code in ('admin','helpdesk') then
   if not exists(select 1 from public.units where id=scope_id_value and status='active') then raise exception 'Pilih unit aktif.';end if;
  elsif scope_type_value='program' and role_code='helpdesk' then
   if not exists(select 1 from public.programs where id=scope_id_value and status='active') then raise exception 'Pilih program aktif.';end if;
  else raise exception 'Cakupan ini belum didukung secara konsisten untuk peran tersebut.';end if;
  if role_code='participant' and not exists(select 1 from public.participants where user_id=p_user) then raise exception 'Tautkan profil peserta terlebih dahulu melalui menu Peserta.';end if;
  if role_code='guardian' and not exists(select 1 from public.guardians g join public.guardian_participants gp on gp.guardian_id=g.id where g.user_id=p_user) then raise exception 'Tautkan wali dan anak terlebih dahulu melalui menu Peserta.';end if;
  if exists(select 1 from public.user_roles where user_id=p_user and role_id=role_id_value and (role_code in ('participant','guardian') or coalesce(nullif(scope_type,''),'global')=coalesce(scope_type_value,'global') and scope_id is not distinct from scope_id_value)) then raise exception 'Peran dengan cakupan ini sudah ada.';end if;
  insert into public.user_roles(user_id,role_id,scope_type,scope_id) values(p_user,role_id_value,scope_type_value,scope_id_value) returning id into assignment_id;
 else
  assignment_id=nullif(p_change->>'assignment_id','')::uuid;
  select * into row_value from public.user_roles where id=assignment_id and user_id=p_user for update;if not found then raise exception 'Penugasan peran tidak ditemukan.';end if;
  select code into role_code from public.roles where id=row_value.role_id;
  scope_type_value=row_value.scope_type;scope_id_value=row_value.scope_id;
  if role_code='super_admin' then
   if p_user=actor_id then raise exception 'Peran superadmin Anda sendiri tidak dapat dilepas melalui halaman ini.';end if;
   if not exists(select 1 from public.user_roles ur join public.roles r on r.id=ur.role_id join public.profiles p on p.id=ur.user_id join auth.users a on a.id=p.id where r.code='super_admin' and p.status='active' and not coalesce(a.banned_until>now(),false) and ur.user_id<>p_user) then raise exception 'Sistem harus memiliki superadmin aktif lainnya.';end if;
  end if;
  delete from public.user_roles where id=assignment_id and user_id=p_user;
 end if;
 insert into public.audit_logs(user_id,action,entity_type,entity_id,details) values(actor_id,case operation when 'grant' then 'user.role_granted' else 'user.role_revoked' end,'profile',p_user,jsonb_build_object('role',role_code,'assignment_id',assignment_id,'scope_type',scope_type_value,'scope_id',scope_id_value,'reason',reason_value));
 return public.system_user_detail(p_user);
end;$$;
