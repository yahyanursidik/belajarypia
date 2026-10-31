-- Assignment attempts are immutable after submission. All writes use scoped RPCs.
begin;
create table public.assignment_settings (
 lesson_id uuid primary key references public.lessons(id) on delete restrict,
 instructions text not null check(length(instructions) between 1 and 20000),
 response_kind text not null check(response_kind in ('text','document','checklist')),
 checklist jsonb not null default '[]' check(jsonb_typeof(checklist)='array'),
 allow_late boolean not null default false,
 revision uuid not null default gen_random_uuid(),
 created_by uuid not null references public.profiles(id),
 updated_at timestamptz not null default now()
);
create table public.assignment_submissions (
 id uuid primary key default gen_random_uuid(),
 lesson_id uuid not null references public.assignment_settings(lesson_id) on delete restrict,
 enrollment_id uuid not null references public.enrollments(id) on delete restrict,
 attempt_number integer not null check(attempt_number>0),
 status text not null default 'draft' check(status in ('draft','submitted','needs_revision','accepted')),
 answer_text text not null default '' check(length(answer_text)<=50000),
 checked_items jsonb not null default '[]' check(jsonb_typeof(checked_items)='array'),
 file_ids uuid[] not null default '{}',
 snapshot jsonb not null default '{}',
 score numeric check(score between 0 and 100), feedback text check(length(feedback)<=6000),
 reviewed_by uuid references public.profiles(id), reviewed_at timestamptz, submitted_at timestamptz,
 revision uuid not null default gen_random_uuid(),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(enrollment_id,lesson_id,attempt_number)
);
create table public.assignment_files (
 id uuid primary key default gen_random_uuid(),
 submission_id uuid not null references public.assignment_submissions(id) on delete restrict,
 owner_id uuid not null references public.profiles(id),
 file_name text not null, mime_type text not null, file_size integer not null check(file_size between 1 and 5242880),
 object_key text not null, status text not null default 'staged' check(status in ('staged','ready')),
 created_at timestamptz not null default now()
);
create index assignment_submissions_lesson_status_idx on public.assignment_submissions(lesson_id,status,submitted_at);
create index assignment_files_submission_idx on public.assignment_files(submission_id);
alter table public.assignment_settings enable row level security;
alter table public.assignment_submissions enable row level security;
alter table public.assignment_files enable row level security;
revoke all on public.assignment_settings,public.assignment_submissions,public.assignment_files from public,anon,authenticated;

create function public.assignment_active_actor() returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from profiles p join auth.users u on u.id=p.id where p.id=auth.uid() and p.status='active' and not coalesce(u.banned_until>now(),false));
$$;
create function public.assignment_manage(p_program uuid) returns boolean language sql stable security definer set search_path=public as $$
 select public.assignment_active_actor() and (public.is_super_admin() or (public.has_role('admin') and public.can_access_program(p_program)) or (public.has_role('teacher') and exists(select 1 from programs where id=p_program and teacher_user_id=auth.uid())));
$$;
create function public.assignment_program_access(p_program uuid) returns boolean language sql stable security definer set search_path=public as $$
 select public.assignment_manage(p_program) or (public.assignment_active_actor() and public.has_role('teacher') and exists(select 1 from classes where program_id=p_program and teacher_user_id=auth.uid() and status='active'));
$$;
create function public.assignment_owner(p_enrollment uuid) returns boolean language sql stable security definer set search_path=public as $$
 select public.assignment_active_actor() and exists(select 1 from enrollments e join participants p on p.id=e.participant_id where e.id=p_enrollment and p.user_id=auth.uid() and p.status='active');
$$;
create function public.assignment_reviewer(p_enrollment uuid) returns boolean language sql stable security definer set search_path=public as $$
 select public.assignment_active_actor() and not public.assignment_owner(p_enrollment) and exists(select 1 from enrollments e where e.id=p_enrollment and (public.assignment_manage(e.program_id) or (public.has_role('teacher') and exists(select 1 from classes c where c.id=e.class_id and c.program_id=e.program_id and c.teacher_user_id=auth.uid() and c.status='active'))));
