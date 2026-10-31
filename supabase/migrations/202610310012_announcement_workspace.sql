-- Scoped in-app announcements. Deployment does not publish, archive or mark any existing message read.
-- Preserve existing production visibility windows without updating message rows.
-- Renaming also preserves the existing window constraint and its policy dependencies.
do $$begin
 if exists(select 1 from information_schema.columns where table_schema='public' and table_name='announcements' and column_name='visible_from') and not exists(select 1 from information_schema.columns where table_schema='public' and table_name='announcements' and column_name='publish_at') then alter table public.announcements rename column visible_from to publish_at;end if;
 if exists(select 1 from information_schema.columns where table_schema='public' and table_name='announcements' and column_name='visible_until') and not exists(select 1 from information_schema.columns where table_schema='public' and table_name='announcements' and column_name='expires_at') then alter table public.announcements rename column visible_until to expires_at;end if;
end;$$;
alter table public.announcements add column if not exists target_class_id uuid references public.classes(id) on delete restrict;
alter table public.announcements add column if not exists publish_at timestamptz;
alter table public.announcements add column if not exists expires_at timestamptz;
alter table public.announcements alter column publish_at drop not null,alter column publish_at drop default,alter column expires_at drop not null,alter column expires_at drop default;
alter table public.announcements add column if not exists is_pinned boolean not null default false;
alter table public.announcements add column if not exists action_kind text not null default 'none' check(action_kind in ('none','program','payment','help','lesson'));
alter table public.announcements add column if not exists source text not null default 'manual' check(source in ('manual','lesson'));
alter table public.announcements add column if not exists source_lesson_id uuid references public.lessons(id) on delete set null;
alter table public.announcements add column if not exists revision integer not null default 1 check(revision>0);
create unique index if not exists announcement_lesson_unique on public.announcements(source_lesson_id) where source_lesson_id is not null;
create index if not exists announcement_class_idx on public.announcements(target_class_id);
create table if not exists public.announcement_reads(announcement_id uuid not null references public.announcements(id) on delete cascade,user_id uuid not null references public.profiles(id) on delete cascade,revision integer not null check(revision>0),read_at timestamptz not null default now(),primary key(announcement_id,user_id));
create table if not exists public.announcement_operations(request_key uuid primary key,user_id uuid not null references public.profiles(id),payload jsonb not null,result jsonb not null,created_at timestamptz not null default now());
alter table public.announcement_reads enable row level security;
alter table public.announcement_operations enable row level security;

create or replace function public.announcement_can_manage(p_program uuid) returns boolean language sql stable security definer set search_path=public as $$
 select auth.uid() is not null and exists(select 1 from public.profiles where id=auth.uid() and status='active') and
 (public.is_super_admin() or (p_program is not null and exists(select 1 from public.user_roles ur join public.roles r on r.id=ur.role_id join public.programs p on p.id=p_program where ur.user_id=auth.uid() and r.code='admin' and (ur.scope_id is null or ur.scope_type='program' and ur.scope_id=p.id or ur.scope_type='unit' and ur.scope_id=p.unit_id))));
$$;
revoke all on function public.announcement_can_manage(uuid) from public,anon;
grant execute on function public.announcement_can_manage(uuid) to authenticated;

-- Internal predicate accepts a candidate user only for aggregate audience and caller-scoped reads.
create or replace function public.announcement_recipient(p_user uuid,p_role text,p_program uuid,p_class uuid) returns boolean language sql stable security definer set search_path=public as $$
 select p_user is not null and exists(select 1 from public.profiles where id=p_user and status='active')
 and (p_class is null or exists(select 1 from public.classes where id=p_class and program_id=p_program))
 and ((p_role='all' and p_program is null and p_class is null) or exists(
 select 1 from public.user_roles ur join public.roles r on r.id=ur.role_id
 where ur.user_id=p_user and (p_role='all' or r.code=p_role or p_role='admin' and r.code='super_admin')
 and (p_program is null or
  r.code='participant' and exists(select 1 from public.participants part join public.enrollments e on e.participant_id=part.id where part.user_id=p_user and part.status='active' and e.program_id=p_program and e.enrollment_status in ('pending','active','hold','completed') and (p_class is null or e.class_id=p_class))
  or r.code='guardian' and exists(select 1 from public.guardians g join public.guardian_participants gp on gp.guardian_id=g.id join public.participants part on part.id=gp.participant_id join public.enrollments e on e.participant_id=part.id where g.user_id=p_user and part.status='active' and e.program_id=p_program and e.enrollment_status in ('pending','active','hold','completed') and (p_class is null or e.class_id=p_class))
  or r.code in ('teacher','mentor') and (exists(select 1 from public.programs p where p.id=p_program and p.teacher_user_id=p_user) or exists(select 1 from public.classes c left join public.halaqahs h on h.class_id=c.id where c.program_id=p_program and (p_class is null or c.id=p_class) and (c.teacher_user_id=p_user or h.mentor_user_id=p_user)) or exists(select 1 from public.programs p where p.id=p_program and (ur.scope_type='program' and ur.scope_id=p.id or ur.scope_type='unit' and ur.scope_id=p.unit_id)))
  or r.code in ('super_admin','admin','finance','helpdesk','content_reviewer') and exists(select 1 from public.programs p where p.id=p_program and (ur.scope_id is null or ur.scope_type='program' and ur.scope_id=p.id or ur.scope_type='unit' and ur.scope_id=p.unit_id))
 )));
