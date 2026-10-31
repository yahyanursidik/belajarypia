-- Helpdesk: atomic commands, scoped staff access, private notes, contextual links.
-- Preserves all existing tickets/messages. Does not send any message on deployment.
alter table public.helpdesk_tickets
 add column target_program_id uuid references public.programs(id),
 add column enrollment_id uuid references public.enrollments(id),
 add column invoice_id uuid references public.finance_invoices(id),
 add column resolution_summary text,
 add column follow_up_at timestamptz;
create index helpdesk_program_queue on public.helpdesk_tickets(target_program_id,status,assigned_to);
create table public.helpdesk_operations(request_key uuid primary key,user_id uuid not null references public.profiles(id),request jsonb not null,result jsonb not null,created_at timestamptz not null default now());
create table public.helpdesk_events(id uuid primary key default gen_random_uuid(),ticket_id uuid not null references public.helpdesk_tickets(id) on delete cascade,actor_id uuid not null references public.profiles(id),kind text not null,details jsonb not null default '{}',is_internal boolean not null default true,created_at timestamptz not null default now());
alter table public.helpdesk_operations enable row level security;
alter table public.helpdesk_events enable row level security;

create sequence public.helpdesk_ticket_sequence;
select setval('public.helpdesk_ticket_sequence',greatest(1,coalesce((select max(substring(ticket_number from 5)::bigint) from public.helpdesk_tickets where ticket_number ~ '^TKT-[0-9]{1,16}$'),0)),exists(select 1 from public.helpdesk_tickets where ticket_number ~ '^TKT-[0-9]{1,16}$'));
create or replace function public.generate_ticket_number() returns trigger language plpgsql security definer set search_path=public as $$
declare n text;begin n=nextval('public.helpdesk_ticket_sequence')::text;new.ticket_number='TKT-'||lpad(n,greatest(6,length(n)),'0');return new;end;$$;
create or replace function public.update_helpdesk_tickets_updated_at() returns trigger language plpgsql set search_path=public as $$begin new.updated_at=clock_timestamp();return new;end;$$;
revoke all on sequence public.helpdesk_ticket_sequence from public,anon,authenticated;

create or replace function public.helpdesk_staff_scope(p_user uuid,p_program uuid,p_category text) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.profiles p join public.user_roles ur on ur.user_id=p.id join public.roles r on r.id=ur.role_id left join public.programs prog on prog.id=p_program
 where p.id=p_user and p.status='active' and (r.code='super_admin' or r.code in ('admin','helpdesk','finance') and (r.code<>'finance' or p_category='billing') and (ur.scope_id is null or ur.scope_type='program' and ur.scope_id=prog.id or ur.scope_type='unit' and ur.scope_id=prog.unit_id)));
$$;
create or replace function public.helpdesk_user_program(p_user uuid,p_program uuid) returns boolean language sql stable security definer set search_path=public as $$
 select p_user is not null and exists(select 1 from public.profiles where id=p_user and status='active') and (p_program is null or exists(select 1 from public.programs where id=p_program) and (
 public.announcement_recipient(p_user,'all',p_program,null)
 or exists(select 1 from public.enrollments e join public.participants p on p.id=e.participant_id where e.program_id=p_program and (p.user_id=p_user or exists(select 1 from public.guardian_participants gp join public.guardians g on g.id=gp.guardian_id where gp.participant_id=p.id and g.user_id=p_user)))));
$$;
create or replace function public.helpdesk_can_manage(p_id uuid) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.helpdesk_tickets t where t.id=p_id and public.helpdesk_staff_scope(auth.uid(),t.target_program_id,t.category) and (
 exists(select 1 from public.user_roles ur join public.roles r on r.id=ur.role_id where ur.user_id=auth.uid() and r.code in ('super_admin','admin') and (r.code='super_admin' or ur.scope_id is null or ur.scope_type='program' and ur.scope_id=t.target_program_id or ur.scope_type='unit' and ur.scope_id=(select unit_id from public.programs where id=t.target_program_id)))
 or t.assigned_to=auth.uid() or t.assigned_to is null and t.status in ('open','in_progress','waiting_reporter')));