$$;
create function public.assignment_can_work(p_lesson uuid,p_enrollment uuid) returns boolean language sql stable security definer set search_path=public as $$
 select public.assignment_owner(p_enrollment) and exists(select 1 from enrollments e join programs p on p.id=e.program_id join program_modules m on m.program_id=p.id join lessons l on l.module_id=m.id join assignment_settings a on a.lesson_id=l.id where e.id=p_enrollment and e.enrollment_status='active' and p.status='active' and l.id=p_lesson and l.lesson_type='assignment' and l.visibility_status='published' and (l.release_at is null or l.release_at<=now()) and not exists(select 1 from lesson_prerequisites r where r.lesson_id=l.id and not exists(select 1 from lesson_progresses lp where lp.enrollment_id=e.id and lp.lesson_id=r.prerequisite_lesson_id and lp.status='completed')));
$$;

create function public.assignment_configure(p_lesson uuid,p_module uuid,p_revision uuid,p_title text,p_config jsonb,p_publish boolean default false) returns uuid
language plpgsql security definer set search_path=public as $$
declare target uuid:=p_lesson; v_program uuid; existing assignment_settings%rowtype; checks jsonb; kind text; release_time timestamptz; due_time timestamptz;
begin
 if p_module is null then raise exception 'Pilih mata pelajaran.';end if;
 select m.program_id into v_program from program_modules m where m.id=p_module for share;
 if not public.assignment_manage(v_program) then raise exception 'Akses pengaturan tugas ditolak.' using errcode='42501';end if;
 if jsonb_typeof(p_config) is distinct from 'object' or length(btrim(coalesce(p_title,''))) not between 1 and 200 or length(btrim(coalesce(p_config->>'instructions',''))) not between 1 and 20000 then raise exception 'Judul dan instruksi tugas wajib diisi.';end if;
 kind=p_config->>'response_kind';checks=coalesce(p_config->'checklist','[]');
 if kind is null or kind not in ('text','document','checklist') or jsonb_typeof(checks)<>'array' or jsonb_array_length(checks)>30 then raise exception 'Jenis jawaban atau checklist tidak valid.';end if;
 if exists(select 1 from jsonb_array_elements(checks) v where jsonb_typeof(v)<>'string' or length(btrim(v#>>'{}')) not between 1 and 500) or (select count(*)<>count(distinct v) from jsonb_array_elements(checks) v) or (kind='checklist' and jsonb_array_length(checks)=0) or (kind<>'checklist' and jsonb_array_length(checks)>0) then raise exception 'Checklist harus berisi butir unik dan tidak kosong.';end if;
 if jsonb_typeof(p_config->'allow_late') is distinct from 'boolean' then raise exception 'Aturan tenggat tidak valid.';end if;
 release_time=nullif(p_config->>'release_at','')::timestamptz;due_time=nullif(p_config->>'due_at','')::timestamptz;
 if release_time is not null and due_time is not null and due_time<release_time then raise exception 'Tenggat tidak boleh mendahului waktu rilis.';end if;
 if target is null then
  target=gen_random_uuid();
  insert into lessons(id,module_id,code,title,lesson_type,order_no,visibility_status) values(target,p_module,'TASK-'||target::text,btrim(p_title),'assignment',coalesce((select max(order_no)+1 from lessons where module_id=p_module),0),'draft');
 else
  perform 1 from lessons where id=target and module_id=p_module and lesson_type='assignment' for update;
  if not found then raise exception 'Materi tugas tidak sesuai.';end if;
 end if;
 -- Same lesson lock as begin: configuration cannot race the first draft.
 select * into existing from assignment_settings where lesson_id=target for update;
 if existing.lesson_id is not null and p_revision is distinct from existing.revision then raise exception 'Pengaturan sudah berubah. Muat ulang.' using errcode='40001';end if;
 if exists(select 1 from assignment_submissions where lesson_id=target) then raise exception 'Pengaturan terkunci setelah peserta mulai. Buat tugas baru untuk instruksi berbeda.';end if;
 insert into assignment_settings(lesson_id,instructions,response_kind,checklist,allow_late,created_by) values(target,btrim(p_config->>'instructions'),kind,checks,(p_config->>'allow_late')::boolean,auth.uid())
 on conflict(lesson_id) do update set instructions=excluded.instructions,response_kind=excluded.response_kind,checklist=excluded.checklist,allow_late=excluded.allow_late,revision=gen_random_uuid(),updated_at=now();
 update lessons set title=btrim(p_title),content_body=btrim(p_config->>'instructions'),content_format='plain_text',release_at=release_time,due_at=due_time,visibility_status=case when p_publish then 'published' else 'draft' end where id=target;
 insert into audit_logs(user_id,action,entity_type,entity_id,details) values(auth.uid(),'assignment.configured','lesson',target,jsonb_build_object('program_id',v_program,'published',p_publish,'response_kind',kind));
 return target;
end;$$;

create function public.assignment_file_access(p_id uuid) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from assignment_files f join assignment_submissions s on s.id=f.submission_id where f.id=p_id and (public.assignment_owner(s.enrollment_id) or (s.status<>'draft' and f.id=any(s.file_ids) and public.assignment_reviewer(s.enrollment_id))));
$$;
create policy assignment_file_read on public.assignment_files for select to authenticated using(public.assignment_file_access(id));
grant select on public.assignment_files to authenticated;

create function public.assignment_prepare_file(p_submission uuid,p_name text,p_mime text,p_size integer) returns jsonb language plpgsql security definer set search_path=public as $$
declare s assignment_submissions%rowtype; f assignment_files%rowtype; ext text;
begin
 select * into s from assignment_submissions where id=p_submission for update;
 if not found or s.status<>'draft' or not public.assignment_can_work(s.lesson_id,s.enrollment_id) then raise exception 'Akses unggahan ditolak.' using errcode='42501';end if;
 ext=lower(substring(p_name from '\.([a-zA-Z0-9]+)$'));
 if p_size is null or p_size not between 1 and 5242880 or p_name is null or length(p_name) not between 1 and 180 or p_name ~ '[[:cntrl:]/\\]' or not coalesce((ext='pdf' and p_mime='application/pdf') or (ext='png' and p_mime='image/png') or (ext in ('jpg','jpeg') and p_mime='image/jpeg') or (ext='webp' and p_mime='image/webp'),false) then raise exception 'Gunakan PDF, JPG, PNG atau WebP maksimal 5 MB.';end if;
 if (select count(*) from assignment_files where submission_id=s.id)>=20 then raise exception 'Batas unggahan draf tercapai. Hubungi bantuan.';end if;
 f.id=gen_random_uuid();
 insert into assignment_files(id,submission_id,owner_id,file_name,mime_type,file_size,object_key) values(f.id,s.id,auth.uid(),p_name,p_mime,p_size,'assignments/staging/'||f.id::text||'.'||ext) returning * into f;
 return to_jsonb(f);
end;$$;
create function public.assignment_mark_file_ready(p_id uuid,p_owner uuid,p_object_key text) returns void language plpgsql security definer set search_path=public as $$
declare f assignment_files%rowtype; s assignment_submissions%rowtype;
begin
 select * into s from assignment_submissions where id=(select submission_id from assignment_files where id=p_id) for update;
 select * into f from assignment_files where id=p_id and owner_id=p_owner for update;
 if f.id is null or s.status<>'draft' or not exists(select 1 from enrollments e join participants p on p.id=e.participant_id join profiles u on u.id=p.user_id join auth.users au on au.id=u.id where e.id=s.enrollment_id and e.enrollment_status='active' and p.status='active' and p.user_id=p_owner and u.status='active' and not coalesce(au.banned_until>now(),false)) then raise exception 'Dokumen tidak dapat diubah.';end if;
 if f.status='ready' then return;end if;
 if p_object_key is null or p_object_key !~ ('^assignments/ready/'||f.id::text||'/[a-f0-9-]{36}\.(pdf|png|jpg|jpeg|webp)$') then raise exception 'Dokumen tidak valid.';end if;
 update assignment_files set status='ready',object_key=p_object_key where id=p_id;
end;$$;
create function public.assignment_download_file(p_id uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare f assignment_files%rowtype;
begin
 if not public.assignment_file_access(p_id) then raise exception 'Akses dokumen ditolak.' using errcode='42501';end if;
 select * into f from assignment_files where id=p_id and status='ready';
 if not found then raise exception 'Dokumen belum siap.';end if;
 insert into audit_logs(user_id,action,entity_type,entity_id,details) values(auth.uid(),'assignment.file_downloaded','assignment_submission',f.submission_id,jsonb_build_object('file_id',f.id));
 return to_jsonb(f);
end;$$;

create function public.assignment_detail(p_lesson uuid,p_enrollment uuid default null) returns jsonb language plpgsql stable security definer set search_path=public as $$
declare l lessons%rowtype; v_program uuid; eid uuid:=p_enrollment; own boolean; staff boolean;
begin
 if not public.assignment_active_actor() then raise exception 'Silakan masuk dengan akun aktif.' using errcode='42501';end if;
 select * into l from lessons where id=p_lesson and lesson_type='assignment';
 if not found then raise exception 'Tugas tidak ditemukan.';end if;
 select m.program_id into v_program from program_modules m where m.id=l.module_id;
 if eid is null then select e.id into eid from enrollments e join participants p on p.id=e.participant_id where p.user_id=auth.uid() and e.program_id=v_program;end if;
 own=coalesce(public.assignment_owner(eid),false);staff=public.assignment_program_access(v_program);
 if eid is not null and not exists(select 1 from enrollments where id=eid and enrollments.program_id=v_program) then raise exception 'Kepesertaan tidak sesuai.';end if;
 if eid is not null and not (own or public.assignment_reviewer(eid)) then raise exception 'Akses jawaban ditolak.' using errcode='42501';end if;
 if not staff and not (own and (public.assignment_can_work(p_lesson,eid) or exists(select 1 from assignment_submissions where lesson_id=p_lesson and enrollment_id=eid))) then raise exception 'Akses tugas ditolak. Periksa prasyarat.' using errcode='42501';end if;
 return jsonb_build_object('lesson',jsonb_build_object('id',l.id,'title',l.title,'module_id',l.module_id,'program_id',v_program,'program_name',(select name from programs where id=v_program),'release_at',l.release_at,'due_at',l.due_at,'visibility_status',l.visibility_status),
 'config',(select to_jsonb(a)-'created_by' from assignment_settings a where lesson_id=p_lesson),
 'enrollment_id',eid,'participant_name',(select p.display_name from enrollments e join participants p on p.id=e.participant_id where e.id=eid),
 'can_manage',public.assignment_manage(v_program),'config_locked',exists(select 1 from assignment_submissions where lesson_id=p_lesson),
 'is_owner',own,'can_work',public.assignment_can_work(p_lesson,eid),'can_review',coalesce(public.assignment_reviewer(eid),false),
 'legacy_completed',exists(select 1 from lesson_progresses where lesson_id=p_lesson and enrollment_id=eid and status='completed') and not exists(select 1 from assignment_submissions where lesson_id=p_lesson and enrollment_id=eid),
 'history',coalesce((select jsonb_agg(to_jsonb(s)||jsonb_build_object('files',coalesce((select jsonb_agg(jsonb_build_object('id',f.id,'file_name',f.file_name,'mime_type',f.mime_type,'file_size',f.file_size) order by f.created_at,f.id) from assignment_files f where f.id=any(s.file_ids) and f.status='ready'),'[]')) order by s.attempt_number desc) from assignment_submissions s where s.lesson_id=p_lesson and s.enrollment_id=eid and (own or s.status<>'draft')),'[]'));
end;$$;

create function public.assignment_workspace(p_view text default 'mine',p_program uuid default null,p_status text default 'all',p_page integer default 1,p_search text default '') returns jsonb language plpgsql stable security definer set search_path=public as $$
declare result jsonb; options jsonb; modules jsonb;
begin
 if not public.assignment_active_actor() then raise exception 'Silakan masuk dengan akun aktif.' using errcode='42501';end if;
 if p_view is null or p_view not in ('mine','catalog','review') or p_page is null or p_page not between 1 and 100000 or length(coalesce(p_search,''))>150 then raise exception 'Filter tugas tidak valid.';end if;
 if p_view<>'mine' and not (public.is_super_admin() or public.has_role('admin') or public.has_role('teacher')) then raise exception 'Akses pengelolaan tugas ditolak.' using errcode='42501';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'can_manage',public.assignment_manage(p.id)) order by p.name,p.id),'[]') into options from programs p where case when p_view='mine' then p.status='active' and exists(select 1 from enrollments e where e.program_id=p.id and e.enrollment_status='active' and public.assignment_owner(e.id)) else public.assignment_program_access(p.id) end;
 select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'program_id',m.program_id,'title',m.title) order by m.order_no,m.id),'[]') into modules from program_modules m where p_view='catalog' and public.assignment_manage(m.program_id);
 with rows as (
 select l.id as lesson_id,l.title,p.id as program_id,p.name as program_name,l.module_id,l.due_at,l.visibility_status,
 case when p_view='catalog' then case when a.lesson_id is null then 'unconfigured' else l.visibility_status end else coalesce(s.status,case when lp.status='completed' then 'legacy_completed' else 'not_started' end) end as status,
 e.id as enrollment_id,s.id as submission_id,s.attempt_number,s.submitted_at,s.score,person.display_name as participant_name,
 public.assignment_manage(p.id) as can_manage,
 case when p_view='mine' then public.assignment_can_work(l.id,e.id) else true end as can_work,
 a.response_kind,
 (select count(*) from assignment_submissions ss where ss.lesson_id=l.id and ss.status='submitted' and public.assignment_reviewer(ss.enrollment_id)) as pending_count
 from lessons l join program_modules m on m.id=l.module_id join programs p on p.id=m.program_id left join assignment_settings a on a.lesson_id=l.id
 left join enrollments e on e.program_id=p.id and p_view<>'catalog'
 left join participants person on person.id=e.participant_id
 left join lateral(select * from assignment_submissions x where x.lesson_id=l.id and x.enrollment_id=e.id and (p_view<>'review' or x.status<>'draft') order by x.attempt_number desc limit 1) s on true
 left join lesson_progresses lp on lp.enrollment_id=e.id and lp.lesson_id=l.id
 where l.lesson_type='assignment' and (p_program is null or p.id=p_program) and (coalesce(p_search,'')='' or l.title ilike '%'||p_search||'%' or (p_view='review' and person.display_name ilike '%'||p_search||'%'))
 and case when p_view='mine' then public.assignment_owner(e.id) and e.enrollment_status='active' and p.status='active' and l.visibility_status='published' and (l.release_at is null or l.release_at<=now())
 when p_view='catalog' then public.assignment_program_access(p.id)
 else s.status in ('submitted','needs_revision','accepted') and public.assignment_reviewer(e.id) end
 ), filtered as (select * from rows where p_status='all' or status=p_status), paged as (select * from filtered order by case when p_view='mine' then case status when 'needs_revision' then 0 when 'draft' then 1 when 'not_started' then 2 when 'submitted' then 3 else 4 end else case status when 'submitted' then 0 when 'needs_revision' then 1 else 2 end end,submitted_at asc nulls last,title,lesson_id,enrollment_id limit 30 offset (p_page-1)*30)
 select jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(x)) from paged x),'[]'),'total',(select count(*) from filtered),'programs',options,'modules',modules) into result;
 return result;
