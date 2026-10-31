-- User access workspace. Deployment changes no account, role assignment or password.
create or replace function public.system_user_assignments(p_user uuid)
returns jsonb language sql stable security definer set search_path=public as $$
 with assignments as(select ur.id,ur.role_id,r.code,r.name,ur.scope_type,ur.scope_id,ur.created_at,
 case when ur.scope_id is null and coalesce(ur.scope_type,'global')='global' then 'Umum'
 when ur.scope_type='unit' then coalesce(u.name,'Unit tidak tersedia')
 when ur.scope_type='program' then coalesce(p.name,'Program tidak tersedia')
 else 'Cakupan lama' end as scope_name,
 (ur.scope_id is null and coalesce(ur.scope_type,'global')='global' or ur.scope_type='unit' and u.id is not null and r.code in ('admin','helpdesk') or ur.scope_type='program' and p.id is not null and r.code='helpdesk') as supported_scope,
 count(*) over(partition by ur.role_id,coalesce(nullif(ur.scope_type,''),'global'),ur.scope_id) as duplicates
 from public.user_roles ur join public.roles r on r.id=ur.role_id left join public.units u on ur.scope_type='unit' and ur.scope_id=u.id left join public.programs p on ur.scope_type='program' and ur.scope_id=p.id where ur.user_id=p_user)
 select coalesce(jsonb_agg(to_jsonb(a) order by a.name,a.scope_name,a.id),'[]') from assignments a;
$$;
revoke all on function public.system_user_assignments(uuid) from public,anon,authenticated;