$$;
create or replace function public.helpdesk_can_read(p_id uuid) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.profiles where id=auth.uid() and status='active') and exists(select 1 from public.helpdesk_tickets where id=p_id and (reporter_id=auth.uid() or public.helpdesk_can_manage(id)));
$$;
create or replace function public.helpdesk_context_valid(p_user uuid,p_program uuid,p_enrollment uuid,p_invoice uuid,p_category text) returns boolean language sql stable security definer set search_path=public as $$
 select public.helpdesk_user_program(p_user,p_program)
 and (p_enrollment is null or p_program is not null and exists(select 1 from public.enrollments e join public.participants p on p.id=e.participant_id where e.id=p_enrollment and e.program_id=p_program and (p.user_id=p_user or exists(select 1 from public.guardian_participants gp join public.guardians g on g.id=gp.guardian_id where gp.participant_id=p.id and g.user_id=p_user))))
 and (p_invoice is null or p_category='billing' and p_enrollment is not null and exists(select 1 from public.finance_invoices i join public.participants p on p.id=i.participant_id where i.id=p_invoice and i.program_id=p_program and i.enrollment_id=p_enrollment and p.user_id=p_user));
$$;

create or replace function public.helpdesk_options(p_ticket uuid default null) returns jsonb language plpgsql security definer set search_path=public as $$
declare reporter uuid=auth.uid();t public.helpdesk_tickets%rowtype;begin
 if not exists(select 1 from public.profiles where id=auth.uid() and status='active') then raise exception 'Silakan masuk kembali.';end if;
 if p_ticket is not null then select * into t from public.helpdesk_tickets where id=p_ticket;if not found or not public.helpdesk_can_read(p_ticket) then raise exception 'Tiket tidak dapat diakses.';end if;reporter=t.reporter_id;end if;
 return jsonb_build_object(
 'programs',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name) order by p.name,p.id) from public.programs p where public.helpdesk_user_program(reporter,p.id)),'[]'::jsonb),
 'enrollments',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'program_id',e.program_id,'name',p.display_name,'number',e.enrollment_number) order by e.id) from public.enrollments e join public.participants p on p.id=e.participant_id where p.user_id=reporter or exists(select 1 from public.guardian_participants gp join public.guardians g on g.id=gp.guardian_id where gp.participant_id=p.id and g.user_id=reporter)),'[]'::jsonb),
 'invoices',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'program_id',i.program_id,'enrollment_id',i.enrollment_id,'number',i.invoice_number) order by i.created_at desc,i.id) from public.finance_invoices i join public.participants p on p.id=i.participant_id where p.user_id=reporter),'[]'::jsonb),
 'assignees',case when p_ticket is not null and public.helpdesk_can_manage(p_ticket) then coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.full_name) order by p.full_name,p.id) from public.profiles p where public.helpdesk_staff_scope(p.id,t.target_program_id,t.category)),'[]'::jsonb) else '[]'::jsonb end);
end;$$;

-- Central projection keeps internal-note activity out of the reporter's timestamps/version.
create or replace function public.helpdesk_ticket_json(p_id uuid,p_staff boolean default false) returns jsonb language sql stable security definer set search_path=public as $$
 select to_jsonb(t)-'updated_at'||jsonb_build_object('updated_at',case when p_staff then t.updated_at else coalesce((select max(created_at) from public.helpdesk_messages where ticket_id=t.id and not is_internal_note),t.created_at) end,
 'reporter_name',p.full_name,'reporter_email',case when p_staff then p.email else null end,'program_name',prog.name,'participant_id',e.participant_id,'invoice_number',i.invoice_number,'assigned_name',a.full_name,
 'last_sender_id',(select sender_id from public.helpdesk_messages where ticket_id=t.id and not is_internal_note order by created_at desc,id desc limit 1),
 'can_manage',p_staff) from public.helpdesk_tickets t join public.profiles p on p.id=t.reporter_id left join public.programs prog on prog.id=t.target_program_id left join public.enrollments e on e.id=t.enrollment_id left join public.finance_invoices i on i.id=t.invoice_id left join public.profiles a on a.id=t.assigned_to where t.id=p_id;