$$;
revoke all on function public.announcement_recipient(uuid,text,uuid,uuid) from public,anon,authenticated;

create or replace function public.announcement_visible(p_id uuid) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.announcements a where a.id=p_id and a.status='published' and coalesce(a.publish_at,a.created_at)<=now() and (a.expires_at is null or a.expires_at>now()) and public.announcement_recipient(auth.uid(),a.target_role,a.target_program_id,a.target_class_id) and (a.source<>'lesson' or exists(select 1 from public.lessons l join public.program_modules m on m.id=l.module_id where l.id=a.source_lesson_id and m.program_id=a.target_program_id and l.visibility_status='published' and (l.release_at is null or l.release_at<=now()))));
$$;
revoke all on function public.announcement_visible(uuid) from public,anon;
grant execute on function public.announcement_visible(uuid) to authenticated;

create or replace function public.admin_announcement_options() returns jsonb language plpgsql stable security definer set search_path=public as $$begin
 if not (public.has_role('admin') or public.is_super_admin()) or not exists(select 1 from public.profiles where id=auth.uid() and status='active') then raise exception 'Anda tidak memiliki akses mengelola pengumuman.';end if;
 return jsonb_build_object('global_allowed',public.announcement_can_manage(null),'programs',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'unit_id',p.unit_id,'name',p.name,'code',p.code,'status',p.status) order by p.name,p.id) from public.programs p where public.announcement_can_manage(p.id)),'[]'::jsonb),'classes',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'program_id',c.program_id,'name',c.name,'code',c.code,'status',c.status) order by c.name,c.id) from public.classes c where public.announcement_can_manage(c.program_id)),'[]'::jsonb));end;$$;
revoke all on function public.admin_announcement_options() from public,anon;
grant execute on function public.admin_announcement_options() to authenticated;

create or replace function public.admin_announcement_audience(p_role text,p_program uuid,p_class uuid) returns jsonb language plpgsql stable security definer set search_path=public as $$begin
 if not public.announcement_can_manage(p_program) then raise exception 'Pilih program sesuai cakupan Anda.';end if;
 if p_role is null or p_role not in ('all','participant','guardian','teacher','mentor','admin','finance','helpdesk','content_reviewer') or (p_class is not null and not exists(select 1 from public.classes where id=p_class and program_id=p_program)) then raise exception 'Peran atau kelas penerima tidak sesuai program.';end if;
 return jsonb_build_object('recipients',(select count(*) from public.profiles p where public.announcement_recipient(p.id,p_role,p_program,p_class)));
end;$$;
revoke all on function public.admin_announcement_audience(text,uuid,uuid) from public,anon;
grant execute on function public.admin_announcement_audience(text,uuid,uuid) to authenticated;

create or replace function public.admin_list_announcements(p_offset integer default 0,p_limit integer default 500) returns setof jsonb language plpgsql stable security definer set search_path=public as $$begin
 if not (public.has_role('admin') or public.is_super_admin()) or not exists(select 1 from public.profiles where id=auth.uid() and status='active') then raise exception 'Anda tidak memiliki akses pengumuman.';end if;
 return query select to_jsonb(a)||jsonb_build_object('program_name',p.name,'class_name',c.name,'source_available',a.source<>'lesson' or exists(select 1 from public.lessons l join public.program_modules m on m.id=l.module_id where l.id=a.source_lesson_id and m.program_id=a.target_program_id and l.visibility_status='published'),'read_count',(select count(*) from public.announcement_reads ar where ar.announcement_id=a.id and ar.revision=a.revision)) from public.announcements a left join public.programs p on p.id=a.target_program_id left join public.classes c on c.id=a.target_class_id where public.announcement_can_manage(a.target_program_id) order by a.is_pinned desc,coalesce(a.publish_at,a.created_at) desc,a.id limit greatest(1,least(coalesce(p_limit,500),500)) offset greatest(0,coalesce(p_offset,0));