create or replace function public.system_users_list(p_filters jsonb default '{}')
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare role_value text=coalesce(p_filters->>'role','all');status_value text=coalesce(p_filters->>'status','all');attention text=coalesce(p_filters->>'attention','all');program_value uuid=nullif(p_filters->>'program','')::uuid;search_value text=left(btrim(coalesce(p_filters->>'q','')),120);page_value int=coalesce((p_filters->>'page')::int,1);size_value int=coalesce((p_filters->>'size')::int,25);export_value boolean=coalesce((p_filters->>'export')::boolean,false);result_value jsonb;
begin
 if auth.uid() is null or not coalesce(public.is_super_admin(),false) or not exists(select 1 from public.profiles where id=auth.uid() and status='active') then raise exception 'Pengelolaan pengguna hanya tersedia untuk superadmin aktif.';end if;
 if role_value not in ('all','without_role') and not exists(select 1 from public.roles where code=role_value) or status_value not in ('all','active','inactive','suspended','other','nonactive') or attention not in ('all','unconfirmed','missing_auth','scope','duplicates') or page_value<1 or page_value>100000 or size_value not in (10,25,50,100) then raise exception 'Filter pengguna tidak valid.';end if;
 if program_value is not null and not exists(select 1 from public.programs where id=program_value) then raise exception 'Program tidak ditemukan.';end if;
 with base as materialized(select p.id,p.full_name,p.email,p.status,p.created_at,public.system_user_assignments(p.id) as assignments,a.id is not null as account_exists,a.email_confirmed_at is not null as email_confirmed,a.last_sign_in_at,coalesce(a.banned_until>now(),false) as login_blocked,
 (select count(*) from public.participants part where part.user_id=p.id) as participants_count,
 (select count(*) from public.classes c where c.teacher_user_id=p.id) as classes_count
 from public.profiles p left join auth.users a on a.id=p.id),
 filtered as materialized(select b.* from base b where
 (search_value='' or position(lower(search_value) in lower(coalesce(b.full_name,'')||' '||coalesce(b.email,'')||' '||coalesce((select string_agg(a->>'name',' ') from jsonb_array_elements(b.assignments) a),'')))>0)
 and (role_value='all' or role_value='without_role' and jsonb_array_length(b.assignments)=0 or exists(select 1 from jsonb_array_elements(b.assignments) a where a->>'code'=role_value))
 and (status_value='all' or status_value='nonactive' and b.status is distinct from 'active' or status_value='other' and coalesce(b.status,'') not in ('active','inactive','suspended') or b.status=status_value)
 and (attention='all' or attention='unconfirmed' and b.account_exists and not b.email_confirmed or attention='missing_auth' and not b.account_exists or attention='scope' and exists(select 1 from jsonb_array_elements(b.assignments) a where not (a->>'supported_scope')::boolean) or attention='duplicates' and exists(select 1 from jsonb_array_elements(b.assignments) a where (a->>'duplicates')::int>1))
 and (program_value is null or exists(select 1 from public.participants part join public.enrollments e on e.participant_id=part.id where part.user_id=b.id and e.program_id=program_value)
 or exists(select 1 from public.guardians g join public.guardian_participants gp on gp.guardian_id=g.id join public.enrollments e on e.participant_id=gp.participant_id where g.user_id=b.id and e.program_id=program_value)
 or exists(select 1 from public.classes c where c.program_id=program_value and c.teacher_user_id=b.id)
 or exists(select 1 from public.halaqahs h join public.classes c on c.id=h.class_id where h.mentor_user_id=b.id and c.program_id=program_value)
 or exists(select 1 from public.programs p where p.id=program_value and (p.teacher_user_id=b.id or exists(select 1 from public.unit_users u where u.user_id=b.id and u.unit_id=p.unit_id) or exists(select 1 from jsonb_array_elements(b.assignments) a where a->>'scope_type'='program' and a->>'scope_id'=p.id::text or a->>'scope_type'='unit' and a->>'scope_id'=p.unit_id::text))))),
 page_rows as(select * from filtered order by created_at desc,id limit case when export_value then 10001 else size_value end offset case when export_value then 0 else (page_value-1)*size_value end)
 select jsonb_build_object('generated_at',now(),'total',(select count(*) from filtered),'page',page_value,'size',size_value,'rows',coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at desc,r.id) from page_rows r),'[]'),'roles',coalesce((select jsonb_agg(jsonb_build_object('id',id,'code',code,'name',name) order by name) from public.roles),'[]'),'programs',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'status',status) order by name,id) from public.programs),'[]'),'stats',jsonb_build_object('total',(select count(*) from base),'active',(select count(*) from base where status='active'),'nonactive',(select count(*) from base where status is distinct from 'active'),'without_role',(select count(*) from base where jsonb_array_length(assignments)=0),'superadmins',(select count(*) from base where status='active' and exists(select 1 from jsonb_array_elements(assignments) a where a->>'code'='super_admin')),'unconfirmed',(select count(*) from base where account_exists and not email_confirmed),'missing_auth',(select count(*) from base where not account_exists),'scope',(select count(*) from base where exists(select 1 from jsonb_array_elements(assignments) a where not (a->>'supported_scope')::boolean)),'duplicates',(select count(*) from base where exists(select 1 from jsonb_array_elements(assignments) a where (a->>'duplicates')::int>1)))) into result_value;
 if export_value and (result_value->>'total')::int>10000 then raise exception 'Ekspor maksimal 10.000 pengguna. Persempit filter terlebih dahulu.';end if;
 return result_value;
end;$$;