$$;
create or replace function public.helpdesk_list(p_view text default 'staff',p_filters jsonb default '{}',p_offset integer default 0,p_limit integer default 20) returns jsonb language plpgsql security definer set search_path=public as $$
declare result jsonb;begin
 if p_view not in ('staff','mine') or p_view is null or not exists(select 1 from public.profiles where id=auth.uid() and status='active') then raise exception 'Anda tidak memiliki akses helpdesk.';end if;
 with visible as materialized (select t.* from public.helpdesk_tickets t where case when p_view='mine' then t.reporter_id=auth.uid() else public.helpdesk_can_manage(t.id) end),
 filtered as (select t.* from visible t where
 (coalesce(p_filters->>'q','')='' or strpos(lower(t.subject||' '||t.ticket_number),lower(left(p_filters->>'q',160)))>0)
 and (coalesce(p_filters->>'status','all')='all' or t.status=p_filters->>'status')
 and (coalesce(p_filters->>'category','all')='all' or t.category=p_filters->>'category')
 and (coalesce(p_filters->>'priority','all')='all' or t.priority=p_filters->>'priority')
 and (coalesce(p_filters->>'program','all')='all' or t.target_program_id::text=p_filters->>'program')
 and (coalesce(p_filters->>'assignment','all')='all' or p_filters->>'assignment'='mine' and t.assigned_to=auth.uid() or p_filters->>'assignment'='unassigned' and t.assigned_to is null)
 and (coalesce(p_filters->>'queue','all')='all' or p_filters->>'queue'='overdue' and t.follow_up_at<now() and t.status not in ('resolved','closed') or p_filters->>'queue'='reply' and t.status not in ('resolved','closed') and (select sender_id=t.reporter_id from public.helpdesk_messages where ticket_id=t.id and not is_internal_note order by created_at desc,id desc limit 1))),
 page as(select id,case when p_view='staff' then updated_at else coalesce((select max(created_at) from public.helpdesk_messages where ticket_id=t.id and not is_internal_note),created_at) end activity from filtered t order by activity desc,id limit greatest(1,least(coalesce(p_limit,20),50)) offset greatest(0,coalesce(p_offset,0)))
 select jsonb_build_object('items',coalesce((select jsonb_agg(public.helpdesk_ticket_json(id,p_view='staff') order by activity desc,id) from page),'[]'::jsonb),'total',(select count(*) from filtered),'stats',jsonb_build_object('active',(select count(*) from visible where status not in ('resolved','closed')),'unassigned',(select count(*) from visible where assigned_to is null and status not in ('resolved','closed')),'waiting',(select count(*) from visible where status='waiting_reporter'),'resolved',(select count(*) from visible where status in ('resolved','closed'))),'programs',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name) order by p.name) from public.programs p where exists(select 1 from visible t where t.target_program_id=p.id)),'[]'::jsonb)) into result;
 return result;end;$$;