end;$$;

create function public.assignment_begin(p_lesson uuid) returns uuid language plpgsql security definer set search_path=public as $$
declare enr enrollments%rowtype; prev assignment_submissions%rowtype; a assignment_settings%rowtype; l lessons%rowtype; target uuid; new_files uuid[]:='{}'; f assignment_files%rowtype; fid uuid;
begin
 select * into l from lessons where id=p_lesson for update;
 if not found then raise exception 'Tugas tidak tersedia.';end if;
 select e.* into enr from enrollments e join participants p on p.id=e.participant_id join program_modules m on m.program_id=e.program_id where m.id=l.module_id and p.user_id=auth.uid() and e.enrollment_status='active';
 if not public.assignment_can_work(p_lesson,enr.id) then raise exception 'Akses tugas belum tersedia. Periksa program dan prasyarat.' using errcode='42501';end if;
 select * into a from assignment_settings where lesson_id=p_lesson;
 perform pg_advisory_xact_lock(hashtextextended(enr.id::text||':'||p_lesson::text,0));
 select * into prev from assignment_submissions where lesson_id=p_lesson and enrollment_id=enr.id order by attempt_number desc limit 1 for update;
 if prev.id is not null and prev.status<>'needs_revision' then return prev.id;end if;
 if prev.id is null and exists(select 1 from lesson_progresses where enrollment_id=enr.id and lesson_id=p_lesson and status='completed') then raise exception 'Tugas ini sudah memiliki hasil lama. Hubungi pengajar.';end if;
 if prev.id is null and not a.allow_late and l.due_at<now() then raise exception 'Tenggat pengumpulan pertama sudah lewat.';end if;
 target=gen_random_uuid();
 insert into assignment_submissions(id,lesson_id,enrollment_id,attempt_number,answer_text,checked_items) values(target,p_lesson,enr.id,coalesce(prev.attempt_number,0)+1,coalesce(prev.answer_text,''),coalesce(prev.checked_items,'[]'));
 for f in select * from assignment_files where id=any(prev.file_ids) and status='ready' loop
  fid=gen_random_uuid();insert into assignment_files(id,submission_id,owner_id,file_name,mime_type,file_size,object_key,status) values(fid,target,auth.uid(),f.file_name,f.mime_type,f.file_size,f.object_key,'ready');new_files=array_append(new_files,fid);
 end loop;
 update assignment_submissions set file_ids=new_files where id=target;
 insert into audit_logs(user_id,action,entity_type,entity_id,details) values(auth.uid(),'assignment.draft_started','assignment_submission',target,jsonb_build_object('lesson_id',p_lesson,'attempt_number',coalesce(prev.attempt_number,0)+1));
 return target;
