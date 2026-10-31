-- Foundation absent in the live project: store an explicit graduation decision before certification.
alter table public.programs add column if not exists graduation_settings jsonb not null default '{"minimum_final_score":65,"minimum_completion_percent":100,"require_all_assessments_passed":true,"require_payment_clearance":false}'::jsonb;
create table if not exists public.program_graduation_results (
 id uuid primary key default gen_random_uuid(),program_id uuid not null references public.programs(id) on delete cascade,enrollment_id uuid not null unique references public.enrollments(id) on delete cascade,
 final_score numeric(5,2),completion_percent numeric(5,2) not null default 0,predicate text,status text not null default 'eligible' check(status in ('eligible','graduated','revision')),notes text,decided_by uuid references public.profiles(id),decided_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index if not exists program_graduation_results_program_id_idx on public.program_graduation_results(program_id,status);
alter table public.program_graduation_results enable row level security;
-- Certificate operations are scoped and transactional; jobs contain an issuance snapshot.
alter table public.certificate_issuance_batches add column if not exists request_key uuid;
alter table public.certificate_issuance_batches add column if not exists request_payload jsonb;
create unique index if not exists certificate_issuance_request_key_idx on public.certificate_issuance_batches(request_key) where request_key is not null;
alter table public.certificate_generation_jobs add column if not exists issuance_snapshot jsonb;
alter table public.certificate_generation_jobs add column if not exists claim_token uuid;
alter table public.certificate_generation_jobs add column if not exists locked_until timestamptz;
alter table public.certificate_generation_jobs add column if not exists certificate_id uuid references public.certificates(id) on delete restrict;

create or replace function public.certificate_admin_access(p_program_id uuid) returns boolean language sql stable security definer set search_path=public as $$
 select auth.uid() is not null and (public.is_super_admin() or (public.has_role('admin') and public.can_access_program(p_program_id)));
$$;
revoke all on function public.certificate_admin_access(uuid) from public,anon;
grant execute on function public.certificate_admin_access(uuid) to authenticated;

drop policy if exists graduation_results_manage_staff on public.program_graduation_results;
drop policy if exists graduation_results_select_participant on public.program_graduation_results;
create policy graduation_results_scoped_read on public.program_graduation_results for select to authenticated using(public.certificate_admin_access(program_id) or exists(select 1 from public.enrollments e join public.participants p on p.id=e.participant_id where e.id=enrollment_id and p.user_id=auth.uid()));

create or replace function public.finalize_program_graduation(target_enrollment_id uuid,target_final_score numeric,target_completion_percent numeric,target_predicate text,target_notes text default null) returns uuid language plpgsql security definer set search_path=public as $$
declare enr public.enrollments%rowtype;pr public.programs%rowtype;existing public.program_graduation_results%rowtype;result_id uuid;total int;done int;assessments int;scored int;all_passed boolean;score numeric;completion numeric;min_score numeric;min_completion numeric;predicate_value text;
begin
 select * into enr from public.enrollments where id=target_enrollment_id for update;
 if not found or not public.certificate_admin_access(enr.program_id) then raise exception 'Anda tidak memiliki akses untuk menetapkan kelulusan.';end if;
 select * into existing from public.program_graduation_results where enrollment_id=enr.id for update;
 if found and existing.status='graduated' then return existing.id;end if;
 select * into pr from public.programs where id=enr.program_id for share;
 perform id from public.participants where id=enr.participant_id for share;
 if enr.enrollment_status<>'active' or not exists(select 1 from public.participants where id=enr.participant_id and status='active') then raise exception 'Hanya peserta dan enrollment aktif yang dapat ditetapkan lulus.';end if;
 if length(coalesce(target_notes,''))>4000 then raise exception 'Catatan kelulusan maksimal 4.000 karakter.';end if;
 min_score=coalesce((pr.graduation_settings->>'minimum_final_score')::numeric,65);min_completion=coalesce((pr.graduation_settings->>'minimum_completion_percent')::numeric,100);
 if min_score not between 0 and 100 or min_completion not between 0 and 100 then raise exception 'Kriteria kelulusan belum valid.';end if;
 perform l.id from public.lessons l join public.program_modules m on m.id=l.module_id where m.program_id=pr.id for share of l;
 perform lp.id from public.lesson_progresses lp where lp.enrollment_id=enr.id for share;
 select count(*),count(*) filter(where lp.status='completed'),count(*) filter(where l.lesson_type in ('quiz','exam')),count(*) filter(where l.lesson_type in ('quiz','exam') and lp.status='completed' and lp.score between 0 and 100),avg(lp.score) filter(where l.lesson_type in ('quiz','exam') and lp.status='completed' and lp.score between 0 and 100),coalesce(bool_and(coalesce(lp.status='completed' and lp.score>=coalesce(l.passing_grade,min_score) and lp.score<=100,false)) filter(where l.lesson_type in ('quiz','exam')),true)
 into total,done,assessments,scored,score,all_passed from public.lessons l join public.program_modules m on m.id=l.module_id left join public.lesson_progresses lp on lp.lesson_id=l.id and lp.enrollment_id=enr.id where m.program_id=pr.id and l.visibility_status='published';
 completion=case when total>0 then round(done::numeric/total*100,2) else 0 end;
 score=case when assessments=0 then completion else round(score,2) end;
 if total=0 or (assessments>0 and scored=0) or score is null or score<min_score or completion<min_completion or (coalesce((pr.graduation_settings->>'require_all_assessments_passed')::boolean,true) and not all_passed) or (coalesce((pr.graduation_settings->>'require_payment_clearance')::boolean,false) and coalesce(enr.payment_status,'') not in ('not_required','paid','verified','completed')) then raise exception 'Syarat kelulusan belum terpenuhi berdasarkan hasil belajar tersimpan.';end if;
 if target_final_score is null or target_completion_percent is null or abs(target_final_score-score)>.011 or abs(target_completion_percent-completion)>.011 then raise exception 'Hasil belajar telah berubah. Muat ulang sebelum menetapkan kelulusan.';end if;
 if jsonb_typeof(pr.grading_rubric)='array' and jsonb_array_length(pr.grading_rubric)>0 then
  select item->>'label' into predicate_value from jsonb_array_elements(pr.grading_rubric) item where score between (item->>'min_score')::numeric and (item->>'max_score')::numeric limit 1;
 else predicate_value=case when score>=90 then 'Mumtaz (Istimewa)' when score>=80 then 'Jayyid Jiddan (Baik Sekali)' when score>=65 then 'Jayyid (Baik)' when score>=40 then 'Maqbul (Cukup)' else 'Rasib (Perlu Mengulang)' end;end if;
 if nullif(btrim(predicate_value),'') is null or predicate_value is distinct from target_predicate then raise exception 'Predikat telah berubah. Periksa rubrik kelulusan.';end if;
 insert into public.program_graduation_results(program_id,enrollment_id,final_score,completion_percent,predicate,status,notes,decided_by,decided_at) values(pr.id,enr.id,score,completion,predicate_value,'graduated',nullif(btrim(target_notes),''),auth.uid(),now()) on conflict(enrollment_id) do update set final_score=excluded.final_score,completion_percent=excluded.completion_percent,predicate=excluded.predicate,status='graduated',notes=excluded.notes,decided_by=auth.uid(),decided_at=now(),updated_at=now() returning id into result_id;
 update public.enrollments set enrollment_status='completed',ended_at=coalesce(ended_at,now()),updated_at=now() where id=enr.id;
 insert into public.enrollment_status_logs(enrollment_id,old_status,new_status,reason,changed_by) values(enr.id,enr.enrollment_status,'completed','Kelulusan program ditetapkan melalui workflow akademik',auth.uid());
 insert into public.audit_logs(user_id,action,entity_type,entity_id,details) values(auth.uid(),'program_graduation.finalized','enrollment',enr.id,jsonb_build_object('final_score',score,'completion_percent',completion));
 return result_id;
end;
$$;
revoke all on function public.finalize_program_graduation(uuid,numeric,numeric,text,text) from public,anon;
grant execute on function public.finalize_program_graduation(uuid,numeric,numeric,text,text) to authenticated;

create or replace function public.certificate_eligibility_reason(p_enrollment_id uuid) returns text language sql stable security definer set search_path=public as $$
 select case
 when not coalesce((pr.feature_flags->>'use_certificate')::boolean,false) then 'Sertifikat belum diaktifkan pada program'
 when pt.status<>'active' then 'Status peserta tidak aktif'
 when e.enrollment_status<>'completed' or gr.status is distinct from 'graduated' then 'Kelulusan belum ditetapkan'
 when coalesce((pr.graduation_settings->>'require_payment_clearance')::boolean,false) and coalesce(e.payment_status,'') not in ('not_required','paid','verified','completed') then 'Penyelesaian administrasi belum terpenuhi'
 when exists(select 1 from public.certificates c where c.enrollment_id=e.id and c.status='issued') then 'Sertifikat sudah terbit'
 when exists(select 1 from public.certificate_generation_jobs j where j.enrollment_id=e.id and j.status in ('pending','processing','completed')) then 'Sudah masuk antrean penerbitan'
 else '' end
 from public.enrollments e join public.programs pr on pr.id=e.program_id join public.participants pt on pt.id=e.participant_id left join public.program_graduation_results gr on gr.enrollment_id=e.id and gr.program_id=e.program_id where e.id=p_enrollment_id;
$$;
revoke all on function public.certificate_eligibility_reason(uuid) from public,anon,authenticated;

create or replace function public.admin_check_certificate_eligibility(p_program_id uuid,p_batch_id uuid default null) returns jsonb language plpgsql security definer set search_path=public as $$
declare result jsonb;
begin
 if not public.certificate_admin_access(p_program_id) then raise exception 'Anda tidak memiliki akses ke sertifikat program ini.';end if;
 if p_batch_id is not null and not exists(select 1 from public.batches where id=p_batch_id and program_id=p_program_id) then raise exception 'Angkatan bukan milik program ini.';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'participant_id',e.participant_id,'enrollment_number',e.enrollment_number,'enrollment_status',e.enrollment_status,'eligible',reason='','reason',case when reason='' then 'Kelulusan telah ditetapkan' else reason end,'participants',jsonb_build_object('display_name',p.display_name,'global_participant_number',p.global_participant_number),'final_score',g.final_score,'predicate',g.predicate) order by p.display_name,e.id),'[]'::jsonb) into result from public.enrollments e join public.participants p on p.id=e.participant_id left join public.program_graduation_results g on g.enrollment_id=e.id cross join lateral(select public.certificate_eligibility_reason(e.id) reason) r where e.program_id=p_program_id and (p_batch_id is null or e.batch_id=p_batch_id);
 return result;