create or replace function public.helpdesk_detail(p_id uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare staff boolean=public.helpdesk_can_manage(p_id);begin
 if not public.helpdesk_can_read(p_id) then raise exception 'Tiket tidak dapat diakses. Muat ulang antrean.';end if;
 return jsonb_build_object('ticket',public.helpdesk_ticket_json(p_id,staff),
 'messages',coalesce((select jsonb_agg(to_jsonb(m)||jsonb_build_object('sender_name',p.full_name) order by m.created_at,m.id) from public.helpdesk_messages m join public.profiles p on p.id=m.sender_id where m.ticket_id=p_id and (staff or not m.is_internal_note)),'[]'::jsonb),
 'events',coalesce((select jsonb_agg(to_jsonb(e)||jsonb_build_object('actor_name',p.full_name) order by e.created_at,e.id) from public.helpdesk_events e join public.profiles p on p.id=e.actor_id where e.ticket_id=p_id and (staff or not e.is_internal)),'[]'::jsonb));end;$$;

create or replace function public.helpdesk_create(p_payload jsonb,p_request_key uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare op public.helpdesk_operations%rowtype;tid uuid;request_value jsonb=jsonb_build_object('create',p_payload);result_value jsonb;program uuid=nullif(p_payload->>'target_program_id','')::uuid;enrol uuid=nullif(p_payload->>'enrollment_id','')::uuid;invoice uuid=nullif(p_payload->>'invoice_id','')::uuid;category text=p_payload->>'category';subject text=btrim(p_payload->>'subject');body text=btrim(p_payload->>'message');begin
 if not exists(select 1 from public.profiles where id=auth.uid() and status='active') or p_request_key is null then raise exception 'Silakan masuk kembali.';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_request_key::text,94));select * into op from public.helpdesk_operations where request_key=p_request_key;
 if found then if op.user_id<>auth.uid() or op.request is distinct from request_value then raise exception 'Permintaan berbeda.';end if;return op.result;end if;
 if p_payload is null or jsonb_typeof(p_payload)<>'object' or exists(select 1 from jsonb_object_keys(p_payload) k where k not in ('subject','category','message','target_program_id','enrollment_id','invoice_id')) or coalesce(category,'') not in ('technical_issue','academic','billing','account','other') or coalesce(length(subject),0) not between 3 and 160 or coalesce(length(body),0) not between 5 and 8000 then raise exception 'Lengkapi judul (3–160 karakter), kategori, dan pesan (5–8.000 karakter).';end if;
 if not public.helpdesk_context_valid(auth.uid(),program,enrol,invoice,category) then raise exception 'Program, peserta, atau tagihan tidak sesuai akun Anda.';end if;
 insert into public.helpdesk_tickets(reporter_id,category,subject,target_program_id,enrollment_id,invoice_id) values(auth.uid(),category,subject,program,enrol,invoice) returning id into tid;
 insert into public.helpdesk_messages(ticket_id,sender_id,message_body) values(tid,auth.uid(),body);
 insert into public.helpdesk_events(ticket_id,actor_id,kind,is_internal) values(tid,auth.uid(),'created',false);
 insert into public.audit_logs(user_id,action,entity_type,entity_id,details) values(auth.uid(),'helpdesk.created','helpdesk_ticket',tid,jsonb_build_object('program_id',program,'category',category));
 result_value=jsonb_build_object('id',tid);insert into public.helpdesk_operations(request_key,user_id,request,result) values(p_request_key,auth.uid(),request_value,result_value);return result_value;
end;$$;

create or replace function public.helpdesk_reply(p_id uuid,p_body text,p_internal boolean,p_status text,p_expected_updated_at timestamptz,p_request_key uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare t public.helpdesk_tickets%rowtype;op public.helpdesk_operations%rowtype;request_value jsonb=jsonb_build_object('reply',p_id,'body',p_body,'internal',p_internal,'status',p_status,'version',p_expected_updated_at);result_value jsonb;staff boolean;version timestamptz;next_status text;begin
 if not exists(select 1 from public.profiles where id=auth.uid() and status='active') or p_request_key is null then raise exception 'Silakan masuk kembali.';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_request_key::text,94));select * into op from public.helpdesk_operations where request_key=p_request_key;
 if found then if op.user_id<>auth.uid() or op.request is distinct from request_value then raise exception 'Permintaan berbeda.';end if;return op.result;end if;
 select * into t from public.helpdesk_tickets where id=p_id for update;staff=public.helpdesk_can_manage(p_id);
 if not found or not public.helpdesk_can_read(p_id) then raise exception 'Tiket tidak dapat diakses.';end if;
 version=case when staff then t.updated_at else coalesce((select max(created_at) from public.helpdesk_messages where ticket_id=p_id and not is_internal_note),t.created_at) end;
 if version is distinct from p_expected_updated_at then raise exception using errcode='40001',message='Percakapan telah berubah. Muat ulang sebelum mengirim. Draf Anda tetap tersedia.';end if;
 if p_internal is null or coalesce(length(btrim(p_body)),0) not between 1 and 8000 or p_internal and not staff then raise exception 'Pesan atau akses catatan tidak valid.';end if;
 if staff then
  if p_internal then if p_status is not null then raise exception 'Catatan tidak mengubah status.';end if;next_status=t.status;
  else next_status=p_status;if coalesce(next_status,'') not in ('in_progress','waiting_reporter','resolved') then raise exception 'Pilih status setelah membalas.';end if;end if;
 else
  if p_status is not null and p_status<>'open' then raise exception 'Status balasan tidak valid.';end if;
  if t.status in ('resolved','closed') and p_status is distinct from 'open' then raise exception 'Konfirmasi buka kembali tiket.';end if;
  next_status=case when t.status in ('resolved','closed') then 'open' else 'in_progress' end;
 end if;
 insert into public.helpdesk_messages(ticket_id,sender_id,message_body,is_internal_note,created_at) values(p_id,auth.uid(),btrim(p_body),p_internal,clock_timestamp());
 update public.helpdesk_tickets set status=next_status,resolution_summary=case when not p_internal and staff and next_status='resolved' then btrim(p_body) when next_status not in ('resolved','closed') then null else resolution_summary end,
 assigned_to=case when assigned_to is not null and not public.helpdesk_staff_scope(assigned_to,target_program_id,category) then null else assigned_to end where id=p_id;
 if next_status is distinct from t.status then insert into public.helpdesk_events(ticket_id,actor_id,kind,details,is_internal) values(p_id,auth.uid(),'status',jsonb_build_object('from',t.status,'to',next_status),false);end if;
 insert into public.audit_logs(user_id,action,entity_type,entity_id,details) values(auth.uid(),case when p_internal then 'helpdesk.note' else 'helpdesk.replied' end,'helpdesk_ticket',p_id,jsonb_build_object('status',next_status));
 result_value=jsonb_build_object('id',p_id);insert into public.helpdesk_operations(request_key,user_id,request,result) values(p_request_key,auth.uid(),request_value,result_value);return result_value;
