-- Read-only audit workspace. No historical events, policies or business rows are changed.
create or replace function public.system_audit_category(p_action text) returns text
language sql immutable set search_path=public as $$
 select case
 when lower(coalesce(p_action,'')) ~ '(^|[._])(auth|login|logout|role|roles|password|credential)([._]|$)' then 'auth'
 when lower(coalesce(p_action,'')) ~ '(^|[._])(delete|deleted|remove|removed|detach)([._]|$)' then 'delete'
 when lower(coalesce(p_action,'')) ~ '(^|[._])(create|created|insert|inserted|add|added|attach)([._]|$)' then 'create'
 when lower(coalesce(p_action,'')) ~ '(^|[._])(update|updated|edit|edited|modify|modified|save|saved|review|reviewed|grade|graded|verify|verified|accept|accepted|reject|rejected|cancel|cancelled|finalized|placement|synced|hidden|managed|reconciled|allocated|archived|draft|published|locked|issued|retried|submitted|replied|note|completed|followup|primary)([._]|$)' then 'update'
 else 'other' end;
$$;
create or replace function public.system_audit_redact(p_value jsonb) returns jsonb
language plpgsql immutable set search_path=public as $$
declare result jsonb; item record;
begin
 if jsonb_typeof(p_value)='object' then
  result='{}';
  for item in select key,value from jsonb_each(p_value) loop
   result=result||jsonb_build_object(item.key,case when lower(regexp_replace(item.key,'[^a-zA-Z0-9]','','g')) ~ '(password|passwd|sandi|token|secret|credential|authorization|cookie|apikey|accesskey|privatekey|servicerole|signedurl)' then '"[Disamarkan]"'::jsonb else public.system_audit_redact(item.value) end);
  end loop;return result;
 elsif jsonb_typeof(p_value)='array' then
  return coalesce((select jsonb_agg(public.system_audit_redact(value) order by ordinality) from jsonb_array_elements(p_value) with ordinality),'[]');
 elsif jsonb_typeof(p_value)='string' and (p_value#>>'{}') ~* '(bearer[[:space:]]+[a-z0-9._-]+|[?&](token|signature|x-amz-signature|apikey|key)=|eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+)' then return '"[Disamarkan]"'::jsonb;
 end if;return p_value;
end;$$;
revoke all on function public.system_audit_category(text),public.system_audit_redact(jsonb) from public,anon,authenticated;

create or replace function public.system_audit_list(p_filters jsonb default '{}') returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare f jsonb:=coalesce(p_filters,'{}'); q text:=btrim(coalesce(f->>'q','')); cat text:=coalesce(f->>'category','all'); ent text:=coalesce(f->>'entity','all'); act text:=coalesce(f->>'action','all'); actor uuid; target uuid; from_day date; to_day date; page_no int:=coalesce((f->>'page')::int,1); page_size int:=coalesce((f->>'size')::int,25); exporting boolean:=coalesce((f->>'export')::boolean,false); total_rows bigint; result jsonb;
begin
 if auth.uid() is null or not public.is_super_admin() or not exists(select 1 from profiles where id=auth.uid() and status='active') then raise exception 'Audit hanya tersedia untuk superadmin aktif.' using errcode='42501';end if;
 if jsonb_typeof(f)<>'object' or length(q)>200 or length(ent)>100 or length(act)>150 or cat not in ('all','create','update','delete','auth','other') or page_no<1 or page_no>1000000 or page_size not in (25,50,100) then raise exception 'Filter audit tidak valid.';end if;
 actor=nullif(f->>'actor','')::uuid;target=nullif(f->>'target','')::uuid;
 if nullif(f->>'from','') is not null then if (f->>'from')!~'^\d{4}-\d{2}-\d{2}$' then raise exception 'Tanggal tidak valid.';end if;from_day=(f->>'from')::date;end if;
 if nullif(f->>'to','') is not null then if (f->>'to')!~'^\d{4}-\d{2}-\d{2}$' then raise exception 'Tanggal tidak valid.';end if;to_day=(f->>'to')::date;end if;
 if from_day>to_day then raise exception 'Tanggal akhir harus setelah atau sama dengan tanggal awal.';end if;
 with base as materialized(
 select a.id,a.user_id,a.action,a.entity_type,a.entity_id,a.created_at,p.full_name as actor_name,p.email as actor_email,public.system_audit_category(a.action) as category
 from audit_logs a left join profiles p on p.id=a.user_id
 where (cat='all' or public.system_audit_category(a.action)=cat) and (ent='all' or a.entity_type=ent) and (act='all' or a.action=act)
 and (actor is null or a.user_id=actor) and (target is null or a.entity_id=target)
 and (from_day is null or a.created_at>=from_day::timestamp at time zone 'Asia/Jakarta') and (to_day is null or a.created_at<(to_day+1)::timestamp at time zone 'Asia/Jakarta')
 and (q='' or position(lower(q) in lower(concat_ws(' ',a.id::text,a.action,a.entity_type,a.entity_id::text,a.user_id::text,p.full_name,p.email)))>0)
 ), counted as(select count(*) n from base), paged as(select * from base order by created_at desc,id desc limit case when exporting then 10001 else page_size end offset case when exporting then 0 else (least(page_no,greatest(1,ceil((select n from counted)::numeric/page_size)::int))-1)*page_size end)
 select jsonb_build_object('generated_at',statement_timestamp(),'total',(select n from counted),'page',least(page_no,greatest(1,ceil((select n from counted)::numeric/page_size)::int)),'size',page_size,
 'rows',coalesce((select jsonb_agg(to_jsonb(paged) order by created_at desc,id desc) from paged),'[]'),
 'stats',jsonb_build_object('actors',(select count(distinct user_id) from base),'access',(select count(*) from base where category='auth'),'deletions',(select count(*) from base where category='delete')),
 'actions',coalesce((select jsonb_agg(action order by action) from(select distinct action from audit_logs) opts),'[]'),
 'entities',coalesce((select jsonb_agg(entity_type order by entity_type) from(select distinct entity_type from audit_logs) opts),'[]')) into result;
 total_rows=(result->>'total')::bigint;
 if exporting and total_rows>10000 then raise exception 'Hasil lebih dari 10.000 aktivitas. Persempit filter sebelum ekspor.';end if;
 return result;
end;$$;

create or replace function public.system_audit_detail(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare row_value audit_logs%rowtype; context jsonb:='{}'; program uuid; kind text; actor_value jsonb;
begin
 if auth.uid() is null or not public.is_super_admin() or not exists(select 1 from profiles where id=auth.uid() and status='active') then raise exception 'Audit hanya tersedia untuk superadmin aktif.' using errcode='42501';end if;
 select * into row_value from audit_logs where id=p_id;if not found then raise exception 'Catatan audit tidak ditemukan.';end if;
 select jsonb_build_object('id',id,'name',full_name,'email',email) into actor_value from profiles where id=row_value.user_id;
 kind=lower(row_value.entity_type);
 if kind in ('profile','profiles','user','users') then select jsonb_build_object('profile_id',id,'name',coalesce(full_name,email)) into context from profiles where id=row_value.entity_id;
 elsif kind in ('participant','participants') then select jsonb_build_object('participant_id',id,'name',display_name) into context from participants where id=row_value.entity_id;
 elsif kind in ('enrollment','enrollments') then select jsonb_build_object('participant_id',e.participant_id,'program_id',e.program_id,'name',p.display_name) into context from enrollments e join participants p on p.id=e.participant_id where e.id=row_value.entity_id;
 elsif kind in ('lesson','lessons') then select jsonb_build_object('lesson_id',l.id,'program_id',m.program_id,'name',l.title) into context from lessons l join program_modules m on m.id=l.module_id where l.id=row_value.entity_id;
 elsif kind='lesson_progresses' then select jsonb_build_object('lesson_id',a.lesson_id,'program_id',e.program_id,'participant_id',e.participant_id,'name',l.title) into context from lesson_progresses a join enrollments e on e.id=a.enrollment_id join lessons l on l.id=a.lesson_id where a.id=row_value.entity_id;
 elsif kind='registration_form' then select jsonb_build_object('program_id',program_id,'name',title) into context from registration_forms where id=row_value.entity_id;
 elsif kind in ('quiz_attempt','quiz_attempts') then select jsonb_build_object('attempt_id',a.id,'program_id',e.program_id,'participant_id',e.participant_id,'name',l.title) into context from quiz_attempts a join enrollments e on e.id=a.enrollment_id join lessons l on l.id=a.lesson_id where a.id=row_value.entity_id;
 elsif kind in ('program','programs') then select jsonb_build_object('program_id',id,'name',name) into context from programs where id=row_value.entity_id;
 elsif kind='applicant_program_choice' then select jsonb_build_object('choice_id',id,'program_id',program_id) into context from applicant_program_choices where id=row_value.entity_id;
 elsif kind in ('transaction','transactions') then select jsonb_build_object('transaction_id',id) into context from transactions where id=row_value.entity_id;
 elsif kind='finance_invoice' then select jsonb_build_object('invoice_id',id,'program_id',program_id) into context from finance_invoices where id=row_value.entity_id;
 elsif kind='helpdesk_ticket' then select jsonb_build_object('ticket_id',id) into context from helpdesk_tickets where id=row_value.entity_id;
 elsif kind='announcement' then select jsonb_build_object('announcement_id',id,'name',title) into context from announcements where id=row_value.entity_id;
 end if;
 if row_value.details->>'program_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
  select id into program from programs where id=(row_value.details->>'program_id')::uuid;
  if program is not null then context=coalesce(context,'{}')||jsonb_build_object('program_id',program);end if;
 end if;
 return (to_jsonb(row_value)-'details')||jsonb_build_object('details',public.system_audit_redact(row_value.details),'category',public.system_audit_category(row_value.action),'actor',actor_value,'context',coalesce(context,'{}'));
end;$$;
revoke all on function public.system_audit_list(jsonb),public.system_audit_detail(uuid) from public,anon;
grant execute on function public.system_audit_list(jsonb),public.system_audit_detail(uuid) to authenticated;