end;
$$;
revoke all on function public.admin_check_certificate_eligibility(uuid,uuid) from public,anon;
grant execute on function public.admin_check_certificate_eligibility(uuid,uuid) to authenticated;

create or replace function public.admin_save_certificate_template(p_id uuid,p_expected_updated_at timestamptz,p_program_id uuid,p_name text,p_data jsonb,p_background text default null,p_status text default 'active') returns jsonb language plpgsql security definer set search_path=public as $$
declare row public.certificate_templates%rowtype; field text; val numeric; max_val numeric;
begin
 if not public.certificate_admin_access(p_program_id) then raise exception 'Anda tidak memiliki akses ke template program ini.';end if;
 if not exists(select 1 from public.programs where id=p_program_id) then raise exception 'Program tidak ditemukan.';end if;
 if nullif(btrim(p_name),'') is null or length(btrim(p_name))>160 or p_status not in ('active','archived') or p_status is null then raise exception 'Nama atau status template tidak valid.';end if;
 if jsonb_typeof(p_data) is distinct from 'object' then raise exception 'Tata letak harus berupa objek.';end if;
 -- Archive may preserve legacy layout; activation/save requires the renderer contract.
 if p_status='active' then
  foreach field in array array['name_x','name_y','name_size','no_x','no_y','no_size'] loop
   if jsonb_typeof(p_data->field) is distinct from 'number' then raise exception 'Lengkapi posisi dan ukuran teks.';end if;
   val=(p_data->>field)::numeric;max_val=case when field like '%_x' then 842 when field like '%_y' then 595 else 72 end;
   if val<(case when field like '%size' then 6 else 0 end) or val>max_val then raise exception 'Posisi atau ukuran teks di luar area A4.';end if;
  end loop;
  if nullif(btrim(p_background),'') is not null and (p_background !~* '\.pdf$' or p_background like '%://%' or p_background like '%..%' or p_background like '/%' or length(p_background)>500) then raise exception 'Dokumen latar harus berupa path PDF yang valid.';end if;
 end if;
 if p_id is null then
  insert into public.certificate_templates(program_id,name,template_type,template_data_json,background_object_key,status) values(p_program_id,btrim(p_name),'json',p_data,nullif(btrim(p_background),''),p_status) returning * into row;
 else
  select * into row from public.certificate_templates where id=p_id for update;
  if not found or row.program_id<>p_program_id then raise exception 'Template bukan milik program ini.';end if;
  if p_expected_updated_at is null or row.updated_at<>p_expected_updated_at then raise exception 'Template telah berubah. Muat ulang sebelum menyimpan.';end if;
  update public.certificate_templates set name=btrim(p_name),template_data_json=p_data,background_object_key=nullif(btrim(p_background),''),status=p_status,updated_at=now() where id=p_id returning * into row;
 end if;
 insert into public.audit_logs(user_id,action,entity_type,entity_id,details) values(auth.uid(),'certificate_template.saved','certificate_template',row.id,jsonb_build_object('program_id',p_program_id,'status',p_status));
 return jsonb_build_object('id',row.id,'updated_at',row.updated_at,'status',row.status);