create or replace function public.system_user_detail(p_user uuid)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare profile_value jsonb;assignments jsonb;units_json jsonb;participants_json jsonb;children_json jsonb;classes_json jsonb;mentoring_json jsonb;auth_value jsonb;
begin
 if auth.uid() is null or not coalesce(public.is_super_admin(),false) or not exists(select 1 from public.profiles where id=auth.uid() and status='active') then raise exception 'Pengelolaan pengguna hanya tersedia untuk superadmin aktif.';end if;
 select jsonb_build_object('id',id,'full_name',full_name,'email',email,'phone',phone,'status',status,'created_at',created_at,'updated_at',updated_at) into profile_value from public.profiles where id=p_user;if profile_value is null then raise exception 'Pengguna tidak ditemukan.';end if;
 assignments=public.system_user_assignments(p_user);
 select jsonb_build_object('account_exists',true,'email_confirmed',email_confirmed_at is not null,'last_sign_in_at',last_sign_in_at,'login_blocked',coalesce(banned_until>now(),false)) into auth_value from auth.users where id=p_user;
 select coalesce(jsonb_agg(jsonb_build_object('id',u.id,'name',u.name,'role',uu.role_in_unit) order by u.name,u.id),'[]') into units_json from public.unit_users uu join public.units u on u.id=uu.unit_id where uu.user_id=p_user;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',display_name,'number',global_participant_number,'status',status) order by id),'[]') into participants_json from public.participants where user_id=p_user;
 select coalesce(jsonb_agg(jsonb_build_object('id',part.id,'name',part.display_name,'number',part.global_participant_number,'relation',g.relation_type) order by part.id),'[]') into children_json from public.guardians g join public.guardian_participants gp on gp.guardian_id=g.id join public.participants part on part.id=gp.participant_id where g.user_id=p_user;
 select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'program_id',p.id,'program_name',p.name,'status',c.status) order by p.name,c.name,c.id),'[]') into classes_json from public.classes c join public.programs p on p.id=c.program_id where c.teacher_user_id=p_user;
 select coalesce(jsonb_agg(jsonb_build_object('id',h.id,'name',h.name,'program_id',p.id,'program_name',p.name,'status',h.status) order by p.name,h.name,h.id),'[]') into mentoring_json from public.halaqahs h join public.classes c on c.id=h.class_id join public.programs p on p.id=c.program_id where h.mentor_user_id=p_user;
 return jsonb_build_object('profile',profile_value,'assignments',assignments,'revision',md5(jsonb_build_object('profile',profile_value,'assignments',assignments,'units',units_json)::text),'auth',coalesce(auth_value,jsonb_build_object('account_exists',false,'email_confirmed',false,'last_sign_in_at',null,'login_blocked',false)),
 'units',units_json,'program_assignments',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'status',p.status) order by p.name,p.id) from public.programs p where p.teacher_user_id=p_user),'[]'),'participants',participants_json,'children',children_json,'classes',classes_json,'halaqahs',mentoring_json,
 'options',jsonb_build_object('roles',coalesce((select jsonb_agg(jsonb_build_object('id',id,'code',code,'name',name) order by name) from public.roles),'[]'),'units',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'status',status) order by name,id) from public.units),'[]'),'programs',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'status',status) order by name,id) from public.programs),'[]')),
 'history',coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at desc,a.id) from (select a.id,a.action,a.created_at,a.details,coalesce(p.full_name,'Superadmin') as actor_name from public.audit_logs a left join public.profiles p on p.id=a.user_id where a.entity_type='profile' and a.entity_id=p_user and a.action in ('user.role_granted','user.role_revoked') order by a.created_at desc,a.id limit 10) a),'[]'));
end;$$;

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
  if exists(select 1 from public.user_roles where user_id=p_user and role_id=role_id_value and coalesce(nullif(scope_type,''),'global')=coalesce(scope_type_value,'global') and scope_id is not distinct from scope_id_value) then raise exception 'Peran dengan cakupan ini sudah ada.';end if;
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
revoke all on function public.system_users_list(jsonb),public.system_user_detail(uuid),public.system_user_role_change(uuid,text,jsonb) from public,anon;
grant execute on function public.system_users_list(jsonb),public.system_user_detail(uuid),public.system_user_role_change(uuid,text,jsonb) to authenticated;
-- Existing table RLS is preserved for deployed clients. This workspace uses guarded RPCs.
-- Browser clients do not require the ability to truncate the assignment table.
revoke truncate on public.user_roles from anon,authenticated;