end;$$;
revoke all on function public.admin_list_announcements(integer,integer) from public,anon;
grant execute on function public.admin_list_announcements(integer,integer) to authenticated;

create or replace function public.my_announcements(p_offset integer default 0,p_limit integer default 500) returns setof jsonb language sql stable security definer set search_path=public as $$
 select to_jsonb(a)||jsonb_build_object('program_name',p.name,'class_name',c.name,'read_at',ar.read_at,'read_revision',ar.revision) from public.announcements a left join public.programs p on p.id=a.target_program_id left join public.classes c on c.id=a.target_class_id left join public.announcement_reads ar on ar.announcement_id=a.id and ar.user_id=auth.uid() where public.announcement_visible(a.id) order by a.is_pinned desc,coalesce(a.publish_at,a.created_at) desc,a.id limit greatest(1,least(coalesce(p_limit,500),500)) offset greatest(0,coalesce(p_offset,0));
$$;
revoke all on function public.my_announcements(integer,integer) from public,anon;
grant execute on function public.my_announcements(integer,integer) to authenticated;

create or replace function public.admin_save_announcement(p_payload jsonb,p_request_key uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare aid uuid=nullif(p_payload->>'id','')::uuid;program uuid=nullif(p_payload->>'target_program_id','')::uuid;class_id_value uuid=nullif(p_payload->>'target_class_id','')::uuid;role_value text=p_payload->>'target_role';status_value text=p_payload->>'status';start_at timestamptz=nullif(p_payload->>'publish_at','')::timestamptz;end_at timestamptz=nullif(p_payload->>'expires_at','')::timestamptz;action_value text=coalesce(p_payload->>'action_kind','none');old public.announcements%rowtype;op public.announcement_operations%rowtype;result jsonb;rev integer;
begin
 if not public.announcement_can_manage(program) then raise exception 'Pilih program sesuai cakupan Anda.';end if;
 if p_request_key is null then raise exception 'Identitas permintaan tidak tersedia.';end if;perform pg_advisory_xact_lock(hashtextextended(p_request_key::text,81));select * into op from public.announcement_operations where request_key=p_request_key;
 if found then if op.user_id<>auth.uid() or op.payload<>p_payload then raise exception 'Permintaan berbeda. Periksa kembali isian.';end if;return op.result;end if;
 if nullif(btrim(p_payload->>'title'),'') is null or length(btrim(p_payload->>'title'))>160 or nullif(btrim(p_payload->>'content'),'') is null or length(btrim(p_payload->>'content'))>8000 then raise exception 'Isi judul dan pesan sesuai batas panjangnya.';end if;
 if role_value is null or role_value not in ('all','participant','guardian','teacher','mentor','admin','finance','helpdesk','content_reviewer') or status_value is null or status_value not in ('draft','published') or action_value not in ('none','program','payment','help') then raise exception 'Peran, status atau tautan pengumuman belum valid.';end if;
 if program is not null and not exists(select 1 from public.programs where id=program and (status_value='draft' or status<>'archived')) then raise exception 'Program tidak tersedia untuk publikasi.';end if;
 if class_id_value is not null and not exists(select 1 from public.classes where id=class_id_value and program_id=program and (status_value='draft' or status='active')) then raise exception 'Kelas tidak sesuai program atau tidak aktif.';end if;
 if action_value='program' and program is null then raise exception 'Pilih program untuk tautan belajar.';end if;
 if start_at is not null and start_at<=now() then raise exception 'Pilih jadwal tayang setelah waktu sekarang.';end if;
 if end_at is not null and end_at<=greatest(now(),coalesce(start_at,now())) then raise exception 'Waktu berakhir harus setelah waktu tayang dan waktu sekarang.';end if;
 if aid is not null then select * into old from public.announcements where id=aid for update;if not found or not public.announcement_can_manage(old.target_program_id) then raise exception 'Pengumuman tidak dapat diakses.';end if;if old.updated_at is distinct from (p_payload->>'expected_updated_at')::timestamptz then raise exception 'Pengumuman telah berubah. Muat ulang sebelum menyimpan.';end if;if old.source<>'manual' or old.status='archived' then raise exception 'Pulihkan arsip atau ubah materi sumber untuk melanjutkan.';end if;end if;
 if aid is null then aid=gen_random_uuid();insert into public.announcements(id,title,content,target_role,target_program_id,status,created_by) values(aid,btrim(p_payload->>'title'),btrim(p_payload->>'content'),role_value,program,'draft',auth.uid());rev=1;else rev=old.revision+1;end if;
 update public.announcements set title=btrim(p_payload->>'title'),content=btrim(p_payload->>'content'),target_role=role_value,target_program_id=program,target_class_id=class_id_value,status=status_value,publish_at=case when status_value='published' then coalesce(start_at,now()) else start_at end,expires_at=end_at,is_pinned=coalesce((p_payload->>'is_pinned')::boolean,false),action_kind=action_value,revision=rev,updated_at=now() where id=aid;
 result=jsonb_build_object('id',aid,'revision',rev,'status',status_value);insert into public.announcement_operations(request_key,user_id,payload,result) values(p_request_key,auth.uid(),p_payload,result);
 insert into public.audit_logs(user_id,action,entity_type,entity_id,details) values(auth.uid(),case when old.id is null then 'announcement.created' else 'announcement.updated' end,'announcement',aid,jsonb_build_object('status',status_value,'program_id',program,'class_id',class_id_value,'target_role',role_value,'revision',rev));return result;
end;$$;
revoke all on function public.admin_save_announcement(jsonb,uuid) from public,anon;
grant execute on function public.admin_save_announcement(jsonb,uuid) to authenticated;

create or replace function public.admin_set_announcement_state(p_id uuid,p_status text,p_expected_updated_at timestamptz) returns jsonb language plpgsql security definer set search_path=public as $$declare row public.announcements%rowtype;begin
 select * into row from public.announcements where id=p_id for update;if not found or not public.announcement_can_manage(row.target_program_id) then raise exception 'Pengumuman tidak dapat diakses.';end if;
 if p_status is null or p_status not in ('draft','published','archived') then raise exception 'Status belum valid.';end if;
 if row.status=p_status and p_status<>'published' then return jsonb_build_object('id',row.id,'status',row.status,'revision',row.revision);end if;
 if row.status='archived' and p_status<>'draft' then raise exception 'Pulihkan sebagai draf sebelum menayangkan kembali.';end if;
 if p_status='published' then
  if row.target_role not in ('all','participant','guardian','teacher','mentor','admin','finance','helpdesk','content_reviewer') or nullif(btrim(row.title),'') is null or nullif(btrim(row.content),'') is null or length(row.title)>160 or length(row.content)>8000 then raise exception 'Perbaiki isi dan sasaran sebelum menayangkan.';end if;
  if row.expires_at is not null and row.expires_at<=now() then raise exception 'Perbarui waktu berakhir sebelum menayangkan.';end if;
  if row.target_program_id is not null and not exists(select 1 from public.programs where id=row.target_program_id and status<>'archived') then raise exception 'Program telah diarsipkan.';end if;
  if row.target_class_id is not null and not exists(select 1 from public.classes where id=row.target_class_id and program_id=row.target_program_id and status='active') then raise exception 'Kelas tidak sesuai program atau tidak aktif.';end if;
  if row.source='lesson' and not exists(select 1 from public.lessons where id=row.source_lesson_id and visibility_status='published' and (release_at is null or release_at<=now())) then raise exception 'Materi sumber belum tersedia.';end if;
 end if;
 if row.status=p_status and p_status='published' and coalesce(row.publish_at,row.created_at)<=now() then return jsonb_build_object('id',row.id,'status',row.status,'revision',row.revision);end if;
 if row.updated_at is distinct from p_expected_updated_at then raise exception 'Pengumuman telah berubah. Muat ulang sebelum melanjutkan.';end if;
 update public.announcements set status=p_status,publish_at=case when p_status='published' then now() else publish_at end,revision=revision+1,updated_at=now() where id=row.id;
 insert into public.audit_logs(user_id,action,entity_type,entity_id,details) values(auth.uid(),'announcement.'||p_status,'announcement',row.id,jsonb_build_object('previous_status',row.status));return jsonb_build_object('id',row.id,'status',p_status,'revision',row.revision+1);end;$$;
revoke all on function public.admin_set_announcement_state(uuid,text,timestamptz) from public,anon;
grant execute on function public.admin_set_announcement_state(uuid,text,timestamptz) to authenticated;

create or replace function public.mark_announcement_read(p_id uuid,p_revision integer) returns jsonb language plpgsql security definer set search_path=public as $$declare row public.announcements%rowtype;begin
 select * into row from public.announcements where id=p_id for share;if not found or not public.announcement_visible(p_id) then raise exception 'Pengumuman tidak tersedia untuk akun Anda.';end if;if row.revision is distinct from p_revision then raise exception 'Isi pengumuman telah diperbarui. Muat ulang terlebih dahulu.';end if;
 insert into public.announcement_reads(announcement_id,user_id,revision) values(p_id,auth.uid(),row.revision) on conflict(announcement_id,user_id) do update set revision=excluded.revision,read_at=now() where announcement_reads.revision<>excluded.revision;return jsonb_build_object('id',p_id,'revision',row.revision);end;$$;
revoke all on function public.mark_announcement_read(uuid,integer) from public,anon;
grant execute on function public.mark_announcement_read(uuid,integer) to authenticated;

-- New automatic learning announcements carry their source; legacy messages are not inferred from text.
create or replace function public.create_lesson_publication_announcement() returns trigger language plpgsql security definer set search_path=public as $$
declare program uuid;program_name text;label text;existing public.announcements%rowtype;aid uuid;
begin
 select p.id,p.name into program,program_name from public.program_modules m join public.programs p on p.id=m.program_id where m.id=new.module_id;if program is null then return new;end if;
 select * into existing from public.announcements where source_lesson_id=new.id for update;
 if new.visibility_status<>'published' or new.lesson_type not in ('content','quiz','exam') then
  if existing.id is not null and existing.status<>'archived' then update public.announcements set status='draft',revision=revision+1,updated_at=now() where id=existing.id;insert into public.audit_logs(user_id,action,entity_type,entity_id,details) values(auth.uid(),'announcement.lesson_hidden','announcement',existing.id,jsonb_build_object('lesson_id',new.id));end if;return new;
 end if;
 if existing.id is null and tg_op='UPDATE' and old.visibility_status='published' then return new;end if;
 label=case new.lesson_type when 'quiz' then 'Kuis baru' when 'exam' then 'Ujian baru' else 'Materi baru' end;
 if existing.id is null then aid=gen_random_uuid();insert into public.announcements(id,title,content,target_role,target_program_id,status,created_by,source,source_lesson_id,action_kind,publish_at) values(aid,label||': '||new.title,format('%s sudah tersedia di %s.',new.title,program_name),'participant',program,'published',auth.uid(),'lesson',new.id,'lesson',greatest(now(),coalesce(new.release_at,now())));
 else aid=existing.id;update public.announcements set title=label||': '||new.title,content=format('%s sudah tersedia di %s.',new.title,program_name),target_program_id=program,status=case when existing.status='archived' then 'archived' else 'published' end,publish_at=case when new.release_at>now() then new.release_at else least(coalesce(existing.publish_at,now()),now()) end,revision=revision+1,updated_at=now() where id=aid;end if;
 insert into public.audit_logs(user_id,action,entity_type,entity_id,details) values(auth.uid(),'announcement.lesson_synced','announcement',aid,jsonb_build_object('lesson_id',new.id,'program_id',program));return new;
end;$$;
revoke all on function public.create_lesson_publication_announcement() from public,anon,authenticated;
drop trigger if exists lessons_create_publication_announcement on public.lessons;
create trigger lessons_create_publication_announcement after insert or update of visibility_status,release_at,title,module_id,lesson_type on public.lessons for each row execute function public.create_lesson_publication_announcement();

drop policy if exists "Admins can manage all announcements" on public.announcements;
drop policy if exists "Anyone can view published announcements" on public.announcements;
drop policy if exists "Authenticated users can view active published announcements" on public.announcements;
create policy announcement_scoped_read on public.announcements for select to authenticated using(public.announcement_can_manage(target_program_id) or public.announcement_visible(id));
create policy announcement_own_read_receipt on public.announcement_reads for select to authenticated using(user_id=auth.uid());
revoke all on public.announcements,public.announcement_reads,public.announcement_operations from anon,authenticated;
grant select on public.announcements,public.announcement_reads to authenticated;