end;$$;

create function public.assignment_save(p_id uuid,p_revision uuid,p_text text,p_checks jsonb,p_files uuid[],p_submit boolean default false) returns uuid
language plpgsql security definer set search_path=public as $$
declare s assignment_submissions%rowtype; a assignment_settings%rowtype; l lessons%rowtype; person uuid;
begin
 select * into s from assignment_submissions where id=p_id for update;
 if not found or not public.assignment_can_work(s.lesson_id,s.enrollment_id) then raise exception 'Akses jawaban ditolak.' using errcode='42501';end if;
 if s.status='submitted' and p_submit then return s.id;end if;
 if s.status<>'draft' then raise exception 'Jawaban sudah dikumpulkan dan tidak dapat ditimpa.';end if;
 if p_revision is distinct from s.revision then raise exception 'Draf sudah berubah. Salin jawaban Anda sebelum memuat ulang.' using errcode='40001';end if;
 select * into a from assignment_settings where lesson_id=s.lesson_id;
 select * into l from lessons where id=s.lesson_id;
 if p_text is null or length(p_text)>50000 or jsonb_typeof(p_checks) is distinct from 'array' or p_files is null or cardinality(p_files)>5 then raise exception 'Jawaban tidak valid; maksimal 50.000 karakter dan 5 lampiran.';end if;
 if (select count(*)<>count(distinct x) from unnest(p_files) x) or exists(select 1 from unnest(p_files) x where x is null or not exists(select 1 from assignment_files f where f.id=x and f.submission_id=s.id and f.owner_id=auth.uid() and f.status='ready')) then raise exception 'Lampiran belum siap atau bukan milik jawaban ini.';end if;
 if exists(select 1 from jsonb_array_elements(p_checks) v where jsonb_typeof(v)<>'number' or (v#>>'{}')::numeric<>trunc((v#>>'{}')::numeric) or (v#>>'{}')::numeric<0 or (v#>>'{}')::numeric>=jsonb_array_length(a.checklist)) or (select count(*)<>count(distinct v) from jsonb_array_elements(p_checks) v) then raise exception 'Pilihan checklist tidak valid.';end if;
 if a.response_kind<>'checklist' and jsonb_array_length(p_checks)>0 then raise exception 'Tugas ini tidak menggunakan checklist.';end if;
 if p_submit then
  if s.attempt_number=1 and not a.allow_late and l.due_at<now() then raise exception 'Tenggat pengumpulan pertama sudah lewat. Draf tetap dapat disimpan.';end if;
  if (a.response_kind='text' and length(btrim(p_text))=0) or (a.response_kind='document' and cardinality(p_files)=0) or (a.response_kind='checklist' and jsonb_array_length(p_checks)<>jsonb_array_length(a.checklist)) then raise exception 'Lengkapi jawaban yang diwajibkan sebelum mengumpulkan.';end if;
 end if;
 update assignment_submissions set answer_text=p_text,checked_items=p_checks,file_ids=p_files,revision=gen_random_uuid(),updated_at=now(),status=case when p_submit then 'submitted' else 'draft' end,submitted_at=case when p_submit then now() else null end,
 snapshot=case when p_submit then jsonb_build_object('title',l.title,'instructions',a.instructions,'response_kind',a.response_kind,'checklist',a.checklist,'due_at',l.due_at,'late',coalesce(l.due_at<now(),false)) else snapshot end where id=s.id;
 if p_submit then
  select participant_id into person from enrollments where id=s.enrollment_id;
  insert into lesson_progresses(enrollment_id,participant_id,lesson_id,status) values(s.enrollment_id,person,s.lesson_id,'started') on conflict(enrollment_id,lesson_id) do nothing;
 end if;
 insert into audit_logs(user_id,action,entity_type,entity_id,details) values(auth.uid(),case when p_submit then 'assignment.submitted' else 'assignment.draft_saved' end,'assignment_submission',s.id,jsonb_build_object('lesson_id',s.lesson_id,'attempt_number',s.attempt_number,'file_count',cardinality(p_files)));
 return s.id;
end;$$;

create function public.assignment_review(p_id uuid,p_revision uuid,p_decision text,p_score numeric,p_feedback text) returns uuid
language plpgsql security definer set search_path=public as $$
declare s assignment_submissions%rowtype; enr enrollments%rowtype;
begin
 select * into s from assignment_submissions where id=p_id for update;
 if not found or not public.assignment_reviewer(s.enrollment_id) then raise exception 'Akses penilaian ditolak.' using errcode='42501';end if;
 select * into enr from enrollments where id=s.enrollment_id for share;
 if enr.enrollment_status<>'active' then raise exception 'Kepesertaan tidak aktif. Penilaian belum dapat difinalkan.';end if;
 if s.status<>'submitted' then raise exception 'Jawaban sudah ditinjau atau belum dikumpulkan.';end if;
 if p_revision is distinct from s.revision then raise exception 'Jawaban sudah berubah. Muat ulang sebelum menilai.' using errcode='40001';end if;
 if p_decision is null or p_decision not in ('needs_revision','accepted') or length(coalesce(p_feedback,''))>6000 or (p_decision='needs_revision' and length(btrim(coalesce(p_feedback,'')))=0) then raise exception 'Isi umpan balik revisi yang jelas (maksimal 6.000 karakter).';end if;
 if p_decision='accepted' and (p_score is null or p_score<0 or p_score>100) then raise exception 'Nilai final wajib antara 0 dan 100.';end if;
 if exists(select 1 from assignment_submissions where enrollment_id=s.enrollment_id and lesson_id=s.lesson_id and attempt_number>s.attempt_number) then raise exception 'Nilai hanya dapat diberikan pada kiriman terbaru.';end if;
 update assignment_submissions set status=p_decision,score=case when p_decision='accepted' then p_score else null end,feedback=nullif(btrim(p_feedback),''),reviewed_by=auth.uid(),reviewed_at=now(),revision=gen_random_uuid(),updated_at=now() where id=s.id;
 if p_decision='accepted' then
  insert into lesson_progresses(enrollment_id,participant_id,lesson_id,status,score,completed_at) values(s.enrollment_id,enr.participant_id,s.lesson_id,'completed',p_score,now()) on conflict(enrollment_id,lesson_id) do update set status='completed',score=excluded.score,completed_at=excluded.completed_at,updated_at=now();
 end if;
 insert into audit_logs(user_id,action,entity_type,entity_id,details) values(auth.uid(),'assignment.'||p_decision,'assignment_submission',s.id,jsonb_build_object('lesson_id',s.lesson_id,'enrollment_id',s.enrollment_id,'attempt_number',s.attempt_number,'score',case when p_decision='accepted' then p_score else null end));
 return s.id;
end;$$;

-- Helpers are private; only the policy wrapper and explicit commands are callable.
do $$declare f record;begin
 for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=any(array['assignment_active_actor','assignment_manage','assignment_program_access','assignment_owner','assignment_reviewer','assignment_can_work','assignment_configure','assignment_file_access','assignment_prepare_file','assignment_mark_file_ready','assignment_download_file','assignment_detail','assignment_workspace','assignment_begin','assignment_save','assignment_review']) loop
 execute 'revoke all on function '||f.signature||' from public,anon,authenticated';
 end loop;
end;$$;
grant execute on function public.assignment_configure(uuid,uuid,uuid,text,jsonb,boolean),public.assignment_begin(uuid),public.assignment_save(uuid,uuid,text,jsonb,uuid[],boolean),public.assignment_review(uuid,uuid,text,numeric,text),public.assignment_prepare_file(uuid,text,text,integer),public.assignment_download_file(uuid),public.assignment_detail(uuid,uuid),public.assignment_workspace(text,uuid,text,integer,text),public.assignment_file_access(uuid) to authenticated;
revoke all on function public.assignment_mark_file_ready(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.assignment_mark_file_ready(uuid,uuid,text) to service_role;
commit;