end;$$;

create or replace function public.helpdesk_manage(p_id uuid,p_patch jsonb,p_expected_updated_at timestamptz,p_request_key uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare t public.helpdesk_tickets%rowtype;n public.helpdesk_tickets%rowtype;op public.helpdesk_operations%rowtype;request_value jsonb=jsonb_build_object('manage',p_id,'patch',p_patch,'version',p_expected_updated_at);result_value jsonb;begin
 if not exists(select 1 from public.profiles where id=auth.uid() and status='active') or p_request_key is null then raise exception 'Silakan masuk kembali.';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_request_key::text,94));select * into op from public.helpdesk_operations where request_key=p_request_key;
 if found then if op.user_id<>auth.uid() or op.request is distinct from request_value then raise exception 'Permintaan berbeda.';end if;return op.result;end if;
 select * into t from public.helpdesk_tickets where id=p_id for update;
 if not found or not public.helpdesk_can_manage(p_id) then raise exception 'Tiket tidak dapat dikelola.';end if;
 if t.updated_at is distinct from p_expected_updated_at then raise exception using errcode='40001',message='Tiket telah berubah. Muat ulang sebelum menyimpan.';end if;
 if p_patch is null or jsonb_typeof(p_patch)<>'object' or p_patch='{}' or exists(select 1 from jsonb_object_keys(p_patch) k where k not in ('status','priority','assigned_to','follow_up_at','resolution_summary','target_program_id','enrollment_id','invoice_id')) then raise exception 'Perubahan tiket tidak valid.';end if;
 select * into n from jsonb_populate_record(t,p_patch);
 if coalesce(n.status,'') not in ('open','in_progress','waiting_reporter','resolved','closed') or coalesce(n.priority,'') not in ('low','medium','high','urgent') or length(n.resolution_summary)>8000 then raise exception 'Status, prioritas, atau ringkasan tidak valid.';end if;
 if not public.helpdesk_staff_scope(auth.uid(),n.target_program_id,n.category) or ((n.target_program_id,n.enrollment_id,n.invoice_id) is distinct from (t.target_program_id,t.enrollment_id,t.invoice_id) and not public.helpdesk_context_valid(t.reporter_id,n.target_program_id,n.enrollment_id,n.invoice_id,n.category)) then raise exception 'Konteks baru di luar cakupan atau tidak sesuai pelapor.';end if;
 if n.assigned_to is not null and not public.helpdesk_staff_scope(n.assigned_to,n.target_program_id,n.category) then raise exception 'Petugas tidak aktif atau di luar cakupan tiket.';end if;
 if n.status in ('resolved','closed') and nullif(btrim(n.resolution_summary),'') is null then raise exception 'Isi ringkasan penyelesaian yang dapat dibaca pelapor.';end if;
 update public.helpdesk_tickets set status=n.status,priority=n.priority,assigned_to=n.assigned_to,follow_up_at=n.follow_up_at,target_program_id=n.target_program_id,enrollment_id=n.enrollment_id,invoice_id=n.invoice_id,resolution_summary=case when n.status in ('resolved','closed') then btrim(n.resolution_summary) else null end where id=p_id;
 -- A public resolution is also a message so the reporter sees the status/version change.
 if n.status is distinct from t.status or n.resolution_summary is distinct from t.resolution_summary then
  insert into public.helpdesk_messages(ticket_id,sender_id,message_body,created_at) values(p_id,auth.uid(),case when n.status in ('resolved','closed') then btrim(n.resolution_summary) else 'Status tiket diperbarui oleh petugas.' end,clock_timestamp());
  insert into public.helpdesk_events(ticket_id,actor_id,kind,details,is_internal) values(p_id,auth.uid(),'status',jsonb_build_object('from',t.status,'to',n.status),false);
 end if;
 insert into public.helpdesk_events(ticket_id,actor_id,kind,details) values(p_id,auth.uid(),'managed',jsonb_build_object('fields',(select jsonb_agg(k) from jsonb_object_keys(p_patch) k)));
 insert into public.audit_logs(user_id,action,entity_type,entity_id,details) values(auth.uid(),'helpdesk.managed','helpdesk_ticket',p_id,jsonb_build_object('fields',(select jsonb_agg(k) from jsonb_object_keys(p_patch) k)));
 result_value=jsonb_build_object('id',p_id);insert into public.helpdesk_operations(request_key,user_id,request,result) values(p_request_key,auth.uid(),request_value,result_value);return result_value;