end;
$$;
revoke all on function public.admin_save_certificate_template(uuid,timestamptz,uuid,text,jsonb,text,text) from public,anon;
grant execute on function public.admin_save_certificate_template(uuid,timestamptz,uuid,text,jsonb,text,text) to authenticated;

create or replace function public.admin_create_certificate_batch(p_program_id uuid,p_batch_id uuid,p_template_id uuid,p_enrollment_ids uuid[],p_request_key uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare tpl public.certificate_templates%rowtype; enrollment_row public.enrollments%rowtype; result public.certificate_issuance_batches%rowtype; eid uuid; reason text; payload jsonb; ids uuid[]; snapshot jsonb;
begin
 if not public.certificate_admin_access(p_program_id) then raise exception 'Anda tidak memiliki akses untuk membuat antrean.';end if;
 if p_request_key is null or coalesce(cardinality(p_enrollment_ids),0) not between 1 and 500 then raise exception 'Pilih 1 sampai 500 peserta per antrean.';end if;
 select array_agg(distinct x order by x) into ids from unnest(p_enrollment_ids) x;
 if cardinality(ids)<>cardinality(p_enrollment_ids) or array_position(ids,null) is not null then raise exception 'Pilihan peserta berulang atau tidak valid.';end if;
 payload=jsonb_build_object('program_id',p_program_id,'batch_id',p_batch_id,'template_id',p_template_id,'ids',ids,'user_id',auth.uid());
 perform pg_advisory_xact_lock(hashtextextended(p_request_key::text,1));
 select * into result from public.certificate_issuance_batches where request_key=p_request_key;
 if found then
  if result.request_payload<>payload then raise exception 'Permintaan antrean berbeda. Periksa pilihan Anda.';end if;
  return jsonb_build_object('batch_id',result.id,'total_jobs',result.total_jobs,'status',result.status);
 end if;
 select * into tpl from public.certificate_templates where id=p_template_id and program_id=p_program_id and status='active' for share;
 if not found then raise exception 'Pilih template aktif milik program ini.';end if;
 if jsonb_typeof(tpl.template_data_json) is distinct from 'object' then raise exception 'Tata letak template belum siap.';end if;
 if p_batch_id is not null and not exists(select 1 from public.batches where id=p_batch_id and program_id=p_program_id) then raise exception 'Angkatan bukan milik program ini.';end if;
 perform id from public.programs where id=p_program_id for share;
 foreach eid in array ids loop
  perform pg_advisory_xact_lock(hashtextextended(eid::text,2));
  select * into enrollment_row from public.enrollments where id=eid and program_id=p_program_id and (p_batch_id is null or batch_id=p_batch_id) for update;
  if not found then raise exception 'Peserta bukan milik program/angkatan yang dipilih.';end if;
  perform id from public.participants where id=enrollment_row.participant_id for share;
  perform id from public.program_graduation_results where enrollment_id=enrollment_row.id for share;
  reason=public.certificate_eligibility_reason(eid);
  if reason is distinct from '' then raise exception 'Kelayakan berubah: %. Periksa ulang daftar peserta.',coalesce(reason,'Enrollment tidak ditemukan');end if;
 end loop;
 insert into public.certificate_issuance_batches(program_id,batch_id,template_id,created_by,total_jobs,status,request_key,request_payload) values(p_program_id,p_batch_id,p_template_id,auth.uid(),cardinality(ids),'pending',p_request_key,payload) returning * into result;
 foreach eid in array ids loop
  select jsonb_build_object('recipient_name',p.display_name,'program_name',pr.name,'program_id',pr.id,'batch_id',e.batch_id,'template_data_json',tpl.template_data_json,'background_object_key',tpl.background_object_key) into snapshot from public.enrollments e join public.participants p on p.id=e.participant_id join public.programs pr on pr.id=e.program_id where e.id=eid;
  insert into public.certificate_generation_jobs(issuance_batch_id,enrollment_id,participant_id,template_id,issuance_snapshot) select result.id,e.id,e.participant_id,tpl.id,snapshot from public.enrollments e where e.id=eid;
 end loop;
 insert into public.audit_logs(user_id,action,entity_type,entity_id,details) values(auth.uid(),'certificate_batch.created','certificate_issuance_batch',result.id,jsonb_build_object('program_id',p_program_id,'total_jobs',cardinality(ids)));
 return jsonb_build_object('batch_id',result.id,'total_jobs',result.total_jobs,'status',result.status);
end;
$$;
revoke all on function public.admin_create_certificate_batch(uuid,uuid,uuid,uuid[],uuid) from public,anon;
grant execute on function public.admin_create_certificate_batch(uuid,uuid,uuid,uuid[],uuid) to authenticated;

create or replace function public.refresh_certificate_batch(p_batch_id uuid) returns void language plpgsql security definer set search_path=public as $$
declare total int; done int; failed int; waiting int;
begin
 perform id from public.certificate_issuance_batches where id=p_batch_id for update;
 select count(*),count(*) filter(where status='completed'),count(*) filter(where status='failed'),count(*) filter(where status in ('pending','processing')) into total,done,failed,waiting from public.certificate_generation_jobs where issuance_batch_id=p_batch_id;
 update public.certificate_issuance_batches set total_jobs=total,completed_jobs=done,failed_jobs=failed,status=case when waiting>0 then case when exists(select 1 from public.certificate_generation_jobs where issuance_batch_id=p_batch_id and status='processing') then 'processing' else 'pending' end when failed>0 then 'failed' else 'completed' end,completed_at=case when waiting=0 then coalesce(completed_at,now()) else null end where id=p_batch_id;
end;
$$;
revoke all on function public.refresh_certificate_batch(uuid) from public,anon,authenticated;

create or replace function public.admin_retry_certificate_jobs(p_batch_id uuid,p_job_ids uuid[]) returns jsonb language plpgsql security definer set search_path=public as $$
declare bid public.certificate_issuance_batches%rowtype;j public.certificate_generation_jobs%rowtype;cnt int=0;tpl public.certificate_templates%rowtype;snapshot jsonb;
begin
 select * into bid from public.certificate_issuance_batches where id=p_batch_id;
 if not found or not public.certificate_admin_access(bid.program_id) then raise exception 'Anda tidak memiliki akses ke antrean ini.';end if;
 if coalesce(cardinality(p_job_ids),0)=0 or cardinality(p_job_ids)>500 then raise exception 'Pilih pekerjaan gagal yang akan diulang.';end if;
 if (select count(distinct x) from unnest(p_job_ids) x)<>cardinality(p_job_ids) then raise exception 'Pilihan pekerjaan berulang.';end if;
 for j in select * from public.certificate_generation_jobs where id=any(p_job_ids) order by enrollment_id for update loop
  if j.issuance_batch_id<>p_batch_id or j.status<>'failed' then raise exception 'Hanya pekerjaan gagal dari antrean ini yang dapat diulang.';end if;
  perform pg_advisory_xact_lock(hashtextextended(j.enrollment_id::text,2));
  if public.certificate_eligibility_reason(j.enrollment_id) is distinct from '' then raise exception 'Kelayakan berubah. Periksa kelulusan dan antrean peserta.';end if;
  select * into tpl from public.certificate_templates where id=j.template_id and program_id=bid.program_id and status='active' for share;
  if not found then raise exception 'Aktifkan atau perbaiki template sebelum mencoba ulang.';end if;
  snapshot=j.issuance_snapshot;
  if snapshot is null then
   select jsonb_build_object('recipient_name',pt.display_name,'program_name',pr.name,'program_id',pr.id,'batch_id',e.batch_id) into snapshot from public.enrollments e join public.participants pt on pt.id=e.participant_id join public.programs pr on pr.id=e.program_id where e.id=j.enrollment_id;
  end if;
  snapshot=snapshot||jsonb_build_object('template_data_json',tpl.template_data_json,'background_object_key',tpl.background_object_key);
  update public.certificate_generation_jobs set issuance_snapshot=snapshot,status='pending',max_attempts=attempt_count+3,error_message=null,scheduled_at=now(),processed_at=null,claim_token=null,locked_until=null,updated_at=now() where id=j.id;
  cnt=cnt+1;
 end loop;
 if cnt<>cardinality(p_job_ids) then raise exception 'Sebagian pekerjaan tidak ditemukan.';end if;
 perform public.refresh_certificate_batch(p_batch_id);
 insert into public.audit_logs(user_id,action,entity_type,entity_id,details) values(auth.uid(),'certificate_batch.retried','certificate_issuance_batch',p_batch_id,jsonb_build_object('retried',cnt));
 return jsonb_build_object('retried',cnt);
end;
$$;
revoke all on function public.admin_retry_certificate_jobs(uuid,uuid[]) from public,anon;
grant execute on function public.admin_retry_certificate_jobs(uuid,uuid[]) to authenticated;

-- Only the service worker can claim/complete jobs. Neither browser nor normal user can issue documents directly.
create or replace function public.claim_certificate_jobs(p_batch_id uuid default null) returns jsonb language plpgsql security definer set search_path=public as $$
declare j public.certificate_generation_jobs%rowtype; result jsonb='[]'; snapshot jsonb;
begin
 for j in select * from public.certificate_generation_jobs where (p_batch_id is null or issuance_batch_id=p_batch_id) and ((status='pending' and coalesce(scheduled_at,now())<=now()) or (status='processing' and (locked_until is null or locked_until<now()))) order by created_at,id for update skip locked limit 5 loop
  snapshot=j.issuance_snapshot;
  if snapshot is null then
   select jsonb_build_object('recipient_name',p.display_name,'program_name',pr.name,'program_id',pr.id,'batch_id',e.batch_id,'template_data_json',t.template_data_json,'background_object_key',t.background_object_key) into snapshot from public.enrollments e join public.participants p on p.id=e.participant_id join public.programs pr on pr.id=e.program_id join public.certificate_templates t on t.id=j.template_id where e.id=j.enrollment_id;
  end if;
  update public.certificate_generation_jobs set status='processing',claim_token=gen_random_uuid(),locked_until=now()+interval '5 minutes',issuance_snapshot=snapshot,updated_at=now() where id=j.id returning * into j;
  perform public.refresh_certificate_batch(j.issuance_batch_id);
  result=result||jsonb_build_array(jsonb_build_object('id',j.id,'claim_token',j.claim_token,'snapshot',snapshot,'enrollment_id',j.enrollment_id,'participant_id',j.participant_id,'template_id',j.template_id));
 end loop;
 return result;
end;
$$;
revoke all on function public.claim_certificate_jobs(uuid) from public,anon,authenticated;
grant execute on function public.claim_certificate_jobs(uuid) to service_role;

create or replace function public.admin_claim_certificate_jobs(p_batch_id uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare program_id_value uuid;
begin
 select program_id into program_id_value from public.certificate_issuance_batches where id=p_batch_id;
 if not found or not public.certificate_admin_access(program_id_value) then raise exception 'Anda tidak memiliki akses untuk memproses antrean ini.';end if;
 return public.claim_certificate_jobs(p_batch_id);
end;
$$;
revoke all on function public.admin_claim_certificate_jobs(uuid) from public,anon;
grant execute on function public.admin_claim_certificate_jobs(uuid) to authenticated;

create or replace function public.finish_certificate_job(p_job_id uuid,p_claim_token uuid,p_error text default null) returns jsonb language plpgsql security definer set search_path=public as $$
declare j public.certificate_generation_jobs%rowtype;cid uuid;num text;code text;obj text;expected_program uuid;enrollment_participant uuid;reason text;
begin
 select * into j from public.certificate_generation_jobs where id=p_job_id for update;
 if not found or j.claim_token is distinct from p_claim_token or j.status<>'processing' then raise exception 'Klaim pekerjaan tidak lagi berlaku.';end if;
 if p_error is not null then
  update public.certificate_generation_jobs set attempt_count=attempt_count+1,status=case when attempt_count+1>=max_attempts then 'failed' else 'pending' end,error_message=left(p_error,1000),locked_until=null,claim_token=null,processed_at=now(),scheduled_at=now()+interval '1 minute',updated_at=now() where id=j.id;
 else
  perform pg_advisory_xact_lock(hashtextextended(j.enrollment_id::text,2));
  select e.program_id,e.participant_id into expected_program,enrollment_participant from public.enrollments e where e.id=j.enrollment_id for update;
  perform id from public.participants where id=j.participant_id for share;
  perform id from public.programs where id=expected_program for share;
  perform id from public.program_graduation_results where enrollment_id=j.enrollment_id for share;
  if expected_program::text is distinct from j.issuance_snapshot->>'program_id' or enrollment_participant<>j.participant_id or not exists(select 1 from public.enrollments e join public.program_graduation_results g on g.enrollment_id=e.id and g.program_id=e.program_id join public.programs p on p.id=e.program_id join public.participants pt on pt.id=e.participant_id where e.id=j.enrollment_id and e.enrollment_status='completed' and g.status='graduated' and pt.status='active' and coalesce((p.feature_flags->>'use_certificate')::boolean,false) and (not coalesce((p.graduation_settings->>'require_payment_clearance')::boolean,false) or e.payment_status in ('not_required','paid','verified','completed'))) then
   update public.certificate_generation_jobs set status='failed',error_message='Kelayakan berubah. Periksa kelulusan peserta.',claim_token=null,locked_until=null,processed_at=now(),updated_at=now() where id=j.id;
   perform public.refresh_certificate_batch(j.issuance_batch_id);return jsonb_build_object('status','failed');
  end if;
  select id into cid from public.certificates where enrollment_id=j.enrollment_id and status='issued' order by issued_at limit 1;
  if cid is null then
   num='YPIA-SYH-'||upper(replace(j.id::text,'-',''));code=upper(replace(j.id::text,'-',''));
   obj='certificates/'||expected_program::text||'/'||j.id::text||'/'||p_claim_token::text||'.pdf';
   insert into public.certificates(enrollment_id,certificate_template_id,certificate_number,recipient_name,program_name,object_key,verification_code,status) values(j.enrollment_id,j.template_id,num,j.issuance_snapshot->>'recipient_name',j.issuance_snapshot->>'program_name',obj,code,'issued') returning id into cid;
  end if;
  update public.certificate_generation_jobs set status='completed',certificate_id=cid,attempt_count=attempt_count+1,error_message=null,claim_token=null,locked_until=null,processed_at=now(),updated_at=now() where id=j.id;
  insert into public.audit_logs(action,entity_type,entity_id,details) values('certificate.issued','certificate',cid,jsonb_build_object('job_id',j.id));
 end if;
 perform public.refresh_certificate_batch(j.issuance_batch_id);
 return jsonb_build_object('status',(select status from public.certificate_generation_jobs where id=j.id),'certificate_id',cid);
end;
$$;
revoke all on function public.finish_certificate_job(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.finish_certificate_job(uuid,uuid,text) to service_role;

-- Remove direct browser mutations; retain participant ownership and narrow admin reads.
drop policy if exists certificate_templates_manage_admin on public.certificate_templates;
drop policy if exists certificate_templates_select_authenticated on public.certificate_templates;
create policy certificate_templates_scoped_read on public.certificate_templates for select to authenticated using(public.certificate_admin_access(program_id));
drop policy if exists certificate_issuance_batches_manage_admin on public.certificate_issuance_batches;
drop policy if exists certificate_issuance_batches_select_authenticated on public.certificate_issuance_batches;
create policy certificate_batches_scoped_read on public.certificate_issuance_batches for select to authenticated using(public.certificate_admin_access(program_id));
drop policy if exists certificate_generation_jobs_manage_admin on public.certificate_generation_jobs;
drop policy if exists certificate_generation_jobs_select_authenticated on public.certificate_generation_jobs;
create policy certificate_jobs_scoped_read on public.certificate_generation_jobs for select to authenticated using(exists(select 1 from public.certificate_issuance_batches b where b.id=issuance_batch_id and public.certificate_admin_access(b.program_id)) or exists(select 1 from public.participants p where p.id=participant_id and p.user_id=auth.uid()));
drop policy if exists certificates_manage_admin on public.certificates;
drop policy if exists certificates_select_accessible on public.certificates;
create policy certificates_scoped_read on public.certificates for select to authenticated using(exists(select 1 from public.enrollments e join public.participants p on p.id=e.participant_id where e.id=enrollment_id and (public.certificate_admin_access(e.program_id) or p.user_id=auth.uid())));