end;$$;

-- Remove the legacy broad policies; direct business writes are no longer allowed.
drop policy if exists "Users can view their own tickets" on public.helpdesk_tickets;
drop policy if exists "Staff can view all tickets" on public.helpdesk_tickets;
drop policy if exists "Users can create tickets" on public.helpdesk_tickets;
drop policy if exists "Staff can insert tickets" on public.helpdesk_tickets;
drop policy if exists "Staff can update tickets" on public.helpdesk_tickets;
drop policy if exists "Users can view messages on their tickets" on public.helpdesk_messages;
drop policy if exists "Staff can view all messages" on public.helpdesk_messages;
drop policy if exists "Users can insert messages on their tickets" on public.helpdesk_messages;
drop policy if exists "Staff can insert messages" on public.helpdesk_messages;
create policy helpdesk_ticket_read on public.helpdesk_tickets for select to authenticated using(public.helpdesk_can_read(id));
create policy helpdesk_message_read on public.helpdesk_messages for select to authenticated using(public.helpdesk_can_manage(ticket_id) or not is_internal_note and public.helpdesk_can_read(ticket_id));
create policy helpdesk_event_read on public.helpdesk_events for select to authenticated using(public.helpdesk_can_manage(ticket_id) or not is_internal and public.helpdesk_can_read(ticket_id));
revoke all on public.helpdesk_tickets,public.helpdesk_messages,public.helpdesk_events,public.helpdesk_operations from public,anon,authenticated;
grant select on public.helpdesk_tickets,public.helpdesk_messages,public.helpdesk_events to authenticated;
-- Explicitly private internal helpers; no arbitrary-user directory or projection RPC.
revoke all on function public.helpdesk_staff_scope(uuid,uuid,text),public.helpdesk_user_program(uuid,uuid),public.helpdesk_context_valid(uuid,uuid,uuid,uuid,text),public.helpdesk_ticket_json(uuid,boolean),public.generate_ticket_number(),public.update_helpdesk_tickets_updated_at() from public,anon,authenticated;
revoke all on function public.helpdesk_can_manage(uuid),public.helpdesk_can_read(uuid),public.helpdesk_options(uuid),public.helpdesk_list(text,jsonb,integer,integer),public.helpdesk_detail(uuid),public.helpdesk_create(jsonb,uuid),public.helpdesk_reply(uuid,text,boolean,text,timestamptz,uuid),public.helpdesk_manage(uuid,jsonb,timestamptz,uuid) from public,anon;
grant execute on function public.helpdesk_can_manage(uuid),public.helpdesk_can_read(uuid),public.helpdesk_options(uuid),public.helpdesk_list(text,jsonb,integer,integer),public.helpdesk_detail(uuid),public.helpdesk_create(jsonb,uuid),public.helpdesk_reply(uuid,text,boolean,text,timestamptz,uuid),public.helpdesk_manage(uuid,jsonb,timestamptz,uuid) to authenticated;
